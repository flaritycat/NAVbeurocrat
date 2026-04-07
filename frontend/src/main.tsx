import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./app/App";
import { appBasePath } from "./lib/config";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter basename={appBasePath}>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
