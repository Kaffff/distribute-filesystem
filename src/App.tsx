import React, { useState, createRef } from "react";
import FS from "./dfs/fs";
const App = () => {
    const [fs, setFs] = useState<FS>();
    const orbitDBaddressRef = createRef<HTMLInputElement>();
    const idRef = createRef<HTMLInputElement>();
    const ReaddirNameRef = createRef<HTMLInputElement>();
    const ReadFileNameRef = createRef<HTMLInputElement>();
    const writeFileNameRef = createRef<HTMLInputElement>();
    const writeFileEntryRef = createRef<HTMLInputElement>();
    const create = async (address: any) => {
        console.log(address);
        setFs(await FS.createFS({ fileTableAddress: address }));
    };
    const readdir = async (path: any) => {
        const res = await fs!.readdir(path);
        console.log(res);
    };
    const write = async (name: any, entry: any) => {
        await fs!.writeFile(name, entry);
    };
    const read = async (path: any) => {
        await fs!.readFile(path);
    };
    const test = async () => {
        await new FS().test();
    };

    const grantRead = async (id: any) => {
        console.log(id);
        await fs!.grantRead("test.txt", [id]);
    };
    const revokeRead = async (id: any) => {
        console.log(id);
        await fs!.revokeRead("test.txt", [id]);
    };
    const grantWrite = async (id: any) => {
        console.log(id);
        await fs!.grantWrite("test.txt", [id]);
    };
    const revokeWrite = async (id: any) => {
        console.log(id);
        await fs!.revokeWrite("test.txt", [id]);
    };

    return (
        <div>
            <input
                type={"text"}
                placeholder="OrbitDB Address"
                ref={orbitDBaddressRef}
            />
            <button
                onClick={async () => {
                    await create(orbitDBaddressRef.current?.value);
                }}
            >
                create
            </button>
            <input
                type={"text"}
                placeholder="readdir path"
                ref={ReaddirNameRef}
            />
            <button
                onClick={async () => {
                    await readdir(ReaddirNameRef.current?.value);
                }}
            >
                readdir
            </button>
            <input
                type={"text"}
                placeholder="fileName"
                ref={writeFileNameRef}
            />
            <input
                type={"text"}
                placeholder="fileEntry"
                ref={writeFileEntryRef}
            />
            <button
                onClick={async () => {
                    await write(
                        writeFileNameRef.current?.value,
                        writeFileEntryRef.current?.value
                    );
                }}
            >
                write
            </button>
            <input type={"text"} placeholder="fileName" ref={ReadFileNameRef} />
            <button
                onClick={async () => {
                    await read(ReadFileNameRef.current?.value);
                }}
            >
                read
            </button>
            <input type={"text"} placeholder="id" ref={idRef} />
            <button
                onClick={async () => {
                    await grantRead(idRef.current?.value);
                }}
            >
                grantRead
            </button>
            <button
                onClick={async () => {
                    await revokeRead(idRef.current?.value);
                }}
            >
                revokeRead
            </button>
            <button
                onClick={async () => {
                    await grantWrite(idRef.current?.value);
                }}
            >
                grantWrite
            </button>
            <button
                onClick={async () => {
                    await revokeWrite(idRef.current?.value);
                }}
            >
                revokeWrite
            </button>
            <button
                onClick={async () => {
                    await test();
                }}
            >
                test
            </button>
        </div>
    );
};

export default App;
