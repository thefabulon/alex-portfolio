"""Download OpenStreetMap data for the Wheelie Ride v2 map into tools/cache/.

Uses a public Overpass mirror. Each request is retried because the servers
often time out. Files that already exist are skipped, so it is safe to re-run.
"""
import os, sys, time, urllib.request, urllib.parse

API = "https://maps.mail.ru/osm/tools/overpass/api/interpreter"
UA = "wheelie-ride-map-builder/1.0 (school portfolio project)"
S, W, N, E = 33.47, -117.81, 33.66, -117.65
CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cache")


def fetch(name, query, tries=8):
    path = os.path.join(CACHE, name)
    if os.path.exists(path) and os.path.getsize(path) > 1000:
        return
    body = urllib.parse.urlencode({"data": query}).encode()
    for t in range(tries):
        try:
            req = urllib.request.Request(API, data=body, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=240) as r:
                data = r.read()
            if data.lstrip().startswith(b"{"):
                open(path, "wb").write(data)
                print(name, "ok", len(data), flush=True)
                return
        except Exception as e:  # noqa: BLE001 - any network failure means retry
            print(name, "try", t + 1, "failed:", e, flush=True)
        time.sleep(8 + t * 4)
    print(name, "GAVE UP", flush=True)


BB = f"{S},{W},{N},{E}"
HALF = (S + N) / 2
QUERIES = {
    # roads: big ones, then neighborhood streets in two halves (one query is too slow)
    "major.json": f'[out:json][timeout:180];way["highway"~"^(motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link)$"]({BB});out geom tags;',
    "res_south.json": f'[out:json][timeout:180];way["highway"~"^(residential|unclassified|living_street)$"]({S},{W},{HALF},{E});out geom tags;',
    "res_north.json": f'[out:json][timeout:180];way["highway"~"^(residential|unclassified|living_street)$"]({HALF},{W},{N},{E});out geom tags;',
    "coast.json": f'[out:json][timeout:180];way["natural"="coastline"]({BB});out geom;',
    "land.json": f'[out:json][timeout:180];(way["landuse"~"^(residential|commercial|retail|industrial)$"]({BB});way["leisure"~"^(park|golf_course)$"]({BB});way["natural"~"^(beach|sand)$"]({BB}););out geom tags;',
    # city limits, for the "Welcome to ..." sign (out geom, so the outlines come too)
    "admin.json": f'[out:json][timeout:180];relation["boundary"="administrative"]["admin_level"="8"]({BB});out geom;',
}


if __name__ == "__main__":
    os.makedirs(CACHE, exist_ok=True)
    for name, query in QUERIES.items():
        fetch(name, query)
    step = 0.032
    lat = S
    i = 0
    while lat < N:
        lon = W
        while lon < E:
            bb = f"{lat:.4f},{lon:.4f},{min(lat + step, N):.4f},{min(lon + step, E):.4f}"
            q = f'[out:json][timeout:180];way["building"]({bb});out tags geom;'
            fetch(f"bld_{i:02d}.json", q)
            i += 1
            lon += step
        lat += step
    print("done", i, "tiles")
