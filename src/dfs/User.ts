import { IPFSHTTPClient, create } from "ipfs-http-client";
import { OrbitDB, createInstance } from "orbit-db";
import { Identity, createIdentity } from "orbit-db-identity-provider";
import pathBrowserify from "path-browserify";
import FileSystem from "./FileSystem";
import { UserId } from "./types";

export default class User {
    identity!: Identity;
    orbitdb!: OrbitDB;
    ipfs!: IPFSHTTPClient;
    fs!: FileSystem;
    static async createUser(
        options = {
            metadataStoreAddress: "",
            id: "",
            ipfsUrl: "",
        }
    ) {
        const user = new User();
        user.identity = await createIdentity({ id: options.id || "TESTID" });
        user.ipfs = create({ url: options.ipfsUrl || "http://127.0.0.1:5001" });
        user.orbitdb = await createInstance(user.ipfs, {
            identity: user.identity,
        });
        user.fs = await FileSystem.createFS(
            user.orbitdb,
            options.metadataStoreAddress || "__METADATASTORE__"
        );
        console.log(user.identity.id);
        console.log(user.fs.metadataStore.address);
        return user;
    }

    async createFs(address: string) {
        return await FileSystem.createFS(this.orbitdb, address);
    }

    async readdir(path: string, fs?: FileSystem) {
        fs = fs || this.fs;
        path = pathBrowserify.join("/", path);
        return await fs.readdir(path);
    }

    async writeFile(path: string, data: string, fs?: FileSystem) {
        fs = fs || this.fs;
        path = pathBrowserify.join("/", path);
        await fs.writeFile(this.orbitdb, this.ipfs, path, data);
    }

    async readFile(path: string, fs?: FileSystem) {
        fs = fs || this.fs;
        path = pathBrowserify.join("/", path);
        return await fs.readFile(this.orbitdb, this.ipfs, path);
    }

    async rm(path: string, fs?: FileSystem) {
        fs = fs || this.fs;
        path = pathBrowserify.join("/", path);
        await fs.rm(this.orbitdb, this.ipfs, path);
    }

    async readACL(path: string, fs?: FileSystem) {
        fs = fs || this.fs;
        path = pathBrowserify.join("/", path);
        return await fs.readACL(this.orbitdb, path);
    }

    async grantRead(path: string, ids: UserId[], fs?: FileSystem) {
        fs = fs || this.fs;
        path = pathBrowserify.join("/", path);
        await fs.grantRead(this.orbitdb, path, ids);
    }

    async revokeRead(path: string, ids: UserId[], fs?: FileSystem) {
        fs = fs || this.fs;
        path = pathBrowserify.join("/", path);
        await fs.revokeRead(this.orbitdb, this.ipfs, path, ids);
    }

    async grantWrite(path: string, ids: UserId[], fs?: FileSystem) {
        fs = fs || this.fs;
        path = pathBrowserify.join("/", path);
        await fs.grantWrite(this.orbitdb, path, ids);
    }

    async revokeWrite(path: string, ids: UserId[], fs?: FileSystem) {
        fs = fs || this.fs;
        path = pathBrowserify.join("/", path);
        await fs.revokeWrite(this.orbitdb, path, ids);
    }
}
