import '../../tools/sheets.js';
import SPRITE_FILES from 'virtual:sprite-list';

const AVAILABLE = new Set(SPRITE_FILES);

// Loads every sprite listed in tools/sheets.js from /assets/<folder>/<name>.png.
// Missing files get a generated placeholder so the game always runs.
const images = new Map();   // key "folder/name" -> { img, box }
const tinted = new Map();

const PLACEHOLDER_COLORS = {
  characters: '#c98b5a', buildings: '#8a6a4a', nature: '#4f9a4a', items: '#d8b44a', effects: '#e8e0ff',
};

export function allSpriteKeys() {
  const keys = [];
  for (const sheet of Object.values(window.SHEETS)) {
    for (const n of sheet.names) keys.push(`${sheet.folder}/${n}`);
  }
  return keys;
}

/** Sprite entry; the visible-pixel box is measured the first time it is needed, not at load. */
function entry(img) {
  let box = null;
  return { img, get box() { return (box ||= opaqueBox(img)); } };
}

export const spriteAvailable = key => AVAILABLE.has(key);

let version = 0;
/** Bumps whenever a late sprite replaces a placeholder, so cached drawings (terrain) can refresh. */
export const spriteVersion = () => version;

/**
 * Phones, data-saver and low-memory devices get the 128px art set (half the download, a quarter of the memory).
 * Override with localStorage 'hb-art' = 'hi' | 'lo'.
 */
function pickArtSet() {
  let pref = null;
  try { pref = localStorage.getItem('hb-art'); } catch {}
  if (pref === 'hi' || pref === 'lo') return pref;
  const phone = matchMedia?.('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 820;
  const saveData = navigator.connection?.saveData;
  const lowMem = navigator.deviceMemory && navigator.deviceMemory <= 4;
  return phone || saveData || lowMem ? 'lo' : 'hi';
}
export const ART_SET = pickArtSet();
export function setArtSet(set) {
  try { localStorage.setItem('hb-art', set); } catch {}
}

const url = (key, attempt) => `${import.meta.env.BASE_URL}${ART_SET === 'lo' ? 'assets-lo' : 'assets'}/${key}.png${attempt ? `?r=${attempt}` : ''}`;
function fetchImage(key, attempt = 0) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url(key, attempt);
  });
}

/** Try a few times: one flaky request must never leave a letter placeholder in the game. */
async function loadOne(key) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await fetchImage(key, attempt); } catch { await new Promise(r => setTimeout(r, 300 * (attempt + 1))); }
  }
  return null;
}

// What the title screen needs: ground, trees, a few people and homes. Everything else loads behind it.
const PRIORITY = key => key.startsWith('nature/') || /^(characters\/(man|woman|child|elder)|buildings\/(tent|stockpile|campfire|castle)|items\/(scroll|war)|people\/)/.test(key);

let restReady = Promise.resolve();
/** Resolves once every sprite (not just the title-screen ones) has loaded. */
export const allAssetsReady = () => restReady;

async function download(keys, onEach, workers) {
  const queue = [...keys];
  // a limited number of downloads at once is faster and far more reliable than hundreds together
  const worker = async () => {
    for (let key = queue.shift(); key; key = queue.shift()) {
      const img = await loadOne(key);
      images.set(key, entry(img || placeholder(key)));
      if (!img) retryLater(key);
      onEach?.();
    }
  };
  await Promise.all(Array.from({ length: workers }, worker));
}

/** Loads the title-screen sprites (awaited), then keeps loading the rest in the background. */
export async function loadAssets(onProgress) {
  const keys = allSpriteKeys();
  const wanted = keys.filter(key => {
    if (AVAILABLE.has(key)) return true;
    images.set(key, entry(placeholder(key)));   // sheet not sliced yet: no network request
    return false;
  });
  const first = wanted.filter(PRIORITY), rest = wanted.filter(k => !PRIORITY(k));
  let done = 0;
  await download(first, () => onProgress?.(++done / first.length), 16);
  restReady = download(rest, null, ART_SET === 'lo' ? 6 : 10).then(() => { version++; });   // redraw cached terrain/icons once all art is in
}

function retryLater(key, delay = 4000) {
  setTimeout(async () => {
    const img = await loadOne(key);
    if (!img) { retryLater(key, Math.min(delay * 2, 60000)); return; }
    images.set(key, entry(img));
    for (const id of [...tinted.keys()]) if (id.startsWith(key)) tinted.delete(id);
    version++;
  }, delay);
}

export function sprite(key) {
  return images.get(key) || null;
}

export function iconUrl(key) {
  const s = images.get(key);
  if (!s) return '';
  return s.img instanceof HTMLImageElement ? s.img.src : s.img.toDataURL();
}

function opaqueBox(img) {
  const w = img.width, h = img.height;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  let d;
  try { d = ctx.getImageData(0, 0, w, h).data; } catch { return { x: 0, y: 0, w, h }; }
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (d[(y * w + x) * 4 + 3] > 20) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return { x: 0, y: 0, w, h };
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function placeholder(key) {
  const [folder, name] = key.split('/');
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const tile = name.startsWith('tile_');
  ctx.fillStyle = tile ? tileColor(name) : (PLACEHOLDER_COLORS[folder] || '#888');
  if (tile) ctx.fillRect(0, 0, 64, 64);
  else {
    ctx.beginPath(); ctx.roundRect(8, 8, 48, 48, 8); ctx.fill();
    ctx.strokeStyle = '#1b1622'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#1b1622'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(name[0].toUpperCase(), 32, 40);
  }
  return c;
}

function tileColor(name) {
  return {
    tile_grass: '#5c9e3c', tile_grass_flowers: '#66a843', tile_dirt: '#8a5a36', tile_sand: '#e8d090',
    tile_water: '#3a9ad9', tile_deep_water: '#1d4e89', tile_snow: '#eef4fa', tile_stone_path: '#8c8c8c',
    tile_tilled_soil: '#6b4526', tile_swamp: '#44613a', tile_lava: '#e5561e', tile_cave_floor: '#4a4a4f',
  }[name] || '#777';
}

/**
 * Draw a sprite with its visible pixels' bottom-centre at (x, y).
 * size = world units for the larger side of the visible sprite.
 */
export function drawSprite(ctx, key, x, y, size, opts = {}) {
  const s = images.get(key);
  if (!s) return;
  // animation frames use the whole image (every frame the same frame box, so nothing jitters)
  const box = opts.full ? { x: 0, y: 0, w: s.img.width, h: s.img.height } : s.box;
  const scale = size / Math.max(box.w, box.h);
  const w = box.w * scale, h = box.h * scale;
  const src = opts.tint ? tintedImage(key, s, opts.tint, opts.solid) : s.img;

  ctx.save();
  ctx.translate(x, y + (opts.offsetY || 0));
  if (opts.rot) ctx.rotate(opts.rot);
  if (opts.flip) ctx.scale(-1, 1);
  if (opts.flipY) ctx.scale(1, -1);   // mirror across the direction it points (a slash stays curved away from you)
  if (opts.squash) ctx.scale(1 + opts.squash, 1 - opts.squash);
  if (opts.alpha != null) ctx.globalAlpha *= opts.alpha;
  ctx.drawImage(src, box.x, box.y, box.w, box.h, -w / 2, opts.center ? -h / 2 : -h, w, h);
  ctx.restore();
}

/** Draw a tile image to fill a square. */
export function drawTile(ctx, key, x, y, size) {
  const s = images.get(key);
  if (s) ctx.drawImage(s.img, x, y, size, size);
}

/** A recoloured copy of a sprite: a light wash, or (solid) a flat silhouette like a hit flash. */
function tintedImage(key, s, tint, solid = false) {
  const id = key + tint + (solid ? '!' : '');
  let c = tinted.get(id);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = s.img.width; c.height = s.img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(s.img, 0, 0);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.globalAlpha = solid ? 1 : 0.45;
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, c.width, c.height);
  tinted.set(id, c);
  return c;
}
