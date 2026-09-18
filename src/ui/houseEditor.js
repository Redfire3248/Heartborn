import { TOOLS, toolsOf } from '../game/tools.js';
import { h, icon, costChips, modal } from './dom.js';
import { DAY_LENGTH } from '../core/constants.js';
import { spriteAvailable, sprite } from '../core/assets.js';
import { BUILDINGS } from '../data/buildings.js';
import { ITEMS } from '../data/people.js';
import { RARITY } from '../game/rpg.js';
import { gearIconKey, hasArt } from '../render/gearArt.js';
import {
  FURNITURE, LANDING, FURNITURE_CATS, DESIGNS, houseShape, interiorOf, itemAt, canPlace, placeFurniture, removeFurniture,
  moveFurniture, storeItem, takeItem, storeGear, takeGear, slotsLeft, itemLabel,
  FLOORINGS, WALLPAPERS, setFloorTile, floorTileAt, setWallpaper, builderOf, storeTool, takeTool } from '../game/houses.js';

/*
 * Inside a home: an isometric room you build in (no character here).
 * Use mode: hover shows item names, click stairs to go up / the landing to go down, click storage to open it.
 * Arrange mode: click a piece to move, turn or pick it up. Choose furniture below to place it (R turns it).
 */

const TW = 64, TH = 32;   // one floor tile on screen (before zoom)
const WALL_H = 96;
const BEDS = new Set(['bed', 'double_bed', 'bunk_bed']);

/*
 * Tile art is drawn at its own isometric angle (with a thick edge), which never lines up exactly with the room.
 * So each piece is flattened once into a straight texture and then stretched onto the exact wall or floor shape:
 * no gaps, no overlaps, no sawtooth edges.
 */
const flatCache = new Map();
function pixelsOf(img) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0);
  return { data: x.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height };
}
/** A wall panel as a straight rectangle: each column's face from its top edge to its bottom edge, without the side edge. */
function wallTexture(key) {
  if (flatCache.has(key)) return flatCache.get(key);
  const sp = sprite(key);
  if (!sp?.img?.width) return null;
  const { data, w, h } = pixelsOf(sp.img);
  const cols = [];
  for (let x = 0; x < w; x++) {
    let top = -1, bot = -1;
    for (let y = 0; y < h; y++) if (data[(y * w + x) * 4 + 3] > 128) { if (top < 0) top = y; bot = y; }
    if (top >= 0) cols.push({ x, top, bot });
  }
  if (cols.length < 8) return null;
  const tall = Math.max(...cols.map(c => c.bot - c.top));
  const face = cols.filter(c => c.bot - c.top > tall * 0.9);   // the side edge is shorter: leave it out
  const inset = Math.max(2, Math.round(face.length * 0.05));   // and the outline
  const use = face.slice(inset, face.length - inset);
  const H = 256, out = document.createElement('canvas');
  out.width = use.length; out.height = H;
  const o = out.getContext('2d');
  o.imageSmoothingEnabled = false;
  use.forEach((c, i) => { const pad = Math.max(2, (c.bot - c.top) * 0.02); o.drawImage(sp.img, c.x, c.top + pad, 1, c.bot - c.top - pad * 2, i, 0, 1, H); });
  flatCache.set(key, out);
  return out;
}
/** A floor tile as a straight square: the diamond's top face turned back into a square. */
function floorTexture(key) {
  if (flatCache.has(key)) return flatCache.get(key);
  const sp = sprite(key);
  if (!sp?.img?.width) return null;
  const { data, w, h } = pixelsOf(sp.img);
  let x0 = w, x1 = -1, y0 = h;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] > 128) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); }
  if (x1 < 0) return null;
  let yl = y0;
  for (let y = y0; y < h; y++) if (data[(y * w + x0) * 4 + 3] > 128) { yl = y; break; }
  const cx = (x0 + x1) / 2;
  const N = 128, out = document.createElement('canvas');
  out.width = N; out.height = N;
  const o = out.getContext('2d');
  // square (u, v) -> diamond: (0,0) top corner, (N,0) right corner, (0,N) left corner. Draw the art through the inverse,
  // zoomed in a touch so the dark outline is trimmed and neighbouring tiles meet cleanly
  const k = 1.08;
  const inv = new DOMMatrix([(x1 - cx) / N, (yl - y0) / N, (x0 - cx) / N, (yl - y0) / N, cx, y0]).inverse();
  o.setTransform(new DOMMatrix().translate(N / 2, N / 2).scale(k).translate(-N / 2, -N / 2).multiply(inv));
  o.drawImage(sp.img, 0, 0);
  flatCache.set(key, out);
  return out;
}
/** Draws a texture onto the parallelogram at origin with sides u and v (a hair bigger, so seams never show). */
function mapTexture(ctx, tex, [ox, oy], [ux, uy], [vx, vy]) {
  const e = 1.02;
  ctx.save();
  ctx.transform(ux * e / tex.width, uy * e / tex.width, vx * e / tex.height, vy * e / tex.height, ox - (ux + vx) * (e - 1) / 2, oy - (uy + vy) * (e - 1) / 2);
  ctx.drawImage(tex, 0, 0);
  ctx.restore();
}
const iso = (x, y) => ({ x: (x - y) * TW / 2, y: (x + y) * TH / 2 });
const shade = (hex, k) => {
  const n = parseInt(hex.slice(1), 16);
  const c = i => Math.max(0, Math.min(255, Math.round(((n >> i) & 255) * k)));
  return `rgb(${c(16)},${c(8)},${c(0)})`;
};

export class HouseEditor {
  constructor({ game, building, hero, onClose, hint, onCraft, onEnchant }) {
    Object.assign(this, { game: game, b: building, hero, onClose, hint, onCraft, onEnchant });
    this.floor = 0;
    this.mode = 'use';
    this.tool = null;          // { type, rot } while placing, { move: item, rot } while moving
    this.hover = null;         // tile under the pointer
    this.hoverItem = null;
    this.selected = null;
    this.cat = 'storage';
    this.cam = { x: 0, y: 0, zoom: 1 };
    this.time = 0;
    interiorOf(building);
    this.build();
    this.fit();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  get shape() { return houseShape(this.b); }
  get items() { return interiorOf(this.b).floors[this.floor].items; }

  build() {
    const def = BUILDINGS[this.b.type];
    this.canvas = h('canvas.house-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.label = h('div.house-floor');
    this.designRow = h('div.house-designs');
    // the house opens ready to live in; building tools stay tucked away behind a small Edit button
    this.modeBtns = h('div.house-modes',
      h('button.btn.sm', { dataset: { mode: 'arrange' }, onclick: () => this.setMode('arrange') }, uiIcon('ui/move'), 'Arrange'),
      h('button.btn.sm', { dataset: { mode: 'remove' }, title: 'Click things to remove them (Delete key works too)', onclick: () => this.setMode('remove') }, uiIcon('ui/remove'), 'Remove'),
      h('button.btn.sm.good', { dataset: { mode: 'use' }, title: 'Stop editing', onclick: () => this.setMode('use') }, 'Done'));
    this.editBtn = h('button.btn.sm.house-edit-btn', { title: 'Edit your house: arrange, remove and add furniture', onclick: () => this.setMode('arrange') }, uiIcon('ui/move'), 'Edit');
    this.palette = h('div.house-palette');
    this.tabs = h('div.house-tabs');
    this.search = h('input.house-search', { type: 'search', placeholder: 'Search furniture, floors, walls...',
      oninput: e => { this.query = e.target.value; this.renderPalette(); } });
    this.panel = h('div.card.house-panel', { hidden: true });
    this.toolBar = h('div.card.house-toolbar', { hidden: true },
      h('span.house-tool-name'),
      h('button.btn.sm', { title: 'Rotate / mirror (R)', onclick: () => this.rotate() }, uiIcon('ui/rotate') || '⟳ ', 'Rotate (R)'),
      h('button.btn.sm', { onclick: () => this.cancelTool() }, 'Done'));
    this.el = h('div.house-view',
      this.canvas,
      h('div.card.house-top',
        h('div.house-title', def?.name || 'Home'), this.label, h('div.house-builder', `Built by ${builderOf(this.game, this.b)}`), this.modeBtns, this.designRow,
        h('button.btn.sm.primary', { onclick: () => this.close() }, uiIcon('ui/home'), 'Leave house')),
      this.panel, this.toolBar, this.editBtn,
      h('div.card.house-bottom', h('div.house-tabrow', this.search, this.tabs), this.palette));
    this.el.classList.toggle('editing', this.mode !== 'use');
    document.getElementById('ui').append(this.el);
    this.onResize = () => this.resize();
    window.addEventListener('resize', this.onResize);
    this.resize();

    // pointer: hover names, click to use / place / select, drag to look around, wheel to zoom
    let down = null;
    this.canvas.addEventListener('pointerdown', e => {
      down = { x: e.clientX, y: e.clientY, cx: this.cam.x, cy: this.cam.y, moved: false, paint: !!this.tool?.floor && e.button === 0 };
      this.canvas.setPointerCapture?.(e.pointerId);
      if (down.paint) { this.pointer(e.clientX, e.clientY); this.paintFloor(); }
    });
    this.canvas.addEventListener('pointermove', e => {
      this.pointer(e.clientX, e.clientY);
      if (!down) return;
      if (down.paint) { this.paintFloor(); return; }
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (Math.hypot(dx, dy) > 6) down.moved = true;
      if (down.moved) { this.cam.x = down.cx - dx / this.cam.zoom; this.cam.y = down.cy - dy / this.cam.zoom; }
    });
    this.canvas.addEventListener('pointerup', e => { const d = down; down = null; if (d?.paint) { this._paintWarned = false; return; } if (d && !d.moved) { this.pointer(e.clientX, e.clientY); this.click(); } });
    this.canvas.addEventListener('contextmenu', e => { e.preventDefault(); if (this.tool) this.cancelTool(); });
    this.canvas.addEventListener('wheel', e => { e.preventDefault(); this.cam.zoom = Math.max(0.5, Math.min(2.5, this.cam.zoom * (e.deltaY < 0 ? 1.1 : 0.9))); }, { passive: false });
    this.onKey = e => {
      const k = e.key.toLowerCase();
      if (e.target === this.search) { if (k === 'escape') { e.stopPropagation(); this.search.value = ''; this.query = ''; this.search.blur(); this.renderPalette(); } return; }
      if (k === 'escape') { e.stopPropagation(); if (this.tool) this.cancelTool(); else if (this.selected) this.select(null); else this.close(); }
      if (k === 'r') this.rotate();
      if (k === 'delete' || k === 'backspace') { e.preventDefault(); this.removeItem(this.selected || this.hoverItem); }
    };
    window.addEventListener('keydown', this.onKey, true);
    this.refreshUI();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    this.dpr = dpr;
    this.canvas.width = Math.round(innerWidth * dpr);
    this.canvas.height = Math.round(innerHeight * dpr);
  }

  /** Zoom and centre so the whole room fits. */
  fit() {
    const { w, d } = this.shape;
    const c = iso(w / 2, d / 2);
    const width = (w + d) * TW / 2, height = (w + d) * TH / 2 + WALL_H;
    this.cam = { x: c.x, y: c.y - WALL_H / 3, zoom: Math.max(0.5, Math.min(1.8, Math.min(innerWidth * 0.9 / width, innerHeight * 0.55 / height))) };
  }

  setMode(mode) { this.mode = mode; this.cancelTool(); this.select(null); this.refreshUI(); }

  // ------------------------------------------------------------ UI
  refreshUI() {
    this.updateToolBar?.();
    const { floors } = this.shape;
    this.label.textContent = floors > 1 ? `Floor ${this.floor + 1} of ${floors}` : 'Ground floor';
    [...this.modeBtns.children].forEach(btn => btn.classList.toggle('active', btn.dataset.mode === this.mode && this.mode !== 'use'));
    this.el?.classList.toggle('editing', this.mode !== 'use');
    this.designRow.replaceChildren(h('span.faint', 'Outside:'), ...DESIGNS.map((d, i) => h('button.house-design' + ((this.b.design || 0) === i ? '.active' : ''), {
      title: d.name, style: { background: d.tint || '#c8a878' }, onclick: () => { this.b.design = i; this.game.emit('change'); this.refreshUI(); this.hint?.(`Outside look: ${d.name}`, 1500); },
    })));
    const TAB_ICONS = { storage: 'ui/storage', floors: 'ui/floors', walls: 'ui/wallpaper', stairs: 'ui/stairs' };
    this.tabs.replaceChildren(...FURNITURE_CATS.map(([id, name]) => h('button.house-tab' + (this.cat === id ? '.active' : ''), { onclick: () => { this.cat = id; this.query = ''; this.search.value = ''; this.refreshUI(); } }, TAB_ICONS[id] ? uiIcon(TAB_ICONS[id]) : null, name)));
    this.renderPalette();
  }

  /** The pieces to choose from: one category, or everything that matches the search. */
  renderPalette() {
    const res = this.game.state.resources;
    const afford = cost => Object.entries(cost).every(([k, n]) => (res[k] || 0) >= n);
    const free = cost => (Object.keys(cost).length ? costChips(cost, res) : h('span.faint', 'free'));
    const floorBtn = (key, f) => h('button.house-piece' + (this.tool?.floor === key ? '.active' : '') + (afford(f.cost) ? '' : '.lack'), {
      title: `${f.name}: click or drag over the floor to lay it`,
      onclick: () => { this.tool = { floor: key }; this.select(null); this.refreshUI(); this.hint?.('Click or drag over the floor to lay it. Right-click or Esc stops.', 2500); },
    }, spriteAvailable(`interior/floor_${key}`) ? icon(`interior/floor_${key}`, 34) : h('div.house-swatch.floor-swatch', { style: { background: `linear-gradient(135deg, ${f.a} 50%, ${f.b} 50%)` } }),
    h('div.house-piece-name', f.name), h('div.house-piece-cost', free(f.cost)));
    const cur = interiorOf(this.b).floors[this.floor].wall || 'plaster';
    const wallBtn = (key, w) => h('button.house-piece' + (cur === key ? '.active' : '') + (afford(w.cost) ? '' : '.lack'), {
      title: `${w.name} on every wall of this floor`,
      onclick: () => { const r = setWallpaper(this.game, this.b, this.floor, key); if (!r.ok) this.hint?.(r.why, 1800); this.refreshUI(); },
    }, spriteAvailable(`interior/wall_${key}`) ? icon(`interior/wall_${key}`, 34) : h('div.house-swatch', { style: { background: w.color || DESIGNS[this.b.design || 0].tint || '#c8a878' } }),
    h('div.house-piece-name', w.name), h('div.house-piece-cost', free(w.cost)));
    const pieceBtn = (type, f) => {
      const locked = f.era && (this.game.state.era || 0) < f.era;
      return h('button.house-piece' + (this.tool?.type === type ? '.active' : '') + (afford(f.cost) && !locked ? '' : '.lack'), {
        title: locked ? 'Not in this era yet' : f.storage ? `+${f.storage} storage, holds ${f.slots} stacks` : f.name,
        onclick: () => { if (locked) return; this.tool = { type, rot: 0 }; this.select(null); this.refreshUI(); this.hint?.('Click a spot to place it. Rotate with R or the Rotate button.', 2500); },
      }, pieceIcon(type, f), h('div.house-piece-name', f.name), h('div.house-piece-cost', costChips(f.cost, res)));
    };
    const q = (this.query || '').trim().toLowerCase();
    if (q) {
      const hit = (name, cat) => name.toLowerCase().includes(q) || (cat || '').toLowerCase().includes(q);
      const catName = id => FURNITURE_CATS.find(c => c[0] === id)?.[1] || '';
      const list = [
        ...Object.entries(FURNITURE).filter(([, f]) => hit(f.name, catName(f.cat))).map(([t, f]) => pieceBtn(t, f)),
        ...Object.entries(FLOORINGS).filter(([, f]) => hit(f.name, 'floor')).map(([k, f]) => floorBtn(k, f)),
        ...Object.entries(WALLPAPERS).filter(([, w]) => hit(w.name, 'wallpaper wall')).map(([k, w]) => wallBtn(k, w)),
      ];
      this.palette.replaceChildren(...(list.length ? list : [h('div.faint.house-empty', `Nothing called "${this.query}"`)]));
      return;
    }
    if (this.cat === 'floors') { this.palette.replaceChildren(...Object.entries(FLOORINGS).map(([k, f]) => floorBtn(k, f))); return; }
    if (this.cat === 'walls') { this.palette.replaceChildren(...Object.entries(WALLPAPERS).map(([k, w]) => wallBtn(k, w))); return; }
    this.palette.replaceChildren(...Object.entries(FURNITURE).filter(([, f]) => f.cat === this.cat).map(([t, f]) => pieceBtn(t, f)));
  }

  select(it) {
    this.selected = it;
    if (!it) { this.panel.hidden = true; return; }
    const def = FURNITURE[it.type] || LANDING;
    this.panel.hidden = false;
    this.panel.replaceChildren(
      h('b', def.name),
      it.type === 'landing' ? h('div.faint', 'Move or remove the stairs from the floor below.') : h('div.row',
        h('button.btn.sm', { onclick: () => { this.tool = { move: it, rot: it.rot }; this.panel.hidden = true; this.updateToolBar(); } }, 'Move'),
        h('button.btn.sm', { onclick: () => { const r = moveFurniture(this.game, this.b, this.floor, it, it.x, it.y, it.rot ? 0 : 1); if (!r.ok) this.hint?.(r.why === 'Something is in the way' ? 'No room to rotate it here' : r.why, 2000); } }, '⟳ Rotate'),
        h('button.btn.sm.danger', { onclick: () => this.removeItem(it) }, 'Remove')));
  }

  /** Where the piece in hand goes: centred on the tile under the pointer. */
  toolSpot() {
    const def = FURNITURE[this.tool.move?.type || this.tool.type];
    const w = this.tool.rot ? def.d : def.w, d = this.tool.rot ? def.w : def.d;
    return { x: this.hover.x - Math.floor((w - 1) / 2), y: this.hover.y - Math.floor((d - 1) / 2) };
  }

  cancelTool() { this.tool = null; this.refreshUI(); }

  /** The Rotate / Done bar while you place or move something. */
  updateToolBar() {
    const t = this.tool;
    const show = !!t && !t.floor;
    this.toolBar.hidden = !show;
    if (show) this.toolBar.firstChild.textContent = t.move ? `Moving ${FURNITURE[t.move.type]?.name}` : `Placing ${FURNITURE[t.type]?.name}`;
  }

  paintFloor() {
    if (!this.hover || !this.tool?.floor) return;
    const r = setFloorTile(this.game, this.b, this.floor, this.hover.x, this.hover.y, this.tool.floor);
    if (!r.ok && !this._paintWarned) { this._paintWarned = true; this.hint?.(r.why, 1500); }
  }
  rotate() {
    if (this.tool && !this.tool.floor) { this.tool.rot = this.tool.rot ? 0 : 1; return; }
    const it = this.selected || this.hoverItem;   // R over a placed piece turns it where it stands
    if (it && it.type !== 'landing') { const r = moveFurniture(this.game, this.b, this.floor, it, it.x, it.y, it.rot ? 0 : 1); if (!r.ok) this.hint?.(r.why === 'Something is in the way' ? 'No room to rotate it here' : r.why, 1800); }
  }

  // ------------------------------------------------------------ input
  /** Screen point → floor tile (and the piece on it). Pieces are found by their drawn box too. */
  pointer(cx, cy) {
    const sx = (cx - innerWidth / 2) / this.cam.zoom + this.cam.x;
    const sy = (cy - innerHeight / 2) / this.cam.zoom + this.cam.y;
    const u = sx / (TW / 2), v = sy / (TH / 2);
    const tx = Math.floor((u + v) / 2), ty = Math.floor((v - u) / 2);
    const { w, d } = this.shape;
    this.hover = tx >= 0 && ty >= 0 && tx < w && ty < d ? { x: tx, y: ty } : null;
    this.hoverItem = this.tool ? null : this.pickItem(sx, sy);
    this.hoverTile = !this.hoverItem && this.hover && !this.tool ? this.hover : null;
    this.canvas.style.cursor = this.hoverItem || this.tool ? 'pointer' : 'grab';
  }

  pickItem(sx, sy) {
    // front-most first: a tall wardrobe in front covers what is behind it
    const list = [...this.items].sort((a, b) => depth(b) - depth(a));
    for (const it of list) {
      const box = boxOf(it);
      const top = iso(box.x, box.y).y - box.h, bottom = iso(box.x + box.w, box.y + box.d).y;
      const left = iso(box.x, box.y + box.d).x, right = iso(box.x + box.w, box.y).x;
      if (sx >= left && sx <= right && sy >= top && sy <= bottom) {
        // inside the bounding box: accept if over the footprint or the raised part above it
        const u = sx / (TW / 2);
        for (let z = 0; z <= box.h; z += 4) {
          const v = (sy + z) / (TH / 2);
          const fx = (u + v) / 2, fy = (v - u) / 2;
          if (fx >= box.x && fy >= box.y && fx < box.x + box.w && fy < box.y + box.d) return it;
        }
      }
    }
    return this.hover ? itemAt(this.b, this.floor, this.hover.x, this.hover.y) : null;
  }

  click() {
    const g = this.game;
    if (this.tool?.move) {
      if (!this.hover) return;
      const at = this.toolSpot();
      const r = moveFurniture(g, this.b, this.floor, this.tool.move, at.x, at.y, this.tool.rot);
      if (!r.ok) { this.hint?.(r.why, 1800); return; }
      this.tool = null;
      this.updateToolBar();
      return;
    }
    if (this.tool?.floor) return;   // painted on pointer down
    if (this.tool) {
      if (!this.hover) return;
      const at = this.toolSpot();
      const r = placeFurniture(g, this.b, this.floor, this.tool.type, at.x, at.y, this.tool.rot);
      if (!r.ok) this.hint?.(r.why, 1800);
      this.refreshUI();
      return;
    }
    const it = this.hoverItem;
    if (!it) { this.select(null); return; }
    if (this.mode === 'arrange') { this.select(it); return; }
    if (this.mode === 'remove') { this.removeItem(it); return; }
    this.use(it);
  }

  /** Use mode: stairs go up, the landing goes down, storage opens, a bed sleeps through the night. */
  use(it) {
    if (BEDS.has(it.type)) this.sleep();
    else if (FURNITURE[it.type]?.station) { this.game.craftTableHere = true; this.onCraft?.(); }
    else if (FURNITURE[it.type]?.enchant) { this.game.enchantTableHere = true; this.onEnchant?.(); }
    else if (it.type === 'stairs') this.goFloor(this.floor + 1);
    else if (it.type === 'landing') this.goFloor(this.floor - 1);
    else if (it.store) this.openStorage(it);
    else this.select(it);   // anything else: Move / Rotate / Pick up
  }

  /** Sleep until morning: only in the evening or at night. You wake up fully healed. */
  sleep() {
    const g = this.game;
    const hour = g.hour;
    if (hour >= 5 && hour < 18) { this.hint?.('You can only sleep in the evening or at night (after 18:00)', 2200); return; }
    if (this.sleeping) return;
    this.sleeping = true;
    const fade = h('div.house-sleep', h('div', 'Zzz...'));
    this.el.append(fade);
    setTimeout(() => {
      const s = g.state;
      const day = Math.floor(s.time / DAY_LENGTH) + (hour >= 18 ? 1 : 0);
      s.time = day * DAY_LENGTH + DAY_LENGTH * 6 / 24;   // 06:00
      const v = s.villagers.find(x => x.id === g.hero?.id);
      if (v) { v.hp = g.hero.maxHp || v.hp; g.hero.stamina = g.hero.maxStamina || g.hero.stamina; }
      g.emit?.('change');
      this.hint?.('You slept until morning and feel rested', 2200);
    }, 700);
    setTimeout(() => { fade.remove(); this.sleeping = false; }, 1600);
  }

  /** Take a piece away (full refund; what it held goes back to you). */
  removeItem(it) {
    if (!it) return;
    if (it.type === 'landing') { this.hint?.('Remove the stairs from the floor below', 1800); return; }
    const box = boxOf(it), c = iso(box.x + box.w / 2, box.y + box.d / 2);
    const r = removeFurniture(this.game, this.b, this.floor, it, this.hero);
    if (!r.ok) { this.hint?.(r.why, 1800); return; }
    (this.poofs ||= []).push({ x: c.x, y: c.y - box.h / 2, t: 0 });
    if (this.selected === it) this.select(null);
    this.hoverItem = null;
    this.refreshUI();
  }

  goFloor(f) {
    if (f < 0 || f >= interiorOf(this.b).floors.length) return;
    this.floor = f;
    this.select(null);
    this.hoverItem = null;
    this.refreshUI();
  }

  /**
   * Storage like Minecraft: the chest's slots on top, what you carry below. Click a slot (or drag it to the other
   * grid) to move the whole stack across. Hover a slot to see what it is.
   */
  openStorage(it) {
    const def = FURNITURE[it.type];
    const g = this.game, hero = this.hero;
    const COLS = 9;
    let m, dragging = null;
    const info = h('div.inv-info', 'Click a slot or drag it to the other side to move it');
    const move = stack => {
      const r = stack.side === 'chest'
        ? (stack.gear ? takeGear(g, it, stack.gear.id) : stack.tool ? takeTool(g, it, stack.tool) : takeItem(g, it, hero, stack.key, stack.count))
        : (stack.gear ? storeGear(g, it, stack.gear.id) : stack.tool ? storeTool(g, it, stack.tool) : storeItem(g, it, hero, stack.key, stack.count));
      if (r && !r.ok) this.hint?.(r.why, 1800);
      render();
    };
    const cell = (stack, side) => {
      if (!stack) {
        return h('div.inv-slot.empty', {
          ondragover: e => { if (dragging && dragging.side !== side) e.preventDefault(); },
          ondrop: e => { e.preventDefault(); if (dragging && dragging.side !== side) move(dragging); dragging = null; },
        });
      }
      stack.side = side;
      const color = stack.gear ? RARITY[stack.gear.rarity]?.color : null;
      const name = stack.gear ? stack.gear.name : stack.tool ? TOOLS[stack.tool]?.name || stack.tool : itemLabel(stack.key);
      return h('button.inv-slot', {
        draggable: true, title: `${name}${stack.count > 1 ? ` ×${stack.count}` : ''}`, style: color ? { borderColor: color, boxShadow: `inset 0 0 10px ${color}44` } : null,
        onclick: () => move(stack),
        onmouseenter: () => { info.textContent = `${name}${stack.count > 1 ? ` ×${stack.count}` : ''} · click to ${side === 'chest' ? 'take' : 'store'}`; },
        ondragstart: e => { dragging = stack; e.dataTransfer?.setData('text/plain', name); },
        ondragend: () => { dragging = null; },
        ondragover: e => { if (dragging && dragging.side !== side) e.preventDefault(); },
        ondrop: e => { e.preventDefault(); if (dragging && dragging.side !== side) move(dragging); dragging = null; },
      }, icon(stack.gear ? gearIconKey(stack.gear) || 'items/relic' : stack.tool ? (hasArt(TOOLS[stack.tool]?.icon) ? TOOLS[stack.tool].icon : TOOLS[stack.tool]?.fallbackIcon || 'items/relic') : ITEMS[stack.key]?.icon || 'items/relic', 30), stack.count > 1 ? h('span.inv-count', stack.count) : null);
    };
    const grid = (stacks, size, side) => {
      const n = Math.max(size, stacks.length);
      return h('div.inv-grid', {
        ondragover: e => { if (dragging && dragging.side !== side) e.preventDefault(); },
        ondrop: e => { e.preventDefault(); if (dragging && dragging.side !== side) move(dragging); dragging = null; },
      }, Array.from({ length: n }, (_, i) => cell(stacks[i], side)));
    };
    const render = () => {
      const toolStacks = obj => Object.entries(obj || {}).flatMap(([k, n]) => (TOOLS[k] ? Array.from({ length: n }, () => ({ tool: k, count: 1 })) : []));   // tools do not stack
      const chest = [...Object.entries(it.store.items).map(([key, count]) => ({ key, count })), ...it.store.gear.map(gear => ({ gear, count: 1 })), ...toolStacks(it.store.tools)];
      const mine = [...Object.entries(hero?.inv?.pack || {}).filter(([k, n]) => n > 0 && ITEMS[k]).map(([key, count]) => ({ key, count })), ...(g.state.rpg?.bag || []).map(gear => ({ gear, count: 1 })), ...toolStacks(toolsOf(g))];
      const all = (list, fn) => () => { for (const st of list) { const r = fn(st); if (r && !r.ok) { this.hint?.(r.why, 1800); break; } } render(); };
      m.el.replaceChildren(m.closeBtn,
        h('div.inv-head', h('h2', def.name), h('span.faint', `${slotsLeft(it)} of ${def.slots} slots free · +${def.storage} storage`), h('div.spacer'),
          h('button.btn.sm', { disabled: !chest.length, onclick: all(chest, st => (st.gear ? takeGear(g, it, st.gear.id) : st.tool ? takeTool(g, it, st.tool) : takeItem(g, it, hero, st.key, st.count))) }, 'Take all')),
        grid(chest, def.slots, 'chest'),
        h('div.inv-head', h('b', 'Inventory'), h('div.spacer'),
          h('button.btn.sm', { disabled: !mine.length, onclick: all(mine.filter(st => !st.tool), st => (st.gear ? storeGear(g, it, st.gear.id) : storeItem(g, it, hero, st.key, st.count))) }, 'Store all')),
        grid(mine, COLS * 3, 'inv'),
        info);
    };
    m = modal([], { onClose: () => {}, cls: 'store-modal' });
    render();
    this.storage = m;
  }

  close() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKey, true);
    this.storage?.close?.();
    this.el.remove();
    this.closed = true;
    this.game.craftTableHere = false;
    this.game.enchantTableHere = false;
    this.onClose?.();
  }

  // ------------------------------------------------------------ drawing
  loop(now) {
    if (this.closed) return;
    const dt = Math.min(0.1, (now - (this.last || now)) / 1000);
    this.last = now;
    this.render(dt);
    this.raf = requestAnimationFrame(this.loop);
  }

  render(dt = 0.016) {
    this.time += dt;
    const { ctx, canvas } = this;
    const dpr = this.dpr || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bg.addColorStop(0, '#1b1426'); bg.addColorStop(1, '#0c0912');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const z = this.cam.zoom * dpr;
    ctx.setTransform(z, 0, 0, z, canvas.width / 2 - this.cam.x * z, canvas.height / 2 - this.cam.y * z);
    ctx.imageSmoothingEnabled = true;
    this.drawRoom();
    // ghost of the piece being placed or moved
    const spot = this.tool && !this.tool.floor && this.hover ? this.toolSpot() : null;
    const ghost = spot ? { type: this.tool.move?.type || this.tool.type, x: spot.x, y: spot.y, rot: this.tool.rot, ghost: true } : null;
    const list = [...this.items];
    if (ghost) list.push(ghost);
    // rugs first, then everything by depth
    const flat = it => (FURNITURE[it.type]?.flat || it.type === 'landing' ? 1 : 0);
    list.sort((a, b) => flat(b) - flat(a) || depth(a) - depth(b));
    for (const it of list) {
      if (this.tool?.move === it) continue;
      let alpha = 1, ok = true;
      if (it.ghost) {
        ok = this.tool.move ? canPlace(this.game, this.b, this.floor, it.type, it.x, it.y, it.rot, this.tool.move).ok : canPlace(this.game, this.b, this.floor, it.type, it.x, it.y, it.rot).ok;
        alpha = 0.7;
      }
      if (it.ghost) { this.drawFootprint(it, ok ? 'rgba(111,224,122,0.45)' : 'rgba(255,90,90,0.5)'); this.drawPiece(it, ok ? 0.75 : 0.45, spriteAvailable(`interior/${it.type}`) ? null : ok ? '#6fe07a' : '#ff5a5a'); continue; }
      this.drawPiece(it, alpha, null);
    }
    const focus = this.selected || this.hoverItem;
    if (focus && this.items.includes(focus)) this.drawFocus(focus);
    for (const p of this.poofs || []) {   // a puff of dust where something was removed
      p.t += dt;
      const k = p.t / 0.4;
      ctx.fillStyle = `rgba(230,220,200,${Math.max(0, 0.6 * (1 - k))})`;
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; ctx.beginPath(); ctx.arc(p.x + Math.cos(a) * 18 * k, p.y + Math.sin(a) * 9 * k, 7 * (1 - k * 0.5), 0, Math.PI * 2); ctx.fill(); }
    }
    if (this.poofs?.length) this.poofs = this.poofs.filter(p => p.t < 0.4);
  }

  drawRoom() {
    const { ctx } = this;
    const { w, d } = this.shape;
    const design = DESIGNS[this.b.design || 0];
    const paper = WALLPAPERS[interiorOf(this.b).floors[this.floor].wall || 'plaster'];
    const wall = paper.color || design.tint || '#c8a878';
    const P = (x, y, zz = 0) => { const p = iso(x, y); return [p.x, p.y - zz]; };
    const poly = (pts, fill) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); };
    // back walls (left along x = 0, right along y = 0)
    poly([P(0, 0), P(0, d), P(0, d, WALL_H), P(0, 0, WALL_H)], shade(wall, 0.62));
    poly([P(0, 0), P(w, 0), P(w, 0, WALL_H), P(0, 0, WALL_H)], shade(wall, 0.78));
    const artWall = this.wallPattern(paper, wall, w, d, P);
    // wooden wainscot, a trim line and a dark baseboard
    if (!artWall) poly([P(0, 0), P(0, d), P(0, d, 30), P(0, 0, 30)], 'rgba(60,35,20,0.45)');
    if (!artWall) poly([P(0, 0), P(w, 0), P(w, 0, 30), P(0, 0, 30)], 'rgba(60,35,20,0.35)');
    if (!artWall) poly([P(0, 0), P(0, d), P(0, d, 32), P(0, 0, 32)].map(([x, y], i) => [x, i < 2 ? y - 30 : y]), 'rgba(255,240,210,0.25)');
    if (!artWall) poly([P(0, 0), P(w, 0), P(w, 0, 32), P(0, 0, 32)].map(([x, y], i) => [x, i < 2 ? y - 30 : y]), 'rgba(255,240,210,0.2)');
    poly([P(0, 0), P(0, d), P(0, d, 5), P(0, 0, 5)], 'rgba(30,18,10,0.55)');
    poly([P(0, 0), P(w, 0), P(w, 0, 5), P(0, 0, 5)], 'rgba(30,18,10,0.5)');
    // windows
    if (!artWall) for (let i = 2; i < w - 1; i += 4) poly([P(i, 0, 48), P(i + 1.2, 0, 48), P(i + 1.2, 0, 80), P(i, 0, 80)], this.floor ? '#6a8ac8' : '#8ab8e8');
    if (!artWall) for (let i = 2; i < d - 1; i += 4) poly([P(0, i, 48), P(0, i + 1.2, 48), P(0, i + 1.2, 80), P(0, i, 80)], '#7aa4d8');
    // floor boards
    for (let y = 0; y < d; y++) for (let x = 0; x < w; x++) {
      const key = floorTileAt(this.b, this.floor, x, y);
      const fl = FLOORINGS[key] || FLOORINGS.planks;
      const art = `interior/floor_${key}`;
      const tex = spriteAvailable(art) ? floorTexture(art) : null;
      if (tex) {
        const o = P(x, y), a = P(x + 1, y), b = P(x, y + 1);
        mapTexture(ctx, tex, o, [a[0] - o[0], a[1] - o[1]], [b[0] - o[0], b[1] - o[1]]);
      } else {
        poly([P(x, y), P(x + 1, y), P(x + 1, y + 1), P(x, y + 1)], (x + y) % 2 ? fl.b : fl.a);
        if (key.startsWith('carpet')) poly([P(x + 0.15, y + 0.15), P(x + 0.85, y + 0.15), P(x + 0.85, y + 0.85), P(x + 0.15, y + 0.85)], shade(fl.a, 1.15));
      }
    }
    if (false && this.hoverTile) {   // floor tile names on hover: switched off
      const { x, y } = this.hoverTile;
      const name = (FLOORINGS[floorTileAt(this.b, this.floor, x, y)] || FLOORINGS.planks).name;
      ctx.strokeStyle = 'rgba(255,215,106,0.7)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); [P(x, y + 1), P(x + 1, y + 1), P(x + 1, y)].forEach(([a, b2], i) => (i ? ctx.lineTo(a, b2) : ctx.moveTo(a, b2))); ctx.stroke();
      const c = iso(x + 0.5, y + 0.5);
      ctx.font = '11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,215,106,0.85)';
      ctx.fillText(name, c.x, c.y + 4);
    }
    ctx.strokeStyle = 'rgba(40,25,15,0.25)'; ctx.lineWidth = 1;
    if (!spriteAvailable('interior/floor_planks')) for (let x = 0; x <= w; x++) { ctx.beginPath(); ctx.moveTo(...P(x, 0)); ctx.lineTo(...P(x, d)); ctx.stroke(); }
    // the floor slab and the cut-away walls: thick, with a light cap on top and dark ends
    const T = 0.3, SLAB = 12;
    poly([P(-T, d), P(w, d), P(w, d, -SLAB), P(-T, d, -SLAB)], '#4a3020');
    poly([P(w, -T), P(w, d), P(w, d, -SLAB), P(w, -T, -SLAB)], '#5a3a26');
    poly([P(0, d), P(-T, d), P(-T, d, WALL_H), P(0, d, WALL_H)], shade(wall, 0.45));          // end of the left wall
    poly([P(w, 0), P(w, -T), P(w, -T, WALL_H), P(w, 0, WALL_H)], shade(wall, 0.5));           // end of the right wall
    poly([P(0, 0, WALL_H), P(w, 0, WALL_H), P(w, -T, WALL_H), P(-T, -T, WALL_H), P(-T, d, WALL_H), P(0, d, WALL_H)], shade(wall, 1.25));   // wall tops
    ctx.save();
    ctx.strokeStyle = '#1a1420'; ctx.lineWidth = 2; ctx.lineJoin = 'round';
    ctx.beginPath();
    [P(-T, d, -SLAB), P(w, d, -SLAB), P(w, -T, -SLAB), P(w, -T, WALL_H), P(-T, -T, WALL_H), P(-T, d, WALL_H)].forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath(); ctx.stroke();
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(26,20,32,0.6)';
    for (const [a, b] of [[P(0, d, WALL_H), P(0, d, 0)], [P(w, 0, WALL_H), P(w, 0, 0)], [P(0, 0, WALL_H), P(0, 0, 0)], [P(0, d), P(w, d)], [P(w, d), P(w, 0)]]) { ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke(); }
    ctx.restore();
    // hovered tile while placing
    if (this.tool && this.hover) {
      const { x, y } = this.hover;
      if (this.tool.floor) ctx.fillStyle = 'rgba(255,215,106,0.18)';
      ctx.strokeStyle = 'rgba(255,215,106,0.8)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); [P(x, y), P(x + 1, y), P(x + 1, y + 1), P(x, y + 1)].forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b))); ctx.closePath(); ctx.stroke();
    }
  }

  drawFootprint(it, fill) {
    const { ctx } = this;
    const b = boxOf(it);
    const pts = [iso(b.x, b.y), iso(b.x + b.w, b.y), iso(b.x + b.w, b.y + b.d), iso(b.x, b.y + b.d)];
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    ctx.strokeStyle = fill.replace(/[\d.]+\)$/, '1)'); ctx.lineWidth = 1.5; ctx.stroke();
  }

  drawPiece(it, alpha = 1, tint = null) {
    const { ctx } = this;
    const def = FURNITURE[it.type] || LANDING;
    const box = boxOf(it);
    ctx.save();
    ctx.globalAlpha = alpha;
    const key = `interior/${it.type}`;
    if (!tint && spriteAvailable(key) && sprite(key)) {
      const s = sprite(key);
      // every piece has its real height (def.h); flat things (rugs, the stair opening) fill their footprint.
      // Nothing is drawn wider than the floor it stands on.
      const maxW = (box.w + box.d) * TW / 2 * 0.95;
      const k = def.flat ? maxW / s.box.w : Math.min(box.h * 1.15 / s.box.h, maxW / s.box.w);
      const width = s.box.w * k, hgt = s.box.h * k;
      const base = iso(box.x + box.w, box.y + box.d);
      const cxp = (iso(box.x + box.w, box.y).x + iso(box.x, box.y + box.d).x) / 2;
      // hovered: the piece lifts a little and gets a white outline
      const hovered = !it.ghost && (it === this.hoverItem || it === this.selected);
      it._lift = (it._lift || 0) + ((hovered ? 7 : 0) - (it._lift || 0)) * 0.25;
      const lift = it._lift;
      if (lift > 0.3 && !def.flat) {   // its shadow stays on the floor
        ctx.fillStyle = `rgba(0,0,0,${0.25 * lift / 7})`;
        ctx.beginPath(); ctx.ellipse(cxp, base.y - TH * 0.35, width * 0.35, TH * 0.28, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.translate(cxp, base.y - lift);
      if (it.rot) ctx.scale(-1, 1);
      if (lift > 0.3) {
        const white = silhouette(s.img);
        ctx.globalAlpha = alpha * Math.min(1, lift / 5);
        for (const [ox, oy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) ctx.drawImage(white, s.box.x, s.box.y, s.box.w, s.box.h, -width / 2 + ox, -hgt + TH * 0.12 + oy, width, hgt);
        ctx.globalAlpha = alpha;
      }
      ctx.drawImage(s.img, s.box.x, s.box.y, s.box.w, s.box.h, -width / 2, -hgt + TH * 0.12, width, hgt);
      if (lift > 0.3) {   // and brightens a touch
        ctx.globalAlpha = alpha * 0.18 * lift / 7;
        ctx.drawImage(silhouette(s.img), s.box.x, s.box.y, s.box.w, s.box.h, -width / 2, -hgt + TH * 0.12, width, hgt);
      }
      ctx.restore();
      return;
    }
    const color = tint || def.color;
    const P = (x, y, zz = 0) => { const p = iso(x, y); return [p.x, p.y - zz]; };
    const poly = (pts, fill) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); };
    const { x, y, w, d, h } = box;
    if (it.type === 'stairs') {   // steps rising towards the back
      const steps = 6;
      for (let i = 0; i < steps; i++) {
        const along = it.rot ? [x + w - (i + 1) * w / steps, y, w / steps, d] : [x, y + d - (i + 1) * d / steps, w, d / steps];
        const [sx, sy, sw, sd] = along, top = (i + 1) * h / steps;
        poly([P(sx, sy + sd), P(sx + sw, sy + sd), P(sx + sw, sy + sd, top), P(sx, sy + sd, top)], shade(color, 0.8));
        poly([P(sx + sw, sy), P(sx + sw, sy + sd), P(sx + sw, sy + sd, top), P(sx + sw, sy, top)], shade(color, 0.62));
        poly([P(sx, sy, top), P(sx + sw, sy, top), P(sx + sw, sy + sd, top), P(sx, sy + sd, top)], shade(color, 1.1));
      }
    } else if (it.type === 'landing') {   // the top of the stairs: an opening with a rail
      poly([P(x, y), P(x + w, y), P(x + w, y + d), P(x, y + d)], '#1a120c');
      poly([P(x + 0.1, y + 0.1), P(x + w - 0.1, y + 0.1), P(x + w - 0.1, y + d * 0.35), P(x + 0.1, y + d * 0.35)], shade(def.color, 0.9));
      ctx.strokeStyle = '#c8a070'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(...P(x, y + d, 18)); ctx.lineTo(...P(x, y, 18)); ctx.lineTo(...P(x + w, y, 18)); ctx.stroke();
      for (const [a, b] of [[x, y + d], [x, y], [x + w, y]]) { ctx.beginPath(); ctx.moveTo(...P(a, b)); ctx.lineTo(...P(a, b, 18)); ctx.stroke(); }
    } else if (def.flat) {
      if (it.type === 'round_rug') {
        const c = iso(x + w / 2, y + d / 2);
        ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(c.x, c.y, w * TW / 2 * 0.9, d * TH / 2 * 0.9, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = shade(color, 1.4); ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(c.x, c.y, w * TW / 2 * 0.65, d * TH / 2 * 0.65, 0, 0, Math.PI * 2); ctx.stroke();
      } else {
        poly([P(x + 0.1, y + 0.1), P(x + w - 0.1, y + 0.1), P(x + w - 0.1, y + d - 0.1), P(x + 0.1, y + d - 0.1)], color);
        poly([P(x + 0.35, y + 0.35), P(x + w - 0.35, y + 0.35), P(x + w - 0.35, y + d - 0.35), P(x + 0.35, y + d - 0.35)], shade(color, 1.3));
      }
    } else {
      const inset = 0.08;
      const [x0, y0, x1, y1] = [x + inset, y + inset, x + w - inset, y + d - inset];
      poly([P(x0, y1), P(x1, y1), P(x1, y1, h), P(x0, y1, h)], shade(color, 0.82));      // front-left face
      poly([P(x1, y0), P(x1, y1), P(x1, y1, h), P(x1, y0, h)], shade(color, 0.64));      // front-right face
      poly([P(x0, y0, h), P(x1, y0, h), P(x1, y1, h), P(x0, y1, h)], shade(color, 1.12)); // top
      this.detail(it, def, { x0, y0, x1, y1, h }, P, poly);
    }
    ctx.restore();
  }

  /** Wallpaper patterns on both back walls (drawn when there is no wall art). */
  wallPattern(paper, color, w, d, P) {
    const { ctx } = this;
    const art = `interior/wall_${Object.keys(WALLPAPERS).find(k => WALLPAPERS[k] === paper)}`;
    const tex = spriteAvailable(art) ? wallTexture(art) : null;
    if (tex) {   // one straight panel per tile, stretched onto the exact wall
      for (let i = 0; i < w; i++) { const o = P(i, 0, WALL_H), a = P(i + 1, 0, WALL_H); mapTexture(ctx, tex, o, [a[0] - o[0], a[1] - o[1]], [0, WALL_H]); }
      for (let i = 0; i < d; i++) { const o = P(0, i + 1, WALL_H), a = P(0, i, WALL_H); mapTexture(ctx, tex, o, [a[0] - o[0], a[1] - o[1]], [0, WALL_H]); }
      return true;
    }
    ctx.save();
    ctx.strokeStyle = shade(color, 0.55); ctx.lineWidth = 1;
    const line = (a, b) => { ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke(); };
    const walls = [[(t, z) => P(t, 0, z), w], [(t, z) => P(0, t, z), d]];
    for (const [at, len] of walls) {
      if (paper.pattern === 'planks' || paper.pattern === 'logs') for (let z = 12; z < WALL_H; z += paper.pattern === 'logs' ? 14 : 10) line(at(0, z), at(len, z));
      if (paper.pattern === 'bricks' || paper.pattern === 'stones') {
        const row = paper.pattern === 'bricks' ? 8 : 14, step = paper.pattern === 'bricks' ? 0.5 : 0.8;
        for (let z = row, k = 0; z < WALL_H; z += row, k++) {
          line(at(0, z), at(len, z));
          for (let t = (k % 2) * step / 2; t < len; t += step) line(at(t, z - row), at(t, z));
        }
      }
      if (paper.pattern === 'stripes') { ctx.strokeStyle = shade(color, 1.25); ctx.lineWidth = 3; for (let t = 0.25; t < len; t += 0.5) line(at(t, 30), at(t, WALL_H)); ctx.lineWidth = 1; ctx.strokeStyle = shade(color, 0.55); }
      if (paper.pattern === 'damask') { ctx.fillStyle = 'rgba(255,215,106,0.35)'; for (let t = 0.5; t < len; t += 1) for (let z = 44; z < WALL_H; z += 26) { const [px, py] = at(t, z); ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill(); } }
    }
    ctx.restore();
  }

  /** Small touches that tell pieces apart without art. */
  detail(it, def, { x0, y0, x1, y1, h }, P, poly) {
    const { ctx } = this;
    if (def.block) {   // wall blocks: bricks, planks, stones, glass, an arch, a rail
      ctx.save();
      ctx.strokeStyle = shade(def.color, 0.55); ctx.lineWidth = 1;
      const line = (a, b) => { ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke(); };
      const rows = def.block === 'bricks' ? 8 : def.block === 'stones' ? 3 : def.block === 'planks' ? 6 : 0;
      for (let i = 1; i < rows; i++) { const z = h * i / rows; line(P(x0, y1, z), P(x1, y1, z)); line(P(x1, y1, z), P(x1, y0, z)); }
      if (def.block === 'glass') { ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; line(P(x0 + 0.2, y1, h * 0.3), P(x0 + 0.5, y1, h * 0.8)); }
      if (def.block === 'arch') { ctx.fillStyle = 'rgba(20,12,8,0.75)'; ctx.beginPath(); const [ax, ay] = P((x0 + x1) / 2, y1, 0); ctx.ellipse(ax, ay - h * 0.35, (x1 - x0) * TW * 0.22, h * 0.35, 0, Math.PI, 0); ctx.lineTo(ax + (x1 - x0) * TW * 0.22, ay); ctx.lineTo(ax - (x1 - x0) * TW * 0.22, ay); ctx.fill(); }
      if (def.block === 'pillar') { ctx.fillStyle = shade(def.color, 1.2); poly([P(x0 - 0.05, y0 - 0.05, h), P(x1 + 0.05, y0 - 0.05, h), P(x1 + 0.05, y1 + 0.05, h), P(x0 - 0.05, y1 + 0.05, h)], shade(def.color, 1.2)); }
      ctx.restore();
    }
    if (def.cat === 'storage') {   // iron bands
      ctx.strokeStyle = 'rgba(30,30,36,0.7)'; ctx.lineWidth = 1.5;
      for (const f of [0.35, 0.7]) {
        ctx.beginPath(); ctx.moveTo(...P(x0, y1, h * f)); ctx.lineTo(...P(x1, y1, h * f)); ctx.lineTo(...P(x1, y0, h * f)); ctx.stroke();
      }
      const m = iso((x0 + x1) / 2, y1);
      ctx.fillStyle = '#ffcf5a'; ctx.fillRect(m.x - 2, m.y - h * 0.55, 4, 4);
    }
    if (it.type === 'bed' || it.type === 'double_bed') {
      poly([P(x0, y0, h + 1), P(x1, y0, h + 1), P(x1, y0 + 0.45, h + 1), P(x0, y0 + 0.45, h + 1)], '#f4f0e8');
    }
    if (it.type === 'plant' || it.type === 'flowers') {
      const c = iso((x0 + x1) / 2, (y0 + y1) / 2);
      ctx.fillStyle = it.type === 'plant' ? '#3f8a3a' : '#ff8ab8';
      ctx.beginPath(); ctx.arc(c.x, c.y - h - 6, 9, 0, Math.PI * 2); ctx.fill();
    }
    if (def.glow) {
      const c = iso((x0 + x1) / 2, (y0 + y1) / 2);
      const r = 10 + Math.sin(this.time * 9 + it.x) * 1.5;
      const grad = ctx.createRadialGradient(c.x, c.y - h - 4, 0, c.x, c.y - h - 4, r * 2.4);
      grad.addColorStop(0, 'rgba(255,210,120,0.9)'); grad.addColorStop(1, 'rgba(255,150,60,0)');
      ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(c.x, c.y - h - 4, r * 2.4, 0, Math.PI * 2); ctx.fill();
    }
  }

  /** Hovered or selected: underlined along its front edge, with its name. */
  drawFocus(it) {
    const { ctx } = this;
    const def = FURNITURE[it.type] || LANDING;
    const box = boxOf(it);
    const a = iso(box.x, box.y + box.d), b = iso(box.x + box.w, box.y + box.d), c = iso(box.x + box.w, box.y);
    ctx.save();
    const hot = this.mode === 'remove' ? '#ff6a5a' : this.mode === 'use' ? '#ffffff' : '#ffd76a';
    ctx.strokeStyle = hot; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.shadowColor = this.mode === 'remove' ? 'rgba(255,80,60,0.8)' : 'rgba(255,200,80,0.8)'; ctx.shadowBlur = 8;
    ctx.shadowBlur = 0;
    const top = iso(box.x + box.w / 2, box.y + box.d / 2);
    const hint = this.mode === 'remove' ? ' (click to remove)' : this.mode === 'use' ? (BEDS.has(it.type) ? ' (sleep)' : FURNITURE[it.type]?.station ? ' (craft)' : it.type === 'stairs' ? ' (go up)' : it.type === 'landing' ? ' (go down)' : it.store ? ' (open)' : '') : '';
    const text = def.name + hint;
    ctx.font = 'bold 13px system-ui, sans-serif'; ctx.textAlign = 'center';
    const tw = ctx.measureText(text).width;
    const ty = top.y - box.h - 22 - (it._lift || 0);
    ctx.fillStyle = 'rgba(20,14,28,0.85)'; ctx.fillRect(top.x - tw / 2 - 6, ty - 13, tw + 12, 19);
    ctx.fillStyle = hot; ctx.fillText(text, top.x, ty + 1);
    ctx.fillRect(top.x - tw / 2, ty + 4, tw, 1.5);   // the name is underlined too
    ctx.restore();
  }
}

/** A white copy of a sprite, for the hover outline. */
const whiteCache = new WeakMap();
function silhouette(img) {
  let c = whiteCache.get(img);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, c.width, c.height);
  whiteCache.set(img, c);
  return c;
}

function boxOf(it) {
  const def = FURNITURE[it.type] || LANDING;
  const w = it.rot ? def.d : def.w, d = it.rot ? def.w : def.d;
  return { x: it.x, y: it.y, w, d, h: def.h };
}
const depth = it => { const b = boxOf(it); return b.x + b.y + b.w + b.d; };

const uiIcon = key => (spriteAvailable(key) ? icon(key, 16) : null);

function pieceIcon(type, f) {
  const key = `interior/${type}`;
  if (spriteAvailable(key)) return icon(key, 34);
  return h('div.house-swatch', { style: { background: f.color } });
}
