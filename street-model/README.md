# My Street in 3D

A 3D point-cloud model of the street, rebuilt from a 30-second 360° longboard ride (`3D video/1017.mp4`, DJI Osmo 360, 6000×3000 equirectangular).

- **117,060 points**, all **500 of 500** camera views placed, ride path about **72 m**
- Scale is approximate: it assumes the camera rode about 1.5 m above the ground

## View it

The page loads `street-model.json`, so it needs a web server rather than a double-click:

```bash
cd ~/Dev/Alex
python3 -m http.server 8000
# open http://localhost:8000/street-model/
```

On GitHub Pages it works as-is.

Controls: drag to orbit, scroll to zoom, **Ride along** flies the camera down the real path, **Drawn** switches to blueprint-colored dots, **Path** toggles the orange route. Add `?drawn=1` or `?at=0.3` (0–1 along the ride) to the URL for stills.

`street-points.ply` is the raw COLMAP point cloud (not re-oriented) for Blender, MeshLab or CloudCompare.

## How it was made

1. `tools/grab-frames.sh` plays the 360 video in headless Chrome and saves 100 evenly spaced frames.
2. `tools/run_sfm.py` cuts each frame into 5 normal camera views (front and sides, skipping the backward view where the rider and selfie stick are), then runs COLMAP (via `pycolmap`): SIFT features, sequential matching, incremental mapping.
3. `tools/align.py` stands the model upright, points the ride forward, sets the scale and trims stray points into `street-model.json`.

Needs `pip install pycolmap numpy pillow`. The full run took about 12 minutes on an M1 Pro.

## Privacy

Before sharing publicly, check the point cloud for anything readable (house numbers, plates). At this density they aren't legible, but the source video shows them clearly.
