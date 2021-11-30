import { IPFSHTTPClient } from "ipfs-http-client";
import { AES, enc } from "crypto-js";
import { keys } from "libp2p-crypto";
import { encrypt, decrypt } from "eciesjs";
import OrbitDB from "orbit-db";
import { FileInfo, FilePermission, FileTable, Id, Mode, Role } from "./types";
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

export async function getFileMetadataDB(
    orbitdb: OrbitDB,
    fileTable: DocumentStore<FileTable>,
    path: string,
    options: {
        create: boolean;
        writeAccess: string[];
    } = { create: false, writeAccess: [] }
) {
    await fileTable.load();
    const file = fileTable.query((f) => path === f.path)[0];
    if (file) {
        const infoDB = await orbitdb.docstore<FileInfo>(file.infoAddress, {
            indexBy: "cid",
            accessController: {
                type: "orbitdb",
            },
        });
        await infoDB.load();
        const permissionDB = await orbitdb.docstore<FilePermission>(
            file.permissionAddress,
            {
                indexBy: "id",
                accessController: {
                    type: "orbitdb",
                },
            }
        );
        await permissionDB.load();
        return { infoDB, permissionDB };
    } else {
        if (!options.create) throw new Error(`no such file: ${path}`);
        const infoDB = await orbitdb.docstore<FileInfo>(
            pathBrowserify.join("__INFO__", path),
            {
                indexBy: "cid",
                accessController: {
                    type: "orbitdb",
                    write: [fileTable.identity.id, ...options.writeAccess],
                },
            }
        );
        await infoDB.load();
        const permissionDB = await orbitdb.docstore<FilePermission>(
            pathBrowserify.join("__PERMISSION__", path),
            {
                indexBy: "id",
                accessController: {
                    type: "orbitdb",
                    write: [fileTable.identity.id, ...options.writeAccess],
                },
            }
        );
        await permissionDB.load();
        await fileTable.put({
            path,
            infoAddress: infoDB.address.toString(),
            permissionAddress: permissionDB.address.toString(),
        });
        return { infoDB, permissionDB };
    }
}

export async function uploadFilePermission(
    permissionDB: DocumentStore<FilePermission>,
    readKey: string,
    permission?: Role[]
) {
    await permissionDB.load();
    let entries: FilePermission[] = [];
    if (!permission) {
        entries = permissionDB.get("");
    } else {
        entries = permission.map(({ id, mode }) => {
            const canWrite = mode === "w";
            return {
                id,
                encryptedReadKey: "",
                canWrite,
            };
        });
    }
    //自分のid
    entries.push({
        id: permissionDB.identity.id,
        encryptedReadKey: "",
        canWrite: true,
    });
    entries.forEach(async (entry) => {
        const encryptedReadKey = await encryptKey(readKey, entry.id);
        await permissionDB.put({
            id: entry.id,
            encryptedReadKey,
            canWrite: entry.canWrite,
        });
    });
}
export async function uploadFileInfo(
    infoDB: DocumentStore<FileInfo>,
    cid: string
) {
    await infoDB.load();
    await infoDB.put({ cid });
}

export async function getReadKey(
    permissionDB: DocumentStore<FilePermission>,
    sk: keys.supportedKeys.secp256k1.Secp256k1PrivateKey
) {
    const encryptedReadKey = permissionDB.get(permissionDB.identity.id)[0]
        ?.encryptedReadKey;
    if (!encryptedReadKey) throw new Error(`you don't have read permission`);
    return await decryptKey(encryptedReadKey, sk);
}

export function encryptKey(key: string, id: string) {
    console.log(key);
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
