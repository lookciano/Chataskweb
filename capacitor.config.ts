import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.gste.chattask",
  appName: "Chat Task",
  webDir: "dist/public",
  server: {
    // Backend público de Render: necesario para que o WebView iOS
    // reporte essa origem e os cookies SameSite sejam persistidos corretamente.
    hostname: "chataskweb.onrender.com",
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
