import React, { useState, createRef } from "react";
import FS from "./dfs/fs";
const App = () => {
    const [fs, setFs] = useState<FS>();
    const orbitDBaddressRef = createRef<HTMLInputElement>();
    const idRef = createRef<HTMLInputElement>();
    const create = async (address: any) => {
        console.log(address);
        setFs(await FS.createFS({ fileTableAddress: address }));
    };
    const readdir = async () => {
        const res = await fs!.readdir("");
        console.log(res);
    };
    const write = async () => {
        await fs!.writeFile("test.txt", "hello world");
    };
    const read = async () => {
        await fs!.readFile("test.txt");
    };

    const grantRead = async (id: any) => {
        console.log(id);
        await fs!.grantRead("test.txt", id);
    };
    return (
        <div>
            hello world
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
            <button
                onClick={async () => {
                    await readdir();
                }}
            >
                readdir
            </button>
            <button
                onClick={async () => {
                    await write();
                }}
            >
                write
            </button>
            <button
                onClick={async () => {
                    await read();
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
        </div>
    );
};

export default App;
