/*
 * Screen layout editor: drag the on-screen controls (stick, buttons, hotbar, health...) wherever you like and resize them.
 * Saved on this device, separately for upright (portrait) and sideways (landscape) screens.
 */
import { h } from './dom.js';

/** What can be moved. Each is found by its selector; missing or hidden ones are skipped. */
export const LAYOUT_ITEMS = [
  { sel: '.hero-stick', name: 'Stick' },
  { sel: '.hero-act', name: 'Attack' },
  { sel: '.hero-dash', name: 'Dash' },
  { sel: '.hero-block', name: 'Block' },
  { sel: '.hero-potion', name: 'Potion' },
  { sel: '.hero-ability', name: 'Skill' },
  { sel: '.hotbar-wrap', name: 'Hotbar' },
  { sel: '.hero-bar', name: 'Health' },
  { sel: '.lead-btn', name: 'Character' },
  { sel: '.topbar', name: 'Resources' },
  { sel: '.dock', name: 'Menu' },
  { sel: '.minimap', name: 'Minimap' },
];

const PROPS = ['left', 'top', 'right', 'bottom', 'transform', 'transform-origin', 'margin'];
const orient = () => (innerWidth > innerHeight ? 'land' : 'port');
const storeKey = () => `hb-layout-${orient()}`;

function load() {
  try { return JSON.parse(localStorage.getItem(storeKey()) || '{}') || {}; } catch { return {}; }
}
function save(layout) {
  try { localStorage.setItem(storeKey(), JSON.stringify(layout)); } catch {}
}

/** Puts one element at its saved spot: (x, y) is its centre as a fraction of the screen, s its size. */
function place(el, spot) {
  for (const p of PROPS) el.style.removeProperty(p);
  if (!spot) { delete el.dataset.laid; return; }
  const s = spot.s || 1;
  el.style.setProperty('transform', 'none', 'important');   // measure at normal size first
  const r = el.getBoundingClientRect();
  const w = r.width * s, hgt = r.height * s;
  const left = Math.max(0, Math.min(innerWidth - w, spot.x * innerWidth - w / 2));
  const top = Math.max(0, Math.min(innerHeight - hgt, spot.y * innerHeight - hgt / 2));
  el.style.setProperty('left', `${Math.round(left)}px`, 'important');
  el.style.setProperty('top', `${Math.round(top)}px`, 'important');
  el.style.setProperty('right', 'auto', 'important');
  el.style.setProperty('bottom', 'auto', 'important');
  el.style.setProperty('margin', '0', 'important');
  el.style.setProperty('transform-origin', '0 0', 'important');
  el.style.setProperty('transform', s === 1 ? 'none' : `scale(${s})`, 'important');
  el.dataset.laid = `${orient()}${spot.x}${spot.y}${s}`;
}

/** Applies the saved layout to whatever is on screen now (elements that were rebuilt get placed again). */
export function applyLayout(root = document) {
  const layout = load();
  for (const { sel } of LAYOUT_ITEMS) {
    const spot = layout[sel];
    for (const el of root.querySelectorAll(`#ui ${sel}`)) {
      const stamp = spot ? `${orient()}${spot.x}${spot.y}${spot.s || 1}` : undefined;
      if (el.dataset.laid === stamp) continue;
      place(el, spot);
    }
  }
}

let watching = false;
/** Keeps the layout applied: on rotate/resize and when the game rebuilds a control. */
export function watchLayout() {
  if (watching) return;
  watching = true;
  const again = () => { for (const el of document.querySelectorAll('[data-laid]')) delete el.dataset.laid; applyLayout(); };
  addEventListener('resize', again);
  addEventListener('orientationchange', () => setTimeout(again, 250));
  setInterval(() => applyLayout(), 800);
  applyLayout();
}

const visible = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };

/** Opens the editor: drag boxes to move, pick one to resize it, Reset or Done. */
export function openLayoutEditor(onClose) {
  document.querySelector('.layout-edit')?.remove();
  const layout = load();
  let selected = null;
  const boxes = h('div.layout-boxes');
  const size = h('input', { type: 'range', min: '0.5', max: '1.8', step: '0.05', value: '1', disabled: true });
  const sizeLabel = h('span.layout-name', 'Tap a control');
  const refresh = () => {
    boxes.replaceChildren();
    for (const item of LAYOUT_ITEMS) {
      const el = [...document.querySelectorAll(`#ui ${item.sel}`)].find(visible);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const box = h(`div.layout-box${selected === item.sel ? '.on' : ''}`, {
        style: { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, zIndex: String(Math.max(1, 100000 - Math.round(r.width * r.height / 10))) },
      }, h('span', item.name));   // small controls sit on top of big ones so they can always be grabbed
      let start = null;
      box.addEventListener('pointerdown', e => {
        e.preventDefault(); e.stopPropagation();
        try { box.setPointerCapture(e.pointerId); } catch {}
        select(item);
        const cur = el.getBoundingClientRect();
        start = { px: e.clientX, py: e.clientY, cx: cur.left + cur.width / 2, cy: cur.top + cur.height / 2, id: e.pointerId };
        for (const b of boxes.children) b.classList.toggle('on', b === box);
      });
      box.addEventListener('pointermove', e => {
        if (!start || e.pointerId !== start.id) return;
        const x = (start.cx + e.clientX - start.px) / innerWidth, y = (start.cy + e.clientY - start.py) / innerHeight;
        layout[item.sel] = { ...(layout[item.sel] || {}), x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
        place(el, layout[item.sel]);
        const nr = el.getBoundingClientRect();
        Object.assign(box.style, { left: `${nr.left}px`, top: `${nr.top}px`, width: `${nr.width}px`, height: `${nr.height}px` });
      });
      const end = () => { if (start) { start = null; save(layout); } };
      box.addEventListener('pointerup', end);
      box.addEventListener('pointercancel', end);
      boxes.append(box);
    }
  };
  const select = item => {
    selected = item.sel;
    sizeLabel.textContent = item.name;
    size.disabled = false;
    size.value = String(layout[item.sel]?.s || 1);
  };
  size.addEventListener('input', () => {
    if (!selected) return;
    const el = [...document.querySelectorAll(`#ui ${selected}`)].find(visible);
    if (!el) return;
    if (!layout[selected]) { const r = el.getBoundingClientRect(); layout[selected] = { x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height / 2) / innerHeight }; }
    layout[selected].s = Number(size.value);
    place(el, layout[selected]);
    save(layout);
    refresh();
  });
  const close = () => { wrap.remove(); removeEventListener('resize', onResize); onClose?.(); };
  const bar = h('div.layout-bar',
    h('div.layout-title', { title: 'Tap to move this panel out of the way', onclick: () => bar.classList.toggle('up') }, 'Move controls ', h('span.faint', '(tap to move this box)')),
    h('div.faint.layout-tip', `Drag to move, pick one to resize. Saved for ${orient() === 'land' ? 'sideways' : 'upright'} screens on this device.`),
    h('label.layout-size', sizeLabel, size),
    h('div.row',
      h('button.btn.sm', { onclick: () => {
        if (selected) { delete layout[selected]; save(layout); for (const el of document.querySelectorAll(`#ui ${selected}`)) place(el, null); }
        refresh();
      } }, 'Reset one'),
      h('button.btn.sm', { onclick: () => {
        for (const k of Object.keys(layout)) delete layout[k];
        save(layout);
        for (const el of document.querySelectorAll('[data-laid]')) place(el, null);
        selected = null; size.disabled = true; sizeLabel.textContent = 'Tap a control';
        refresh();
      } }, 'Reset all'),
      h('button.btn.sm.primary', { onclick: close }, 'Done')));
  const wrap = h('div.layout-edit', boxes, bar);
  const onResize = () => setTimeout(refresh, 300);
  addEventListener('resize', onResize);
  document.getElementById('ui').append(wrap);
  refresh();
}
