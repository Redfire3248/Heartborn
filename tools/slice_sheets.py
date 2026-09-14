"""Slice 6x6 sprite sheets into square PNGs (256x256 by default).

Usage:  python tools/slice_sheets.py [--size 256] [sheet_key=image.png ...]
With no args, slices every sheet image found in the project root
(Characters.png, Buildings.png, Tiles.png/Nature.png, Items.png, Effects.png).
Names come from tools/sheets.js so the browser slicer and this script agree.
"""
import json
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public" / "assets"
SIZE = 256        # override with --size (sheets hold ~210px per cell, so 256 keeps all detail)
PAD = 4
TILE_INSET = 0.01
ALPHA_CUT = 40     # pixels below this alpha count as background
MIN_SPECK = 30     # connected blobs smaller than this (px) are dropped

DEFAULT_FILES = {
    "characters": ["Characters.png"],
    "buildings": ["Buildings.png"],
    "buildings2": ["Buildings2.png"],
    "buildings3": ["Buildings3.png"],
    "units": ["Units.png"],
    "nature": ["Tiles.png", "Nature.png"],
    "items": ["Items.png", "Tools.png", "Icons.png"],
    "effects": ["Effects.png", "Weather.png"],
}


def load_sheets():
    js = (ROOT / "tools" / "sheets.js").read_text(encoding="utf-8")
    body = js[js.index("{"): js.rindex("}") + 1]
    body = re.sub(r"//[^\n]*", "", body)                   # strip comments
    body = re.sub(r"(\w+)\s*:", r'"\1":', body)            # quote keys
    body = re.sub(r",\s*([\]}])", r"\1", body)             # trailing commas
    return json.loads(body)


def find_cuts(profile, count, search=0.3):
    """Split a 1D opacity profile into `count` bands.

    AI sheets are rarely perfectly even, so each cut is placed at the
    emptiest line near where the ideal grid line would be."""
    n = len(profile)
    step = n / count
    smooth = np.convolve(profile, np.ones(5) / 5, mode="same")
    cuts = [0]
    for k in range(1, count):
        ideal = k * step
        lo = max(cuts[-1] + 1, int(ideal - step * search))
        hi = min(n - 1, int(ideal + step * search))
        window = smooth[lo:hi]
        best = window.min()
        # among equally empty lines, take the one closest to the ideal line
        candidates = np.nonzero(window <= best + 0.5)[0] + lo
        cuts.append(int(candidates[np.argmin(np.abs(candidates - ideal))]))
    cuts.append(n)
    return cuts


def clean_mask(alpha):
    """Opaque mask with stray specks (from neighbours / bad bg removal) removed."""
    mask = alpha > ALPHA_CUT
    labels, num = ndimage.label(mask, structure=np.ones((3, 3)))
    if num == 0:
        return mask
    sizes = ndimage.sum(mask, labels, range(1, num + 1))
    keep = np.zeros(num + 1, bool)
    keep[1:] = sizes >= max(MIN_SPECK, sizes.max() * 0.02)
    return keep[labels]


def slice_sheet(key, sheet, path, cols=6, rows=6):
    img = Image.open(path).convert("RGBA")
    folder = OUT_DIR / sheet["folder"]
    folder.mkdir(parents=True, exist_ok=True)
    tiles = sheet.get("tileCount", 0)
    rgba = np.array(img)
    opaque = rgba[:, :, 3] > ALPHA_CUT

    row_cuts = find_cuts(opaque.sum(axis=1), rows)
    for i, name in enumerate(sheet["names"][: cols * rows]):
        r, c = divmod(i, cols)
        y0, y1 = row_cuts[r], row_cuts[r + 1]

        if i < tiles:
            # tiles fill their cell completely, so use the even grid
            cw = img.width / cols
            ix, iy = round(cw * TILE_INSET), round((y1 - y0) * TILE_INSET)
            cell = img.crop((round(c * cw) + ix, y0 + iy, round((c + 1) * cw) - ix, y1 - iy))
            out = cell.convert("RGB").resize((SIZE, SIZE), Image.BOX).convert("RGBA")
        else:
            # columns are found per row, since rows can be shifted independently
            col_cuts = find_cuts(opaque[y0:y1].sum(axis=0), cols)
            x0, x1 = col_cuts[c], col_cuts[c + 1]
            cell_px = rgba[y0:y1, x0:x1].copy()
            mask = clean_mask(cell_px[:, :, 3])
            cell_px[~mask] = 0
            cell = Image.fromarray(cell_px)
            ys, xs = np.nonzero(mask)
            bbox = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1) if len(xs) else None
            out = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
            if bbox:
                sprite = cell.crop(bbox)
                pad = max(PAD, SIZE // 32)
                room = SIZE - pad * 2
                scale = min(room / sprite.width, room / sprite.height)
                tw, th = max(1, round(sprite.width * scale)), max(1, round(sprite.height * scale))
                sprite = sprite.resize((tw, th), Image.BOX)
                # hard alpha edges so sprites stay crisp pixel art
                a = sprite.getchannel("A").point(lambda v: 255 if v >= 128 else 0)
                sprite.putalpha(a)
                out.paste(sprite, ((SIZE - tw) // 2, (SIZE - th) // 2), sprite)
        out.save(folder / f"{name}.png")

    print(f"{key}: {len(sheet['names'])} sprites -> {folder.relative_to(ROOT)}")


def main():
    sheets = load_sheets()
    global SIZE
    args = sys.argv[1:]
    if "--size" in args:
        i = args.index("--size")
        SIZE = int(args[i + 1])
        del args[i:i + 2]
    jobs = {}
    if args:
        for arg in args:
            k, p = arg.split("=", 1)
            jobs[k] = Path(p)
    else:
        for k, names in DEFAULT_FILES.items():
            for n in names:
                if (ROOT / n).exists():
                    jobs[k] = ROOT / n
                    break
    for k, p in jobs.items():
        slice_sheet(k, sheets[k], p)
    missing = [k for k in sheets if k not in jobs]
    if missing:
        print("Not found yet:", ", ".join(missing))


if __name__ == "__main__":
    main()
