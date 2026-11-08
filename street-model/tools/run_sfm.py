"""Street point cloud from a 360 (equirectangular) video.

1. Cut each 360 frame into 5 pinhole views (yaw -100..100, 90 deg FOV); the backward
   view, where the rider and selfie stick are, is skipped.
2. COLMAP: SIFT features, sequential matching, incremental mapping (shared intrinsics).
3. Export the largest model as PLY + JSON (points and camera path) for the web viewer.
"""
import glob
import json
import math
import os
import sys
import time

import numpy as np
import pycolmap
from PIL import Image

FRAMES = sys.argv[1]
WORK = sys.argv[2]
OUT = sys.argv[3]
SIZE = 1024
FOV = math.radians(90)
YAWS = [-100, -50, 0, 50, 100]

views_dir = os.path.join(WORK, "views")
os.makedirs(views_dir, exist_ok=True)
os.makedirs(OUT, exist_ok=True)
t0 = time.time()


def log(msg):
    print(f"[{time.time() - t0:6.0f}s] {msg}", flush=True)


def view_maps(width, height):
    f = (SIZE / 2) / math.tan(FOV / 2)
    u, v = np.meshgrid(np.arange(SIZE) + 0.5, np.arange(SIZE) + 0.5)
    x = (u - SIZE / 2) / f
    y = (v - SIZE / 2) / f
    z = np.ones_like(x)
    maps = {}
    for yaw in YAWS:
        a = math.radians(yaw)
        xr = x * math.cos(a) + z * math.sin(a)
        zr = -x * math.sin(a) + z * math.cos(a)
        lon = np.arctan2(xr, zr)
        lat = np.arctan2(-y, np.hypot(xr, zr))
        px = (lon / (2 * math.pi) + 0.5) * width - 0.5
        py = (0.5 - lat / math.pi) * height - 0.5
        maps[yaw] = (px, py)
    return maps, f


def sample(img, px, py):
    h, w, _ = img.shape
    x0 = np.floor(px).astype(int)
    y0 = np.clip(np.floor(py).astype(int), 0, h - 2)
    fx = (px - x0)[..., None]
    fy = (py - y0)[..., None]
    x0 %= w
    x1 = (x0 + 1) % w
    top = img[y0, x0] * (1 - fx) + img[y0, x1] * fx
    bot = img[y0 + 1, x0] * (1 - fx) + img[y0 + 1, x1] * fx
    return (top * (1 - fy) + bot * fy).astype(np.uint8)


frames = sorted(glob.glob(os.path.join(FRAMES, "r_*.jpg")))
first = np.asarray(Image.open(frames[0]).convert("RGB"))
maps, focal = view_maps(first.shape[1], first.shape[0])
for i, path in enumerate(frames):
    img = np.asarray(Image.open(path).convert("RGB")).astype(np.float32)
    for k, yaw in enumerate(YAWS):
        name = os.path.join(views_dir, f"f{i:03d}_v{k}.jpg")
        if not os.path.exists(name):
            Image.fromarray(sample(img, *maps[yaw])).save(name, quality=92)
log(f"cut {len(frames)} frames into {len(frames) * len(YAWS)} views")

db = os.path.join(WORK, "database.db")
if os.path.exists(db):
    os.remove(db)
reader = pycolmap.ImageReaderOptions()
reader.camera_model = "PINHOLE"
reader.camera_params = f"{focal},{focal},{SIZE / 2},{SIZE / 2}"
extraction = pycolmap.FeatureExtractionOptions()
extraction.sift.max_num_features = 4096
pycolmap.extract_features(db, views_dir, camera_mode=pycolmap.CameraMode.SINGLE,
                          camera_model="PINHOLE", reader_options=reader,
                          extraction_options=extraction, device=pycolmap.Device.cpu)
log("features extracted")

pairing = pycolmap.SequentialPairingOptions()
pairing.overlap = 3 * len(YAWS)  # this frame's views plus the next 3 frames
pairing.quadratic_overlap = False
pycolmap.match_sequential(db, pairing_options=pairing, device=pycolmap.Device.cpu)
log("matched")

options = pycolmap.IncrementalPipelineOptions()
options.ba_refine_focal_length = False
options.ba_refine_principal_point = False
options.ba_refine_extra_params = False
models = pycolmap.incremental_mapping(db, views_dir, os.path.join(WORK, "sparse"), options)
log(f"models: {[ (k, m.num_reg_images(), m.num_points3D()) for k, m in models.items() ]}")
if not models:
    sys.exit("no model")

model = max(models.values(), key=lambda m: m.num_reg_images())
model.export_PLY(os.path.join(OUT, "street-points.ply"))

points = []
for p in model.points3D.values():
    if p.track.length() >= 3 and p.error < 2.0:
        points.append([*map(float, p.xyz), *map(int, p.color)])
cams = []
for img in model.images.values():
    if img.name.endswith("_v2.jpg"):  # forward-facing view traces the ride
        c = img.projection_center()
        cams.append([img.name, *map(float, c)])
cams.sort()
with open(os.path.join(OUT, "street-model.json"), "w") as fh:
    json.dump({"points": points, "path": [c[1:] for c in cams],
               "registered": model.num_reg_images(), "views": len(frames) * len(YAWS)}, fh)
log(f"exported {len(points)} points, {len(cams)} path stops, "
    f"{model.num_reg_images()}/{len(frames) * len(YAWS)} views placed")
