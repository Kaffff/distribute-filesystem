import { IPFSHTTPClient } from "ipfs-http-client";
import { ImportCandidate } from "ipfs-core-types/src/utils";
import { OrbitDB } from "orbit-db";
import DocumentStore from "orbit-db-docstore";
import { Identity } from "orbit-db-identity-provider";

export type PathLike = string;
export type ID = string;
export type EncryptedReadKey = string;

export type Metadata = {
    path: PathLike;
    cidStoreAddress: string;
    // readAccess: Map<ID, EncryptedReadKey>;
    // writeAccess: ID[];
};
