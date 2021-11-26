export type FileTable = {
    path: string;
    infoAddress: string;
    permissionAddress: string;
};

export type FileInfo = {
    cid: string;
    ownerID: string;
};

export type FilePermission = {
    id: string;
    encryptedReadKey: string;
    canWrite: boolean;
};

export type CreateOptions = {
    fileTableAddress?: string;
    identityId?: string;
    ipfsUrl?: string;
};
