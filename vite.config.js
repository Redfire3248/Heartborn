import { defineConfig } from 'vite';
import { readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

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

/** Dev only: POST /__save-icon {name, data} writes a generated PNG into public/icons (see tools/logo.js). */
function iconSaver() {
  return {
    name: 'icon-saver',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__save-icon', (req, res) => {
        let body = '';
        req.on('data', c => { body += c; });
        req.on('end', () => {
          try {
            const { name, data } = JSON.parse(body);
            if (!/^[a-z0-9-]+$/.test(name)) throw new Error('bad name');
            writeFileSync(join(process.cwd(), 'public', 'icons', `${name}.png`), Buffer.from(data, 'base64'));
            res.end('ok');
          } catch (e) { res.statusCode = 400; res.end(String(e.message)); }
        });
      });
    },
  };
}

// Build stamp: shown in Settings, the title screen and the admin `version` command, and written to
// dist/version.json so anyone can check which deploy is live.
const pad = n => String(n).padStart(2, '0');
const now = new Date();
let commit = 'dev';
try { commit = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { /* not a git checkout */ }
const BUILD = {
  version: `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`,
  commit,
  builtAt: now.toISOString(),
};

function versionFile() {
  return {
    name: 'version-file',
    apply: 'build',
    generateBundle() { this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify(BUILD, null, 2) }); },
  };
}

export default defineConfig({
  base: './',   // relative paths so the build works on GitHub Pages sub-folders too
  define: { __BUILD__: JSON.stringify(BUILD) },
  plugins: [spriteList(), iconSaver(), versionFile()],
  server: { port: 5173, open: false, headers },
  preview: { port: 5173, headers },
  build: {
    outDir: 'dist', assetsInlineLimit: 0, chunkSizeWarningLimit: 1500,
    // Firebase (most of the download) goes in its own file: it rarely changes, so browsers keep it cached across game updates
    rollupOptions: { output: { manualChunks: id => (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase') ? 'firebase' : undefined) } },
  },
  // pre-bundle Firebase when the dev server starts instead of on the first page load
  optimizeDeps: { include: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/database'] },
});
