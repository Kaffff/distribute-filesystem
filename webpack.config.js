const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const { webpack, ProvidePlugin } = require("webpack");

module.exports = {
    mode: "development",
    entry: path.resolve(__dirname, "src", "index.tsx"),
    output: {
        path: path.resolve(__dirname, "dist"),
        filename: "index.js",
    },
    devServer: {
        hot: true,
        host: "0.0.0.0",
        port: process.env.PORT || 3000,
        https: {
            key: "./private/server.key",
            cert: "./private/server.crt",
        },
    },
    module: {
        rules: [
            {
                test: /\.[jt]sx?$/,
                use: ["babel-loader"],
                exclude: /node_modules/,
            },
        ],
    },
    experiments: {
        asyncWebAssembly: true,
        syncWebAssembly: true,
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: path.resolve(__dirname, "public/index.html"),
        }),
        new ProvidePlugin({
            Buffer: ["buffer", "Buffer"],
            process: "process/browser",
        }),
    ],
    resolve: {
        alias: {
            assert: "assert",
            buffer: "buffer",
            console: "console-browserify",
            constants: "constants-browserify",
            crypto: "crypto-browserify",
            domain: "domain-browser",
            events: "events",
            http: "stream-http",
            https: "https-browserify",
            os: "os-browserify/browser",
            path: "path-browserify",
            punycode: "punycode",
            process: "process/browser",
            querystring: "querystring-es3",
            stream: "stream-browserify",
            _stream_duplex: "readable-stream/duplex",
            _stream_passthrough: "readable-stream/passthrough",
            _stream_readable: "readable-stream/readable",
            _stream_transform: "readable-stream/transform",
            _stream_writable: "readable-stream/writable",
            string_decoder: "string_decoder",
            sys: "util",
            timers: "timers-browserify",
            tty: "tty-browserify",
            url: "url",
            util: "util",
            vm: "vm-browserify",
            zlib: "browserify-zlib",
        },
        extensions: [".js", ".jsx", ".ts", ".tsx"],
        fallback: {
            child_process: false,
            fs: false,
            crypto: false,
            net: false,
            tls: false,
        },
    },
};
