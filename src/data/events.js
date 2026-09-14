// Story events with choices. Each choice can go well or badly.
// e = event helper from game/events.js (wraps the game with safe helpers).
export const EVENTS = [
  {
    id: 'stranger', title: 'A Stranger at the Fire', icon: 'characters/merchant', weight: 10,
    text: 'A ragged stranger begs to join your people. Their eyes dart toward your food stores.',
    choices: [
      { label: 'Welcome them', karma: 2, apply: e => {
        if (e.chance(0.25)) { const lost = e.lose('food', 0.3); return `They vanished at night with ${lost} food. Kindness has a price.`; }
        e.wanderer(); return 'They settle in, grateful. A new villager joins!';
      } },
      { label: 'Turn them away', karma: -2, apply: e => { e.happyAll(-3); return 'They walk into the cold. Your people whisper.'; } },
    ],
  },
  {
    id: 'sick_traveler', title: 'The Sick Traveler', icon: 'characters/healer', weight: 7,
    text: 'A feverish traveler collapses near your village. Helping could save a life… or spread disease.',
    choices: [
      { label: 'Nurse them (10 food)', karma: 4, cost: { food: 10 }, apply: e => {
        if (e.chance(0.3)) { e.plague(); return 'They recover — but the fever spreads to your people!'; }
        e.gain('influence', 15, 25); return 'They recover and bless your village. +influence';
      } },
      { label: 'Leave them', karma: -3, apply: () => 'You keep your distance. The traveler is gone by morning.' },
    ],
  },
  {
    id: 'bandits', title: 'Bandits Demand Tribute', icon: 'characters/bandit', weight: 8, minPop: 5,
    text: 'Masked bandits surround the village. "Pay up, or we take it all."',
    choices: [
      { label: 'Pay tribute', karma: 0, apply: e => { const f = e.lose('food', 0.25); const g = e.lose('gold', 0.4); return `They take ${f} food and ${g} gold and leave laughing.`; } },
      { label: 'Fight!', karma: 1, apply: e => { e.spawnGroup('bandit', 2 + Math.floor(e.pop / 8)); return 'Your people grab their weapons!'; } },
    ],
  },
  {
    id: 'orphan', title: 'An Orphan in the Woods', icon: 'characters/child', weight: 6,
    text: 'Hunters found a lost child alone in the forest.',
    choices: [
      { label: 'Adopt the child', karma: 3, apply: e => { e.wanderer({ child: true }); return 'The child joins a new family.'; } },
      { label: 'Sell to passing slavers', karma: -12, apply: e => `+${e.gain('gold', 15, 25)} gold. A dark stain on your soul.` },
    ],
  },
  {
    id: 'meteor', title: 'Fire in the Sky', icon: 'effects/meteor', weight: 4,
    text: 'A burning star crashes into the hills nearby!',
    choices: [
      { label: 'Send diggers', karma: 0, apply: e => {
        if (e.chance(0.2)) { e.hurtRandom(40); return 'The crater collapses on a digger!'; }
        return `Star-metal! +${e.gain('gems', 2, 5)} gems, +${e.gain('iron', 5, 10)} iron`;
      } },
      { label: 'Pray it is an omen', karma: 1, apply: e => `The people feel chosen. +${e.gain('influence', 8, 15)} influence` },
    ],
  },
  {
    id: 'dragon', title: 'Dragon Sighted!', icon: 'characters/dragon', weight: 2, minPop: 15,
    text: 'A red dragon circles the mountains. It smells your gold.',
    choices: [
      { label: 'Offer gold (50)', karma: 0, cost: { gold: 50 }, apply: e => e.chance(0.8) ? 'The dragon takes the gold and flies away.' : (e.spawn('dragon'), 'It wants MORE. The dragon attacks!') },
      { label: 'Stand and fight', karma: 2, apply: e => { e.spawn('dragon'); return 'THE DRAGON DESCENDS!'; } },
    ],
  },
  {
    id: 'spirits', title: 'The Forest Weeps', icon: 'characters/forest_spirit', weight: 5, condition: g => g.state.stats.treesCut > 40,
    text: 'You have cut many trees. The forest spirits grow restless.',
    choices: [
      { label: 'Plant saplings (15 wood)', karma: 4, cost: { wood: 15 }, apply: e => { e.plantSaplings(8); return 'Saplings take root. The forest is calm.'; } },
      { label: 'Ignore the trees', karma: -3, apply: e => { e.spawnGroup('forest_spirit', 2); return 'Angry spirits burst from the forest!'; } },
    ],
  },
  {
    id: 'plague', title: 'Plague!', icon: 'effects/toxic_bubble', weight: 3, minPop: 8,
    text: 'Coughing spreads house to house.',
    choices: [
      { label: 'Quarantine the sick', karma: 1, apply: e => { e.happyAll(-10); return 'Hard days, but the sickness is contained.'; } },
      { label: 'Burn the sick houses', karma: -8, apply: e => { e.cureAll(); e.destroyRandomHome(); return 'The plague ends in flames. People fear you.'; } },
      { label: 'Do nothing', karma: 0, apply: e => { e.plague(); e.plague(); return 'The plague spreads wildly…'; } },
    ],
  },
  {
    id: 'harvest_festival', title: 'Harvest Festival', icon: 'items/icon_food', weight: 5, condition: g => g.state.resources.food > 60,
    text: 'Your people ask for a festival to celebrate a good year.',
    choices: [
      { label: 'Feast! (30 food)', karma: 2, cost: { food: 30 }, apply: e => { e.happyAll(25); e.babyBoom(); return 'Music, dancing… and love is in the air.'; } },
      { label: 'Save the food', karma: 0, apply: e => { e.happyAll(-5); return 'The people grumble but obey.'; } },
    ],
  },
  {
    id: 'merchant', title: 'Traveling Merchant', icon: 'characters/merchant', weight: 7,
    text: '"Rare goods from distant lands! Everything has a price."',
    choices: [
      { label: 'Buy iron (20 wood)', karma: 0, cost: { wood: 20 }, apply: e => e.chance(0.15) ? 'The crates are full of rocks. Scammed!' : `+${e.gain('iron', 6, 10)} iron` },
      { label: 'Buy a mystery box (15 gold)', karma: 0, cost: { gold: 15 }, apply: e => e.chance(0.5) ? `Jackpot! +${e.gain('gems', 2, 4)} gems` : 'Just old socks.' },
      { label: 'Rob the merchant', karma: -10, apply: e => e.chance(0.6) ? `+${e.gain('gold', 15, 30)} gold stolen` : (e.hurtRandom(35), 'The merchant had a sword! Someone is hurt.') },
    ],
  },
  {
    id: 'cave', title: 'Strange Cave', icon: 'buildings/mine_entrance', weight: 5,
    text: 'A villager found a cave glowing with a strange light.',
    choices: [
      { label: 'Explore it', karma: 0, apply: e => e.chance(0.55) ? `Treasure! +${e.gain('gold', 10, 20)} gold, +${e.gain('gems', 1, 3)} gems` : (e.spawn('cave_troll'), 'A troll was sleeping inside!') },
      { label: 'Seal it', karma: 0, apply: () => 'Some mysteries are best left alone.' },
    ],
  },
  {
    id: 'ghosts', title: 'Restless Dead', icon: 'characters/ghost', weight: 4, condition: g => g.state.stats.deaths >= 3,
    text: 'Moans echo from the graveyard at night.',
    choices: [
      { label: 'Hold a funeral rite (10 influence)', karma: 3, cost: { influence: 10 }, apply: e => { e.happyAll(8); return 'The spirits rest in peace.'; } },
      { label: 'Ignore them', karma: -1, apply: e => { e.spawnGroup('ghost', 3); return 'Ghosts rise from the graves!'; } },
    ],
  },
  {
    id: 'goblins', title: 'Goblin Thieves', icon: 'characters/goblin', weight: 5, minPop: 6,
    text: 'Goblins were seen sneaking toward your stockpile.',
    choices: [
      { label: 'Set a trap', karma: 0, apply: e => e.chance(0.6) ? `Caught them! They drop +${e.gain('gold', 5, 12)} gold` : (e.spawnGroup('goblin', 3), 'The trap failed. Goblins attack!') },
      { label: 'Leave food out for them', karma: 2, cost: { food: 15 }, apply: e => {
        if (e.chance(0.5)) return `The goblins leave +${e.gain('gems', 1, 2)} gems in thanks!`;
        return 'They ate it and left. Peace, for now.';
      } },
    ],
  },
  {
    id: 'drought', title: 'Drought', icon: 'effects/sun', weight: 4, condition: g => g.season === 'Summer',
    text: 'No rain for weeks. The crops wither.',
    choices: [
      { label: 'Ration food', karma: 0, apply: e => { e.happyAll(-8); return 'Everyone eats less. Morale drops.'; } },
      { label: 'Sacrifice to the rain god', karma: -10, needsVictim: true, apply: e => { e.sacrifice(); return e.chance(0.7) ? 'Rain falls the next day…' : 'A life given for nothing. The sky stays dry.'; } },
    ],
  },
];
