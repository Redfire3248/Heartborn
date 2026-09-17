/*
 * The forge: crafting is a few quick minigames (inspired by Roblox's The Forge), and how well you do decides the
 * quality of what comes out.
 *
 *  Heat    hold to pump the bellows and keep the needle in the glowing zone until the bar fills
 *  Hammer  rings shrink onto the target: strike as each one lines up (better things need more strikes)
 *  Quench  press when the shrinking ring meets the target
 *
 * Space, click or tap does everything. Skip gives an ordinary result.
 */
import { h, icon } from './dom.js';
import { play } from '../core/sound.js';

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));

/**
 * Runs the minigames for a recipe. `stages` is a list of 'heat' | 'hammer' | 'quench'; `tier` (0..4) makes them harder.
 * Resolves with a score from 0 (botched) to 1 (perfect), or null if the player backs out.
 */
export function forgeMinigame({ root, title, iconKey, revealIcon = iconKey, stages, tier = 0, labels = {} }) {
  return new Promise(resolve => {
    const scores = [];
    let stageIndex = 0, raf = 0, input = null, done = false;
    const stageName = h('div.forge-stage');
    const stageHint = h('div.forge-hint');
    const arena = h('div.forge-arena');
    const dots = h('div.forge-dots', stages.map(() => h('i')));
    const verdict = h('div.forge-verdict');
    // what you are making: a black shape that fills with colour as you forge well
    const reveal = h('div.forge-reveal', icon(revealIcon, 64));
    const setReveal = partial => {
      const k = clamp((scores.reduce((a, b) => a + b, 0) + (partial || 0)) / stages.length);
      reveal.style.setProperty('--reveal', k.toFixed(3));
    };
    setReveal(0);
    const el = h('div.forge',
      h('div.forge-card',
        h('div.forge-head', icon(iconKey, 34), h('div', h('b', title), dots), h('div.spacer'),
          h('button.btn.sm.ghost', { title: 'Skip the minigames (an ordinary result)', onclick: () => finish(0.5) }, 'Skip'),
          h('button.modal-x', { title: 'Stop (nothing is used up)', onclick: () => finish(null) }, '✕')),
        stageName, stageHint, arena, verdict));
    root.append(el);

    const press = down => { if (input) input(down); };
    const onKey = e => {
      if (e.repeat && e.type === 'keydown') return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); press(e.type === 'keydown'); }
      if (e.key === 'Escape' && e.type === 'keydown') { e.stopPropagation(); finish(null); }
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKey, true);
    arena.addEventListener('pointerdown', e => { e.preventDefault(); if (input) input(true, e); });
    window.addEventListener('pointerup', () => press(false));

    function finish(score) {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', onKey, true);
      el.classList.add('leaving');
      setTimeout(() => el.remove(), 250);
      resolve(score);
    }

    /** A burst of sparks from a spot in the arena (fractions of its size). */
    const sparks = (fx, fy, n = 14, hue = '#ffcf5a') => {
      for (let i = 0; i < n; i++) {
        const sp = h('i.forge-spark');
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6, d = 30 + Math.random() * 70;
        sp.style.left = `${fx * 100}%`; sp.style.top = `${fy * 100}%`; sp.style.background = hue;
        sp.style.setProperty('--dx', `${Math.cos(a) * d}px`); sp.style.setProperty('--dy', `${Math.sin(a) * d}px`);
        arena.append(sp);
        setTimeout(() => sp.remove(), 600);
      }
    };

    /** A random spot on the weapon's shape (a solid pixel of its picture), as % of the arena. */
    let shape = null;
    const spotOnWeapon = () => {
      const img = reveal.querySelector('img');
      const ar = arena.getBoundingClientRect(), ir = img?.getBoundingClientRect();
      if (!img || !ir?.width || !ar.width) return { x: 30 + Math.random() * 40, y: 30 + Math.random() * 40 };
      try {
        if (!shape && img.complete && img.naturalWidth) {
          const c = document.createElement('canvas'); c.width = 48; c.height = 48;
          const cx = c.getContext('2d'); cx.drawImage(img, 0, 0, 48, 48);
          const d = cx.getImageData(0, 0, 48, 48).data, pts = [];
          for (let y = 4; y < 44; y++) for (let x = 4; x < 44; x++) if (d[(y * 48 + x) * 4 + 3] > 160) pts.push([x / 48, y / 48]);
          shape = pts.length ? pts : [];
        }
      } catch { shape = []; }
      const [fx, fy] = shape?.length ? shape[Math.floor(Math.random() * shape.length)] : [0.25 + Math.random() * 0.5, 0.25 + Math.random() * 0.5];
      return { x: ((ir.left - ar.left) + fx * ir.width) / ar.width * 100, y: ((ir.top - ar.top) + fy * ir.height) / ar.height * 100 };
    };

    /** A click or tap counts only on (or right next to) the ring. */
    const onTarget = (e, target) => {
      const r = target.getBoundingClientRect();
      return Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) < Math.max(40, r.width * 0.75);
    };

    const say = (text, cls) => {
      verdict.textContent = text;
      verdict.className = `forge-verdict show ${cls}`;
      clearTimeout(say.t);
      say.t = setTimeout(() => { verdict.className = 'forge-verdict'; }, 650);
    };

    const next = score => {
      scores.push(score);
      setReveal(0);
      dots.children[stageIndex].className = score > 0.85 ? 'perfect' : score > 0.55 ? 'good' : 'poor';
      stageIndex++;
      input = null;
      if (stageIndex >= stages.length) {
        const total = scores.reduce((a, b) => a + b, 0) / scores.length;
        reveal.classList.add('done');
        say(total > 0.85 ? 'Flawless!' : total > 0.6 ? 'Well forged' : total > 0.35 ? 'It will do' : 'Botched...', total > 0.85 ? 'perfect' : total > 0.6 ? 'good' : 'poor');
        setTimeout(() => finish(total), 700);
        return;
      }
      setTimeout(() => runStage(stages[stageIndex]), 450);
    };

    const runStage = kind => {
      cancelAnimationFrame(raf);
      arena.replaceChildren(reveal);
      if (kind === 'heat') heat();
      else if (kind === 'hammer') hammer();
      else quench();
    };

    // ------------------------------------------------------------ heat: hold to raise, release to cool, stay in the zone
    function heat() {
      stageName.textContent = 'Heat the metal';
      stageHint.textContent = 'Hold Space (or press and hold) to pump the bellows. Keep the needle in the glow.';
      const width = 0.26 - tier * 0.035;
      const zone = h('div.heat-zone'), needle = h('div.heat-needle'), fill = h('div.heat-fill', h('i'));
      const gauge = h('div.heat-gauge', zone, needle);
      arena.append(h('div.heat-coals'), h('div.heat-flame'), gauge, fill);
      let temp = 0.1, vel = 0, holding = false, inZone = 0, total = 0, center = 0.55 + (Math.random() - 0.5) * 0.2, last = performance.now();
      const need = 1.6 + tier * 0.25;
      input = down => { holding = down; };
      const tick = now => {
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        vel += (holding ? 1.9 : -1.5) * dt;
        vel *= 0.93;
        temp = clamp(temp + vel * dt * 2.2);
        if (temp <= 0 || temp >= 1) vel *= -0.2;
        center = clamp(center + Math.sin(now / 700) * dt * (0.04 + tier * 0.03), 0.3, 0.8);   // the sweet heat drifts
        zone.style.left = `${(center - width / 2) * 100}%`; zone.style.width = `${width * 100}%`;
        needle.style.left = `${temp * 100}%`;
        const inside = Math.abs(temp - center) < width / 2;
        gauge.classList.toggle('hot', inside);
        if (holding && Math.random() < dt * 18) sparks(0.3 + Math.random() * 0.4, 0.95, 1, '#ff9a3a');
        total += dt;
        if (inside) inZone += dt;
        fill.firstChild.style.width = `${clamp(inZone / need) * 100}%`;
        if (inZone >= need || total > need * 3.2) { next(clamp((need / total) * 1.35)); return; }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }

    // ------------------------------------------------------------ hammer: a ring shrinks onto the anvil, strike as it meets the target (once per strike)
    function hammer() {
      const strikes = 3 + Math.min(2, tier);
      stageName.textContent = 'Hammer it into shape';
      stageHint.textContent = `Press Space (or tap) when the ring lines up with the target circle. ${strikes} strikes.`;
      const ring = h('div.quench-ring.hammer-ring'), target = h('div.quench-target.hammer-target'), count = h('div.hammer-count');
      const hammerIcon = h('div.forge-hammer');
      arena.append(h('div.quench-wrap', target, ring), hammerIcon, count);
      const moveTo = () => { const { x, y } = spotOnWeapon(); for (const el of [target, ring]) { el.style.left = `${x}%`; el.style.top = `${y}%`; } };
      moveTo();
      const at = 0.42;
      let left = strikes, got = 0, t0 = performance.now(), dur = 1.6 - tier * 0.1, wait = 0;
      const begin = () => { t0 = performance.now(); wait = 0; moveTo(); ring.style.transform = 'translate(-50%, -50%) scale(1)'; count.textContent = `${strikes - left + 1} / ${strikes}`; };
      begin();
      const strike = s => {
        got += s;
        setReveal(got / strikes);
        play(s ? 'anvil' : 'hit');
        say(s === 1 ? 'Perfect!' : s >= 0.75 ? 'Good' : s ? 'Close' : 'Miss', s === 1 ? 'perfect' : s >= 0.75 ? 'good' : 'poor');
        arena.classList.remove('strike'); void arena.offsetWidth; arena.classList.add('strike');
        hammerIcon.classList.remove('swing'); void hammerIcon.offsetWidth; hammerIcon.classList.add('swing');
        sparks(parseFloat(target.style.left) / 100, parseFloat(target.style.top) / 100, s === 1 ? 26 : s ? 14 : 5, s === 1 ? '#fff4a0' : s ? '#ffb347' : '#8a8a8a');
        left--;
        if (left <= 0) { input = null; setTimeout(() => next(got / strikes), 300); return; }
        wait = performance.now() + 380;   // a short breath before the next ring
        dur = Math.max(0.9, dur * 0.95);
      };
      input = (down, e) => {
        if (!down || wait || (e && !onTarget(e, target))) return;
        const k = 1 - (performance.now() - t0) / 1000 / dur;
        const off = Math.abs(k - at);
        strike(off < 0.05 ? 1 : off < 0.12 ? 0.75 : off < 0.22 ? 0.35 : 0);
      };
      const tick = now => {
        if (!input) return;
        if (wait) {
          ring.style.opacity = '0';
          if (now >= wait) { ring.style.opacity = ''; begin(); }
        } else {
          const k = 1 - (now - t0) / 1000 / dur;
          ring.style.transform = `translate(-50%, -50%) scale(${Math.max(0, k)})`;
          const near = Math.abs(k - at) < 0.12;
          target.classList.toggle('on-spot', near); ring.classList.toggle('on-spot', near);
          if (k <= 0) strike(0);
        }
        target.style.transform = `translate(-50%, -50%) scale(${at})`;
        if (input) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }

    // ------------------------------------------------------------ quench: press as the ring meets the target
    function quench() {
      stageName.textContent = labels.quench || 'Quench it';
      stageHint.textContent = 'Press Space (or tap) when the shrinking ring lines up with the target circle.';
      const ring = h('div.quench-ring'), target = h('div.quench-target');
      arena.append(h('div.quench-wrap', target, ring, h('div.quench-steam')));
      { const { x, y } = spotOnWeapon(); for (const el of [target, ring]) { el.style.left = `${x}%`; el.style.top = `${y}%`; } }
      const dur = 1.5 - tier * 0.15, t0 = performance.now();
      const at = 0.42;   // the target's size compared to where the ring starts
      input = (down, e) => {
        if (!down || (e && !onTarget(e, target))) return;
        const k = 1 - (performance.now() - t0) / 1000 / dur;
        const off = Math.abs(k - at);
        const s = off < 0.04 ? 1 : off < 0.1 ? 0.75 : off < 0.2 ? 0.35 : 0;
        play(s ? 'reveal' : 'hit');
        say(s === 1 ? 'Perfect!' : s >= 0.75 ? 'Good' : s ? 'Close' : 'Miss', s === 1 ? 'perfect' : s >= 0.75 ? 'good' : 'poor');
        arena.classList.add('steam');
        sparks(0.5, 0.5, 18, s ? '#bfe6ff' : '#8a8a8a');
        input = null;
        next(s);
      };
      const tick = now => {
        const k = 1 - (now - t0) / 1000 / dur;
        ring.style.transform = `translate(-50%, -50%) scale(${Math.max(0, k)})`;
        target.style.transform = `translate(-50%, -50%) scale(${at})`;
        const near = Math.abs(k - at) < 0.1;
        target.classList.toggle('on-spot', near); ring.classList.toggle('on-spot', near);
        if (k <= 0 && input) { input = null; say('Too late', 'poor'); next(0); return; }
        if (input) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }

    runStage(stages[0]);
  });
}
