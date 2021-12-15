import React from "react";
import { render } from "react-dom";
import App from "./App";
import App2 from "./App2";

render(
    <React.StrictMode>
        <App2 />
    </React.StrictMode>,
    document.getElementById("root")
);
