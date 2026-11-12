import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.granjaarianna.gestionpecuaria',
  appName: 'Gestion Pecuaria',
  // Debe coincidir con build.outDir de vite.config.ts (npm run build escribe aquí)
  webDir: 'app/src/main/assets/public'
};

export default config;
