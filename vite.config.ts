import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        // Opened in the default browser by the desktop app to finish Google sign-in (desktop/main.cjs).
        'desktop-auth': fileURLToPath(new URL('./desktop-auth.html', import.meta.url)),
      },
    },
  },
});
