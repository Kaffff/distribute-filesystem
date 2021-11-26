import { IPFSHTTPClient, create } from "ipfs-http-client";
import { OrbitDB, createInstance } from "orbit-db";
import DocumentStore from "orbit-db-docstore";
import { Identity, createIdentity } from "orbit-db-identity-provider";
import { keys } from "libp2p-crypto";
import { nanoid } from "nanoid";
import { FileTable, FilePermission, FileInfo, CreateOptions } from "./types";
import pathBrowserify from "path-browserify";
import { uploadFile, downloadFile, encryptKey, decryptKey } from "./utils";

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
            { indexBy: "path" }
        );
        await fs.fileTable.load();
        console.log(fs.identity.id);
        console.log(fs.fileTable.address.toString());
        return fs;
    }

    //TODO: 入力引数pathを実装
    async readdir(path: string) {
        await this.fileTable.load();
        return this.fileTable.get(path).map((p) => p.path);
    }
    async readFile(path: string) {
        // FileTableからpermissionDBを取得
        await this.fileTable.load();
        const file = this.fileTable.query((f) => path === f.path)[0];
        if (!file) throw new Error(`no such file: ${path}`);
        const permissionDB = await this.orbitdb.docstore<FilePermission>(
            file.permissionAddress,
            { indexBy: "id" }
        );
        await permissionDB.load();
        // permissionDBからencryptReadKeyを取得
        const encryptedReadKey = permissionDB.get(this.identity.id)[0]
            ?.encryptedReadKey;
        if (!encryptedReadKey)
            throw new Error(`you don't have read permission: ${path}`);
        // permissionDBのidとthis.identityのprivate keyからreadKeyを復号
        const privKey: keys.supportedKeys.secp256k1.Secp256k1PrivateKey =
            await this.identity.provider.keystore.getKey("TESTID");
        // FileTableからinfoDBを取得し、cidを取得
        const infoDB = await this.orbitdb.docstore<FileInfo>(file.infoAddress, {
            indexBy: "cid",
        });
        await infoDB.load();
        const readKey = await decryptKey(
            encryptedReadKey,
            privKey,
            infoDB.get("")[0].ownerID
        );
        const cid = infoDB.get("")[0].cid;
        //cidとreadKeyからdataを取得
        const data = await downloadFile(this.ipfs, cid, readKey);
        console.log(data);
    }
    async writeFile(path: string, data: string) {
        //ファイルが存在するか否か
        await this.fileTable.load();
        const file = this.fileTable.query((f) => path === f.path)[0];
        //新しくReadKeyを作成し暗号化したファイルをipfsにアップロード
        const readKey = nanoid();
        const cid = await uploadFile(this.ipfs, data, readKey);
        //encryptedReadKeyを公開鍵で暗号化してputする
        if (file) {
            const infoDB = await this.orbitdb.docstore<FileInfo>(
                file.infoAddress,
                { indexBy: "cid" }
            );
            await infoDB.load();
            await infoDB.put({ cid, ownerID: this.identity.id });
            const permissionDB = await this.orbitdb.docstore<FilePermission>(
                file.permissionAddress,
                { indexBy: "id" }
            );
            await permissionDB.load();
            permissionDB.get("").forEach(async (p) => {
                const privKey: keys.supportedKeys.secp256k1.Secp256k1PrivateKey =
                    await this.identity.provider.keystore.getKey("TESTID");
                const encryptedReadKey = await encryptKey(
                    readKey,
                    privKey,
                    p.id
                );
                await permissionDB.put({
                    id: p.id,
                    encryptedReadKey,
                    canWrite: p.canWrite,
                });
            });
        } else {
            const infoDB = await this.orbitdb.docstore<FileInfo>(
                pathBrowserify.join("__INFO__", path),
                { indexBy: "cid" }
            );
            await infoDB.load();
            await infoDB.put({ cid, ownerID: this.identity.id });
            const permissionDB = await this.orbitdb.docstore<FilePermission>(
                pathBrowserify.join("__PERMISSION__", path),
                { indexBy: "id" }
            );
            await permissionDB.load();
            const privKey: keys.supportedKeys.secp256k1.Secp256k1PrivateKey =
                await this.identity.provider.keystore.getKey("TESTID");
            const encryptedReadKey = await encryptKey(
                readKey,
                privKey,
                this.identity.id
            );
            await permissionDB.put({
                id: this.identity.id,
                encryptedReadKey,
                canWrite: true,
            });
            await this.fileTable.put({
                path,
                infoAddress: infoDB.address.toString(),
                permissionAddress: permissionDB.address.toString(),
            });
        }
        console.log("write");
    }
    async grantRead(path: string, id: string[]) {
        // FileTableからpermissionDBを取得
        await this.fileTable.load();
        const file = this.fileTable.query((f) => path === f.path)[0];
        if (!file) throw new Error(`no such file: ${path}`);
        const permissionDB = await this.orbitdb.docstore<FilePermission>(
            file.permissionAddress,
            { indexBy: "id" }
        );
        await permissionDB.load();
        // permissionDBからencryptReadKeyを取得
        const selfEncryptedReadKey = permissionDB.get(this.identity.id)[0]
            ?.encryptedReadKey;
        if (!selfEncryptedReadKey)
            throw new Error(`you don't have read permission: ${path}`);
        // permissionDBのidとthis.identityのprivate keyからreadKeyを復号
        const privKey: keys.supportedKeys.secp256k1.Secp256k1PrivateKey =
            await this.identity.provider.keystore.getKey("TESTID");
        const readKey = await decryptKey(
            selfEncryptedReadKey,
            privKey,
            permissionDB.identity.id
        );
        id.forEach(async (_id) => {
            const encryptedReadKey = await encryptKey(readKey, privKey, _id);
            await permissionDB.put({
                id: _id,
                encryptedReadKey,
                canWrite: false,
            });
        });
        console.log("grant read");
    }
}
