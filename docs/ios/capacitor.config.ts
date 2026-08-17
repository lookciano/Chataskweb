import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lookciano.chattask',
  appName: 'Chat Task',
  webDir: 'dist/public',
  server: {
    hostname: 'chataskweb.onrender.com',
    androidScheme: 'https',
    iosScheme: 'https',
    allowNavigation: ['chataskweb.onrender.com'],
  },
  ios: {
    contentInset: 'never',
    scheme: 'ChatTask',
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;