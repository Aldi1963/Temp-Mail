import type { CapacitorConfig } from "@capacitor/cli";

// webDir menunjuk ke hasil build KHUSUS native (base path relatif "./"),
// terpisah dari dist/public yang dipakai situs web.
const config: CapacitorConfig = {
  appId: "com.clipku.tempmail",
  appName: "TempMail",
  webDir: "dist-native/public",
};

export default config;
