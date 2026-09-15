"""Slice heroAll.png (every hero animation, boy and girl, in one sheet) into public/assets/hero.

The generated sheet came out as 14 columns x 8 rows: columns 1-7 are the boy, 8-14 the girl (7 frames each),
and the rows are walk down, walk up, walk right, attack down, attack up, attack right, block, hurt.
The attack-right row lunges with speed lines and a dust puff, so it also serves as the dash.

Every frame is cut from a window of the SAME size, centred on its column and row, and scaled by the same factor,
so the animation never jitters.  Usage: python tools/slice_hero_all.py [heroAll.png]
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from slice_sheets import find_cuts, clean_mask, ALPHA_CUT  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
COLS, ROWS, PER_HERO, FRAMES = 14, 8, 7, 6
SIZE = 256
ROW_ANIMS = ['walk_down', 'walk_up', 'walk_side', 'attack_down', 'attack_up', 'attack_side', 'block_side', 'hurt_down']
ALSO = {'attack_side': ['dash_side']}   # rows that double as another animation


def main():
    src = ROOT / (sys.argv[1] if len(sys.argv) > 1 else 'heroAll.png')
    img = Image.open(src).convert('RGBA')
    rgba = np.array(img)
    opaque = rgba[:, :, 3] > ALPHA_CUT
    row_cuts = find_cuts(opaque.sum(axis=1), ROWS)
    col_cuts = find_cuts(opaque.sum(axis=0), COLS)
    # one window size for every frame: the largest cell
    win_w = max(b - a for a, b in zip(col_cuts, col_cuts[1:]))
    win_h = max(b - a for a, b in zip(row_cuts, row_cuts[1:]))
    side = max(win_w, win_h)
    out_dirs = [ROOT / 'public' / 'assets' / 'hero', ROOT / 'public' / 'assets-lo' / 'hero']
    for d in out_dirs:
        d.mkdir(parents=True, exist_ok=True)
    count = 0
    for r, anim in enumerate(ROW_ANIMS):
        cy = (row_cuts[r] + row_cuts[r + 1]) // 2
        for c in range(COLS):
            who = 'boy' if c < PER_HERO else 'girl'
            frame = c % PER_HERO
            if frame >= FRAMES:
                continue   # the 7th frame of each hero returns to the first pose; the loop does that already
            cx = (col_cuts[c] + col_cuts[c + 1]) // 2
            # the band itself, so a neighbour's sword never leaks in; then placed in a fixed-size square
            band = rgba[row_cuts[r]:row_cuts[r + 1], col_cuts[c]:col_cuts[c + 1]].copy()
            mask = clean_mask(band[:, :, 3], 0.08)
            band[~mask] = 0
            square = Image.new('RGBA', (side, side), (0, 0, 0, 0))
            # centre horizontally on the column, and keep the row's bottom edge as the floor line
            ox = side // 2 - (cx - col_cuts[c])
            oy = side - (row_cuts[r + 1] - row_cuts[r]) - (side - win_h) // 2
            square.paste(Image.fromarray(band), (ox, oy))
            out = square.resize((SIZE, SIZE), Image.BOX)
            out.putalpha(out.getchannel('A').point(lambda v: 255 if v >= 128 else 0))
            for name in [anim] + ALSO.get(anim, []):
                key = f'{who}_{name}_{frame}'
                small = out.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
                small.save(out_dirs[0] / f'{key}.png', optimize=True)
                lo = out.resize((SIZE // 2, SIZE // 2), Image.NEAREST)
                lo.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(out_dirs[1] / f'{key}.png', optimize=True)
                count += 1
    print(f'hero: {count} frames -> public/assets/hero (cells {win_w}x{win_h}, window {side})')


if __name__ == '__main__':
    main()
