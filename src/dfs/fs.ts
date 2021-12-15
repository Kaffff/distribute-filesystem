import { IPFSHTTPClient, create } from "ipfs-http-client";
import { OrbitDB, createInstance } from "orbit-db";
import DocumentStore from "orbit-db-docstore";
import { Identity, createIdentity } from "orbit-db-identity-provider";
import { keys } from "libp2p-crypto";
import { nanoid } from "nanoid";
import { MetadataStore, CreateOptions, ReadKey, ACL } from "./types";
import pathBrowserify from "path-browserify";
import {
    uploadFile,
    downloadFile,
    encryptKey,
    decryptKey,
    getMetadata,
} from "./utils";
export default class FS {
    ipfs!: IPFSHTTPClient;
    orbitdb!: OrbitDB;
    identity!: Identity;
    metadataStore!: DocumentStore<MetadataStore>;

    static async createFS(
        options: CreateOptions = {
            metadataStoreAddress: "",
            identityId: "",
            ipfsUrl: "",
        }
    ) {
        const fs = new FS();
        fs.identity = await createIdentity({
            id: options.identityId || "TESTID",
        });
        fs.ipfs = create({ url: options.ipfsUrl || "http://127.0.0.1:5001" });
        fs.orbitdb = await createInstance(fs.ipfs, {
            identity: fs.identity,
        });
        fs.metadataStore = await fs.orbitdb.docstore(
            options.metadataStoreAddress || "__METADATASTORE__",
            {
                indexBy: "path",
            }
        );
        await fs.metadataStore.load();
        console.log(fs.identity.id);
        console.log(fs.metadataStore.address.toString());
        console.log(fs.metadataStore);
        return fs;
    }

    async readdir(path: string) {
        await this.metadataStore.load();
        const pathList = this.metadataStore.get("");
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
        const metadata = await getMetadata(
            this.orbitdb,
            this.metadataStore,
            path
        );
        await metadata.load();
        const head = metadata.get("")[0];
        if (!head) throw new Error(`metadata is not found`);
        const cid = head.cid;
        const readKeyList: ReadKey[] = JSON.parse(head.stringifiedReadKeys);
        let encryptedReadKey = "";
        readKeyList.forEach((entry) => {
            if (this.identity.id === entry.id)
                encryptedReadKey = entry.encryptedReadKey;
        });
        if (!encryptedReadKey)
            throw new Error(`you don't have read permission`);
        const sk: keys.supportedKeys.secp256k1.Secp256k1PrivateKey =
            await this.identity.provider.keystore.getKey("TESTID");
        const readKey = decryptKey(encryptedReadKey, sk);
        const data = await downloadFile(this.ipfs, cid, readKey);
        console.log(data);
        return data;
    }
    async writeFile(
        path: string,
        data: string,
        acl?: { read?: string[]; write?: string[] }
    ) {
        path = pathBrowserify.join("/", path);
        const readKey = nanoid();
        const cid = await uploadFile(this.ipfs, data, readKey);
        const metadata = await getMetadata(
            this.orbitdb,
            this.metadataStore,
            path,
            {
                create: true,
            }
        );
        let readKeyList: { id: string; encryptedReadKey: string }[];
        if (acl?.read !== undefined) {
            readKeyList = Array.from(
                new Set([this.identity.id, ...acl.read])
            ).map((id) => {
                return {
                    id,
                    encryptedReadKey: encryptKey(readKey, id),
                };
            });
        } else {
            const info = metadata.get("")[0];
            if (!info) {
                readKeyList = [
                    {
                        id: this.identity.id,
                        encryptedReadKey: encryptKey(readKey, this.identity.id),
                    },
                ];
            } else {
                readKeyList = JSON.parse(info.stringifiedReadKeys).map(
                    (rk: { id: string; encryptedReadKey: string }) => {
                        return {
                            id: rk.id,
                            encryptedReadKey: encryptKey(readKey, rk.id),
                        };
                    }
                );
            }
        }

        await metadata.put({
            cid,
            stringifiedReadKeys: JSON.stringify(readKeyList),
        });
        console.log("write");
    }

    async rm(path: string) {
        path = pathBrowserify.join("/", path);
        const metadata = await getMetadata(
            this.orbitdb,
            this.metadataStore,
            path
        );
        // this.ipfs.pin.rm(metadata.get("")[0].cid);
        await metadata.drop();
        await this.metadataStore.del(path);
    }

    async readACL(path: string): Promise<{ read: string[]; write: string[] }> {
        path = pathBrowserify.join("/", path);
        const metadata = await getMetadata(
            this.orbitdb,
            this.metadataStore,
            path
        );
        const readKeyList: { id: string; encryptedReadKey: string }[] =
            JSON.parse(metadata.get("")[0].stringifiedReadKeys);
        return {
            read: readKeyList.map((rk) => rk.id),
            write: metadata.access.write,
        };
    }

    async grantRead(path: string, ids: string[]) {
        path = pathBrowserify.join("/", path);
        const metadata = await getMetadata(
            this.orbitdb,
            this.metadataStore,
            path
        );
        const readKeyList: ReadKey[] = JSON.parse(
            metadata.get("")[0].stringifiedReadKeys
        );
        let encryptedReadKey = "";
        readKeyList.forEach((entry) => {
            if (this.identity.id === entry.id)
                encryptedReadKey = entry.encryptedReadKey;
        });
        if (!encryptedReadKey) throw new Error(`you don't have permission`);
        const sk: keys.supportedKeys.secp256k1.Secp256k1PrivateKey =
            await this.identity.provider.keystore.getKey("TESTID");
        const readKey = decryptKey(encryptedReadKey, sk);
        ids.forEach((id) => {
            if (!readKeyList.filter((entry) => entry.id === id)[0]) {
                const encryptedReadKey = encryptKey(readKey, id);
                readKeyList.push({
                    id,
                    encryptedReadKey,
                });
            }
        });
        await metadata.put({
            cid: metadata.get("")[0].cid,
            stringifiedReadKeys: JSON.stringify(readKeyList),
        });
        console.log("grant read");
    }

    async revokeRead(path: string, ids: string[]) {
        path = pathBrowserify.join("/", path);
        const data = await this.readFile(path);
        const acl = await this.readACL(path);
        const read = acl.read.filter((id) => !ids.includes(id));
        await this.writeFile(path, data, { read });
        console.log("revoke read");
    }

    async grantWrite(path: string, ids: string[]) {
        path = pathBrowserify.join("/", path);
        const metadata = await getMetadata(
            this.orbitdb,
            this.metadataStore,
            path
        );
        const info = metadata.get("")[0];
        const acl = await this.readACL(path);
        await this.metadataStore.del(path);
        await metadata.close();
        await metadata.drop();
        const newInfoDB = await getMetadata(
            this.orbitdb,
            this.metadataStore,
            path,
            {
                create: true,
                writeAccess: [...acl.write, ...ids],
            }
        );
        console.log(info);
        await newInfoDB.put(info);
        console.log("grant write");
    }

    async revokeWrite(path: string, ids: string[]) {
        path = pathBrowserify.join("/", path);
        const metadata = await getMetadata(
            this.orbitdb,
            this.metadataStore,
            path
        );
        const info = metadata.get("")[0];
        const acl = await this.readACL(path);
        await metadata.close();
        await metadata.drop();
        const write = acl.write.filter((id) => !ids.includes(id));
        await this.metadataStore.del(path);
        const newInfoDB = await getMetadata(
            this.orbitdb,
            this.metadataStore,
            path,
            {
                create: true,
                writeAccess: write,
            }
        );
        await newInfoDB.put(info);
        console.log("revoke write");
    }
    async test() {}
}
