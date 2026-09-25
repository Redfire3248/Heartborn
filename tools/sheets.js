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
  heroBody: {
    title: "Hero bodies without weapons, boy and girl, front back and side",
    folder: "hero",
    mode: "sprite",
    names: ["boy_body_front", "boy_body_back", "boy_body_side", "girl_body_front", "girl_body_back", "girl_body_side"]
  },
  arsenal: {
    title: "Arsenal, 49 weapons shields helmets armour and trinkets in 7 columns",
    folder: "gear",
    mode: "sprite",
    cols: 7,
    names: [
      "short_sword", "broadsword", "rapier", "katana", "scimitar", "cutlass", "claymore",
      "flame_sword", "frost_sword", "thunder_sword", "shadow_blade", "holy_sword", "dagger", "twin_daggers",
      "hand_axe", "great_axe", "mace", "morning_star", "flail", "spiked_club", "war_scythe",
      "lance", "halberd", "trident", "longbow", "crossbow", "magic_staff", "buckler",
      "heater_shield", "tower_shield", "spiked_shield", "bone_shield", "crystal_shield", "holy_shield", "dragon_shield",
      "padded_armor", "studded_leather", "scale_mail", "dragon_armor", "leather_cap", "iron_helmet", "horned_helmet",
      "knight_helmet", "wizard_hat", "royal_crown", "iron_boots", "iron_gauntlets", "royal_cape", "lucky_charm"
    ]
  },
  heroAll: {
    title: "Hero, everything in one sheet, 12 columns (boy 6 frames, girl 6 frames) by 9 animation rows",
    folder: "hero",
    mode: "sprite",
    anim: true,
    cols: 12,
    names: [
      "boy_walk_down_0", "boy_walk_down_1", "boy_walk_down_2", "boy_walk_down_3", "boy_walk_down_4", "boy_walk_down_5", "girl_walk_down_0", "girl_walk_down_1", "girl_walk_down_2", "girl_walk_down_3", "girl_walk_down_4", "girl_walk_down_5",
      "boy_walk_up_0", "boy_walk_up_1", "boy_walk_up_2", "boy_walk_up_3", "boy_walk_up_4", "boy_walk_up_5", "girl_walk_up_0", "girl_walk_up_1", "girl_walk_up_2", "girl_walk_up_3", "girl_walk_up_4", "girl_walk_up_5",
      "boy_walk_side_0", "boy_walk_side_1", "boy_walk_side_2", "boy_walk_side_3", "boy_walk_side_4", "boy_walk_side_5", "girl_walk_side_0", "girl_walk_side_1", "girl_walk_side_2", "girl_walk_side_3", "girl_walk_side_4", "girl_walk_side_5",
      "boy_attack_down_0", "boy_attack_down_1", "boy_attack_down_2", "boy_attack_down_3", "boy_attack_down_4", "boy_attack_down_5", "girl_attack_down_0", "girl_attack_down_1", "girl_attack_down_2", "girl_attack_down_3", "girl_attack_down_4", "girl_attack_down_5",
      "boy_attack_up_0", "boy_attack_up_1", "boy_attack_up_2", "boy_attack_up_3", "boy_attack_up_4", "boy_attack_up_5", "girl_attack_up_0", "girl_attack_up_1", "girl_attack_up_2", "girl_attack_up_3", "girl_attack_up_4", "girl_attack_up_5",
      "boy_attack_side_0", "boy_attack_side_1", "boy_attack_side_2", "boy_attack_side_3", "boy_attack_side_4", "boy_attack_side_5", "girl_attack_side_0", "girl_attack_side_1", "girl_attack_side_2", "girl_attack_side_3", "girl_attack_side_4", "girl_attack_side_5",
      "boy_dash_side_0", "boy_dash_side_1", "boy_dash_side_2", "boy_dash_side_3", "boy_dash_side_4", "boy_dash_side_5", "girl_dash_side_0", "girl_dash_side_1", "girl_dash_side_2", "girl_dash_side_3", "girl_dash_side_4", "girl_dash_side_5",
      "boy_block_side_0", "boy_block_side_1", "boy_block_side_2", "boy_block_side_3", "boy_block_side_4", "boy_block_side_5", "girl_block_side_0", "girl_block_side_1", "girl_block_side_2", "girl_block_side_3", "girl_block_side_4", "girl_block_side_5",
      "boy_hurt_down_0", "boy_hurt_down_1", "boy_hurt_down_2", "boy_hurt_down_3", "boy_hurt_down_4", "boy_hurt_down_5", "girl_hurt_down_0", "girl_hurt_down_1", "girl_hurt_down_2", "girl_hurt_down_3", "girl_hurt_down_4", "girl_hurt_down_5"
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
  },
  toolkit: {
    title: "Toolkit, 50 tools in 10 columns",
    folder: "tools",
    mode: "sprite",
    cols: 10,
    names: [
      "pickaxe_wood", "pickaxe_stone", "pickaxe_copper", "pickaxe_bronze", "pickaxe_iron", "pickaxe_steel", "pickaxe_gold", "pickaxe_diamond", "pickaxe_obsidian", "pickaxe_mythril",
      "axe_wood", "axe_stone", "axe_copper", "axe_bronze", "axe_iron", "axe_steel", "axe_gold", "axe_diamond", "axe_obsidian", "axe_mythril",
      "shovel_wood", "shovel_stone", "shovel_iron", "shovel_gold", "shovel_diamond", "hoe_wood", "hoe_stone", "hoe_iron", "hoe_gold", "hoe_diamond",
      "hammer_wood", "hammer_stone", "hammer_iron", "hammer_gold", "hammer_diamond", "fishing_rod_wood", "fishing_rod_bamboo", "fishing_rod_iron", "fishing_rod_gold", "fishing_rod_crystal",
      "sickle_wood", "sickle_stone", "sickle_iron", "sickle_gold", "sickle_diamond", "lantern", "torch", "bucket", "watering_can", "backpack"
    ]
  },
  furniture: {
    title: "Furniture, 49 isometric pieces in 7 columns",
    folder: "interior",
    mode: "sprite",
    cols: 7,
    names: [
      "chest", "big_chest", "barrel", "crates", "shelf", "wardrobe", "pantry",
      "weapon_rack", "vault", "dresser", "cabinet", "bed", "double_bed", "cradle",
      "sofa", "armchair", "table", "round_table", "chair", "stool", "desk",
      "bookshelf", "bunk_bed", "nightstand", "bench", "rug", "round_rug", "stove",
      "counter", "sink", "bathtub", "cauldron", "fireplace", "lamp", "candles",
      "plant", "flowers", "statue", "armor_stand", "trophy", "painting", "piano",
      "globe", "throne", "grandfather_clock", "mirror", "banner_stand", "stairs", "landing"
    ]
  },
  houseStyles: {
    title: "House styles, 10 homes in 4 styles each, 8 columns",
    folder: "buildings",
    mode: "sprite",
    cols: 8,
    names: [
      "tent_style1", "tent_style2", "tent_style3", "tent_style4", "hut_style1", "hut_style2", "hut_style3", "hut_style4",
      "house_style1", "house_style2", "house_style3", "house_style4", "castle_style1", "castle_style2", "castle_style3", "castle_style4",
      "inn_style1", "inn_style2", "inn_style3", "inn_style4", "tenement_style1", "tenement_style2", "tenement_style3", "tenement_style4",
      "bunker_style1", "bunker_style2", "bunker_style3", "bunker_style4", "arcology_style1", "arcology_style2", "arcology_style3", "arcology_style4",
      "fortress_style1", "fortress_style2", "fortress_style3", "fortress_style4", "palace_style1", "palace_style2", "palace_style3", "palace_style4"
    ]
  },
  houseTiles: {
    title: "House tiles, 9 floors 9 wall panels 9 blocks in 9 columns",
    folder: "interior",
    mode: "sprite",
    cols: 9,
    names: [
      "floor_planks", "floor_dark_planks", "floor_stone", "floor_cobble", "floor_marble", "floor_checker", "floor_white_tiles", "floor_carpet_red", "floor_carpet_blue",
      "wall_plaster", "wall_wood", "wall_log", "wall_stone", "wall_brick", "wall_red", "wall_green", "wall_blue", "wall_royal",
      "block_wood", "block_stone", "block_brick", "block_plaster", "half_wall", "pillar", "glass_wall", "archway", "railing"
    ]
  },
  dungeonTiles: {
    title: "Dungeon tiles and props, 35 in 7 columns",
    folder: "dungeon",
    mode: "sprite",
    cols: 7,
    names: [
      "dungeon_floor_1", "dungeon_floor_2", "dungeon_floor_cracked", "dungeon_floor_mossy", "dungeon_floor_rubble", "wall_top", "wall_face_1",
      "wall_face_2", "wall_face_mossy", "door_closed", "door_open", "stairs_up", "stairs_down", "cave_entrance",
      "spikes_down", "spikes_up", "torch_1", "torch_2", "torch_3", "torch_4", "boss_key",
      "bones", "skull_pile", "cobweb", "pillar", "rubble", "broken_barrel", "altar",
      "cage", "chains", "glow_crystal", "puddle", "floor_grate", "lever_off", "lever_on"
    ]
  },
  dungeonMonsters: {
    title: "Dungeon monsters and bosses, 12 in 4 columns",
    folder: "characters",
    mode: "sprite",
    cols: 4,
    names: [
      "skeleton_archer", "dark_mage", "bat", "rat",
      "zombie", "mimic", "cave_spider", "fire_imp",
      "lich", "stone_golem", "spider_queen", "slime_king"
    ]
  },
  projectiles: {
    title: "Projectiles and attack effects, 16 in 8 columns",
    folder: "combat",
    mode: "sprite",
    cols: 8,
    names: [
      "arrow", "bone_arrow", "magic_bolt", "fireball", "ice_shard", "poison_spit", "web_ball", "throwing_knife",
      "dark_orb", "lightning_bolt", "boulder", "sonic_wave", "warning_circle", "shockwave", "small_explosion", "heal_orb"
    ]
  },
  uiIcons: {
    title: "Interface icons, 16 in 8 columns",
    folder: "ui",
    mode: "sprite",
    cols: 8,
    names: [
      "close", "inventory", "character", "map", "build", "settings", "quests", "home",
      "rotate", "remove", "move", "search", "floors", "wallpaper", "storage", "stairs"
    ]
  },
  armory: {
    title: "Armory, 100 weapons tools and items in 10 columns",
    folder: "armory",
    mode: "sprite",
    cols: 10,
    names: [
      "minigun", "laser_rifle", "plasma_cannon", "rocket_launcher", "railgun", "flamethrower", "freeze_ray", "black_hole_gun", "banana_blaster", "ban_hammer",
      "god_sword", "infinity_blade", "energy_sword", "cosmic_scythe", "storm_god_hammer", "chaos_staff", "dev_wrench", "golden_frying_pan", "rubber_chicken", "void_dagger",
      "flintlock_pistol", "musket", "blunderbuss", "revolver", "hunting_rifle", "shotgun", "slingshot", "throwing_axe", "boomerang", "shuriken",
      "longsword", "bastard_sword", "falchion", "sabre", "gladius", "machete", "wakizashi", "zweihander", "estoc", "kukri",
      "tomahawk", "double_axe", "war_pick", "maul", "quarterstaff", "glaive", "naginata", "pike", "bardiche", "whip",
      "fire_staff", "ice_staff", "lightning_wand", "necro_staff", "holy_scepter", "spellbook", "crystal_orb", "bone_wand", "druid_staff", "runic_blade",
      "pickaxe_celestial", "pickaxe_lava", "pickaxe_ice", "pickaxe_void", "shovel_celestial", "shovel_lava", "shovel_crystal", "shovel_void", "axe_celestial", "axe_lava",
      "fishing_rod_carbon", "fishing_rod_dragon", "fishing_rod_bone", "fishing_rod_coral", "fishing_rod_lava", "fishing_rod_star", "fishing_net", "harpoon", "tackle_box", "bait_worm",
      "hoe_celestial", "sickle_celestial", "hammer_celestial", "drill", "chainsaw", "grappling_hook", "compass", "spyglass", "magnet", "lockpick",
      "mana_potion", "speed_potion", "strength_potion", "invisibility_potion", "antidote", "bomb", "dynamite", "med_kit", "golden_apple", "ammo_box"
    ]
  },
  dungeonBosses: {
    title: "Dungeon bosses, 4 in 2 columns",
    folder: "characters",
    mode: "sprite",
    cols: 2,
    names: [
      "lich", "stone_golem",
      "spider_queen", "slime_king"
    ]
  },
  avatars: {
    title: "Avatars, 8 characters in 3 views (front back side), 3 columns",
    folder: "avatars",
    mode: "sprite",
    cols: 3,
    names: [
      "king_front", "king_back", "king_side",
      "queen_front", "queen_back", "queen_side",
      "knight_boy_front", "knight_boy_back", "knight_boy_side",
      "knight_girl_front", "knight_girl_back", "knight_girl_side",
      "adventurer_boy_front", "adventurer_boy_back", "adventurer_boy_side",
      "adventurer_girl_front", "adventurer_girl_back", "adventurer_girl_side",
      "wizard_front", "wizard_back", "wizard_side",
      "rogue_front", "rogue_back", "rogue_side"
    ]
  },
  oreRocks: {
    title: "Ores sheet top rows, ore rocks",
    folder: "nature",
    mode: "sprite",
    cols: 6,
    names: [
      "copper_ore", "silver_ore", "obsidian_ore", "mythril_ore", "frostite_ore", "magmite_ore",
      "jade_ore", "cobalt_ore", "moonstone_ore", "titanium_ore", "sunstone_ore", "voidstone_ore",
      "coal_ore", "iron_ore", "gold_ore", "gem_ore", "ruby_ore", "amethyst_ore"
    ]
  },
  oreIcons: {
    title: "Ores sheet bottom rows, ingots and gems",
    folder: "items",
    mode: "sprite",
    cols: 6,
    names: [
      "icon_copper", "icon_silver", "icon_obsidian", "icon_mythril", "icon_frostite", "icon_magmite",
      "icon_jade", "icon_cobalt", "icon_moonstone", "icon_titanium", "icon_sunstone", "icon_voidstone",
      "icon_coal", "icon_iron", "icon_gold", "icon_gem", "icon_ruby", "icon_amethyst"
    ]
  },
  packMats: {
    title: "Pack sheet row 1, boss material icons",
    folder: "items",
    mode: "sprite",
    cols: 8,
    names: [
      "mat_slime_core", "mat_spider_silk", "mat_spirit_bark", "mat_golem_heart",
      "mat_lich_soul", "mat_dragon_scale", "token_crown", "mat_star_shard"
    ]
  },
  packFx: {
    title: "Pack sheet row 2, loot beams and bursts",
    folder: "effects",
    mode: "sprite",
    cols: 7,
    names: ["beam_white", "beam_gold", "beam_pink", "boss_burst", "rich_sparkle", "jackpot", "enchant_glint"]
  },
  packStump: {
    title: "Pack sheet, a stump sprouting a sapling",
    folder: "nature",
    mode: "sprite",
    cols: 1,
    names: ["stump_sprout"]
  },
  packStations: {
    title: "Pack sheet row 3, crafting stations",
    folder: "buildings",
    mode: "sprite",
    cols: 3,
    names: ["enchanting_table", "crafting_table", "forge_station"]
  },
  packInterior: {
    title: "Pack sheet row 3, house furniture",
    folder: "interior",
    mode: "sprite",
    cols: 4,
    names: ["enchanting_table", "trophy_stand", "display_case", "treasure_chest"]
  },
  packStall: {
    title: "Pack sheet, a trading stall",
    folder: "buildings",
    mode: "sprite",
    cols: 1,
    names: ["trade_stall"]
  },
  packUi: {
    title: "Pack sheet row 4, interface icons",
    folder: "ui",
    mode: "sprite",
    cols: 8,
    names: [
      "trade", "index", "enchant", "new_badge",
      "frame_common", "frame_rare", "frame_epic", "frame_legendary"
    ]
  },
  iconPack2: {
    title: "Icon pack, enchantments, traits, status effects, rarity gems and index tabs",
    folder: "ui",
    mode: "sprite",
    cols: 8,
    names: [
      "ench_sharpness", "ench_protection", "ench_vitality", "ench_efficiency", "ench_fortune", "ench_fire_aspect", "ench_frostbite", "ench_vampirism",
      "ench_looting", "ench_swiftness", "trait_holy", "trait_magic", "trait_crit", "trait_quake", "trait_poison", "trait_heal",
      "status_burn", "status_frozen", "status_poison", "status_stun", "status_bleed", "status_slow", "status_enraged", "status_shielded",
      "rarity_0", "rarity_1", "rarity_2", "rarity_3", "rarity_4", "tab_ore", "tab_mob", "tab_gear"
    ]
  },
  pets: {
    title: "Pets sheet, pets and eggs",
    folder: "pets",
    mode: "sprite",
    cols: 8,
    names: [
      "chicken", "rabbit", "pig", "slime", "bat", "wolf", "forest_spirit", "dragon",
      "egg_common", "egg_rare", "egg_epic", "egg_legendary", "egg_mythic", "egg_hatching", "food_bowl", "happy"
    ]
  },
  books_lights: {
    title: "Enchantment books and torches",
    folder: "books",
    mode: "sprite",
    cols: 8,
    names: [
      "book", "book_common", "book_rare", "book_epic", "book_legendary", "book_mythic", "book_open", "book_stack",
      "book_sharpness", "book_fire_aspect", "book_frostbite", "book_vampirism", "book_looting", "book_swiftness", "book_protection", "book_vitality",
      "book_efficiency", "book_fortune", "wall_torch", "wall_torch_left", "wall_torch_right", "standing_torch", "brazier", "soul_torch",
      "torch_item", "wall_torch_unlit", "gold_sconce", "lamp_post", "skull_candle", "candles", "lantern_hanging", "campfire"
    ]
  },
  lights: {
    title: "Torches and lights (sliced with books_lights, moved here)",
    folder: "lights",
    mode: "sprite",
    cols: 8,
    names: [
      "wall_torch", "wall_torch_left", "wall_torch_right", "standing_torch", "brazier", "soul_torch",
      "torch_item", "wall_torch_unlit", "gold_sconce", "lamp_post", "skull_candle", "candles", "lantern_hanging", "campfire"
    ]
  },
  dtiles: {
    title: "Dungeon tileset",
    folder: "dtiles",
    mode: "sprite",
    cols: 8,
    tileCount: 32,
    names: [
      "floor_1", "floor_2", "floor_cracked", "floor_mossy", "floor_rubble", "floor_flagstone", "floor_blood", "floor_bones",
      "floor_boss", "floor_rune", "carpet", "grate", "puddle_tile", "lava_channel", "pit", "planks",
      "wall_upper", "wall_lower", "wall_mossy", "wall_cracked", "wall_window", "wall_chains", "wall_banner", "wall_door",
      "wall_top", "wall_corner", "rock", "archway", "stairs_down", "stairs_up", "boss_door_locked", "boss_door_open"
    ]
  },
  bosses: {
    title: "Deep bosses",
    folder: "bosses",
    mode: "sprite",
    cols: 8,
    names: [
      "varek", "frost_warden", "iron_warlord", "drowned_king", "void_herald", "gilded_spider", "bone_conductor", "sand_colossus",
      "bog_hag", "last_lantern", "emberling_tyrant", "rot_baron", "glass_widow", "thunder_ox", "pale_abbot", "mire_leviathan",
      "rust_golem", "nine_eyed_watcher", "marrow_knight", "storm_djinn", "obsidian_hound", "silk_empress", "hollow_crown", "deep_miner",
      "ash_widowmaker", "sunken_choirboy", "basalt_titan", "wyrm_priest", "frostbitten_champion", "gravebloom", "clockwork_executioner", "nightmare_stag"
    ]
  },
  buttons: {
    title: "Touch control icons, 4 in 2 rows",
    folder: "ui", mode: "sprite", cols: 4,
    names: ["btn_dash", "btn_attack", "btn_block", "btn_potion", "btn_skill", "btn_lock", "btn_bag", "btn_chat"]
  },
  seamonsters: {
    title: "Sea monsters, 6 in 3 rows",
    folder: "sea", mode: "sprite", cols: 6,
    names: [
      "shark", "giant_squid", "kraken", "sea_serpent", "armoured_crab", "jellyfish",
      "anglerfish", "drowned_sailor", "stingray", "deep_eel", "coral_golem", "siren",
      "leviathan", "piranha_swarm", "spiked_turtle", "lobster_horror", "lantern_ghost", "hammerhead"
    ]
  },
  boatsheet: {
    title: "Boats seen from above, 4 in 2 rows",
    folder: "boats2", mode: "sprite", cols: 4,
    names: ["rowboat", "skiff", "longboat", "sloop", "galley", "raft", "cog", "cutter"]
  },
  adminicons: {
    title: "Admin panel tab icons, 8 in 2 rows",
    folder: "ui", mode: "sprite", cols: 8,
    names: [
      "ap_home", "ap_players", "ap_spawn", "ap_items", "ap_character", "ap_world", "ap_troll", "ap_doctor",
      "ap_logs", "ap_select", "ap_run", "ap_search", "ap_close", "ap_god", "ap_heal", "ap_console"
    ]
  },
  races: {
    title: "Race characters, 13 in 2 rows - every race as Adam, then every race as Eve",
    folder: "races", mode: "sprite", cols: 13,
    names: [
      "human_m", "elf_m", "dwarf_m", "orc_m", "demon_m", "archdemon_m", "angel_m", "archangel_m", "fallen_m", "skeleton_m", "zombie_m", "vampire_m", "god_m",
      "human_f", "elf_f", "dwarf_f", "orc_f", "demon_f", "archdemon_f", "angel_f", "archangel_f", "fallen_f", "skeleton_f", "zombie_f", "vampire_f", "god_f"
    ]
  },
  races2: {
    title: "Race characters, second set, 6 in 4 rows",
    folder: "races", mode: "sprite", cols: 6,
    names: [
      "human_m2", "human_f2", "elf_m2", "elf_f2", "dwarf_m2", "dwarf_f2",
      "orc_m2", "orc_f2", "demon_m2", "demon_f2", "archdemon_m2", "archdemon_f2",
      "angel_m2", "angel_f2", "archangel_m2", "archangel_f2", "fallen_m2", "fallen_f2",
      "skeleton_m2", "skeleton_f2", "zombie_m2", "zombie_f2", "vampire_m2", "vampire_f2"
    ]
  }
};
