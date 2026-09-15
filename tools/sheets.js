// HEARTBORN sprite sheet manifest.
// Every sheet is a 6-column grid (usually 6 rows = 36 cells; People has 7 rows), read left-to-right, top-to-bottom.
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
      "noble_m", "noble_f", "elder_m", "elder_f", "child_m", "child_f",
      "clerk_m", "clerk_f", "knight_m", "knight_f", "mage_m", "mage_f"
    ]
  },
  boats: {
    title: "Sheet 10 - Boats & Sea (boats seen from above, bow pointing right)",
    folder: "boats",
    mode: "sprite",
    names: [
      "raft", "rowboat", "fishing_boat", "longship", "cog", "caravel",
      "galleon", "pirate_ship", "paddle_steamer", "ironclad", "battleship", "submarine",
      "patrol_boat", "destroyer", "cargo_ship", "speedboat", "hover_boat", "energy_battleship",
      "cannonball", "sea_bomb", "torpedo", "sea_mine", "harpoon", "burning_barrel",
      "big_splash", "wake", "burning_wreck", "sinking_ship", "debris", "whirlpool",
      "dock", "buoy", "anchor", "ship_wheel", "treasure_chest", "sea_serpent"
    ]
  },
  heroWalk: {
    title: "Hero walk, boy rows 1-3 and girl rows 4-6",
    folder: "hero",
    mode: "sprite",
    anim: true,
    names: [
      "boy_walk_down_0", "boy_walk_down_1", "boy_walk_down_2", "boy_walk_down_3", "boy_walk_down_4", "boy_walk_down_5",
      "boy_walk_up_0", "boy_walk_up_1", "boy_walk_up_2", "boy_walk_up_3", "boy_walk_up_4", "boy_walk_up_5",
      "boy_walk_side_0", "boy_walk_side_1", "boy_walk_side_2", "boy_walk_side_3", "boy_walk_side_4", "boy_walk_side_5",
      "girl_walk_down_0", "girl_walk_down_1", "girl_walk_down_2", "girl_walk_down_3", "girl_walk_down_4", "girl_walk_down_5",
      "girl_walk_up_0", "girl_walk_up_1", "girl_walk_up_2", "girl_walk_up_3", "girl_walk_up_4", "girl_walk_up_5",
      "girl_walk_side_0", "girl_walk_side_1", "girl_walk_side_2", "girl_walk_side_3", "girl_walk_side_4", "girl_walk_side_5"
    ]
  },
  heroAttack: {
    title: "Hero sword attack, boy rows 1-3 and girl rows 4-6",
    folder: "hero",
    mode: "sprite",
    anim: true,
    names: [
      "boy_attack_down_0", "boy_attack_down_1", "boy_attack_down_2", "boy_attack_down_3", "boy_attack_down_4", "boy_attack_down_5",
      "boy_attack_up_0", "boy_attack_up_1", "boy_attack_up_2", "boy_attack_up_3", "boy_attack_up_4", "boy_attack_up_5",
      "boy_attack_side_0", "boy_attack_side_1", "boy_attack_side_2", "boy_attack_side_3", "boy_attack_side_4", "boy_attack_side_5",
      "girl_attack_down_0", "girl_attack_down_1", "girl_attack_down_2", "girl_attack_down_3", "girl_attack_down_4", "girl_attack_down_5",
      "girl_attack_up_0", "girl_attack_up_1", "girl_attack_up_2", "girl_attack_up_3", "girl_attack_up_4", "girl_attack_up_5",
      "girl_attack_side_0", "girl_attack_side_1", "girl_attack_side_2", "girl_attack_side_3", "girl_attack_side_4", "girl_attack_side_5"
    ]
  },
  heroMoves: {
    title: "Hero dash, block and hurt, boy rows 1-3 and girl rows 4-6",
    folder: "hero",
    mode: "sprite",
    anim: true,
    names: [
      "boy_dash_side_0", "boy_dash_side_1", "boy_dash_side_2", "boy_dash_side_3", "boy_dash_side_4", "boy_dash_side_5",
      "boy_block_side_0", "boy_block_side_1", "boy_block_side_2", "boy_block_side_3", "boy_block_side_4", "boy_block_side_5",
      "boy_hurt_down_0", "boy_hurt_down_1", "boy_hurt_down_2", "boy_hurt_down_3", "boy_hurt_down_4", "boy_hurt_down_5",
      "girl_dash_side_0", "girl_dash_side_1", "girl_dash_side_2", "girl_dash_side_3", "girl_dash_side_4", "girl_dash_side_5",
      "girl_block_side_0", "girl_block_side_1", "girl_block_side_2", "girl_block_side_3", "girl_block_side_4", "girl_block_side_5",
      "girl_hurt_down_0", "girl_hurt_down_1", "girl_hurt_down_2", "girl_hurt_down_3", "girl_hurt_down_4", "girl_hurt_down_5"
    ]
  },
  heroBoy: {
    title: "Sheet 12 - Boy hero, walking and sword attacks (animation rows of 6 frames)",
    folder: "hero",
    mode: "sprite",
    anim: true,
    names: [
      "boy_walk_down_0", "boy_walk_down_1", "boy_walk_down_2", "boy_walk_down_3", "boy_walk_down_4", "boy_walk_down_5",
      "boy_walk_up_0", "boy_walk_up_1", "boy_walk_up_2", "boy_walk_up_3", "boy_walk_up_4", "boy_walk_up_5",
      "boy_walk_side_0", "boy_walk_side_1", "boy_walk_side_2", "boy_walk_side_3", "boy_walk_side_4", "boy_walk_side_5",
      "boy_attack_down_0", "boy_attack_down_1", "boy_attack_down_2", "boy_attack_down_3", "boy_attack_down_4", "boy_attack_down_5",
      "boy_attack_up_0", "boy_attack_up_1", "boy_attack_up_2", "boy_attack_up_3", "boy_attack_up_4", "boy_attack_up_5",
      "boy_attack_side_0", "boy_attack_side_1", "boy_attack_side_2", "boy_attack_side_3", "boy_attack_side_4", "boy_attack_side_5"
    ]
  },
  heroGirl: {
    title: "Sheet 14 - Girl hero, walking and sword attacks (animation rows of 6 frames)",
    folder: "hero",
    mode: "sprite",
    anim: true,
    names: [
      "girl_walk_down_0", "girl_walk_down_1", "girl_walk_down_2", "girl_walk_down_3", "girl_walk_down_4", "girl_walk_down_5",
      "girl_walk_up_0", "girl_walk_up_1", "girl_walk_up_2", "girl_walk_up_3", "girl_walk_up_4", "girl_walk_up_5",
      "girl_walk_side_0", "girl_walk_side_1", "girl_walk_side_2", "girl_walk_side_3", "girl_walk_side_4", "girl_walk_side_5",
      "girl_attack_down_0", "girl_attack_down_1", "girl_attack_down_2", "girl_attack_down_3", "girl_attack_down_4", "girl_attack_down_5",
      "girl_attack_up_0", "girl_attack_up_1", "girl_attack_up_2", "girl_attack_up_3", "girl_attack_up_4", "girl_attack_up_5",
      "girl_attack_side_0", "girl_attack_side_1", "girl_attack_side_2", "girl_attack_side_3", "girl_attack_side_4", "girl_attack_side_5"
    ]
  },
  combat: {
    title: "Sheet 16 - Combat effects (animation rows of 6 frames)",
    folder: "combat",
    mode: "sprite",
    anim: true,
    names: [
      "slash_0", "slash_1", "slash_2", "slash_3", "slash_4", "slash_5",
      "crit_slash_0", "crit_slash_1", "crit_slash_2", "crit_slash_3", "crit_slash_4", "crit_slash_5",
      "hit_0", "hit_1", "hit_2", "hit_3", "hit_4", "hit_5",
      "dust_0", "dust_1", "dust_2", "dust_3", "dust_4", "dust_5",
      "parry_0", "parry_1", "parry_2", "parry_3", "parry_4", "parry_5",
      "poof_0", "poof_1", "poof_2", "poof_3", "poof_4", "poof_5"
    ]
  },
  gear: {
    title: "Sheet 18 - Gear, loot and hearts",
    folder: "gear",
    mode: "sprite",
    names: [
      "leather_armor", "chain_mail", "plate_armor", "round_shield", "kite_shield", "arrow",
      "ring", "boots", "amulet", "magic_scroll", "health_potion", "stamina_potion",
      "sword_common", "sword_rare", "sword_epic", "sword_legendary", "war_hammer", "battle_axe",
      "bow_common", "bow_rare", "spear", "staff", "arrows", "key",
      "heart_full", "heart_half", "heart_empty", "stamina_full", "stamina_empty", "xp_gem",
      "chest_closed", "chest_open", "boss_chest", "gold_pile", "loot_beam_white", "loot_beam_gold"
    ]
  },
  magic: {
    title: "Sheet 11 - Magic & Moods",
    folder: "magic",
    mode: "sprite",
    names: [
      "fireball", "heal_light", "blessing", "arcane_ward", "lightning_bolt", "portal",
      "mana_crystal", "mana_potion", "spellbook", "wizard_staff", "magic_wand", "rune_circle",
      "frost_blast", "poison_cloud", "shield_rune", "arcane_burst", "wisp", "crystal_ball",
      "talent_star", "proud", "rebel", "rebel_flag", "broken_chains", "duel",
      "talk_dots", "talk_alert", "talk_love", "talk_question", "talk_angry", "talk_music",
      "family_crest", "cradle", "wedding_rings", "family_tree", "flower_grave", "laurel"
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
