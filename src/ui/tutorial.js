import { h, icon, confirmModal } from './dom.js';
import { ADULT_AGE } from '../core/constants.js';

/*
 * Guided tutorial for new civilizations. Each step waits for the player to actually do
 * the thing, points at the right button, and pays a little influence when done.
 * Progress lives in state.tutorial so it survives saves.
 */

const has = (g, type, built = false) => g.state.buildings.some(b => b.type === type && (!built || b.built));

export const STEPS = [
  { title: 'Welcome, ruler', text: 'Three ordinary humans have followed you to this land. Everything they become is up to your decisions. Let’s found a village together.', next: true },
  { title: 'Look around', text: 'Drag the ground (or use W A S D) to move the camera. Scroll the mouse wheel (or Q / E) to zoom. Press H any time to jump back home.', next: true },
  { title: 'Open the Build menu', text: 'Click the hammer on the left, or press B.', dock: 'build', done: (g, hud) => hud.panel === 'build' },
  { title: 'Light a Campfire', text: 'Pick Campfire and click an open grass tile. The campfire is the heart of your village.', dock: 'build', done: g => has(g, 'campfire') },
  { title: 'Give them shelter', text: 'Place a Tent near the fire. Homes let your people have children. Tip: hold and drag to place several at once.', dock: 'build', done: g => has(g, 'tent') },
  { title: 'Somewhere to store things', text: 'Place a Stockpile so resources don’t go to waste.', dock: 'build', done: g => has(g, 'stockpile') },
  { title: 'Watch them build', text: 'Your villagers build on their own. Wait for the Campfire to be finished.', done: g => has(g, 'campfire', true) },
  { title: 'Meet your people', text: 'Click one of your villagers to see their traits, skills, inventory and job.', done: (g, hud) => g.selected?.kind === 'villager' },
  { title: 'Give orders', text: 'Open People & Jobs (J) and use + to assign someone to a job, like Woodcutter. You can also change a job in the villager’s own panel.', dock: 'jobs', done: g => g.state.villagers.some(v => v.manual) },
  { title: 'Appoint a Steward', text: 'Open the Court (C). Choose a villager as Steward: from then on they assign jobs for you, so you can focus on big decisions.', dock: 'court', done: g => !!g.state.court?.steward?.id },
  { title: 'Rule with laws', text: 'Open Rule the Realm (K). Laws decide what your civilization becomes. Pick one when you have the influence for it.', dock: 'deeds', done: (g, hud) => hud.panel === 'deeds' },
  { title: 'Prepare for danger', text: 'Monsters and armies will come. Build a Craft Hut (weapons) and a Training Ground (only trained people can be warriors).', dock: 'build', done: g => has(g, 'craft_hut') && has(g, 'training_ground') },
  { title: 'Buildings have powers', text: 'Click a finished building. Most have a special ability — like the Campfire’s Tell Stories. Try one! Every villager also has a trade: only a Jack of all trades can switch jobs.', done: g => g.state.buildings.some(b => b.abilityAt != null) },
  { title: 'Stay informed', text: 'The bell at the top right lists everything important. Click a notification to jump straight to where it happened.', done: g => !!g.state.notifSeen },
  { title: 'The wider world', text: 'Open the Realm Map (V) to see other civilizations, their distance, and to visit, trade, march on or spy on them.', dock: 'map', done: (g, hud) => hud.seenMap },
  { title: 'Your realm awaits', text: 'That’s the basics! Grow your people, raise heirs, choose laws and build your way through the ages. The Chronicle (L) records your history.', next: true, last: true },
];

export class Tutorial {
  constructor(hud) {
    this.hud = hud;
    this.g = hud.game;
    this.el = h('div.tutorial');
    hud.root.append(this.el);
    this.lastKey = '';
    this.timer = setInterval(() => this.tick(), 400);
    this.tick();
  }

  get state() { return this.g.state.tutorial; }
  get active() { return !!this.state && !this.state.done; }

  tick() {
    const t = this.state;
    this.hud.root.querySelectorAll('.dock .tut-glow').forEach(e => e.classList.remove('tut-glow'));
    if (!this.active) { this.el.hidden = true; return; }
    const step = STEPS[t.step];
    if (!step) { this.finish(); return; }
    if (!step.next && step.done(this.g, this.hud)) { this.advance(); return; }
    if (step.dock) this.hud.els.dock[step.dock]?.classList.add('tut-glow');
    const key = `${t.step}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.render(step, t.step);
  }

  render(step, i) {
    this.el.hidden = false;
    this.el.replaceChildren(
      h('div.tut-head', icon('items/scroll', 22), h('span.faint', `Tutorial · ${i + 1} / ${STEPS.length}`), h('div.spacer'),
        h('button.link', { onclick: () => this.skip() }, 'Skip tutorial')),
      h('div.tut-title', step.title),
      h('div.tut-text', step.text),
      h('div.bar', h('i', { style: { width: `${(i / (STEPS.length - 1)) * 100}%`, background: 'var(--gold)' } })),
      step.next
        ? h('div.row', h('div.spacer'), h('button.btn.sm.primary', { onclick: () => (step.last ? this.finish() : this.advance()) }, step.last ? 'Finish ✓' : 'Next →'))
        : h('div.faint', '⏳ Waiting for you to do this…'),
    );
  }

  advance() {
    const t = this.state;
    const step = STEPS[t.step];
    if (!step.next) {
      this.g.addResource('influence', 10);
      this.g.float(this.g.center.x, this.g.center.y - 40, `Tutorial: ${step.title} ✓ +10 influence`, '#ffd76a');
    }
    t.step++;
    this.lastKey = '';
    this.tick();
  }

  finish() {
    const t = this.state;
    t.done = true;
    this.g.addResource('influence', 25);
    this.g.log('Tutorial complete! +25 influence. May your people prosper.', 'event');
    this.hud.announce('Tutorial complete!');
    this.tick();
  }

  async skip() {
    if (!(await confirmModal('Skip the tutorial?', 'You can restart it any time from Save & Settings.', { okLabel: 'Skip', okClass: 'primary' }))) return;
    this.state.done = true;
    this.state.skipped = true;
    this.tick();
  }

  restart() {
    this.g.state.tutorial = { step: 0, done: false };
    this.lastKey = '';
    this.tick();
  }

  destroy() {
    clearInterval(this.timer);
    this.el.remove();
  }
}

export { ADULT_AGE };
