import { h, icon } from './dom.js';

/*
 * Drag an item like a keychain: it hangs from a ring under the cursor and swings with your
 * movement (a damped pendulum driven by the cursor's acceleration). Drop it on a target to give it;
 * drop it on open ground to lay it there (onGround); anywhere else it springs back to where it came from.
 *
 * startItemDrag(event, { iconKey, label, count, findTarget(x, y) → { name } | null, onDrop(target) })
 */

let active = null;

export function startItemDrag(e, opts) {
  if (active) return;
  e.preventDefault();
  const startX = e.clientX, startY = e.clientY;
  let started = false;

  const begin = () => {
    started = true;
    const hint = h('div.drag-hint', '');
    const el = h('div.drag-keychain',
      h('div.drag-ring'),
      h('div.drag-swing',
        h('div.drag-cord'),
        h('div.drag-item', icon(opts.iconKey, 34), opts.count > 1 ? h('span.drag-count', `×${opts.count}`) : null)),
      hint);
    document.body.append(el);
    document.body.classList.add('dragging-item');
    active = {
      el, hint, swing: el.querySelector('.drag-swing'),
      x: startX, y: startY, px: startX, vx: 0, lastVx: 0,
      angle: 0, spin: 0, target: null, raf: 0, last: performance.now(),
      home: { x: startX, y: startY },
    };
    tick();
  };

  const move = ev => {
    if (!started) {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 5) return;   // a plain click is not a drag
      begin();
    }
    active.x = ev.clientX;
    active.y = ev.clientY;
    const t = opts.findTarget?.(ev.clientX, ev.clientY) || null;
    active.target = t;
    active.ground = t ? null : opts.groundAt?.(ev.clientX, ev.clientY) || null;
    active.el.classList.toggle('over-target', !!t);
    active.hint.textContent = t ? `Give to ${t.name}` : active.ground ? 'Drop on the ground' : 'Drop on a villager';
  };

  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    if (!started) return;
    const a = active;
    document.body.classList.remove('dragging-item');
    if (a.target) {
      opts.onDrop?.(a.target);
      a.el.classList.add('dropped');
      setTimeout(() => finish(a), 260);
    } else if (a.ground && opts.onGround) {
      opts.onGround(a.ground);
      a.el.classList.add('dropped');
      setTimeout(() => finish(a), 260);
    } else {
      // spring back home
      a.returning = true;
      a.el.classList.add('returning');
      a.x = a.home.x; a.y = a.home.y;
      setTimeout(() => finish(a), 320);
    }
  };

  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

function finish(a) {
  cancelAnimationFrame(a.raf);
  a.el.remove();
  if (active === a) active = null;
}

function tick() {
  const a = active;
  if (!a) return;
  const now = performance.now();
  const dt = Math.min(0.05, (now - a.last) / 1000);
  a.last = now;

  // cursor velocity and acceleration (horizontal drives the swing, vertical adds a little bounce)
  const vx = (a.x - a.px) / Math.max(dt, 0.001);
  const ax = (vx - a.lastVx) / Math.max(dt, 0.001);
  a.px = a.x;
  a.lastVx = vx;

  // damped pendulum: gravity pulls it straight, the cursor's acceleration kicks it the other way
  const k = 38, damping = 4.2;
  a.spin += (-k * Math.sin(a.angle) - damping * a.spin - ax * 0.0022) * dt;
  a.angle += a.spin * dt;
  a.angle = Math.max(-1.3, Math.min(1.3, a.angle));

  a.el.style.transform = `translate(${a.x}px, ${a.y}px)`;
  a.swing.style.transform = `rotate(${a.angle}rad)`;
  a.raf = requestAnimationFrame(tick);
}
