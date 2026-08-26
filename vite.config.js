import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3001,
    host: true,
    open: false
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-firebase-app': ['firebase/app', 'firebase/auth'],
          'vendor-firebase-db': ['firebase/firestore']
        }
      }
    }
  }
});
