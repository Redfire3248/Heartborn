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
      h('div', h('h2', 'World Map'), h('div.faint', 'Every civilization has its own land. Distance decides how long armies and caravans travel.')),
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

    // route line to the selected realm
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
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
