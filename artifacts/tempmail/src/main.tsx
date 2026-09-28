import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import { setBaseUrl } from "@aldi1963/temp-mail-api-client";
import { API_BASE_URL } from "./lib/api-base";
import App from "./App";
import "./index.css";

if (API_BASE_URL) {
  setBaseUrl(API_BASE_URL);
}

// Aplikasi Android: tandai agar CSS bisa menyesuaikan system bar transparan.
if (Capacitor.isNativePlatform()) {
  document.documentElement.classList.add("capacitor-native");
}

createRoot(document.getElementById("root")!).render(<App />);
