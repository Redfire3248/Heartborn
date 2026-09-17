/*
 * The forge: crafting is a few quick minigames (inspired by Roblox's The Forge), and how well you do decides the
 * quality of what comes out.
 *
 *  Heat    hold to pump the bellows and keep the needle in the glowing zone until the bar fills
 *  Hammer  a marker swings across the bar: strike when it is on the sweet spot (better things need more strikes)
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
export function forgeMinigame({ root, title, iconKey, stages, tier = 0 }) {
  return new Promise(resolve => {
    const scores = [];
    let stageIndex = 0, raf = 0, input = null, done = false;
    const stageName = h('div.forge-stage');
    const stageHint = h('div.forge-hint');
    const arena = h('div.forge-arena');
    const dots = h('div.forge-dots', stages.map(() => h('i')));
    const verdict = h('div.forge-verdict');
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
    arena.addEventListener('pointerdown', e => { e.preventDefault(); press(true); });
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

    const say = (text, cls) => {
      verdict.textContent = text;
      verdict.className = `forge-verdict show ${cls}`;
      clearTimeout(say.t);
      say.t = setTimeout(() => { verdict.className = 'forge-verdict'; }, 650);
    };

    const next = score => {
      scores.push(score);
      dots.children[stageIndex].className = score > 0.85 ? 'perfect' : score > 0.55 ? 'good' : 'poor';
      stageIndex++;
      input = null;
      if (stageIndex >= stages.length) {
        const total = scores.reduce((a, b) => a + b, 0) / scores.length;
        say(total > 0.85 ? 'Flawless!' : total > 0.6 ? 'Well forged' : total > 0.35 ? 'It will do' : 'Botched...', total > 0.85 ? 'perfect' : total > 0.6 ? 'good' : 'poor');
        setTimeout(() => finish(total), 700);
        return;
      }
      setTimeout(() => runStage(stages[stageIndex]), 450);
    };

    const runStage = kind => {
      cancelAnimationFrame(raf);
      arena.replaceChildren();
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
      arena.append(h('div.heat-flame'), gauge, fill);
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
        total += dt;
        if (inside) inZone += dt;
        fill.firstChild.style.width = `${clamp(inZone / need) * 100}%`;
        if (inZone >= need || total > need * 3.2) { next(clamp((need / total) * 1.35)); return; }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }

    // ------------------------------------------------------------ hammer: strike on the sweet spot
    function hammer() {
      const strikes = 3 + Math.min(3, tier);
      stageName.textContent = 'Hammer it into shape';
      stageHint.textContent = `Press Space (or tap) when the marker is on the glowing spot. ${strikes} strikes.`;
      const spot = h('div.hammer-spot'), marker = h('div.hammer-marker'), count = h('div.hammer-count');
      arena.append(h('div.hammer-bar', spot, marker), count);
      let pos = 0, dir = 1, left = strikes, got = 0, speed = 0.9 + tier * 0.28, last = performance.now(), locked = 0;
      const spotW = 0.16 - tier * 0.02;
      let spotAt = 0.2 + Math.random() * 0.6;
      const place = () => { spot.style.left = `${(spotAt - spotW / 2) * 100}%`; spot.style.width = `${spotW * 100}%`; count.textContent = `${strikes - left + 1} / ${strikes}`; };
      place();
      input = down => {
        if (!down || locked > 0) return;
        const off = Math.abs(pos - spotAt) / (spotW / 2);
        const s = off <= 0.35 ? 1 : off <= 1 ? 0.75 : off <= 2 ? 0.3 : 0;
        got += s;
        play(s ? 'anvil' : 'hit');
        say(s === 1 ? 'Perfect!' : s >= 0.75 ? 'Good' : s ? 'Close' : 'Miss', s === 1 ? 'perfect' : s >= 0.75 ? 'good' : 'poor');
        arena.classList.remove('strike'); void arena.offsetWidth; arena.classList.add('strike');
        left--;
        locked = 0.18;
        if (left <= 0) { input = null; setTimeout(() => next(got / strikes), 250); return; }
        spotAt = 0.15 + Math.random() * 0.7;
        speed *= 1.08;
        place();
      };
      const tick = now => {
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        if (locked > 0) locked -= dt;
        pos += dir * speed * dt;
        if (pos > 1) { pos = 1; dir = -1; } else if (pos < 0) { pos = 0; dir = 1; }
        marker.style.left = `${pos * 100}%`;
        if (input) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }

    // ------------------------------------------------------------ quench: press as the ring meets the target
    function quench() {
      stageName.textContent = 'Quench it';
      stageHint.textContent = 'Press Space (or tap) when the shrinking ring lines up with the target circle.';
      const ring = h('div.quench-ring'), target = h('div.quench-target');
      arena.append(h('div.quench-wrap', target, ring, h('div.quench-steam')));
      const dur = 1.5 - tier * 0.15, t0 = performance.now();
      const at = 0.42;   // the target's size compared to where the ring starts
      input = down => {
        if (!down) return;
        const k = 1 - (performance.now() - t0) / 1000 / dur;
        const off = Math.abs(k - at);
        const s = off < 0.04 ? 1 : off < 0.1 ? 0.75 : off < 0.2 ? 0.35 : 0;
        play(s ? 'reveal' : 'hit');
        say(s === 1 ? 'Perfect!' : s >= 0.75 ? 'Good' : s ? 'Close' : 'Miss', s === 1 ? 'perfect' : s >= 0.75 ? 'good' : 'poor');
        arena.classList.add('steam');
        input = null;
        next(s);
      };
      const tick = now => {
        const k = 1 - (now - t0) / 1000 / dur;
        ring.style.transform = `translate(-50%, -50%) scale(${Math.max(0, k)})`;
        target.style.transform = `translate(-50%, -50%) scale(${at})`;
        if (k <= 0 && input) { input = null; say('Too late', 'poor'); next(0); return; }
        if (input) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }

    runStage(stages[0]);
  });
}
