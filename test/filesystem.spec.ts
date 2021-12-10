import FS from "../src/dfs/fs";

test("create", async () => {
    const fs = await FS.createFS();
    await fs.writeFile("test.txt", "hello world");
    await fs.writeFile("testdir/test.txt", "hello world!");
    await fs.writeFile("testdir/testdir/test.txt", "hello world!!");
    expect(fs.readdir("")).toEqual(["test.txt", "testdir"]);
    expect(fs.readdir("testdir")).toEqual(["test.txt", "testdir"]);
});
