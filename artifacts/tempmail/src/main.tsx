import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@aldi1963/temp-mail-api-client";
import App from "./App";
import "./index.css";

// Web: pakai BASE_URL (/tempmail). Aplikasi native (Capacitor): pakai VITE_API_BASE_URL absolut.
const apiBase =
  import.meta.env.VITE_API_BASE_URL || import.meta.env.BASE_URL.replace(/\/$/, "");
if (apiBase) {
  setBaseUrl(apiBase);
}

createRoot(document.getElementById("root")!).render(<App />);
