import { h, icon, avatar, GOOGLE_SVG, modal, fmt } from './dom.js';
import { friendlyAuthError } from '../net/firebase.js';
import { installApp, canInstall, waitForInstallOffer, onInstallChange, isIOS, isInstalled } from '../core/pwa.js';
import { BUILD } from '../core/version.js';

const ui = () => document.getElementById('ui');

/** "Install app" button: only visible when the browser allows installing. */
export function installButton(cls = 'button.btn.sm.install-btn') {
  const btn = h(cls, { onclick: async () => {
    if (!canInstall() && !isIOS()) await waitForInstallOffer();
    const r = canInstall() ? await installApp() : isIOS() ? 'ios' : 'manual';
    if (r === 'manual') {   // no install prompt from this browser: say how to do it by hand
      const m = modal([
        h('h2', 'Install Heartborn'),
        h('div.muted', 'Your browser did not offer the install window. This usually means Heartborn is already installed on this device (look for it in your apps, or an “Open in app” icon in the address bar), or you closed the install window before so the browser is holding it back for a while, or this browser does not support installing (Firefox, some in-app browsers).'),
        h('div.muted', { style: { marginTop: '8px' } }, 'To install by hand: in Chrome or Edge, click the install icon at the right of the address bar, or open the menu (three dots) and choose “Install Heartborn” or “Add to Home screen”.'),
        h('button.btn.primary', { onclick: () => m.close() }, 'Got it'),
      ]);
      return;
    }
    if (r === 'ios') {
      const m = modal([
        h('h2', 'Install Heartborn'),
        h('div.muted', 'On iPhone or iPad: tap the Share button (the square with an arrow) at the bottom of Safari, then choose “Add to Home Screen”.'),
        h('button.btn.primary', { onclick: () => m.close() }, 'Got it'),
      ]);
    }
  } }, h('img', { src: 'icons/app-32.png', width: 18, height: 18, alt: '', style: { imageRendering: 'pixelated', borderRadius: '4px' } }), 'Install app');
  const sync = () => { btn.hidden = isInstalled(); };   // always offered, unless the game already runs as an installed app
  sync();
  onInstallChange(sync);
  return btn;
}

export function loadingScreen() {
  const fill = h('i');
  const text = h('div.muted', 'Kindling the fire…');
  const el = h('div.screen.loading',
    h('div.logo', h('img.logo-mark', { src: 'icons/app-192.png', alt: '' }), h('h1', 'HEARTBORN')),
    h('div.load-bar', fill),
    text);
  ui().append(el);
  return {
    progress(p, label) { fill.style.width = `${Math.round(p * 100)}%`; if (label) text.textContent = label; },
    remove() { el.style.transition = 'opacity .4s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 400); },
  };
}

/**
 * Title screen over a live demo world. Sign in with Google or email + password.
 * Players are shown by username only — never by email.
 */
export function loginScreen({ user, onSignIn, onEmailSignIn, onCreateAccount, onResetPassword, onPlay, onSignOut }) {
  const error = h('div.error-text');
  const vignette = h('div.vignette');
  const card = h('div.card.login-card');
  const root = h('div.screen.login',
    h('div.logo',
      h('h1', 'HEARTBORN'),
      h('div.tagline', h('span', 'One hero. Endless adventure.'), h('br'), h('span', 'Fight, explore, delve and build your home.'))),
    card,
    installButton('button.btn.install-btn'));
  const footer = h('div.footer-note', `A pixel-art action adventure · Your hero is saved to the cloud · v${BUILD.version}`);
  ui().append(vignette, root, footer);
  let mode = 'signin';   // signin | create

  const busy = async (btn, fn) => {
    btn.disabled = true;
    error.textContent = '';
    error.style.color = '';
    try { await fn(); } catch (e) { error.textContent = friendlyAuthError(e); } finally { btn.disabled = false; }
  };

  function render(u, username) {
    card.replaceChildren();
    if (!u) {
      const google = h('button.google-btn', { html: `${GOOGLE_SVG}<span>Continue with Google</span>` });
      google.onclick = () => busy(google, onSignIn);

      const email = h('input.input', { type: 'email', placeholder: 'Email', autocomplete: 'email' });
      const pass = h('input.input', { type: 'password', placeholder: 'Password (6+ characters)', autocomplete: mode === 'create' ? 'new-password' : 'current-password' });
      const submit = h('button.btn.primary', { type: 'submit', style: { padding: '11px' } }, mode === 'create' ? 'Create account' : 'Sign in');
      const form = h('form.col', {
        onsubmit: e => {
          e.preventDefault();
          busy(submit, () => (mode === 'create' ? onCreateAccount : onEmailSignIn)(email.value, pass.value));
        },
      }, email, pass, submit);
      const forgot = h('button.link', {
        type: 'button',
        onclick: () => busy(forgot, async () => {
          if (!email.value.trim()) throw new Error('Type your email above first.');
          await onResetPassword(email.value);
          error.style.color = 'var(--good)';
          error.textContent = 'Password reset email sent.';
        }),
      }, 'Forgot password?');
      const toggle = h('button.link', { type: 'button', onclick: () => { mode = mode === 'create' ? 'signin' : 'create'; error.textContent = ''; render(null); } },
        mode === 'create' ? 'Have an account? Sign in' : 'New here? Create an account');

      card.append(
        h('div.features',
          h('div.feature', icon('gear/sword_legendary', 34), 'Fight & loot'),
          h('div.feature', icon('dungeon/cave_entrance', 34), 'Delve dungeons'),
          h('div.feature', icon('ui/home', 34), 'Build your home')),
        google,
        h('div.divider', h('span', 'or')),
        form,
        h('div.row', { style: { justifyContent: 'space-between' } }, toggle, mode === 'signin' ? forgot : null),
        error);
    } else {
      const play = h('button.btn.primary', { style: { padding: '14px', fontSize: '18px' } }, '🔥 Enter your realm');
      play.onclick = async () => {
        play.disabled = true;
        try { await onPlay(); } catch (e) { error.textContent = friendlyAuthError(e); play.disabled = false; }
      };
      card.append(
        h('div.user-pill',
          username ? avatar(username, 38) : icon('characters/king', 38),
          h('div', h('div', { style: { fontWeight: 700 } }, username || 'New here'), h('div.faint', username ? 'Welcome back' : 'You will choose a name next')),
          h('div.spacer'),
          h('button.btn.sm.ghost', { onclick: onSignOut }, 'Switch')),
        play, error);
    }
  }
  render(user);
  return {
    update: render,
    remove() { root.remove(); vignette.remove(); footer.remove(); },
  };
}

/** First-time players pick a unique username. `claim(name)` reserves it or throws. */
const backBtn = onclick => h('button.btn.sm.ghost.back-btn', { onclick }, '← Back');

export function chooseUsername(claim, { onBack } = {}) {
  return new Promise(resolve => {
    const input = h('input.input', { maxLength: 16, placeholder: 'e.g. Ironfist', autocomplete: 'off' });
    const err = h('div.error-text');
    const btn = h('button.btn.primary', { style: { padding: '12px' } }, 'Claim this name');
    const go = async () => {
      btn.disabled = true;
      btn.textContent = 'Claiming…';
      err.textContent = '';
      // a name is claimed against the server, and a bad connection must not leave you staring at a dead button
      const slow = setTimeout(() => { err.textContent = 'Still trying… your connection is slow.'; }, 6000);
      try {
        const name = await Promise.race([
          claim(input.value),
          new Promise((_, rej) => setTimeout(() => rej(new Error('The server did not answer. Check your connection and try again.')), 20000)),
        ]);
        clearTimeout(slow);
        m.close();
        resolve(name);
      } catch (e) {
        clearTimeout(slow);
        err.textContent = friendlyAuthError(e);
        btn.disabled = false;
        btn.textContent = 'Claim this name';
      }
    };
    btn.onclick = go;
    input.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    const m = modal([
      onBack ? backBtn(() => { m.close(); resolve(null); onBack(); }) : null,
      h('div', { style: { textAlign: 'center' } }, icon('items/crown_leader', 64)),
      h('h2', { style: { textAlign: 'center' } }, 'What shall they call you?'),
      h('div.muted', { style: { textAlign: 'center' } }, 'This is the name every other player will know you by. 3–16 letters, numbers or _.'),
      h('div.field', h('label', 'Username'), input),
      err, btn,
    ].filter(Boolean));
    setTimeout(() => input.focus(), 50);
  });
}

/** Resolves with the village name, or null when Back is pressed (only offered with onBack). */
export function nameVillage(defaultName, { onBack = false } = {}) {
  return new Promise(resolve => {
    const input = h('input.input', { value: defaultName, maxLength: 24, placeholder: 'Village name' });
    const go = () => { const v = input.value.trim(); if (v) { m.close(); resolve(v); } };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    const m = modal([
      onBack ? backBtn(() => { m.close(); resolve(null); }) : null,
      h('div', { style: { textAlign: 'center' } }, icon('characters/man', 64), icon('characters/woman', 64), icon('characters/man', 64)),
      h('h2', { style: { textAlign: 'center' } }, 'A New Beginning'),
      h('div.muted', { style: { textAlign: 'center' } }, 'Three ordinary humans wake beside a cold hearth. No tools. No shelter. Just each other — and you.'),
      h('div.field', h('label', 'Name your village'), input),
      h('button.btn.primary', { onclick: go, style: { padding: '12px' } }, 'Light the first fire'),
    ].filter(Boolean));
    setTimeout(() => input.select(), 50);
  });
}

export function bannedScreen(ban, onSignOut) {
  ui().append(h('div.screen', { style: { background: '#0c0812ee' } },
    h('div.card.login-card',
      icon('items/karma_evil', 72),
      h('h2', 'Banished'),
      h('div.muted', 'Your account has been banned from Heartborn.'),
      h('div', h('b', 'Reason: '), ban.reason || '—'),
      h('button.btn', { onclick: onSignOut }, 'Sign out'))));
}

export function offlineSummary(sum) {
  const mins = Math.round(sum.seconds / 60);
  const lines = Object.entries(sum.resources).filter(([, v]) => v !== 0);
  const m = modal([
    h('h2', 'While you were away…'),
    h('div.muted', `${mins >= 60 ? Math.floor(mins / 60) + 'h ' : ''}${mins % 60}m of village life passed.`),
    h('div.row', { style: { flexWrap: 'wrap' } },
      sum.births ? h('span.chip.good', icon('items/baby', 16), `${sum.births} born`) : null,
      sum.deaths ? h('span.chip.bad', icon('buildings/grave', 16), `${sum.deaths} died`) : null,
      ...lines.map(([k, v]) => h(`span.chip.${v > 0 ? 'good' : 'bad'}`, `${v > 0 ? '+' : ''}${fmt(v)} ${k}`))),
    h('button.btn.primary', { onclick: () => m.close() }, 'Continue'),
  ]);
}

export function extinctScreen(onRestart) {
  modal([
    h('div', { style: { textAlign: 'center' } }, icon('buildings/grave', 90)),
    h('h2', { style: { textAlign: 'center' } }, 'Your people are gone'),
    h('div.muted', { style: { textAlign: 'center' } }, 'The hearth is cold. But somewhere, three new souls are waking…'),
    h('button.btn.primary', { onclick: onRestart }, 'Begin anew'),
  ]);
}
