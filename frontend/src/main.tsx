import React from "react";
import ReactDOM from "react-dom/client";

// Apply dark mode before first render to avoid flash
if (localStorage.getItem("angotinder_dark") === "true") {
  document.documentElement.classList.add("dark");
}
import App from "./app/App";
import { AppProvider } from "./app/context";
import { GoogleOAuthProvider } from "@react-oauth/google";
import "./styles/index.css";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GOOGLE_CLIENT_ID = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || "not-configured";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AppProvider>
        <App />
      </AppProvider>
    </GoogleOAuthProvider>
  </React.StrictMode>
);
