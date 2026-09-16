import { h, icon, costChips, modal } from './dom.js';
import { spriteAvailable, sprite } from '../core/assets.js';
import { BUILDINGS } from '../data/buildings.js';
import { ITEMS } from '../data/people.js';
import { RARITY } from '../game/rpg.js';
import { gearIconKey } from '../render/gearArt.js';
import {
  FURNITURE, LANDING, FURNITURE_CATS, DESIGNS, houseShape, interiorOf, itemAt, canPlace, placeFurniture, removeFurniture,
  moveFurniture, storeItem, takeItem, storeGear, takeGear, slotsLeft, itemLabel,
} from '../game/houses.js';

/*
 * Inside a home: an isometric room you build in (no character here).
 * Use mode: hover shows names (underlined), click stairs to go up / the landing to go down, click storage to open it.
 * Arrange mode: click a piece to move, turn or pick it up. Choose furniture below to place it (R turns it).
 */

const TW = 64, TH = 32;   // one floor tile on screen (before zoom)
const WALL_H = 96;
const iso = (x, y) => ({ x: (x - y) * TW / 2, y: (x + y) * TH / 2 });
const shade = (hex, k) => {
  const n = parseInt(hex.slice(1), 16);
  const c = i => Math.max(0, Math.min(255, Math.round(((n >> i) & 255) * k)));
  return `rgb(${c(16)},${c(8)},${c(0)})`;
};

export class HouseEditor {
  constructor({ game, building, hero, onClose, hint }) {
    Object.assign(this, { game: game, b: building, hero, onClose, hint });
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
    this.modeBtns = h('div.house-modes',
      h('button.btn.sm', { onclick: () => this.setMode('use') }, 'Use'),
      h('button.btn.sm', { onclick: () => this.setMode('arrange') }, 'Arrange'));
    this.palette = h('div.house-palette');
    this.tabs = h('div.house-tabs');
    this.panel = h('div.card.house-panel', { hidden: true });
    this.el = h('div.house-view',
      this.canvas,
      h('div.card.house-top',
        h('div.house-title', def?.name || 'Home'), this.label, this.modeBtns, this.designRow,
        h('button.btn.sm.primary', { onclick: () => this.close() }, 'Leave house')),
      this.panel,
      h('div.card.house-bottom', this.tabs, this.palette));
    document.getElementById('ui').append(this.el);
    this.onResize = () => this.resize();
    window.addEventListener('resize', this.onResize);
    this.resize();

    // pointer: hover names, click to use / place / select, drag to look around, wheel to zoom
    let down = null;
    this.canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, cx: this.cam.x, cy: this.cam.y, moved: false }; this.canvas.setPointerCapture?.(e.pointerId); });
    this.canvas.addEventListener('pointermove', e => {
      this.pointer(e.clientX, e.clientY);
      if (!down) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (Math.hypot(dx, dy) > 6) down.moved = true;
      if (down.moved) { this.cam.x = down.cx - dx / this.cam.zoom; this.cam.y = down.cy - dy / this.cam.zoom; }
    });
    this.canvas.addEventListener('pointerup', e => { const d = down; down = null; if (d && !d.moved) { this.pointer(e.clientX, e.clientY); this.click(); } });
    this.canvas.addEventListener('contextmenu', e => { e.preventDefault(); if (this.tool) this.cancelTool(); });
    this.canvas.addEventListener('wheel', e => { e.preventDefault(); this.cam.zoom = Math.max(0.5, Math.min(2.5, this.cam.zoom * (e.deltaY < 0 ? 1.1 : 0.9))); }, { passive: false });
    this.onKey = e => {
      const k = e.key.toLowerCase();
      if (k === 'escape') { e.stopPropagation(); if (this.tool) this.cancelTool(); else if (this.selected) this.select(null); else this.close(); }
      if (k === 'r') this.rotate();
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
    const { floors } = this.shape;
    this.label.textContent = floors > 1 ? `Floor ${this.floor + 1} of ${floors}` : 'Ground floor';
    [...this.modeBtns.children].forEach((btn, i) => btn.classList.toggle('active', (i === 0) === (this.mode === 'use')));
    this.designRow.replaceChildren(h('span.faint', 'Outside:'), ...DESIGNS.map((d, i) => h('button.house-design' + ((this.b.design || 0) === i ? '.active' : ''), {
      title: d.name, style: { background: d.tint || '#c8a878' }, onclick: () => { this.b.design = i; this.game.emit('change'); this.refreshUI(); this.hint?.(`Outside look: ${d.name}`, 1500); },
    })));
    this.tabs.replaceChildren(...FURNITURE_CATS.map(([id, name]) => h('button.house-tab' + (this.cat === id ? '.active' : ''), { onclick: () => { this.cat = id; this.refreshUI(); } }, name)));
    const res = this.game.state.resources;
    this.palette.replaceChildren(...Object.entries(FURNITURE).filter(([, f]) => f.cat === this.cat).map(([type, f]) => {
      const locked = f.era && (this.game.state.era || 0) < f.era;
      const afford = Object.entries(f.cost).every(([k, n]) => (res[k] || 0) >= n);
      return h('button.house-piece' + (this.tool?.type === type ? '.active' : '') + (afford && !locked ? '' : '.lack'), {
        title: locked ? 'Not in this era yet' : f.storage ? `+${f.storage} storage, holds ${f.slots} stacks` : f.name,
        onclick: () => { if (locked) return; this.tool = { type, rot: 0 }; this.select(null); this.refreshUI(); this.hint?.('Click a spot to place it. R turns it, right-click or Esc stops.', 2500); },
      }, pieceIcon(type, f), h('div.house-piece-name', f.name), h('div.house-piece-cost', costChips(f.cost, res)));
    }));
  }

  select(it) {
    this.selected = it;
    if (!it) { this.panel.hidden = true; return; }
    const def = FURNITURE[it.type] || LANDING;
    this.panel.hidden = false;
    this.panel.replaceChildren(
      h('b', def.name),
      it.type === 'landing' ? h('div.faint', 'Move or remove the stairs from the floor below.') : h('div.row',
        h('button.btn.sm', { onclick: () => { this.tool = { move: it, rot: it.rot }; this.panel.hidden = true; } }, 'Move'),
        h('button.btn.sm', { onclick: () => { const r = moveFurniture(this.game, this.b, this.floor, it, it.x, it.y, it.rot ? 0 : 1); if (!r.ok) this.hint?.(r.why, 2000); } }, 'Turn'),
        h('button.btn.sm.danger', { onclick: () => { const r = removeFurniture(this.game, this.b, this.floor, it, this.hero); if (!r.ok) this.hint?.(r.why, 2000); this.select(null); this.refreshUI(); } }, 'Pick up')));
  }

  cancelTool() { this.tool = null; this.refreshUI(); }
  rotate() { if (this.tool) this.tool.rot = this.tool.rot ? 0 : 1; }

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
      const r = moveFurniture(g, this.b, this.floor, this.tool.move, this.hover.x, this.hover.y, this.tool.rot);
      if (!r.ok) { this.hint?.(r.why, 1800); return; }
      this.tool = null;
      return;
    }
    if (this.tool) {
      if (!this.hover) return;
      const r = placeFurniture(g, this.b, this.floor, this.tool.type, this.hover.x, this.hover.y, this.tool.rot);
      if (!r.ok) this.hint?.(r.why, 1800);
      this.refreshUI();
      return;
    }
    const it = this.hoverItem;
    if (!it) { this.select(null); return; }
    if (this.mode === 'arrange') { this.select(it); return; }
    this.use(it);
  }

  /** Use mode: stairs go up, the landing goes down, storage opens. */
  use(it) {
    if (it.type === 'stairs') this.goFloor(this.floor + 1);
    else if (it.type === 'landing') this.goFloor(this.floor - 1);
    else if (it.store) this.openStorage(it);
    else this.hint?.(`${FURNITURE[it.type]?.name}. Switch to Arrange to move it.`, 1800);
  }

  goFloor(f) {
    if (f < 0 || f >= interiorOf(this.b).floors.length) return;
    this.floor = f;
    this.select(null);
    this.hoverItem = null;
    this.refreshUI();
  }

  openStorage(it) {
    const def = FURNITURE[it.type];
    const g = this.game, hero = this.hero;
    let m;
    const render = () => {
      const pack = Object.entries(hero?.inv?.pack || {}).filter(([k, n]) => n > 0 && ITEMS[k]);
      const bag = g.state.rpg?.bag || [];
      const stored = Object.entries(it.store.items);
      const row = (ic, name, count, label, fn, color) => h('div.store-row', icon(ic, 22), h('span', { style: color ? { color } : null }, name), count ? h('span.faint', `×${count}`) : null, h('div.spacer'), h('button.btn.sm', { onclick: () => { const r = fn(); if (r && !r.ok) this.hint?.(r.why, 1800); render(); } }, label));
      m.el.replaceChildren(
        h('h2', def.name), h('div.faint', `Adds ${def.storage} to your storage · ${slotsLeft(it)} of ${def.slots} spaces free`),
        h('div.store-cols',
          h('div.store-col', h('b', 'Inside'),
            !stored.length && !it.store.gear.length ? h('div.faint', 'Empty') : null,
            ...stored.map(([k, n]) => row(ITEMS[k]?.icon || 'items/relic', itemLabel(k), n, 'Take', () => takeItem(g, it, hero, k, n))),
            ...it.store.gear.map(x => row(gearIconKey(x) || 'items/relic', x.name, 0, 'Take', () => takeGear(g, it, x.id), RARITY[x.rarity]?.color))),
          h('div.store-col', h('b', 'You carry'),
            !pack.length && !bag.length ? h('div.faint', 'Nothing to store') : null,
            ...pack.map(([k, n]) => row(ITEMS[k].icon, ITEMS[k].label, n, 'Store', () => storeItem(g, it, hero, k, n))),
            ...bag.map(x => row(gearIconKey(x) || 'items/relic', x.name, 0, 'Store', () => storeGear(g, it, x.id), RARITY[x.rarity]?.color)))),
        h('div.row', h('div.spacer'), h('button.btn.primary', { onclick: () => m.close() }, 'Done')));
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
    const ghost = this.tool && this.hover ? { type: this.tool.move?.type || this.tool.type, x: this.hover.x, y: this.hover.y, rot: this.tool.rot, ghost: true } : null;
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
      this.drawPiece(it, alpha, it.ghost ? (ok ? '#6fe07a' : '#ff5a5a') : null);
    }
    const focus = this.selected || this.hoverItem;
    if (focus && this.items.includes(focus)) this.drawFocus(focus);
  }

  drawRoom() {
    const { ctx } = this;
    const { w, d } = this.shape;
    const design = DESIGNS[this.b.design || 0];
    const wall = design.tint || '#c8a878';
    const P = (x, y, zz = 0) => { const p = iso(x, y); return [p.x, p.y - zz]; };
    const poly = (pts, fill) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); };
    // back walls (left along x = 0, right along y = 0)
    poly([P(0, 0), P(0, d), P(0, d, WALL_H), P(0, 0, WALL_H)], shade(wall, 0.62));
    poly([P(0, 0), P(w, 0), P(w, 0, WALL_H), P(0, 0, WALL_H)], shade(wall, 0.78));
    // wooden wainscot and a skirting line
    poly([P(0, 0), P(0, d), P(0, d, 30), P(0, 0, 30)], 'rgba(60,35,20,0.45)');
    poly([P(0, 0), P(w, 0), P(w, 0, 30), P(0, 0, 30)], 'rgba(60,35,20,0.35)');
    // windows
    for (let i = 2; i < w - 1; i += 4) poly([P(i, 0, 48), P(i + 1.2, 0, 48), P(i + 1.2, 0, 80), P(i, 0, 80)], this.floor ? '#6a8ac8' : '#8ab8e8');
    for (let i = 2; i < d - 1; i += 4) poly([P(0, i, 48), P(0, i + 1.2, 48), P(0, i + 1.2, 80), P(0, i, 80)], '#7aa4d8');
    // floor boards
    for (let y = 0; y < d; y++) for (let x = 0; x < w; x++) {
      poly([P(x, y), P(x + 1, y), P(x + 1, y + 1), P(x, y + 1)], (x + y) % 2 ? '#8e6440' : '#9a6e48');
    }
    ctx.strokeStyle = 'rgba(40,25,15,0.25)'; ctx.lineWidth = 1;
    for (let x = 0; x <= w; x++) { ctx.beginPath(); ctx.moveTo(...P(x, 0)); ctx.lineTo(...P(x, d)); ctx.stroke(); }
    // the floor edge (front)
    poly([P(0, d), P(w, d), P(w, d, -10), P(0, d, -10)], '#4a3020');
    poly([P(w, 0), P(w, d), P(w, d, -10), P(w, 0, -10)], '#5a3a26');
    // hovered tile while placing
    if (this.tool && this.hover) {
      const { x, y } = this.hover;
      ctx.strokeStyle = 'rgba(255,215,106,0.8)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); [P(x, y), P(x + 1, y), P(x + 1, y + 1), P(x, y + 1)].forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b))); ctx.closePath(); ctx.stroke();
    }
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
      const width = (box.w + box.d) * TW / 2;
      const base = iso(box.x + box.w, box.y + box.d);
      const cxp = (iso(box.x + box.w, box.y).x + iso(box.x, box.y + box.d).x) / 2;
      const hgt = s.box.h * width / s.box.w;
      ctx.translate(cxp, base.y);
      if (it.rot) ctx.scale(-1, 1);
      ctx.drawImage(s.img, s.box.x, s.box.y, s.box.w, s.box.h, -width / 2, -hgt, width, hgt);
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

  /** Small touches that tell pieces apart without art. */
  detail(it, def, { x0, y0, x1, y1, h }, P, poly) {
    const { ctx } = this;
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
    ctx.strokeStyle = '#ffd76a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(255,200,80,0.8)'; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.moveTo(a.x, a.y + 3); ctx.lineTo(b.x, b.y + 3); ctx.lineTo(c.x, c.y + 3); ctx.stroke();
    ctx.shadowBlur = 0;
    const top = iso(box.x + box.w / 2, box.y + box.d / 2);
    const hint = this.mode === 'use' ? (it.type === 'stairs' ? ' (go up)' : it.type === 'landing' ? ' (go down)' : it.store ? ' (open)' : '') : '';
    const text = def.name + hint;
    ctx.font = 'bold 13px system-ui, sans-serif'; ctx.textAlign = 'center';
    const tw = ctx.measureText(text).width;
    const ty = top.y - box.h - 22;
    ctx.fillStyle = 'rgba(20,14,28,0.85)'; ctx.fillRect(top.x - tw / 2 - 6, ty - 13, tw + 12, 19);
    ctx.fillStyle = '#ffd76a'; ctx.fillText(text, top.x, ty + 1);
    ctx.fillRect(top.x - tw / 2, ty + 4, tw, 1.5);   // the name is underlined too
    ctx.restore();
  }
}

function boxOf(it) {
  const def = FURNITURE[it.type] || LANDING;
  const w = it.rot ? def.d : def.w, d = it.rot ? def.w : def.d;
  return { x: it.x, y: it.y, w, d, h: def.h };
}
const depth = it => { const b = boxOf(it); return b.x + b.y + b.w + b.d; };

function pieceIcon(type, f) {
  const key = `interior/${type}`;
  if (spriteAvailable(key)) return icon(key, 34);
  return h('div.house-swatch', { style: { background: f.color } });
}
