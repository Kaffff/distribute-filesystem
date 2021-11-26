import { IPFSHTTPClient, create } from "ipfs-http-client";
import { OrbitDB, createInstance } from "orbit-db";
import DocumentStore from "orbit-db-docstore";
import { Identity, createIdentity } from "orbit-db-identity-provider";
import { Metadata, PathLike, ID, EncryptedReadKey } from "./types";
import { keys } from "libp2p-crypto";
import { nanoid } from "nanoid";
import { uploadFile, downloadFile, encryptKey, decryptKey } from "./utils";

export default class FS {
    ipfs!: IPFSHTTPClient;
    orbitDB!: OrbitDB;
    identity!: Identity;
    metadataStore!: DocumentStore<Metadata>;
    static async createFS(address?: string, ipfsUrl?: string): Promise<FS> {
        const fs = new FS();
        fs.ipfs = create({
            url: ipfsUrl || "http://127.0.0.1:5001",
        });
        fs.identity = await createIdentity({ id: "TESTID" });
        fs.orbitDB = await createInstance(fs.ipfs, {
            identity: fs.identity,
        });
        const dbName = address || "__metadata__";
        fs.metadataStore = await fs.orbitDB.docstore(dbName, {
            indexBy: "path",
        });
        await fs.metadataStore.load();
        console.log(fs.metadataStore.address.toString());
        return fs;
    }

    async readdir(path: PathLike): Promise<string[]> {
        await this.metadataStore.load();
        return this.metadataStore.get(path).map((f) => {
            console.log(f);
            return f.path;
        });
    }

    async readFile(path: PathLike): Promise<string> {
        //ファイルのメタデータを取得
        await this.metadataStore.load();
        const metadata = this.metadataStore.get(path)[0];
        if (!metadata) throw new Error(`no such file: ${path}`);
        // metadata.readAccess = new Map(Object.entries(metadata.readAccess));
        // console.log(metadata.readAccess);
        // //メタデータからreadKeyを取得
        // const encryptedReadKey = metadata.readAccess.get(this.identity.id);
        // const key: keys.supportedKeys.secp256k1.Secp256k1PrivateKey =
        //     await this.identity.provider.keystore.getKey("TESTID");
        // const readKey = await decryptKey(encryptedReadKey!, key, key.public);
        // //メタデータからCIDを取得 CIDからIPFSコンテンツを取得
        const cidStore = await this.orbitDB.feed<string>(
            metadata.cidStoreAddress
        );
        await cidStore.load();
        const history = cidStore.iterator().collect();
        const head = history.pop();
        if (!head) throw new Error(`no such file in ipfs: ${path}`);
        const cid = head.payload.value;
        const readKey = "nacujalinvauf";
        const data = await downloadFile(this.ipfs!, cid, readKey);
        console.log(data);
        return data;
    }

    //dataはbase64 encode
    async writeFile(
        path: PathLike,
        base64data: string,
        options?: {
            readAccess: string[];
        }
    ): Promise<void> {
        // const readKey = nanoid();
        const readKey = "nacujalinvauf";
        const cid = await uploadFile(this.ipfs!, base64data, readKey);
        // ファイルごとにCIDを管理するStoreを作成
        const cidStore = await this.orbitDB.feed(path);
        await cidStore.add(cid);

        //ファイルの新規作成、更新で場合分け
        await this.metadataStore.load();
        const metadata = this.metadataStore.get(path)[0];
        // if (!metadata) {
        // const privKey: keys.supportedKeys.secp256k1.Secp256k1PrivateKey =
        //     await this.identity.provider.keystore.getKey("TESTID");
        // const encryptedReadKey = await encryptKey(
        //     readKey,
        //     privKey,
        //     privKey.public
        // );
        // const readAccess = new Map<ID, EncryptedReadKey>();
        // readAccess.set(this.identity.id, encryptedReadKey);
        // if (options?.readAccess) {
        //     for (const id of Array.from(readAccess.keys())) {
        //         const publicKey =
        //             new keys.supportedKeys.secp256k1.Secp256k1PublicKey(
        //                 Buffer.from(id, "hex")
        //             );
        //         const encryptedReadKey = await encryptKey(
        //             readKey,
        //             privKey,
        //             publicKey
        //         );
        //         readAccess.set(id, encryptedReadKey);
        //     }
        // }
        await this.metadataStore.put({
            path: path,
            cidStoreAddress: cidStore.address.toString(),
            // readAccess: readAccess,
            // writeAccess: [this.identity.id],
        });
        // } else {
        //     const privKey: keys.supportedKeys.secp256k1.Secp256k1PrivateKey =
        //         await this.identity.provider.keystore.getKey("TESTID");
        //     metadata.readAccess = new Map(Object.entries(metadata.readAccess));
        //     console.log(metadata.readAccess);
        //     for (const id of Array.from(metadata.readAccess.keys())) {
        //         const publicKey =
        //             new keys.supportedKeys.secp256k1.Secp256k1PublicKey(
        //                 Buffer.from(id, "hex")
        //             );
        //         const encryptedReadKey = await encryptKey(
        //             readKey,
        //             privKey,
        //             publicKey
        //         );
        //         metadata.readAccess.set(id, encryptedReadKey);
        //     }
        //     await this.metadataStore.put(metadata);
        // }
        console.log("write");
    }

    async rm(path: string): Promise<void> {
        await this.metadataStore.del(path);
    }
    //     async grantRead(path: PathLike, ids: string[]) {
    //         //ファイルの読み取り鍵を取得
    //         await this.metadataStore.load();
    //         const metadata = this.metadataStore.get(path)[0];
    //         if (!metadata) throw new Error(`no such file: ${path}`);
    //         const selfEncryptedReadKey = metadata.readAccess.get(this.identity.id);
    //         const key: keys.supportedKeys.secp256k1.Secp256k1PrivateKey =
    //             await this.identity.provider.keystore.getKey("TESTID");
    //         const readKey = await decryptKey(
    //             selfEncryptedReadKey!,
    //             key,
    //             key.public
    //         );
    //         //読み取り鍵を公開鍵で暗号化して保存
    //         for (const id of ids) {
    //             const publicKey =
    //                 new keys.supportedKeys.secp256k1.Secp256k1PublicKey(
    //                     Buffer.from(id, "hex")
    //                 );
    //             const encryptedReadKey = await encryptKey(readKey, key, publicKey);
    //             metadata.readAccess.set(id, encryptedReadKey);
    //             await this.metadataStore.put(metadata);
    //         }
    //     }
    //     async revokeRead(path: PathLike, ids: string[]) {
    //         await this.metadataStore.load();
    //         const metadata = this.metadataStore.get(path)[0];
    //         if (!metadata) throw new Error(`no such file: ${path}`);
    //         const data = await this.readFile(path);
    //         ids.forEach((id) => metadata.readAccess.delete(id));
    //         await this.writeFile(path, data, {
    //             readAccess: Array.from(metadata.readAccess.keys()),
    //         });
    //         await this.metadataStore.put(metadata);
    //     }
}
