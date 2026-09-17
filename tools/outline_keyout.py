"""Makes a sheet transparent using each sprite's dark outline: the background is flooded in from every cell's edges
and stops at the outline, so everything inside an outline stays (even pixels as dark as the background).
Use for AI sheets whose sprites all have a near-black outline and whose background is a dark glow."""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage


def outline_keyout(path, out_path, cols, rows, outline_max=18):
    rgb = np.array(Image.open(path).convert("RGB"))
    H, W = rgb.shape[:2]
    dark = rgb.max(axis=2) <= outline_max
    alpha = np.zeros((H, W), bool)
    seal = 3
    for r in range(rows):
        for c in range(cols):
            y0, y1 = int(r * H / rows), int((r + 1) * H / rows)
            x0, x1 = int(c * W / cols), int((c + 1) * W / cols)
            cell_dark = dark[y0:y1, x0:x1].copy()
            # dark areas touching the cell's edge are background (a black sheet corner), not an outline
            lab, _ = ndimage.label(cell_dark)
            border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
            cell_dark[np.isin(lab, border[border != 0])] = False
            # a thickened outline seals small gaps; flood the background in from the edges
            wall = ndimage.binary_dilation(cell_dark, iterations=seal)
            labels, _ = ndimage.label(~wall)
            edge = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
            outside = np.isin(labels, edge[edge != 0])
            outside = ndimage.binary_erosion(outside, iterations=seal, border_value=1)   # back out to the real outline
            sprite = ~outside
            lab2, n = ndimage.label(sprite)
            if n:
                sizes = ndimage.sum(sprite, lab2, range(1, n + 1))
                sprite = np.isin(lab2, [i + 1 for i, sz in enumerate(sizes) if sz >= sizes.max() * 0.05])
            alpha[y0:y1, x0:x1] = sprite
    out = np.dstack([rgb, (alpha * 255).astype(np.uint8)])
    Image.fromarray(out).save(out_path)
    print(f"{path}: done")


if __name__ == "__main__":
    outline_keyout(sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]))
