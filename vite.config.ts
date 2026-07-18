import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom', 'lucide-react'],
            framer: ['framer-motion'],
            charts: ['recharts'],
            utils: ['date-fns', 'fuse.js', 'uuid'],
            qrcode: ['html5-qrcode', 'qrcode.react'],
            pdf: ['jspdf', 'jspdf-autotable'],
            leaflet: ['leaflet', 'react-leaflet'],
            redux: ['redux', 'react-redux', 'redux-thunk', '@reduxjs/toolkit'],
            dompurify: ['dompurify'],
          },
        },
      },
    },
    optimizeDeps: {
      exclude: ['firebase'], // ← key fix: stop forcing Firebase pre-bundle
    },
    server: {
      port: 5173,
      strictPort: false,
      host: '0.0.0.0',
      hmr: {
        host: 'localhost',
        port: 5173,
        protocol: 'ws',
      },
      allowedHosts: true as const,
      proxy: {
        '/api': {
          target: 'http://localhost:5173',
          changeOrigin: true,
          rewrite: (path) => path,
        },
        '/socket.io': {
          target: 'http://localhost:5173',
          changeOrigin: true,
          ws: true,
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
