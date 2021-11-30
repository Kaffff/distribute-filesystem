import { IPFSHTTPClient, create } from "ipfs-http-client";
import { OrbitDB, createInstance } from "orbit-db";
import DocumentStore from "orbit-db-docstore";
import { Identity, createIdentity } from "orbit-db-identity-provider";
import { keys } from "libp2p-crypto";
import { nanoid } from "nanoid";
import { FileTable, CreateOptions, Role } from "./types";
import pathBrowserify from "path-browserify";
import {
    uploadFile,
    downloadFile,
    encryptKey,
    decryptKey,
    getFileMetadataDB,
    uploadFileInfo,
    uploadFilePermission,
    getReadKey,
} from "./utils";
export default class FS {
    ipfs!: IPFSHTTPClient;
    orbitdb!: OrbitDB;
    identity!: Identity;
    fileTable!: DocumentStore<FileTable>;

    static async createFS(options: CreateOptions) {
        const fs = new FS();
        fs.identity = await createIdentity({
            id: options.identityId || "TESTID",
        });
        fs.ipfs = create({ url: options.ipfsUrl || "http://127.0.0.1:5001" });
        fs.orbitdb = await createInstance(fs.ipfs, {
            identity: fs.identity,
        });
        fs.fileTable = await fs.orbitdb.docstore(
            options.fileTableAddress || "__FILETABLE__",
            {
                indexBy: "path",
            }
        );
        await fs.fileTable.load();
        console.log(fs.identity.id);
        console.log(fs.fileTable.address.toString());
        console.log(fs.fileTable);
        return fs;
    }

    async readdir(path: string) {
        await this.fileTable.load();
        const pathList = this.fileTable.get("");

        const re = new RegExp(`^${pathBrowserify.join("/", path, "/")}[^/]+`);
        const result = new Set<string>();
        pathList.forEach((p) => {
            const match = re.exec(p.path);
            if (match)
                result.add(
                    match[0].replace(pathBrowserify.join("/", path, "/"), "")
                );
        });
        return Array.from(result);
    }
    async readFile(path: string) {
        path = pathBrowserify.join("/", path);
        const { infoDB, permissionDB } = await getFileMetadataDB(
            this.orbitdb,
            this.fileTable,
            path
        );
        console.log(infoDB);
        console.log(permissionDB);
        const sk: keys.supportedKeys.secp256k1.Secp256k1PrivateKey =
            await this.identity.provider.keystore.getKey("TESTID");
        const readKey = await getReadKey(permissionDB, sk);
        const cid = infoDB.get("")[0].cid;
        const data = await downloadFile(this.ipfs, cid, readKey);
        console.log(data);
        return data;
    }
    async writeFile(path: string, data: string, permission?: Role[]) {
        path = pathBrowserify.join("/", path);
        const readKey = nanoid();
        const cid = await uploadFile(this.ipfs, data, readKey);
        const writeAccess: string[] = [];
        permission?.forEach(({ id, mode }) => {
            if (mode === "w") writeAccess.push(id);
        });
        const { infoDB, permissionDB } = await getFileMetadataDB(
            this.orbitdb,
            this.fileTable,
            path,
            { create: true, writeAccess }
        );
        await uploadFilePermission(permissionDB, readKey, permission);
        await uploadFileInfo(infoDB, cid);
        console.log("write");
    }

    async rm(path: string) {
        path = pathBrowserify.join("/", path);
        const { infoDB, permissionDB } = await getFileMetadataDB(
            this.orbitdb,
            this.fileTable,
            path
        );
        // this.ipfs.pin.rm(infoDB.get("")[0].cid);
        await infoDB.drop();
        await permissionDB.drop();
        await this.fileTable.load();
        this.fileTable.del(path);
    }

    async readAccessRole(path: string): Promise<Role[]> {
        path = pathBrowserify.join("/", path);
        const { infoDB, permissionDB } = await getFileMetadataDB(
            this.orbitdb,
            this.fileTable,
            path
        );
        return permissionDB
            .get("")
            .map(({ id, encryptedReadKey, canWrite }) => {
                const mode = canWrite ? "w" : "r";
                return { id, mode };
            });
    }

    async grantRead(path: string, id: string[]) {
        path = pathBrowserify.join("/", path);
        const { infoDB, permissionDB } = await getFileMetadataDB(
            this.orbitdb,
            this.fileTable,
            path
        );
        const sk: keys.supportedKeys.secp256k1.Secp256k1PrivateKey =
            await this.identity.provider.keystore.getKey("TESTID");
        const readKey = await getReadKey(permissionDB, sk);
        id.forEach(async (_id) => {
            const encryptedReadKey = await encryptKey(readKey, _id);
            await permissionDB.put({
                id: _id,
                encryptedReadKey,
                canWrite: false,
            });
        });
        console.log("grant read");
    }

    async revokeRead(path: string, id: string[]) {
        path = pathBrowserify.join("/", path);
        const { infoDB, permissionDB } = await getFileMetadataDB(
            this.orbitdb,
            this.fileTable,
            path
        );
        const role: Role[] = await this.readAccessRole(path);
        const newRole: Role[] = [];
        role.forEach((_role) => {
            if (id.indexOf(_role.id) === -1) {
                newRole.push(_role);
            }
        });
        const data = await this.readFile(path);
        await this.writeFile(path, data, newRole);
        id.forEach(async (_id) => {
            await permissionDB.del(_id);
        });
    }

    async grantWrite(path: string, id: string[]) {
        path = pathBrowserify.join("/", path);
        const { infoDB, permissionDB } = await getFileMetadataDB(
            this.orbitdb,
            this.fileTable,
            path
        );
        const sk: keys.supportedKeys.secp256k1.Secp256k1PrivateKey =
            await this.identity.provider.keystore.getKey("TESTID");
        const readKey = await getReadKey(permissionDB, sk);
        id.forEach(async (_id) => {
            await infoDB.access.grant("write", _id);
            await permissionDB.access.grant("write", _id);
            const encryptedReadKey = await encryptKey(readKey, _id);
            await permissionDB.put({
                id: _id,
                encryptedReadKey,
                canWrite: true,
            });
        });
    }

    async revokeWrite(path: string, id: string[]) {
        path = pathBrowserify.join("/", path);
        const { infoDB, permissionDB } = await getFileMetadataDB(
            this.orbitdb,
            this.fileTable,
            path
        );
        id.forEach(async (_id) => {
            await infoDB.access.revoke("write", _id);
            await permissionDB.access.revoke("write", _id);
            await permissionDB.put({
                id: _id,
                encryptedReadKey: permissionDB.get(_id)[0].encryptedReadKey,
                canWrite: false,
            });
        });
    }
    async test() {
        const { infoDB, permissionDB } = await getFileMetadataDB(
            this.orbitdb,
            this.fileTable,
            "/test.txt"
        );
        console.log(infoDB);
        console.log(permissionDB);
    }
}
