import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@aldi1963/temp-mail-api-client";
import App from "./App";
import "./index.css";

const base = import.meta.env.BASE_URL.replace(/\/$/, "");
if (base) {
  setBaseUrl(base);
}

createRoot(document.getElementById("root")!).render(<App />);
