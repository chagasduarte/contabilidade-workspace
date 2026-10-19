import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gerenciamento.app',
  appName: 'gerenciamento',
  webDir: 'dist/apps/contabilidade-front/browser',
  server: {
    androidScheme: 'http',
    cleartext: true,
  },
};

export default config;
