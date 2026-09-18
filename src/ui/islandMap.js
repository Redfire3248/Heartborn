/*
 * The map of your land: open it by clicking the minimap (or V). Drag to move, scroll or pinch to zoom (from the whole
 * island down to a few tiles), and tap anywhere to drop a marker. Markers show on the minimap too (with an arrow at
 * its edge when they are further away), so you can find your way back.
 */
import { h, icon, modal, closeIfOpen } from './dom.js';
import { TILE } from '../core/constants.js';
import { CREATURES } from '../data/objects.js';
import { sizeOf } from '../data/buildings.js';
import { heroOf } from '../game/hero.js';
import { play } from '../core/sound.js';

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

export function openIslandMap(hud) {
  if (closeIfOpen('island-map-modal')) return null;
  const g = hud.game;
  const w = g.world;
  const canvas = h('canvas.island-canvas');
  const info = h('div.island-info', 'Drag to move · scroll or pinch to zoom · tap to place a marker · tap a marker to edit it');
  const list = h('div.island-list');
  const m = modal([], { cls: 'island-map-modal', closeX: true });
  const view = { z: 1, x: 0, y: 0 };   // z: screen pixels per tile
  let raf = 0, alive = true;

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
  const zoomAt = (px, py, f) => { const t = toTile(px, py); view.z *= f; clamp(); view.x = px - t.x * view.z; view.y = py - t.y * view.z; clamp(); };
  const centerOn = (tx, ty, z) => { view.z = z; clamp(); view.x = canvas.width / 2 - tx * view.z; view.y = canvas.height / 2 - ty * view.z; clamp(); };

  const draw = () => {
    if (!alive || !canvas.isConnected) { alive = false; return; }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0c1a2a'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(view.z, 0, 0, view.z, view.x, view.y);
    const terrain = hud.renderer?.terrain;
    const img = terrain?.world === w && terrain.overview ? terrain.overview : hud.miniBase;
    ctx.imageSmoothingEnabled = view.z < 6;
    if (img) ctx.drawImage(img, 0, 0, w.w, w.h);
    const px = 1 / view.z * devicePixelRatio;   // one screen pixel in tiles
    ctx.fillStyle = 'rgba(28,70,26,0.5)';
    if (view.z > 3) for (const o of g.state.objects) if (o.t.startsWith('tree_') && o.t !== 'tree_stump') ctx.fillRect(o.x + 0.2, o.y + 0.2, 0.6, 0.6);
    for (const b of g.state.buildings) { const s = sizeOf(b); ctx.fillStyle = '#ffae3d'; ctx.fillRect(b.tx, b.ty, s, s); ctx.strokeStyle = '#3a2410'; ctx.lineWidth = px; ctx.strokeRect(b.tx, b.ty, s, s); }
    const dot = (x, y, r, color) => { ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(x, y, (r + 1.5) * px, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r * px, 0, Math.PI * 2); ctx.fill(); };
    for (const e of g.state.dungeons || []) dot(e.x / TILE, e.y / TILE, 6, '#b06aff');
    for (const c of g.state.creatures) if (CREATURES[c.t]?.boss || c.bounty) dot(c.x / TILE, c.y / TILE, 6, '#ff3a2a');
    // markers: a pin with its name
    ctx.font = `${12 * px}px "Pixelify Sans", sans-serif`; ctx.textAlign = 'center';
    for (const mk of markersOf(g)) {
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(mk.x, mk.y - 10 * px, 7 * px, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = mk.color; ctx.beginPath(); ctx.arc(mk.x, mk.y - 10 * px, 5.5 * px, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(mk.x - 4 * px, mk.y - 7 * px); ctx.lineTo(mk.x + 4 * px, mk.y - 7 * px); ctx.lineTo(mk.x, mk.y); ctx.fill();
      ctx.lineWidth = 3 * px; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.strokeText(mk.label, mk.x, mk.y - 20 * px); ctx.fillStyle = '#fff'; ctx.fillText(mk.label, mk.x, mk.y - 20 * px);
    }
    // home and you
    if (g.state.center) dot(g.state.center.x / TILE, g.state.center.y / TILE, 5, '#ffd76a');
    const v = heroOf(g);
    if (v) {
      const k = 0.7 + 0.3 * Math.sin(performance.now() / 200);
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.arc(v.x / TILE, v.y / TILE, 14 * px * k, 0, Math.PI * 2); ctx.fill();
      dot(v.x / TILE, v.y / TILE, 6, '#ffffff');
    }
    raf = requestAnimationFrame(draw);
  };

  const renderList = () => {
    const mks = markersOf(g);
    list.replaceChildren(h('b', `Markers (${mks.length})`), ...mks.map(mk => h('div.island-mk',
      h('i', { style: { background: mk.color } }),
      h('button.link', { title: 'Show on the map', onclick: () => centerOn(mk.x, mk.y, Math.max(view.z, minZ() * 5)) }, mk.label),
      h('button.btn.sm.ghost', { title: 'Rename', onclick: () => { const n = prompt('Marker name', mk.label); if (n) { mk.label = n.slice(0, 24); renderList(); g.emit('change'); } } }, 'Rename'),
      h('button.btn.sm.ghost', { title: 'Remove', onclick: () => { g.state.markers = markersOf(g).filter(x => x !== mk); renderList(); g.emit('change'); } }, 'Remove'))),
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
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, pos(e));
    if (pointers.size === 2 && pinch) { const [a, b] = [...pointers.values()]; const f = (pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d) / view.z; zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, f); moved = true; return; }
    if (drag) { const p = pos(e); if (Math.hypot(p.x - drag.x, p.y - drag.y) > 6) moved = true; view.x = drag.vx + p.x - drag.x; view.y = drag.vy + p.y - drag.y; clamp(); }
  });
  const up = e => {
    const p = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (!pointers.size) {
      drag = null;
      if (!moved && p) {   // a tap: edit the marker under it, or place a new one
        const t = toTile(p.x, p.y);
        const hit = markersOf(g).find(mk => Math.hypot(mk.x - t.x, (mk.y - 0.4) - t.y) * view.z < 18 * devicePixelRatio);
        if (hit) { const n = prompt('Rename the marker (leave empty to remove it)', hit.label); if (n === '') g.state.markers = markersOf(g).filter(x => x !== hit); else if (n) hit.label = n.slice(0, 24); }
        else if (t.x >= 0 && t.y >= 0 && t.x < w.w && t.y < w.h) { addMarker(g, t.x, t.y); play('click'); }
        renderList();
      }
    }
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', e => { e.preventDefault(); const p = pos(e); zoomAt(p.x, p.y, e.deltaY < 0 ? 1.25 : 1 / 1.25); }, { passive: false });

  const zoomBtn = f => () => zoomAt(canvas.width / 2, canvas.height / 2, f);
  const v0 = heroOf(g);
  m.el.replaceChildren(m.closeBtn,
    h('div.island-head', icon('items/scroll', 26), h('h2', 'Map'), h('div.spacer'),
      h('button.btn.sm', { onclick: zoomBtn(1.5) }, '+'), h('button.btn.sm', { onclick: zoomBtn(1 / 1.5) }, '−'),
      h('button.btn.sm', { onclick: () => { const v = heroOf(g); if (v) centerOn(v.x / TILE, v.y / TILE, Math.max(view.z, minZ() * 4)); } }, 'Find me'),
      h('button.btn.sm', { onclick: () => { view.z = minZ(); clamp(); } }, 'Whole island'),
      hud.mp ? h('button.btn.sm', { onclick: () => { m.close(); hud.openMap(); } }, 'World Map') : null),
    h('div.island-body', canvas, list), info);
  requestAnimationFrame(() => {
    size();
    if (v0) centerOn(v0.x / TILE, v0.y / TILE, minZ() * 4); else { view.z = minZ(); clamp(); }
    renderList();
    draw();
  });
  return m;
}
