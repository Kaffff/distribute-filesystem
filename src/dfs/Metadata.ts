import OrbitDB from "orbit-db";
import DocumentStore from "orbit-db-docstore";
import { EncryptedReadKey, MetadataEntry, UserId } from "./types";
import { deepMergeArray, encryptKey, mergeArray } from "./utils";
import pathBrowserify from "path-browserify";

export default class Metadata {
    store!: DocumentStore<MetadataEntry>;

    static async createInstance(
        orbitdb: OrbitDB,
        path: string,
        writeIds?: UserId[]
    ) {
        return await this._newInstance(
            orbitdb,
            pathBrowserify.join("__METADATA__", path),
            writeIds
        );
    }

    static async getInstance(orbitdb: OrbitDB, dbAddress: string) {
        return await this._newInstance(orbitdb, dbAddress);
    }

    static async _newInstance(
        orbitdb: OrbitDB,
        dbAddress: string,
        writeIds?: UserId[]
    ) {
        const metadata = new Metadata();
        if (writeIds) {
            metadata.store = await orbitdb.docstore<MetadataEntry>(dbAddress, {
                indexBy: "cid",
                accessController: {
                    write: Array.from(new Set(writeIds)),
                },
            });
        } else {
            metadata.store = await orbitdb.docstore<MetadataEntry>(dbAddress, {
                indexBy: "cid",
            });
        }
        await metadata.store.load();
        return metadata;
    }

    get address() {
        return this.store.address.toString();
    }

    async put(cid: string, encryptedReadKeys: EncryptedReadKey[]) {
        await this.store.put({
            cid: cid,
            encryptedReadKeys: JSON.stringify(encryptedReadKeys),
        });
        await this.store.load();
    }

    async putByIds(cid: string, readKey: string, readIds: string[]) {
        const encryptedReadKeys: EncryptedReadKey[] = readIds.map((id) => {
            return {
                id,
                encryptedReadKey: encryptKey(readKey, id),
            };
        });
        await this.put(cid, encryptedReadKeys);
    }

    async addReaderIds(readKey: string, ids: string[]) {
        const { cid, encryptedReadKeys } = await this.get();
        const additionalReader: EncryptedReadKey[] = ids.map((id) => {
            return {
                id,
                encryptedReadKey: encryptKey(readKey, id),
            };
        });
        await this.put(
            cid,
            deepMergeArray(encryptedReadKeys, additionalReader)
        );
    }

    async get() {
        await this.store.load();
        let entry = this.store.get("")[0];
        if (!entry) throw new Error("no entry in metadata");
        const encryptedReadKeys: EncryptedReadKey[] = JSON.parse(
            entry.encryptedReadKeys
        );
        return { cid: entry.cid, encryptedReadKeys: encryptedReadKeys };
    }

    async getCID() {
        await this.store.load();
        const entry = this.store.get("")[0];
        return entry.cid;
    }

    async getById(
        id: UserId
    ): Promise<{ cid: string; encryptedReadKey: string }> {
        const { cid, encryptedReadKeys } = await this.get();
        let encryptedReadKey = "";
        encryptedReadKeys.forEach((rk) => {
            if (rk.id === id) encryptedReadKey = rk.encryptedReadKey;
        });
        if (!encryptedReadKey)
            throw new Error("you don't have read permission");
        return { cid, encryptedReadKey };
    }

    async getReaderIds() {
        await this.store.load();
        const entry = this.store.get("")[0];
        if (!entry) return [];
        const encryptedReadKeys: EncryptedReadKey[] = JSON.parse(
            entry.encryptedReadKeys
        );
        return encryptedReadKeys.map((rk) => rk.id);
    }

    async getWriterIds() {
        await this.store.load();
        return this.store.access.write;
    }

    async drop() {
        await this.store.close();
        await this.store.drop();
    }
}
