// Fate tables. Every finished action rolls one outcome.
// good outcomes get more likely with skill, karma, shrines/temples and the Blessed trait;
// bad outcomes get more likely with the Cursed trait, low karma and danger.
// apply(c) uses the helper context from game/fate.js and returns the floating text.

export const OUTCOMES = {
  craft: [
    { good: true,  weight: 80, apply: c => { const n = c.gainWeapons(); return `+${n} ${c.craftRes}`; } },
    { good: true,  weight: 7,  apply: c => { const n = c.gainWeapons(2); return `Masterwork! +${n} ${c.craftRes}`; } },
    { good: false, weight: 6,  apply: () => 'The blade cracked — materials wasted' },
    { good: false, weight: 4,  apply: c => { if (c.target?.type === 'powder_mill' && c.chance(0.3)) { c.hurt(45); return 'The powder exploded!'; } c.hurt(15); return 'Burned at the forge'; } },
  ],

  quarry: [
    { good: true,  weight: 78, apply: c => `+${c.gain('stone', 4, 8)} stone` },
    { good: true,  weight: 8,  apply: c => `Iron seam! +${c.gain('iron', 1, 3)} iron` },
    { good: true,  weight: 2,  apply: c => `Buried gem! +${c.gain('gems', 1, 1)} gem` },
    { good: false, weight: 5,  apply: c => { c.hurt(20); return 'Falling block! Injured'; } },
  ],

  chop: [
    { good: true,  weight: 70, apply: c => `+${c.gainObj('wood')} wood` },
    { good: true,  weight: 6,  apply: c => `Wild honey! +${c.gain('food', 4, 8)} food` },
    { good: true,  weight: 3,  apply: c => { c.plantSapling(); return `+${c.gainObj('wood')} wood, planted a sapling`; } },
    { good: false, weight: 4,  apply: c => { c.hurt(20); return 'Axe slipped! Injured'; } },
    { good: false, weight: 0.8, karmaScaled: true, apply: c => { c.spawn('forest_spirit'); c.karma(-1); return 'The forest spirit awakens!'; }, big: true },
    { good: false, weight: 3,  apply: c => { c.spawn(c.chance(0.5) ? 'snake' : 'giant_spider'); return 'Something was hiding in the tree!'; } },
  ],

  gather: [
    { good: true,  weight: 75, apply: c => {
      const poison = c.target?.def.poison;
      if (poison && c.chance(poison)) { c.sick(); return 'Poisonous mushroom… sick'; }
      return `+${c.gainObj('food')} food`;
    } },
    { good: true,  weight: 5,  apply: c => `Found healing herbs${c.keep('herbs')}. +${c.gain('influence', 1, 3)} influence` },
    { good: false, weight: 3,  apply: c => { c.sick(); return 'Ate something bad… sick'; } },
    { good: false, weight: 4,  apply: c => { c.spawn('snake'); return 'Snake in the bushes!'; } },
  ],

  mine: [
    { good: true,  weight: 70, apply: c => c.gainAllObj() },
    { good: true,  weight: 6,  apply: c => `Hidden vein! +${c.gain('iron', 1, 3)} iron` },
    { good: true,  weight: 2,  apply: c => `A gem! +${c.gain('gems', 1, 1)} gem` },
    { good: false, weight: 6,  apply: c => { c.hurt(25); return 'Rockslide! Injured'; } },
    { good: false, weight: 3,  apply: c => { c.sick(); return 'Breathed bad dust… sick'; } },
    { good: false, weight: 2,  apply: c => { c.spawn('slime'); return 'A slime crawled out!'; } },
  ],

  deepmine: [
    { good: true,  weight: 40, apply: c => `+${c.gain('stone', 3, 6)} stone` },
    { good: true,  weight: 22, apply: c => `+${c.gain('coal', 2, 4)} coal` },
    { good: true,  weight: 16, apply: c => `+${c.gain('iron', 2, 4)} iron` },
    { good: true,  weight: 7,  apply: c => `Gold! +${c.gain('gold', 2, 5)} gold` },
    { good: true,  weight: 3,  apply: c => `Gems! +${c.gain('gems', 1, 2)} gems` },
    { good: true,  weight: 1,  apply: c => { c.gain('influence', 25, 40); c.gain('gold', 10, 20); c.keep('relic'); return 'ANCIENT RELIC FOUND!'; }, big: true },
    { good: false, weight: 6,  apply: c => { if (c.chance(0.25)) { c.kill('crushed in a cave-in'); return 'CAVE-IN! Killed'; } c.hurt(40); return 'Cave-in! Badly hurt'; }, big: true },
    { good: false, weight: 3,  apply: c => { c.spawn('cave_troll'); return 'A CAVE TROLL emerges!'; }, big: true },
    { good: false, weight: 2,  apply: c => { c.spawn('skeleton'); c.spawn('skeleton'); return 'Disturbed an old tomb!'; }, big: true },
  ],

  farm: [
    { good: true,  weight: 70, apply: c => `+${c.gain('food', 6, 11, { farm: true })} food` },
    { good: true,  weight: 6,  apply: c => `Bumper crop! +${c.gain('food', 14, 22, { farm: true })} food` },
    { good: false, weight: 2,  apply: c => { const lost = c.lose('food', 0.06); return `Locusts! -${lost} food`; } },
    { good: false, weight: 2,  apply: c => { c.blightTarget(); return 'Blight! This farm is ruined for a day'; } },
    { good: false, weight: 3,  apply: c => { c.hurt(10); return 'Heatstroke'; } },
  ],

  fish: [
    { good: true,  weight: 75, apply: c => `+${c.gain('food', 4, 8)} food` },
    { good: true,  weight: 5,  apply: c => `Pearl! +${c.gain('gems', 1, 1)} gem` },
    { good: true,  weight: 4,  apply: c => `Sunken chest! +${c.gain('gold', 3, 8)} gold` },
    { good: false, weight: 6,  apply: c => { c.hurt(15); return 'Fell in the water'; } },
    { good: false, weight: 2,  apply: c => { if (c.chance(0.3)) { c.kill('drowned'); return 'Drowned…'; } c.hurt(30); return 'Nearly drowned'; } },
  ],

  hunt: [
    { good: true,  weight: 70, apply: c => `+${c.gainCreature()} food` },
    { good: true,  weight: 6,  apply: c => { c.happy(10); c.keep('pelt'); return `Fine pelt! +${c.gainCreature()} food, happier`; } },
    { good: false, weight: 8,  apply: c => { c.hurt(30); return 'Mauled by the beast!'; } },
    { good: false, weight: 5,  apply: c => { c.spawn('wolf'); return 'The hunt drew wolves!'; } },
  ],

  build: [
    { good: true,  weight: 85, apply: () => '' },
    { good: true,  weight: 6,  apply: c => { c.buildBoost(0.25); return 'Inspired! Building faster'; } },
    { good: false, weight: 5,  apply: c => { c.buildBoost(-0.2); c.hurt(15); return 'Scaffold collapsed!'; } },
  ],

  pray: [
    { good: true,  weight: 45, apply: c => { c.happyAll(10); c.karma(1); return 'The gods smile. Everyone is happier'; } },
    { good: true,  weight: 25, apply: c => `A vision! +${c.gain('influence', 10, 25)} influence` },
    { good: true,  weight: 8,  apply: c => { c.trait('blessed'); return 'BLESSED by the gods!'; }, big: true },
    { good: false, weight: 10, karmaScaled: true, apply: c => { c.trait('cursed'); return 'The gods are angry… CURSED'; }, big: true },
    { good: false, weight: 6,  karmaScaled: true, apply: c => { c.lightning(); return 'Lightning strikes!'; }, big: true },
  ],

  explore: [
    { good: true,  weight: 28, apply: c => { if (c.chance(0.4)) c.keep(c.chance(0.3) ? 'potion' : 'trinket'); return `Found a cache: +${c.gain('gold', 3, 10)} gold, +${c.gain('food', 5, 12)} food`; } },
    { good: true,  weight: 16, apply: c => { c.wanderer(); return 'Met a wanderer who joins you!'; }, big: true },
    { good: true,  weight: 10, apply: c => { c.skillUp('combat', 1); c.skillUp('hunt', 1); return 'Learned the wilds. Skills up'; } },
    { good: true,  weight: 6,  apply: c => { c.gain('influence', 20, 35); return 'ANCIENT RUINS! +influence'; }, big: true },
    { good: false, weight: 16, apply: c => { c.spawn('bandit'); c.hurt(20); return 'Bandit ambush!'; }, big: true },
    { good: false, weight: 12, apply: c => { c.hurt(35); return 'Got lost and starved for days'; } },
    { good: false, weight: 5,  apply: c => { c.kill('lost in the wilds'); return 'Never returned…'; }, big: true },
    { good: false, weight: 3,  karmaScaled: true, apply: c => { c.sick(); c.plague(); return 'Brought back a PLAGUE!'; }, big: true },
  ],
};
