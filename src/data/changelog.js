// Newest first. Shown by the admin `changelog` command and in Settings.
export const CHANGELOG = [
  {
    title: 'Goals, finds and a faster start',
    changes: [
      'Goals: always three things to do next, with progress bars and rewards to claim; they lead you through every era',
      'Finish every goal of an era to open its chest: gold, gems, influence and an Ancient Relic',
      'Finds: treasure, supply crates, wild harvests, lost travellers and relics turn up around the village; click them before they fade',
      'New villages start with Founding Spirit: faster work, happier people and more wanderers for three days',
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
