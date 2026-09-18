/*
 * The map of your land: open it by clicking the minimap (or V). Drag to move, scroll or pinch to zoom (from the whole
 * island down to a few tiles), and tap anywhere to drop a marker. Markers show on the minimap too (with an arrow at
 * its edge when they are further away), and one of them can be tracked: an arrow by your hero points the way.
 *
 * Like a Minecraft map it fills in as you explore: land you have not been near stays dark. It shows the names of
 * the regions, your homes and stations, dungeons, bosses, monsters near you and other players, each layer can be
 * switched off, and it has a grid, a compass and a scale.
 */
import { h, icon, modal, closeIfOpen } from './dom.js';
import { TILE } from '../core/constants.js';
import { CREATURES } from '../data/objects.js';
import { BUILDINGS, sizeOf } from '../data/buildings.js';
import { heroOf } from '../game/hero.js';
import { play } from '../core/sound.js';
import { drawSprite } from '../core/assets.js';
import { hasArt } from '../render/gearArt.js';
import { THEMES, BIOME_KEYS } from '../game/worldTypes.js';

export const MARKER_COLORS = ['#ffd76a', '#7ee06a', '#5aa9ff', '#ff6b5b', '#c77dff', '#ffffff'];
export const markersOf = g => (g.state.markers ||= []);

/** Adds a marker at a tile. */
export function addMarker(g, x, y, label = null) {
  const list = markersOf(g);
  const m = { id: `mk${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`, x, y, color: MARKER_COLORS[list.length % MARKER_COLORS.length], label: label || `Marker ${list.length + 1}` };
  list.push(m);
  g.emit?.('change');
  return m;
}

/** The marker you are following (an arrow by your hero points to it), or null. */
export const trackedMarker = g => (g.state.track ? markersOf(g).find(m => m.id === g.state.track) || null : null);
export function setTrack(g, id) { g.state.track = g.state.track === id ? null : id; g.emit?.('change'); }

// ------------------------------------------------------------------ explored land (the map fills in as you go)

const EXPLORE_R = 13;   // tiles around you that you "see"

const encodeRuns = bits => {   // run lengths of 0s and 1s, starting with 0s: compact for blobby areas
  const out = [];
  let cur = 0, n = 0;
  for (let i = 0; i < bits.length; i++) { if (bits[i] === cur) n++; else { out.push(n.toString(36)); cur ^= 1; n = 1; } }
  out.push(n.toString(36));
  return out.join('.');
};
const decodeRuns = (str, bits) => {
  let i = 0, cur = 0;
  for (const part of str.split('.')) { const n = parseInt(part, 36) || 0; if (cur) bits.fill(1, i, i + n); i += n; cur ^= 1; }
};

function reveal(w, bits, cx, cy, r) {
  let changed = 0;
  const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(w.w - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(w.h - 1, Math.ceil(cy + r));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = y * w.w + x;
    if (!bits[i] && (x - cx) ** 2 + (y - cy) ** 2 <= r * r) { bits[i] = 1; changed++; }
  }
  return changed;
}

/** Which tiles of this island you have seen (1) or not (0). */
export function exploredOf(g) {
  const w = g.world;
  if (g._explored?.w === w) return g._explored.bits;
  const bits = new Uint8Array(w.w * w.h);
  const saved = g.state.explored;
  if (saved?.seed === w.seed && saved.size === bits.length) decodeRuns(saved.runs, bits);
  else {   // a map you never had: you know the land around your home, your buildings and your markers
    if (g.state.center) reveal(w, bits, g.state.center.x / TILE, g.state.center.y / TILE, 22);
    for (const b of g.state.buildings || []) reveal(w, bits, b.tx + 1, b.ty + 1, 9);
    for (const m of markersOf(g)) reveal(w, bits, m.x, m.y, 5);
  }
  g._explored = { w, bits, version: 1, dirty: true };
  return bits;
}

/** Marks the land around a tile as seen. Called as you move. */
export function exploreAround(g, tx, ty, r = EXPLORE_R) {
  if (g.visiting || g.dungeon) return;
  const bits = exploredOf(g);
  if (reveal(g.world, bits, tx, ty, r)) { g._explored.version++; g._explored.dirty = true; }
}

/** Puts the explored land into the save (only when it changed). */
export function saveExplored(g) {
  const e = g._explored;
  if (!e?.dirty || e.w !== g.world) return;
  g.state.explored = { seed: g.world.seed, size: e.bits.length, runs: encodeRuns(e.bits) };
  e.dirty = false;
}

/** Admin: see the whole island, or forget it all. */
export function revealAll(g, on = true) {
  const bits = exploredOf(g);
  bits.fill(on ? 1 : 0);
  if (!on) exploreAround(g, ...(heroOf(g) ? [heroOf(g).x / TILE, heroOf(g).y / TILE] : [0, 0]));
  g._explored.version++; g._explored.dirty = true;
  saveExplored(g);
}

/** A canvas (1 pixel per tile) that darkens the land you have not seen, drawn smoothed so its edges are soft. */
export function fogCanvas(g) {
  const e = g._explored || (exploredOf(g), g._explored);
  if (e.fog && e.fogVersion === e.version) return e.fog;
  const w = g.world;
  const c = e.fog || document.createElement('canvas');
  c.width = w.w; c.height = w.h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w.w, w.h);
  for (let i = 0; i < e.bits.length; i++) {
    if (e.bits[i]) continue;
    const n = ((i * 2654435761) >>> 24) & 15;   // a little grain, like old paper
    img.data[i * 4] = 18 + n; img.data[i * 4 + 1] = 20 + n; img.data[i * 4 + 2] = 30 + n; img.data[i * 4 + 3] = 250;
  }
  ctx.putImageData(img, 0, 0);
  e.fog = c; e.fogVersion = e.version;
  return c;
}

// ------------------------------------------------------------------ region names

/** The big regions of the island (a meadow, the frozen wastes...) with a spot to write their name. */
function regionsOf(g) {
  const w = g.world;
  if (g._regions?.w === w) return g._regions.list;
  const list = [];
  if (w.biomes) {
    const S = 3, gw = Math.ceil(w.w / S), gh = Math.ceil(w.h / S);
    const cell = new Int16Array(gw * gh).fill(-1);
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      const tx = Math.min(w.w - 1, x * S + 1), ty = Math.min(w.h - 1, y * S + 1);
      if (!w.isWater(tx, ty)) cell[y * gw + x] = w.biomes[ty * w.w + tx];
    }
    const seen = new Uint8Array(gw * gh);
    for (let s = 0; s < cell.length; s++) {
      if (seen[s] || cell[s] < 0) continue;
      const b = cell[s], stack = [s];
      let n = 0, sx = 0, sy = 0;
      seen[s] = 1;
      while (stack.length) {
        const i = stack.pop(), x = i % gw, y = (i - x) / gw;
        n++; sx += x; sy += y;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy, j = ny * gw + nx;
          if (nx >= 0 && ny >= 0 && nx < gw && ny < gh && !seen[j] && cell[j] === b) { seen[j] = 1; stack.push(j); }
        }
      }
      if (n >= Math.max(14, gw * gh * 0.012)) list.push({ x: (sx / n) * S + S / 2, y: (sy / n) * S + S / 2, name: THEMES[BIOME_KEYS[b]]?.name || BIOME_KEYS[b], color: THEMES[BIOME_KEYS[b]]?.color || '#fff', size: n });
    }
  }
  g._regions = { w, list };
  return list;
}

// ------------------------------------------------------------------ layers you can switch off

const LAYERS = [
  { key: 'homes', name: 'Homes', icon: 'ui/home' },
  { key: 'dungeons', name: 'Dungeons', icon: 'dungeon/cave_entrance' },
  { key: 'bosses', name: 'Bosses', icon: 'ui/tab_mob' },
  { key: 'mobs', name: 'Monsters', icon: 'ui/status_enraged' },
  { key: 'players', name: 'Players', icon: 'ui/character' },
  { key: 'names', name: 'Regions', icon: 'ui/map' },
  { key: 'grid', name: 'Grid', icon: 'ui/move' },
];
const loadLayers = () => { try { return { homes: 1, dungeons: 1, bosses: 1, mobs: 1, players: 1, names: 1, grid: 0, ...JSON.parse(localStorage.getItem('hb-map-layers') || '{}') }; } catch { return { homes: 1, dungeons: 1, bosses: 1, mobs: 1, players: 1, names: 1, grid: 0 }; } };
const saveLayers = l => { try { localStorage.setItem('hb-map-layers', JSON.stringify(l)); } catch {} };

const STATION_ICON = { enchanting_table: 'ui/enchant', market_stall: 'ui/trade', crafting_table: 'buildings/crafting_table' };

export function openIslandMap(hud) {
  if (closeIfOpen('island-map-modal')) return null;
  const g = hud.game;
  const w = g.world;
  const canvas = h('canvas.island-canvas');
  const info = h('div.island-info', 'Drag to move · scroll or pinch to zoom · tap to place a marker · tap a marker to edit it');
  const list = h('div.island-list');
  const legend = h('div.island-legend');
  const m = modal([], { cls: 'island-map-modal', closeX: true });
  const view = { z: 1, x: 0, y: 0 };   // z: canvas pixels per tile
  const layers = loadLayers();
  let alive = true, hover = null;
  const bits = exploredOf(g);
  const seen = (x, y) => !!bits[Math.floor(y) * w.w + Math.floor(x)];

  const size = () => { const r = canvas.getBoundingClientRect(); canvas.width = Math.max(200, Math.round(r.width * devicePixelRatio)); canvas.height = Math.max(200, Math.round(r.height * devicePixelRatio)); };
  const minZ = () => Math.min(canvas.width / w.w, canvas.height / w.h);   // the whole island
  const maxZ = () => Math.max(minZ() * 16, 48 * devicePixelRatio);          // right down to a few tiles
  const clamp = () => {
    view.z = Math.max(minZ(), Math.min(maxZ(), view.z));
    const W = w.w * view.z, H = w.h * view.z;
    view.x = W < canvas.width ? (canvas.width - W) / 2 : Math.min(0, Math.max(canvas.width - W, view.x));
    view.y = H < canvas.height ? (canvas.height - H) / 2 : Math.min(0, Math.max(canvas.height - H, view.y));
  };
  const toTile = (px, py) => ({ x: (px - view.x) / view.z, y: (py - view.y) / view.z });
  const toScreen = (tx, ty) => ({ x: view.x + tx * view.z, y: view.y + ty * view.z });
  const zoomAt = (px, py, f) => { const t = toTile(px, py); view.z *= f; clamp(); view.x = px - t.x * view.z; view.y = py - t.y * view.z; clamp(); };
  const centerOn = (tx, ty, z) => { view.z = z; clamp(); view.x = canvas.width / 2 - tx * view.z; view.y = canvas.height / 2 - ty * view.z; clamp(); };

  /** Everything worth pointing at, for drawing and for the hover text. */
  const pois = () => {
    const out = [];
    const v = heroOf(g), hx = v ? v.x / TILE : 0, hy = v ? v.y / TILE : 0;
    if (layers.homes) for (const b of g.state.buildings) {
      const def = BUILDINGS[b.type], s = sizeOf(b), cx = b.tx + s / 2, cy = b.ty + s / 2;
      const ic = def?.housing ? 'ui/home' : STATION_ICON[b.type];
      if (ic) out.push({ x: cx, y: cy, icon: ic, name: def?.name || b.type, size: def?.housing ? 22 : 18 });
    }
    if (layers.dungeons) for (const e of g.state.dungeons || []) if (seen(e.x / TILE, e.y / TILE)) out.push({ x: e.x / TILE, y: e.y / TILE, icon: 'dungeon/cave_entrance', name: 'Dungeon', size: 24 });
    for (const c of g.state.creatures) {
      const def = CREATURES[c.t], x = c.x / TILE, y = c.y / TILE;
      if (!def || !seen(x, y)) continue;
      if ((def.boss || c.bounty) && layers.bosses) out.push({ x, y, sprite: def.sprite, name: `${def.boss ? 'Boss' : 'Bounty'}: ${def.name || c.t.replace(/_/g, ' ')}`, size: 26, ring: def.boss ? '#ff2a1f' : '#ffcf3a' });
      else if (def.hostile && layers.mobs && Math.hypot(x - hx, y - hy) < 26) out.push({ x, y, dot: '#ff6b5b', name: def.name || c.t.replace(/_/g, ' '), size: 7 });
    }
    if (layers.players) for (const o of g.strangers || []) out.push({ x: o.x / TILE, y: o.y / TILE, dot: '#5aa9ff', name: o.name || 'Player', size: 9, label: o.name });
    return out;
  };

  const draw = () => {
    if (!alive || !canvas.isConnected) { alive = false; return; }
    const ctx = canvas.getContext('2d');
    const dpr = devicePixelRatio, px = dpr / view.z;   // one screen pixel, in tiles
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0c1a2a'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(view.z, 0, 0, view.z, view.x, view.y);
    const terrain = hud.renderer?.terrain;
    const img = terrain?.world === w && terrain.overview ? terrain.overview : hud.miniBase;
    ctx.imageSmoothingEnabled = view.z < 6;
    if (img) ctx.drawImage(img, 0, 0, w.w, w.h);
    ctx.fillStyle = 'rgba(28,70,26,0.5)';
    if (view.z > 3) for (const o of g.state.objects) if (o.t.startsWith('tree_') && o.t !== 'tree_stump') ctx.fillRect(o.x + 0.2, o.y + 0.2, 0.6, 0.6);
    // buildings: their own picture when you are close, a footprint when far
    for (const b of g.state.buildings) {
      const s = sizeOf(b), def = BUILDINGS[b.type];
      if (view.z / dpr > 14 && def?.sprite && hasArt(def.sprite)) drawSprite(ctx, def.sprite, b.tx + s / 2, b.ty + s, s * 1.1);
      else { ctx.fillStyle = '#ffae3d'; ctx.fillRect(b.tx, b.ty, s, s); ctx.strokeStyle = '#3a2410'; ctx.lineWidth = px; ctx.strokeRect(b.tx, b.ty, s, s); }
    }
    // the land you have not seen yet
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(fogCanvas(g), 0, 0, w.w, w.h);
    // grid, every 10 tiles
    if (layers.grid) {
      ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = px;
      ctx.beginPath();
      for (let x = 10; x < w.w; x += 10) { ctx.moveTo(x, 0); ctx.lineTo(x, w.h); }
      for (let y = 10; y < w.h; y += 10) { ctx.moveTo(0, y); ctx.lineTo(w.w, y); }
      ctx.stroke();
    }
    // region names, when zoomed out
    const nameAlpha = Math.max(0, Math.min(1, 1.6 - view.z / (minZ() * 3)));
    if (layers.names && nameAlpha > 0) {
      ctx.save(); ctx.globalAlpha = nameAlpha;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const placed = [], perBiome = {};   // biggest regions first; a name never covers another
      for (const r of [...regionsOf(g)].sort((a, b) => b.size - a.size)) {
        if (!seen(r.x, r.y) || (perBiome[r.name] || 0) >= 2) continue;
        const fs = Math.min(18, 11 + r.size / 20) * px;
        ctx.font = `italic bold ${fs}px "Pixelify Sans", sans-serif`;
        const tw = ctx.measureText(r.name).width, box = [r.x - tw / 2 - 4 * px, r.y - fs, r.x + tw / 2 + 4 * px, r.y + fs];
        if (placed.some(b => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) continue;
        placed.push(box); perBiome[r.name] = (perBiome[r.name] || 0) + 1;
        ctx.lineWidth = 4 * px; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.strokeText(r.name, r.x, r.y);
        ctx.fillStyle = '#fff1cf'; ctx.fillText(r.name, r.x, r.y);
        ctx.fillStyle = r.color; ctx.fillRect(r.x - ctx.measureText(r.name).width / 2, r.y + fs * 0.62, ctx.measureText(r.name).width, 2 * px);   // underlined in the region's colour
      }
      ctx.restore();
    }
    // points of interest, always the same size on screen
    const ring = (x, y, r, color) => { ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.beginPath(); ctx.arc(x, y, (r + 2) * px, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = color; ctx.lineWidth = 2 * px; ctx.stroke(); };
    const dot = (x, y, r, color) => { ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(x, y, (r + 1.5) * px, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r * px, 0, Math.PI * 2); ctx.fill(); };
    const pulse = 0.85 + 0.15 * Math.sin(performance.now() / 180);
    for (const p of pois()) {
      if (p.dot) { dot(p.x, p.y, p.size / 2, p.dot); if (p.label) { ctx.font = `${11 * px}px "Pixelify Sans", sans-serif`; ctx.textAlign = 'center'; ctx.fillStyle = '#cfe4ff'; ctx.fillText(p.label, p.x, p.y - 9 * px); } continue; }
      const sz = p.size * px * dpr * (p.ring ? pulse : 1);
      if (p.ring) ring(p.x, p.y, p.size * dpr * 0.55, p.ring); else ring(p.x, p.y, p.size * dpr * 0.5, 'rgba(255,215,106,0.8)');
      const key = p.icon || p.sprite;
      if (key && hasArt(key)) drawSprite(ctx, key, p.x, p.y, sz * 0.85, { center: true });
      else dot(p.x, p.y, 5, p.ring || '#ffd76a');
    }
    // markers: a pin with its name (the tracked one pulses)
    const tracked = trackedMarker(g);
    ctx.font = `${12 * px}px "Pixelify Sans", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    for (const mk of markersOf(g)) {
      if (mk === tracked) { ctx.strokeStyle = mk.color; ctx.lineWidth = 2 * px; ctx.beginPath(); ctx.arc(mk.x, mk.y, (10 + 6 * pulse) * px, 0, Math.PI * 2); ctx.stroke(); }
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(mk.x, mk.y - 10 * px, 7 * px, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = mk.color; ctx.beginPath(); ctx.arc(mk.x, mk.y - 10 * px, 5.5 * px, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(mk.x - 4 * px, mk.y - 7 * px); ctx.lineTo(mk.x + 4 * px, mk.y - 7 * px); ctx.lineTo(mk.x, mk.y); ctx.fill();
      ctx.lineWidth = 3 * px; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.strokeText(mk.label, mk.x, mk.y - 20 * px); ctx.fillStyle = '#fff'; ctx.fillText(mk.label, mk.x, mk.y - 20 * px);
    }
    // you: an arrow pointing the way you face, and a dashed line to the tracked marker
    const v = heroOf(g);
    if (v) {
      const vx = v.x / TILE, vy = v.y / TILE;
      if (tracked) { ctx.setLineDash([6 * px, 5 * px]); ctx.strokeStyle = tracked.color; ctx.lineWidth = 2 * px; ctx.beginPath(); ctx.moveTo(vx, vy); ctx.lineTo(tracked.x, tracked.y); ctx.stroke(); ctx.setLineDash([]); }
      ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.arc(vx, vy, 16 * px * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.translate(vx, vy); ctx.rotate(g.hero?.facing ?? -Math.PI / 2); ctx.scale(px, px);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-8, -9); ctx.lineTo(-3, 0); ctx.lineTo(-8, 9); ctx.closePath(); ctx.stroke(); ctx.fill();
      ctx.restore();
    }
    // screen-space: grid numbers, compass and scale
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.font = `${10 * dpr}px "Pixelify Sans", sans-serif`; ctx.fillStyle = 'rgba(255,255,255,0.6)';
    if (layers.grid) {
      ctx.textAlign = 'center';
      for (let x = 10; x < w.w; x += 10) { const s = toScreen(x, 0); if (s.x > 20 && s.x < canvas.width - 20) ctx.fillText(x, s.x, 12 * dpr); }
      ctx.textAlign = 'left';
      for (let y = 10; y < w.h; y += 10) { const s = toScreen(0, y); if (s.y > 20 && s.y < canvas.height - 20) ctx.fillText(y, 4 * dpr, s.y + 4 * dpr); }
    }
    const cx = canvas.width - 30 * dpr, cy = 34 * dpr;   // compass
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.arc(cx, cy, 20 * dpr, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,215,106,0.8)'; ctx.lineWidth = 2 * dpr; ctx.stroke();
    ctx.fillStyle = '#ff6b5b'; ctx.beginPath(); ctx.moveTo(cx, cy - 15 * dpr); ctx.lineTo(cx - 5 * dpr, cy); ctx.lineTo(cx + 5 * dpr, cy); ctx.fill();
    ctx.fillStyle = '#e8e2d6'; ctx.beginPath(); ctx.moveTo(cx, cy + 15 * dpr); ctx.lineTo(cx - 5 * dpr, cy); ctx.lineTo(cx + 5 * dpr, cy); ctx.fill();
    ctx.fillStyle = '#ffd76a'; ctx.font = `bold ${11 * dpr}px "Pixelify Sans", sans-serif`; ctx.textAlign = 'center'; ctx.fillText('N', cx, cy - 22 * dpr + 2);
    const nice = [1, 2, 5, 10, 20, 50, 100].find(n => n * view.z >= 60 * dpr) || 100;   // scale bar
    const sx = 12 * dpr, sy = canvas.height - 14 * dpr, len = nice * view.z;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(sx - 6 * dpr, sy - 18 * dpr, len + 12 * dpr, 26 * dpr);
    ctx.fillStyle = '#fff'; ctx.fillRect(sx, sy, len, 3 * dpr); ctx.fillRect(sx, sy - 5 * dpr, 2 * dpr, 8 * dpr); ctx.fillRect(sx + len - 2 * dpr, sy - 5 * dpr, 2 * dpr, 8 * dpr);
    ctx.font = `${10 * dpr}px "Pixelify Sans", sans-serif`; ctx.textAlign = 'left'; ctx.fillText(`${nice} tiles`, sx, sy - 6 * dpr);
    requestAnimationFrame(draw);
  };

  const describe = t => {
    if (!t || t.x < 0 || t.y < 0 || t.x >= w.w || t.y >= w.h) return 'Drag to move · scroll or pinch to zoom · tap to place a marker · tap a marker to edit it';
    const tx = Math.floor(t.x), ty = Math.floor(t.y);
    if (!seen(tx, ty)) return `${tx}, ${ty} · Unexplored`;
    const near = pois().filter(p => Math.hypot(p.x - t.x, p.y - t.y) * view.z < 16 * devicePixelRatio).map(p => p.name);
    const biome = w.biomes ? THEMES[BIOME_KEYS[w.biomes[ty * w.w + tx]]]?.name : null;
    const v = heroOf(g), dist = v ? Math.round(Math.hypot(t.x - v.x / TILE, t.y - v.y / TILE)) : null;
    return [`${tx}, ${ty}`, w.isWater(tx, ty) ? 'Sea' : biome, dist != null ? `${dist} tiles away` : null, ...near].filter(Boolean).join(' · ');
  };

  const renderLegend = () => legend.replaceChildren(...LAYERS.map(l => h(`button.island-layer${layers[l.key] ? '.on' : ''}`, {
    title: `Show or hide ${l.name.toLowerCase()}`,
    onclick: () => { layers[l.key] = layers[l.key] ? 0 : 1; saveLayers(layers); play('click'); renderLegend(); },
  }, hasArt(l.icon) ? icon(l.icon, 16) : null, l.name)));

  const renderList = () => {
    const mks = markersOf(g);
    const v = heroOf(g);
    const tracked = trackedMarker(g);
    list.replaceChildren(h('b', `Markers (${mks.length})`), ...mks.map(mk => h(`div.island-mk${mk === tracked ? '.tracked' : ''}`,
      h('i', { style: { background: mk.color } }),
      h('button.link', { title: 'Show on the map', onclick: () => centerOn(mk.x, mk.y, Math.max(view.z, minZ() * 5)) }, mk.label, v ? h('small', ` ${Math.round(Math.hypot(mk.x - v.x / TILE, mk.y - v.y / TILE))}`) : null),
      h(`button.btn.sm${mk === tracked ? '.primary' : '.ghost'}`, { title: 'An arrow by your hero points the way', onclick: () => { setTrack(g, mk.id); play('click'); renderList(); } }, mk === tracked ? 'Tracking' : 'Track'),
      h('button.btn.sm.ghost', { title: 'Rename', onclick: () => { const n = prompt('Marker name', mk.label); if (n) { mk.label = n.slice(0, 24); renderList(); g.emit('change'); } } }, 'Rename'),
      h('button.btn.sm.ghost', { title: 'Remove', onclick: () => { g.state.markers = markersOf(g).filter(x => x !== mk); if (g.state.track === mk.id) g.state.track = null; renderList(); g.emit('change'); } }, 'Remove'))),
    ...(mks.length ? [] : [h('div.faint', 'Tap the map to place one.')]));
  };

  // input: drag to pan, wheel and pinch to zoom, tap to place or edit a marker
  const pointers = new Map();
  let drag = null, pinch = null, moved = false;
  const pos = e => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * devicePixelRatio, y: (e.clientY - r.top) * devicePixelRatio }; };
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture?.(e.pointerId);
    pointers.set(e.pointerId, pos(e)); moved = false;
    if (pointers.size === 1) drag = { ...pos(e), vx: view.x, vy: view.y };
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: view.z }; }
  });
  canvas.addEventListener('pointermove', e => {
    hover = toTile(...Object.values(pos(e)));
    info.textContent = describe(hover);
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, pos(e));
    if (pointers.size === 2 && pinch) { const [a, b] = [...pointers.values()]; const f = (pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d) / view.z; zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, f); moved = true; return; }
    if (drag) { const p = pos(e); if (Math.hypot(p.x - drag.x, p.y - drag.y) > 6) moved = true; view.x = drag.vx + p.x - drag.x; view.y = drag.vy + p.y - drag.y; clamp(); }
  });
  canvas.addEventListener('pointerleave', () => { hover = null; info.textContent = describe(null); });
  const up = e => {
    const p = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (!pointers.size) {
      drag = null;
      if (!moved && p) {   // a tap: edit the marker under it, or place a new one
        const t = toTile(p.x, p.y);
        const hit = markersOf(g).find(mk => Math.hypot(mk.x - t.x, (mk.y - 0.4) - t.y) * view.z < 18 * devicePixelRatio);
        if (hit) { const n = prompt('Rename the marker (leave empty to remove it)', hit.label); if (n === '') { g.state.markers = markersOf(g).filter(x => x !== hit); if (g.state.track === hit.id) g.state.track = null; } else if (n) hit.label = n.slice(0, 24); }
        else if (t.x >= 0 && t.y >= 0 && t.x < w.w && t.y < w.h) { addMarker(g, t.x, t.y); play('click'); }
        info.textContent = describe(t);
        renderList();
      }
    }
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', e => { e.preventDefault(); const p = pos(e); zoomAt(p.x, p.y, e.deltaY < 0 ? 1.25 : 1 / 1.25); }, { passive: false });

  const zoomBtn = f => () => zoomAt(canvas.width / 2, canvas.height / 2, f);
  const v0 = heroOf(g);
  const pct = Math.round(bits.reduce((a, b) => a + b, 0) / bits.length * 100);
  m.el.replaceChildren(m.closeBtn,
    h('div.island-head', icon(hasArt('ui/map') ? 'ui/map' : 'items/scroll', 26), h('div', h('h2', 'Map'), h('div.faint', `${pct}% explored`)), h('div.spacer'),
      h('button.btn.sm', { onclick: zoomBtn(1.5) }, '+'), h('button.btn.sm', { onclick: zoomBtn(1 / 1.5) }, '−'),
      h('button.btn.sm', { onclick: () => { const v = heroOf(g); if (v) centerOn(v.x / TILE, v.y / TILE, Math.max(view.z, minZ() * 4)); } }, 'Find me'),
      h('button.btn.sm', { onclick: () => { view.z = minZ(); clamp(); } }, 'Whole island'),
      hud.mp ? h('button.btn.sm', { onclick: () => { m.close(); hud.openMap(); } }, 'World Map') : null),
    legend,
    h('div.island-body', h('div.island-frame', canvas), list), info);
  renderLegend();
  requestAnimationFrame(() => {
    size();
    if (v0) centerOn(v0.x / TILE, v0.y / TILE, minZ() * 4); else { view.z = minZ(); clamp(); }
    renderList();
    draw();
  });
  return m;
}
