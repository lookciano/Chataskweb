import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gste.chattask',
  appName: 'Chat Task',
  webDir: 'dist/public',
  server: {
    // Permite que o WebView faça requisições cross-origin para o backend do Render
    androidScheme: 'https',
    cleartext: false,
  },
  android: {
    // Permite cookies de terceiros no WebView (necessário para sessão cross-origin)
    allowMixedContent: false,
  },
};

export default config;
