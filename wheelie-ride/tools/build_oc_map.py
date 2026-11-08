"""Build src/v2/oc-map.js: the real-world map for Wheelie Ride v2.

Run fetch_osm.py first (it downloads into tools/cache/), then:

    python3 tools/build_oc_map.py

Sources
  * Roads, buildings, coastline, land use, landmarks: OpenStreetMap
    (c) OpenStreetMap contributors, ODbL. Downloaded through Overpass.
  * Elevation: AWS Terrain Tiles ("terrarium" PNGs; USGS, SRTM, ETOPO and
    others, via Mapzen). Downloaded here and cached.

World space: metres. +x is east, +z is south (three.js looks down -z, so
north is "forward"), y is height above sea level. The origin is the middle
of the map box.

Everything heavy is packed as little-endian typed arrays, gzipped and
base64'd, so the browser can unpack it with DecompressionStream.
"""
import base64
import glob
import gzip
import json
import math
import os
import random
import urllib.request
from array import array

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "cache")
OUT = os.path.join(HERE, "..", "src", "v2", "oc-map.js")

# Map box: Laguna Hills and the 5/405 in the north, Dana Point in the south,
# Laguna Beach on the west, Mission Viejo on the east.
S, W, N, E = 33.47, -117.81, 33.66, -117.65
LAT0, LON0 = (S + N) / 2, (W + E) / 2
_phi = math.radians(LAT0)
M_LAT = 111132.92 - 559.82 * math.cos(2 * _phi) + 1.175 * math.cos(4 * _phi)
M_LON = 111412.84 * math.cos(_phi) - 93.5 * math.cos(3 * _phi)


def proj(lat, lon):
    return (lon - LON0) * M_LON, -(lat - LAT0) * M_LAT


def unproj(x, z):
    return LAT0 - z / M_LAT, LON0 + x / M_LON


CELL = 30  # terrain grid spacing, metres
_x0, _z0 = proj(N, W)
_x1, _z1 = proj(S, E)
X0 = math.floor(_x0 / CELL) * CELL
Z0 = math.floor(_z0 / CELL) * CELL
NX = int(math.ceil((_x1 - X0) / CELL)) + 1
NZ = int(math.ceil((_z1 - Z0) / CELL)) + 1

rng = random.Random(405)


def smoothstep(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def pack(arr):
    return base64.b64encode(gzip.compress(arr.tobytes(), 9)).decode("ascii")


def pack_json(obj):
    return base64.b64encode(gzip.compress(json.dumps(obj, separators=(",", ":")).encode(), 9)).decode("ascii")


def load(name):
    with open(os.path.join(CACHE, name)) as f:
        return json.load(f)


# ---------------------------------------------------------------------------
# Elevation (terrarium tiles: height = R*256 + G + B/256 - 32768 metres)
# ---------------------------------------------------------------------------
ZOOM = 13


def tile_xy(lat, lon):
    n = 2 ** ZOOM
    x = (lon + 180) / 360 * n
    lr = math.radians(lat)
    y = (1 - math.log(math.tan(lr) + 1 / math.cos(lr)) / math.pi) / 2 * n
    return x, y


def load_dem():
    tx0, ty0 = tile_xy(N + 0.01, W - 0.01)
    tx1, ty1 = tile_xy(S - 0.01, E + 0.01)
    tiles = {}
    for tx in range(int(tx0), int(tx1) + 1):
        for ty in range(int(ty0), int(ty1) + 1):
            path = os.path.join(CACHE, f"dem_{ZOOM}_{tx}_{ty}.png")
            if not os.path.exists(path):
                url = f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{ZOOM}/{tx}/{ty}.png"
                print("download", url)
                with urllib.request.urlopen(url, timeout=60) as r:
                    open(path, "wb").write(r.read())
            img = Image.open(path).convert("RGB")
            data = img.getdata()
            tiles[(tx, ty)] = [r * 256 + g + b / 256 - 32768 for (r, g, b) in data]
    return tiles


def dem_sampler(tiles):
    def px(gx, gy):
        tx, ty = gx // 256, gy // 256
        t = tiles.get((tx, ty))
        if t is None:
            return 0.0
        return t[(gy % 256) * 256 + (gx % 256)]

    def sample(lat, lon):
        x, y = tile_xy(lat, lon)
        fx, fy = x * 256 - 0.5, y * 256 - 0.5
        ix, iy = int(math.floor(fx)), int(math.floor(fy))
        u, v = fx - ix, fy - iy
        a, b = px(ix, iy), px(ix + 1, iy)
        c, d = px(ix, iy + 1), px(ix + 1, iy + 1)
        return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v

    return sample


# ---------------------------------------------------------------------------
# Roads
# ---------------------------------------------------------------------------
KINDS = ["motorway", "motorway_link", "trunk", "trunk_link", "primary", "primary_link",
         "secondary", "secondary_link", "tertiary", "tertiary_link",
         "residential", "unclassified", "living_street"]
MAJOR = {"motorway", "trunk", "primary", "secondary", "tertiary"}
DEFAULT_MPH = {"motorway": 65, "trunk": 55, "primary": 45, "secondary": 40, "tertiary": 35,
               "residential": 25, "unclassified": 25, "living_street": 15}
INNER = (S + 0.0004, W + 0.0004, N - 0.0004, E - 0.0004)


def fmt_ref(ref):
    if not ref:
        return ""
    ref = ref.split(";")[0].strip()
    parts = ref.split(" ")
    if parts[0] in ("I", "CA", "US", "SR") and len(parts) >= 2:
        rest = " ".join(parts[2:])
        return f"{parts[0]}-{parts[1]}" + (f" {rest}" if rest else "")
    return ref


def parse_int(s, default):
    try:
        return int(str(s).split(";")[0].strip())
    except (TypeError, ValueError):
        return default


def lanes_and_width(kind, tags, oneway):
    base = kind.replace("_link", "")
    link = kind.endswith("_link")
    if kind == "motorway":
        lanes = parse_int(tags.get("lanes"), 4)
        return lanes, lanes * 3.7 + 4.5
    if link:
        lanes = parse_int(tags.get("lanes"), 1)
        return lanes, lanes * 3.6 + 2.4
    if base in ("residential", "unclassified"):
        lanes = parse_int(tags.get("lanes"), 2)
        return lanes, max(9.5, lanes * 3.4 + 3)  # curb to curb, with parked cars
    if base == "living_street":
        return 1, 6.5
    default = {"trunk": 2, "primary": 3, "secondary": 2, "tertiary": 1}[base]
    lanes = parse_int(tags.get("lanes"), default if oneway else default * 2)
    return lanes, lanes * 3.6 + (1.6 if oneway else 2.4)


def douglas_peucker(pts, keep, tol):
    """Simplify a polyline but never drop indices in `keep`."""
    n = len(pts)
    if n < 3:
        return list(range(n))
    out = {0, n - 1} | {i for i in keep if 0 <= i < n}
    anchors = sorted(out)
    for a, b in zip(anchors, anchors[1:]):
        stack = [(a, b)]
        while stack:
            i, j = stack.pop()
            if j - i < 2:
                continue
            ax, az = pts[i]
            bx, bz = pts[j]
            dx, dz = bx - ax, bz - az
            L = math.hypot(dx, dz) or 1e-9
            best, bi = -1, -1
            for k in range(i + 1, j):
                px, pz = pts[k]
                d = abs((px - ax) * dz - (pz - az) * dx) / L
                if d > best:
                    best, bi = d, k
            if best > tol:
                out.add(bi)
                stack.append((i, bi))
                stack.append((bi, j))
    return sorted(out)


def load_roads():
    raw = {}
    for f in ["major.json"] + sorted(glob.glob(os.path.join(CACHE, "res_*.json"))):
        for e in load(os.path.basename(f))["elements"]:
            if e["type"] == "way" and e.get("geometry"):
                raw[e["id"]] = e
    print("ways downloaded", len(raw))

    # Split each way into runs of points inside the map box.
    runs = []
    for e in raw.values():
        tags = e["tags"]
        kind = tags.get("highway")
        if kind not in KINDS:
            continue
        if tags.get("access") in ("private", "no") and kind in ("residential", "unclassified"):
            pass  # gated communities are still real streets; keep them
        geom = [(g["lat"], g["lon"]) for g in e["geometry"]]
        ow = tags.get("oneway")
        oneway = ow in ("yes", "true", "1", "-1") or tags.get("junction") == "roundabout" or \
            (kind in ("motorway", "motorway_link") and ow != "no")
        if ow == "-1":
            geom.reverse()
        run = []
        for lat, lon in geom:
            inside = INNER[0] < lat < INNER[2] and INNER[1] < lon < INNER[3]
            if inside:
                run.append((lat, lon))
            elif run:
                if len(run) > 1:
                    runs.append((e, kind, oneway, run))
                run = []
        if len(run) > 1:
            runs.append((e, kind, oneway, run))

    # Junctions: any point (exact coordinates) used by two or more runs.
    count = {}
    for _, _, _, run in runs:
        for i, p in enumerate(run):
            count[p] = count.get(p, 0) + 1
    return runs, count


# ---------------------------------------------------------------------------
# Spatial hash for segments (roads, coastline)
# ---------------------------------------------------------------------------
class SegHash:
    def __init__(self, size):
        self.size = size
        self.cells = {}

    def add(self, ax, az, bx, bz, data):
        s = self.size
        for cx in range(int(math.floor(min(ax, bx) / s)), int(math.floor(max(ax, bx) / s)) + 1):
            for cz in range(int(math.floor(min(az, bz) / s)), int(math.floor(max(az, bz) / s)) + 1):
                self.cells.setdefault((cx, cz), []).append((ax, az, bx, bz, data))

    def near(self, x, z, r):
        s = self.size
        seen = set()
        for cx in range(int(math.floor((x - r) / s)), int(math.floor((x + r) / s)) + 1):
            for cz in range(int(math.floor((z - r) / s)), int(math.floor((z + r) / s)) + 1):
                for seg in self.cells.get((cx, cz), ()):
                    if id(seg) not in seen:
                        seen.add(id(seg))
                        yield seg


def seg_dist(px, pz, ax, az, bx, bz):
    dx, dz = bx - ax, bz - az
    L2 = dx * dx + dz * dz
    t = 0.0 if L2 == 0 else max(0.0, min(1.0, ((px - ax) * dx + (pz - az) * dz) / L2))
    qx, qz = ax + dx * t, az + dz * t
    return math.hypot(px - qx, pz - qz), t


# ---------------------------------------------------------------------------
# Grid helpers
# ---------------------------------------------------------------------------
def vidx(i, j):
    return j * NX + i


def vpos(i, j):
    return X0 + i * CELL, Z0 + j * CELL


def fill_polygon(poly, mark):
    """Scanline-fill a polygon (list of (x, z)) onto the vertex grid."""
    zs = [p[1] for p in poly]
    j0 = max(0, int(math.ceil((min(zs) - Z0) / CELL)))
    j1 = min(NZ - 1, int(math.floor((max(zs) - Z0) / CELL)))
    n = len(poly)
    for j in range(j0, j1 + 1):
        z = Z0 + j * CELL
        xs = []
        for k in range(n):
            ax, az = poly[k]
            bx, bz = poly[(k + 1) % n]
            if (az <= z < bz) or (bz <= z < az):
                xs.append(ax + (z - az) * (bx - ax) / (bz - az))
        xs.sort()
        for a, b in zip(xs[0::2], xs[1::2]):
            i0 = max(0, int(math.ceil((a - X0) / CELL)))
            i1 = min(NX - 1, int(math.floor((b - X0) / CELL)))
            for i in range(i0, i1 + 1):
                mark(vidx(i, j))


def point_in_poly(x, z, poly):
    inside = False
    n = len(poly)
    for k in range(n):
        ax, az = poly[k]
        bx, bz = poly[(k + 1) % n]
        if (az > z) != (bz > z) and x < ax + (z - az) * (bx - ax) / (bz - az):
            inside = not inside
    return inside


# Ground types (one per terrain vertex)
CHAPARRAL, DRYGRASS, LAWN, SAND, ROCK, URBAN, SEABED, PARK = range(8)


def main():
    print(f"grid {NX} x {NZ} = {NX * NZ} vertices, cell {CELL} m")

    # --- Elevation --------------------------------------------------------
    dem = dem_sampler(load_dem())
    H = array("f", [0.0]) * (NX * NZ)
    for j in range(NZ):
        for i in range(NX):
            lat, lon = unproj(*vpos(i, j))
            H[vidx(i, j)] = dem(lat, lon)
    print("elevation sampled")

    # --- Coastline: water on the right of each way --------------------------
    coast = SegHash(150)
    for e in load("coast.json")["elements"]:
        pts = [proj(g["lat"], g["lon"]) for g in e.get("geometry", [])]
        for a, b in zip(pts, pts[1:]):
            coast.add(a[0], a[1], b[0], b[1], None)
    T = array("B", [CHAPARRAL]) * (NX * NZ)
    coast_d = array("f", [1e9]) * (NX * NZ)
    water = bytearray(NX * NZ)
    band = bytearray(NX * NZ)
    BAND = 240
    for j in range(NZ):
        for i in range(NX):
            x, z = vpos(i, j)
            best, side = 1e9, 0
            for ax, az, bx, bz, _ in coast.near(x, z, BAND):
                d, _t = seg_dist(x, z, ax, az, bx, bz)
                if d < best:
                    # cross product in (east, north): left of the way is land
                    cross = (bx - ax) * (-(z - az)) - (-(bz - az)) * (x - ax)
                    best, side = d, (1 if cross > 0 else -1)
            v = vidx(i, j)
            if best < BAND:
                coast_d[v] = best
                band[v] = 1
                water[v] = 1 if side < 0 else 0
    # The elevation tiles store the sea as 0 m, the same as a beach, so they
    # can't tell sea from land. Flood out from water we know is on the sea
    # side of the coastline, across connected sea-level ground. The land side
    # of the coastline band works as a wall, so the flood can't leak inland.
    from collections import deque
    steps = array("H", [0]) * (NX * NZ)
    q = deque(v for v in range(NX * NZ) if water[v])
    while q:
        v = q.popleft()
        i, j = v % NX, v // NX
        for ni, nj in ((i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1)):
            if 0 <= ni < NX and 0 <= nj < NZ:
                nv = vidx(ni, nj)
                if not band[nv] and not water[nv] and H[nv] <= 30:  # real offshore rocks here are tiny
                    water[nv] = 1
                    steps[nv] = min(65000, steps[v] + 1)
                    q.append(nv)
    for v in range(NX * NZ):
        if water[v]:
            T[v] = SEABED
            out = coast_d[v] if band[v] else BAND + steps[v] * CELL
            H[v] = min(H[v], -1.2 - min(out, 1500) * 0.03)
        else:
            H[v] = max(H[v], 0.5 + min(coast_d[v], 60) * 0.03)
    print("coastline applied")

    # --- Land use -----------------------------------------------------------
    land = load("land.json")["elements"]
    urban_polys = []
    for e in land:
        g = e.get("geometry")
        if not g or len(g) < 4:
            continue
        poly = [proj(p["lat"], p["lon"]) for p in g]
        t = e.get("tags", {})
        lu, le, na = t.get("landuse"), t.get("leisure"), t.get("natural")
        if lu == "residential":
            kind = LAWN
        elif lu in ("commercial", "retail", "industrial"):
            kind = URBAN
            urban_polys.append(poly)
        elif le in ("park", "golf_course"):
            kind = PARK
        elif na in ("beach", "sand"):
            kind = SAND
        else:
            continue

        def mark(v, kind=kind):
            if T[v] != SEABED:
                T[v] = kind
        fill_polygon(poly, mark)

    # Beaches along the coast, cliffs on steep slopes, dry grass on gentle wild ground.
    for j in range(1, NZ - 1):
        for i in range(1, NX - 1):
            v = vidx(i, j)
            if T[v] == SEABED:
                continue
            gx = (H[vidx(i + 1, j)] - H[vidx(i - 1, j)]) / (2 * CELL)
            gz = (H[vidx(i, j + 1)] - H[vidx(i, j - 1)]) / (2 * CELL)
            slope = math.hypot(gx, gz)
            if coast_d[v] < 75 and H[v] < 9:
                T[v] = SAND
            elif slope > 0.75:
                T[v] = ROCK
            elif T[v] == CHAPARRAL and slope < 0.12 and rng.random() < 0.85:
                T[v] = DRYGRASS
    print("ground types")

    # --- Roads ----------------------------------------------------------------
    runs, count = load_roads()
    strings, sidx = [], {}

    def sid(s):
        if s not in sidx:
            sidx[s] = len(strings)
            strings.append(s)
        return sidx[s]

    sid("")
    roads = []
    junction_pts = {}  # (lat, lon) -> list of (road index, point index)
    road_hash = SegHash(60)
    for e, kind, oneway, run in runs:
        tags = e["tags"]
        pts = [proj(lat, lon) for lat, lon in run]
        keep = [i for i, p in enumerate(run) if count.get(p, 0) > 1]
        tol = 0.7 if kind.startswith("motorway") else 1.2
        idx = douglas_peucker(pts, keep, tol)
        run = [run[i] for i in idx]
        pts = [pts[i] for i in idx]
        lanes, width = lanes_and_width(kind, tags, oneway)
        mph = parse_int((tags.get("maxspeed") or "").replace("mph", ""), DEFAULT_MPH[kind.replace("_link", "")])
        if kind.endswith("_link"):
            mph = min(mph, 35)
        flags = (1 if oneway else 0) | (2 if tags.get("bridge") in ("yes", "viaduct") else 0) | \
                (4 if tags.get("tunnel") == "yes" else 0)
        r = len(roads)
        name = tags.get("name") or ""
        ref = fmt_ref(tags.get("ref"))
        dest = tags.get("destination") or tags.get("exit_to") or ""
        dest_ref = fmt_ref(tags.get("destination:ref"))
        roads.append({"k": KINDS.index(kind), "n": sid(name), "r": sid(ref), "l": lanes,
                      "w": width, "f": flags, "s": mph, "pts": pts, "ll": run,
                      "dest": dest, "dref": dest_ref, "jr": tags.get("junction:ref", "")})
        for pi, p in enumerate(run):
            if count.get(p, 0) > 1:
                junction_pts.setdefault(p, []).append((r, pi))
        for (ax, az), (bx, bz) in zip(pts, pts[1:]):
            road_hash.add(ax, az, bx, bz, r)
    print("roads kept", len(roads), "points", sum(len(r["pts"]) for r in roads))

    # --- Grade the ground along every road ---------------------------------------
    best = array("f", [1e9]) * (NX * NZ)
    target = array("f", [0.0]) * (NX * NZ)
    verge = array("B", [0]) * (NX * NZ)  # 1: closest road is a landscaped parkway, 2: a freeway
    FALLOFF = 26.0

    def hgrid(x, z):
        fi, fj = (x - X0) / CELL, (z - Z0) / CELL
        i, j = max(0, min(NX - 2, int(fi))), max(0, min(NZ - 2, int(fj)))
        u, w = min(1, max(0, fi - i)), min(1, max(0, fj - j))
        a, b = H[vidx(i, j)], H[vidx(i + 1, j)]
        c, d = H[vidx(i, j + 1)], H[vidx(i + 1, j + 1)]
        return (a * (1 - u) + b * u) * (1 - w) + (c * (1 - u) + d * u) * w

    for road in roads:
        # densify to ~10 m and smooth the height profile along the road
        dense = []
        for (ax, az), (bx, bz) in zip(road["pts"], road["pts"][1:]):
            n = max(1, int(math.hypot(bx - ax, bz - az) / 10))
            for k in range(n):
                t = k / n
                dense.append((ax + (bx - ax) * t, az + (bz - az) * t))
        dense.append(road["pts"][-1])
        raw = [max(0.9, hgrid(x, z)) for x, z in dense]
        kind = KINDS[road["k"]]
        win = 9 if kind.startswith("motorway") else 6 if kind.replace("_link", "") in MAJOR else 3
        prof = []
        for i in range(len(raw)):
            a, b = max(0, i - win), min(len(raw), i + win + 1)
            prof.append(sum(raw[a:b]) / (b - a))
        if road["f"] & 2:  # bridge: straight line between the ends
            h0, h1 = prof[0], prof[-1]
            prof = [h0 + (h1 - h0) * i / max(1, len(prof) - 1) for i in range(len(prof))]
        hw = road["w"] / 2
        R = hw + FALLOFF
        parkway = 1 if kind in ("trunk", "primary", "secondary", "tertiary") else 2 if kind.startswith("motorway") else 0
        for k in range(len(dense) - 1):
            (ax, az), (bx, bz) = dense[k], dense[k + 1]
            i0 = max(0, int(math.floor((min(ax, bx) - R - X0) / CELL)))
            i1 = min(NX - 1, int(math.ceil((max(ax, bx) + R - X0) / CELL)))
            j0 = max(0, int(math.floor((min(az, bz) - R - Z0) / CELL)))
            j1 = min(NZ - 1, int(math.ceil((max(az, bz) + R - Z0) / CELL)))
            for j in range(j0, j1 + 1):
                for i in range(i0, i1 + 1):
                    x, z = vpos(i, j)
                    d, t = seg_dist(x, z, ax, az, bx, bz)
                    score = d - hw
                    v = vidx(i, j)
                    if score < best[v]:
                        best[v] = score
                        target[v] = prof[k] + (prof[k + 1] - prof[k]) * t
                        verge[v] = parkway
    for v in range(NX * NZ):
        if best[v] < FALLOFF:
            w = 1.0 - smoothstep(3.0, FALLOFF, best[v])
            H[v] = H[v] + (target[v] - H[v]) * w
            if best[v] < 2 and T[v] in (SEABED, SAND, ROCK):
                T[v] = URBAN if T[v] != SAND else SAND
            elif best[v] < 9 and verge[v] == 2 and T[v] != SAND:
                T[v] = URBAN  # concrete shoulders and medians between freeway lanes
            elif best[v] < 12 and verge[v] == 1 and T[v] != SAND:
                T[v] = LAWN  # landscaped medians and parkways
    print("ground graded along roads")

    # --- Buildings --------------------------------------------------------------
    blds = {}
    have_tiles = []
    step = 0.032
    lat, ti = S, 0
    while lat < N:
        lon = W
        while lon < E:
            path = os.path.join(CACHE, f"bld_{ti:02d}.json")
            if os.path.exists(path) and os.path.getsize(path) > 200:
                have_tiles.append((lat, lon, min(lat + step, N), min(lon + step, E)))
                for e in load(os.path.basename(path))["elements"]:
                    if e["type"] == "way" and e.get("geometry"):
                        blds[e["id"]] = e
            ti += 1
            lon += step
        lat += step
    print("building tiles", len(have_tiles), "of", ti, "buildings", len(blds))

    def tile_covered(lat, lon):
        return any(a <= lat < c and b <= lon < d for a, b, c, d in have_tiles)

    HOUSE, APARTMENT, COMMERCIAL, SHED, CIVIC = range(5)
    KIND_OF = {
        "house": HOUSE, "residential": HOUSE, "detached": HOUSE, "semidetached_house": HOUSE,
        "terrace": APARTMENT, "apartments": APARTMENT, "dormitory": APARTMENT,
        "commercial": COMMERCIAL, "retail": COMMERCIAL, "office": COMMERCIAL, "industrial": COMMERCIAL,
        "warehouse": COMMERCIAL, "supermarket": COMMERCIAL, "hotel": CIVIC, "school": CIVIC,
        "university": CIVIC, "college": CIVIC, "hospital": CIVIC, "church": CIVIC, "civic": CIVIC,
        "public": CIVIC, "government": CIVIC, "fire_station": CIVIC,
        "garage": SHED, "garages": SHED, "carport": SHED, "shed": SHED, "roof": SHED, "hut": SHED,
    }

    def hull(points):
        pts = sorted(set(points))
        if len(pts) < 3:
            return pts

        def cr(o, a, b):
            return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
        lo, up = [], []
        for p in pts:
            while len(lo) >= 2 and cr(lo[-2], lo[-1], p) <= 0:
                lo.pop()
            lo.append(p)
        for p in reversed(pts):
            while len(up) >= 2 and cr(up[-2], up[-1], p) <= 0:
                up.pop()
            up.append(p)
        return lo[:-1] + up[:-1]

    out_b = []  # (x, z, w, d, angle, height, kind)
    bld_hash = {}
    BH = 40

    def add_building(x, z, w, d, ang, h, kind):
        out_b.append((x, z, w, d, ang, h, kind))
        r = math.hypot(w, d) / 2
        for cx in range(int((x - r) // BH), int((x + r) // BH) + 1):
            for cz in range(int((z - r) // BH), int((z + r) // BH) + 1):
                bld_hash.setdefault((cx, cz), []).append(len(out_b) - 1)

    def in_building(x, z, pad=0.0):
        for k in bld_hash.get((int(x // BH), int(z // BH)), ()):
            bx, bz, w, d, ang, _h, _k = out_b[k]
            c, s = math.cos(ang), math.sin(ang)
            dx, dz = x - bx, z - bz
            u, v = dx * c + dz * s, -dx * s + dz * c
            if abs(u) < w / 2 + pad and abs(v) < d / 2 + pad:
                return True
        return False

    def footprint(e):
        pts = [proj(p["lat"], p["lon"]) for p in e["geometry"]]
        return pts, abs(sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(pts, pts[1:] + pts[:1]))) / 2

    shapes = [(e, *footprint(e)) for e in blds.values() if len(e["geometry"]) >= 4]
    shapes.sort(key=lambda t: -t[2])  # biggest first
    stacked = 0
    for e, pts, area in shapes:
        if area < 12:
            continue
        cx0 = sum(p[0] for p in pts) / len(pts)
        cz0 = sum(p[1] for p in pts) / len(pts)
        if in_building(cx0, cz0, -0.5):
            stacked += 1  # OpenStreetMap sometimes has a building drawn twice, or parts inside a bigger outline
            continue
        hp = hull(pts)
        bestA = None
        for a, b in zip(hp, hp[1:] + hp[:1]):
            ang = math.atan2(b[1] - a[1], b[0] - a[0])
            c, s = math.cos(ang), math.sin(ang)
            us = [p[0] * c + p[1] * s for p in hp]
            vs = [-p[0] * s + p[1] * c for p in hp]
            A = (max(us) - min(us)) * (max(vs) - min(vs))
            if bestA is None or A < bestA[0]:
                cu, cv = (max(us) + min(us)) / 2, (max(vs) + min(vs)) / 2
                bestA = (A, ang, max(us) - min(us), max(vs) - min(vs), cu * c - cv * s, cu * s + cv * c)
        _, ang, w, d, cx, cz = bestA
        t = e.get("tags", {})
        btype = t.get("building", "yes")
        kind = KIND_OF.get(btype)
        if kind is None:
            kind = HOUSE if area < 380 else COMMERCIAL
        hgt = None
        if "height" in t:
            try:
                hgt = float(str(t["height"]).split()[0].replace("m", ""))
            except ValueError:
                hgt = None
        if hgt is None and "building:levels" in t:
            hgt = parse_int(t["building:levels"], 1) * 3.1 + (1.8 if kind in (HOUSE, APARTMENT) else 0.6)
        if hgt is None:
            hgt = {HOUSE: rng.choice([4.6, 5.2, 7.4, 7.8, 8.0]), APARTMENT: rng.uniform(8.5, 11.5),
                   COMMERCIAL: rng.uniform(6.5, 11), SHED: 3.0, CIVIC: rng.uniform(8, 13)}[kind]
            if area > 3000:
                hgt += rng.uniform(0, 5)
        add_building(cx, cz, w, d, ang % math.pi, min(hgt, 60), kind)
    n_osm = len(out_b)
    print("skipped", stacked, "buildings stacked inside bigger ones")

    # Houses along residential streets where the building download is missing.
    for road in roads:
        if KINDS[road["k"]] not in ("residential", "living_street"):
            continue
        lat, lon = road["ll"][0]
        if tile_covered(lat, lon):
            continue
        hw = road["w"] / 2
        for (ax, az), (bx, bz) in zip(road["pts"], road["pts"][1:]):
            L = math.hypot(bx - ax, bz - az)
            if L < 18:
                continue
            ux, uz = (bx - ax) / L, (bz - az) / L
            ang = math.atan2(uz, ux)
            s = 9.0
            while s < L - 9:
                for side in (-1, 1):
                    depth = rng.uniform(14, 18)
                    off = hw + 6 + depth / 2
                    x = ax + ux * s - uz * off * side
                    z = az + uz * s + ux * off * side
                    if near_road(road_hash, roads, x, z, depth / 2 + 3) or in_building(x, z, 4):
                        continue
                    add_building(x, z, rng.uniform(13, 18), depth, ang % math.pi,
                                 rng.choice([4.6, 5.2, 7.4, 7.8]), HOUSE)
                s += rng.uniform(19, 24)
    print("buildings", n_osm, "from OSM +", len(out_b) - n_osm, "filled in")

    # Ground around buildings: yards around homes, paving around shops and offices.
    # (Where OpenStreetMap has no land-use outline, the ground would otherwise
    # look like wild hillside.)
    for (x, z, w, d, ang, h, kind) in out_b:
        paved = kind in (COMMERCIAL, CIVIC)
        r = max(w, d) / 2 + (28 if paved else 16)
        i0, i1 = max(0, int((x - r - X0) // CELL)), min(NX - 1, int((x + r - X0) // CELL) + 1)
        j0, j1 = max(0, int((z - r - Z0) // CELL)), min(NZ - 1, int((z + r - Z0) // CELL) + 1)
        for j in range(j0, j1 + 1):
            for i in range(i0, i1 + 1):
                v = vidx(i, j)
                if T[v] in (CHAPARRAL, DRYGRASS) and math.hypot(X0 + i * CELL - x, Z0 + j * CELL - z) < r:
                    T[v] = URBAN if paved else LAWN

    # --- Trees ---------------------------------------------------------------
    FAN_PALM, QUEEN_PALM, BROADLEAF, PINE, EUCALYPTUS, CYPRESS = range(6)
    trees = []

    def try_tree(x, z, kind, scale, clear=2.5):
        i, j = int(round((x - X0) / CELL)), int(round((z - Z0) / CELL))
        if not (0 <= i < NX and 0 <= j < NZ) or T[vidx(i, j)] == SEABED:
            return False
        if near_road(road_hash, roads, x, z, clear) or in_building(x, z, 1.5):
            return False
        trees.append((x, z, kind, scale))
        return True

    # Parkway palms and street trees.
    for road in roads:
        kind = KINDS[road["k"]]
        base = kind.replace("_link", "")
        if base not in ("trunk", "primary", "secondary", "tertiary") or kind.endswith("_link"):
            continue
        hw = road["w"] / 2
        lat, lon = road["ll"][0]
        coastal = lon < -117.755
        palm_share = 0.75 if coastal else 0.55
        for (ax, az), (bx, bz) in zip(road["pts"], road["pts"][1:]):
            L = math.hypot(bx - ax, bz - az)
            if L < 4:
                continue
            ux, uz = (bx - ax) / L, (bz - az) / L
            s = rng.uniform(4, 16)
            while s < L:
                for side in (-1, 1):
                    if rng.random() < 0.3:
                        continue
                    off = hw + rng.uniform(2.6, 4.2)
                    x, z = ax + ux * s - uz * off * side, az + uz * s + ux * off * side
                    r = rng.random()
                    if r < palm_share:
                        k = FAN_PALM if rng.random() < 0.6 else QUEEN_PALM
                    elif r < palm_share + 0.15:
                        k = EUCALYPTUS
                    else:
                        k = BROADLEAF
                    try_tree(x, z, k, rng.uniform(0.85, 1.25), clear=1.8)
                s += rng.uniform(14, 26)

    # Yard trees, one or two per house.
    for (x, z, w, d, ang, h, kind) in list(out_b):
        if kind != HOUSE or rng.random() < 0.35:
            continue
        for _ in range(1 + (rng.random() < 0.35)):
            a = rng.uniform(0, math.tau)
            r = math.hypot(w, d) / 2 + rng.uniform(2.5, 6)
            k = rng.choices([FAN_PALM, QUEEN_PALM, BROADLEAF, PINE, CYPRESS], [3, 2, 5, 1.5, 1])[0]
            try_tree(x + math.cos(a) * r, z + math.sin(a) * r, k, rng.uniform(0.75, 1.15), clear=3)

    # Parks: scattered shade trees.
    for j in range(0, NZ, 2):
        for i in range(0, NX, 2):
            if T[vidx(i, j)] == PARK and rng.random() < 0.25:
                x, z = vpos(i, j)
                x += rng.uniform(-25, 25)
                z += rng.uniform(-25, 25)
                try_tree(x, z, rng.choice([BROADLEAF, BROADLEAF, PINE, EUCALYPTUS, FAN_PALM]),
                         rng.uniform(0.9, 1.4), clear=4)
    print("trees", len(trees))

    # --- Street-name signs where named roads meet ---------------------------------
    signs = []
    seen_pairs = []
    for p, members in junction_pts.items():
        names = {}
        for r, pi in members:
            road = roads[r]
            nm = strings[road["n"]]
            if not nm or KINDS[road["k"]].startswith("motorway") or KINDS[road["k"]].endswith("_link"):
                continue
            names.setdefault(nm, (r, pi))
        if len(names) < 2:
            continue
        items = sorted(names.items(), key=lambda kv: roads[kv[1][0]]["k"])
        (na, (ra, pa)), (nb, (rb, pb)) = items[0], items[1]
        if KINDS[roads[ra]["k"]].replace("_link", "") not in MAJOR and "Anita" not in na + nb:
            continue
        x, z = proj(*p)
        if any(abs(x - sx) < 70 and abs(z - sz) < 70 and {na, nb} == pair for sx, sz, pair in seen_pairs):
            continue
        seen_pairs.append((x, z, {na, nb}))

        def direction(road, pi):
            pts = road["pts"]
            a = pts[max(0, pi - 1)] if pi > 0 else pts[pi]
            b = pts[min(len(pts) - 1, pi + 1)]
            return math.atan2(b[1] - a[1], b[0] - a[0])
        angA = direction(roads[ra], pa)
        angB = direction(roads[rb], pb)
        # Stand on the far-right corner of road A, clear of both roads.
        for off in (1, -1):
            hw = max(roads[ra]["w"], roads[rb]["w"]) / 2 + 3.5
            sx = x + (math.cos(angA) + math.cos(angB)) * hw * off * 0.75 - math.sin(angA) * hw * off
            sz = z + (math.sin(angA) + math.sin(angB)) * hw * off * 0.75 + math.cos(angA) * hw * off
            if not near_road(road_hash, roads, sx, sz, 1.2):
                signs.append((sx, sz, angA, angB, roads[ra]["n"], roads[rb]["n"]))
                break
    print("street signs", len(signs))

    # --- Freeway signs: big green gantries before each exit ----------------------
    CONTROL = {("I-405", "N"): "Long Beach", ("I-405", "S"): "San Diego", ("I-5", "N"): "Santa Ana",
               ("I-5", "S"): "San Diego", ("CA-73", "N"): "Long Beach", ("CA-73", "S"): "San Juan Capistrano",
               ("CA-73 Toll", "N"): "Long Beach", ("CA-73 Toll", "S"): "San Juan Capistrano",
               ("CA-133", "N"): "Irvine", ("CA-133", "S"): "Laguna Beach"}

    def heading_letter(dx, dz):
        return "N" if abs(dz) >= abs(dx) and dz < 0 else "S" if abs(dz) >= abs(dx) else "E" if dx > 0 else "W"

    gantries = []
    for r, road in enumerate(roads):
        kind = KINDS[road["k"]]
        if kind not in ("motorway_link", "motorway"):
            continue
        start = road["ll"][0]
        members = junction_pts.get(start, [])
        # the motorway this road splits off from (the one that carries on through the point)
        parent = None
        for r2, p2 in members:
            if r2 != r and KINDS[roads[r2]["k"]] == "motorway" and p2 > 0:
                parent = (r2, p2)
        if parent is None:
            continue
        if kind == "motorway" and road["r"] == roads[parent[0]]["r"]:
            continue  # the same freeway carrying on
        r2, p2 = parent
        pts = roads[r2]["pts"]
        # walk back ~320 m along the parent
        need, k = 320.0, p2
        x, z = pts[k]
        while k > 0 and need > 0:
            ax, az = pts[k - 1]
            L = math.hypot(x - ax, z - az)
            if L >= need:
                t = need / L
                x, z = x + (ax - x) * t, z + (az - z) * t
                need = 0
                break
            need -= L
            k -= 1
            x, z = ax, az
        a = pts[max(0, k - 1)] if k > 0 else pts[0]
        b = pts[min(len(pts) - 1, k + 1)]
        ang = math.atan2(b[1] - a[1], b[0] - a[0])
        # what the sign says
        if kind == "motorway":
            ref = strings[road["r"]]
            last = road["pts"][-1]
            dirl = heading_letter(last[0] - road["pts"][0][0], last[1] - road["pts"][0][1])
            lines = [ref.replace("I-", "").replace("CA-", ""),
                     {"N": "NORTH", "S": "SOUTH", "E": "EAST", "W": "WEST"}[dirl],
                     CONTROL.get((ref, dirl), "")]
            style = "split"
        else:
            dest = road["dest"].replace(";", " / ")
            if not dest:
                end = road["ll"][-1]
                for r3, _ in junction_pts.get(end, []):
                    if r3 != r and strings[roads[r3]["n"]] and not KINDS[roads[r3]["k"]].startswith("motorway"):
                        dest = strings[roads[r3]["n"]]
                        break
            if not dest:
                continue
            lines = [road["jr"] and f"EXIT {road['jr']}" or "EXIT", dest, road["dref"]]
            style = "exit"
        gantries.append((x, z, ang, roads[r2]["w"], style, lines))
    print("freeway signs", len(gantries))

    # --- Landmarks ---------------------------------------------------------------
    LANDMARKS = [
        # name, lat, lon, model, note
        ("Anita Street Beach", 33.53477, -117.77806, "beach", "Stairs down to the sand at the end of Anita St"),
        ("Cheneys Point", 33.53697, -117.78061, "none", "The rocky point next to Anita Street Beach"),
        ("Hotel Laguna", 33.54108, -117.78298, "hotel_laguna", "Laguna Beach's oldest hotel, right on the sand"),
        ("Main Beach", 33.54031, -117.78529, "lifeguard", "Laguna's main beach and boardwalk"),
        ("Heisler Park", 33.54391, -117.79121, "gazebo", "Clifftop park with palm trees and ocean views"),
        ("Laguna Art Museum", 33.54351, -117.78823, "none", ""),
        ("Sawdust Art Festival", 33.5506, -117.77875, "none", ""),
        ("Pacific Marine Mammal Center", 33.57296, -117.76247, "none", "Seal and sea lion rescue on Laguna Canyon Rd"),
        ("Victoria Beach Pirate Tower", 33.52064, -117.76459, "pirate_tower", "A stone tower built into the cliff"),
        ("Montage Laguna Beach", 33.51485, -117.75687, "none", ""),
        ("Aliso Beach", 33.50876, -117.75187, "lifeguard", "Where Aliso Creek meets the ocean"),
        ("Table Rock Beach", 33.50181, -117.74614, "none", ""),
        ("Soka University", 33.55469, -117.7349, "none", "Aliso Viejo's hilltop university"),
        ("Aliso Viejo Town Center", 33.57452, -117.72575, "town_sign", ""),
        ("Aliso Viejo City Hall", 33.568, -117.72766, "none", ""),
        ("Aliso Viejo Community Park", 33.5786, -117.71455, "none", ""),
        ("Laguna Hills Mall", 33.61065, -117.70743, "town_sign", ""),
        ("Laguna Hills City Hall", 33.61313, -117.71179, "none", ""),
        ("Saddleback Memorial", 33.60852, -117.70928, "none", "Hospital in Laguna Hills"),
        ("Laguna Hills Community Center", 33.592, -117.70022, "none", ""),
        ("Laguna Niguel Regional Park", 33.5474, -117.7103, "none", ""),
        ("Crown Valley Community Park", 33.5306, -117.70893, "none", ""),
        ("Irvine Spectrum Giant Wheel", 33.64941, -117.74256, "giant_wheel", "The Ferris wheel you can see from the 405"),
        ("Laguna Beach High School", 33.54038, -117.77616, "none", ""),
    ]
    landmarks = [{"name": n, "x": round(proj(la, lo)[0], 1), "z": round(proj(la, lo)[1], 1), "model": m, "note": note}
                 for n, la, lo, m, note in LANDMARKS]

    # --- Start points --------------------------------------------------------------
    def nearest_on(name_part, lat, lon):
        tx, tz = proj(lat, lon)
        bestd, bestv = 1e18, None
        for road in roads:
            if name_part not in strings[road["n"]] and name_part not in strings[road["r"]]:
                continue
            pts = road["pts"]
            for k in range(len(pts) - 1):
                (ax, az), (bx, bz) = pts[k], pts[k + 1]
                d, t = seg_dist(tx, tz, ax, az, bx, bz)
                if d < bestd:
                    ang = math.atan2(bz - az, bx - ax)
                    bestd, bestv = d, (ax + (bx - ax) * t, az + (bz - az) * t, ang, road)
        return bestv

    SPAWNS = [
        ("Anita Street Beach · Coast Hwy", "Coast Highway", 33.5351, -117.7774, "PCH right at Anita St. Turn toward the ocean and go down to the sand."),
        ("Main Beach · Laguna Beach", "Coast Highway", 33.5425, -117.7843, ""),
        ("Laguna Canyon Rd · at the 405", "Laguna Canyon Road", 33.6455, -117.7545, "Ride south down the canyon to Laguna Beach."),
        ("La Paz Rd · Laguna Hills", "La Paz Road", 33.5995, -117.6960, "Next to the 5 freeway on-ramps."),
        ("Aliso Creek Rd · Aliso Viejo", "Aliso Creek Road", 33.5770, -117.7230, "By Aliso Viejo Town Center."),
        ("Pacific Park Dr · Aliso Viejo", "Pacific Park Drive", 33.5745, -117.7150, ""),
        ("Crown Valley Pkwy · Laguna Niguel", "Crown Valley Parkway", 33.5400, -117.6980, ""),
        ("I-405 North · El Toro Y", "I-405", 33.6400, -117.7320, "Freeway riding. Watch the traffic."),
    ]
    spawns = []
    for label, part, la, lo, tip in SPAWNS:
        hit = nearest_on(part, la, lo)
        if not hit:
            print("!! no road for spawn", label)
            continue
        x, z, ang, road = hit
        hw = road["w"] / 2
        if road["f"] & 1:
            off = hw * 0.5  # middle of the right half of a one-way road
        else:
            off = hw * 0.55  # right-hand side of a two-way road
        # move right of the road's centre line (right of direction (cos, sin) is (-sin, cos))
        x += -math.sin(ang) * off
        z += math.cos(ang) * off
        # The game's heading: 0 faces north (-z), turning left makes it bigger.
        heading = math.atan2(-math.cos(ang), -math.sin(ang))
        spawns.append({"name": label, "x": round(x, 1), "z": round(z, 1),
                       "heading": round(heading, 4), "tip": tip})

    # --- Cities (for the "where am I" label) --------------------------------------
    CG = 120
    cnx, cnz = int((NX - 1) * CELL / CG) + 1, int((NZ - 1) * CELL / CG) + 1
    city = array("B", [0]) * (cnx * cnz)
    city_names = [""]
    admin_path = os.path.join(CACHE, "admin.json")
    if os.path.exists(admin_path) and os.path.getsize(admin_path) > 1000:
        for rel in load("admin.json")["elements"]:
            nm = rel.get("tags", {}).get("name")
            if not nm:
                continue
            # stitch the outer ways into rings
            segs = [[(g["lat"], g["lon"]) for g in m.get("geometry", [])]
                    for m in rel.get("members", []) if m.get("role") == "outer" and m.get("geometry")]
            rings = stitch(segs)
            ci = len(city_names)
            city_names.append(nm)
            for ring in rings:
                poly = [proj(*p) for p in ring]
                xs, zs = [p[0] for p in poly], [p[1] for p in poly]
                for gj in range(cnz):
                    zz = Z0 + gj * CG
                    if not (min(zs) <= zz <= max(zs)):
                        continue
                    for gi in range(cnx):
                        xx = X0 + gi * CG
                        if min(xs) <= xx <= max(xs) and point_in_poly(xx, zz, poly):
                            city[gj * cnx + gi] = ci
        print("cities", city_names[1:])
    else:
        print("no admin.json yet: city label uses nearest city hall")
        halls = [("Laguna Beach", 33.54555, -117.78117), ("Aliso Viejo", 33.568, -117.72766),
                 ("Laguna Hills", 33.61313, -117.71179), ("Laguna Niguel", 33.52374, -117.71575),
                 ("Laguna Woods", 33.61052, -117.72346), ("Lake Forest", 33.65923, -117.67942),
                 ("Mission Viejo", 33.5967, -117.65978), ("Irvine", 33.6505, -117.7445),
                 ("Dana Point", 33.4672, -117.6981)]
        hp = [(proj(la, lo), n) for n, la, lo in halls]
        city_names += [n for n, _, _ in halls]
        for gj in range(cnz):
            for gi in range(cnx):
                xx, zz = X0 + gi * CG, Z0 + gj * CG
                k = min(range(len(hp)), key=lambda q: (hp[q][0][0] - xx) ** 2 + (hp[q][0][1] - zz) ** 2)
                city[gj * cnx + gi] = k + 1

    # --- Pack -----------------------------------------------------------------
    heights = array("h", [int(round(max(-3000, min(3000, h)) * 10)) for h in H])
    road_list = []
    for road in roads:
        flat = []
        px, pz = 0, 0
        for x, z in road["pts"]:
            qx, qz = int(round(x * 10)), int(round(z * 10))
            flat += [qx - px, qz - pz]
            px, pz = qx, qz
        road_list.append([road["k"], road["n"], road["r"], road["l"], round(road["w"], 1), road["f"], road["s"], flat])
    junctions = []
    for p, members in junction_pts.items():
        if len(members) > 1:
            flat = []
            for r, pi in members:
                flat += [r, pi]
            junctions.append(flat)
    bpack = array("h")
    for x, z, w, d, ang, h, kind in out_b:
        bpack.extend([int(round(x * 2)), int(round(z * 2)), int(round(w * 10)), int(round(d * 10)),
                      int(round(ang * 10000)), int(round(h * 10)), kind])
    tpack = array("h")
    for x, z, kind, scale in trees:
        tpack.extend([int(round(x * 2)), int(round(z * 2)), kind, int(round(scale * 100))])

    data = {
        "about": "Generated by tools/build_oc_map.py. Map data (c) OpenStreetMap contributors (ODbL). "
                 "Elevation: AWS Terrain Tiles (USGS, SRTM and others, via Mapzen).",
        "origin": {"lat": LAT0, "lon": LON0, "mLat": M_LAT, "mLon": M_LON},
        "grid": {"x0": X0, "z0": Z0, "nx": NX, "nz": NZ, "cell": CELL},
        "groundTypes": ["chaparral", "dry grass", "lawn", "sand", "rock", "urban", "seabed", "park"],
        "heights": pack(heights),
        "ground": pack(T),
        "strings": strings,
        "roadKinds": KINDS,
        "roads": pack_json(road_list),
        "junctions": pack_json(junctions),
        "buildings": pack(bpack),
        "buildingKinds": ["house", "apartment", "commercial", "shed", "civic"],
        "trees": pack(tpack),
        "treeKinds": ["fan palm", "queen palm", "broadleaf", "pine", "eucalyptus", "cypress"],
        "signs": [[round(x, 1), round(z, 1), round(a, 3), round(b, 3), na, nb] for x, z, a, b, na, nb in signs],
        "gantries": [[round(x, 1), round(z, 1), round(a, 3), round(w, 1), s, lines] for x, z, a, w, s, lines in gantries],
        "landmarks": landmarks,
        "spawns": spawns,
        "cities": {"cell": CG, "nx": cnx, "nz": cnz, "names": city_names, "grid": pack(city)},
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        f.write("// Generated by tools/build_oc_map.py. Do not edit by hand: re-run the script.\n")
        f.write("// Map data (c) OpenStreetMap contributors, ODbL. Elevation: AWS Terrain Tiles.\n")
        f.write("window.OC_MAP = ")
        json.dump(data, f, separators=(",", ":"))
        f.write(";\n")
    print("wrote", OUT, os.path.getsize(OUT) // 1024, "KB")


def near_road(road_hash, roads, x, z, clear):
    for ax, az, bx, bz, r in road_hash.near(x, z, 30):
        d, _ = seg_dist(x, z, ax, az, bx, bz)
        if d < roads[r]["w"] / 2 + clear:
            return True
    return False


def stitch(segs):
    """Join way pieces end to end into closed rings."""
    segs = [s for s in segs if len(s) > 1]
    rings = []
    while segs:
        ring = segs.pop(0)
        changed = True
        while changed and ring[0] != ring[-1]:
            changed = False
            for k, s in enumerate(segs):
                if s[0] == ring[-1]:
                    ring += s[1:]
                elif s[-1] == ring[-1]:
                    ring += s[::-1][1:]
                elif s[-1] == ring[0]:
                    ring = s[:-1] + ring
                elif s[0] == ring[0]:
                    ring = s[::-1][:-1] + ring
                else:
                    continue
                segs.pop(k)
                changed = True
                break
        if len(ring) > 3:
            rings.append(ring)
    return rings


if __name__ == "__main__":
    main()
