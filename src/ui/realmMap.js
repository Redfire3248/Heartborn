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

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    drawIslands(svg, list, me);

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
      avatar(p.name || '?', p.uid === me ? 34 : 28),
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

// ------------------------------------------------------------------ islands & bridges

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };
const seeded = uid => { let s = 2166136261; for (const ch of uid) s = Math.imul(s ^ ch.charCodeAt(0), 16777619); return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) >>> 0) / 4294967296); };

/** A wobbly closed island outline around (cx, cy). */
function islandPath(cx, cy, r, rand, points = 14) {
  const pts = [];
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2;
    const rr = r * (0.72 + rand() * 0.45);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  // smooth with quadratic curves through midpoints
  const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  let d = `M ${mid(pts[points - 1], pts[0]).join(' ')}`;
  for (let i = 0; i < points; i++) { const p = pts[i], q = pts[(i + 1) % points]; d += ` Q ${p.join(' ')} ${mid(p, q).join(' ')}`; }
  return `${d} Z`;
}

/** Every civilization's island, connected to its nearest neighbours by land bridges (a spanning tree + a few extra links). */
function drawIslands(svg, list, me) {
  const nodes = list.map(p => ({ p, pos: realmPos(p.uid), r: 3.2 + Math.min(4.2, Math.sqrt(p.pop || 3) * 0.55) }));

  // bridges: Prim's minimum spanning tree so every island is reachable, plus each island's second-nearest link
  const links = new Set();
  const dist = (a, b) => Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y);
  if (nodes.length > 1) {
    const inTree = new Set([0]);
    while (inTree.size < nodes.length) {
      let best = null;
      for (const i of inTree) for (let j = 0; j < nodes.length; j++) {
        if (inTree.has(j)) continue;
        const d = dist(nodes[i], nodes[j]);
        if (!best || d < best.d) best = { i, j, d };
      }
      inTree.add(best.j);
      links.add([best.i, best.j].sort((a, b) => a - b).join('-'));
    }
    nodes.forEach((n, i) => {
      const near = nodes.map((m, j) => [j, dist(n, m)]).filter(([j]) => j !== i).sort((a, b) => a[1] - b[1]);
      if (near[1] && near[1][1] < 35) links.add([i, near[1][0]].sort((a, b) => a - b).join('-'));
    });
  }
  const bridges = el('g', {});
  for (const key of links) {
    const [a, b] = key.split('-').map(Number);
    const A = nodes[a].pos, B = nodes[b].pos;
    // a gentle curve so bridges look like natural land spits
    const mx = (A.x + B.x) / 2 + (A.y - B.y) * 0.12, my = (A.y + B.y) / 2 + (B.x - A.x) * 0.12;
    const d = `M ${A.x} ${A.y} Q ${mx} ${my} ${B.x} ${B.y}`;
    bridges.append(el('path', { d, fill: 'none', stroke: 'rgba(8,24,40,.45)', 'stroke-width': 3.2, 'stroke-linecap': 'round' }));
    bridges.append(el('path', { d, fill: 'none', stroke: '#d9c28a', 'stroke-width': 2.2, 'stroke-linecap': 'round' }));
    bridges.append(el('path', { d, fill: 'none', stroke: '#7fae4f', 'stroke-width': 1.1, 'stroke-linecap': 'round', opacity: 0.9 }));
    bridges.append(el('path', { d, fill: 'none', stroke: '#6a4a2a', 'stroke-width': 0.35, 'stroke-dasharray': '0.6 1.4', opacity: 0.7 }));
  }
  svg.append(bridges);

  for (const n of nodes) {
    const rand = seeded(n.p.uid);
    const { x, y } = n.pos;
    const g = el('g', {});
    g.append(el('path', { d: islandPath(x, y, n.r + 1.6, seeded(n.p.uid)), fill: 'rgba(140,220,235,.28)' }));        // shallow water
    g.append(el('path', { d: islandPath(x, y, n.r + 0.6, seeded(n.p.uid)), fill: '#e3cd8c' }));                      // beach
    g.append(el('path', { d: islandPath(x, y, n.r, seeded(n.p.uid)), fill: n.p.uid === me ? '#6fb34a' : '#5c9e3c' })); // grass
    // a couple of hills / forest spots from the island's own seed
    for (let i = 0; i < 3; i++) {
      const a = rand() * Math.PI * 2, d = rand() * n.r * 0.5;
      g.append(el('circle', { cx: x + Math.cos(a) * d, cy: y + Math.sin(a) * d, r: n.r * (0.18 + rand() * 0.14), fill: rand() > 0.5 ? '#3f7a2e' : '#8a8f96', opacity: 0.8 }));
    }
    if (n.p.uid === me) g.append(el('path', { d: islandPath(x, y, n.r + 0.6, seeded(n.p.uid)), fill: 'none', stroke: '#ffcf5a', 'stroke-width': 0.45 }));
    svg.append(g);
  }
}
