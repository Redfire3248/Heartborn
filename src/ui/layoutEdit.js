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
  { sel: '.vitals-strip', name: 'Health' },
  { sel: '.topbar', name: 'Resources' },
  { sel: '.dock', name: 'Menu' },
  { sel: '.minimap', name: 'Minimap' },
];

const orient = () => (innerWidth > innerHeight ? 'land' : 'port');
const storeKey = (o = orient()) => `hb-layout-${o}`;

function load(o = orient()) {
  try { return JSON.parse(localStorage.getItem(storeKey(o)) || '{}') || {}; } catch { return {}; }
}
function save(layout) {
  try { localStorage.setItem(storeKey(), JSON.stringify(layout)); } catch {}
  writeSheet();
}

/*
 * How a saved spot is put on screen.
 *
 * This used to write inline styles on each control, measured from its size at that moment, and re-apply them on
 * a timer and on every resize. That fought everything else: the stick wiped them when you let go of it, a control
 * that was hidden when it was placed was measured at zero size and landed half a width off, and a phone fires a
 * resize every time the address bar moves - so controls kept flicking between the default spot and yours.
 *
 * Now the layout is one stylesheet. Each spot is the control's centre as a percentage of the screen, and
 * translate(-50%, -50%) centres the control on it whatever its size, so nothing is measured and nothing needs
 * re-applying. Both orientations live in it side by side under orientation media queries, so turning the phone
 * switches layouts instantly with no script at all. The selectors carry an id, so they outrank every
 * phone/landscape rule in style.css however many !importants those have.
 */
const pct = v => `${(Math.max(0, Math.min(1, v)) * 100).toFixed(3)}%`;
function rulesFor(layout) {
  let css = '';
  for (const { sel } of LAYOUT_ITEMS) {
    const spot = layout[sel];
    if (!spot) continue;
    const s = spot.s || 1;
    css += `html body #ui ${sel}${sel === '.hero-stick' ? ', html body #ui .hero-stick.grabbed' : ''} {`
      + ` left: ${pct(spot.x)} !important; top: ${pct(spot.y)} !important; right: auto !important; bottom: auto !important;`
      + ` margin: 0 !important; transform-origin: 50% 50% !important;`
      // a placed control must never glide there: only its colours and glow may animate, never where it is
      + ` transition-property: opacity, background-color, border-color, box-shadow, filter !important;`
      + ` transform: translate(-50%, -50%)${s === 1 ? '' : ` scale(${s})`} !important; }
`;
  }
  return css;
}
/** `live` is the editor's unsaved layout for the screen being held, so a drag moves the control as you go. */
function writeSheet(live = null) {
  let tag = document.getElementById('hb-layout');
  if (!tag) { tag = document.createElement('style'); tag.id = 'hb-layout'; document.head.append(tag); }
  const o = orient();
  const land = live && o === 'land' ? live : load('land'), port = live && o === 'port' ? live : load('port');
  const css = `@media (orientation: landscape) {
${rulesFor(land)}}
@media (orientation: portrait) {
${rulesFor(port)}}
`;
  if (tag.textContent !== css) tag.textContent = css;
}

/** True when the player has put this control somewhere of their own on the screen they are holding. */
export const isLaidOut = sel => !!load()[sel];

/** Kept for callers: the stylesheet does the work, so this only makes sure it is written. */
export function applyLayout() { writeSheet(); }

let watching = false;
/** Writes the layout once. There is nothing to watch any more: CSS follows rotation and resizing by itself. */
export function watchLayout() {
  if (watching) return;
  watching = true;
  // clear what the old inline-style version may have left on the controls
  for (const el of document.querySelectorAll('[data-laid]')) {
    for (const p of ['left', 'top', 'right', 'bottom', 'transform', 'transform-origin', 'margin']) el.style.removeProperty(p);
    delete el.dataset.laid;
  }
  writeSheet();
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
        start = { px: e.clientX, py: e.clientY, cx: cur.left + cur.width / 2, cy: cur.top + cur.height / 2, w: Math.min(cur.width, innerWidth), h: Math.min(cur.height, innerHeight), id: e.pointerId };
        for (const b of boxes.children) b.classList.toggle('on', b === box);
      });
      box.addEventListener('pointermove', e => {
        if (!start || e.pointerId !== start.id) return;
        // keep the whole control on screen: its centre can go no closer to an edge than half its own size
        const hw = start.w / 2, hh = start.h / 2;
        const cx = Math.max(hw, Math.min(innerWidth - hw, start.cx + e.clientX - start.px));
        const cy = Math.max(hh, Math.min(innerHeight - hh, start.cy + e.clientY - start.py));
        layout[item.sel] = { ...(layout[item.sel] || {}), x: cx / innerWidth, y: cy / innerHeight };
        writeSheet(layout);
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
        if (selected) { delete layout[selected]; save(layout); }
        refresh();
      } }, 'Reset one'),
      h('button.btn.sm', { onclick: () => {
        for (const k of Object.keys(layout)) delete layout[k];
        save(layout);
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
