"""Align the COLMAP model for the viewer: +Y up, ride heading -Z, start at origin,
rough metric scale (camera ~1.5 m above the ground), outliers trimmed."""
import glob
import json
import os
import sys

import numpy as np
import pycolmap

SPARSE, OUT = sys.argv[1], sys.argv[2]
CAMERA_HEIGHT = 1.5

models = [pycolmap.Reconstruction(d) for d in sorted(glob.glob(os.path.join(SPARSE, "*")))]
model = max(models, key=lambda m: m.num_reg_images())

ups, centers = [], {}
for img in model.images.values():
    R = img.cam_from_world().rotation.matrix()
    ups.append(R.T @ np.array([0.0, -1.0, 0.0]))  # camera "up" in world coordinates
    centers.setdefault(img.name.split("_")[0], []).append(img.projection_center())
up = np.median(ups, axis=0)
up /= np.linalg.norm(up)
# All five views of a frame were taken from one spot, so the median ignores a single misplaced view.
path = np.array([np.median(centers[k], axis=0) for k in sorted(centers)])

heading = path[-1] - path[0]
heading -= up * heading.dot(up)
heading /= np.linalg.norm(heading)
right = np.cross(heading, up)
# rows: x = right, y = up, z = -heading
rot = np.stack([right, up, -heading])

pts = np.array([p.xyz for p in model.points3D.values() if p.track.length() >= 3 and p.error < 2.0])
cols = np.array([p.color for p in model.points3D.values() if p.track.length() >= 3 and p.error < 2.0])
origin = path[0]
P = (pts - origin) @ rot.T
C = (path - origin) @ rot.T

# Scale from the ground: points just below the path sit about CAMERA_HEIGHT under the camera.
step = np.median(np.linalg.norm(np.diff(C, axis=0), axis=1))
near = np.min(np.linalg.norm(P[:, None, [0, 2]] - C[None, :, [0, 2]], axis=2), axis=1) < 3 * step
below = P[near & (P[:, 1] < 0), 1]
drop = -np.percentile(below, 50) if len(below) > 50 else None
scale = CAMERA_HEIGHT / drop if drop and drop > 0 else 1.0
P *= scale
C *= scale

# Trim far-away outliers (sky noise, mis-triangulated points).
dist = np.min(np.linalg.norm(P[:, None, :] - C[None, ::4, :], axis=2), axis=1)
keep = dist < 40
P, cols = P[keep], cols[keep]

flat = np.round(np.hstack([P, cols]), 3).ravel().tolist()
info = json.load(open(os.path.join(OUT, "street-model.json"))) if os.path.exists(os.path.join(OUT, "street-model.json")) else {}
with open(os.path.join(OUT, "street-model.json"), "w") as fh:
    json.dump({
        "points": flat,
        "path": np.round(C, 3).tolist(),
        "ground": -CAMERA_HEIGHT,
        "registered": model.num_reg_images(),
        "views": info.get("views", len(model.images)),
        "path_length_m": float(np.sum(np.linalg.norm(np.diff(C, axis=0), axis=1))),
    }, fh, separators=(",", ":"))
print(f"{len(P)} points kept, scale {scale:.3f}, path {np.sum(np.linalg.norm(np.diff(C, axis=0), axis=1)):.1f} m, "
      f"{len(C)} path stops, {model.num_reg_images()} views placed")
