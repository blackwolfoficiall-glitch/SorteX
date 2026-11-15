import type { ExpoConfig } from "expo/config";
const config: ExpoConfig = {
  name: "SorteX · Teste",
  slug: "sortex-mobile-dev",
  version: "0.1.0",
  scheme: "sortex-dev",
  orientation: "portrait",
  userInterfaceStyle: "light",
  icon: "./assets/icon.png",
  ios: { bundleIdentifier: "br.com.sortex.development", supportsTablet: true },
  android: {
    package: "br.com.sortex.development",
    permissions: [],
    blockedPermissions: [
      "android.permission.RECORD_AUDIO",
      "android.permission.CAMERA",
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
      "android.permission.VIBRATE",
      // Explicit removal from the merged manifest: no overlay permission.
      "android.permission.SYSTEM_ALERT_WINDOW",
    ],
  },
  plugins: [
    "expo-secure-store",
    [
      "expo-splash-screen",
      {
        image: "./assets/icon.png",
        imageWidth: 120,
        backgroundColor: "#140b29",
      },
    ],
  ],
};
export default config;
