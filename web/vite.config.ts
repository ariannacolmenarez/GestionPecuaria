import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    root: __dirname,
    plugins: [react(), tailwindcss()],
    build: {
      outDir: path.resolve(__dirname, '../app/src/main/assets/public'),
      emptyOutDir: true,
      // El único chunk > 500 kB es el SDK de Firebase (Firestore), aislado en su propio chunk de vendor.
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        input: path.resolve(__dirname, 'index.html'),
        output: {
          // Separar dependencias grandes en chunks propios (caché independiente del código de la app)
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('/firebase/') || id.includes('/@firebase/')) return 'firebase';
            if (id.includes('/lucide-react/')) return 'icons';
            if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('/scheduler/')) return 'react';
            return undefined;
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
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
