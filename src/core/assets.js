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

export async function loadAssets(onProgress) {
  const keys = allSpriteKeys();
  let done = 0;
  await Promise.all(keys.map(key => new Promise(resolve => {
    if (!AVAILABLE.has(key)) {   // sheet not sliced yet: placeholder, no network request
      const c = placeholder(key);
      images.set(key, entry(c));
      finish();
      return;
    }
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => { images.set(key, entry(img)); finish(); };
    img.onerror = () => { images.set(key, entry(placeholder(key))); finish(); };
    img.src = `${import.meta.env.BASE_URL}assets/${key}.png`;
    function finish() { done++; onProgress?.(done / keys.length); resolve(); }
  })));
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
  const { box } = s;
  const scale = size / Math.max(box.w, box.h);
  const w = box.w * scale, h = box.h * scale;
  const src = opts.tint ? tintedImage(key, s, opts.tint) : s.img;

  ctx.save();
  ctx.translate(x, y + (opts.offsetY || 0));
  if (opts.rot) ctx.rotate(opts.rot);
  if (opts.flip) ctx.scale(-1, 1);
  if (opts.squash) ctx.scale(1 + opts.squash, 1 - opts.squash);
  if (opts.alpha != null) ctx.globalAlpha *= opts.alpha;
  ctx.drawImage(src, box.x, box.y, box.w, box.h, -w / 2, -h, w, h);
  ctx.restore();
}

/** Draw a tile image to fill a square. */
export function drawTile(ctx, key, x, y, size) {
  const s = images.get(key);
  if (s) ctx.drawImage(s.img, x, y, size, size);
}

function tintedImage(key, s, tint) {
  const id = key + tint;
  let c = tinted.get(id);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = s.img.width; c.height = s.img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(s.img, 0, 0);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, c.width, c.height);
  tinted.set(id, c);
  return c;
}
