export type FileTable = {
    path: string;
    infoAddress: string;
    permissionAddress: string;
};

export type FileInfo = {
    cid: string;
};

export type FilePermission = {
    id: Id;
    encryptedReadKey: string;
    canWrite: boolean;
};

export type CreateOptions = {
    fileTableAddress?: string;
    identityId?: string;
    ipfsUrl?: string;
};

export type Role = {
    id: Id;
    mode: Mode;
};

export type Id = string;
export type Mode = "w" | "r";
