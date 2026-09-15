# HEARTBORN – Sprite Sheet Prompts

9 sheets × 36 sprites = **324 assets**. Every sheet is a **6×6 grid**, generated as a **square image (1024×1024)**.
Slice with `tools/slicer.html` → outputs 32×32 PNGs named automatically.

**Rules for every generation**
- Always square (1:1). Don't crop or resize before slicing.
- The ORDER of items matters – the slicer names cells left→right, top→bottom.
- If one cell comes out wrong, regenerate the whole sheet (or fix that cell in an editor), don't shuffle positions.
- Use the same generator + same seed/style reference for all 5 sheets to keep them uniform.

---

## Sheet 1 – Characters & Creatures → `characters/`

```
A pixel art sprite sheet, square image, arranged in a perfectly uniform 6x6 grid of 36 equal square cells. Each cell contains exactly ONE isolated sprite, centered in its cell, all sprites drawn at the same scale and filling about 80% of their cell, with even empty spacing between cells. No gridlines, no borders, no text, no labels, no numbers. Transparent background (if not possible: plain flat solid white background). Style: 32x32 retro 16-bit SNES pixel art, top-down 3/4 view, facing the viewer, clean 1px dark outline, limited warm earthy palette, soft light from top-left, no ground shadows, consistent style across all cells.

Cells in order, left to right, top to bottom:
Row 1: primitive man in brown cloth tunic barefoot | primitive woman in beige dress hair tied back | small child in tiny tunic | old elder with grey beard and walking stick | farmer with straw hat | miner with helmet candle
Row 2: hunter with fur cloak | warrior in leather armor with round shield | blacksmith with leather apron and hammer | merchant with big backpack and purple hood | healer in green robe with herb basket | priest in white robe with gold trim
Row 3: king with gold crown and red cape | queen with silver tiara and blue gown | witch with pointy hat and dark cloak | bandit with red bandana mask and dagger | green goblin with club | skeleton warrior
Row 4: brown deer with antlers | grey wolf snarling | brown bear | wild boar with tusks | white rabbit | white chicken
Row 5: black and white cow | fluffy white sheep | pink pig | brown horse | blue fish | green snake
Row 6: green slime blob | giant black spider | floating white ghost | cave troll with glowing red eyes | glowing green forest spirit of leaves | small red dragon with wings spread
```

## Sheet 2 – Buildings → `buildings/`

```
A pixel art sprite sheet, square image, arranged in a perfectly uniform 6x6 grid of 36 equal square cells. Each cell contains exactly ONE isolated building, centered in its cell, all buildings drawn at the same scale and filling about 85% of their cell, with even empty spacing between cells. No gridlines, no borders, no text, no labels, no numbers. Transparent background (if not possible: plain flat solid white background). Style: 32x32 retro 16-bit SNES pixel art, top-down 3/4 view, clean 1px dark outline, limited warm medieval palette, soft light from top-left, no ground tiles under buildings, consistent style across all cells.

Cells in order, left to right, top to bottom:
Row 1: campfire with stone ring | animal hide tent | stockpile of logs stones and sacks | round hut with straw roof | small wooden house with red roof and chimney | small farm plot with green crops and fence
Row 2: stone water well with roof | wooden lumber mill with saw blade | mine entrance in rock with wooden beams | stone shrine with glowing blue crystal | wooden windmill | wooden granary barn
Row 3: blacksmith forge with anvil and glowing furnace | market stall with red white striped awning | tavern with beer mug sign and lit windows | wooden barracks with red banner | horse stable | fishing hut with net
Row 4: healer hut with green cross sign | small schoolhouse with bell | stone library with book emblem | stone bank with gold coin emblem | white marble temple with golden dome | stone castle keep with blue flags
Row 5: wooden palisade wall segment | stone wall segment with battlements | wooden gate | stone gatehouse with portcullis | tall wooden watchtower | wooden dock with rowboat
Row 6: stone hero statue | stone water fountain | giant glowing golden obelisk wonder | wooden scaffolding construction site | crumbled mossy stone ruins | wooden grave cross on dirt mound with flower
```

## Sheet 3 – Tiles & Nature → `nature/`

```
A pixel art sprite sheet, square image, arranged in a perfectly uniform 6x6 grid of 36 equal square cells, no gridlines, no borders, no text, no labels, no numbers. Style: 32x32 retro 16-bit SNES pixel art, top-down 3/4 view, limited natural palette, soft light from top-left, consistent style across all cells.
The first TWO rows are seamless tileable ground textures that completely FILL their entire square cell edge to edge, flat top-down, no outline.
The remaining four rows each contain exactly ONE isolated object, centered in its cell, filling about 80% of the cell, clean 1px dark outline, transparent background (if not possible: plain flat solid white background).

Cells in order, left to right, top to bottom:
Row 1 (full tiles): green grass | green grass with tiny flowers | brown dirt | light sand | shallow blue water with ripples | dark deep blue water
Row 2 (full tiles): white snow | grey cobblestone path | plowed brown farmland rows | murky green swamp | glowing orange lava | dark grey cave floor
Row 3: round green oak tree | tall pine tree | apple tree with red apples | palm tree | dead leafless tree | snow covered pine tree
Row 4: chopped tree stump | tiny green sapling | green bush with red berries | tuft of tall grass | cluster of colorful flowers | red spotted mushroom
Row 5: grey boulder | rock with black coal chunks | rock with orange iron veins | rock with shiny gold veins | dark rock with purple and blue gems | glowing cyan crystal cluster
Row 6: golden ripe wheat plant | carrot plant with orange top showing | orange pumpkin | green cactus | water reeds cattails | fallen mossy log
```

## Sheet 4 – Items & UI Icons → `items/`

```
A pixel art icon sheet, square image, arranged in a perfectly uniform 6x6 grid of 36 equal square cells. Each cell contains exactly ONE isolated game icon, centered in its cell, all icons drawn at the same scale and filling about 80% of their cell, with even empty spacing between cells. No gridlines, no borders, no text, no letters, no numbers. Transparent background (if not possible: plain flat solid white background). Style: 32x32 retro 16-bit SNES RPG inventory icons, slight 3/4 angle, clean 1px dark outline, bright readable colors, soft light from top-left, consistent style across all cells.

Cells in order, left to right, top to bottom:
Row 1: roasted meat drumstick with red apple | bundle of three wooden logs | pile of grey stones | lump of black coal | iron ingot bar | stack of gold coins
Row 2: sparkling purple gemstone | glowing golden sun orb with rays | iron pickaxe | iron axe | farming hoe | wooden hammer
Row 3: iron short sword | wooden spear | wooden bow | round wooden shield | red potion bottle | ancient glowing golden amulet
Row 4: parchment scroll with red ribbon | white halo with small angel wings | red devil horns with dark aura | red heart | empty bowl with spoon | yellow smiling face
Row 5: blue crying face | three small people silhouettes | glowing golden twenty-sided dice | two hands shaking | two crossed swords | blue banner flag with shield emblem
Row 6: white speech bubble with three dots | treasure chest with small cloud | blue glowing bubble shield | golden crown | baby wrapped in blanket | golden star
```

## Sheet 5 – Effects, Emotes & Weather → `effects/`

```
A pixel art effects sheet, square image, arranged in a perfectly uniform 6x6 grid of 36 equal square cells. Each cell contains exactly ONE isolated small effect sprite, centered in its cell, all drawn at the same scale and filling about 70% of their cell, with even empty spacing between cells. No gridlines, no borders, no text, no letters. Transparent background (if not possible: plain flat solid black background). Style: 32x32 retro 16-bit SNES pixel art game effects, bold bright colors, clean 1px dark outline, simple readable shapes, consistent style across all cells.

Cells in order, left to right, top to bottom:
Row 1: golden four-point sparkle star | grey smoke puff | brown dust cloud | single orange yellow flame | orange explosion burst | yellow lightning bolt
Row 2: green plus sign | purple glowing skull | green toxic bubble | glowing blue magic orb | light blue ice crystal | white impact hit star
Row 3: blue raindrop | white snowflake | green falling leaf | blue water splash | small falling rock chunk | spinning gold coin
Row 4: speech bubble with red exclamation mark | speech bubble with question mark | speech bubble with sleepy Z symbols | speech bubble with pink heart | speech bubble with red anger symbol | speech bubble with music note
Row 5: bouncing yellow down arrow marker | red flag on pole | red target crosshair circle | two crossed swords war marker | small footprint | white feather
Row 6: white fluffy cloud | yellow sun | crescent moon | flaming meteor | grey tornado | glowing blue wisp soul
```

## Sheet 6 – Buildings II → save as `Buildings2.png`

```
A pixel art sprite sheet, square image, arranged in a perfectly uniform 6x6 grid of 36 equal square cells. Each cell contains exactly ONE isolated building, centered in its cell, all buildings drawn at the same scale and filling about 85% of their cell, with even empty spacing between cells. No gridlines, no borders, no text, no labels, no numbers. Transparent background (if not possible: plain flat solid white background). Style: 32x32 retro 16-bit SNES pixel art, top-down 3/4 view, clean 1px dark outline, limited warm medieval palette, soft light from top-left, no ground tiles under buildings, matching the style of a medieval village builder game, consistent style across all cells.

Cells in order, left to right, top to bottom:
Row 1: small wooden craft hut with spears and axes leaning on the wall | stone weaponsmith forge with glowing furnace and swords on a rack | stone armory with shields and banners on the walls | fenced training ground with straw target dummies | small wooden guard post with a torch and spear | siege workshop with a wooden catapult beside it
Row 2: small orchard of fruit trees with a low fence | fenced pasture with two cows | hunters lodge with antlers over the door and animal pelts | wooden apiary with beehive boxes | stone bakery with bread sign and smoking oven chimney | brewery with large wooden barrels
Row 3: stone quarry pit with cut stone blocks and a wooden crane | charcoal kiln dome made of earth with smoke rising | stone smelter with molten orange metal and crucible | carpenter workshop with planks and a saw bench | large wooden warehouse with big double doors and crates | small open workshop shed with tools on the wall
Row 4: town hall with a clock tower and flag | stone courthouse with columns and a scales of justice emblem | small stone jail with barred windows | cozy two-story inn with a bed sign | stone bathhouse with steam rising | stone hospital with a red cross banner
Row 5: small stone chapel with a bell tower | grand gothic cathedral with stained glass windows and spires | stone monastery with a cloister garden | stone observatory tower with a domed telescope roof | grand university building with a dome and scrolls banner | tall purple mage tower with glowing crystals at the top
Row 6: tall round stone defense tower with battlements | massive stone fortress with thick walls and towers | royal palace with golden roofs and red banners | round stone colosseum arena | tall striped lighthouse on rocks with a glowing light | royal garden with hedges, flowers and a small fountain
```

## Sheet 7 – Buildings III: Intrigue & the Future → save as `Buildings3.png`

```
A pixel art sprite sheet, square image, arranged in a perfectly uniform 6x6 grid of 36 equal square cells. Each cell contains exactly ONE isolated building, centered in its cell, all buildings drawn at the same scale and filling about 85% of their cell, with even empty spacing between cells. No gridlines, no borders, no text, no labels, no numbers. Transparent background (if not possible: plain flat solid white background). Style: 32x32 retro 16-bit SNES pixel art, top-down 3/4 view, clean 1px dark outline, soft light from top-left, no ground tiles under buildings, same style as a medieval village builder game that advances through the industrial age into a sci-fi future, consistent style across all cells.

Cells in order, left to right, top to bottom:
Row 1: shady wooden spy den with hooded window and hidden door | stone gunpowder mill with black powder barrels | grim stone prison with barred windows and a watchtower | elegant embassy building with foreign flags | stone cannon tower with a black cannon on top | small reinforced vault with a heavy iron door
Row 2: brick factory with tall smokestacks | steel mill with glowing molten steel and chimneys | printing press workshop with paper stacks | victorian railway station with a steam train | tall brick tenement apartment block | tall clock tower with a big clock face
Row 3: modern research laboratory with glass windows and antenna | small telegraph office with wires on poles | grand museum with columns and a banner | futuristic academy of science with a glass dome | glass vertical farm tower full of green plants | clean modern white hospital with red cross
Row 4: power plant with cooling towers and steam | radar array with a large rotating dish | concrete military bunker half underground | airfield with a runway and a small plane | tank factory with a green tank at the door | missile silo with an open hatch and a missile
Row 5: robot factory with robotic arms and blue lights | drone hub landing pad with small drones | glowing fusion reactor with blue plasma core | futuristic arcology megastructure tower | shield generator emitting a blue energy dome | sleek hyperloop station with a glowing tube
Row 6: spaceport launch pad with a rocket ready to launch | glowing AI core supercomputer with cyan lights | holographic park with glowing hologram trees | sci-fi cloning vat lab with green glowing tubes | orbital cannon satellite dish pointed at the sky | mech bay hangar with a giant robot mech inside
```

## Sheet 8 – Agents, Modern Units & Tech → save as `Units.png`

```
A pixel art sprite sheet, square image, arranged in a perfectly uniform 6x6 grid of 36 equal square cells. Each cell contains exactly ONE isolated sprite, centered in its cell, all drawn at the same scale and filling about 80% of their cell, with even empty spacing between cells. No gridlines, no borders, no text, no labels, no numbers. Transparent background (if not possible: plain flat solid white background). Style: 32x32 retro 16-bit SNES pixel art, top-down 3/4 view, facing the viewer, clean 1px dark outline, soft light from top-left, no ground shadows, consistent style across all cells.

Cells in order, left to right, top to bottom:
Row 1: spy in a dark hooded cloak with a dagger | traitor villager with a sly grin holding a bag of stolen coins | masked assassin in black with twin knives | saboteur carrying a lit bomb | prisoner in striped clothes with shackles | informant whispering behind a hand
Row 2: musketeer soldier with a musket and tricorn hat | rifleman soldier in green uniform with a rifle | grenadier soldier throwing a grenade | small yellow robot worker with a wrench | armored robot soldier with a laser gun | sleek humanoid android with glowing eyes
Row 3: black iron cannon on wooden wheels | green military tank | small fighter jet plane | small quadcopter drone | giant bipedal combat mech | cyborg soldier with a glowing robotic arm
Row 4: round black bomb with a lit fuse | bundle of red dynamite sticks | red and white missile | glowing blue science flask icon | metal gear cog | green microchip circuit
Row 5: steel I-beam | black oil barrel | glowing battery cell | green radar screen | satellite with solar panels | security keycard
Row 6: huge orange mushroom explosion | tall grey smoke plume | red laser beam | glowing blue energy shield bubble | crackling electric spark | yellow radiation hazard symbol glowing
```

## Sheet 9 – People: every profession, man and woman → save as `People.png`

Each profession is a pair: the **man on the left, the woman on the right**. Same size, same pose and the same outfit colours for both, so they clearly belong together.

```
A pixel art sprite sheet, square image, arranged in a perfectly uniform 6x6 grid of 36 equal square cells. Each cell contains exactly ONE isolated full-body character, centered in its cell, all characters drawn at exactly the same scale and height, filling about 80% of their cell, with even empty spacing between cells. No gridlines, no borders, no text, no labels, no numbers. Transparent background (if not possible: plain flat solid white background). Style: 32x32 retro 16-bit SNES pixel art, top-down 3/4 view, standing and facing the viewer, clean 1px dark outline, limited warm earthy medieval palette, soft light from top-left, no ground shadows, consistent style across all cells. Every profession appears twice side by side: first a MAN, then a WOMAN wearing the same outfit colors and holding the same tool. Adult characters have simple readable faces and clear silhouettes; each profession must be recognisable from its tool and clothing alone.

Cells in order, left to right, top to bottom:
Row 1: man gatherer with a woven basket of red berries | woman gatherer with a woven basket of red berries | man woodcutter in a plaid shirt carrying an axe | woman woodcutter in a plaid shirt carrying an axe | man miner with a helmet candle and pickaxe | woman miner with a helmet candle and pickaxe
Row 2: man farmer with a straw hat and hoe | woman farmer with a straw hat and hoe | man fisher with a fishing rod and a fish | woman fisher with a fishing rod and a fish | man hunter in a fur cloak with a bow | woman hunter in a fur cloak with a bow
Row 3: man builder with a tool belt and hammer carrying a plank | woman builder with a tool belt and hammer carrying a plank | man blacksmith in a leather apron with a hammer | woman blacksmith in a leather apron with a hammer | man spy in a dark hooded cloak with a dagger | woman spy in a dark hooded cloak with a dagger
Row 4: man recruit in a plain padded tunic holding a wooden practice sword | woman recruit in a plain padded tunic holding a wooden practice sword | man warrior in leather armor with a sword and round shield | woman warrior in leather armor with a sword and round shield | man scout with a green hood and a spyglass | woman scout with a green hood and a spyglass
Row 5: man explorer with a backpack, map and walking staff | woman explorer with a backpack, map and walking staff | man priest in a white robe with gold trim holding a book | woman priestess in a white robe with gold trim holding a book | man merchant with a purple hood and a coin pouch | woman merchant with a purple hood and a coin pouch
Row 6: man noble steward in a fine blue coat holding a scroll | woman noble steward in a fine blue dress holding a scroll | old grey-bearded elder man with a walking stick | old grey-haired elder woman with a shawl and walking stick | small boy child in a tiny tunic | small girl child in a tiny dress
```

## Sheet 10 – Boats & Sea → save as `Boats.png`

Boats are drawn **straight from above, pointing to the RIGHT**, so the game can rotate them in any direction while you steer. Everything else on this sheet uses the normal 3/4 view.

```
A pixel art sprite sheet, square image, arranged in a perfectly uniform 6x6 grid of 36 equal square cells. Each cell contains exactly ONE isolated sprite, centered in its cell, all drawn at the same scale and filling about 80% of their cell, with even empty spacing between cells. No gridlines, no borders, no text, no labels, no numbers. Transparent background (if not possible: plain flat solid white background). Style: 32x32 retro 16-bit SNES pixel art, clean 1px dark outline, soft light from top-left, no water drawn around the boats, no ground shadows, consistent style across all cells. IMPORTANT: every boat and ship in rows 1 to 3 is seen from directly above (top-down bird's-eye view) with its bow pointing to the RIGHT, drawn horizontally, the same way every time. Rows 4 to 6 use a top-down 3/4 view.

Cells in order, left to right, top to bottom:
Row 1: small wooden log raft | wooden rowboat with two oars | small fishing boat with a white sail | viking longship with a striped sail and shields along the sides | medieval merchant cog with a square sail | caravel with three sails
Row 2: large galleon warship with rows of cannons | pirate ship with black sails | steam paddle boat with a smokestack | armored ironclad warship | grey steel battleship with gun turrets | submarine surfaced on the water
Row 3: small fast patrol boat | missile destroyer with launch tubes | cargo ship stacked with colored containers | small speedboat | futuristic glowing hover boat | futuristic energy battleship with blue lights
Row 4: black iron cannonball | round sea bomb with a lit fuse | torpedo | spiked naval sea mine | harpoon | burning oil barrel
Row 5: big white water splash | foamy boat wake trail | burning ship wreck with flames and smoke | ship sinking half underwater | floating broken wooden planks and debris | swirling whirlpool
Row 6: wooden dock pier | red and white floating buoy | iron anchor icon | wooden ship steering wheel icon | open treasure chest full of gold | green sea serpent rising from the water
```

## Sheet 11 – Magic & Moods (optional) → save as `Magic.png`

Spell effects for wizards, plus small icons for talents, pride and rebellion. The game works without this sheet (it borrows existing effects), but magic looks far better with it.

```
A pixel art sprite sheet, square image, arranged in a perfectly uniform 6x6 grid of 36 equal square cells. Each cell contains exactly ONE isolated sprite, centered in its cell, all drawn at the same scale and filling about 80% of their cell, with even empty spacing between cells. No gridlines, no borders, no text, no labels, no numbers. Transparent background (if not possible: plain flat solid white background). Style: 32x32 retro 16-bit SNES pixel art, top-down 3/4 view, clean 1px dark outline, soft light from top-left, glowing magical colors, no ground shadows, consistent style across all cells.

Cells in order, left to right, top to bottom:
Row 1: blazing orange fireball with a trail | green healing light sparkles rising | golden blessing glow over wheat | translucent blue arcane ward dome | forked white-blue lightning bolt striking down | swirling purple magic portal
Row 2: blue mana crystal | glowing mana potion bottle | open spellbook with glowing runes | wooden wizard staff with a blue orb | crackling magic wand | floating glowing rune circle on the ground
Row 3: icy frost blast | green poison cloud | glowing shield rune | exploding purple arcane burst | small glowing wisp spirit familiar | wizard's crystal ball on a stand
Row 4: gold star talent badge | proud villager with nose in the air and a tiny crown of arrogance | angry rebel raising a fist | red rebel flag on a pole | broken chain shackles | crossed swords duel icon
Row 5: speech bubble with three dots | speech bubble with an exclamation mark | speech bubble with a heart | speech bubble with a question mark | speech bubble with an angry scribble | speech bubble with musical notes
Row 6: family crest shield with a tree | baby cradle | wedding rings | old family tree scroll | gravestone with flowers | glowing golden laurel wreath of honour
```

---

## How to slice
1. Open `tools/slicer.html` in Chrome or Edge (double-click it).
2. Pick the sheet in the dropdown → drop your generated image in.
3. Check the preview: every sprite should be clean with its correct name.
   - Background bits left over? Raise **tolerance**.
   - Parts of the sprite missing? Lower tolerance.
   - Neighbour sprites bleeding in? Raise **edge inset**.
4. **Save into assets folder…** → choose `HEARTBORN_DIR_KEEP` (it creates the subfolder).
