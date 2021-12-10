import { OrbitDB } from "orbit-db";
import DocumentStore from "orbit-db-docstore";

type FileInfoStoreEntry = {
    path: string;
    address: string;
};

export default class FileInfoStore {
    orbitdb: OrbitDB;
    address: string;
    store!: DocumentStore<FileInfoStoreEntry>;

    constructor(orbitdb: OrbitDB, address: string) {
        this.orbitdb = orbitdb;
        this.address = address;
    }

    get id(): string {
        return this.store.identity.id;
    }

    static async createInstance(orbitdb: OrbitDB, address?: string) {
        if (!address) address = "__FILEINFOSTORE__";
        const newInstance = new FileInfoStore(orbitdb, address);
        newInstance.store = await newInstance.orbitdb.docstore(address, {
            indexBy: "path",
        });
        await newInstance.store.load();
        return newInstance;
    }

    async setAddress(path: string, fileInfoAddress: string) {
        await this.store.load();
        await this.store.put({ path, address: fileInfoAddress });
    }

    async getAddress(path: string) {
        await this.store.load();
        const entry = this.store.query((f) => path === f.path)[0];
        if (!entry) throw new Error(`File is not found: ${path}`);
        return entry.address;
    }

    async listPath() {
        await this.store.load();
        return this.store.get("").map((f) => f.path);
    }

    async delete(path: string) {
        await this.store.load();
        const entry = this.store.query((f) => path === f.path)[0];
        if (!entry) throw new Error(`File is not found: ${path}`);
        await this.store.del(path);
    }
}
