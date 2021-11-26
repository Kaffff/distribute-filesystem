import { IPFSHTTPClient } from "ipfs-http-client";
import { AES, enc } from "crypto-js";
import { keys } from "libp2p-crypto";
import * as secp from "@noble/secp256k1";

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

export async function encryptKey(
    key: string,
    priv: keys.supportedKeys.secp256k1.Secp256k1PrivateKey,
    pubId: string
) {
    const decoder = new TextDecoder();
    const pub = new keys.supportedKeys.secp256k1.Secp256k1PublicKey(
        Buffer.from(pubId, "hex")
    );
    const secret = secp.getSharedSecret(priv.marshal(), pub.marshal(), false);
    const encryptedKey = AES.encrypt(key, decoder.decode(secret));
    return encryptedKey.toString();
}

export async function decryptKey(
    encryptedKey: string,
    priv: keys.supportedKeys.secp256k1.Secp256k1PrivateKey,
    pubId: string
) {
    const pub = new keys.supportedKeys.secp256k1.Secp256k1PublicKey(
        Buffer.from(pubId, "hex")
    );
    const decoder = new TextDecoder();
    const secret = secp.getSharedSecret(priv.marshal(), pub.marshal(), false);
    const key = AES.decrypt(encryptedKey, decoder.decode(secret));
    return enc.Utf8.stringify(key);
}
