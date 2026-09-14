// HEARTBORN sprite sheet manifest.
// Every sheet is a 6x6 grid (36 cells), read left-to-right, top-to-bottom.
// The slicer uses this to name files; the game will use it to load them.
window.SHEETS = {
  characters: {
    title: "Sheet 1 - Characters & Creatures",
    folder: "characters",
    mode: "sprite",
    names: [
      "man", "woman", "child", "elder", "farmer", "miner",
      "hunter", "warrior", "blacksmith", "merchant", "healer", "priest",
      "king", "queen", "witch", "bandit", "goblin", "skeleton",
      "deer", "wolf", "bear", "boar", "rabbit", "chicken",
      "cow", "sheep", "pig", "horse", "fish", "snake",
      "slime", "giant_spider", "ghost", "cave_troll", "forest_spirit", "dragon"
    ]
  },
  buildings: {
    title: "Sheet 2 - Buildings",
    folder: "buildings",
    mode: "sprite",
    names: [
      "campfire", "tent", "stockpile", "hut", "house", "farm",
      "well", "lumber_mill", "mine_entrance", "shrine", "windmill", "granary",
      "blacksmith", "market", "tavern", "barracks", "stable", "fishing_hut",
      "healer_hut", "school", "library", "bank", "temple", "castle",
      "wall_wood", "wall_stone", "gate_wood", "gate_stone", "watchtower", "harbor",
      "statue", "fountain", "wonder", "construction", "ruins", "grave"
    ]
  },
  buildings2: {
    title: "Sheet 6 - Buildings II",
    folder: "buildings",
    mode: "sprite",
    names: [
      "craft_hut", "weaponsmith", "armory", "training_ground", "guard_post", "siege_workshop",
      "orchard", "pasture", "hunters_lodge", "apiary", "bakery", "brewery",
      "quarry", "charcoal_kiln", "smelter", "carpenter", "warehouse", "workshop",
      "town_hall", "courthouse", "jail", "inn", "bathhouse", "hospital",
      "chapel", "cathedral", "monastery", "observatory", "university", "mage_tower",
      "stone_tower", "fortress", "palace", "colosseum", "lighthouse", "royal_garden"
    ]
  },
  buildings3: {
    title: "Sheet 7 - Buildings III (Intrigue & Future)",
    folder: "buildings",
    mode: "sprite",
    names: [
      "spy_den", "powder_mill", "prison", "embassy", "cannon_tower", "secret_vault",
      "factory", "steel_mill", "printing_press", "railway_station", "tenement", "clock_tower",
      "research_lab", "telegraph_office", "museum", "academy_of_science", "vertical_farm", "hospital_modern",
      "power_plant", "radar_array", "bunker", "airfield", "tank_factory", "missile_silo",
      "robot_factory", "drone_hub", "fusion_reactor", "arcology", "shield_generator", "hyperloop",
      "spaceport", "ai_core", "holo_park", "cloning_vat", "orbital_cannon", "mech_bay"
    ]
  },
  units: {
    title: "Sheet 8 - Agents, Modern Units & Tech",
    folder: "units",
    mode: "sprite",
    names: [
      "spy", "traitor", "assassin", "saboteur", "prisoner", "informant",
      "musketeer", "rifleman", "grenadier", "robot_worker", "robot_soldier", "android",
      "cannon", "tank", "fighter_plane", "drone", "mech", "cyborg",
      "bomb", "dynamite", "missile", "science", "gear", "microchip",
      "steel_beam", "oil_barrel", "battery", "radar_screen", "satellite", "keycard",
      "big_explosion", "smoke_plume", "laser_beam", "energy_shield", "electric_spark", "radiation"
    ]
  },
  people: {
    title: "Sheet 9 - People (every profession, man and woman)",
    folder: "people",
    mode: "sprite",
    names: [
      "gatherer_m", "gatherer_f", "woodcutter_m", "woodcutter_f", "miner_m", "miner_f",
      "farmer_m", "farmer_f", "fisher_m", "fisher_f", "hunter_m", "hunter_f",
      "builder_m", "builder_f", "smith_m", "smith_f", "spy_m", "spy_f",
      "recruit_m", "recruit_f", "warrior_m", "warrior_f", "scout_m", "scout_f",
      "explorer_m", "explorer_f", "priest_m", "priest_f", "merchant_m", "merchant_f",
      "noble_m", "noble_f", "elder_m", "elder_f", "child_m", "child_f"
    ]
  },
  nature: {
    title: "Sheet 3 - Tiles & Nature",
    folder: "nature",
    mode: "sprite",
    // First 12 cells are full-square ground tiles (no background removal).
    tileCount: 12,
    names: [
      "tile_grass", "tile_grass_flowers", "tile_dirt", "tile_sand", "tile_water", "tile_deep_water",
      "tile_snow", "tile_stone_path", "tile_tilled_soil", "tile_swamp", "tile_lava", "tile_cave_floor",
      "tree_oak", "tree_pine", "tree_apple", "tree_palm", "tree_dead", "tree_snowy_pine",
      "tree_stump", "sapling", "berry_bush", "tall_grass", "flowers", "mushroom",
      "rock", "coal_ore", "iron_ore", "gold_ore", "gem_ore", "crystal_cluster",
      "wheat", "carrot", "pumpkin", "cactus", "reeds", "fallen_log"
    ]
  },
  items: {
    title: "Sheet 4 - Items & UI Icons",
    folder: "items",
    mode: "sprite",
    names: [
      "icon_food", "icon_wood", "icon_stone", "icon_coal", "icon_iron", "icon_gold",
      "icon_gem", "icon_influence", "pickaxe", "axe", "hoe", "hammer",
      "sword", "spear", "bow", "shield", "potion", "relic",
      "scroll", "karma_good", "karma_evil", "heart", "hunger", "happy",
      "sad", "population", "dice_fate", "trade", "war", "alliance",
      "chat", "save", "shield_protect", "crown_leader", "baby", "star_rank"
    ]
  },
  effects: {
    title: "Sheet 5 - Effects, Emotes & Weather",
    folder: "effects",
    mode: "sprite",
    names: [
      "spark", "smoke", "dust", "flame", "explosion", "lightning",
      "plus_heal", "skull_curse", "toxic_bubble", "magic_orb", "ice_crystal", "hit_star",
      "raindrop", "snowflake", "leaf", "splash", "rock_chunk", "coin",
      "emote_alert", "emote_question", "emote_sleep", "emote_love", "emote_angry", "emote_music",
      "marker_arrow", "marker_flag", "marker_target", "marker_war", "footprint", "feather",
      "cloud", "sun", "moon", "meteor", "tornado", "ghost_wisp"
    ]
  }
};
