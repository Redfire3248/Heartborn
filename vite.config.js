import { defineConfig } from 'vite';
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Lets the Google sign-in popup report back to the page without
// "Cross-Origin-Opener-Policy would block the window.closed call" errors.
const headers = { 'Cross-Origin-Opener-Policy': 'same-origin-allow-popups' };

/** `virtual:sprite-list`: which sprite PNGs really exist, so the game never requests missing ones (no 404s). */
function spriteList() {
  const id = 'virtual:sprite-list', resolved = '\0' + id;
  const dir = join(process.cwd(), 'public', 'assets');
  const scan = () => existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory())
      .flatMap(d => readdirSync(join(dir, d.name)).filter(f => f.endsWith('.png')).map(f => `${d.name}/${f.slice(0, -4)}`))
    : [];
  return {
    name: 'sprite-list',
    resolveId: s => (s === id ? resolved : null),
    load: s => (s === resolved ? `export default ${JSON.stringify(scan())};` : null),
    configureServer(server) {
      // new sprites sliced while the dev server runs show up after a reload
      server.watcher.add(dir);
      server.watcher.on('add', f => {
        if (!f.endsWith('.png')) return;
        const mod = server.moduleGraph.getModuleById(resolved);
        if (mod) server.moduleGraph.invalidateModule(mod);
      });
    },
  };
}

export default defineConfig({
  base: './',   // relative paths so the build works on GitHub Pages sub-folders too
  plugins: [spriteList()],
  server: { port: 5173, open: false, headers },
  preview: { port: 5173, headers },
  build: { outDir: 'dist', assetsInlineLimit: 0, chunkSizeWarningLimit: 1500 },
  // pre-bundle Firebase when the dev server starts instead of on the first page load
  optimizeDeps: { include: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/database'] },
});
