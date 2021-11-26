import { secp256k1 } from "libp2p-crypto";
declare module "orbit-db-keystore" {
    export class Keystore {
        constructor(
            input?: string | { open?: Function; store?: string; cache?: any }
        );

        hasKey(id: string): Promise<boolean>;
        createKey(
            id: string
        ): Promise<{ publicKey: string; privateKey: string }>;
        getKey(id: string): Promise<secp256k1.Secp256k1PrivateKey>;

        sign(key: any, data: any): Promise<string>;
        getPublic(
            keys: any,
            options?: {
                decompress?: boolean;
                format: string;
                [key: string]: any;
            }
        ): string;

        open(): Promise<void>;
        close(): Promise<void>;

        verify(
            signature: string,
            publicKey: string,
            data: string,
            v?: string
        ): Promise<boolean>;
        static verify(
            signature: string,
            publicKey: string,
            data: string,
            v?: string
        ): Promise<boolean>;
    }
}
