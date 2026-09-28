import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@aldi1963/temp-mail-api-client";
import { API_BASE_URL } from "./lib/api-base";
import App from "./App";
import "./index.css";

if (API_BASE_URL) {
  setBaseUrl(API_BASE_URL);
}

createRoot(document.getElementById("root")!).render(<App />);
