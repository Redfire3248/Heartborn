import { iconUrl, spriteAvailable } from '../core/assets.js';
import { hasEmoji, stripEmoji, iconizeText } from './pixelIcons.js';

/** Tiny hyperscript: h('div.card#id', { onclick }, children...) */
export function h(sel, attrs = {}, ...children) {
  if (typeof attrs !== 'object' || attrs === null || attrs instanceof Node || Array.isArray(attrs)) {
    children.unshift(attrs);
    attrs = {};
  }
  const [tagPart, ...rest] = sel.split(/(?=[.#])/);
  const el = document.createElement(tagPart || 'div');
  for (const r of rest) {
    if (r[0] === '.') el.classList.add(r.slice(1));
    else if (r[0] === '#') el.id = r.slice(1);
  }
  for (let [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (typeof v === 'string' && (k === 'title' || k === 'placeholder' || k === 'label')) v = stripEmoji(v);   // tooltips can't show icons
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv; }   // CSS variables need setProperty
    else if (k === 'dataset' && typeof v === 'object') Object.assign(el.dataset, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && k !== 'list') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children, tagPart === 'option');
  return el;
}

function append(el, children, plain = false) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    if (c instanceof Node) { el.append(c); continue; }
    const s = String(c);
    // no emojis anywhere: swap each for the game's own pixel icon (plain text where icons can't go)
    if (hasEmoji(s)) { if (plain) el.append(document.createTextNode(stripEmoji(s))); else el.append(...iconizeText(s)); continue; }
    el.append(document.createTextNode(s));
  }
}

export function icon(key, size = 24, cls = 'sprite') {
  const loaded = iconUrl(key);
  const img = h('img', { src: loaded || '', width: size, height: size, className: cls, alt: '', draggable: false });
  // sprite not loaded yet (or only a placeholder): point straight at the real file
  if ((!loaded || loaded.startsWith('data:')) && spriteAvailable(key)) {
    img.onerror = () => { img.onerror = null; img.src = iconUrl(key); };
    img.src = `${import.meta.env.BASE_URL}assets/${key}.png`;
  }
  return img;
}

const AVATAR_COLORS = ['#e0622b', '#c9453b', '#8f3bd1', '#3b6fd1', '#2f9e8f', '#4f9a3a', '#b8862b', '#d14b8f'];

/** Round avatar showing the first letter of a username (no profile pictures). */
export function avatar(name = '?', size = 40) {
  let hsh = 0;
  for (const ch of name) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0;
  const bg = AVATAR_COLORS[hsh % AVATAR_COLORS.length];
  return h('span.avatar-letter', {
    style: { width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.48)}px`, background: `linear-gradient(160deg, ${bg}, ${bg}cc)` },
  }, (name.trim()[0] || '?').toUpperCase());
}

export const RES_ICON = {
  food: 'items/icon_food', wood: 'items/icon_wood', stone: 'items/icon_stone', coal: 'items/icon_coal',
  iron: 'items/icon_iron', weapons: 'items/sword', bombs: 'effects/explosion', science: 'effects/magic_orb', gold: 'items/icon_gold', gems: 'items/icon_gem', influence: 'items/icon_influence',
  copper: 'items/icon_copper', silver: 'items/icon_silver', obsidian: 'items/icon_obsidian', mythril: 'items/icon_mythril', frostite: 'items/icon_frostite', magmite: 'items/icon_magmite',
  troll_hide: 'characters/cave_troll', slime_core: 'items/mat_slime_core', spider_silk: 'items/mat_spider_silk', spirit_bark: 'items/mat_spirit_bark', golem_heart: 'items/mat_golem_heart', lich_soul: 'items/mat_lich_soul', dragon_scale: 'items/mat_dragon_scale',
  jade: 'items/icon_jade', cobalt: 'items/icon_cobalt', moonstone: 'items/icon_moonstone', titanium: 'items/icon_titanium', sunstone: 'items/icon_sunstone', voidstone: 'items/icon_voidstone',
};

export function costChips(cost = {}, have = null) {
  return Object.entries(cost).map(([k, v]) =>
    h(`span.chip${have && have[k] < v ? '.lack' : ''}`, icon(RES_ICON[k], 16), v));
}

export function bar(frac, color) {
  return h('div.bar', h('i', { style: { width: `${Math.max(0, Math.min(1, frac)) * 100}%`, background: color } }));
}

export function clear(el) { while (el.firstChild) el.firstChild.remove(); return el; }

/** A pop-up card. Closable ones (onClose given, or closeX) get an ✕ in the top corner instead of a Close button. */
export function modal(content, { onClose, cls = '', closeX = !!onClose } = {}) {
  const bg = h('div.modal-bg', { onclick: e => { if (e.target === bg && (onClose || closeX)) close(); } });
  const closeBtn = closeX ? h('button.modal-x', { title: 'Close (Esc)', 'aria-label': 'Close', onclick: () => close() }, spriteAvailable('ui/close') ? icon('ui/close', 18) : '✕') : null;
  const card = h(`div.card.modal${cls ? '.' + cls : ''}`, closeBtn, content);
  bg.append(card);
  document.getElementById('ui').append(bg);
  function close() { if (!bg.isConnected) return; bg.remove(); onClose?.(); }
  return { el: card, close, closeBtn };
}

export function confirmModal(title, text, { okLabel = 'Confirm', okClass = 'primary' } = {}) {
  return new Promise(resolve => {
    const m = modal([
      h('h2', title), h('div.muted', text),
      h('div.row', h('div.spacer'),
        h('button.btn.ghost', { onclick: () => { resolve(false); m.close(); } }, 'Cancel'),
        // resolve before closing: close() fires onClose, which would resolve(false) first
        h(`button.btn.${okClass}`, { onclick: () => { resolve(true); m.close(); } }, okLabel)),
    ], { onClose: () => resolve(false) });
  });
}

export function fmt(n) {
  n = Math.floor(n);
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(1) + 'k';
  return String(n);
}

export function timeAgo(ms) {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export const GOOGLE_SVG = `<svg viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 38.2 44 33 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`;

// Esc closes the top pop-up that has an ✕
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const x = [...document.querySelectorAll('.modal-bg .modal-x')].pop();
    if (x) { e.stopImmediatePropagation(); x.click(); }
  }, true);
}
