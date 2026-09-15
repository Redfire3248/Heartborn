// Newest first. Shown by the admin `changelog` command and in Settings.
export const CHANGELOG = [
  {
    title: 'In person, in other lands',
    changes: [
      'Visiting someone: your avatar arrives at the edge of their village and you walk their land with WASD or the stick',
      'Infiltrate in person: a new spy mission. When your spy arrives, press Take control in the World panel and walk their village disguised as a traveller',
      'Walk up to a building to sabotage it or rob a store, or to a person to assassinate them or turn them against their ruler. One act ends the mission; guards nearby make it much riskier, doing it yourself makes it likelier to work',
      'The owner sees exactly that building burn or that person fall. If you never take control, the spy scouts on their own after 10 minutes',
      'Strangers are real: the owner of a land sees visitors and travellers walking through their village live',
    ],
  },
  {
    title: 'Admin finds everyone',
    changes: [
      'Fixed: in a private world the admin console listed no other players, so give, karma, nuke, missile and the other player commands could not find anyone. It now reads the world you are in, and anyone online always shows up',
    ],
  },
  {
    title: 'Auto-pick',
    changes: [
      'When something unlocks, the best choice is made for you: a new court office gets the best person for it (once the village has enough workers to spare them)',
      'New laws: if you have not set that category yourself, the best law for your village is enacted for free. It weighs work, happiness, luck, newcomers, defence and karma, so a good ruler is not handed Tyranny or Forced Labour',
      'Laws you decree yourself are never changed',
      'Switch Auto-pick on or off at the top of the Rule panel',
    ],
  },
  {
    title: 'See your enemies coming',
    changes: [
      'Enemies inside your land that are off screen show as red dots on the edge of the screen, pointing their way, with a count for groups; armies pulse and dragons and other bosses are bigger',
      'Minimap: enemies are round red dots, bigger and pulsing for armies and bosses',
    ],
  },
  {
    title: 'Blood in the village, dragons and real armies',
    changes: [
      'People can kill people of their own village: the cruel, the greedy and the miserable pick fights, and some fights end in murder',
      'A brawl stops when someone is beaten; a deadly attack does not. Victims fight back if they are soldiers or brave, and run otherwise (but a killer runs faster)',
      'A killing shakes everyone: grief for the family and witnesses, guards strike the killer down, and grieving family may take revenge. -2 karma',
      'Your avatar can switch to Hostile (F or the button on the avatar bar) and strike your own people with Space or ACT. Peaceful mode never hurts anyone',
      'Dragons are real threats: 1500 HP, armour that shrugs off most blows (weapons cut better than bare hands), fire breath that burns everyone near it, and they no longer fly off after one kill. Slaying one pays far more',
      'Cave Trolls and Forest Spirits are tougher, and bosses are never weakened for small villages',
      'Barbarian warbands grow with your village and era (up to 80 soldiers) and hit harder; kingdoms send bigger raiding parties',
      'Admin: traits=* and traits=good give personality traits only, not earned titles like Knight (name them, e.g. traits=knighted, or use traits=all). A profile no longer lists Knight and Jack of all trades twice',
    ],
  },
  {
    title: 'Nukes and missiles anywhere',
    changes: [
      'Admin: missile <nuke|missile|orbital> <me|player> (or nuke <me|player>): aim a free strike on any land; strikes on other realms ignore shields, land in about 20 seconds and show on the World Map',
      'World Map: missiles fly with a trail, a countdown and the missile pointing at its target; missiles coming at you glow red',
      'Nukes: a 9 tile blast, a bigger missile, a mushroom cloud and a huge screen shake',
      'Size is its own setting: Strength no longer makes people bigger (a strength=10000 hero filled the screen). Admin: person size=2',
    ],
  },
  {
    title: 'What people hold and wear',
    changes: [
      'Fixed: your avatar always showed a sword. People now hold the weapon or tool they really have: a spear from the armoury until a smithy forges swords, their own tool, or nothing',
      'People wear the clothes of their trade: change someone\'s trade and their look changes with it (soldiers, spies and wizards still look like their job; a Jack of all trades dresses for the job at hand)',
      'Admin: person trade=farm also puts them to work in that trade',
      'Multiplayer: the Missile Silo and Orbital Cannon have an Aim at another realm button: pick a player, then aim on a map of their land',
    ],
  },
  {
    title: 'Items on the ground',
    changes: [
      'Drag an item out of a villager\'s pack and drop it on open ground: it lies there with a shadow and a count',
      'Grab an item off the ground and it swings on the keychain: drop it on a villager to give it, or somewhere else to move it',
      'Your avatar picks items up by walking over them',
      'Admin: drop <item|*> [count] puts items at your cursor',
      'Admin: autocomplete keeps suggesting person options however many you type; strength, speed and stamina can go past 10 (the effect grows up to 30)',
    ],
  },
  {
    title: 'Family homes and your own avatar',
    changes: [
      'Households live together: a couple, their children and unmarried grown children share one home, and families who arrived together stay together',
      'Homes are reserved for their family: a house shows Home of the Fisher family with every resident, and strangers never move into it, even with beds to spare',
      'Families keep their home; newlyweds move into one of their own when a house is free; a family too big for its house takes a second one nearby, grown children first',
      'Castles, Tenements and Arcologies are split into flats for many families',
      'At night people walk to their own home; the profile shows where someone lives',
      'Play as anyone: tap Play as in a villager\'s profile to make them your avatar and walk, fight, chop and mine as them. The Avatar button (G) plays as them again',
    ],
  },
  {
    title: 'Strength, Speed and Stamina',
    changes: [
      'Everyone is born with Strength, Speed and Stamina (1 to 10), shown as bars in their profile. Children take after their parents; Strong, Nimble and Hardworking people are born with more',
      'Speed: quick people really walk faster (up to 1.3x, slow ones 0.76x) and take quicker steps',
      'Strength: chopping, mining, building, farming, forging, hunting and fighting go up to 25% faster and hit harder; strong people swing their tools faster and stand a little bigger',
      'Stamina: up to 10% faster at any work, slower hunger and fewer wounds from beasts',
      'Hard work builds the body: labourers slowly grow stronger, fighters stronger and tougher. Your ruler in Lead mode uses their Strength and Speed too',
      'Admin: person strength=10 speed=10 stamina=10 (or body=*)',
    ],
  },
  {
    title: 'Lead in person',
    changes: [
      'Press Lead (or G) to become your ruler: walk with WASD or the on-screen stick, Space or ACT to strike, chop trees and break rocks (double yield)',
      'Your ruler fights any beast in reach, picks up finds by walking over them, and eats from the stores when hungry',
      'People working near you work 50% faster: the ruler is watching',
      'Bounties: named monsters with a price on their head turn up while you lead (Old Greytooth, Grumbelly, Ashwing the Dragon...). A pointer at your feet leads you to them; slaying one pays gold and influence',
    ],
  },
  {
    title: 'Aim your missiles',
    changes: [
      'Missiles and orbital strikes are aimed: a targeting map of the enemy land shows every building, tap where it should land and see exactly what the blast will hit',
      'Fire at your own land too, from the Missile Silo or Orbital Cannon: clear monsters, raiders, forest and rocks, or flatten what you no longer want (only -3 karma)',
      'Incoming strikes are visible: a red target ring on the ground, the missile streaking down (or a beam from orbit), a flash, then ruins',
      'The blast wrecks buildings near the centre, damages the ones at the edge and kills whoever is inside it; bunkers still save half',
    ],
  },
  {
    title: 'A smarter Master Builder',
    changes: [
      'The Master Builder works toward your goals and the next era first, then homes, farms, missing workplaces and useful new buildings, and tells you why he ordered each one',
      'No more streets of warehouses: storage is only built when wood, stone or food is really full, with a sensible limit',
      'Upgrade the Master Builder in the Court: each level runs another project at once and plans faster (up to level 5)',
    ],
  },
  {
    title: 'Upgrade your workers',
    changes: [
      'Upgrade a position in the Jobs panel: every level makes everyone in it work 10% faster, up to level 10 (twice as fast)',
      'Builders build faster with each upgrade; woodcutters, miners, farmers, fishers, hunters, gatherers and smiths can be upgraded too',
      'Each level costs more wood, stone and gold (iron from level 5, science from level 8); the next cost is shown right under the job',
    ],
  },
  {
    title: 'Playtest fixes',
    changes: [
      'Smiths stop forging when the armoury is full (a test village had 671 weapons and no stone left); they mine or gather instead, and still make tools for anyone who needs one',
      'When stone runs out but food is plentiful, gatherers go and break rocks',
      'A small camp draws wanderers in much faster, so the first days are livelier',
      'The same event no longer comes back within a few days',
      'Thefts and tributes take a share of your stores, but never a crippling amount',
      'Steadier population: parents are at least 16, families raise up to four children, and big villages grow more slowly',
      'Science from learning: School +2, Monastery +1, Observatory +3, Library +5, University +8, Printing Press +8 a day; new goals point you to the School and Library',
    ],
  },
  {
    title: 'Fast lives, visible work',
    changes: [
      'People age much faster: children grow up in about three game days and a whole life passes in about an hour, so you watch generations rise',
      'Workers carry what they gather: logs, stone, ore and food bob over their heads as they haul it to the Stockpile, Granary or Campfire, and "+5 wood" pops up when it arrives',
      'See the work: trees shake and throw wood chips, rocks spit chunks and sparks, forges spark, and a felled tree comes down in a shower of leaves',
      'Buildings rise from the ground as they are built, behind scaffolding that clears as they finish',
    ],
  },
  {
    title: 'The Open Sea',
    changes: [
      'Sail to the edge of your waters and enter the Open Sea: one shared ocean where every player in your world can sail at the same time',
      'See other players\' ships live, with their captain, village and hull',
      'Fight them: your bombs fly on their screen too, and a ship with no hull left sinks and is lost. Sinking another player\'s ship pays gold',
      'Pirates still roam the Open Sea, and rocky islets break up the waves',
    ],
  },
  {
    title: 'The helm, a living map and invasions by sea',
    changes: [
      'Sailing controls on screen: a ship\'s wheel to steer, a brass engine telegraph (FULL / HALF / SLOW / STOP / BACK), a compass with your speed, and a cannon button that glows as it reloads',
      'World Map moves like GTA: drag it, scroll or pinch to zoom, an arrow shows where you are (and which way your ship faces), tap a land to drop a waypoint with a route',
      'Invade other lands with exactly as many soldiers as you choose, by land or by sea: ships carry your army faster, land by surprise and add their guns',
      'Defenders see enemy fleets coming: lookouts warn of sails on the horizon',
    ],
  },
  {
    title: 'Set sail!',
    changes: [
      'Build a Shipyard by the water (Village era), then build boats: Rowboat, Longship, Galleon, Ironclad, Battleship and the Energy Battleship',
      'Take the helm yourself: W/S or the arrows for speed, A/D to steer, Space fires bombs (a steering pad and FIRE button on phones)',
      'Pirates hunt you at sea: sink them for floating treasure, but your boat can be sunk and lost too. Repair damaged boats at the Shipyard',
      'Sail to the edge of your waters to reach the World Map and other lands',
      'New magic art: spells, the spellbook, pride and rebel icons, talk bubbles',
    ],
  },
  {
    title: 'Talents, pride, magic and talking',
    changes: [
      'No more Calling picker: everyone is born with one or two natural talents (often their parents\' talents) that decide their trade and grow fast',
      'Some are born Gifted: they learn three times as fast, but grow proud unless respected. Full pride means rebellion: honour them, chain them, duel them or exile them',
      'Magic: the rare Magic talent makes Wizards. They study at a Mage Tower, build mana and cast Healing Light, Fireball, Bless the Harvest, Arcane Ward and Lightning Storm',
      'Villagers talk: speech bubbles and little conversations, and a Talk button to ask how they are, what they think of you and what is going on',
      'Family names: households share a surname, children take after their parents (traits both parents share almost always pass on)',
      'Births are paced: mothers rest between babies and families raise up to six children, so villages grow steadily instead of exploding',
    ],
  },
  {
    title: 'Trades that work, tools and a warrior king',
    changes: [
      'Fixed: every newcomer was becoming a Gatherer. Villages are repaired once: people get the trade, skill and tool they should have had',
      'The Steward puts everyone to work in their own trade and says which workplaces are missing; the Master Builder builds them',
      'Construction no longer stalls: builders skip sites they cannot reach and spread out; builders by trade build 2.5x faster',
      'Tools matter: 25% faster with the tool of your trade, slower without; smiths forge tools before weapons',
      'People are born with the skill of their trade: spies are real spies, soldiers are trained',
      'Anyone can become a miner',
      'New villages start with a warrior king (with a sword), a blacksmith and a woodcutter; first goals: Campfire, then the Craft Hut',
      'No more swords from nowhere: people fight with the weapon or tool they actually carry',
      'When an official dies, the best person takes over the office at once',
      'Phones: Cancel / Done / Undo buttons while building or demolishing, and a Village button to jump home',
      'Construction never sits at 0%: when there are too few builders, everyone else pitches in',
      'Inventory slots show the tool, weapon and armour a person really carries; a carried sword counts in fights',
      'Building abilities show real waiting time (Ready in 7m 26s); workplaces count everyone working there',
    ],
  },
  {
    title: 'Goals, finds and a faster start',
    changes: [
      'Goals: always three things to do next, with progress bars and rewards to claim; they lead you through every era',
      'Finish every goal of an era to open its chest: gold, gems, influence and an Ancient Relic',
      'Finds: treasure, supply crates, wild harvests, lost travellers and relics turn up around the village; click them before they fade',
      'New villages start with Founding Spirit: faster work, happier people and more wanderers for three days',
      'Boats & Sea art is in (36 ships, sea weapons, wrecks and sea creatures), ready for sailing; treasure finds are now real treasure chests',
      'Admin commands have no limits: spawn, warband, build, skip, karma and happiness take any number',
    ],
  },
  {
    title: 'Bridges, visits with permission, Chamfer coasts',
    changes: [
      'Wooden bridges on your coast point to neighbouring lands: step on one to ask to visit, intrude with an army or send a spy',
      'Visiting someone now needs their permission: they get an Allow / Deny prompt',
      'Click the minimap to open the World Map; bridges there are pixel terrain blocks',
      'Terrain borders use the Chamfer style: corners cut at 45° with a dark pixel outline',
      'New art: knights in real armour, clerks, wizards (the rare genius), spies in black on missions',
      'Spies fixed: anyone can train as a spy at a Spy Den (the Spy trade was almost impossible to get)',
      'Admin: * means everything in most commands (person *, traits=*, item *, build *, spawn *, era *, karma *, empire win *) and hp can go above 100',
    ],
  },
  {
    title: 'Solid pixel coastlines, lighter phones, bigger homes',
    changes: [
      'Terrain borders are solid stepped pixel edges with a dark outline (no more circles or specks)',
      'Phones download half-size art (1.5 MB instead of 3.1 MB) and draw fewer pixels per frame',
      'Phone flicker: no blur layers, and the screen no longer blanks when the address bar moves',
      'Bigger homes take more land: House 2×2, Tenement 3×3, Arcology 4×4 (old homes keep their size)',
      'Event choices are no longer fixed: the same choice can turn out better or worse, luck and karma tip it',
      'No two players can share a name, including lookalikes (RedFire / red_fire / R3dF1re); renaming frees your old name',
      'Admin console: the suggestion list only opens once you type (Tab or Down on an empty line to browse)',
      'Home button replaced by Back: saves and takes you to the main screen (Rejoin World stays available)',
    ],
  },
  {
    title: 'Notifications, sound, undo & safety',
    changes: [
      'Notification bell: every important event, click to jump to where it happened',
      'Sound effects and calm music (volume sliders in Settings)',
      'Undo (Ctrl+Z) for building and demolishing',
      'Village graphs in the Chronicle: people, food, gold, happiness, wood, warriors',
      'Chat safety: swear filter, mute and report players',
      'Save banner when cloud saving fails (your village stays safe on the device)',
      'Faster with huge villages; smaller updates; automatic error reports for the admin',
    ],
  },
  {
    title: 'Trades, households & pixel icons',
    changes: [
      'Everyone has a trade; only a Jack of all trades can switch jobs',
      'Children usually follow their household’s trade; families arrive sharing one',
      'Knights always wear their armour; gatherers are no longer drafted into the army',
      'All emojis replaced with the game’s own pixel icons',
      'Phones: no more flickering text, and a labelled bottom bar',
    ],
  },
  {
    title: 'Quality of life',
    changes: [
      'Employment Office: set job targets and plans (Balanced, Food, Industry, Builders); clerks keep hundreds of people in the right jobs',
      'Jobs: Shift-click ±10, Ctrl-click ±100, ⭐ auto-picks the most skilled person; Court offices have ⭐ Auto pick too',
      'Drag items between villagers — they swing on a keychain under your cursor',
      'Much faster loading: sprites are 4× smaller and the title appears before all art has loaded',
      'Admin: person (spawn villagers with any stats), item (give items)',
      'Demolish tool (X): click a building or drag a box to remove many at once',
      '“🗑 All” button removes every building of a type',
      'R builds your last building again, / searches buildings',
      'Settings tidied into one list; Abandon village moved into a Danger zone',
      'Buttons no longer flicker or fade while the game updates',
    ],
  },
  {
    title: 'People of every profession',
    changes: [
      'New sprites for every job, as a man and a woman: gatherer, woodcutter, miner, farmer, fisher, hunter, builder, smith, spy, recruit, warrior, scout, explorer',
      'Court officials, elders and children have their own looks too',
      'Only soldiers answer the call to arms; the Marshal no longer drafts farmers',
      'Offline progress switched off',
    ],
  },
  {
    title: 'Rejoin, world map, better building menu',
    changes: [
      'Rejoin World button when you come back after closing the game',
      'World map: dark sea, real terrain islands for every player, joined by land bridges',
      'Build menu: search, effect badges, unlock checklist; no more glitches while resources change',
      'Terrain edges trail off in small circles; buildings no longer look like they float',
      'Hostile animals now hunt villagers',
      'Admin: version, changelog, give me * N, unlimited villager, build, rich, heal, empire and more; full autocomplete lists',
    ],
  },
  {
    title: 'Logo & reliable loading',
    changes: ['New fire H logo', 'Sprites retry when the network drops (no more letter boxes)', 'F2 explains why the admin panel is locked'],
  },
  {
    title: 'Empire & abilities',
    changes: ['90 building abilities', 'Empire: kingdoms, war, vassals, provinces, rebellions', 'Install as an app', 'Phone layout'],
  },
];
