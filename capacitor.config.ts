import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.gste.chattask",
  appName: "Chat Task",
  webDir: "dist/public",
  server: {
    // Host local do WebView. Mantenha diferente do backend real para que o
    // Capacitor nao intercepte chamadas de API para chataskweb.onrender.com.
    hostname: "localhost",
    androidScheme: "https",
    iosScheme: "https",
    allowNavigation: ["chataskweb.onrender.com"],
    cleartext: false,
  },
  android: {
    // Permite cookies de terceiros no WebView (sessão cross-origin)
    allowMixedContent: false,
  },
  ios: {
    contentInset: "never", // CSS gerencia safe-area, o WebView não força padding duplo
    scheme: "ChatTask",
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
