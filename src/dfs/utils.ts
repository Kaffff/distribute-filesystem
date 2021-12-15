import { IPFSHTTPClient } from "ipfs-http-client";
import { AES, enc } from "crypto-js";
import { keys } from "libp2p-crypto";
import { encrypt, decrypt } from "eciesjs";
import OrbitDB from "orbit-db";
import { EncryptedReadKey, Metadata, MetadataStore } from "./types";
import DocumentStore from "orbit-db-docstore";
import pathBrowserify from "path-browserify";

export async function uploadFile(
    ipfs: IPFSHTTPClient,
    base64data: string,
    readKey: string
) {
    const encryptedData = AES.encrypt(base64data, readKey);
    const addResult = await ipfs.add(encryptedData.toString());
    return addResult.cid.toString();
}

export async function downloadFile(
    ipfs: IPFSHTTPClient,
    cid: string,
    readKey: string
) {
    const decoder = new TextDecoder();
    let encryptedData = "";
    for await (const chunk of ipfs.cat(cid)) {
        encryptedData += decoder.decode(chunk);
    }
    const data = AES.decrypt(encryptedData, readKey);
    return enc.Utf8.stringify(data);
}

export async function getMetadata(
    orbitdb: OrbitDB,
    metadataStore: DocumentStore<MetadataStore>,
    path: string,
    options: { create: boolean; writeAccess?: string[] } = { create: false }
) {
    path = pathBrowserify.join("/", path);
    await metadataStore.load();
    const file = metadataStore.query((f) => path === f.path)[0];
    let metadata;
    if (file) {
        metadata = await orbitdb.docstore<Metadata>(file.metadataAddress, {
            indexBy: "cid",
        });
    } else {
        if (!options.create) throw new Error(`no such file: ${path}`);
        if (!options.writeAccess) options.writeAccess = [];
        metadata = await orbitdb.docstore<Metadata>(
            pathBrowserify.join("__METADATA__", path),
            {
                indexBy: "cid",
                accessController: {
                    write: Array.from(
                        new Set([
                            metadataStore.identity.id,
                            ...options.writeAccess,
                        ])
                    ),
                },
            }
        );
        await metadataStore.put({
            path,
            metadataAddress: metadata.address.toString(),
        });
    }
    await metadata.load();
    return metadata;
}

export function encryptKey(key: string, id: string) {
    return encrypt(id, Buffer.from(key)).toString("base64");
}

export function decryptKey(
    encryptedKey: string,
    sk: keys.supportedKeys.secp256k1.Secp256k1PrivateKey
) {
    return decrypt(
        Buffer.from(sk.marshal()),
        Buffer.from(encryptedKey, "base64")
    ).toString();
}

export function mergeArray(ary1: any[], ary2: any[]) {
    return Array.from(new Set([...ary1, ...ary2]));
}
export function deepMergeArray(
    ary1: EncryptedReadKey[],
    ary2: EncryptedReadKey[]
) {
    return [...ary1, ...ary2].filter(
        (element, index, self) =>
            self.findIndex((e) => e.id === element.id) === index
    );
}
