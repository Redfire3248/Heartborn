import { DAY_LENGTH, TILE } from '../core/constants.js';
import { chance, clamp, pick } from '../core/rng.js';
import { BUILDINGS } from '../data/buildings.js';
import { CREATURES } from '../data/objects.js';
import { killVillager } from './villagers.js';
import { blast, damageBuilding } from './intrigue.js';
import { applyNow } from './employment.js';

/*
 * Building abilities: every important building has its own action with a cooldown.
 * Many can go wrong — luck (shrines, karma, laws) tips the odds.
 * Each `use` returns the text shown to the player, or { error }.
 */

const lucky = (g, p) => chance(clamp(p + g.fateBonus * 0.25, 0.05, 0.95));
const adults = g => g.state.villagers.filter(v => v.age >= 12 && !v.away);
const hostiles = g => g.state.creatures.filter(c => CREATURES[c.t]?.hostile);
const buff = (g, id, effects, days = 1) => {
  g.state.modifiers = g.state.modifiers.filter(m => m.id !== id);
  g.state.modifiers.push({ id, ...effects, until: g.state.time + DAY_LENGTH * days });
  g.recalc();
};
const cheer = (g, n) => { for (const v of g.state.villagers) v.happy = clamp(v.happy + n, 0, 100); };
const pop = g => g.state.villagers.length;

export const ABILITIES = {
  // ---------------- primitive & village
  campfire: {
    name: 'Tell Stories', icon: '🔥', cooldown: 1, cost: { food: 5 },
    desc: 'The tribe gathers by the fire: +15 happiness for everyone, and a chance someone learns a skill.',
    use(g) {
      cheer(g, 15);
      if (lucky(g, 0.4)) { const v = pick(adults(g)); if (v) { const k = pick(Object.keys(v.skills)); v.skills[k] += 1; return `A wonderful night. ${v.name} was inspired and got better at ${k}.`; } }
      return 'Songs and stories until dawn. Everyone is happier.';
    },
  },
  farm: {
    name: 'Harvest Rush', icon: '🌾', cooldown: 2,
    desc: 'Everyone helps in the fields for a day: a big food harvest now — but sore backs slow work tomorrow.',
    use(g) {
      const n = g.addResource('food', 20 + pop(g) * 3);
      buff(g, 'sore_backs', { work: -0.15 }, 1);
      return `+${n} food gathered in a single day. Workers are tired (−15% work for a day).`;
    },
  },
  well: {
    name: 'Draw Clean Water', icon: '💧', cooldown: 2,
    desc: 'Scrub the village with clean water: cures most sickness.',
    use(g) {
      let n = 0;
      for (const v of g.state.villagers) if (v.sick && chance(0.75)) { v.sick = 0; n++; }
      buff(g, 'clean_water', { happy: 5 }, 1);
      return n ? `${n} sick villager${n > 1 ? 's' : ''} recovered.` : 'Fresh water for all: nobody was sick, but spirits lift.';
    },
  },
  lumber_mill: {
    name: 'Clear the Forest', icon: '🪓', cooldown: 3,
    desc: 'Fell every tree near the village at once for a pile of wood. The spirits of the forest may not forgive you.',
    use(g) {
      const c = g.center;
      const trees = g.state.objects.filter(o => o.t.startsWith('tree_') && o.t !== 'tree_stump' && Math.hypot(o.x * TILE - c.x, o.y * TILE - c.y) < TILE * 14).slice(0, 25);
      for (const o of trees) g.world.removeObject(g.state.objects, o);
      const n = g.addResource('wood', trees.length * 8);
      g.state.stats.treesCut = (g.state.stats.treesCut || 0) + trees.length;
      if (trees.length > 10 && chance(0.35)) { g.addKarma(-3); g.spawnRaiders('forest_spirit', 1); return `+${n} wood from ${trees.length} trees — and an angry Forest Spirit awakens!`; }
      return `+${n} wood from ${trees.length} trees.`;
    },
  },
  mine_entrance: {
    name: 'Dig Deep', icon: '⛏', cooldown: 2,
    desc: 'Send miners into the deepest tunnels: gems and iron — or a cave-in, or something that lives in the dark.',
    use(g) {
      if (lucky(g, 0.55)) {
        const gems = g.addResource('gems', 2 + Math.floor(Math.random() * 4)), iron = g.addResource('iron', 10 + Math.floor(Math.random() * 15));
        return `A rich vein! +${gems} gems, +${iron} iron.`;
      }
      if (chance(0.5)) {
        const v = pick(adults(g));
        if (v) { v.hp = Math.max(5, v.hp - 60); return `Cave-in! ${v.name} was badly hurt pulling others free.`; }
      }
      g.spawnRaiders(pick(['cave_troll', 'giant_spider']), 1);
      return 'The miners broke into a hidden cavern… something crawled out!';
    },
  },
  shrine: {
    name: 'Pray', icon: '🙏', cooldown: 1, cost: { food: 5 },
    desc: 'Pray for luck: good fortune for a day and a little karma.',
    use(g) { buff(g, 'prayer', { fate: 0.15 }, 1); g.addKarma(1); return 'The gods listen. +15% luck for a day, +1 karma.'; },
  },
  windmill: {
    name: 'Grind the Stores', icon: '🌬', cooldown: 3,
    desc: 'Grind grain into flour that keeps: food spoils much less and farms yield more for 2 days.',
    use(g) { buff(g, 'flour', { happy: 3, work: 0.05 }, 2); return g.addResource('food', 10 + pop(g)) ? 'Flour for everyone: extra food and full bellies for 2 days.' : 'The stores are full, but people feel well fed.'; },
  },
  granary: {
    name: 'Open the Granary', icon: '🍞', cooldown: 3,
    desc: 'Hand out food freely: everyone is fed and happy — uses a lot of food.',
    cost: { food: 30 },
    use(g) { for (const v of g.state.villagers) v.hunger = 100; cheer(g, 12); g.addKarma(1); return 'Bread for every table. Hunger gone, +12 happiness, +1 karma.'; },
  },
  hunters_lodge: {
    name: 'Great Hunt', icon: '🏹', cooldown: 2,
    desc: 'Hunters sweep the wilds: lots of meat, clears nearby beasts — hunters may get hurt.',
    use(g) {
      let kills = 0;
      for (const c of [...g.state.creatures]) if (['deer', 'rabbit', 'boar', 'wolf', 'bear'].includes(c.t) && kills < 8) { g.state.creatures = g.state.creatures.filter(x => x !== c); kills++; }
      const food = g.addResource('food', kills * 8 + 5);
      if (chance(0.25)) { const v = pick(adults(g)); if (v) { v.hp = Math.max(10, v.hp - 40); return `+${food} food from ${kills} beasts. ${v.name} was gored by a boar!`; } }
      return `+${food} food from ${kills} beasts.`;
    },
  },
  pasture: {
    name: 'Sell Cattle', icon: '🐄', cooldown: 4,
    desc: 'Sell part of the herd for gold. The pasture gives no food for 2 days.',
    use(g, b) { b.idleUntil = g.state.time + DAY_LENGTH * 2; return `+${g.addResource('gold', 15 + g.state.era * 5)} gold from the cattle market.`; },
  },
  apiary: {
    name: 'Honey Feast', icon: '🍯', cooldown: 2,
    desc: 'Share the honey: happiness and a little luck. Bees might sting!',
    use(g) { cheer(g, 8); buff(g, 'honey', { fate: 0.05 }, 1); return chance(0.2) ? 'Sweet honey for all… and a few angry stings. Still worth it.' : 'Honey cakes for everyone! +8 happiness.'; },
  },
  quarry: {
    name: 'Blast Rock', icon: '💥', cooldown: 2, cost: { bombs: 1 },
    desc: 'Use a bomb to blast the quarry face: a mountain of stone. Might injure a miner.',
    use(g) { const n = g.addResource('stone', 60 + g.state.era * 15); const hurt = chance(0.15) && pick(adults(g)); if (hurt) hurt.hp = Math.max(5, hurt.hp - 45); return `+${n} stone!${hurt ? ` ${hurt.name} stood too close.` : ''}`; },
  },
  charcoal_kiln: {
    name: 'Fire the Kiln Hot', icon: '♨', cooldown: 2, cost: { wood: 30 },
    desc: 'Burn extra wood into coal. Sometimes the kiln cracks.',
    use(g, b) { if (chance(0.15)) { damageBuilding(g, b, 'The overheated kiln cracked:'); return 'The kiln overheated and cracked!'; } return `+${g.addResource('coal', 20)} coal.`; },
  },
  carpenter: {
    name: 'Rush Construction', icon: '🔨', cooldown: 2,
    desc: 'Everyone drops their tools and builds: instantly finishes half of every unfinished building.',
    use(g) {
      const todo = g.state.buildings.filter(b => !b.built);
      if (!todo.length) return { error: 'Nothing is under construction' };
      for (const b of todo) { b.progress = Math.min(1, b.progress + 0.5); if (b.progress >= 1) g.finishBuilding(b); }
      return `${todo.length} construction site${todo.length > 1 ? 's' : ''} jumped ahead.`;
    },
  },
  workshop: {
    name: 'Invent', icon: '💡', cooldown: 3,
    desc: 'Tinkerers try something new: better tools (+work for 2 days), a lucky breakthrough, or a mess.',
    use(g) {
      if (lucky(g, 0.5)) { buff(g, 'invention', { work: 0.2 }, 2); g.addResource('science', 5); return 'A clever new tool! +20% work for 2 days, +5 science.'; }
      g.addResource('wood', -10); return 'The invention exploded in a cloud of sawdust. −10 wood.';
    },
  },
  employment_office: {
    name: 'Job Fair', icon: '📋', cooldown: 1,
    desc: 'Everyone without personal orders is re-hired to match your job targets right now, and the most skilled person gets each post.',
    use(g) {
      for (const v of g.state.villagers) v.manual = false;
      const moved = applyNow(g);
      cheer(g, 3);
      return moved ? `${moved} people changed jobs to match your targets.` : 'Everyone already works where you want them. (+3 happiness)';
    },
  },
  town_hall: {
    name: 'Collect Taxes', icon: '💰', cooldown: 2,
    desc: 'Collect gold from every villager. People grumble.',
    use(g) { const n = g.addResource('gold', Math.ceil(pop(g) * (1 + g.state.era * 0.5))); cheer(g, -8); return `+${n} gold in taxes. −8 happiness.`; },
  },
  inn: {
    name: 'Welcome Travellers', icon: '🛏', cooldown: 3, cost: { food: 20 },
    desc: 'Advertise free rooms: wanderers arrive — one might be a thief.',
    use(g) {
      const room = Math.max(0, g.housing - pop(g));
      if (!room) return { error: 'No free homes for newcomers' };
      const n = Math.min(room, 1 + Math.floor(Math.random() * 3));
      for (let i = 0; i < n; i++) g.addWanderer();
      if (chance(0.2)) { const lost = Math.floor(g.state.resources.gold * 0.2); g.addResource('gold', -lost); return `${n} traveller${n > 1 ? 's' : ''} stayed — and one ran off with ${lost} gold!`; }
      return `${n} traveller${n > 1 ? 's' : ''} decided to stay.`;
    },
  },
  training_ground: {
    name: 'Drill', icon: '🎯', cooldown: 1,
    desc: 'Hard drills: all warriors and recruits gain combat skill.',
    use(g) { let n = 0; for (const v of g.state.villagers) if (v.job === 'warrior' || v.job === 'recruit') { v.skills.combat += 0.8; n++; } return n ? `${n} fighters trained hard (+combat).` : { error: 'No warriors or recruits to drill' }; },
  },
  craft_hut: {
    name: 'Carve Spears', icon: '🗡', cooldown: 2, cost: { wood: 20, stone: 10 },
    desc: 'Everyone carves weapons for a day.',
    use(g) { return `+${g.addResource('weapons', 6)} crude weapons.`; },
  },
  guard_post: {
    name: 'Double the Watch', icon: '🛡', cooldown: 2,
    desc: 'More guards on the road: +defense and spotting for a day, but less work gets done.',
    use(g) { buff(g, 'watch', { defense: 10, spot: 0.15, work: -0.05 }, 1); return 'Guards everywhere: +10 defense, +15% spotting, −5% work for a day.'; },
  },

  // ---------------- town
  market: {
    name: 'Trade Fair', icon: '⚖', cooldown: 2,
    desc: 'Sell surplus: turns your largest stockpile of wood, stone or food into gold.',
    use(g) {
      const r = g.state.resources;
      const res = ['wood', 'stone', 'food'].sort((a, b) => r[b] - r[a])[0];
      const amount = Math.floor(r[res] * 0.4);
      if (amount < 10) return { error: 'Not enough surplus to sell' };
      g.addResource(res, -amount);
      const gold = g.addResource('gold', Math.max(1, Math.floor(amount / 6 * g.law.marketMult)));
      return `Sold ${amount} ${res} for ${gold} gold.`;
    },
  },
  tavern: {
    name: 'Throw a Party', icon: '🍺', cooldown: 2, cost: { food: 25, gold: 5 },
    desc: 'Drinks on the house: huge happiness and more babies — but brawls happen.',
    use(g) {
      cheer(g, 20); buff(g, 'party', { fertility: 0.6 }, 1);
      if (chance(0.25)) { const v = pick(adults(g)); if (v) { v.hp = Math.max(10, v.hp - 30); return `What a party! +20 happiness. ${v.name} lost a tavern brawl.`; } }
      return 'The whole village danced until dawn. +20 happiness, more love in the air.';
    },
  },
  barracks: {
    name: 'Call to Arms', icon: '📯', cooldown: 3,
    desc: 'Every trained adult picks up a weapon for a day: +defense and combat. Work stops.',
    use(g) { buff(g, 'call_to_arms', { defense: 25, combat: 0.3, work: -0.3 }, 1); return 'The kingdom stands ready: +25 defense, +30% combat, −30% work for a day.'; },
  },
  blacksmith: {
    name: 'Forge Through the Night', icon: '⚒', cooldown: 2, cost: { iron: 10, coal: 5 },
    desc: 'Smiths work all night: weapons now, tired smiths tomorrow.',
    use(g) { const n = g.addResource('weapons', 12); buff(g, 'tired_smiths', { work: -0.05 }, 1); return `+${n} weapons forged by torchlight.`; },
  },
  weaponsmith: {
    name: 'Masterwork Blades', icon: '⚔', cooldown: 3, cost: { iron: 25, gold: 10 },
    desc: 'Forge masterwork weapons: a big combat bonus for 3 days.',
    use(g) { g.addResource('weapons', 10); buff(g, 'masterwork', { combat: 0.25 }, 3); return '+10 weapons and +25% combat for 3 days.'; },
  },
  armory: {
    name: 'Inspect Gear', icon: '🧰', cooldown: 3,
    desc: 'Repair every weapon: combat up for 2 days.',
    use(g) { buff(g, 'gear', { combat: 0.15 }, 2); return 'Sharpened blades, oiled armour: +15% combat for 2 days.'; },
  },
  stable: {
    name: 'Send Riders', icon: '🐎', cooldown: 3,
    desc: 'Riders scout the land: find a treasure, a traveller — or bandits.',
    use(g) {
      const roll = Math.random() + g.fateBonus * 0.2;
      if (roll > 0.7) return `The riders found an old chest: +${g.addResource('gold', 20)} gold, +${g.addResource('gems', 2)} gems.`;
      if (roll > 0.35 && g.housing > pop(g)) { const v = g.addWanderer(); return `The riders brought back ${v.name}, a lost traveller.`; }
      g.spawnRaiders('bandit', 2 + g.state.era); return 'The riders were followed home by bandits!';
    },
  },
  fishing_hut: {
    name: 'Cast the Big Net', icon: '🎣', cooldown: 2,
    desc: 'A huge catch — or a sea monster tangled in the net.',
    use(g) { if (chance(0.1)) { g.spawnRaiders('slime', 3); return 'Something slimy was in the net… and it is angry!'; } return `+${g.addResource('food', 30 + g.state.era * 5)} fish.`; },
  },
  healer_hut: {
    name: 'Healing Rites', icon: '🌿', cooldown: 2, cost: { food: 10 },
    desc: 'Heal every wounded villager and cure the sick.',
    use(g) { let n = 0; for (const v of g.state.villagers) if (v.hp < 100 || v.sick) { v.hp = 100; v.sick = 0; n++; } return n ? `${n} villager${n > 1 ? 's' : ''} healed.` : 'Nobody needed healing — the healer brewed tea instead.'; },
  },
  school: {
    name: 'Exams', icon: '📚', cooldown: 3,
    desc: 'Children and adults study hard: skills rise, happiness drops a little.',
    use(g) { for (const v of g.state.villagers) { const k = pick(Object.keys(v.skills)); v.skills[k] += 0.5; } cheer(g, -3); return 'Everyone studied: skills improved across the village. (−3 happiness)'; },
  },
  watchtower: {
    name: 'Light the Beacon', icon: '🗼', cooldown: 2,
    desc: 'Spot every threat and warn the village: raiders nearby are revealed and weakened.',
    use(g) {
      buff(g, 'beacon', { spot: 0.3, defense: 5 }, 1);
      let n = 0; for (const c of hostiles(g)) { c.hp = (c.hp ?? CREATURES[c.t].hp) * 0.8; n++; }
      return `The beacon blazes: +30% spotting for a day${n ? `, ${n} enemies caught in the open` : ''}.`;
    },
  },
  courthouse: {
    name: 'Hold Trials', icon: '⚖', cooldown: 3,
    desc: 'Put the suspicious on trial: exposes traitors, but innocent people may be shamed.',
    use(g) {
      const traitors = g.state.villagers.filter(v => v.traitor && !v.exposed);
      if (traitors.length && lucky(g, 0.6)) { const v = pick(traitors); v.exposed = true; v.suspicion = 100; g.addResource('influence', 10); return `Justice! ${v.name} was proven a traitor. +10 influence.`; }
      cheer(g, -5); g.addKarma(-1); return 'The trials found nobody guilty. People feel watched (−5 happiness).';
    },
  },
  jail: {
    name: 'Crackdown', icon: '🔒', cooldown: 3,
    desc: 'Arrest troublemakers: traitors lose their nerve, but the people are afraid.',
    use(g) { let n = 0; for (const v of g.state.villagers) if (v.traitor && chance(0.4)) { v.traitor = false; n++; } cheer(g, -10); g.addKarma(-2); return n ? `${n} plotter${n > 1 ? 's' : ''} gave up their schemes. −10 happiness.` : 'Doors were kicked in and nothing was found. −10 happiness.'; },
  },
  bathhouse: {
    name: 'Public Baths Day', icon: '🛁', cooldown: 2,
    desc: 'Free baths: less sickness and happier people for 2 days.',
    use(g) { buff(g, 'baths', { happy: 8 }, 2); for (const v of g.state.villagers) if (v.sick && chance(0.5)) v.sick = 0; return 'Clean and relaxed: +8 happiness for 2 days, some sickness washed away.'; },
  },
  monastery: {
    name: 'Copy Manuscripts', icon: '📜', cooldown: 3,
    desc: 'Monks copy ancient books: science and influence.',
    use(g) { return `+${g.addResource('science', 15)} science, +${g.addResource('influence', 5)} influence.`; },
  },
  observatory: {
    name: 'Read the Stars', icon: '🔭', cooldown: 3,
    desc: 'See what fate brings: a lucky omen (+luck), or a warning that prepares your defenses.',
    use(g) { if (lucky(g, 0.6)) { buff(g, 'omen', { fate: 0.25 }, 2); return 'The stars align! +25% luck for 2 days.'; } buff(g, 'warning', { defense: 15, spot: 0.2 }, 2); return 'A red comet — danger is coming. Your people prepare (+15 defense, +20% spotting).'; },
  },
  royal_garden: {
    name: 'Garden Party', icon: '🌷', cooldown: 3, cost: { gold: 10 },
    desc: 'Invite nobles: influence and happiness.',
    use(g) { cheer(g, 10); return `Lords and ladies stroll the gardens. +${g.addResource('influence', 12)} influence, +10 happiness.`; },
  },
  spy_den: {
    name: 'Hunt Moles', icon: '🕵', cooldown: 3,
    desc: 'Your spies watch your own people: raises suspicion on real traitors.',
    use(g) { let n = 0; for (const v of g.state.villagers) if (v.traitor) { v.suspicion = Math.min(100, (v.suspicion || 0) + 50); if (v.suspicion >= 80) v.exposed = true; n++; } return n ? `Your spies are closing in on ${n} suspect${n > 1 ? 's' : ''}.` : 'No moles found. Your realm seems loyal.'; },
  },
  embassy: {
    name: 'Host Diplomats', icon: '🤝', cooldown: 3, cost: { gold: 15 },
    desc: 'Improve relations with every neighbouring kingdom.',
    use(g) { const ks = g.state.empire?.kingdoms || []; for (const k of ks) if (k.status !== 'province') k.attitude = clamp(k.attitude + 15, -100, 100); return ks.length ? `Feasts with foreign envoys: +15 relations with ${ks.length} kingdoms.` : 'Diplomats wait for neighbours to be discovered.'; },
  },
  powder_mill: {
    name: 'Overtime Powder', icon: '🧨', cooldown: 3, cost: { coal: 10, iron: 5 },
    desc: 'Pack bombs fast. Careless work can blow the mill up.',
    use(g, b) { if (chance(0.12)) { damageBuilding(g, b, 'KABOOM! An explosion wrecked the'); return 'A spark hit the powder. The mill exploded!'; } return `+${g.addResource('bombs', 8)} bombs.`; },
  },
  prison: {
    name: 'Put Prisoners to Work', icon: '⛓', cooldown: 2,
    desc: 'Prisoners break rocks: free stone. Karma drops.',
    use(g) { g.addKarma(-1); return `+${g.addResource('stone', 25)} stone from the chain gang. −1 karma.`; },
  },
  cannon_tower: {
    name: 'Barrage', icon: '💣', cooldown: 1, cost: { bombs: 3 },
    desc: 'Fire at every enemy near the village.',
    use(g) { const foes = hostiles(g); if (!foes.length) return { error: 'No enemies in range' }; let hits = 0; for (const c of foes.slice(0, 6)) hits += blast(g, c.x, c.y, 90); return `BOOM! ${hits} hits on the enemy.`; },
  },
  secret_vault: {
    name: 'Hide the Treasury', icon: '🗝', cooldown: 4,
    desc: 'Hide gold in the vault: gains interest while hidden.',
    use(g) { return `The hidden gold earned +${g.addResource('gold', Math.floor(g.state.resources.gold * 0.08))} gold.`; },
  },

  // ---------------- kingdom
  library: {
    name: 'Great Debate', icon: '🗣', cooldown: 3,
    desc: 'Scholars argue: science and influence, sometimes a heresy that angers the priests.',
    use(g) { const s = g.addResource('science', 12), i = g.addResource('influence', 6); if (chance(0.2)) { g.addKarma(-2); return `+${s} science, +${i} influence — but a heretic's book offends the gods (−2 karma).`; } return `+${s} science, +${i} influence.`; },
  },
  bank: {
    name: 'Offer Loans', icon: '🏦', cooldown: 4,
    desc: 'Lend gold to merchants: usually profit, sometimes they vanish with it.',
    use(g) { const stake = Math.floor(g.state.resources.gold * 0.3); if (stake < 10) return { error: 'Not enough gold to lend' }; if (lucky(g, 0.7)) return `The merchants paid back with interest: +${g.addResource('gold', Math.floor(stake * 0.5))} gold.`; g.addResource('gold', -stake); return `The borrowers fled overnight. −${stake} gold.`; },
  },
  temple: {
    name: 'Grand Ceremony', icon: '⛩', cooldown: 3, cost: { gold: 10, food: 20 },
    desc: 'A holy festival: big luck, happiness and karma.',
    use(g) { buff(g, 'ceremony', { fate: 0.3 }, 2); cheer(g, 10); g.addKarma(3); return 'Incense and song: +30% luck for 2 days, +10 happiness, +3 karma.'; },
  },
  castle: {
    name: 'Royal Decree', icon: '👑', cooldown: 3,
    desc: 'The crown commands: +40% work for a day and a heap of influence. The people resent it.',
    use(g) { buff(g, 'decree', { work: 0.4 }, 1); cheer(g, -10); return `By order of the crown! +40% work for a day, +${g.addResource('influence', 15)} influence, −10 happiness.`; },
  },
  harbor: {
    name: 'Launch Expedition', icon: '⛵', cooldown: 5, cost: { food: 40, gold: 20 },
    desc: 'Sail to unknown lands: riches, new people — or a ship lost at sea.',
    use(g) {
      const roll = Math.random() + g.fateBonus * 0.2;
      if (roll > 0.65) return `The ship returns loaded with treasure! +${g.addResource('gold', 80)} gold, +${g.addResource('gems', 6)} gems.`;
      if (roll > 0.3) { let n = 0; while (n < 3 && g.housing > pop(g)) { g.addWanderer(); n++; } return `The expedition found castaways. ${n} new people join you.`; }
      const v = pick(adults(g)); if (v) killVillager(g, v, 'was lost at sea');
      return 'A storm took the ship. The crew never returned.';
    },
  },
  statue: {
    name: 'Unveil a Monument', icon: '🗿', cooldown: 4, cost: { gold: 20 },
    desc: 'Honour a hero: lasting happiness and karma.',
    use(g) { buff(g, 'monument', { happy: 10 }, 3); g.addKarma(2); return 'The people cheer their hero. +10 happiness for 3 days, +2 karma.'; },
  },
  fountain: {
    name: 'Make a Wish', icon: '🪙', cooldown: 2, cost: { gold: 5 },
    desc: 'Toss gold into the fountain. Sometimes wishes come true.',
    use(g) { if (lucky(g, 0.35)) { const r = pick(['gems', 'gold', 'influence']); return `A wish came true! +${g.addResource(r, r === 'gems' ? 4 : 30)} ${r}.`; } return 'Plop. The coin sinks. Maybe next time.'; },
  },
  wonder: {
    name: 'Golden Age', icon: '🌟', cooldown: 7,
    desc: 'Proclaim a golden age: massive luck, happiness and work for 3 days.',
    use(g) { buff(g, 'golden_age', { fate: 0.5, happy: 20, work: 0.3 }, 3); g.announce('🌟 A Golden Age begins!'); return 'A Golden Age: +50% luck, +20 happiness, +30% work for 3 days.'; },
  },
  siege_workshop: {
    name: 'Build Siege Engines', icon: '🏗', cooldown: 4, cost: { wood: 60, iron: 20 },
    desc: 'Rams and catapults: your next war against a kingdom goes much better.',
    use(g) { g.state.empire ||= {}; g.state.empire.siege = (g.state.empire.siege || 0) + 1; return 'Siege engines ready. Your next battle against a kingdom will be far stronger.'; },
  },
  hospital: {
    name: 'Vaccinate', icon: '💉', cooldown: 4, cost: { gold: 15 },
    desc: 'Nobody gets sick for 3 days and the wounded are healed.',
    use(g) { for (const v of g.state.villagers) { v.sick = 0; v.hp = 100; } buff(g, 'vaccine', { health: 5 }, 3); return 'Everyone is healthy and protected for 3 days.'; },
  },
  chapel: {
    name: 'Bless a Wedding', icon: '💒', cooldown: 2,
    desc: 'A blessed wedding: happiness and more children.',
    use(g) { buff(g, 'wedding', { fertility: 0.8, happy: 5 }, 2); return 'Bells ring! More babies and +5 happiness for 2 days.'; },
  },
  cathedral: {
    name: 'Holy Crusade', icon: '✝', cooldown: 5,
    desc: 'Rally the faithful: huge combat bonus and influence, but karma swings with your cause.',
    use(g) { buff(g, 'crusade', { combat: 0.5, defense: 20 }, 2); const i = g.addResource('influence', 20); if (g.state.karma < 0) g.addKarma(-5); else g.addKarma(2); return `The faithful take up arms: +50% combat, +20 defense for 2 days, +${i} influence.`; },
  },
  university: {
    name: 'Research Grant', icon: '🎓', cooldown: 3, cost: { gold: 25 },
    desc: 'Fund scholars: a burst of science — maybe a breakthrough.',
    use(g) { const s = g.addResource('science', 30); if (lucky(g, 0.3)) { g.addResource('science', 60); return `+${s + 60} science — a breakthrough!`; } return `+${s} science.`; },
  },
  mage_tower: {
    name: 'Cast a Storm', icon: '⚡', cooldown: 2, cost: { gems: 1 },
    desc: 'Lightning strikes every enemy nearby. Magic is unpredictable…',
    use(g) {
      const foes = hostiles(g);
      if (chance(0.15)) { const b = pick(g.builtBuildings().filter(x => x.type !== 'campfire')); if (b) damageBuilding(g, b, 'A stray bolt of lightning hit the'); return 'The spell went wild and struck your own village!'; }
      if (!foes.length) { buff(g, 'rain', { happy: 3 }, 1); return 'With no enemies around, the mage summons a gentle rain. Crops love it.'; }
      for (const c of foes) { c.hp = (c.hp ?? CREATURES[c.t].hp) - 120; c._hurtFlash = 0.4; }
      g.state.creatures = g.state.creatures.filter(c => !(CREATURES[c.t]?.hostile && c.hp <= 0));
      g.fx.shake = 1.5;
      return `Lightning rains down on ${foes.length} enemies!`;
    },
  },
  fortress: {
    name: 'Hold the Line', icon: '🏰', cooldown: 3,
    desc: 'Everyone shelters inside the fortress: raiders can barely hurt you for a day.',
    use(g) { buff(g, 'hold', { defense: 80 }, 1); return 'The gates shut. +80 defense for a day.'; },
  },
  palace: {
    name: 'Royal Ball', icon: '💃', cooldown: 4, cost: { gold: 40 },
    desc: 'Dazzle foreign courts: influence and relations with every kingdom.',
    use(g) { for (const k of g.state.empire?.kingdoms || []) k.attitude = clamp(k.attitude + 10, -100, 100); cheer(g, 5); return `A night to remember: +${g.addResource('influence', 25)} influence and better relations with every kingdom.`; },
  },
  colosseum: {
    name: 'Grand Games', icon: '🏟', cooldown: 3, cost: { gold: 20 },
    desc: 'Gladiator games: happiness, gold and combat skill. Fighters may die.',
    use(g) {
      cheer(g, 18);
      for (const v of g.state.villagers) if (v.job === 'warrior') v.skills.combat += 0.5;
      const gold = g.addResource('gold', 30);
      if (chance(0.2)) { const v = pick(g.state.villagers.filter(x => x.job === 'warrior')); if (v) { killVillager(g, v, 'fell in the arena'); return `+18 happiness, +${gold} gold. ${v.name} fell in the arena.`; } }
      return `The crowd roars! +18 happiness, +${gold} gold, warriors hone their skills.`;
    },
  },
  lighthouse: {
    name: 'Guide Merchant Ships', icon: '🚢', cooldown: 3,
    desc: 'Guide ships into port: trade gold — or pirates follow them in.',
    use(g) { if (chance(0.2)) { g.spawnRaiders('bandit', 3 + g.state.era); return 'Pirates slipped in behind the merchant ships!'; } return `Merchants dock safely: +${g.addResource('gold', 25 + g.state.era * 5)} gold.`; },
  },
  stone_tower: {
    name: 'Volley', icon: '🏹', cooldown: 1,
    desc: 'Archers fire at every enemy near the village.',
    use(g) { const foes = hostiles(g); if (!foes.length) return { error: 'No enemies in range' }; for (const c of foes) { c.hp = (c.hp ?? CREATURES[c.t].hp) - 35; c._hurtFlash = 0.3; } g.state.creatures = g.state.creatures.filter(c => !(CREATURES[c.t]?.hostile && c.hp <= 0)); return `Arrows fly at ${foes.length} enemies.`; },
  },

  // ---------------- industrial & beyond
  factory: {
    name: 'Double Shift', icon: '🏭', cooldown: 3,
    desc: 'Workers do double shifts: weapons and faster building — accidents happen.',
    use(g) { g.addResource('weapons', 15); buff(g, 'double_shift', { work: 0.3, happy: -10 }, 1); if (chance(0.15)) { const v = pick(adults(g)); if (v) killVillager(g, v, 'died in a factory accident'); return '+15 weapons, +30% work — a worker died in an accident.'; } return '+15 weapons, +30% work for a day (−10 happiness).'; },
  },
  steel_mill: {
    name: 'Pour Steel', icon: '🔩', cooldown: 2, cost: { coal: 20 },
    desc: 'A big steel pour: lots of iron.',
    use(g) { return `+${g.addResource('iron', 45)} iron.`; },
  },
  printing_press: {
    name: 'Print Propaganda', icon: '📰', cooldown: 3,
    desc: 'Newspapers praise the ruler: influence and happiness — or a scandal.',
    use(g) { if (chance(0.2)) { cheer(g, -8); return 'A rival printer exposed a royal scandal! −8 happiness.'; } cheer(g, 6); return `Glowing headlines: +${g.addResource('influence', 12)} influence, +6 happiness.`; },
  },
  railway_station: {
    name: 'Excursion Train', icon: '🚂', cooldown: 4,
    desc: 'A train of settlers arrives — if you have homes for them.',
    use(g) { const room = Math.max(0, g.housing - pop(g)); if (!room) return { error: 'Build more homes first' }; const n = Math.min(room, 3 + Math.floor(Math.random() * 4)); for (let i = 0; i < n; i++) g.addWanderer(); return `${n} settlers stepped off the train.`; },
  },
  clock_tower: {
    name: 'Strict Schedule', icon: '⏰', cooldown: 3,
    desc: '+25% work for 2 days; people get grumpy.',
    use(g) { buff(g, 'schedule', { work: 0.25, happy: -6 }, 2); return 'Everyone runs on time: +25% work, −6 happiness for 2 days.'; },
  },
  research_lab: {
    name: 'Experiment', icon: '🧪', cooldown: 2,
    desc: 'Risky experiments: lots of science — or a lab fire.',
    use(g, b) { if (chance(0.12)) { damageBuilding(g, b, 'An experiment went wrong in the'); return 'BANG. The experiment set the lab on fire.'; } return `+${g.addResource('science', 50)} science.`; },
  },
  telegraph_office: {
    name: 'Intercept Messages', icon: '📡', cooldown: 3,
    desc: 'Read enemy messages: see incoming armies, reveal traitors.',
    use(g) { buff(g, 'intercept', { spot: 0.5 }, 2); for (const v of g.state.villagers) if (v.traitor) v.suspicion = Math.min(100, (v.suspicion || 0) + 30); return '+50% spotting for 2 days. Traitors grow nervous.'; },
  },
  museum: {
    name: 'Grand Exhibition', icon: '🖼', cooldown: 4,
    desc: 'Show off your history: gold, influence and happiness.',
    use(g) { cheer(g, 8); return `Crowds flock in: +${g.addResource('gold', 40)} gold, +${g.addResource('influence', 15)} influence.`; },
  },
  academy_of_science: {
    name: 'Grand Project', icon: '🔬', cooldown: 4, cost: { gold: 60 },
    desc: 'A huge research push.',
    use(g) { return `+${g.addResource('science', 200)} science.`; },
  },
  vertical_farm: {
    name: 'Grow Cycle', icon: '🥬', cooldown: 2,
    desc: 'Speed-grow crops under lights.',
    use(g) { return `+${g.addResource('food', 150)} food.`; },
  },
  power_plant: {
    name: 'Overload the Grid', icon: '⚡', cooldown: 3,
    desc: '+60% work for a day. Risk of a blackout that damages the plant.',
    use(g, b) { if (chance(0.18)) { damageBuilding(g, b, 'A blackout fried the'); return 'The grid overloaded: blackout!'; } buff(g, 'overload', { work: 0.6 }, 1); return '+60% work for a day. The lights hum dangerously.'; },
  },
  radar_array: {
    name: 'Full Scan', icon: '🛰', cooldown: 2,
    desc: 'Nothing can hide: all enemies weakened, spotting maxed for a day.',
    use(g) { buff(g, 'scan', { spot: 1, defense: 10 }, 1); return 'Every army and spy is on the screen. +100% spotting, +10 defense.'; },
  },
  bunker: {
    name: 'Lockdown', icon: '🚪', cooldown: 4,
    desc: 'Everyone into the bunker: nearly immune to attacks for a day, no work done.',
    use(g) { buff(g, 'lockdown', { defense: 150, work: -0.6 }, 1); return 'Lockdown: +150 defense, −60% work for a day.'; },
  },
  airfield: {
    name: 'Airdrop Supplies', icon: '🪂', cooldown: 3,
    desc: 'Planes bring supplies from abroad.',
    use(g) { return `Supplies landed: +${g.addResource('food', 60)} food, +${g.addResource('iron', 30)} iron, +${g.addResource('weapons', 10)} weapons.`; },
  },
  tank_factory: {
    name: 'Armoured Column', icon: '🛡', cooldown: 3, cost: { iron: 40 },
    desc: 'Tanks roll out: massive combat bonus for 2 days.',
    use(g) { buff(g, 'tanks', { combat: 0.8, defense: 40 }, 2); return 'Tanks rumble through the streets: +80% combat, +40 defense for 2 days.'; },
  },
  missile_silo: {
    name: 'Test Launch', icon: '🚀', cooldown: 5, cost: { science: 50 },
    desc: 'A missile test scares neighbouring kingdoms into respect (or fury).',
    use(g) { for (const k of g.state.empire?.kingdoms || []) k.attitude = clamp(k.attitude + (chance(0.5) ? 10 : -15), -100, 100); g.addKarma(-3); return 'The test missile streaks across the sky. Neighbours are shaken. −3 karma.'; },
  },
  robot_factory: {
    name: 'Build Robot', icon: '🤖', cooldown: 3, cost: { iron: 60, science: 40 },
    desc: 'Build a robot worker right now. Sometimes they malfunction.',
    use(g) {
      const v = g.addWanderer();
      Object.assign(v, { robot: true, name: `Unit-${Math.floor(100 + Math.random() * 900)}`, age: 20, traits: ['hardworking', 'loyal'], job: 'build' });
      for (const k of Object.keys(v.skills)) v.skills[k] = 4;
      if (chance(0.1)) { v.traitor = true; return `${v.name} activated… its eyes glow red. Something is wrong with it.`; }
      return `${v.name} activated and got to work.`;
    },
  },
  drone_hub: {
    name: 'Drone Strike', icon: '🛸', cooldown: 1,
    desc: 'Drones hit every enemy near the village.',
    use(g) { const foes = hostiles(g); if (!foes.length) return { error: 'No enemies in range' }; let hits = 0; for (const c of foes) hits += blast(g, c.x, c.y, 80); return `Drones hit ${hits} targets.`; },
  },
  fusion_reactor: {
    name: 'Energy Surge', icon: '☢', cooldown: 4,
    desc: '+80% work for 2 days. A tiny chance of disaster.',
    use(g, b) { if (chance(0.05)) { for (const x of g.builtBuildings().slice(0, 4)) damageBuilding(g, x, 'The reactor surge destroyed the'); return 'CONTAINMENT FAILURE. Buildings around the reactor were destroyed.'; } buff(g, 'surge', { work: 0.8 }, 2); return '+80% work for 2 days.'; },
  },
  arcology: {
    name: 'Open Housing Lottery', icon: '🏙', cooldown: 4,
    desc: 'Invite migrants to fill the tower.',
    use(g) { const room = Math.max(0, g.housing - pop(g)); if (!room) return { error: 'The arcology is full' }; const n = Math.min(room, 5 + Math.floor(Math.random() * 6)); for (let i = 0; i < n; i++) g.addWanderer(); return `${n} new citizens moved in.`; },
  },
  shield_generator: {
    name: 'Full Power Shield', icon: '🔰', cooldown: 4,
    desc: 'The dome goes to full power: invincible for a day and every nearby enemy is repelled.',
    use(g) { buff(g, 'dome', { defense: 300 }, 1); for (const c of hostiles(g)) { c.hp = (c.hp ?? CREATURES[c.t].hp) - 60; } return 'The dome glows white: +300 defense for a day.'; },
  },
  hyperloop: {
    name: 'Rapid Transit', icon: '🚄', cooldown: 3,
    desc: 'Everyone moves and works much faster for a day.',
    use(g) { buff(g, 'transit', { work: 0.35 }, 1); return '+35% work for a day.'; },
  },
  spaceport: {
    name: 'Launch Colony Ship', icon: '🛸', cooldown: 7, cost: { science: 500, iron: 200 },
    desc: 'Found a colony among the stars: a permanent daily income — or a tragedy.',
    use(g) {
      g.state.empire ||= {};
      if (lucky(g, 0.7)) { g.state.empire.colonies = (g.state.empire.colonies || 0) + 1; g.announce('🚀 A colony among the stars!'); return 'The colony ship landed safely. It sends +20 gold and +20 science every day.'; }
      for (let i = 0; i < 3; i++) { const v = pick(adults(g)); if (v) killVillager(g, v, 'was lost in space'); }
      return 'The colony ship exploded after launch. Three brave colonists were lost.';
    },
  },
  ai_core: {
    name: 'Ask the AI', icon: '🧠', cooldown: 3,
    desc: 'The AI optimises everything — unless it decides it knows better.',
    use(g) { if (chance(0.08)) { g.state.resources.gold = Math.floor(g.state.resources.gold * 0.7); return 'The AI "reallocated" 30% of your gold to itself. Worrying.'; } buff(g, 'ai', { work: 0.4, fate: 0.2 }, 2); return `+${g.addResource('science', 100)} science, +40% work and +20% luck for 2 days.`; },
  },
  holo_park: {
    name: 'Holo Festival', icon: '🎆', cooldown: 3,
    desc: 'A dazzling show: happiness for everyone.',
    use(g) { buff(g, 'holo', { happy: 25 }, 2); return '+25 happiness for 2 days.'; },
  },
  cloning_vat: {
    name: 'Clone a Hero', icon: '🧬', cooldown: 5, cost: { science: 150 },
    desc: 'Clone your most skilled villager. The gods hate it.',
    use(g) {
      const best = [...adults(g)].sort((a, b) => Object.values(b.skills).reduce((x, y) => x + y, 0) - Object.values(a.skills).reduce((x, y) => x + y, 0))[0];
      if (!best) return { error: 'Nobody to clone' };
      const c = g.addWanderer();
      Object.assign(c, { name: `${best.name} II`, skills: { ...best.skills }, traits: [...best.traits], age: 18 });
      g.addKarma(-4);
      return `${c.name} stepped out of the vat. −4 karma.`;
    },
  },
  orbital_cannon: {
    name: 'Orbital Strike', icon: '☄', cooldown: 2, cost: { science: 80 },
    desc: 'Erase every enemy near the village from orbit.',
    use(g) { const foes = hostiles(g); if (!foes.length) return { error: 'No enemies in range' }; g.state.creatures = g.state.creatures.filter(c => !CREATURES[c.t]?.hostile); g.fx.shake = 3; g.addKarma(-1); return `${foes.length} enemies vaporised from orbit.`; },
  },
  mech_bay: {
    name: 'Deploy Mechs', icon: '🦾', cooldown: 3, cost: { iron: 80 },
    desc: 'Giant mechs guard the village: +combat and defense for 2 days.',
    use(g) { buff(g, 'mechs', { combat: 1, defense: 60 }, 2); return 'The mechs power up: +100% combat, +60 defense for 2 days.'; },
  },
};

export function abilityOf(type) { return ABILITIES[type] || null; }

/** Seconds of game time until this building's ability is ready (0 = ready). */
export function abilityCooldown(g, b) {
  const a = ABILITIES[b.type];
  if (!a || !b.abilityAt) return 0;
  return Math.max(0, b.abilityAt + a.cooldown * DAY_LENGTH - g.state.time);
}

export function canUseAbility(g, b) {
  const a = ABILITIES[b.type];
  if (!a) return 'No ability';
  if (!b.built) return 'Finish building it first';
  if (abilityCooldown(g, b) > 0) return 'Recharging';
  if (a.cost && !g.canAfford(a.cost)) return 'Not enough resources';
  return true;
}

export function useAbility(g, b) {
  const ok = canUseAbility(g, b);
  if (ok !== true) return { error: ok };
  const a = ABILITIES[b.type];
  const r = a.use(g, b);
  if (r && typeof r === 'object' && r.error) return r;
  if (a.cost) g.spend(a.cost);
  b.abilityAt = g.state.time;
  const text = typeof r === 'string' ? r : '';
  g.log(`${a.icon} ${BUILDINGS[b.type].name} — ${a.name}: ${text}`, 'event');
  const c = g.buildingCenter(b);
  g.float(c.x, c.y - TILE, `${a.icon} ${a.name}`, '#ffd76a');
  g.puff(c, 'effects/spark', 10);
  g.emit('change');
  return { text };
}
