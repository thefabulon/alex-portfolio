"""Turn the book photo of the Stölzl tapestry into a flat, square-on texture.

The photo (inspiration/tapestry.HEIC) was taken at an angle, so the tapestry is a
skewed four-sided shape on the page. This pulls those four corners out to a
rectangle, evens out the room light, and writes woven-room/tapestry.js with the
image inlined, so the room opens straight from the file with no server.

Run from the repo root (macOS, needs Pillow and numpy):
    python3 woven-room/tools/flatten.py inspiration/tapestry.HEIC woven-room/tapestry.js
"""
import base64
import io
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image, ImageFilter, ImageOps

W, H = 1500, 2048  # output size; the real tapestry is about 110 x 150 cm
# Corners of the woven part (top-left, top-right, bottom-right, bottom-left), in pixels
# of the upright photo, nudged inward so no book page shows. The fringe is left out on
# purpose: the room builds it as separate strands that can sway.
QUAD = [(306, 752), (2290, 708), (2452, 3510), (250, 3508)]


def load(path):
    if path.lower().endswith(".heic"):  # Pillow can't read HEIC; let macOS convert it
        tmp = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False).name
        subprocess.run(["sips", "-s", "format", "jpeg", path, "--out", tmp], check=True, capture_output=True)
        path = tmp
    return ImageOps.exif_transpose(Image.open(path)).convert("RGB")


def flatten(im):
    A, b = [], []
    for (x, y), (u, v) in zip([(0, 0), (W, 0), (W, H), (0, H)], QUAD):
        A.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.append(u)
        A.append([0, 0, 0, x, y, 1, -v * x, -v * y]); b.append(v)
    coeffs = np.linalg.solve(np.array(A, float), np.array(b, float))
    flat = im.transform((W, H), Image.PERSPECTIVE, tuple(coeffs), Image.BICUBIC)
    # Divide out a very soft brightness map so the window light across the page doesn't show.
    soft = flat.convert("L").resize((6, 8), Image.BOX).resize((W, H), Image.BICUBIC).filter(ImageFilter.GaussianBlur(120))
    L = np.asarray(soft).astype(np.float32)
    gain = (L.mean() / np.maximum(L, 1)) ** 0.6
    a = np.asarray(flat).astype(np.float32) * gain[..., None]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def main(src, dst):
    out = flatten(load(src))
    buf = io.BytesIO()
    out.save(buf, "JPEG", quality=84, optimize=True, progressive=True)
    data = base64.b64encode(buf.getvalue()).decode()
    with open(dst, "w") as f:
        f.write("// Gunta Stölzl, Slit Tapestry Red-Green (1927/28), flattened from a book photo by tools/flatten.py.\n")
        f.write(f'window.TAPESTRY_IMG = {{ "w": {W}, "h": {H}, "src": "data:image/jpeg;base64,{data}" }};\n')
    print(f"{dst}: {W}x{H}, {len(buf.getvalue()) // 1024} KB jpeg")


if __name__ == "__main__":
    main(*sys.argv[1:3])
