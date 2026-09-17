// Eras unlock by population + required buildings.
export const ERAS = [
  { name: 'Primitive', pop: 0,  requires: [] },
  { name: 'Village',   pop: 6,  requires: ['campfire', 'stockpile'] },
  { name: 'Town',      pop: 16, requires: ['well', 'shrine'] },
  { name: 'Kingdom',   pop: 35, requires: ['market', 'barracks'] },
  { name: 'Industrial', pop: 50, requires: ['castle', 'printing_press'], science: 150 },
  { name: 'Atomic',     pop: 70, requires: ['factory', 'research_lab'], science: 600 },
  { name: 'Future',     pop: 90, requires: ['power_plant', 'academy_of_science'], science: 2000 },
];

// size: footprint in tiles. work: seconds of builder labour.
// housing, storage, bonus... are read by the game systems.
export const BUILDINGS = {
  // ---- Primitive ----
  campfire:   { name: 'Campfire',   era: 0, size: 1, cost: { wood: 5 },  work: 6,  light: 5, happy: 5, desc: 'Gathering point. Villagers eat and rest here. Lights the night.' },
  tent:       { name: 'Tent',       era: 0, size: 1, cost: { wood: 10 }, work: 10, housing: 4, desc: 'Shelter for 4. More homes = more children.' },
  stockpile:  { name: 'Stockpile',  era: 0, size: 1, cost: { wood: 12 }, work: 10, storage: 150, desc: '+150 storage for every resource.' },
  farm:       { name: 'Farm',       era: 0, size: 2, cost: { wood: 15 }, work: 16, workplace: 'farm', slots: 2, desc: 'Farmers grow food here. Weak in winter.' },

  // ---- Village ----
  hut:          { name: 'Hut',          era: 1, size: 1, cost: { wood: 20, stone: 5 },  work: 18, housing: 6, desc: 'Sturdy home for 6.' },
  well:         { name: 'Well',         era: 1, size: 1, cost: { stone: 20 },           work: 16, happy: 5, health: 0.5, desc: 'Clean water: fewer sicknesses, happier villagers.' },
  lumber_mill:  { name: 'Lumber Mill',  era: 1, size: 2, cost: { wood: 30, stone: 10 }, work: 24, bonus: { chop: 0.3 }, desc: '+30% wood from chopping.' },
  mine_entrance:{ name: 'Mine',         era: 1, size: 2, cost: { wood: 30, stone: 10 }, work: 26, workplace: 'mine', slots: 3, desc: 'Endless ore — but cave-ins and monsters lurk deep.' },
  shrine:       { name: 'Shrine',       era: 1, size: 1, cost: { stone: 30, gems: 1 },  work: 22, fate: 0.1, desc: '+10% good fate. Unlocks Prayer.' },
  windmill:     { name: 'Windmill',     era: 1, size: 1, cost: { wood: 40, stone: 15 }, work: 26, bonus: { farm: 0.3 }, desc: '+30% farm harvests.' },
  granary:      { name: 'Granary',      era: 1, size: 2, cost: { wood: 35 },            work: 22, storageFood: 300, desc: '+300 food storage. Food spoils less.' },

  // ---- Town ----
  house:       { name: 'House',       era: 2, size: 2, cost: { wood: 40, stone: 20 },           work: 30, housing: 10, desc: 'Family home for 10.' },
  blacksmith:  { name: 'Blacksmith',  era: 2, size: 2, cost: { wood: 30, stone: 30, iron: 10 },  work: 34, bonus: { chop: 0.2, mine: 0.25 }, combat: 0.1, workplace: 'smith', slots: 2, recipe: { cost: { iron: 1, coal: 1, wood: 1 }, out: 2 }, desc: 'Smiths forge iron weapons here. Also better tools for everyone.' },
  market:      { name: 'Market',      era: 2, size: 2, cost: { wood: 50, stone: 20 },           work: 30, gold: 2, trade: true, desc: 'Earns gold daily. Unlocks player trading.' },
  tavern:      { name: 'Tavern',      era: 2, size: 2, cost: { wood: 60, stone: 20 },           work: 34, happy: 15, desc: 'Big happiness boost. Wanderers visit more.' },
  barracks:    { name: 'Barracks',    era: 2, size: 2, cost: { wood: 40, stone: 40, iron: 10 },  work: 36, combat: 0.3, defense: 10, workplace: 'train', slots: 4, desc: 'Recruits train here to become warriors. Needed to raid other players.' },
  stable:      { name: 'Stable',      era: 2, size: 2, cost: { wood: 50 },                      work: 28, speed: 0.15, desc: 'Villagers move 15% faster.' },
  fishing_hut: { name: 'Fishing Hut', era: 2, size: 1, cost: { wood: 30 },                      work: 22, workplace: 'fish', slots: 2, nearWater: true, desc: 'Steady food all year. Must be next to water.' },
  healer_hut:  { name: 'Healer Hut',  era: 2, size: 1, cost: { wood: 30, stone: 15 },           work: 26, heal: true, health: 1, desc: 'Cures sickness and heals the wounded.' },
  school:      { name: 'School',      era: 2, size: 1, cost: { wood: 40, stone: 30, gold: 5 },   work: 32, learn: 0.5, daily: { science: 2 }, desc: 'Skills grow 50% faster. +2 science a day.' },
  watchtower:  { name: 'Watchtower',  era: 2, size: 1, cost: { wood: 35, stone: 10 },           work: 24, defense: 5, light: 4, desc: 'Spots threats. Adds defense.' },
  wall_wood:   { name: 'Wooden Wall', era: 2, size: 1, cost: { wood: 8 },                       work: 6,  defense: 1, desc: 'Each segment adds a little defense.' },
  gate_wood:   { name: 'Wooden Gate', era: 2, size: 1, cost: { wood: 15 },                      work: 10, defense: 1, desc: 'Gate for your walls.' },

  // ---- Kingdom ----
  library:    { name: 'Library',     era: 3, size: 2, cost: { wood: 60, stone: 80, gold: 20 },  work: 44, learn: 0.5, influence: 3, daily: { science: 5 }, desc: 'Knowledge: faster skills, +5 science and +3 influence a day.' },
  bank:       { name: 'Bank',        era: 3, size: 2, cost: { stone: 100, gold: 40 },           work: 46, interest: 0.05, desc: '5% daily interest on gold.' },
  temple:     { name: 'Temple',      era: 3, size: 2, cost: { stone: 120, gold: 30, gems: 5 },  work: 50, fate: 0.2, influence: 5, desc: '+20% good fate, daily influence.' },
  castle:     { name: 'Castle',      era: 3, size: 3, cost: { stone: 200, iron: 40, gold: 50 }, work: 80, housing: 25, defense: 40, light: 6, desc: 'Seat of a kingdom. Crowns a king.' },
  shipyard:   { name: 'Shipyard',    era: 1, size: 2, cost: { wood: 60, stone: 15 },            work: 30, nearWater: true, sprite: 'boats/dock', desc: 'Build boats here and set sail: steer your own ship, fire bombs at pirates and sea serpents, bring home treasure. Must be next to water.' },
  harbor:     { name: 'Harbor',      era: 3, size: 2, cost: { wood: 120, iron: 20 },            work: 44, workplace: 'fish', slots: 4, nearWater: true, gold: 3, desc: 'Big fishing and daily trade gold.' },
  wall_stone: { name: 'Stone Wall',  era: 3, size: 1, cost: { stone: 15 },                      work: 10, defense: 3, desc: 'Strong wall segment.' },
  gate_stone: { name: 'Stone Gate',  era: 3, size: 1, cost: { stone: 30, iron: 5 },             work: 16, defense: 3, desc: 'Strong gate.' },
  statue:     { name: 'Hero Statue', era: 3, size: 1, cost: { stone: 80, gold: 20 },            work: 36, happy: 10, karma: 0.1, desc: 'Inspires the people.' },
  fountain:   { name: 'Fountain',    era: 3, size: 1, cost: { stone: 70, gems: 3 },             work: 32, happy: 12, health: 0.5, desc: 'Beauty and clean water.' },
  wonder:     { name: 'Golden Wonder', era: 3, size: 3, cost: { stone: 500, gold: 300, gems: 50 }, work: 300, fate: 0.4, influence: 25, happy: 30, desc: 'A legend. Massive fate, influence and fame.' },

  // ================= expansion: weapons, food, industry, civic, faith, prestige =================
  // ---- Military
  craft_hut:       { name: 'Craft Hut',        era: 0, size: 1, cost: { wood: 25, stone: 5 },               work: 16, workplace: 'smith', slots: 1, recipe: { cost: { wood: 4, stone: 2 }, out: 1 }, desc: 'Smiths carve wooden spears and stone axes. Warriors need weapons to fight well.' },
  weaponsmith:     { name: 'Weaponsmith',      era: 2, size: 2, cost: { wood: 40, stone: 40, iron: 20 },    work: 40, workplace: 'smith', slots: 3, recipe: { cost: { iron: 2, coal: 1, wood: 1 }, out: 4 }, combat: 0.1, desc: 'Master smiths forge steel blades in bulk.' },
  armory:          { name: 'Armory',           era: 2, size: 2, cost: { wood: 30, stone: 50, iron: 10 },    work: 34, storageWeapons: 60, combat: 0.15, defense: 5, desc: '+60 weapon storage. Well-kept gear: +15% combat.' },
  training_ground: { name: 'Training Ground',  era: 0, size: 2, cost: { wood: 40 },                         work: 24, combat: 0.15, workplace: 'train', slots: 3, desc: 'Recruits drill here until trained. Only trained people can be warriors.' },
  guard_post:      { name: 'Guard Post',       era: 1, size: 1, cost: { wood: 20, stone: 15 },              work: 18, defense: 4, spot: 0.06, light: 3, desc: 'Watchmen on the road: +defense, spot armies more often.' },
  siege_workshop:  { name: 'Siege Workshop',   era: 3, size: 2, cost: { wood: 120, iron: 40 },              work: 60, raidPower: 0.35, desc: 'Rams and catapults: your armies hit 35% harder.' },

  // ---- Food
  orchard:         { name: 'Orchard',          era: 1, size: 2, cost: { wood: 30 },                         work: 22, workplace: 'farm', slots: 3, desc: 'Fruit trees tended by farmers. More workers than a field.' },
  pasture:         { name: 'Pasture',          era: 1, size: 2, cost: { wood: 35 },                         work: 22, daily: { food: 6 }, desc: 'Grazing cattle give +6 food every day.' },
  hunters_lodge:   { name: "Hunter's Lodge",   era: 0, size: 1, cost: { wood: 25 },                         work: 18, bonus: { hunt: 0.4 }, desc: '+40% meat from hunting.' },
  apiary:          { name: 'Apiary',           era: 1, size: 1, cost: { wood: 20 },                         work: 14, daily: { food: 3 }, happy: 2, desc: 'Beehives: +3 food a day and a little sweetness.' },
  bakery:          { name: 'Bakery',           era: 2, size: 1, cost: { wood: 30, stone: 25 },              work: 26, bonus: { farm: 0.25 }, happy: 4, desc: 'Bread from grain: +25% farm food.' },
  brewery:         { name: 'Brewery',          era: 2, size: 2, cost: { wood: 45, stone: 20 },              work: 30, happy: 10, gold: 1, desc: 'Ale for the people: +10 happiness, +1 gold a day.' },

  // ---- Industry
  quarry:          { name: 'Quarry',           era: 1, size: 2, cost: { wood: 30 },                         work: 24, workplace: 'mine', outcome: 'quarry', slots: 3, desc: 'Miners cut endless stone here — safer than the deep mine.' },
  charcoal_kiln:   { name: 'Charcoal Kiln',    era: 1, size: 1, cost: { wood: 25, stone: 15 },              work: 18, daily: { coal: 4 }, desc: '+4 coal every day for the forges.' },
  smelter:         { name: 'Smelter',          era: 2, size: 2, cost: { stone: 60, coal: 10 },              work: 34, bonus: { mine: 0.3 }, daily: { iron: 2 }, desc: '+30% ore from mining and +2 iron a day.' },
  carpenter:       { name: 'Carpenter',        era: 1, size: 1, cost: { wood: 30, stone: 10 },              work: 20, bonus: { chop: 0.15, build: 0.3 }, desc: 'Builders work 30% faster, +15% wood.' },
  warehouse:       { name: 'Warehouse',        era: 1, size: 2, cost: { wood: 50, stone: 20 },              work: 26, storage: 400, desc: '+400 storage for every resource.' },
  enchanting_table: { name: 'Enchanting Table', era: 0, size: 1, cost: { stone: 20, gems: 5 },               work: 6, sprite: 'buildings/enchanting_table', craftStation: true, desc: 'Stand next to it and press E to enchant weapons, armour and tools with gems and gold.' },
  crafting_table:  { name: 'Crafting Table',   era: 0, size: 1, cost: { wood: 10 },                         work: 4, sprite: 'buildings/crafting_table', craftStation: true, desc: 'Stand next to it to craft weapons, tools, armour and potions. Only a few basics can be made by hand.' },
  workshop:        { name: 'Workshop',         era: 0, size: 1, cost: { wood: 20 },                         work: 14, storage: 60, bonus: { build: 0.15 }, desc: 'Tools and benches: builders work 15% faster, +60 storage.' },

  // ---- Civic
  employment_office: { name: 'Employment Office', era: 1, size: 2, cost: { wood: 50, stone: 20 },            work: 26, desc: 'Clerks keep the jobs you want staffed: set a target for each job and they move people for you.' },
  town_hall:       { name: 'Town Hall',        era: 1, size: 2, cost: { wood: 60, stone: 40 },              work: 36, influence: 2, happy: 4, desc: 'Seat of the Court. +2 influence a day. Unlocks the Treasurer.' },
  courthouse:      { name: 'Courthouse',       era: 2, size: 2, cost: { stone: 70, gold: 10 },              work: 36, karma: 0.2, happy: 3, lawful: true, desc: 'Justice for all: greedy villagers stop stealing, karma slowly rises.' },
  jail:            { name: 'Jail',             era: 2, size: 1, cost: { stone: 40, iron: 5 },               work: 22, defense: 2, lawful: true, desc: 'Thieves think twice: no more stolen gold.' },
  inn:             { name: 'Inn',              era: 1, size: 1, cost: { wood: 40, stone: 10 },              work: 24, join: 0.12, happy: 5, housing: 2, desc: 'Travellers rest here and often decide to stay.' },
  bathhouse:       { name: 'Bathhouse',        era: 2, size: 2, cost: { stone: 60, wood: 20 },              work: 30, health: 1, happy: 6, desc: 'Clean bodies, fewer plagues, happier people.' },
  hospital:        { name: 'Hospital',         era: 3, size: 2, cost: { stone: 90, gold: 20 },              work: 44, health: 2, heal: true, desc: 'Cures sickness quickly and heals the wounded.' },

  // ---- Faith & knowledge
  chapel:          { name: 'Chapel',           era: 1, size: 1, cost: { wood: 30, stone: 20 },              work: 22, fate: 0.05, happy: 4, desc: 'A small house of prayer: +5% luck. Unlocks the High Priest.' },
  cathedral:       { name: 'Cathedral',        era: 3, size: 3, cost: { stone: 250, gold: 60, gems: 10 },   work: 120, fate: 0.25, influence: 4, happy: 8, desc: 'Towering faith: +25% luck, +4 influence a day.' },
  monastery:       { name: 'Monastery',        era: 2, size: 2, cost: { wood: 50, stone: 60 },              work: 40, learn: 0.3, fate: 0.05, daily: { science: 1 }, desc: 'Monks teach and pray: skills grow 30% faster, +1 science a day.' },
  observatory:     { name: 'Observatory',      era: 2, size: 1, cost: { stone: 50, gems: 2 },               work: 30, spot: 0.2, learn: 0.1, daily: { science: 3 }, desc: 'Watch the horizon and the stars: armies spotted far more often, +3 science a day.' },
  university:      { name: 'University',       era: 3, size: 2, cost: { stone: 120, gold: 40 },             work: 60, learn: 0.8, influence: 3, daily: { science: 8 }, desc: 'Scholars everywhere: skills grow 80% faster, +8 science a day.' },
  mage_tower:      { name: 'Mage Tower',       era: 3, size: 1, cost: { stone: 100, gems: 8 },              work: 50, fate: 0.15, influence: 6, defense: 6, workplace: 'magic', slots: 2, desc: 'Wizards study here (faster mana and magic). Arcane wards: +15% luck, +6 influence a day.' },

  // ================= intrigue, gunpowder and the modern ages =================
  // ---- Espionage & gunpowder
  spy_den:          { name: 'Spy Den',           era: 2, size: 1, cost: { wood: 40, stone: 30, gold: 15 },   work: 30, workplace: 'spytrain', slots: 2, counterIntel: 0.1, desc: 'Trains spies. Spies can scout, sabotage and steal from other realms.' },
  powder_mill:      { name: 'Powder Mill',       era: 3, size: 2, cost: { wood: 60, stone: 50, iron: 15 },   work: 44, workplace: 'smith', slots: 2, recipe: { cost: { coal: 2, iron: 1 }, out: 2, res: 'bombs' }, desc: 'Smiths pack gunpowder bombs. Bombs blast invaders and topple enemy buildings.' },
  prison:           { name: 'Prison',            era: 2, size: 2, cost: { stone: 80, iron: 10 },             work: 40, lawful: true, traitorWatch: 0.1, desc: 'Locks up traitors. Guards notice suspicious behaviour.' },
  embassy:          { name: 'Embassy',           era: 2, size: 2, cost: { stone: 60, gold: 30 },             work: 36, counterIntel: 0.12, join: 0.05, influence: 2, desc: 'Diplomats watch for foreign agents: enemy spies fail more often.' },
  cannon_tower:     { name: 'Cannon Tower',      era: 3, size: 1, cost: { stone: 90, iron: 30 },             work: 44, defense: 20, bombDefense: 1, desc: 'Fires bombs at invaders automatically (uses bombs from storage).' },
  secret_vault:     { name: 'Secret Vault',      era: 3, size: 1, cost: { stone: 70, iron: 20, gold: 20 },   work: 36, vault: 0.5, desc: 'Half of all gold is hidden from thieves, traitors and spies.' },

  // ---- Industrial age
  factory:          { name: 'Factory',           era: 4, size: 2, cost: { stone: 150, iron: 80, coal: 40 },  work: 70, bonus: { build: 0.4, chop: 0.2, mine: 0.2 }, daily: { weapons: 3 }, desc: 'Mass production: faster building and 3 weapons a day.' },
  steel_mill:       { name: 'Steel Mill',        era: 4, size: 2, cost: { stone: 120, coal: 60 },            work: 60, daily: { iron: 8 }, desc: '+8 iron every day.' },
  printing_press:   { name: 'Printing Press',    era: 3, size: 1, cost: { wood: 60, stone: 40, iron: 10 },   work: 40, daily: { science: 8 }, influence: 2, desc: 'Books spread ideas: +8 science a day.' },
  railway_station:  { name: 'Railway Station',   era: 4, size: 2, cost: { stone: 120, iron: 100 },           work: 70, speed: 0.3, join: 0.08, desc: 'Everyone moves 30% faster and newcomers arrive by train.' },
  tenement:         { name: 'Tenement',          era: 4, size: 3, cost: { stone: 140, wood: 60 },            work: 60, housing: 30, happy: -3, desc: 'Cramped housing for 30.' },
  clock_tower:      { name: 'Clock Tower',       era: 4, size: 1, cost: { stone: 100, iron: 20 },            work: 50, work_bonus: 0.1, happy: 6, desc: 'Ordered days: everyone works 10% faster.' },

  // ---- Science
  research_lab:     { name: 'Research Lab',      era: 4, size: 2, cost: { stone: 120, iron: 60, gold: 40 },  work: 70, daily: { science: 12 }, desc: '+12 science a day.' },
  telegraph_office: { name: 'Telegraph Office',  era: 4, size: 1, cost: { wood: 40, iron: 40 },              work: 40, spot: 0.15, counterIntel: 0.05, desc: 'Fast messages from the borders: armies and spies spotted sooner.' },
  museum:           { name: 'Museum',            era: 4, size: 2, cost: { stone: 160, gold: 60 },            work: 70, happy: 12, influence: 4, desc: 'History on display: +12 happiness, +4 influence a day.' },
  academy_of_science: { name: 'Academy of Science', era: 5, size: 2, cost: { stone: 220, iron: 80, gold: 80 }, work: 100, daily: { science: 30 }, learn: 0.5, desc: '+30 science a day. Skills grow 50% faster.' },
  vertical_farm:    { name: 'Vertical Farm',     era: 5, size: 2, cost: { stone: 150, iron: 60 },            work: 80, daily: { food: 50 }, desc: '+50 food a day, even in winter.' },
  hospital_modern:  { name: 'Modern Hospital',   era: 5, size: 2, cost: { stone: 180, iron: 60, science: 100 }, work: 90, health: 4, heal: true, desc: 'Sickness barely spreads. The wounded recover fast.' },

  // ---- Atomic age
  power_plant:      { name: 'Power Plant',       era: 5, size: 2, cost: { stone: 200, iron: 120, coal: 80 }, work: 100, work_bonus: 0.25, desc: 'Electricity everywhere: everyone works 25% faster.' },
  radar_array:      { name: 'Radar Array',       era: 5, size: 1, cost: { iron: 100, science: 150 },         work: 60, spot: 0.35, counterIntel: 0.1, desc: 'Sees every army, spy and missile coming.' },
  bunker:           { name: 'Bunker',            era: 5, size: 2, cost: { stone: 250, iron: 100 },           work: 90, defense: 40, housing: 10, shelter: 0.5, desc: 'Halves deaths from missile strikes and sabotage.' },
  airfield:         { name: 'Airfield',          era: 5, size: 3, cost: { stone: 250, iron: 200, science: 200 }, work: 140, raidPower: 0.5, desc: 'Air support: your armies strike 50% harder.' },
  tank_factory:     { name: 'Tank Factory',      era: 5, size: 2, cost: { iron: 250, coal: 100 },            work: 120, combat: 0.4, daily: { weapons: 6 }, desc: '+40% combat and 6 weapons a day.' },
  missile_silo:     { name: 'Missile Silo',      era: 5, size: 2, cost: { stone: 300, iron: 250, science: 400 }, work: 160, missile: true, desc: 'Launch missiles at distant realms. Terrible power — and terrible karma.' },

  // ---- Future age
  robot_factory:    { name: 'Robot Factory',     era: 6, size: 2, cost: { iron: 300, science: 500 },         work: 150, robots: 4, desc: 'Builds robot workers (up to 4 per factory). Robots never eat or sleep.' },
  drone_hub:        { name: 'Drone Hub',         era: 6, size: 1, cost: { iron: 150, science: 300 },         work: 90, spot: 0.3, defense: 25, counterIntel: 0.15, desc: 'Drones patrol the skies: spot everything, shoot down spies.' },
  fusion_reactor:   { name: 'Fusion Reactor',    era: 6, size: 2, cost: { iron: 400, science: 800 },         work: 200, work_bonus: 0.4, storage: 800, desc: 'Limitless energy: +40% work, +800 storage.' },
  arcology:         { name: 'Arcology',          era: 6, size: 4, cost: { stone: 500, iron: 300, gems: 60 }, work: 220, housing: 80, happy: 10, desc: 'A city in a single tower. Houses 80.' },
  shield_generator: { name: 'Shield Generator',  era: 6, size: 2, cost: { iron: 350, science: 900, gems: 20 }, work: 220, defense: 100, missileShield: true, desc: 'An energy dome: blocks missiles and most raiders.' },
  hyperloop:        { name: 'Hyperloop Station', era: 6, size: 2, cost: { iron: 300, science: 400 },         work: 160, speed: 0.6, desc: 'Travel at incredible speed: +60% movement.' },

  // ---- Future wonders
  spaceport:        { name: 'Spaceport',         era: 6, size: 3, cost: { iron: 1000, science: 3000, gold: 500 }, work: 600, influence: 50, fate: 0.3, happy: 30, desc: 'Humanity reaches the stars. The greatest wonder of any realm.' },
  ai_core:          { name: 'AI Core',           era: 6, size: 2, cost: { iron: 400, science: 1500, gems: 30 }, work: 300, learn: 2, fate: 0.15, daily: { science: 60 }, desc: 'A thinking machine: +60 science a day, skills grow triple speed.' },
  holo_park:        { name: 'Holo Park',         era: 6, size: 2, cost: { iron: 200, science: 300 },         work: 140, happy: 30, desc: 'Holographic gardens: +30 happiness.' },
  cloning_vat:      { name: 'Cloning Vat',       era: 6, size: 2, cost: { iron: 300, science: 700 },         work: 200, fertility: 1, karma: -0.5, desc: 'Grow new citizens: many more births. The gods frown.' },
  orbital_cannon:   { name: 'Orbital Cannon',    era: 6, size: 2, cost: { iron: 800, science: 2000 },        work: 400, missile: true, orbital: true, defense: 50, desc: 'Strikes any realm from orbit. Stronger than any missile.' },
  mech_bay:         { name: 'Mech Bay',          era: 6, size: 2, cost: { iron: 500, science: 800 },         work: 250, combat: 0.8, raidPower: 0.5, desc: 'Giant war machines: +80% combat and army strength.' },

  // ---- Prestige & defense
  stone_tower:     { name: 'Stone Tower',      era: 3, size: 1, cost: { stone: 70, iron: 10 },              work: 34, defense: 12, spot: 0.1, light: 5, desc: 'Archers on the walls: +12 defense.' },
  fortress:        { name: 'Fortress',         era: 3, size: 3, cost: { stone: 300, iron: 80, gold: 40 },   work: 140, defense: 60, combat: 0.2, housing: 12, desc: 'An unbreakable stronghold.' },
  palace:          { name: 'Palace',           era: 3, size: 3, cost: { stone: 250, gold: 120, gems: 15 },  work: 140, housing: 20, influence: 10, happy: 12, desc: 'Royal splendour: housing, influence and pride.' },
  colosseum:       { name: 'Colosseum',        era: 3, size: 3, cost: { stone: 280, gold: 50 },             work: 120, happy: 25, gold: 4, combat: 0.1, desc: 'Games and glory: +25 happiness, +4 gold a day.' },
  lighthouse:      { name: 'Lighthouse',       era: 3, size: 1, cost: { stone: 80, coal: 20 },              work: 40, nearWater: true, bonus: { fish: 0.4 }, spot: 0.08, light: 7, desc: '+40% fish and a watchful light. Must be by water.' },
  royal_garden:    { name: 'Royal Garden',     era: 2, size: 2, cost: { wood: 30, stone: 40, gold: 15 },    work: 30, happy: 15, health: 0.5, desc: 'Flowers and fountains: +15 happiness.' },
};

export const BUILDING_ORDER = Object.keys(BUILDINGS);

// Bigger homes take more room. Buildings placed before a size change keep their old footprint.
export const OLD_SIZES = { house: 1, tenement: 2, arcology: 3 };
/** Footprint of a placed building (tiles per side). */
export const sizeOf = b => b.size || BUILDINGS[b.type].size;
/** The sprite a building is drawn with (most use their own; a few borrow art from other sheets). */
export const buildingSprite = type => BUILDINGS[type]?.sprite || `buildings/${type}`;

// Build menu groups
export const CATEGORIES = [
  ['homes', 'Homes & Storage'], ['food', 'Food'], ['industry', 'Industry'], ['military', 'Military'],
  ['civic', 'Civic'], ['faith', 'Faith & Knowledge'], ['wonders', 'Prestige'],
  ['intrigue', 'Espionage & War Machines'], ['science', 'Science'], ['industry2', 'Industry & Future Tech'],
];
const CAT = {
  homes: 'crafting_table campfire tent stockpile hut house granary warehouse workshop palace',
  food: 'farm windmill fishing_hut harbor shipyard orchard pasture hunters_lodge apiary bakery brewery',
  industry: 'lumber_mill mine_entrance blacksmith quarry charcoal_kiln smelter carpenter',
  military: 'barracks watchtower wall_wood gate_wood wall_stone gate_stone craft_hut weaponsmith armory training_ground guard_post siege_workshop stone_tower fortress',
  civic: 'employment_office well market tavern stable healer_hut school town_hall courthouse jail inn bathhouse hospital bank prison embassy secret_vault tenement clock_tower railway_station museum hospital_modern holo_park cloning_vat arcology',
  intrigue: 'spy_den powder_mill cannon_tower missile_silo radar_array drone_hub shield_generator orbital_cannon bunker airfield tank_factory mech_bay',
  science: 'printing_press research_lab telegraph_office academy_of_science ai_core',
  industry2: 'factory steel_mill power_plant fusion_reactor robot_factory vertical_farm hyperloop spaceport',
  faith: 'shrine temple library chapel cathedral monastery observatory university mage_tower',
  wonders: 'castle statue fountain wonder colosseum lighthouse royal_garden',
};
for (const [cat, list] of Object.entries(CAT)) for (const t of list.split(' ')) if (BUILDINGS[t]) BUILDINGS[t].cat = cat;
for (const def of Object.values(BUILDINGS)) def.cat ||= 'civic';
