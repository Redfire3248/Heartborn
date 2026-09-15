import { TILE, ADULT_AGE } from '../core/constants.js';
import { pick, chance } from '../core/rng.js';
import { CREATURES } from '../data/objects.js';
import { talentLabel, EGO_PROUD, fullName } from './talents.js';

/*
 * Villagers talk: little speech bubbles about how they feel and what is going on, short exchanges
 * between neighbours, and a proper conversation when you choose Talk.
 */

const BUBBLE_MS = 4200;
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

const JOB_LINES = {
  chop: ['These trees won\'t chop themselves.', 'Timber!', 'Good wood in this forest.'],
  mine: ['Stone and more stone.', 'I heard iron down here.', 'My back aches from this rock.'],
  farm: ['The crops look good this year.', 'Rain would help.', 'Nothing beats fresh bread.'],
  fish: ['The fish are biting!', 'Quiet water today.', 'Caught a big one earlier.'],
  hunt: ['Tracks! Something passed here.', 'Quiet now, the deer are close.'],
  build: ['One more beam and it stands.', 'Measure twice, cut once.', 'This one will last a hundred years.'],
  smith: ['Hot iron waits for no one.', 'A good blade takes patience.'],
  gather: ['So many berries today.', 'Mushrooms after the rain!'],
  warrior: ['I keep watch.', 'Let them come.', 'My blade is ready.'],
  recruit: ['Left foot, right foot...', 'Training is hard work.'],
  scout: ['All quiet on the border.', 'I see smoke far away.'],
  spy: ['...', 'I hear everything.', 'Walls have ears.'],
  mage: ['The stars whisper tonight.', 'Magic hums in the air.', 'Stand back, this may spark.'],
  explore: ['What lies beyond those hills?', 'Adventure awaits!'],
  official: ['The realm keeps me busy.', 'So many reports to read.'],
  ruler: ['My people depend on me.', 'A ruler never rests.'],
};

const REPLIES = {
  proud: ['Careful, that is treason talk.', 'Hush, the guards will hear.', 'You think too highly of yourself.', 'Maybe you are right...'],
  sad: ['Chin up, friend.', 'It will get better.', 'I know how you feel.'],
  happy: ['Aye!', 'True enough.', 'Ha, well said.', 'Couldn\'t agree more.'],
  danger: ['Stay close to the fire!', 'Where are the warriors?!'],
};

/** What someone says out of the blue, based on their life right now. */
export function chatter(g, v) {
  const s = g.state;
  const dangerNear = s.creatures.some(c => CREATURES[c.t]?.hostile && Math.hypot(c.x - v.x, c.y - v.y) < TILE * 9);
  if (dangerNear) return { text: pick(['Monsters! Run!', 'Something is out there!', 'To arms!']), mood: 'danger' };
  if (v.age < ADULT_AGE) return { text: pick(['Wanna play?', 'When I grow up I\'ll be the best!', 'Tag, you\'re it!', v.talents?.[0] ? `I love ${talentLabel(v.talents[0]).toLowerCase()}!` : 'Look at me!']), mood: 'happy' };
  if (v.jailed) return { text: pick(['Let me out!', 'I did nothing wrong.']), mood: 'sad' };
  if ((v.ego || 0) >= EGO_PROUD) return { text: pick(['My talents are wasted here.', 'Why do I take orders from them?', 'I could rule better than this.', 'No one here is as good as me.']), mood: 'proud' };
  if (v.hunger < 30) return { text: pick(['I\'m starving...', 'Is there any food left?']), mood: 'sad' };
  if (v.sick) return { text: pick(['I don\'t feel well.', '*cough* *cough*']), mood: 'sad' };
  if (v.hp < 40) return { text: 'I need a healer...', mood: 'sad' };
  if (v.happy < 30) return { text: pick(['Life is hard here.', 'Nobody listens to us.', 'I miss the old days.']), mood: 'sad' };
  if (g.isNight && chance(0.5)) return { text: pick(['Time to sleep.', 'What a starry night.', '*yawn*']), mood: 'happy' };
  const partner = v.partner && s.villagers.find(x => x.id === v.partner);
  if (partner && chance(0.15)) return { text: `I love ${partner.name}.`, mood: 'happy' };
  if (v.gifted && chance(0.25)) return { text: pick(['I was born for this.', 'Watch and learn.']), mood: 'proud' };
  if (v.happy > 80 && chance(0.4)) return { text: pick(['What a fine day!', 'I love this village.', 'Long live the ruler!']), mood: 'happy' };
  const lines = JOB_LINES[v.job];
  return { text: lines ? pick(lines) : pick(['Hmm.', 'Nice weather.', 'Busy day.']), mood: 'happy' };
}

export const say = (v, text, delay = 0) => { v._say = { text, from: now() + delay, until: now() + delay + BUBBLE_MS }; };

/** Every so often, someone speaks up; a neighbour may answer. */
export function updateTalk(g, dt) {
  if (g.offline || g.visiting) return;
  g._talkT = (g._talkT || 0) + dt;
  if (g._talkT < 0.5) return;
  const step = g._talkT;
  g._talkT = 0;
  const t = now();
  const vs = g.state.villagers;
  // about one line per villager every ~45 seconds, but never a wall of text in a big village
  const speaking = vs.filter(v => v._say && v._say.until > t).length;
  if (speaking > 18) return;
  for (const v of vs) {
    if (v.away || (v._say && v._say.until > t) || !chance(step / 45)) continue;
    const line = chatter(g, v);
    say(v, line.text);
    const buddy = vs.find(x => x !== v && !x.away && x.age >= ADULT_AGE && !(x._say && x._say.until > t) && Math.hypot(x.x - v.x, x.y - v.y) < TILE * 1.8);
    if (buddy && chance(0.55)) say(buddy, pick(REPLIES[line.mood] || REPLIES.happy), 1300);
  }
}

// ------------------------------------------------------------------ talking with the ruler (you)

export const TOPICS = [
  ['how', 'How are you?'],
  ['ruler', 'What do you think of your ruler?'],
  ['dream', 'What are you good at?'],
  ['news', 'Any news?'],
];

export function talkTo(g, v, topic) {
  const s = g.state;
  const ruler = s.villagers.find(x => x.ruling);
  switch (topic) {
    case 'how': {
      if (v.jailed) return 'How do you think? I rot in a cell.';
      if (v.hunger < 30) return 'Hungry, my lord. Very hungry.';
      if (v.sick) return 'Sick. I need rest, or a healer.';
      if (v.happy > 75) return `Wonderful! ${v.partner ? 'My family is well, ' : ''}and the village thrives.`;
      if (v.happy < 35) return 'Not well. Work, work, and nothing to show for it.';
      return 'Well enough. Can\'t complain.';
    }
    case 'ruler': {
      if (v.ruling) return 'I am the ruler. Heavy is the head that wears the crown.';
      if ((v.ego || 0) >= 80) return `Honestly? I could do ${ruler ? ruler.name + '\'s' : 'that'} job better. Much better.`;
      if ((v.ego || 0) >= EGO_PROUD) return 'They rule... for now. Some of us deserve more respect.';
      if (s.karma > 40) return 'A good and fair ruler. The gods smile on us.';
      if (s.karma < -40) return 'I... I have nothing bad to say. Please don\'t hurt my family.';
      if (v.happy < 35) return 'They don\'t see how we struggle.';
      return 'We are safe and fed. That is enough for me.';
    }
    case 'dream': {
      const talents = (v.talents || []).map(talentLabel);
      const gift = v.gifted ? ' People say I was born gifted, and they are right.' : '';
      const wizard = v.job === 'mage' ? ` My mana is at ${Math.floor(v.mana || 0)}.` : '';
      return talents.length ? `I have a gift for ${talents.join(' and ').toLowerCase()}.${gift}${wizard}` : 'I am still finding out what I am good at.';
    }
    case 'news': {
      const recent = [...s.log].reverse().find(e => e.kind === 'event' || e.kind === 'good' || e.kind === 'bad' || e.kind === 'birth' || e.kind === 'death');
      const proud = s.villagers.find(x => x !== v && (x.ego || 0) >= EGO_PROUD);
      if (proud && chance(0.6)) return `They say ${fullName(proud)} has grown too proud. There may be trouble.`;
      return recent ? `Have you heard? ${recent.text}` : 'Nothing much. A quiet day.';
    }
  }
  return '...';
}
