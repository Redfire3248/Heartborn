import { defineConfig } from 'vite';
import { readdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
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
    // HASHES: a short fingerprint of each picture (both sizes), put on its URL. Phones answer sprites from the
    // service worker's cache first, so a redrawn icon kept the old picture until some later visit; a changed file
    // is now a new URL and comes fresh at once, while every unchanged one stays cached.
    load: s => {
      if (s !== resolved) return null;
      const keys = scan();
      const lo = join(process.cwd(), 'public', 'assets-lo');
      const hashes = {};
      for (const k of keys) {
        const h = createHash('md5').update(readFileSync(join(dir, `${k}.png`)));
        const l = join(lo, `${k}.png`);
        if (existsSync(l)) h.update(readFileSync(l));
        hashes[k] = h.digest('hex').slice(0, 8);
      }
      return `export default ${JSON.stringify(keys)};
export const HASHES = ${JSON.stringify(hashes)};`;
    },
    configureServer(server) {
      // new sprites sliced while the dev server runs show up after a reload
      server.watcher.add(dir);
      server.watcher.on('all', (ev, f) => {
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
    /*
     * The download is split by how often each part changes, so an update only re-downloads what it touched instead
     * of one big file every time (on a slow connection that one file was most of the wait):
     *   firebase  - the Firebase library: changes almost never
     *   changelog - the update notes: change every update, but small, and nothing else has to come with them
     *   engine    - the game's rules, data, saving and networking (src/game, data, core, net): never imports the
     *               screens or the renderer, so it can stand on its own without any chance of a loading-order loop
     *   the rest  - screens and drawing, the part most updates touch
     * Anything only some players need (the admin tools) stays out of all of these and loads when asked for.
     */
    rollupOptions: {
      output: {
        // groups claim their modules highest priority first, so Firebase is never swallowed by the game's own group
        advancedChunks: {
          groups: [
            { name: 'firebase', test: /node_modules[\\/](@firebase|firebase)[\\/]/, priority: 30 },
            { name: 'changelog', test: /src[\\/]data[\\/]changelog\.js/, priority: 20 },
            { name: 'engine', test: /src[\\/](game|data|core|net)[\\/]|tools[\\/]sheets\.js/, priority: 10 },
          ],
        },
      },
    },
  },
  // pre-bundle Firebase when the dev server starts instead of on the first page load
  optimizeDeps: { include: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/database'] },
});
