export type MetadataStore = {
    path: string;
    metadataAddress: string;
};

export type Metadata = {
    cid: string;
    stringifiedReadKeys: string;
};

export type ReadKey = {
    id: string;
    encryptedReadKey: string;
};

export type CreateOptions = {
    metadataStoreAddress?: string;
    identityId?: string;
    ipfsUrl?: string;
};

export type ACL = {
    read: string[];
    write: string[];
};
