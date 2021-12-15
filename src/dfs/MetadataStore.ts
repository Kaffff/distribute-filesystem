import OrbitDB from "orbit-db";
import DocumentStore from "orbit-db-docstore";
import pathBrowserify from "path-browserify";
import { MetadataStoreEntry, UserId } from "./types";
import Metadata from "./Metadata";

export default class MetadataStore {
    store!: DocumentStore<MetadataStoreEntry>;
    static async createInstance(orbitdb: OrbitDB) {
        return await this._newInstance(orbitdb, "__METADATASTORE__");
    }
    static async getInstance(orbitdb: OrbitDB, dbAddress: string) {
        return await this._newInstance(orbitdb, dbAddress);
    }
    static async _newInstance(orbitdb: OrbitDB, dbAddress: string) {
        const metadataStore = new MetadataStore();
        metadataStore.store = await orbitdb.docstore<MetadataStoreEntry>(
            dbAddress,
            {
                indexBy: "path",
            }
        );
        await metadataStore.store.load();
        return metadataStore;
    }

    get address() {
        return this.store.address.toString();
    }

    get id() {
        return this.store.identity.id;
    }

    async getMetadata(orbitdb: OrbitDB, path: string) {
        await this.store.load();
        const entry = this.store.query((f) => path === f.path)[0];
        if (!entry) throw new Error(`no such file: ${path}`);
        return await Metadata.getInstance(orbitdb, entry.metadataAddress);
    }

    async createMetadata(orbitdb: OrbitDB, path: string, writeIds?: UserId[]) {
        const metadata = await Metadata.createInstance(orbitdb, path, writeIds);
        await this.store.load();
        await this.store.put({
            path,
            metadataAddress: metadata.address,
        });
        await this.store.load();
        return metadata;
    }

    async getOrCreateMetadata(
        orbitdb: OrbitDB,
        path: string,
        writeIds?: UserId[]
    ) {
        await this.store.load();
        const entry = this.store.query((f) => path === f.path)[0];
        let metadata;
        if (entry) {
            metadata = await Metadata.getInstance(
                orbitdb,
                entry.metadataAddress
            );
        } else {
            metadata = await Metadata.createInstance(orbitdb, path, writeIds);
            await this.store.put({
                path,
                metadataAddress: metadata.address,
            });
            await this.store.load();
        }
        console.log(metadata);
        return metadata;
    }

    async deletePath(path: string) {
        await this.store.load();
        await this.store.del(path);
    }

    async put(path: string, metadataAddress: string) {
        await this.store.load();
        await this.store.put({
            path,
            metadataAddress,
        });
        await this.store.load();
    }

    async readdir(path: string) {
        await this.store.load();
        const paths = this.store.get("");
        const re = new RegExp(`^${pathBrowserify.join("/", path, "/")}[^/]+`);
        const result = new Set<string>();
        paths.forEach((p) => {
            const match = re.exec(p.path);
            if (match)
                result.add(
                    match[0].replace(pathBrowserify.join("/", path, "/"), "")
                );
        });
        return Array.from(result);
    }

    async removeMetadata(orbitdb: OrbitDB, path: string) {
        await this.store.load();
        const metadata = await this.getOrCreateMetadata(orbitdb, path);
        await this.store.del(path);
        await metadata.store.close();
        await metadata.store.drop();
        console.log("remove metadata");
    }
}
