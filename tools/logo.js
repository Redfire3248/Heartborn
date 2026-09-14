// Heartborn app logo: the title-font "H" in front of a big pixel fire.
// Regenerate the icons with the dev server running, in the browser console:
//   (await import('/tools/logo.js')).saveIcons()

const FIRE = [
  '..........#.........',
  '.........##.........',
  '.........###....#...',
  '........####...##...',
  '...#....####..###...',
  '...##..#####.####...',
  '...###.##o###o###...',
  '..####.#oo##oo###.#.',
  '..###o##ooo#ooo####.',
  '.####oo#oooooooo###.',
  '.###oooooyoooyooo##.',
  '####ooooyyooyyoooo##',
  '###ooooyyyyyyyooooo#',
  '###oooyyyyyyyyyoooo#',
  '##oooyyyywwyyyyyooo#',
  '##ooyyyywwwwyyyyyoo#',
  '#oooyyywwwwwwyyyooo#',
  '#ooyyywwwwwwwwyyyoo#',
  '#ooyyywwwwwwwwyyyoo#',
  '##ooyyywwwwwwyyyoo##',
  '.#oooyyyyyyyyyyooo#.',
  '.##oooooyyyyyooooo#.',
  '..###oooooooooo###..',
  '....############....',
];
const FIRE_COLORS = { '#': '#d8321a', o: '#ff7a24', y: '#ffc23a', w: '#fff1b0' };

/** Draw the logo at S×S pixels. `inset` shrinks the art (maskable icons need a safe margin). */
export function drawLogo(S, { rounded = true, inset = 0 } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');

  const bg = x.createRadialGradient(S / 2, S * 0.62, S * 0.04, S / 2, S * 0.55, S * 0.8);
  bg.addColorStop(0, '#3a1c24'); bg.addColorStop(0.5, '#1f1226'); bg.addColorStop(1, '#0f0916');
  x.beginPath(); x.roundRect(0, 0, S, S, rounded ? S * 0.22 : 0); x.fillStyle = bg; x.fill();

  x.save();
  x.translate(S / 2, S / 2); x.scale(1 - inset, 1 - inset); x.translate(-S / 2, -S / 2);

  // the fire, big and behind everything
  const cell = Math.max(1, Math.round(S * 0.86 / FIRE.length));
  const fx = Math.round(S / 2 - cell * FIRE[0].length / 2), fy = Math.round(S * 0.48 - cell * FIRE.length / 2);
  const glow = x.createRadialGradient(S / 2, S * 0.55, 0, S / 2, S * 0.55, S * 0.55);
  glow.addColorStop(0, 'rgba(255,120,30,.55)'); glow.addColorStop(1, 'rgba(255,120,30,0)');
  x.fillStyle = glow; x.fillRect(0, 0, S, S);
  x.save();
  x.globalAlpha = 0.92; x.shadowColor = 'rgba(255,100,20,.9)'; x.shadowBlur = S * 0.06;
  FIRE.forEach((row, j) => [...row].forEach((ch, i) => {
    if (FIRE_COLORS[ch]) { x.fillStyle = FIRE_COLORS[ch]; x.fillRect(fx + i * cell, fy + j * cell, cell, cell); }
  }));
  x.restore();

  // the H, in the same font and colours as the title
  x.font = '700 100px "Pixelify Sans"';
  const size = 100 * (S * 0.52) / x.measureText('H').actualBoundingBoxAscent;
  x.font = `700 ${size}px "Pixelify Sans"`;
  const m = x.measureText('H');
  const w = m.actualBoundingBoxLeft + m.actualBoundingBoxRight, hgt = m.actualBoundingBoxAscent;
  const tx = S / 2 - w / 2 + m.actualBoundingBoxLeft, base = S * 0.54 + hgt / 2;
  x.textBaseline = 'alphabetic';
  x.save(); x.shadowColor = 'rgba(0,0,0,.55)'; x.shadowBlur = S * 0.04;
  x.fillStyle = '#3a1408'; x.fillText('H', tx, base + S * 0.035);
  x.restore();
  x.lineJoin = 'miter'; x.lineWidth = S * 0.05; x.strokeStyle = '#1c0a0e'; x.strokeText('H', tx, base + S * 0.012);
  const g = x.createLinearGradient(0, base - hgt, 0, base);
  g.addColorStop(0, '#fff2b8'); g.addColorStop(0.38, '#ffc34d'); g.addColorStop(0.7, '#ff7a2a'); g.addColorStop(1, '#c2331a');
  x.fillStyle = g; x.fillText('H', tx, base);
  x.lineWidth = Math.max(1, S * 0.008); x.strokeStyle = 'rgba(58,20,8,.9)'; x.strokeText('H', tx, base);
  x.restore();
  return c;
}

/** Dev server only: writes public/icons/*.png. */
export async function saveIcons() {
  await document.fonts.load('700 100px "Pixelify Sans"');
  const jobs = [[512], [192], [64], [32], [512, { rounded: false, inset: 0.2 }, 'maskable-512']];
  for (const [size, opts, name] of jobs) {
    const data = drawLogo(size, opts).toDataURL('image/png').split(',')[1];
    const res = await fetch('/__save-icon', { method: 'POST', body: JSON.stringify({ name: name || `icon-${size}`, data }) });
    if (!res.ok) throw new Error(await res.text());
  }
  return 'saved';
}
