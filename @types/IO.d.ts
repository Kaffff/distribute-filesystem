declare module "orbit-db-access-controllers/src/utils/io" {
    import { IPFSHTTPClient } from "ipfs-http-client";
    import io from "orbit-db-io";
    export async function read(ipfs: IPFSHTTPClient, cid, options = {});
    export async function write(
        ipfs: IPFSHTTPClient,
        format,
        value,
        options = {}
    );
}
