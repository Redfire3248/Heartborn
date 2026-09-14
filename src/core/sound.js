/*
 * Sound, made in the browser (no audio files to download): small effects and a calm ambient tune.
 * Volumes live in localStorage. Audio only starts after the player's first tap/click (browser rule).
 */

const KEY = 'hb_sound';
const settings = (() => {
  try { return { master: 0.7, sfx: 0.8, music: 0.35, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { master: 0.7, sfx: 0.8, music: 0.35 }; }
})();

let ctx = null, master = null, sfxBus = null, musicBus = null, musicTimer = null;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain(); master.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.connect(master);
  musicBus = ctx.createGain(); musicBus.connect(master);
  applyVolumes();
  return ctx;
}

function applyVolumes() {
  if (!ctx) return;
  master.gain.value = settings.master;
  sfxBus.gain.value = settings.sfx;
  musicBus.gain.value = settings.music;
}

export const soundSettings = () => ({ ...settings });
export function setVolume(kind, value) {
  settings[kind] = Math.max(0, Math.min(1, Number(value) || 0));
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* private mode */ }
  applyVolumes();
  if (kind === 'music' || kind === 'master') { if (settings.music > 0 && settings.master > 0) startMusic(); else stopMusic(); }
}

/** Call once: audio unlocks on the first interaction, and UI buttons click softly. */
export function setupSound() {
  const unlock = () => {
    const c = ensure();
    if (c?.state === 'suspended') c.resume();
    if (settings.music > 0 && settings.master > 0) startMusic();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  document.addEventListener('click', e => { if (e.target.closest?.('button, .bcard, .set-item')) play('click'); }, true);
}

function tone({ freq = 440, to = null, type = 'sine', dur = 0.15, vol = 0.3, attack = 0.005, delay = 0, bus = sfxBus }) {
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(bus);
  o.start(t); o.stop(t + dur + 0.02);
}

function noise({ dur = 0.2, vol = 0.25, filter = 800, delay = 0 }) {
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime + delay;
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = buf; f.type = 'lowpass'; f.frequency.value = filter; g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(sfxBus);
  src.start(t);
}

const SOUNDS = {
  click: () => tone({ freq: 660, to: 520, type: 'triangle', dur: 0.05, vol: 0.12 }),
  build: () => { noise({ dur: 0.08, vol: 0.3, filter: 1200 }); tone({ freq: 180, to: 120, type: 'square', dur: 0.08, vol: 0.08 }); },
  complete: () => [523, 659, 784].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.22, vol: 0.18, delay: i * 0.08 })),
  coin: () => { tone({ freq: 988, type: 'square', dur: 0.06, vol: 0.08 }); tone({ freq: 1319, type: 'square', dur: 0.12, vol: 0.08, delay: 0.06 }); },
  birth: () => [784, 988, 1175].forEach((f, i) => tone({ freq: f, type: 'sine', dur: 0.3, vol: 0.12, delay: i * 0.1 })),
  death: () => [392, 330, 262].forEach((f, i) => tone({ freq: f, type: 'sine', dur: 0.45, vol: 0.12, delay: i * 0.18 })),
  danger: () => { for (let i = 0; i < 3; i++) tone({ freq: 440, to: 330, type: 'sawtooth', dur: 0.16, vol: 0.09, delay: i * 0.2 }); },
  hit: () => { noise({ dur: 0.07, vol: 0.2, filter: 2000 }); tone({ freq: 150, to: 60, type: 'square', dur: 0.08, vol: 0.1 }); },
  boom: () => { noise({ dur: 0.6, vol: 0.5, filter: 400 }); tone({ freq: 90, to: 30, type: 'sine', dur: 0.5, vol: 0.4 }); },
  ability: () => [440, 554, 659, 880].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.18, vol: 0.12, delay: i * 0.05 })),
  demolish: () => { noise({ dur: 0.35, vol: 0.35, filter: 600 }); tone({ freq: 110, to: 50, type: 'square', dur: 0.3, vol: 0.08 }); },
  undo: () => tone({ freq: 700, to: 420, type: 'triangle', dur: 0.12, vol: 0.12 }),
  notify: () => { tone({ freq: 880, type: 'sine', dur: 0.12, vol: 0.12 }); tone({ freq: 1175, type: 'sine', dur: 0.2, vol: 0.1, delay: 0.1 }); },
};

let lastPlayed = {};
export function play(name) {
  if (!ctx || !SOUNDS[name] || settings.master <= 0 || settings.sfx <= 0) return;
  const now = performance.now();
  if (now - (lastPlayed[name] || 0) < 60) return;   // never stack the same sound
  lastPlayed[name] = now;
  try { SOUNDS[name](); } catch { /* audio is optional */ }
}

// calm pentatonic ambient: a soft pad and a slow wandering melody
const SCALE = [220, 247, 277, 330, 370, 440, 494, 554, 659];
function startMusic() {
  if (!ensure() || musicTimer || ctx.state !== 'running') return;
  let step = 0;
  const bar = () => {
    const root = SCALE[[0, 3, 5, 2][Math.floor(step / 4) % 4]];
    if (step % 4 === 0) [1, 1.5, 2].forEach(m => tone({ freq: root * m / 2, type: 'sine', dur: 3.6, vol: 0.05, attack: 0.9, bus: musicBus }));
    if (Math.random() < 0.7) tone({ freq: SCALE[Math.floor(Math.random() * SCALE.length)], type: 'triangle', dur: 1.1, vol: 0.035, attack: 0.08, bus: musicBus });
    step++;
  };
  bar();
  musicTimer = setInterval(bar, 900);
}
function stopMusic() { clearInterval(musicTimer); musicTimer = null; }
