import { h, icon, avatar, modal, fmt } from './dom.js';
import { ERAS } from '../data/buildings.js';
import { realmPos as rawPos, travelMs, fmtMinutes } from '../net/multiplayer.js';
import { World } from '../game/world.js';
import { TerrainPainter } from '../render/terrain.js';

// keep pins away from the map edges so names are never clipped
const realmPos = uid => { const p = rawPos(uid); return { x: 8 + p.x * 0.84, y: 7 + p.y * 0.84 }; };

/**
 * The shared realm: every civilization sits at a fixed place (derived from its owner's id).
 * Pick a village to see how far it is, then visit, trade or march on it.
 */
export function openRealmMap({ hud, onVisit }) {
  const { game, mp, user } = hud;
  const me = user.uid;
  let selected = me;
  let timer = null;

  const map = h('div.realm-map');
  const side = h('div.realm-side');
  const m = modal([
    h('div.row',
      icon('buildings/castle', 30),
      h('div', h('h2', 'World Map'), h('div.faint', 'Every player’s island, joined by land bridges. Distance decides how long armies and caravans travel.')),
      h('div.spacer'),
      h('button.btn.icon.ghost', { onclick: () => close() }, '✕')),
    h('div.realm-body', map, side),
  ], { cls: 'realm', onClose: () => clearInterval(timer) });
  const close = () => { clearInterval(timer); m.close(); };

  function villages() {
    const list = (mp?.players || []).map(p => (p.uid === me ? { ...p, seed: game.state.seed } : { ...p }));
    if (!list.some(p => p.uid === me)) {
      list.push({ uid: me, seed: game.state.seed, name: game.state.owner.name, villageName: game.state.owner.villageName, pop: game.state.villagers.length, era: game.state.era, karma: Math.round(game.state.karma), online: true });
    }
    return list;
  }

  let lastKey = '';
  // Only rebuild when something changed: rebuilding every second swallowed clicks on the buttons.
  function tick() {
    const list = villages();
    const key = JSON.stringify([selected, [...(mp?.allies || [])], list.map(p => [p.uid, p.online, p.pop, p.era, p.karma, p.villageName]),
      (mp?.armies?.() || []).map(a => [a.id, a.status]), (mp?.missions?.() || []).map(m => m.id), Math.floor(Date.now() / 2000)]);
    if (key !== lastKey) { lastKey = key; render(); } else moveArmies();
  }

  function moveArmies() {
    const mine = realmPos(me);
    for (const el of map.querySelectorAll('.realm-army')) {
      const a = (mp?.armies?.() || []).find(x => x.id === el.dataset.id);
      if (!a) continue;
      const { x, y } = armyPos(a, mine);
      el.style.left = `${x}%`;
      el.style.top = `${y}%`;
    }
  }

  function armyPos(a, mine) {
    const to = realmPos(a.to);
    const homeward = game.state.caravans?.find(c => c.id === a.id);
    let t;
    if (homeward) {
      t = Math.min(1, Math.max(0, (homeward.at - Date.now()) / travelMs(me, a.to)));
    } else {
      const total = Math.max(1, a.arrivesAt - (a.launchedAt || a.arrivesAt - travelMs(me, a.to)));
      t = Math.min(1, Math.max(0, (Date.now() - (a.arrivesAt - total)) / total));
    }
    return { x: mine.x + (to.x - mine.x) * t, y: mine.y + (to.y - mine.y) * t };
  }

  function render() {
    const list = villages();
    const mine = realmPos(me);
    const sel = list.find(p => p.uid === selected) || list.find(p => p.uid === me);
    map.replaceChildren();

    map.append(worldCanvas(list));
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');

    // route line to the selected realm
    if (sel && sel.uid !== me) {
      const to = realmPos(sel.uid);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      Object.entries({ x1: mine.x, y1: mine.y, x2: to.x, y2: to.y, stroke: '#ffcf5a', 'stroke-width': 0.35, 'stroke-dasharray': '1.2 1', opacity: 0.85 })
        .forEach(([k, v]) => line.setAttribute(k, v));
      svg.append(line);
    }
    // armies on the road
    for (const a of mp?.armies?.() || []) {
      const to = realmPos(a.to);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      Object.entries({ x1: mine.x, y1: mine.y, x2: to.x, y2: to.y, stroke: '#ff6b5b', 'stroke-width': 0.3, opacity: 0.6 })
        .forEach(([k, v]) => line.setAttribute(k, v));
      svg.append(line);
    }
    map.append(svg);

    for (const m of mp?.missions?.() || []) {
      const to = realmPos(m.to);
      const total = Math.max(1, m.arrivesAt - (m.launchedAt || m.arrivesAt));
      const t = Math.min(1, Math.max(0, 1 - (m.arrivesAt - Date.now()) / total));
      map.append(h('div.realm-army', { style: { left: `${mine.x + (to.x - mine.x) * t}%`, top: `${mine.y + (to.y - mine.y) * t}%` }, title: `${m.agent || 'Missile'} → ${m.toVillage}` }, m.kind === 'missile' ? '☢' : '🕵'));
    }
    for (const a of mp?.armies?.() || []) {
      const { x, y } = armyPos(a, mine);
      map.append(h('div.realm-army', { 'data-id': a.id, style: { left: `${x}%`, top: `${y}%` }, title: `Army → ${a.toVillage}` }, '⚔'));
    }

    for (const p of list) {
      const pos = realmPos(p.uid);
      map.append(h(`div.realm-pin${p.uid === me ? '.me' : ''}${p.uid === selected ? '.sel' : ''}${p.online ? '' : '.offline'}`, {
        style: { left: `${pos.x}%`, top: `${pos.y}%` },
        onclick: () => { selected = p.uid; tick(); },
      },
      h('span.pin-dot'),
      h('span.pin-name', p.online ? h('b.dot-on') : null, p.villageName || 'Unknown')));
    }

    // side panel
    side.replaceChildren();
    if (sel) {
      const isMe = sel.uid === me;
      const ally = mp?.allies?.has(sel.uid);
      side.append(h('div.realm-card',
        h('div.row', avatar(sel.name || '?', 42), h('div',
          h('div', { style: { fontWeight: 700, color: 'var(--gold)' } }, sel.villageName),
          h('div.faint', `${isMe ? 'Your realm' : `Ruled by ${sel.name}`}`))),
        h('div.realm-legend',
          h('span.chip', `👥 ${sel.pop ?? '?'}`),
          h('span.chip', ERAS[sel.era || 0]?.name),
          h('span.chip', `☯ ${sel.karma ?? 0}`),
          sel.online ? h('span.chip.good', 'online') : h('span.chip', 'offline'),
          ally ? h('span.chip', { style: { color: 'var(--info)' } }, 'ally') : null),
        isMe ? h('div.faint', 'This is your land. Other rulers see you here.') : h('div.col', { style: { gap: '6px' } },
          h('div.row', h('span.chip', `🗺 Army: ${fmtMinutes(travelMs(me, sel.uid))}`), h('span.chip', `🐪 Caravan: ${fmtMinutes(travelMs(me, sel.uid, 'caravan'))}`)),
          h('button.btn.primary', { onclick: () => { close(); onVisit(sel.uid); } }, '🔭 Visit their land'),
          h('button.btn.sm', { onclick: () => { close(); hud.showProfile(sel); } }, '👤 View profile'),
          mp ? h('div.row',
            h('button.btn.sm', { style: { flex: 1 }, onclick: () => { close(); hud.offerModal(sel); } }, '🤝 Deal'),
            ally ? null : h('button.btn.sm.danger', { style: { flex: 1 }, onclick: () => { close(); hud.raidModal(sel); } }, '⚔ March'),
            h('button.btn.sm', { style: { flex: 1 }, onclick: () => { close(); hud.spyModal(sel); } }, '🕵 Spy')) : null)));
    }
    const others = list.filter(p => p.uid !== me).sort((a, b) => travelMs(me, a.uid) - travelMs(me, b.uid));
    side.append(h('h3', 'Nearest realms'));
    if (!others.length) side.append(h('div.faint', mp ? 'No other civilizations yet. Invite your friends!' : 'Multiplayer is offline.'));
    for (const p of others.slice(0, 12)) {
      side.append(h('div.player', { style: { cursor: 'pointer' }, onclick: () => { selected = p.uid; tick(); } },
        avatar(p.name || '?', 32),
        h('div', h('div.pname', p.villageName), h('div.meta', h('span', p.online ? '● online' : 'offline'), h('span', `👥 ${fmt(p.pop || 0)}`))),
        h('span.faint', fmtMinutes(travelMs(me, p.uid)))));
    }
  }

  tick();
  timer = setInterval(tick, 1000);
  return { close };
}

// ------------------------------------------------------------------ world terrain

/*
 * Every island is that player's REAL land: their world is rebuilt from its seed and painted with the
 * same terrain painter as the game and minimap, so your island here looks exactly like your map.
 * No buildings, just the land. Islands are joined by land bridges.
 */

const islandCache = new Map();   // seed -> canvas

function fallbackSeed(uid) { let s = 2166136261; for (const ch of uid) s = Math.imul(s ^ ch.charCodeAt(0), 16777619); return s >>> 0; }

function islandImage(seed) {
  let c = islandCache.get(seed);
  if (c) return c;
  const world = new World(seed);
  const painter = new TerrainPainter();
  painter.world = world;
  const src = painter.paint(0, 0, world.w, world.h, 4);   // 384×384, like the minimap
  // fade the surrounding ocean into the dark sea so only the island remains
  c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'destination-in';
  const r = c.width / 2;
  const fade = ctx.createRadialGradient(r, r, r * 0.55, r, r, r);
  fade.addColorStop(0, 'rgba(0,0,0,1)');
  fade.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, c.width, c.height);
  islandCache.set(seed, c);
  return c;
}

// nearest neighbours joined by land bridges: a spanning tree + each island's second-nearest link
function bridgesFor(nodes) {
  const links = [];
  if (nodes.length < 2) return links;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const inTree = new Set([0]), seen = new Set();
  const add = (i, j) => { const k = i < j ? `${i}-${j}` : `${j}-${i}`; if (!seen.has(k)) { seen.add(k); links.push([nodes[i], nodes[j]]); } };
  while (inTree.size < nodes.length) {
    let best = null;
    for (const i of inTree) for (let j = 0; j < nodes.length; j++) {
      if (inTree.has(j)) continue;
      const d = dist(nodes[i], nodes[j]);
      if (!best || d < best.d) best = { i, j, d };
    }
    inTree.add(best.j); add(best.i, best.j);
  }
  nodes.forEach((n, i) => {
    const near = nodes.map((m, j) => [j, dist(n, m)]).filter(([j]) => j !== i).sort((a, b) => a[1] - b[1]);
    if (near[1] && near[1][1] < 0.32 * 900) add(i, near[1][0]);
  });
  return links;
}

let cache = { key: '', canvas: null };

function worldCanvas(list) {
  const key = list.map(p => `${p.uid}:${p.seed ?? ''}`).sort().join('|');
  if (cache.key === key && cache.canvas) return cache.canvas;
  const N = 900;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  c.className = 'realm-terrain';
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#05080d';
  ctx.fillRect(0, 0, N, N);

  // fewer players → bigger islands
  const size = N * Math.max(0.14, Math.min(0.34, 0.62 / Math.sqrt(Math.max(1, list.length))));
  const nodes = list.map(p => { const pos = realmPos(p.uid); return { x: pos.x / 100 * N, y: pos.y / 100 * N, seed: p.seed ?? fallbackSeed(p.uid) }; });

  // land bridges first, under the islands: chunky terrain blocks on a pixel grid (shallows, sand, grass)
  const cell = Math.max(4, Math.round(size * 0.028));
  for (const [A, B] of bridgesFor(nodes)) {
    const mx = (A.x + B.x) / 2 + (A.y - B.y) * 0.12, my = (A.y + B.y) / 2 + (B.x - A.x) * 0.12;
    const pts = new Map();
    const steps = Math.ceil(Math.hypot(B.x - A.x, B.y - A.y) / (cell * 0.5));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, u = 1 - t;
      const x = u * u * A.x + 2 * u * t * mx + t * t * B.x, y = u * u * A.y + 2 * u * t * my + t * t * B.y;
      pts.set(`${Math.floor(x / cell)},${Math.floor(y / cell)}`, [Math.floor(x / cell), Math.floor(y / cell)]);
    }
    const blocks = (grow, color) => {
      ctx.fillStyle = color;
      for (const [cx, cy] of pts.values()) ctx.fillRect((cx - grow) * cell, (cy - grow) * cell, (grow * 2 + 1) * cell, (grow * 2 + 1) * cell);
    };
    blocks(2, 'rgba(60,150,170,0.35)');   // shallow water
    blocks(1, '#cdb77f');                 // sand
    blocks(0, '#5f9a3e');                 // grass path
    // dark pixel outline on the sand edge
    ctx.fillStyle = 'rgba(26,15,8,0.35)';
    const key = (x, y) => `${x},${y}`;
    const sand = new Set();
    for (const [cx, cy] of pts.values()) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) sand.add(key(cx + dx, cy + dy));
    for (const k of sand) {
      const [x, y] = k.split(',').map(Number);
      if (!sand.has(key(x - 1, y))) ctx.fillRect(x * cell, y * cell, 2, cell);
      if (!sand.has(key(x + 1, y))) ctx.fillRect((x + 1) * cell - 2, y * cell, 2, cell);
      if (!sand.has(key(x, y - 1))) ctx.fillRect(x * cell, y * cell, cell, 2);
      if (!sand.has(key(x, y + 1))) ctx.fillRect(x * cell, (y + 1) * cell - 2, cell, 2);
    }
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  for (const n of nodes) ctx.drawImage(islandImage(n.seed), n.x - size / 2, n.y - size / 2, size, size);

  cache = { key, canvas: c };
  return c;
}
