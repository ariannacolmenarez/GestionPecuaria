import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { createApp } from './web/src/backend/app';

export default defineConfig(() => {
  return {
    root: path.resolve(__dirname, 'web'),
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'api-backend-middleware',
        configureServer(server) {
          const apiApp = createApp();
          server.middlewares.use(apiApp);
        },
      },
    ],
    build: {
      outDir: path.resolve(__dirname, 'app/src/main/assets/public'),
      emptyOutDir: true,
      // El único chunk > 500 kB es el SDK de Firebase (Firestore), aislado en su propio chunk.
      chunkSizeWarningLimit: 800,
      rollupOptions: {
        input: path.resolve(__dirname, 'web/index.html'),
        output: {
          // Dependencias grandes en chunks propios (caché independiente del código de la app)
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (/[\\/]@?firebase[\\/]/.test(id)) return 'firebase';
            if (/[\\/]lucide-react[\\/]/.test(id)) return 'icons';
            if (/[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react';
            return undefined;
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'web'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
