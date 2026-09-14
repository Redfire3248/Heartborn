import { defineConfig } from 'vite';

// Lets the Google sign-in popup report back to the page without
// "Cross-Origin-Opener-Policy would block the window.closed call" errors.
const headers = { 'Cross-Origin-Opener-Policy': 'same-origin-allow-popups' };

export default defineConfig({
  base: './',   // relative paths so the build works on GitHub Pages sub-folders too
  server: { port: 5173, open: false, headers },
  preview: { port: 5173, headers },
  build: { outDir: 'dist', assetsInlineLimit: 0, chunkSizeWarningLimit: 1500 },
  // pre-bundle Firebase when the dev server starts instead of on the first page load
  optimizeDeps: { include: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/database'] },
});
