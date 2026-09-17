"""Makes a sheet with a soft glowing / gradient background transparent.
The glow is smooth, so it can be rebuilt from the background around the sprites (a blur that ignores sprite
pixels). Anything that differs clearly from that rebuilt glow is sprite; outlined shapes are filled in."""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage


def _background(rgb, sprite, sigma):
    w = (~sprite).astype(np.float32)
    num = ndimage.gaussian_filter(rgb * w[..., None], sigma=(sigma, sigma, 0))
    den = ndimage.gaussian_filter(w, sigma=sigma)[..., None]
    return num / np.maximum(den, 1e-3)


def glow_keyout(path, out_path, tol=22, sigma=18, min_frac=0.02):
    rgb = np.array(Image.open(path).convert("RGB")).astype(np.float32)
    smooth = ndimage.gaussian_filter(rgb, sigma=(5, 5, 0))
    sprite = np.abs(rgb - smooth).max(axis=2) > 26            # first guess: sharp edges
    sprite = ndimage.binary_dilation(sprite, iterations=6)
    for _ in range(3):
        bg = _background(rgb, sprite, sigma)
        diff = np.abs(rgb - bg).max(axis=2)
        m = diff > tol
        m = ndimage.binary_closing(m, structure=np.ones((3, 3)), iterations=2)
        m = ndimage.binary_fill_holes(m)
        m = ndimage.binary_opening(m, structure=np.ones((3, 3)))
        sprite = ndimage.binary_dilation(m, iterations=4)
    labels, n = ndimage.label(m)
    sizes = ndimage.sum(m, labels, range(1, n + 1))
    keep = np.zeros(n + 1, bool)
    keep[1:] = sizes >= sizes.max() * min_frac
    m = keep[labels]
    out = np.dstack([rgb.astype(np.uint8), (m * 255).astype(np.uint8)])
    Image.fromarray(out).save(out_path)
    print(f"{path}: kept {keep.sum()} shapes")


if __name__ == "__main__":
    glow_keyout(sys.argv[1], sys.argv[2], *(float(a) for a in sys.argv[3:4]))
