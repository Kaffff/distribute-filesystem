declare module "@noble/secp256k1" {
    export declare function getSharedSecret(
        privateA: PrivKey,
        publicB: PubKey,
        isCompressed?: boolean
    ): Uint8Array;
}
