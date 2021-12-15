import { IPFSHTTPClient } from "ipfs-http-client";
import { keys } from "libp2p-crypto";
import { nanoid } from "nanoid";
import OrbitDB from "orbit-db";
import MetadataStore from "./MetadataStore";
import { decryptKey, downloadFile, mergeArray, uploadFile } from "./utils";

export default class FileSystem {
    metadataStore!: MetadataStore;

    static async createFS(orbitdb: OrbitDB, address?: string) {
        const fs = new FileSystem();
        if (address) {
            fs.metadataStore = await MetadataStore.getInstance(
                orbitdb,
                address
            );
        } else {
            fs.metadataStore = await MetadataStore.createInstance(orbitdb);
        }
        return fs;
    }

    get address() {
        return this.metadataStore.address;
    }

    async readdir(path: string) {
        return await this.metadataStore.readdir(path);
    }

    async writeFile(
        orbitdb: OrbitDB,
        ipfs: IPFSHTTPClient,
        path: string,
        data: string,
        readKey: string = nanoid()
    ) {
        const metadata = await this.metadataStore.getOrCreateMetadata(
            orbitdb,
            path
        );
        const cid = await uploadFile(ipfs, data, readKey);
        await metadata.putByIds(
            cid,
            readKey,
            mergeArray([this.metadataStore.id], await metadata.getReaderIds())
        );
        await this.metadataStore;
    }

    async readFile(orbitdb: OrbitDB, ipfs: IPFSHTTPClient, path: string) {
        const metadata = await this.metadataStore.getMetadata(orbitdb, path);
        const { cid, encryptedReadKey } = await metadata.getById(
            this.metadataStore.id
        );
        const sk: keys.supportedKeys.secp256k1.Secp256k1PrivateKey =
            await this.metadataStore.store.identity.provider.keystore.getKey(
                "TESTID"
            );
        const readKey = decryptKey(encryptedReadKey, sk);
        const data = await downloadFile(ipfs, cid, readKey);
        console.log(data);
        return data;
    }

    async rm(orbitdb: OrbitDB, ipfs: IPFSHTTPClient, path: string) {
        const metadata = await this.metadataStore.getMetadata(orbitdb, path);
        const cid = await metadata.getCID();
        await ipfs.pin.rm(cid);
        await ipfs.repo.gc();
        await this.metadataStore.removeMetadata(orbitdb, path);
    }

    async readACL(orbitdb: OrbitDB, path: string) {
        const metadata = await this.metadataStore.getMetadata(orbitdb, path);
        return {
            read: await metadata.getReaderIds(),
            write: await metadata.getWriterIds(),
        };
    }

    async grantRead(orbitdb: OrbitDB, path: string, ids: string[]) {
        const metadata = await this.metadataStore.getMetadata(orbitdb, path);
        const { cid, encryptedReadKey } = await metadata.getById(
            this.metadataStore.id
        );
        const sk: keys.supportedKeys.secp256k1.Secp256k1PrivateKey =
            await this.metadataStore.store.identity.provider.keystore.getKey(
                "TESTID"
            );
        const readKey = decryptKey(encryptedReadKey, sk);
        await metadata.addReaderIds(readKey, ids);
        console.log("grant read");
    }

    async revokeRead(
        orbitdb: OrbitDB,
        ipfs: IPFSHTTPClient,
        path: string,
        ids: string[],
        readKey: string = nanoid()
    ) {
        const metadata = await this.metadataStore.getMetadata(orbitdb, path);
        const data = await this.readFile(orbitdb, ipfs, path);
        const readIds = (await metadata.getReaderIds()).filter(
            (id) => !ids.includes(id)
        );
        const cid = await uploadFile(ipfs, data, readKey);
        await metadata.putByIds(cid, readKey, readIds);
        console.log("revoke read");
    }

    async grantWrite(orbitdb: OrbitDB, path: string, ids: string[]) {
        const metadata = await this.metadataStore.getMetadata(orbitdb, path);
        await metadata.store.load();
        const entry = await metadata.store.get("")[0];
        const writeIds = await metadata.getWriterIds();
        await metadata.drop();
        const newMetadata = await this.metadataStore.createMetadata(
            orbitdb,
            path,
            mergeArray(writeIds, ids)
        );
        await newMetadata.store.put(entry);
        await console.log(newMetadata.store);
        console.log("grant write");
    }

    async revokeWrite(orbitdb: OrbitDB, path: string, ids: string[]) {
        const metadata = await this.metadataStore.getMetadata(orbitdb, path);
        await metadata.store.load();
        const entry = await metadata.store.get("")[0];
        const writeIds = await metadata.getWriterIds();
        const newWriteIds = writeIds.filter((id) => !ids.includes(id));
        await metadata.drop();
        const newMetadata = await this.metadataStore.createMetadata(
            orbitdb,
            path,
            newWriteIds
        );
        await newMetadata.store.put(entry);
        console.log("revoke write");
    }
}
