// Generates BUILDINGS.md from the real game data: node tools/building_guide.mjs
import { writeFileSync } from 'node:fs';
import { BUILDINGS, ERAS, CATEGORIES } from '../src/data/buildings.js';
import { describeBuilding } from '../src/data/describe.js';

const lines = [
  '# Heartborn – Building Guide',
  '',
  `All ${Object.keys(BUILDINGS).length} buildings, generated from the game data (\`node tools/building_guide.mjs\`).`,
  'Every building also explains itself in the game: in the Build menu and when you click it.',
  '',
];
ERAS.forEach((era, i) => {
  lines.push(`## ${era.name} era`);
  if (i > 0) lines.push(`*Unlocks at ${era.pop} people with ${era.requires.map(t => BUILDINGS[t].name).join(' + ')}${era.science ? ` and ${era.science} science` : ''}.*`);
  lines.push('');
  for (const [cat, catName] of CATEGORIES) {
    const list = Object.entries(BUILDINGS).filter(([, d]) => d.era === i && d.cat === cat);
    if (!list.length) continue;
    lines.push(`### ${catName}`, '', '| Building | Size | Cost | What it does |', '|---|---|---|---|');
    for (const [type, d] of list) {
      const cost = Object.entries(d.cost).map(([k, n]) => `${n} ${k}`).join(', ');
      const effects = describeBuilding(type).map(e => `${e.icon} ${e.text}`).join('<br>');
      lines.push(`| **${d.name}** | ${d.size}×${d.size} | ${cost} | ${d.desc}<br>${effects} |`);
    }
    lines.push('');
  }
});
writeFileSync(new URL('../BUILDINGS.md', import.meta.url), lines.join('\n'));
console.log(`BUILDINGS.md written (${Object.keys(BUILDINGS).length} buildings)`);
