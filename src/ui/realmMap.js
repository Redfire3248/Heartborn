import { h, icon, avatar, modal, fmt } from './dom.js';
import { ERAS } from '../data/buildings.js';
import { realmPos as rawPos, travelMs, fmtMinutes } from '../net/multiplayer.js';

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
    const list = (mp?.players || []).map(p => ({ ...p }));
    if (!list.some(p => p.uid === me)) {
      list.push({ uid: me, name: game.state.owner.name, villageName: game.state.owner.villageName, pop: game.state.villagers.length, era: game.state.era, karma: Math.round(game.state.karma), online: true });
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

const seeded = uid => { let s = 2166136261; for (const ch of uid) s = Math.imul(s ^ ch.charCodeAt(0), 16777619); return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) >>> 0) / 4294967296); };
const hash2 = (x, y, seed) => { let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 2147483647); n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967295; };
function vnoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed), c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y, seed) => vnoise(x, y, seed) * 0.55 + vnoise(x * 2.1, y * 2.1, seed + 7) * 0.28 + vnoise(x * 4.3, y * 4.3, seed + 13) * 0.17;

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
    if (near[1] && near[1][1] < 32) add(i, near[1][0]);
  });
  return links;
}

const PALETTE = {
  deep: [6, 10, 16], sea: [10, 22, 34], shallow: [22, 58, 74], foam: [60, 104, 112],
  sand: [201, 178, 120], grass: [86, 138, 58], grass2: [70, 120, 48], forest: [42, 82, 38], forest2: [32, 66, 32],
  rock: [112, 108, 104], rock2: [86, 84, 84], snow: [226, 232, 238],
};

let cache = { key: '', canvas: null };

/** A dark world map with a real terrain island for every civilization. Pure terrain: no buildings on it. */
function worldCanvas(list) {
  const key = list.map(p => `${p.uid}:${Math.round(Math.sqrt(p.pop || 3))}`).sort().join('|');
  if (cache.key === key && cache.canvas) return cache.canvas;
  const N = 260;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  c.className = 'realm-terrain';
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(N, N);

  const nodes = list.map(p => {
    const pos = realmPos(p.uid);
    const rand = seeded(p.uid);
    return { x: pos.x / 100 * N, y: pos.y / 100 * N, r: (4.2 + Math.min(5, Math.sqrt(p.pop || 3) * 0.6)) / 100 * N, seed: Math.floor(rand() * 1e6), stretch: 0.75 + rand() * 0.5, angle: rand() * Math.PI };
  });
  const links = bridgesFor(nodes);

  // distance from a point to a gently curved bridge (sampled quadratic curve)
  const bridgeSamples = links.map(([A, B]) => {
    const mx = (A.x + B.x) / 2 + (A.y - B.y) * 0.12, my = (A.y + B.y) / 2 + (B.x - A.x) * 0.12;
    const pts = [];
    for (let t = 0; t <= 1.0001; t += 0.04) pts.push([(1 - t) ** 2 * A.x + 2 * (1 - t) * t * mx + t * t * B.x, (1 - t) ** 2 * A.y + 2 * (1 - t) * t * my + t * t * B.y]);
    return pts;
  });

  const elevation = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let e = -1;
    for (const n of nodes) {
      const dx = x - n.x, dy = y - n.y;
      const ca = Math.cos(n.angle), sa = Math.sin(n.angle);
      const rx = (dx * ca + dy * sa) / n.stretch, ry = (-dx * sa + dy * ca) * n.stretch;
      const d = Math.hypot(rx, ry) / n.r;
      if (d > 2.2) continue;
      const warp = (fbm(x * 0.06, y * 0.06, n.seed) - 0.5) * 0.9;
      e = Math.max(e, 1 - d + warp);
    }
    // land bridges: thin, slightly wobbly strips of low land
    for (const pts of bridgeSamples) {
      let best = 1e9;
      for (const [px, py] of pts) { const d = (px - x) ** 2 + (py - y) ** 2; if (d < best) best = d; }
      const w = 2.2 + (fbm(x * 0.12, y * 0.12, 91) - 0.5) * 2.4;
      e = Math.max(e, Math.min(0.12, (w - Math.sqrt(best)) * 0.08));
    }
    elevation[y * N + x] = e;
  }

  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const e = elevation[y * N + x];
    const detail = fbm(x * 0.18, y * 0.18, 5);
    let col;
    if (e < -0.35) col = PALETTE.deep;
    else if (e < -0.08) col = PALETTE.sea;
    else if (e < 0) col = e > -0.03 ? PALETTE.foam : PALETTE.shallow;
    else if (e < 0.07) col = PALETTE.sand;
    else if (e < 0.42) col = detail > 0.55 ? PALETTE.grass2 : PALETTE.grass;
    else if (e < 0.62) col = detail > 0.5 ? PALETTE.forest2 : PALETTE.forest;
    else if (e < 0.8) col = detail > 0.5 ? PALETTE.rock2 : PALETTE.rock;
    else col = PALETTE.snow;
    // hill shading from the slope toward the top-left light
    const ex = elevation[y * N + Math.min(N - 1, x + 1)] - e, ey = elevation[Math.min(N - 1, y + 1) * N + x] - e;
    const shade = e >= 0 ? 1 - Math.max(-0.25, Math.min(0.35, (ex + ey) * 6)) : 1;
    const grain = 0.94 + hash2(x, y, 3) * 0.1;
    const i = (y * N + x) * 4;
    img.data[i] = Math.min(255, col[0] * shade * grain);
    img.data[i + 1] = Math.min(255, col[1] * shade * grain);
    img.data[i + 2] = Math.min(255, col[2] * shade * grain);
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  cache = { key, canvas: c };
  return c;
}
