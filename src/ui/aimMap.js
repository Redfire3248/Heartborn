import { h, icon, modal } from './dom.js';
import { TILE } from '../core/constants.js';
import { BUILDINGS, sizeOf } from '../data/buildings.js';
import { TerrainPainter } from '../render/terrain.js';
import { strikeRadius, strikePreview } from '../game/intrigue.js';

/*
 * Targeting screen for missiles and orbital strikes: a map of the target land (theirs or your own)
 * with every building on it. Tap anywhere to put the crosshair there, see what the blast would hit,
 * then fire. `game` is any Game with a world, buildings and villagers (a visit copy or your own village).
 */

const PX = 4;          // painter pixels per tile
const VIEW = 480;      // canvas resolution

export function openAimMap(game, { title, orbital = false, radius: forcedRadius = null, fireLabel = 'Launch', note = '', costChips = null, onFire }) {
  const world = game.world;
  const s = game.state;
  const painter = new TerrainPainter();
  painter.world = world;
  const land = painter.paint(0, 0, world.w, world.h, PX);

  // frame the settled part of the island (the whole island when there is little built)
  const pts = s.buildings.map(b => ({ x: b.tx + sizeOf(b) / 2, y: b.ty + sizeOf(b) / 2 }));
  const c0 = game.state.center ? { x: game.state.center.x / TILE, y: game.state.center.y / TILE } : { x: world.w / 2, y: world.h / 2 };
  if (!pts.length) pts.push(c0);
  const minX = Math.min(...pts.map(p => p.x)), maxX = Math.max(...pts.map(p => p.x));
  const minY = Math.min(...pts.map(p => p.y)), maxY = Math.max(...pts.map(p => p.y));
  const span = Math.min(world.w, Math.max(34, maxX - minX + 18, maxY - minY + 18));
  const vx = Math.max(0, Math.min(world.w - span, (minX + maxX) / 2 - span / 2));
  const vy = Math.max(0, Math.min(world.h - span, (minY + maxY) / 2 - span / 2));
  const scale = VIEW / span;   // canvas px per tile

  const canvas = h('canvas.aim-canvas', { width: VIEW, height: VIEW });
  const ctx = canvas.getContext('2d');
  const info = h('div.aim-info', 'Tap the map to aim.');
  const err = h('div.error-text');
  const fireBtn = h('button.btn.danger.aim-fire', { disabled: true }, fireLabel);
  let aim = null;
  let t = 0;

  const radius = forcedRadius || strikeRadius(orbital);
  function draw() {
    t += 1 / 60;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#10243a';
    ctx.fillRect(0, 0, VIEW, VIEW);
    ctx.drawImage(land, vx * PX, vy * PX, span * PX, span * PX, 0, 0, VIEW, VIEW);
    const hit = aim ? new Set(strikePreview(s.buildings, [], aim.tx, aim.ty, orbital, b => game.buildingCenter(b), radius).buildings) : new Set();
    for (const b of s.buildings) {
      const n = sizeOf(b);
      ctx.fillStyle = hit.has(b) ? '#ff4d3d' : b.built ? '#ffae3d' : 'rgba(255,174,61,0.5)';
      ctx.fillRect((b.tx - vx) * scale + 1, (b.ty - vy) * scale + 1, n * scale - 2, n * scale - 2);
      if (b.type === 'campfire' || BUILDINGS[b.type]?.missile) {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
        ctx.strokeRect((b.tx - vx) * scale + 1, (b.ty - vy) * scale + 1, n * scale - 2, n * scale - 2);
      }
    }
    ctx.fillStyle = '#fff';
    for (const v of s.villagers) if (!v.away) ctx.fillRect((v.x / TILE - vx) * scale - 1.5, (v.y / TILE - vy) * scale - 1.5, 3, 3);
    if (aim) {
      const x = (aim.tx + 0.5 - vx) * scale, y = (aim.ty + 0.5 - vy) * scale;
      const pulse = 0.5 + 0.5 * Math.sin(t * 8);
      ctx.fillStyle = 'rgba(255,50,40,0.18)';
      ctx.strokeStyle = `rgba(255,70,50,${0.6 + pulse * 0.4})`;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([8, 5]);
      ctx.beginPath(); ctx.arc(x, y, radius * scale, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 16, y); ctx.lineTo(x - 5, y); ctx.moveTo(x + 5, y); ctx.lineTo(x + 16, y);
      ctx.moveTo(x, y - 16); ctx.lineTo(x, y - 5); ctx.moveTo(x, y + 5); ctx.lineTo(x, y + 16);
      ctx.stroke();
    }
    frame = requestAnimationFrame(draw);
  }
  let frame = requestAnimationFrame(draw);

  function setAim(tx, ty) {
    aim = { tx: Math.max(0, Math.min(world.w - 1, tx)), ty: Math.max(0, Math.min(world.h - 1, ty)) };
    const p = strikePreview(s.buildings, s.villagers.filter(v => !v.away), aim.tx, aim.ty, orbital, b => game.buildingCenter(b), radius);
    const names = {};
    for (const b of p.buildings) { const n = BUILDINGS[b.type]?.name || b.type; names[n] = (names[n] || 0) + 1; }
    const list = Object.entries(names).map(([n, k]) => (k > 1 ? `${k} ${n}s` : n)).join(', ');
    info.replaceChildren(
      h('b', p.buildings.length ? `In the blast: ${list}` : 'No buildings in the blast'),
      h('div.faint', `${p.people} ${p.people === 1 ? 'person' : 'people'} in range right now${p.people ? ' (they may move before it lands)' : ''}`));
    fireBtn.disabled = false;
  }

  function pointer(e) {
    const r = canvas.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width * VIEW, py = (e.clientY - r.top) / r.height * VIEW;
    setAim(Math.floor(vx + px / scale), Math.floor(vy + py / scale));
  }
  canvas.addEventListener('pointerdown', e => { e.preventDefault(); canvas.setPointerCapture?.(e.pointerId); pointer(e); canvas._drag = true; });
  canvas.addEventListener('pointermove', e => { if (canvas._drag) pointer(e); });
  canvas.addEventListener('pointerup', () => { canvas._drag = false; });

  fireBtn.onclick = async () => {
    if (!aim) return;
    err.textContent = '';
    fireBtn.disabled = true;
    try { await onFire({ ...aim }); m.close(); }
    catch (e) { err.textContent = e.message; fireBtn.disabled = false; }
  };

  const m = modal([
    h('div.row', icon(orbital ? 'units/science' : 'units/missile', 32), h('h2', title)),
    note ? h('div.muted', note) : null,
    h('div.aim-wrap', canvas),
    info,
    costChips ? h('div.row.wrap', costChips) : null,
    err,
    h('div.row', h('div.spacer'), fireBtn),
  ].filter(Boolean), { cls: 'aim-modal', onClose: () => cancelAnimationFrame(frame) });
  return { close: () => m.close(), setAim };
}
