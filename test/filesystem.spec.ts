import FS from "../src/distributed-filesystem/fs";

test("create", async () => {
    const fs = await FS.createFS();
    await fs.writeFile("test.txt", "hello world");
    await fs.writeFile("testdir/test.txt", "hello world!");
    await fs.writeFile("testdir/testdir/test.txt", "hello world!!");
    expect(fs.readdir("")).toEqual([
        "test.txt",
        "testdir/test.txt",
        "testdir/testdir/test.txt",
    ]);
    expect(fs.readdir("testdir")).toEqual([
        "testdir/test.txt",
        "testdir/testdir/test.txt",
    ]);
});
