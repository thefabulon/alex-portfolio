// Wheelie Ride v2: the Orange County world.
//
// Everything here is built from window.OC_MAP, which tools/build_oc_map.py
// makes from OpenStreetMap (roads, buildings, coastline, land use, landmarks)
// and real elevation data. One unit is one metre. +x is east, +z is south,
// y is height above sea level.
//
// The map is cut into 960 m squares ("chunks"). Each chunk has its own
// terrain, road, building and tree meshes, and anything far from the camera
// is hidden, so only the neighbourhood around you is drawn.
(() => {
  'use strict';

  const TILE = 32;     // terrain cells per chunk (32 x 30 m = 960 m)
  const VIEW = {       // how far away (metres) each kind of thing is still drawn
    terrainHi: 1500, terrainLo: 7000, roads: 2200, marks: 650, walks: 500,
    buildings: 1800, roofs: 1500, trees: 850, bushes: 520, lamps: 450,
    signs: 280, gantries: 1300, labels: 1100,
  };
  const MAX_CARS = 70;

  // ---------------------------------------------------------------------------
  // Unpacking (the builder gzips and base64s the big arrays)
  // ---------------------------------------------------------------------------
  async function unpackBytes(b64) {
    const bin = atob(b64);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const stream = new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  const unpackJSON = async (b64) => JSON.parse(new TextDecoder().decode(await unpackBytes(b64)));
  const asInt16 = (u8) => new Int16Array(u8.buffer, u8.byteOffset, u8.byteLength >> 1);

  // Repeatable "random" numbers, so the same tree is always in the same place.
  function hash2(i, j) {
    let h = (Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function rng(seed) {
    let a = seed | 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pick = (r, list) => list[Math.floor(r() * list.length) % list.length];

  function canvasTexture(w, h, draw, { repeat = false, srgb = true } = {}) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    return t;
  }

  // Geometry builder: plain arrays in, one BufferGeometry out.
  class Buf {
    constructor() { this.pos = []; this.nor = []; this.col = []; this.uv = []; this.idx = []; }
    get count() { return this.pos.length / 3; }
    vert(x, y, z, nx, ny, nz, c, u = 0, v = 0) {
      this.pos.push(x, y, z);
      this.nor.push(nx, ny, nz);
      this.col.push(c.r, c.g, c.b);
      this.uv.push(u, v);
      return this.count - 1;
    }
    // Append a three.js geometry, moved by `matrix`, with one colour (or a
    // function of the vertex) and its UVs squeezed into an atlas `region`.
    add(geo, matrix, color, region = null) {
      const g = geo.index ? geo.toNonIndexed() : geo;
      const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
      const nm = new THREE.Matrix3().getNormalMatrix(matrix);
      const v = new THREE.Vector3(), vn = new THREE.Vector3();
      const base = this.count;
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(matrix);
        vn.fromBufferAttribute(n, i).applyMatrix3(nm).normalize();
        const c = typeof color === 'function' ? color(i, v) : color;
        let u = 0, w = 0;
        if (uv && region) {
          u = region[0] + (((uv.getX(i) % 1) + 1) % 1) * (region[2] - region[0]);
          w = region[1] + Math.min(1, Math.max(0, uv.getY(i))) * (region[3] - region[1]);
        }
        this.vert(v.x, v.y, v.z, vn.x, vn.y, vn.z, c, u, w);
        this.idx.push(base + i);
      }
    }
    quad(a, b, c, d, n, col, uvs) {
      // a b / c d, a-b along the bottom, c-d along the top
      const i0 = this.vert(...a, ...n, col, ...(uvs ? uvs[0] : [0, 0]));
      const i1 = this.vert(...b, ...n, col, ...(uvs ? uvs[1] : [0, 0]));
      const i2 = this.vert(...c, ...n, col, ...(uvs ? uvs[2] : [0, 0]));
      const i3 = this.vert(...d, ...n, col, ...(uvs ? uvs[3] : [0, 0]));
      this.idx.push(i0, i1, i2, i1, i3, i2);
    }
    // Leave out colours or UVs a material doesn't use: it saves a lot of
    // graphics memory on the big road and sidewalk meshes.
    geometry({ color = true, uv = true } = {}) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
      if (color) g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
      if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
      g.setIndex(this.idx);
      g.computeBoundingSphere();
      return g;
    }
  }

  const C = (hex) => new THREE.Color(hex);

  window.createOCWorld = async function createOCWorld(scene, renderer, onProgress = () => {}) {
    const map = window.OC_MAP;
    if (!map) throw new Error('OC_MAP is missing: src/v2/oc-map.js did not load');
    const step = async (label, frac) => { onProgress(label, frac); await new Promise((r) => setTimeout(r, 0)); };

    const G = map.grid, NX = G.nx, NZ = G.nz, CELL = G.cell, X0 = G.x0, Z0 = G.z0;
    const XMAX = X0 + (NX - 1) * CELL, ZMAX = Z0 + (NZ - 1) * CELL;
    const CX = Math.ceil((NX - 1) / TILE), CZ = Math.ceil((NZ - 1) / TILE);
    const strings = map.strings;

    await step('Unpacking the map', 0.02);
    const H = new Float32Array(NX * NZ);
    {
      const raw = asInt16(await unpackBytes(map.heights));
      for (let i = 0; i < raw.length; i++) H[i] = raw[i] / 10;
    }
    const T = await unpackBytes(map.ground);
    const roadsRaw = await unpackJSON(map.roads);
    const junctionsRaw = await unpackJSON(map.junctions);
    const bRaw = asInt16(await unpackBytes(map.buildings));
    const tRaw = asInt16(await unpackBytes(map.trees));
    const cityGrid = await unpackBytes(map.cities.grid);
    const GT = { CHAPARRAL: 0, DRYGRASS: 1, LAWN: 2, SAND: 3, ROCK: 4, URBAN: 5, SEABED: 6, PARK: 7 };

    // Height of the ground at any point. Uses exactly the same two triangles
    // per cell as the terrain mesh, so things placed with it sit right on it.
    function heightAt(x, z) {
      let fi = (x - X0) / CELL, fj = (z - Z0) / CELL;
      fi = fi < 0 ? 0 : fi > NX - 1.0001 ? NX - 1.0001 : fi;
      fj = fj < 0 ? 0 : fj > NZ - 1.0001 ? NZ - 1.0001 : fj;
      const i = fi | 0, j = fj | 0, u = fi - i, v = fj - j, k = j * NX + i;
      const h00 = H[k], h10 = H[k + 1], h01 = H[k + NX], h11 = H[k + NX + 1];
      return u >= v ? h00 + (h10 - h00) * u + (h11 - h10) * v : h00 + (h11 - h01) * u + (h01 - h00) * v;
    }
    function groundTypeAt(x, z) {
      const i = Math.round((x - X0) / CELL), j = Math.round((z - Z0) / CELL);
      if (i < 0 || j < 0 || i >= NX || j >= NZ) return GT.CHAPARRAL;
      return T[j * NX + i];
    }
    const chunkOf = (x, z) => [Math.floor((x - X0) / (TILE * CELL)), Math.floor((z - Z0) / (TILE * CELL))];
    const chunks = [];
    for (let cz = 0; cz < CZ; cz++) {
      for (let cx = 0; cx < CX; cx++) {
        chunks.push({ cx, cz, x: X0 + (cx + 0.5) * TILE * CELL, z: Z0 + (cz + 0.5) * TILE * CELL, layers: {} });
      }
    }
    // Trees and buildings are grouped in smaller 480 m blocks, so the shadow
    // pass and the camera only draw the blocks they can actually see.
    const BLOCK = 480;
    const blockKey = (x, z) => Math.floor((x - X0) / BLOCK) * 1000 + Math.floor((z - Z0) / BLOCK);
    const chunkAt = (x, z) => {
      const [cx, cz] = chunkOf(x, z);
      return chunks[Math.max(0, Math.min(CZ - 1, cz)) * CX + Math.max(0, Math.min(CX - 1, cx))];
    };
    // Put a mesh in a chunk's layer; layers are shown or hidden by distance.
    function addToChunk(chunk, layer, mesh) {
      (chunk.layers[layer] = chunk.layers[layer] || []).push(mesh);
      mesh.visible = false;
      scene.add(mesh);
    }

    // -------------------------------------------------------------------------
    // Sky, sun and fog
    // -------------------------------------------------------------------------
    const hemi = new THREE.HemisphereLight();
    const sun = new THREE.DirectionalLight();
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 700 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.04;
    scene.add(hemi, sun, sun.target);
    scene.fog = new THREE.Fog('#c6d9e2', 400, 4800);

    // Times of day. The sun is low in the west-southwest at sunset, out over
    // the Pacific, the way it sets from Laguna Beach.
    const TIMES = {
      day: {
        label: 'Afternoon', sunEl: 40, sunAz: 215, sun: '#fff3dc', sunI: 2.9, hemiSky: '#d9ebff', hemiGround: '#8a7a5c', hemiI: 1.8,
        zenith: '#3b7bd0', horizon: '#c7dceb', ground: '#9aa29a', fog: '#c9dbe5', fogNear: 450, fogFar: 5200,
        cloud: '#ffffff', cloudShade: '#b7c5d5', cover: 0.42, shallow: '#3fb1ad', deep: '#1b5f80', night: 0,
      },
      sunset: {
        label: 'Sunset', sunEl: 6, sunAz: 252, sun: '#ffb26a', sunI: 2.4, hemiSky: '#ffd0a0', hemiGround: '#5d4838', hemiI: 1.5,
        zenith: '#46558c', horizon: '#f5a35d', ground: '#6d5a4c', fog: '#e2a276', fogNear: 300, fogFar: 4300,
        cloud: '#ffd09c', cloudShade: '#8c5a6c', cover: 0.5, shallow: '#3f8f98', deep: '#1c4366', night: 0.75,
      },
    };
    const sunDir = new THREE.Vector3();

    const skyMat = new THREE.ShaderMaterial({
      depthWrite: false,
      side: THREE.BackSide,
      uniforms: {
        uZenith: { value: C('#3b7bd0') }, uHorizon: { value: C('#c7dceb') }, uGround: { value: C('#9aa29a') },
        uSunDir: { value: sunDir }, uSunColor: { value: C('#fff3dc') }, uCloud: { value: C('#ffffff') },
        uCloudShade: { value: C('#b7c5d5') }, uCover: { value: 0.42 }, uTime: { value: 0 },
      },
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main() {
          vDir = position;
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww;
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uZenith, uHorizon, uGround, uSunDir, uSunColor, uCloud, uCloudShade;
        uniform float uCover, uTime;
        varying vec3 vDir;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
        }
        float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 col = h > 0.0 ? mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.5)) : mix(uHorizon, uGround, clamp(-h * 5.0, 0.0, 1.0));
          float sd = max(dot(d, uSunDir), 0.0);
          col += uSunColor * (pow(sd, 5.0) * 0.22 + pow(sd, 60.0) * 0.5);
          col += uSunColor * smoothstep(0.9992, 0.9996, sd) * 3.0;
          if (h > 0.0) {
            vec2 uv = d.xz / (h + 0.12) * 0.8 + vec2(uTime * 0.0035, uTime * 0.0012);
            float n = fbm(uv * 1.4);
            float c = smoothstep(1.0 - uCover, 1.0 - uCover + 0.32, n);
            float shade = clamp(fbm(uv * 1.4 + vec2(0.12, 0.08)) * 1.5 - 0.25, 0.0, 1.0);
            vec3 cc = mix(uCloudShade, uCloud, shade);
            cc += uSunColor * pow(sd, 6.0) * 0.4;
            col = mix(col, cc, c * smoothstep(0.0, 0.14, h) * 0.95);
          }
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(9000, 40, 20), skyMat);
    sky.frustumCulled = false;
    sky.renderOrder = -10;
    scene.add(sky);

    // -------------------------------------------------------------------------
    // Textures
    // -------------------------------------------------------------------------
    await step('Painting textures', 0.08);
    const noiseFill = (ctx, w, h, base, spread, dots, r0 = 0.6, r1 = 1.6) => {
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);
      const r = rng(7);
      for (let i = 0; i < dots; i++) {
        const v = Math.floor(255 * (1 - spread * r()));
        ctx.fillStyle = `rgba(${v},${v},${v},${0.25 + r() * 0.5})`;
        const s = r0 + r() * (r1 - r0);
        ctx.fillRect(r() * w, r() * h, s, s);
      }
    };
    const groundTex = canvasTexture(256, 256, (ctx, w, h) => {
      noiseFill(ctx, w, h, '#f2f2f2', 0.35, 9000, 0.8, 2.6);
      const r = rng(3);
      for (let i = 0; i < 60; i++) {
        ctx.fillStyle = `rgba(0,0,0,${0.03 + r() * 0.05})`;
        ctx.beginPath();
        ctx.arc(r() * w, r() * h, 6 + r() * 22, 0, Math.PI * 2);
        ctx.fill();
      }
    }, { repeat: true });
    const asphaltTex = canvasTexture(512, 512, (ctx, w, h) => {
      noiseFill(ctx, w, h, '#e9e9e9', 0.45, 26000, 0.6, 1.8);
      const r = rng(11);
      ctx.strokeStyle = 'rgba(40,40,40,0.18)';
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 14; i++) { // hairline cracks
        let x = r() * w, y = r() * h;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let k = 0; k < 8; k++) { x += (r() - 0.5) * 40; y += (r() - 0.5) * 40; ctx.lineTo(x, y); }
        ctx.stroke();
      }
      for (let i = 0; i < 16; i++) { // patches and oil stains
        ctx.fillStyle = `rgba(30,30,30,${0.04 + r() * 0.06})`;
        ctx.beginPath();
        ctx.ellipse(r() * w, r() * h, 10 + r() * 50, 6 + r() * 25, r() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }, { repeat: true });

    // Tree atlas: four squares. Fan palm frond, queen palm frond, leafy
    // clump, bark.
    const ATLAS = { fan: [0, 0.5, 0.5, 1], queen: [0.5, 0.5, 1, 1], leaf: [0, 0, 0.5, 0.5], bark: [0.5, 0, 1, 0.5] };
    const atlasTex = canvasTexture(1024, 1024, (ctx) => {
      const r = rng(21);
      // fan palm frond (top left): a fan of stiff leaf segments from the bottom middle
      ctx.save();
      ctx.translate(256, 500);
      for (let k = 0; k < 38; k++) {
        const a = -Math.PI * 0.92 + (k / 37) * Math.PI * 0.84;
        const len = 380 + r() * 90;
        ctx.strokeStyle = `hsl(${88 + r() * 18}, ${38 + r() * 14}%, ${30 + r() * 14}%)`;
        ctx.lineWidth = 9 + r() * 5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(Math.cos(a) * len * 0.5, Math.sin(a) * len * 0.5 - 20, Math.cos(a + 0.05) * len, Math.sin(a + 0.05) * len + 30);
        ctx.stroke();
      }
      ctx.fillStyle = '#5b6b2f';
      ctx.beginPath();
      ctx.ellipse(0, -30, 70, 40, 0, Math.PI, 0);
      ctx.fill();
      ctx.restore();
      // queen palm frond (top right): a long feather, leaflets on both sides
      ctx.save();
      ctx.translate(512, 256);
      ctx.strokeStyle = '#7b7a3a';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(500, 0);
      ctx.stroke();
      for (let x = 30; x < 500; x += 9) {
        const len = 200 * Math.sin(Math.PI * Math.min(1, (x + 40) / 540)) + 20;
        for (const s of [-1, 1]) {
          ctx.strokeStyle = `hsl(${92 + r() * 16}, ${45 + r() * 12}%, ${28 + r() * 14}%)`;
          ctx.lineWidth = 5 + r() * 3;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.quadraticCurveTo(x + len * 0.35, s * len * 0.4, x + len * 0.45, s * len * 0.95);
          ctx.stroke();
        }
      }
      ctx.restore();
      // leafy clump (bottom left)
      for (let i = 0; i < 1600; i++) {
        const x = 20 + r() * 472, y = 532 + r() * 472;
        ctx.fillStyle = `hsl(${85 + r() * 40}, ${35 + r() * 25}%, ${22 + r() * 22}%)`;
        ctx.beginPath();
        ctx.ellipse(x, y, 7 + r() * 9, 4 + r() * 5, r() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
      // bark (bottom right)
      ctx.fillStyle = '#8a7a63';
      ctx.fillRect(512, 512, 512, 512);
      for (let i = 0; i < 260; i++) {
        ctx.fillStyle = `rgba(${50 + r() * 60},${40 + r() * 40},${30 + r() * 30},${0.25 + r() * 0.4})`;
        ctx.fillRect(512 + r() * 512, 512 + r() * 512, 2 + r() * 6, 20 + r() * 80);
      }
      for (let y = 520; y < 1024; y += 16) {
        ctx.fillStyle = 'rgba(60,48,36,0.35)';
        ctx.fillRect(512, y, 512, 3);
      }
    });
    atlasTex.anisotropy = 4;

    // -------------------------------------------------------------------------
    // Terrain
    // -------------------------------------------------------------------------
    await step('Reading the roads', 0.1);
    const roads = roadsRaw.map(([k, n, r, l, w, f, s, flat], id) => {
      const pts = new Float64Array(flat.length);
      let x = 0, z = 0;
      for (let i = 0; i < flat.length; i += 2) {
        x += flat[i]; z += flat[i + 1];
        pts[i] = x / 10; pts[i + 1] = z / 10;
      }
      const n2 = pts.length / 2;
      const cum = new Float64Array(n2);
      for (let i = 1; i < n2; i++) cum[i] = cum[i - 1] + Math.hypot(pts[2 * i] - pts[2 * i - 2], pts[2 * i + 1] - pts[2 * i - 1]);
      const kind = map.roadKinds[k];
      return {
        id, k, kind, base: kind.replace('_link', ''), link: kind.endsWith('_link'),
        name: strings[n], ref: strings[r], lanes: l, w, hw: w / 2, oneway: !!(f & 1), bridge: !!(f & 2),
        mph: s, pts, cum, len: cum[n2 - 1], n: n2, junctions: new Map(),
      };
    });
    for (const flat of junctionsRaw) {
      const members = [];
      for (let i = 0; i < flat.length; i += 2) members.push([flat[i], flat[i + 1]]);
      for (const [r, p] of members) roads[r].junctions.set(p, members);
    }
    const roadLabel = (road) => {
      const short = (s) => s.replace(/\bParkway\b/, 'Pkwy').replace(/\bRoad\b/, 'Rd').replace(/\bDrive\b/, 'Dr')
        .replace(/\bStreet\b/, 'St').replace(/\bAvenue\b/, 'Ave').replace(/\bBoulevard\b/, 'Blvd')
        .replace(/\bHighway\b/, 'Hwy').replace(/\bLane\b/, 'Ln').replace(/\bFreeway\b/, 'Fwy');
      if (road.base === 'motorway') return [road.ref, road.name && short(road.name)].filter(Boolean).join(' · ') || 'Freeway';
      if (road.link) return road.name ? short(road.name) : 'On-ramp';
      if (road.name && road.ref) return `${short(road.name)} · ${road.ref}`;
      return road.name ? short(road.name) : road.ref || '';
    };
    for (const road of roads) road.label = roadLabel(road);

    // Spatial hash of road segments, for "which road am I on" and the minimap.
    const SEG_CELL = 80;
    const segHash = new Map();
    const segKey = (cx, cz) => (cx + 2000) * 5000 + (cz + 2000);
    for (const road of roads) {
      for (let i = 0; i < road.n - 1; i++) {
        const ax = road.pts[2 * i], az = road.pts[2 * i + 1], bx = road.pts[2 * i + 2], bz = road.pts[2 * i + 3];
        const pad = road.hw + 2.6; // the sidewalk too
        for (let cx = Math.floor((Math.min(ax, bx) - pad) / SEG_CELL); cx <= Math.floor((Math.max(ax, bx) + pad) / SEG_CELL); cx++) {
          for (let cz = Math.floor((Math.min(az, bz) - pad) / SEG_CELL); cz <= Math.floor((Math.max(az, bz) + pad) / SEG_CELL); cz++) {
            const key = segKey(cx, cz);
            let list = segHash.get(key);
            if (!list) segHash.set(key, (list = []));
            list.push(road.id * 8192 + i);
          }
        }
      }
    }
    function forEachSegmentNear(x, z, r, cb) {
      const seen = new Set();
      for (let cx = Math.floor((x - r) / SEG_CELL); cx <= Math.floor((x + r) / SEG_CELL); cx++) {
        for (let cz = Math.floor((z - r) / SEG_CELL); cz <= Math.floor((z + r) / SEG_CELL); cz++) {
          const list = segHash.get(segKey(cx, cz));
          if (!list) continue;
          for (const code of list) {
            if (seen.has(code)) continue;
            seen.add(code);
            const road = roads[Math.floor(code / 8192)], i = code % 8192;
            cb(road, i, road.pts[2 * i], road.pts[2 * i + 1], road.pts[2 * i + 2], road.pts[2 * i + 3]);
          }
        }
      }
    }
    // Nearest road to a point: the road, how far, and how far along it.
    function nearestRoad(x, z, maxD = 40, filter = null) {
      let best = null, bestScore = Infinity;
      forEachSegmentNear(x, z, maxD, (road, i, ax, az, bx, bz) => {
        if (filter && !filter(road)) return;
        const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1e-9;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
        const d = Math.hypot(x - ax - dx * t, z - az - dz * t);
        const score = d - road.hw * 0.999; // inside a wide road beats near a narrow one
        if (d <= maxD && score < bestScore) {
          bestScore = score;
          best = { road, i, t, d, s: road.cum[i] + t * Math.sqrt(L2), dirX: dx / Math.sqrt(L2), dirZ: dz / Math.sqrt(L2),
            onRoad: d <= road.hw + 0.3, x: ax + dx * t, z: az + dz * t };
        }
      });
      return best;
    }
    function isRoad(x, z) {
      let hit = false;
      forEachSegmentNear(x, z, 1, (road, i, ax, az, bx, bz) => {
        if (hit) return;
        const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1e-9;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
        if (Math.hypot(x - ax - dx * t, z - az - dz * t) <= road.hw) hit = true;
      });
      return hit;
    }


    // A point a distance s along a road, and which way the road goes there.
    const roadPoint = (road, s, out) => {
      s = Math.max(0, Math.min(road.len, s));
      let lo = 0, hi = road.n - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (road.cum[m] <= s) lo = m; else hi = m; }
      const L = road.cum[hi] - road.cum[lo] || 1e-9, t = (s - road.cum[lo]) / L;
      const ax = road.pts[2 * lo], az = road.pts[2 * lo + 1], bx = road.pts[2 * hi], bz = road.pts[2 * hi + 1];
      out.x = ax + (bx - ax) * t; out.z = az + (bz - az) * t;
      out.dx = (bx - ax) / L; out.dz = (bz - az) / L; out.seg = lo;
      return out;
    };
    // 0: concrete freeways, 1: asphalt parkways and streets, 2: neighborhood streets
    const ROAD_CLASS = (road) => (road.base === 'motorway' || road.base === 'trunk' ? 0 : ['residential', 'unclassified', 'living_street'].includes(road.base) ? 2 : 1);
    const ROAD_LIFT = [0.07, 0.065, 0.06];

    // -------------------------------------------------------------------------
    // Smooth road surfaces
    // -------------------------------------------------------------------------
    // The ground is a grid of 30 m triangles. A road laid straight on it bends
    // at every grid line: a bump every 30 m. So each road gets its own smooth
    // height profile instead: the ground height every 4 m along the road,
    // averaged over a stretch (longer on freeways, which are built smoother),
    // and roads that meet at a junction are pulled to the same height there.
    // Then the ground under and beside every road is pushed down just below
    // that surface, so it can't poke through.
    await step('Smoothing the roads', 0.12);
    const PSTEP = 4;
    const SMOOTH = { motorway: 70, trunk: 50, primary: 45, secondary: 40, tertiary: 35, residential: 20, unclassified: 20, living_street: 15 };
    const boxSmooth = (a, w) => {
      const n = a.length, out = new Float32Array(n), pre = new Float64Array(n + 1);
      for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + a[i];
      for (let i = 0; i < n; i++) {
        const lo = Math.max(0, i - w), hi = Math.min(n - 1, i + w);
        out[i] = (pre[hi + 1] - pre[lo]) / (hi - lo + 1);
      }
      return out;
    };
    const rp0 = {};
    for (const road of roads) {
      road.cls = ROAD_CLASS(road);
      road.lift = ROAD_LIFT[road.cls];
      const walks = road.cls !== 0 && !road.link;
      road.walkW = walks ? (road.cls === 2 ? 1.6 : 2.2) : 0;
      road.curbH = road.cls === 2 ? 0.1 : 0.15;
      road.walkR = road.walkW;                                  // sidewalk on the right
      road.walkL = walks ? (road.oneway ? 0.5 : road.walkW) : 0; // left: sidewalk, or the median curb of a divided road
      const n = Math.max(2, Math.ceil(road.len / PSTEP) + 1);
      const stepLen = road.len / (n - 1) || 1;
      const raw = new Float32Array(n);
      for (let k = 0; k < n; k++) { roadPoint(road, k * stepLen, rp0); raw[k] = heightAt(rp0.x, rp0.z); }
      const w = Math.max(1, Math.round((road.link ? 25 : SMOOTH[road.base] || 30) / stepLen));
      road.prof = boxSmooth(boxSmooth(raw, w), w);
      road.pstep = stepLen;
    }
    // Height of a road's surface (before its small lift) at distance s along it.
    function roadHeight(road, s) {
      const f = Math.max(0, Math.min(road.prof.length - 1.0001, s / road.pstep));
      const k = f | 0, t = f - k;
      return road.prof[k] + (road.prof[k + 1] - road.prof[k]) * t;
    }
    // Roads that meet share one height at the junction: the big road wins most.
    {
      const WEIGHT = { motorway: 4, trunk: 3, primary: 3, secondary: 2, tertiary: 1.5 };
      for (const flat of junctionsRaw) {
        let sum = 0, wsum = 0;
        const members = [];
        for (let i = 0; i < flat.length; i += 2) {
          const road = roads[flat[i]], at = road.cum[flat[i + 1]];
          const wt = road.link ? 1 : WEIGHT[road.base] || 1;
          sum += roadHeight(road, at) * wt;
          wsum += wt;
          members.push([road, at]);
        }
        const J = sum / wsum;
        for (const [road, at] of members) {
          const delta = J - roadHeight(road, at);
          if (Math.abs(delta) < 0.005) continue;
          const L = Math.min(40, Math.max(8, road.len * 0.5)); // blend back over this distance
          const k0 = Math.max(0, Math.floor((at - L) / road.pstep)), k1 = Math.min(road.prof.length - 1, Math.ceil((at + L) / road.pstep));
          for (let k = k0; k <= k1; k++) {
            const d = Math.abs(k * road.pstep - at);
            const wgt = d <= road.pstep ? 1 : Math.max(0, 1 - (d - road.pstep) / (L - road.pstep));
            road.prof[k] += delta * wgt;
          }
        }
      }
    }
    // Push the ground down below every road and sidewalk. Each sample point
    // lowers the three corners of the ground triangle it sits in, so the
    // whole triangle (a flat piece) ends up under the road.
    {
      const lowerTo = new Float32Array(NX * NZ).fill(1e9);
      const CLEAR = 0.1;
      const lowerAt = (x, z, h) => {
        const fi = (x - X0) / CELL, fj = (z - Z0) / CELL;
        if (fi < 0 || fj < 0 || fi >= NX - 1 || fj >= NZ - 1) return;
        const i = fi | 0, j = fj | 0, k = j * NX + i;
        const third = fi - i >= fj - j ? k + 1 : k + NX;
        if (h < lowerTo[k]) lowerTo[k] = h;
        if (h < lowerTo[k + NX + 1]) lowerTo[k + NX + 1] = h;
        if (h < lowerTo[third]) lowerTo[third] = h;
      };
      for (const road of roads) {
        const offs = [-(road.hw + road.walkL), -road.hw * 0.5, 0, road.hw * 0.5, road.hw + road.walkR];
        for (let k = 0; k < road.prof.length; k++) {
          roadPoint(road, k * road.pstep, rp0);
          const h = road.prof[k] - CLEAR, rx = -rp0.dz, rz = rp0.dx;
          for (const o of offs) lowerAt(rp0.x + rx * o, rp0.z + rz * o, h);
        }
      }
      for (let v = 0; v < NX * NZ; v++) {
        if (H[v] > lowerTo[v] && T[v] !== GT.SEABED) H[v] = Math.max(0.3, lowerTo[v]);
      }
    }
    // The surface under a point if it's on a road or sidewalk: the road's
    // smooth height (sidewalks are a curb higher). null if it's neither.
    function roadSurface(x, z) {
      let best = null;
      forEachSegmentNear(x, z, 3, (road, i, ax, az, bx, bz) => {
        const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz) || 1e-9;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (L * L)));
        const d = Math.hypot(x - ax - dx * t, z - az - dz * t);
        if (d > road.hw + Math.max(road.walkL, road.walkR)) return;
        const base = roadHeight(road, road.cum[i] + t * L) + road.lift;
        let y;
        let onRoad = false;
        if (d <= road.hw) { y = base; onRoad = true; } else {
          const off = ((x - ax) * -dz + (z - az) * dx) / L; // + is the road's right-hand side
          if (d > road.hw + (off >= 0 ? road.walkR : road.walkL)) return;
          y = base + road.curbH;
        }
        if (!best || y > best.y) best = { y, road: onRoad || (best && best.road), on: road };
      });
      return best;
    }

    await step('Raising the hills', 0.14);
    const PALETTE = [
      ['#6f7146', '#5f6a3e', '#7d7849', '#666b40'], // chaparral: sage scrub and ceanothus
      ['#b0a173', '#a4925f', '#baab80', '#a99766'], // dry golden grass
      ['#829e52', '#729247', '#8ea65a', '#9aa66a'], // lawns and yards
      ['#e4d2a4', '#dcc795', '#eadbb6', '#e0cc9c'], // sand
      ['#a58e70', '#977f62', '#b09a7b', '#8f7c66'], // sandstone cliffs
      ['#b9b3a7', '#aba598', '#c4beb2', '#a39d92'], // parking lots, plazas
      ['#b8a37e', '#a8956f', '#c2ae88', '#9e8a66'], // under water: wet sand
      ['#6fa048', '#7aa850', '#64944a', '#86ad58'], // parks and golf courses
    ].map((list) => list.map(C));
    const vcol = new Float32Array(NX * NZ * 3);
    const vnor = new Float32Array(NX * NZ * 3);
    const tmpC = new THREE.Color();
    for (let j = 0; j < NZ; j++) {
      for (let i = 0; i < NX; i++) {
        const k = j * NX + i;
        const hl = H[j * NX + Math.max(0, i - 1)], hr = H[j * NX + Math.min(NX - 1, i + 1)];
        const hu = H[Math.max(0, j - 1) * NX + i], hd = H[Math.min(NZ - 1, j + 1) * NX + i];
        let nx = -(hr - hl) / (2 * CELL), nz = -(hd - hu) / (2 * CELL);
        const len = Math.hypot(nx, 1, nz);
        vnor[k * 3] = nx / len; vnor[k * 3 + 1] = 1 / len; vnor[k * 3 + 2] = nz / len;
        const type = T[k];
        const pal = PALETTE[type];
        tmpC.copy(pal[Math.floor(hash2(i, j) * 4)]).lerp(pal[Math.floor(hash2(j + 7, i + 3) * 4)], 0.5);
        if (type === GT.SAND && H[k] < 1.6) tmpC.multiplyScalar(0.82); // wet sand at the waterline
        if (type === GT.LAWN && hash2(i * 3, j * 5) < 0.35) tmpC.lerp(PALETTE[1][0], 0.45); // some dry yards
        const shade = 0.88 + 0.24 * (1 / len); // steep ground a touch darker
        vcol[k * 3] = tmpC.r * shade * 1.12;
        vcol[k * 3 + 1] = tmpC.g * shade * 1.12;
        vcol[k * 3 + 2] = tmpC.b * shade * 1.12;
      }
    }
    const terrainMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: groundTex });
    function terrainGeometry(cx, cz, s) {
      const i0 = cx * TILE, j0 = cz * TILE;
      const i1 = Math.min(i0 + TILE, NX - 1), j1 = Math.min(j0 + TILE, NZ - 1);
      const is = [], js = [];
      for (let i = i0; i < i1; i += s) is.push(i);
      is.push(i1);
      for (let j = j0; j < j1; j += s) js.push(j);
      js.push(j1);
      const pos = [], nor = [], col = [], uv = [], idx = [];
      for (const j of js) {
        for (const i of is) {
          const k = j * NX + i, x = X0 + i * CELL, z = Z0 + j * CELL;
          pos.push(x, H[k], z);
          nor.push(vnor[k * 3], vnor[k * 3 + 1], vnor[k * 3 + 2]);
          col.push(vcol[k * 3], vcol[k * 3 + 1], vcol[k * 3 + 2]);
          uv.push(x / 9, z / 9);
        }
      }
      const w = is.length;
      for (let b = 0; b < js.length - 1; b++) {
        for (let a = 0; a < w - 1; a++) {
          const v00 = b * w + a, v10 = v00 + 1, v01 = v00 + w, v11 = v01 + 1;
          idx.push(v00, v11, v10, v00, v01, v11);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeBoundingSphere();
      return g;
    }
    for (const chunk of chunks) {
      const hi = new THREE.Mesh(terrainGeometry(chunk.cx, chunk.cz, 1), terrainMat);
      hi.receiveShadow = true;
      addToChunk(chunk, 'terrainHi', hi);
      addToChunk(chunk, 'terrainLo', new THREE.Mesh(terrainGeometry(chunk.cx, chunk.cz, 4), terrainMat));
    }
    // A skirt around the edge of the map, so it doesn't end in a cliff.
    {
      const b = new Buf();
      const ring = [];
      for (let i = 0; i < NX; i += 4) ring.push([i, 0, 0, -1]);
      for (let j = 0; j < NZ; j += 4) ring.push([NX - 1, j, 1, 0]);
      for (let i = NX - 1; i >= 0; i -= 4) ring.push([i, NZ - 1, 0, 1]);
      for (let j = NZ - 1; j >= 0; j -= 4) ring.push([0, j, -1, 0]);
      ring.push(ring[0]);
      for (let k = 0; k < ring.length - 1; k++) {
        const [ia, ja, oxa, oza] = ring[k], [ib, jb, oxb, ozb] = ring[k + 1];
        const ka = ja * NX + ia, kb = jb * NX + ib;
        const xa = X0 + ia * CELL, za = Z0 + ja * CELL, xb = X0 + ib * CELL, zb = Z0 + jb * CELL;
        const ya = Math.max(H[ka], 0) - 0.3, yb = Math.max(H[kb], 0) - 0.3;
        if (T[ka] === GT.SEABED && T[kb] === GT.SEABED) continue;
        const ca = tmpC.setRGB(vcol[ka * 3], vcol[ka * 3 + 1], vcol[ka * 3 + 2]).clone();
        const D = 9000;
        b.quad([xa, ya, za], [xb, yb, zb], [xa + (oxa || oxb) * D, ya, za + (oza || ozb) * D], [xb + (oxb || oxa) * D, yb, zb + (ozb || oza) * D], [0, 1, 0], ca);
      }
      const skirt = new THREE.Mesh(b.geometry(), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
      scene.add(skirt);
    }

    // -------------------------------------------------------------------------
    // Ocean
    // -------------------------------------------------------------------------
    const depthData = new Uint8Array(NX * NZ);
    for (let k = 0; k < NX * NZ; k++) depthData[k] = T[k] === GT.SEABED ? Math.min(255, Math.max(1, Math.round(-H[k] * 6))) : 0;
    const depthTex = new THREE.DataTexture(depthData, NX, NZ, THREE.RedFormat, THREE.UnsignedByteType);
    depthTex.minFilter = depthTex.magFilter = THREE.LinearFilter;
    depthTex.needsUpdate = true;
    const oceanMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uSunDir: { value: sunDir }, uSunColor: { value: C('#fff3dc') },
        uSky: { value: C('#3b7bd0') }, uHorizon: { value: C('#c7dceb') }, uDeep: { value: C('#1b5f80') },
        uShallow: { value: C('#3fb1ad') }, uFogColor: { value: C('#c9dbe5') }, uFogNear: { value: 450 }, uFogFar: { value: 5200 },
        uDepth: { value: depthTex }, uGrid: { value: new THREE.Vector4(X0, Z0, CELL, 0) }, uSize: { value: new THREE.Vector2(NX, NZ) },
      },
      vertexShader: /* glsl */`
        varying vec3 vWorld;
        varying float vFogDepth;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vWorld = w.xyz;
          vec4 mv = viewMatrix * w;
          vFogDepth = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        uniform float uTime, uFogNear, uFogFar;
        uniform vec3 uSunDir, uSunColor, uSky, uHorizon, uDeep, uShallow, uFogColor;
        uniform sampler2D uDepth;
        uniform vec4 uGrid;
        uniform vec2 uSize;
        varying vec3 vWorld;
        varying float vFogDepth;
        vec2 wave(vec2 p, vec2 dir, float k, float sp, float amp) {
          return dir * cos(dot(p, dir) * k + uTime * sp) * k * amp;
        }
        void main() {
          vec2 p = vWorld.xz;
          vec2 huv = ((p - uGrid.xy) / uGrid.z + 0.5) / uSize;
          float raw = texture2D(uDepth, huv).r * 255.0;
          bool outside = huv.x < 0.0 || huv.y < 0.0 || huv.x > 1.0 || huv.y > 1.0;
          if (raw < 0.5) discard;   // land (in or past the edge of the map): no water here
          float depth = outside ? 40.0 : raw / 6.0;
          vec2 g = wave(p, normalize(vec2(0.8, 0.6)), 0.05, 0.9, 0.4)
                 + wave(p, normalize(vec2(0.3, 1.0)), 0.11, 1.5, 0.2)
                 + wave(p, normalize(vec2(-0.6, 0.8)), 0.24, 2.2, 0.08)
                 + wave(p, normalize(vec2(0.9, -0.2)), 0.55, 3.0, 0.03)
                 + wave(p, normalize(vec2(-0.2, 0.95)), 1.4, 4.6, 0.009);
          vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
          vec3 v = normalize(cameraPosition - vWorld);
          float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
          vec3 water = mix(uShallow, uDeep, smoothstep(0.4, 16.0, depth));
          vec3 r = reflect(-v, n);
          vec3 skyc = mix(uHorizon, uSky, clamp(r.y * 2.2, 0.0, 1.0));
          vec3 col = mix(water, skyc, fres * 0.8);
          col += uSunColor * pow(max(dot(r, uSunDir), 0.0), 240.0) * 3.0;
          // Surf: lines of white water rolling in to the beach.
          float shore = 1.0 - smoothstep(0.0, 3.2, depth);
          float lines = smoothstep(0.78, 1.0, sin(depth * 2.4 - uTime * 1.5 + sin(p.x * 0.04 + p.y * 0.03) * 1.6) * 0.5 + 0.5);
          float foam = clamp(shore * lines + (1.0 - smoothstep(0.0, 0.45, depth)) * 0.8, 0.0, 1.0);
          col = mix(col, vec3(0.94, 0.96, 0.95), foam * 0.85);
          col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, vFogDepth));
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    const ocean = new THREE.Mesh(new THREE.PlaneGeometry(60000, 60000), oceanMat);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set((X0 + XMAX) / 2, 0, (Z0 + ZMAX) / 2);
    scene.add(ocean);

    // -------------------------------------------------------------------------
    // Roads
    // -------------------------------------------------------------------------
    await step('Laying the roads', 0.24);
    // Points along a road at most `step` metres apart, so curves stay round.
    function densify(road, step = 4) {
      const xs = [], zs = [], ss = [];
      for (let i = 0; i < road.n - 1; i++) {
        const ax = road.pts[2 * i], az = road.pts[2 * i + 1], bx = road.pts[2 * i + 2], bz = road.pts[2 * i + 3];
        const L = road.cum[i + 1] - road.cum[i];
        const n = Math.max(1, Math.ceil(L / step));
        for (let k = 0; k < n; k++) {
          const t = k / n;
          xs.push(ax + (bx - ax) * t); zs.push(az + (bz - az) * t); ss.push(road.cum[i] + L * t);
        }
      }
      xs.push(road.pts[2 * road.n - 2]); zs.push(road.pts[2 * road.n - 1]); ss.push(road.len);
      return { xs, zs, ss, n: xs.length };
    }
    // A strip along a road between distances s0 and s1, at the road's own
    // smooth height. Each edge is [sideways offset (right is +), height above
    // the road]. 'up' strips lie flat (road, lines, sidewalks); 'side' strips
    // are upright curb faces; 'skirt' hangs down from an edge to just under
    // the ground, so no gap shows where the ground dips away from the road.
    function strip(buf, road, D, s0, s1, edgeA, edgeB, color, mode = 'up') {
      if (s1 - s0 < 0.05) return;
      const at = (s) => {
        let lo = 0, hi = D.n - 1;
        while (hi - lo > 1) { const m = (lo + hi) >> 1; if (D.ss[m] <= s) lo = m; else hi = m; }
        const L = D.ss[hi] - D.ss[lo] || 1e-9, t = Math.min(1, Math.max(0, (s - D.ss[lo]) / L));
        return [D.xs[lo] + (D.xs[hi] - D.xs[lo]) * t, D.zs[lo] + (D.zs[hi] - D.zs[lo]) * t, s, hi];
      };
      const first = at(s0);
      const pts = [first];
      for (let i = first[3]; i < D.n && D.ss[i] < s1; i++) if (D.ss[i] > s0 + 0.01) pts.push([D.xs[i], D.zs[i], D.ss[i]]);
      pts.push(at(s1));
      const base = buf.count;
      const side = Math.sign(edgeA[0]) || 1;
      for (let k = 0; k < pts.length; k++) {
        const p = pts[k], a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)];
        let tx = b[0] - a[0], tz = b[1] - a[1];
        const L = Math.hypot(tx, tz) || 1;
        tx /= L; tz /= L;
        let miter = 1;
        if (k > 0 && k < pts.length - 1) {
          const sx = p[0] - a[0], sz = p[1] - a[1], sl = Math.hypot(sx, sz) || 1;
          miter = 1 / Math.max(0.5, (sx * tx + sz * tz) / sl);
        }
        const rx = -tz * miter, rz = tx * miter;
        const y0 = roadHeight(road, p[2]);
        const xa = p[0] + rx * edgeA[0], za = p[1] + rz * edgeA[0];
        const xb = p[0] + rx * edgeB[0], zb = p[1] + rz * edgeB[0];
        const ya = y0 + edgeA[1];
        const yb = mode === 'skirt' ? Math.min(ya - 0.5, heightAt(xb, zb) - 0.4) : y0 + edgeB[1];
        const nx = mode === 'up' ? 0 : mode === 'side' ? -tz * -side : -tz * side;
        const nz = mode === 'up' ? 0 : mode === 'side' ? tx * -side : tx * side;
        const ny = mode === 'up' ? 1 : 0;
        buf.vert(xa, ya, za, nx, ny, nz, color, xa / 5, za / 5);
        buf.vert(xb, yb, zb, nx, ny, nz, color, xb / 5, zb / 5);
      }
      for (let k = 0; k < pts.length - 1; k++) {
        const a = base + k * 2, b = a + 1, c = a + 2, d = a + 3;
        buf.idx.push(a, b, c, b, d, c);
      }
    }
    // Pieces of [0, len] that are not inside any of the skip ranges.
    function openRanges(len, skips) {
      skips.sort((p, q) => p[0] - q[0]);
      const out = [];
      let s = 0;
      for (const [a, b] of skips) {
        if (a > s) out.push([s, Math.min(a, len)]);
        s = Math.max(s, b);
        if (s >= len) break;
      }
      if (s < len) out.push([s, len]);
      return out;
    }

    const WHITE = C('#ecebe4'), YELLOW = C('#e3b23c');
    const roadMats = [['#b5b1a8', -6], ['#5a5c60', -4], ['#68696c', -2]].map(([c, u]) => new THREE.MeshLambertMaterial({
      color: c, map: asphaltTex, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: u,
    }));
    const markMat = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -10 });
    const walkMat = new THREE.MeshLambertMaterial({ color: '#d2cdc3', side: THREE.DoubleSide });
    const skirtMat = new THREE.MeshLambertMaterial({ color: '#8c8576', side: THREE.DoubleSide });
    const roadBufs = new Map(); // chunk index -> { road: [Buf x3], marks, walks, lamps: [] }
    const bufsFor = (x, z) => {
      const ch = chunkAt(x, z), key = ch.cz * CX + ch.cx;
      let b = roadBufs.get(key);
      if (!b) roadBufs.set(key, (b = { chunk: ch, road: [new Buf(), new Buf(), new Buf()], marks: new Buf(), walks: new Buf(), skirts: new Buf(), lamps: [] }));
      return b;
    };
    const ZERO = C('#ffffff');
    const CONCRETE = C('#cfcac0'), CURB = C('#d9d5cc');

    for (const road of roads) {
      if (road.len < 1) continue;
      const D = densify(road, 4), D8 = densify(road, 8);
      const mid = Math.floor(D.n / 2);
      const bufs = bufsFor(D.xs[mid], D.zs[mid]);
      const cls = road.cls;
      const lift = road.lift;
      const hw = road.hw;
      strip(bufs.road[cls], road, D, 0, road.len, [-hw, lift], [hw, lift], ZERO);
      // edges hang down to the ground (below the sidewalk if there is one)
      for (const sd of [-1, 1]) {
        const walk = sd > 0 ? road.walkR : road.walkL;
        const off = sd * (hw + walk);
        strip(bufs.skirts, road, D8, 0, road.len, [off, walk ? lift + road.curbH : lift], [off, 0], ZERO, 'skirt');
      }

      // Where other roads join, lines and sidewalks stop.
      const skips = [];
      for (const [p, members] of road.junctions) {
        let other = 0;
        for (const [r2] of members) if (r2 !== road.id) other = Math.max(other, roads[r2].hw);
        if (!other) continue;
        const s = road.cum[p];
        const clear = road.base === 'motorway' && !road.link ? 0 : other + 3.5;
        if (clear > 0) skips.push([s - clear, s + clear]);
      }
      const open = openRanges(road.len, skips);
      const line = (off, width, color, dash) => {
        for (const [a, b] of open) {
          if (!dash) { strip(bufs.marks, road, D, a, b, [off - width / 2, lift + 0.03], [off + width / 2, lift + 0.03], color); continue; }
          for (let s = a + 1; s < b; s += dash[0] + dash[1]) {
            strip(bufs.marks, road, D, s, Math.min(b, s + dash[0]), [off - width / 2, lift + 0.03], [off + width / 2, lift + 0.03], color);
          }
        }
      };
      const DASH = [3, 9];
      const residential = cls === 2;
      if (road.base === 'motorway' && !road.link) {
        line(-hw + 1.5, 0.15, YELLOW);
        line(hw - 3.0, 0.15, WHITE);
        for (let k = 1; k < road.lanes; k++) line(-hw + 1.5 + k * 3.7, 0.12, WHITE, DASH);
      } else if (road.link) {
        line(-hw + 0.6, 0.13, YELLOW);
        line(hw - 0.8, 0.13, WHITE);
      } else if (!residential && road.oneway) {
        line(-hw + 0.5, 0.13, YELLOW);
        line(hw - 1.0, 0.13, WHITE);
        for (let k = 1; k < road.lanes; k++) line(-hw + 0.4 + k * 3.6, 0.11, WHITE, DASH);
      } else if (!residential) {
        const center = road.lanes % 2 === 1 && road.lanes >= 3 ? 1.8 : 0;
        if (center) {
          for (const s of [-1, 1]) { line(s * 1.9, 0.11, YELLOW); line(s * 1.6, 0.11, YELLOW, [3, 3]); }
        } else {
          line(-0.12, 0.1, YELLOW); line(0.12, 0.1, YELLOW);
        }
        const per = Math.max(1, Math.floor(road.lanes / 2));
        for (let k = 1; k < per; k++) for (const s of [-1, 1]) line(s * (center + 0.3 + k * 3.6), 0.11, WHITE, DASH);
        if (hw > 5) for (const s of [-1, 1]) line(s * (hw - 1.0), 0.12, WHITE);
      }

      // Curbs and sidewalks (not on freeways). Neighborhood streets get a
      // low sidewalk without an upright curb face, to save memory.
      if (cls !== 0 && !road.link) {
        const walkW = road.walkW, curbH = road.curbH;
        const sides = road.oneway ? [1] : [-1, 1];
        for (const [a, b] of open) {
          for (const s of sides) {
            if (!residential) strip(bufs.walks, road, D, a, b, [s * hw, lift], [s * hw, lift + curbH], CURB, 'side');
            strip(bufs.walks, road, D, a, b, [s * hw, lift + curbH], [s * (hw + walkW), lift + curbH], CONCRETE);
          }
          if (road.oneway) { // the median side of a divided parkway: just a curb
            strip(bufs.walks, road, D, a, b, [-hw, lift], [-hw, lift + curbH], CURB, 'side');
            strip(bufs.walks, road, D, a, b, [-hw, lift + curbH], [-(hw + 0.5), lift + curbH], CONCRETE);
          }
        }
        // Street lights along the bigger roads.
        if (!residential) {
          for (const [a, b] of open) {
            for (let s = a + 12; s < b - 6; s += 46) {
              const k = Math.min(D.n - 2, Math.max(0, D.ss.findIndex((v) => v > s) - 1));
              const tx = D.xs[k + 1] - D.xs[k], tz = D.zs[k + 1] - D.zs[k], L = Math.hypot(tx, tz) || 1;
              const side = road.oneway ? 1 : (Math.floor(s / 46) % 2 ? 1 : -1);
              const t = (s - D.ss[k]) / (D.ss[k + 1] - D.ss[k] || 1);
              const x = D.xs[k] + tx * t - (tz / L) * side * (hw + 0.9);
              const z = D.zs[k] + tz * t + (tx / L) * side * (hw + 0.9);
              bufsFor(x, z).lamps.push([x, roadHeight(road, s) + lift + curbH, z, Math.atan2(-tz * side, tx * side)]);
            }
          }
        }
      }
    }
    // Street light model: pole, arm reaching over the road, cobra head.
    const lampGeo = (() => {
      const b = new Buf(), m = new THREE.Matrix4();
      const grey = C('#8d9194');
      b.add(new THREE.CylinderGeometry(0.09, 0.13, 9, 8), m.makeTranslation(0, 4.5, 0), grey);
      const arm = new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6);
      b.add(arm, new THREE.Matrix4().makeTranslation(0, 8.8, -1.2).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2 - 0.15)), grey);
      b.add(new THREE.BoxGeometry(0.42, 0.16, 0.8), m.makeTranslation(0, 9.0, -2.5), C('#b5b9bb'));
      b.add(new THREE.BoxGeometry(0.3, 0.04, 0.6), m.makeTranslation(0, 8.9, -2.5), C('#fff6d8'));
      return b.geometry();
    })();
    const lampMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    for (const [key, b] of roadBufs) {
      const ch = b.chunk;
      void key;
      b.road.forEach((buf, cls) => {
        if (!buf.count) return;
        const m = new THREE.Mesh(buf.geometry({ color: false }), roadMats[cls]);
        m.receiveShadow = true;
        addToChunk(ch, 'roads', m);
      });
      if (b.marks.count) {
        const m = new THREE.Mesh(b.marks.geometry({ uv: false }), markMat);
        m.receiveShadow = true;
        addToChunk(ch, 'marks', m);
      }
      if (b.walks.count) {
        const m = new THREE.Mesh(b.walks.geometry({ color: false, uv: false }), walkMat);
        m.receiveShadow = true;
        addToChunk(ch, 'walks', m);
      }
      if (b.skirts.count) addToChunk(ch, 'roads', new THREE.Mesh(b.skirts.geometry({ color: false, uv: false }), skirtMat));
      if (b.lamps.length) {
        const inst = new THREE.InstancedMesh(lampGeo, lampMat, b.lamps.length);
        const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
        b.lamps.forEach(([x, y, z, a], i) => {
          // arm points across the road: local -z turns to face the road
          q.setFromEuler(e.set(0, a, 0));
          inst.setMatrixAt(i, m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1)));
        });
        inst.castShadow = true;
        inst.computeBoundingSphere();
        addToChunk(ch, 'lamps', inst);
      }
    }

    // -------------------------------------------------------------------------
    // Buildings
    // -------------------------------------------------------------------------
    await step('Building the neighborhoods', 0.46);
    const BCOUNT = bRaw.length / 7;
    const bData = new Float32Array(BCOUNT * 7); // x, z, cos, sin, half-w, half-d, top
    const B_CELL = 32;
    const bHash = new Map();
    const hashAdd = (hash, cell, x, z, r, id) => {
      for (let cx = Math.floor((x - r) / cell); cx <= Math.floor((x + r) / cell); cx++) {
        for (let cz = Math.floor((z - r) / cell); cz <= Math.floor((z + r) / cell); cz++) {
          const key = segKey(cx, cz);
          let list = hash.get(key);
          if (!list) hash.set(key, (list = []));
          list.push(id);
        }
      }
    };
    const WALL = {
      house: ['#efe6d2', '#e5d4b4', '#d9c3a0', '#f2ede4', '#d8cfc0', '#e8cdb0', '#cbbf9f', '#e3dccf', '#c9b48f', '#efe0c8'].map(C),
      commercial: ['#e8e1d3', '#d6cdbb', '#c7c0b2', '#efeae0', '#b9b2a4', '#ddd2bb', '#cfc4ae'].map(C),
      civic: ['#efe8da', '#d9cdb3', '#e6dcc8'].map(C),
    };
    const ROOF = ['#a9512f', '#b45e36', '#9c4a2c', '#c06a3e', '#8e4a33', '#a85a3c', '#7f6a5a', '#8a8580', '#6f6a64', '#b9643f'].map(C);
    const facadeUniforms = { uNight: { value: 0 } };
    function facadeMaterial(kind) {
      const mtl = new THREE.MeshLambertMaterial({ color: '#ffffff' });
      mtl.onBeforeCompile = (sh) => {
        sh.uniforms.uNight = facadeUniforms.uNight;
        sh.vertexShader = sh.vertexShader
          // flat: the building number must reach every pixel exactly. Blended
          // across the triangle it can arrive as 1233.9999 instead of 1234,
          // and the random-window formula turns that into speckles.
          .replace('#include <common>', '#include <common>\nvarying vec4 vFacade;\nflat varying float vBid;')
          .replace('#include <begin_vertex>', `#include <begin_vertex>
            vec3 iScale = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
            vec3 lp = position * iScale;
            vFacade = vec4(abs(normal.x) > 0.5 ? lp.z : lp.x, lp.y, normal.y, iScale.y);
            vBid = float(gl_InstanceID);`);
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying vec4 vFacade;\nflat varying float vBid;\nuniform float uNight;\nfloat winMask;')
          .replace('#include <color_fragment>', `#include <color_fragment>
            winMask = 0.0;
            if (vFacade.z < 0.5) {
              float y = vFacade.y, Ht = vFacade.w, x = vFacade.x + 100.0;
              float frame = 0.0;
              ${kind === 'house' ? `
              float fy = mod(y - 0.3, 2.9), fx = mod(x, 3.6);
              winMask = step(0.95, fy) * step(fy, 2.15) * step(1.0, fx) * step(fx, 2.4) * step(y, Ht - 0.45) * step(0.7, y);
              frame = step(0.85, fy) * step(fy, 2.25) * step(0.9, fx) * step(fx, 2.5) * step(y, Ht - 0.35) * step(0.6, y) - winMask;
              diffuseColor.rgb *= 0.9 + 0.1 * step(0.25, y);` : `
              float fy = mod(y, 3.6), fx = mod(x, 2.8);
              float store = step(0.25, y) * step(y, 3.1) * step(0.1, fx) * step(fx, 2.7);
              float upper = step(3.6, y) * step(1.0, fy) * step(fy, 2.6) * step(0.15, fx) * step(fx, 2.65);
              winMask = max(store, upper) * step(y, Ht - 0.7);
              frame = step(y, Ht) * step(Ht - 0.35, y) * 0.6;`}
              vec3 glass = mix(vec3(0.13, 0.17, 0.21), vec3(0.36, 0.45, 0.52), clamp(y / 14.0, 0.0, 1.0) * 0.7);
              diffuseColor.rgb = mix(diffuseColor.rgb, glass, winMask);
              diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95), clamp(frame, 0.0, 1.0) * 0.55);
            }`)
          .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
            vec3 cellId = vec3(mod(floor(vBid + 0.5), 97.0), floor(vFacade.y / 2.9), mod(floor((vFacade.x + 100.0) / 3.6), 31.0));
            float lit = step(0.55, fract(sin(dot(cellId, vec3(12.9898, 78.233, 37.719))) * 43758.5453));
            totalEmissiveRadiance += winMask * lit * uNight * vec3(1.0, 0.72, 0.4) * 0.8;`);
      };
      mtl.customProgramCacheKey = () => 'facade-' + kind;
      return mtl;
    }
    const wallMats = { house: facadeMaterial('house'), commercial: facadeMaterial('commercial') };
    const boxGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    // Hip roofs (ridge along x). `a` is how far the ridge stops short of each end.
    const hipRoof = (a) => {
      const g = new THREE.BufferGeometry();
      const r0 = -0.5 + a, r1 = 0.5 - a;
      const P = [
        [-0.5, 0, 0.5], [0.5, 0, 0.5], [r1, 1, 0], [-0.5, 0, 0.5], [r1, 1, 0], [r0, 1, 0],    // front
        [0.5, 0, -0.5], [-0.5, 0, -0.5], [r0, 1, 0], [0.5, 0, -0.5], [r0, 1, 0], [r1, 1, 0],  // back
        [0.5, 0, 0.5], [0.5, 0, -0.5], [r1, 1, 0],                                            // right hip
        [-0.5, 0, -0.5], [-0.5, 0, 0.5], [r0, 1, 0],                                          // left hip
      ].flat();
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      g.computeVertexNormals();
      return g;
    };
    const ROOF_A = [0.5, 0.3, 0.17, 0.1];
    const roofGeos = ROOF_A.map(hipRoof);
    const roofMat = new THREE.MeshLambertMaterial({ color: '#ffffff', side: THREE.DoubleSide, flatShading: true });
    const hvacMat = new THREE.MeshLambertMaterial({ color: '#a4a6a6' });

    {
      const perChunk = new Map(); // block -> { house:[], commercial:[], roofs:[[],[],[],[]], hvac:[], chunk }
      const r = rng(99);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3(), yAxis = new THREE.Vector3(0, 1, 0);
      for (let b = 0; b < BCOUNT; b++) {
        const o = b * 7;
        const x = bRaw[o] / 2, z = bRaw[o + 1] / 2;
        let w = bRaw[o + 2] / 10, d = bRaw[o + 3] / 10, ang = bRaw[o + 4] / 10000;
        const h = bRaw[o + 5] / 10, kind = bRaw[o + 6];
        if (d > w) { [w, d] = [d, w]; ang += Math.PI / 2; }
        const c = Math.cos(ang), s = Math.sin(ang);
        let lo = Infinity, hiG = -Infinity;
        for (const [u, v] of [[0, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
          const px = x + (u * w * c - v * d * s) / 2, pz = z + (u * w * s + v * d * c) / 2;
          const g = heightAt(px, pz);
          lo = Math.min(lo, g); hiG = Math.max(hiG, g);
        }
        if (lo < -0.5) continue; // in the sea: a pier or a rock
        const base = lo - 0.6;
        const top = Math.max(hiG + 2.4, (lo + hiG) / 2 + h);
        bData.set([x, z, c, s, w / 2, d / 2, top], b * 7);
        hashAdd(bHash, B_CELL, x, z, Math.hypot(w, d) / 2, b);
        const bk = blockKey(x, z);
        let pc = perChunk.get(bk);
        if (!pc) perChunk.set(bk, (pc = { house: [], commercial: [], roofs: [[], [], [], []], hvac: [], chunk: chunkAt(x, z) }));
        const home = kind === 0 || kind === 1;
        const wallColor = pick(r, kind === 4 ? WALL.civic : home || kind === 3 ? WALL.house : WALL.commercial);
        q.setFromAxisAngle(yAxis, -ang);
        m4.compose(pos.set(x, base, z), q, scl.set(w, top - base, d));
        (home || kind === 3 ? pc.house : pc.commercial).push([m4.clone(), wallColor]);
        const area = w * d;
        if ((home && area < 2600) || (kind === 4 && area < 900 && r() < 0.5)) {
          const want = d / (2 * w);
          let bi = 0;
          for (let k = 1; k < ROOF_A.length; k++) if (Math.abs(ROOF_A[k] - want) < Math.abs(ROOF_A[bi] - want)) bi = k;
          const rh = Math.min(4.2, 0.22 * d + 0.4);
          m4.compose(pos.set(x, top - 0.05, z), q, scl.set(w + 0.9, rh, d + 0.9));
          pc.roofs[bi].push([m4.clone(), pick(r, ROOF)]);
        } else if (!home && kind !== 3 && area > 250) {
          const n = 1 + Math.floor(r() * Math.min(4, area / 400));
          for (let k = 0; k < n; k++) {
            const u = (r() - 0.5) * (w - 4), v = (r() - 0.5) * (d - 4);
            m4.compose(pos.set(x + u * c - v * s, top, z + u * s + v * c), q, scl.set(1.8 + r() * 2, 1 + r() * 0.8, 1.4 + r() * 1.6));
            pc.hvac.push([m4.clone(), null]);
          }
        }
      }
      const tint = new THREE.Color();
      const makeInst = (geo, mtl, list, shadow) => {
        const inst = new THREE.InstancedMesh(geo, mtl, list.length);
        list.forEach(([m, col], i) => {
          inst.setMatrixAt(i, m);
          if (col) inst.setColorAt(i, tint.copy(col).multiplyScalar(0.92 + hash2(i, list.length) * 0.16));
        });
        inst.castShadow = shadow;
        inst.receiveShadow = true;
        inst.computeBoundingSphere();
        return inst;
      };
      for (const pc of perChunk.values()) {
        const ch = pc.chunk;
        if (pc.house.length) addToChunk(ch, 'buildings', makeInst(boxGeo, wallMats.house, pc.house, true));
        if (pc.commercial.length) addToChunk(ch, 'buildings', makeInst(boxGeo, wallMats.commercial, pc.commercial, true));
        pc.roofs.forEach((list, k) => { if (list.length) addToChunk(ch, 'roofs', makeInst(roofGeos[k], roofMat, list, true)); });
        if (pc.hvac.length) addToChunk(ch, 'roofs', makeInst(boxGeo, hvacMat, pc.hvac, false));
      }
    }
    function hitBuilding(x, z, rad, y = null) {
      const list = bHash.get(segKey(Math.floor(x / B_CELL), Math.floor(z / B_CELL)));
      if (!list) return null;
      for (const b of list) {
        const o = b * 7;
        const dx = x - bData[o], dz = z - bData[o + 1];
        const u = dx * bData[o + 2] + dz * bData[o + 3], v = -dx * bData[o + 3] + dz * bData[o + 2];
        if (Math.abs(u) < bData[o + 4] + rad && Math.abs(v) < bData[o + 5] + rad && (y === null || y < bData[o + 6])) {
          // push-out direction: the nearest face
          const pu = bData[o + 4] + rad - Math.abs(u), pv = bData[o + 5] + rad - Math.abs(v);
          const nx = pu < pv ? Math.sign(u) * bData[o + 2] : -Math.sign(v) * bData[o + 3];
          const nz = pu < pv ? Math.sign(u) * bData[o + 3] : Math.sign(v) * bData[o + 2];
          return { kind: 'building', nx, nz, depth: Math.min(pu, pv) };
        }
      }
      return null;
    }

    // -------------------------------------------------------------------------
    // Trees and brush
    // -------------------------------------------------------------------------
    await step('Planting palm trees', 0.62);
    const treeGeos = (() => {
      const m = new THREE.Matrix4();
      const geos = [];
      const greenish = (base) => (i) => { const k = 0.85 + hash2(i, 3) * 0.3; return tmpC.copy(base).multiplyScalar(k).clone(); };
      const frondQuad = (b, cx, cy, cz, yaw, pitch, len, wid, region, droop = 0) => {
        const ox = Math.cos(pitch) * Math.cos(yaw), oy = Math.sin(pitch), oz = Math.cos(pitch) * Math.sin(yaw);
        const sx = -Math.sin(yaw), sz = Math.cos(yaw);
        const col = C('#ffffff').multiplyScalar(0.85 + Math.random() * 0.25);
        if (!droop) {
          b.quad([cx - sx * wid / 2, cy, cz - sz * wid / 2], [cx + sx * wid / 2, cy, cz + sz * wid / 2],
            [cx + ox * len - sx * wid / 2, cy + oy * len, cz + oz * len - sz * wid / 2], [cx + ox * len + sx * wid / 2, cy + oy * len, cz + oz * len + sz * wid / 2],
            [0, 1, 0], col, [[region[0], region[1]], [region[2], region[1]], [region[0], region[3]], [region[2], region[3]]]);
          return;
        }
        // queen palm: the frond rises, then arches down. Texture runs along its length.
        const p1 = [cx + ox * len * 0.5, cy + oy * len * 0.5, cz + oz * len * 0.5];
        const p2 = [p1[0] + Math.cos(yaw) * len * 0.5 * 0.85, p1[1] - droop * len * 0.5, p1[2] + Math.sin(yaw) * len * 0.5 * 0.85];
        const um = (region[0] + region[2]) / 2;
        const w0 = wid * 0.35, w1 = wid / 2, w2 = wid * 0.25;
        b.quad([cx - sx * w0, cy, cz - sz * w0], [cx + sx * w0, cy, cz + sz * w0], [p1[0] - sx * w1, p1[1], p1[2] - sz * w1], [p1[0] + sx * w1, p1[1], p1[2] + sz * w1],
          [0, 1, 0], col, [[region[0], region[1]], [region[0], region[3]], [um, region[1]], [um, region[3]]]);
        b.quad([p1[0] - sx * w1, p1[1], p1[2] - sz * w1], [p1[0] + sx * w1, p1[1], p1[2] + sz * w1], [p2[0] - sx * w2, p2[1], p2[2] - sz * w2], [p2[0] + sx * w2, p2[1], p2[2] + sz * w2],
          [0, 1, 0], col, [[um, region[1]], [um, region[3]], [region[2], region[1]], [region[2], region[3]]]);
      };
      // 0: Mexican fan palm: tall skinny trunk, a brown skirt, a small round head of fans
      {
        const b = new Buf();
        b.add(new THREE.CylinderGeometry(0.17, 0.27, 14, 7, 4), m.makeTranslation(0, 7, 0), C('#bfb2a0'), ATLAS.bark);
        b.add(new THREE.CylinderGeometry(0.55, 0.35, 2.2, 8, 1, true), m.makeTranslation(0, 12.6, 0), C('#8a6f4c'), ATLAS.leaf);
        for (let k = 0; k < 16; k++) frondQuad(b, 0, 13.6, 0, (k / 16) * Math.PI * 2 + k * 0.3, -0.5 + ((k * 7) % 5) * 0.28, 2.4, 2.4, ATLAS.fan);
        geos.push(b.geometry());
      }
      // 1: queen palm: shorter, ringed trunk, long arching feather fronds
      {
        const b = new Buf();
        b.add(new THREE.CylinderGeometry(0.2, 0.26, 8.5, 7, 3), m.makeTranslation(0, 4.25, 0), C('#a69c8c'), ATLAS.bark);
        for (let k = 0; k < 12; k++) frondQuad(b, 0, 8.5, 0, (k / 12) * Math.PI * 2 + k * 0.4, 0.55 + (k % 3) * 0.15, 4.4, 1.5, ATLAS.queen, 0.9 + (k % 2) * 0.3);
        geos.push(b.geometry());
      }
      // 2: broadleaf (coral tree, ficus, sycamore): a short trunk and a lumpy crown
      {
        const b = new Buf();
        b.add(new THREE.CylinderGeometry(0.22, 0.32, 3.4, 7), m.makeTranslation(0, 1.7, 0), C('#7a6a55'), ATLAS.bark);
        const blobs = [[0, 5.3, 0, 2.7], [1.6, 4.6, 0.6, 2.0], [-1.5, 4.8, -0.5, 2.1], [0.2, 4.4, 1.6, 1.8]];
        for (const [x, y, z, rad] of blobs) b.add(new THREE.IcosahedronGeometry(rad, 1), m.makeTranslation(x, y, z), greenish(C('#e4efc4')), ATLAS.leaf);
        geos.push(b.geometry());
      }
      // 3: Italian stone pine: a tall bare trunk and a flat umbrella top
      {
        const b = new Buf();
        b.add(new THREE.CylinderGeometry(0.22, 0.38, 9, 7), m.makeTranslation(0, 4.5, 0), C('#8a6a50'), ATLAS.bark);
        for (const [x, y, z, rad] of [[0, 9.5, 0, 3.6], [2.4, 9.0, 1.0, 2.4], [-2.2, 9.1, -1.2, 2.5], [-0.4, 9.0, 2.4, 2.3]]) {
          b.add(new THREE.IcosahedronGeometry(rad, 1), new THREE.Matrix4().makeTranslation(x, y, z).multiply(new THREE.Matrix4().makeScale(1, 0.45, 1)), greenish(C('#d3e2b4')), ATLAS.leaf);
        }
        geos.push(b.geometry());
      }
      // 4: eucalyptus: tall pale trunk and a loose grey-green crown
      {
        const b = new Buf();
        b.add(new THREE.CylinderGeometry(0.2, 0.36, 15, 7), m.makeTranslation(0, 7.5, 0), C('#d8d0c2'), ATLAS.bark);
        for (const [x, y, z, rad] of [[0, 15, 0, 2.6], [1.6, 12.5, 0.8, 2.2], [-1.5, 13.2, -0.6, 2.1], [-0.6, 17.2, 0.6, 1.8]]) {
          b.add(new THREE.IcosahedronGeometry(rad, 1), new THREE.Matrix4().makeTranslation(x, y, z).multiply(new THREE.Matrix4().makeScale(1, 1.25, 1)), greenish(C('#e2eadc')), ATLAS.leaf);
        }
        geos.push(b.geometry());
      }
      // 5: Italian cypress: a tall dark green spike
      {
        const b = new Buf();
        b.add(new THREE.CylinderGeometry(0.05, 1.1, 10, 9, 3), m.makeTranslation(0, 5.6, 0), greenish(C('#b8c9a0')), ATLAS.leaf);
        geos.push(b.geometry());
      }
      // 6: chaparral bush
      {
        const b = new Buf();
        b.add(new THREE.IcosahedronGeometry(1.2, 0), new THREE.Matrix4().makeTranslation(0, 0.55, 0).multiply(new THREE.Matrix4().makeScale(1.2, 0.75, 1.0)), greenish(C('#e0e3c0')), ATLAS.leaf);
        b.add(new THREE.IcosahedronGeometry(0.8, 0), m.makeTranslation(0.9, 0.45, 0.3), greenish(C('#d6dab4')), ATLAS.leaf);
        geos.push(b.geometry());
      }
      return geos;
    })();
    const treeMat = new THREE.MeshLambertMaterial({ map: atlasTex, vertexColors: true, alphaTest: 0.45, side: THREE.DoubleSide });
    const treeDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: atlasTex, alphaTest: 0.45, side: THREE.DoubleSide });
    const TREE_R = [0.3, 0.3, 0.4, 0.45, 0.4, 0.6]; // trunk radius for collisions
    const tHash = new Map();
    const treeList = [];
    {
      const perChunk = new Map();
      const add = (x, z, kind, scale, layer) => {
        const bk = blockKey(x, z) * 2 + (layer === 'bushes' ? 1 : 0);
        let pc = perChunk.get(bk);
        if (!pc) perChunk.set(bk, (pc = { trees: [[], [], [], [], [], [], []], chunk: chunkAt(x, z) }));
        pc.trees[kind].push([x, z, scale, layer]);
        if (kind < 6) {
          hashAdd(tHash, 16, x, z, 1, treeList.length);
          treeList.push([x, z, TREE_R[kind] * scale]);
        }
      };
      for (let k = 0; k < tRaw.length; k += 4) add(tRaw[k] / 2, tRaw[k + 1] / 2, tRaw[k + 2], tRaw[k + 3] / 100, 'trees');
      // Brush and the odd wild oak scattered over the open hills.
      for (let j = 0; j < NZ; j++) {
        for (let i = 0; i < NX; i++) {
          const t = T[j * NX + i];
          if (t !== GT.CHAPARRAL && t !== GT.DRYGRASS) continue;
          const tries = t === GT.CHAPARRAL ? 2 : 1;
          for (let n = 0; n < tries; n++) {
            const h = hash2(i * 3 + n, j * 7 - n);
            if (h > (t === GT.CHAPARRAL ? 0.6 : 0.15)) continue;
            const x = X0 + (i + hash2(i, j + n * 11) - 0.5) * CELL, z = Z0 + (j + hash2(j + n * 5, i) - 0.5) * CELL;
            if (isRoad(x, z) || heightAt(x, z) < 0.6) continue;
            if (h < 0.025 && t === GT.CHAPARRAL) add(x, z, 2, 0.8 + h * 15, 'trees');
            else add(x, z, 6, 0.6 + hash2(j, i * 13 + n) * 0.9, 'bushes');
          }
        }
      }
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3(), yAxis = new THREE.Vector3(0, 1, 0);
      for (const pc of perChunk.values()) {
        const ch = pc.chunk;
        pc.trees.forEach((list, kind) => {
          if (!list.length) return;
          const inst = new THREE.InstancedMesh(treeGeos[kind], treeMat, list.length);
          list.forEach(([x, z, s], i) => {
            q.setFromAxisAngle(yAxis, hash2(Math.round(x * 3), Math.round(z * 3)) * Math.PI * 2);
            inst.setMatrixAt(i, m4.compose(pos.set(x, heightAt(x, z) - 0.15, z), q, scl.set(s, s * (0.9 + hash2(i, kind) * 0.25), s)));
          });
          inst.castShadow = kind !== 6;
          inst.receiveShadow = kind === 6;
          inst.customDepthMaterial = treeDepth;
          inst.computeBoundingSphere();
          addToChunk(ch, list[0][3], inst);
        });
      }
    }
    function hitTree(x, z, rad) {
      const list = tHash.get(segKey(Math.floor(x / 16), Math.floor(z / 16)));
      if (!list) return null;
      for (const id of list) {
        const [tx, tz, tr] = treeList[id];
        const d = Math.hypot(x - tx, z - tz);
        if (d < tr + rad) return { kind: 'tree', nx: (x - tx) / (d || 1), nz: (z - tz) / (d || 1), depth: tr + rad - d };
      }
      return null;
    }

    // -------------------------------------------------------------------------
    // Signs: green street-name blades at corners, big freeway signs
    // -------------------------------------------------------------------------
    await step('Putting up street signs', 0.74);
    const shortName = (s) => s.replace(/\bParkway\b/, 'Pkwy').replace(/\bRoad\b/, 'Rd').replace(/\bDrive\b/, 'Dr')
      .replace(/\bStreet\b/, 'St').replace(/\bAvenue\b/, 'Ave').replace(/\bBoulevard\b/, 'Blvd').replace(/\bHighway\b/, 'Hwy')
      .replace(/\bLane\b/, 'Ln').replace(/\bCircle\b/, 'Cir').replace(/\bPlace\b/, 'Pl').replace(/\bTerrace\b/, 'Ter');
    const bladeCache = new Map();
    function bladeTexture(name) {
      if (bladeCache.has(name)) return bladeCache.get(name);
      const tex = canvasTexture(512, 80, (ctx, w, h) => {
        ctx.fillStyle = '#0d6a3b';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#f4f4ee';
        ctx.lineWidth = 5;
        ctx.strokeRect(6, 6, w - 12, h - 12);
        ctx.fillStyle = '#f4f4ee';
        let size = 50;
        do { ctx.font = `600 ${size}px "Helvetica Neue", Arial, sans-serif`; size -= 2; } while (ctx.measureText(shortName(name)).width > w - 40 && size > 16);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(shortName(name), w / 2, h / 2 + 2);
      });
      bladeCache.set(name, tex);
      return tex;
    }
    const poleMat = new THREE.MeshLambertMaterial({ color: '#7e8487' });
    const bladeBack = new THREE.MeshLambertMaterial({ color: '#0d6a3b' });
    const props = []; // streamed: built when you come near, removed when you leave
    for (const [x, z, angA, angB, na, nb] of map.signs) {
      props.push({
        x, z, range: VIEW.signs,
        build() {
          const g = new THREE.Group();
          const y = heightAt(x, z);
          g.position.set(x, y, z);
          const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.6, 6), poleMat);
          pole.position.y = 1.8;
          g.add(pole);
          [[strings[na], angA, 3.25], [strings[nb], angB, 3.55]].forEach(([name, ang, hgt]) => {
            const mats = [bladeBack, bladeBack, bladeBack, bladeBack,
              new THREE.MeshLambertMaterial({ map: bladeTexture(name) }), new THREE.MeshLambertMaterial({ map: bladeTexture(name) })];
            const blade = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.3, 0.03), mats);
            blade.position.y = hgt;
            blade.rotation.y = -ang;
            g.add(blade);
          });
          return g;
        },
      });
    }
    const gantryMat = new THREE.MeshLambertMaterial({ color: '#9aa0a3' });
    function shield(ctx, cx, cy, size, ref) {
      const num = ref.replace(/^(I|CA|US)-/, '').replace(' Toll', '');
      if (ref.startsWith('I-')) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(cx - size / 2, cy - size / 2);
        ctx.lineTo(cx + size / 2, cy - size / 2);
        ctx.quadraticCurveTo(cx + size * 0.55, cy + size * 0.2, cx, cy + size / 2);
        ctx.quadraticCurveTo(cx - size * 0.55, cy + size * 0.2, cx - size / 2, cy - size / 2);
        ctx.fill();
        ctx.fillStyle = '#1b4aa0';
        ctx.fill();
        ctx.fillStyle = '#c8202e';
        ctx.fillRect(cx - size * 0.46, cy - size * 0.46, size * 0.92, size * 0.2);
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(cx, cy, size * 0.42, size * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0d6a3b';
        ctx.beginPath();
        ctx.ellipse(cx, cy, size * 0.36, size * 0.44, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 ${size * (num.length > 2 ? 0.34 : 0.42)}px "Helvetica Neue", Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(num, cx, cy + size * 0.06);
    }
    for (const [x, z, ang, w, style, lines] of map.gantries) {
      props.push({
        x, z, range: VIEW.gantries,
        build() {
          const g = new THREE.Group();
          const tx = Math.cos(ang), tz = Math.sin(ang), rx = -tz, rz = tx;
          const span = w / 2 + 1.4;
          const y0 = heightAt(x, z);
          g.position.set(x, y0, z);
          for (const s of [-1, 1]) {
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 8, 8), gantryMat);
            post.position.set(rx * span * s, heightAt(x + rx * span * s, z + rz * span * s) - y0 + 4, rz * span * s);
            g.add(post);
          }
          const beam = new THREE.Mesh(new THREE.BoxGeometry(span * 2, 0.5, 0.5), gantryMat);
          beam.position.y = 7.6;
          beam.rotation.y = -Math.atan2(rz, rx);
          g.add(beam);
          const pw = Math.min(10, Math.max(6, w * 0.55)), ph = 3.4;
          const tex = canvasTexture(768, Math.round((768 * ph) / pw), (ctx, cw, chh) => {
            ctx.fillStyle = '#0f6a3a';
            ctx.fillRect(0, 0, cw, chh);
            ctx.strokeStyle = '#f4f4ee';
            ctx.lineWidth = 6;
            ctx.strokeRect(10, 10, cw - 20, chh - 20);
            ctx.fillStyle = '#f4f4ee';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            if (style === 'split') {
              const ref = lines[0].length <= 3 ? (lines[0] === '73' || lines[0] === '133' ? 'CA-' : 'I-') + lines[0] : lines[0];
              shield(ctx, cw / 2, chh * 0.32, chh * 0.42, ref);
              ctx.font = `700 ${chh * 0.13}px "Helvetica Neue", Arial`;
              ctx.fillText(lines[1], cw / 2, chh * 0.63);
              ctx.font = `600 ${chh * 0.15}px "Helvetica Neue", Arial`;
              ctx.fillText(lines[2] || '', cw / 2, chh * 0.82);
            } else {
              ctx.fillStyle = '#f4f4ee';
              ctx.font = `700 ${chh * 0.12}px "Helvetica Neue", Arial`;
              ctx.textAlign = 'right';
              ctx.fillText(lines[0], cw - 34, chh * 0.17);
              ctx.textAlign = 'center';
              const parts = lines[1].split(' / ').slice(0, 2);
              let size = chh * 0.2;
              ctx.font = `600 ${size}px "Helvetica Neue", Arial`;
              while (parts.some((p) => ctx.measureText(p).width > cw - 60) && size > 12) { size -= 2; ctx.font = `600 ${size}px "Helvetica Neue", Arial`; }
              parts.forEach((p, k) => ctx.fillText(p, cw / 2, chh * (parts.length > 1 ? 0.45 + k * 0.24 : 0.55)));
              if (lines[2]) shield(ctx, 70, chh * 0.2, chh * 0.24, lines[2].replace(/ (North|South|East|West)$/, ''));
            }
          });
          const panel = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshLambertMaterial({ map: tex }));
          panel.position.set(rx * w * 0.18, 7.6 + ph / 2 - 0.4, rz * w * 0.18);
          panel.position.addScaledVector(new THREE.Vector3(tx, 0, tz), -0.3);
          panel.rotation.y = Math.atan2(-tx, -tz);
          g.add(panel);
          const back = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshLambertMaterial({ color: '#7a8084' }));
          back.position.copy(panel.position).addScaledVector(new THREE.Vector3(tx, 0, tz), 0.05);
          back.rotation.y = panel.rotation.y + Math.PI;
          g.add(back);
          g.userData.dispose = () => tex.dispose();
          return g;
        },
      });
    }

    // -------------------------------------------------------------------------
    // Landmarks
    // -------------------------------------------------------------------------
    await step('Finding the landmarks', 0.8);
    const lm = (hex) => new THREE.MeshLambertMaterial({ color: hex });
    const landmarks = map.landmarks.map((l) => ({ ...l, y: heightAt(l.x, l.z) }));
    const spinners = [];
    const towardSea = (x, z) => {
      let best = null;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 24) {
        for (let d = 10; d < 220; d += 10) {
          if (groundTypeAt(x + Math.cos(a) * d, z + Math.sin(a) * d) === GT.SEABED) {
            if (!best || d < best.d) best = { a, d };
            break;
          }
        }
      }
      return best || { a: Math.PI, d: 60 };
    };
    const lifeguardTower = (g, x, z, rotY) => {
      const t = new THREE.Group();
      t.position.set(x, heightAt(x, z), z);
      t.rotation.y = rotY;
      for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.2, 0.15), lm('#e9e6dd'));
        leg.position.set(px * 1.1, 1.1, pz * 1.0);
        t.add(leg);
      }
      const hut = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2, 2.6), lm('#2f6db3'));
      hut.position.y = 3.2;
      t.add(hut);
      const win = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.7, 2.7), lm('#1b2a33'));
      win.position.y = 3.6;
      t.add(win);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1, 4), lm('#e9e6dd'));
      roof.position.y = 4.7;
      roof.rotation.y = Math.PI / 4;
      t.add(roof);
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(1, 0.1, 3.2), lm('#c9b48f'));
      ramp.position.set(0, 1.2, 2.6);
      ramp.rotation.x = 0.7;
      t.add(ramp);
      g.add(t);
    };
    const MODELS = {
      beach(l, g) { // Anita Street Beach: wooden stairs down the bluff, a lifeguard tower, umbrellas
        const sea = towardSea(l.x, l.z);
        const dx = Math.cos(sea.a), dz = Math.sin(sea.a);
        const top = heightAt(l.x, l.z);
        const endX = l.x + dx * sea.d * 0.9, endZ = l.z + dz * sea.d * 0.9;
        const bottom = Math.max(1.2, heightAt(endX, endZ));
        const n = Math.max(6, Math.round((top - bottom) / 0.35));
        for (let k = 0; k < n; k++) {
          const t = k / n;
          const x = l.x + (endX - l.x) * t, z = l.z + (endZ - l.z) * t;
          const stepM = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.18, (sea.d * 0.9) / n + 0.05), lm('#8f6b4a'));
          stepM.position.set(x, top + (bottom - top) * t, z);
          stepM.rotation.y = -sea.a + Math.PI / 2;
          g.add(stepM);
        }
        const sx = l.x + dx * (sea.d + 25), sz = l.z + dz * (sea.d + 25);
        lifeguardTower(g, l.x + dx * sea.d * 0.95 - dz * 18, l.z + dz * sea.d * 0.95 + dx * 18, -sea.a + Math.PI / 2);
        const colors = ['#e94f37', '#f6c445', '#2c9fb7', '#f3f0e7', '#55b06a'];
        for (let k = 0; k < 7; k++) {
          const ux = sx - dx * (12 + (k % 3) * 6) + -dz * (k - 3) * 7, uz = sz - dz * (12 + (k % 3) * 6) + dx * (k - 3) * 7;
          const y = heightAt(ux, uz);
          if (y < 0.6) continue;
          const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 5), lm('#dddddd'));
          pole.position.set(ux, y + 1.1, uz);
          const top2 = new THREE.Mesh(new THREE.ConeGeometry(1.2, 0.5, 10), lm(colors[k % colors.length]));
          top2.position.set(ux, y + 2.2, uz);
          const towel = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.02, 1.7), lm(colors[(k + 2) % colors.length]));
          towel.position.set(ux + 1.2, y + 0.03, uz);
          g.add(pole, top2, towel);
        }
        const sign = signBoard('ANITA STREET BEACH', '#2a5d8f', 3.2, 0.7);
        sign.position.set(l.x - dz * 3, top + 2.4, l.z + dx * 3);
        sign.rotation.y = Math.atan2(-dx, -dz);
        g.add(sign);
      },
      lifeguard(l, g) {
        const sea = towardSea(l.x, l.z);
        lifeguardTower(g, l.x + Math.cos(sea.a) * sea.d * 0.6, l.z + Math.sin(sea.a) * sea.d * 0.6, -sea.a + Math.PI / 2);
      },
      gazebo(l, g) {
        const y = heightAt(l.x, l.z);
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3, 6), lm('#f2efe6'));
          post.position.set(l.x + Math.cos(a) * 3, y + 1.5, l.z + Math.sin(a) * 3);
          g.add(post);
        }
        const roof = new THREE.Mesh(new THREE.ConeGeometry(4, 1.8, 8), lm('#9a5b3c'));
        roof.position.set(l.x, y + 3.9, l.z);
        g.add(roof);
      },
      pirate_tower(l, g) {
        const y = Math.max(0.8, heightAt(l.x, l.z));
        const stone = new THREE.MeshLambertMaterial({ color: '#b9a383', map: groundTex });
        const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3, 18, 18), stone);
        tower.position.set(l.x, y + 9, l.z);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(3.3, 4, 18), lm('#6b4a36'));
        roof.position.set(l.x, y + 20, l.z);
        const slit = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.4, 0.3), lm('#1d1a17'));
        slit.position.set(l.x, y + 13, l.z + 2.7);
        g.add(tower, roof, slit);
      },
      hotel_laguna(l, g) {
        const y = heightAt(l.x, l.z);
        const tower = new THREE.Mesh(new THREE.BoxGeometry(5, 19, 5), wallMatPlain('#f3eee2'));
        tower.position.set(l.x, y + 9.5, l.z);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(4.2, 3, 4), lm('#a9512f'));
        roof.position.set(l.x, y + 20.5, l.z);
        roof.rotation.y = Math.PI / 4;
        const sign = signBoard('HOTEL LAGUNA', '#1f3c5a', 4.4, 0.9);
        sign.position.set(l.x, y + 15, l.z + 2.56);
        g.add(tower, roof, sign);
      },
      town_sign(l, g) {
        const y = heightAt(l.x, l.z);
        const wall = new THREE.Mesh(new THREE.BoxGeometry(7, 1.6, 0.8), lm('#cdb894'));
        wall.position.set(l.x, y + 0.8, l.z);
        const sign = signBoard(l.name.toUpperCase(), '#2b3a2f', 6.4, 0.8);
        sign.position.set(l.x, y + 1.0, l.z + 0.42);
        g.add(wall, sign);
        const back = sign.clone();
        back.position.z = l.z - 0.42;
        back.rotation.y = Math.PI;
        g.add(back);
      },
      giant_wheel(l, g) { // the Giant Wheel at Irvine Spectrum: 30 m tall, coloured gondolas
        const y = heightAt(l.x, l.z);
        const R = 14, cy = y + 16.5;
        const steel = lm('#e9edf0');
        const wheel = new THREE.Group();
        wheel.position.set(l.x, cy, l.z);
        for (const zz of [-0.9, 0.9]) {
          const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.18, 6, 64), steel);
          rim.position.z = zz;
          wheel.add(rim);
          for (let k = 0; k < 16; k++) {
            const a = (k / 16) * Math.PI * 2;
            const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, R, 4), steel);
            spoke.position.set(Math.cos(a) * R / 2, Math.sin(a) * R / 2, zz);
            spoke.rotation.z = a - Math.PI / 2;
            wheel.add(spoke);
          }
        }
        const colors = ['#e94f37', '#f6c445', '#2c9fb7', '#55b06a', '#9b5de5', '#f28f3b'];
        const cars = [];
        for (let k = 0; k < 16; k++) {
          const a = (k / 16) * Math.PI * 2;
          const cabin = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.6, 10), lm(colors[k % colors.length]));
          cabin.rotation.x = Math.PI / 2;
          cabin.position.set(Math.cos(a) * R, Math.sin(a) * R - 1.2, 0);
          wheel.add(cabin);
          cars.push([cabin, a]);
        }
        for (const s of [-1, 1]) {
          for (const zz of [-2.5, 2.5]) {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 18.5, 8), steel);
            leg.position.set(l.x + s * 4.5, y + 8, l.z + zz);
            leg.rotation.z = -s * 0.27;
            g.add(leg);
          }
        }
        g.add(wheel);
        spinners.push((t) => {
          wheel.rotation.z = t * 0.06;
          for (const [cabin, a] of cars) cabin.position.set(Math.cos(a) * R, Math.sin(a) * R - 1.2, 0), cabin.rotation.set(Math.PI / 2, 0, -t * 0.06);
        });
      },
      none() {},
    };
    function wallMatPlain(hex) { return new THREE.MeshLambertMaterial({ color: hex }); }
    function signBoard(text, bg, w, h) {
      const tex = canvasTexture(512, Math.round((512 * h) / w), (ctx, cw, chh) => {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, cw, chh);
        ctx.fillStyle = '#f6f2e8';
        let size = chh * 0.6;
        do { ctx.font = `700 ${size}px "Helvetica Neue", Arial`; size -= 2; } while (ctx.measureText(text).width > cw - 30 && size > 10);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, cw / 2, chh / 2 + 2);
      });
      return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: tex }));
    }
    for (const l of landmarks) {
      const g = new THREE.Group();
      (MODELS[l.model] || MODELS.none)(l, g);
      g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      scene.add(g);
      // A floating name tag, like a map pin, that keeps the same size on screen.
      const tex = canvasTexture(512, 96, (ctx, w, h) => {
        ctx.font = '700 40px "Helvetica Neue", Arial';
        const tw = Math.min(w - 20, ctx.measureText(l.name).width + 70);
        const x0 = (w - tw) / 2;
        ctx.fillStyle = 'rgba(16,27,35,0.82)';
        ctx.beginPath();
        ctx.roundRect(x0, 8, tw, 64, 14);
        ctx.fill();
        ctx.fillStyle = '#ff8a3d';
        ctx.beginPath();
        ctx.arc(x0 + 32, 40, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(w / 2 - 12, 70); ctx.lineTo(w / 2 + 12, 70); ctx.lineTo(w / 2, 90);
        ctx.fillStyle = 'rgba(16,27,35,0.82)';
        ctx.fill();
        ctx.fillStyle = '#f3f0e7';
        ctx.textBaseline = 'middle';
        ctx.fillText(l.name, x0 + 54, 41, tw - 66);
      });
      const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, sizeAttenuation: false, depthTest: false, transparent: true }));
      label.scale.set(0.2, 0.0375, 1);
      label.center.set(0.5, 0);
      label.renderOrder = 20;
      label.position.set(l.x, l.y + (l.model === 'giant_wheel' ? 34 : l.model === 'pirate_tower' ? 24 : 12), l.z);
      label.visible = false;
      scene.add(label);
      l.label = label;
    }

    // -------------------------------------------------------------------------
    // Traffic
    // -------------------------------------------------------------------------
    await step('Starting the traffic', 0.86);
    const CAR_TYPES = [
      // length, width, height, chance
      { name: 'sedan', L: 4.7, W: 1.83, Hh: 1.45, p: 0.34 },
      { name: 'suv', L: 4.85, W: 1.95, Hh: 1.75, p: 0.28 },
      { name: 'pickup', L: 5.6, W: 2.0, Hh: 1.9, p: 0.13 },
      { name: 'van', L: 5.1, W: 2.0, Hh: 1.8, p: 0.1 },
      { name: 'truck', L: 7.4, W: 2.4, Hh: 3.3, p: 0.05 },
      { name: 'sports', L: 4.4, W: 1.9, Hh: 1.22, p: 0.1 },
    ];
    const PAINT = ['#f3f3f1', '#f3f3f1', '#f3f3f1', '#161819', '#161819', '#b9bcbf', '#b9bcbf', '#7d8186', '#7d8186',
      '#1f3f74', '#8e1d1d', '#c7c9c5', '#2a2d33', '#3e5a48', '#d36b2a', '#f1d9a7'].map(C);
    const carMats = {
      body: new THREE.MeshLambertMaterial({ color: '#ffffff' }),
      detail: new THREE.MeshLambertMaterial({ vertexColors: true }),
      lights: new THREE.MeshBasicMaterial({ vertexColors: true }),
    };
    function carGeometry(type) {
      const { L, W, Hh, name } = type;
      const body = new Buf(), detail = new Buf(), lights = new Buf();
      const m = new THREE.Matrix4();
      const white = C('#ffffff'), glass = C('#1c262e'), tyre = C('#16181a'), trim = C('#2b2e31'), rim = C('#9ea4a8');
      const boxAt = (b, w, h, d, x, y, z, col, rx = 0) => b.add(new THREE.BoxGeometry(w, h, d), m.makeTranslation(x, y, z).multiply(new THREE.Matrix4().makeRotationX(rx)), col);
      const wr = name === 'truck' ? 0.5 : name === 'sports' ? 0.33 : 0.36;
      const axle = name === 'truck' ? L * 0.34 : L * 0.31;
      for (const s of [-1, 1]) {
        for (const zz of [-axle, axle * (name === 'truck' ? 0.85 : 1)]) {
          detail.add(new THREE.CylinderGeometry(wr, wr, 0.26, 12), m.makeTranslation(s * (W / 2 - 0.14), wr, zz).multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2)), tyre);
          detail.add(new THREE.CylinderGeometry(wr * 0.6, wr * 0.6, 0.27, 10), m.makeTranslation(s * (W / 2 - 0.13), wr, zz).multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2)), rim);
        }
      }
      const lowH = name === 'sports' ? 0.55 : name === 'truck' ? 1.0 : Hh * 0.45;
      const lowY = wr + lowH / 2 - 0.08;
      if (name === 'truck') {
        boxAt(body, W, 2.0, 2.2, 0, wr + 1.0, -L / 2 + 1.1, white);              // cab
        boxAt(detail, W * 0.96, 0.75, 0.1, 0, wr + 1.5, -L / 2 - 0.02, glass);  // windscreen
        boxAt(detail, W, 2.6, L - 2.5, 0, wr + 1.5, 1.2, C('#efefea'));          // cargo box
        boxAt(detail, W * 0.9, 0.3, L, 0, wr + 0.05, 0, trim);
      } else {
        boxAt(body, W, lowH, L, 0, lowY, 0, white);
        const cabL = name === 'van' ? L * 0.8 : name === 'pickup' ? L * 0.36 : name === 'sports' ? L * 0.42 : name === 'suv' ? L * 0.62 : L * 0.5;
        const cabZ = name === 'van' ? 0.25 : name === 'pickup' ? -L * 0.06 : name === 'suv' ? L * 0.06 : L * 0.04;
        const cabH = Hh - (lowY + lowH / 2);
        boxAt(detail, W * 0.9, cabH * 0.86, cabL, 0, lowY + lowH / 2 + cabH * 0.43, cabZ, glass);
        boxAt(body, W * 0.86, 0.07, cabL * 0.84, 0, Hh - 0.03, cabZ, white);
        for (const s of [-1, 1]) boxAt(body, 0.07, cabH * 0.86, 0.12, s * W * 0.44, lowY + lowH / 2 + cabH * 0.43, cabZ - cabL / 2 + 0.06, white);
        if (name === 'pickup') {
          for (const s of [-1, 1]) boxAt(body, 0.08, 0.5, L * 0.38, s * (W / 2 - 0.04), lowY + lowH / 2 + 0.25, L * 0.29, white);
          boxAt(body, W, 0.5, 0.08, 0, lowY + lowH / 2 + 0.25, L / 2 - 0.04, white);
        }
        boxAt(detail, W * 1.01, 0.22, 0.18, 0, wr + 0.1, -L / 2, trim); // bumpers
        boxAt(detail, W * 1.01, 0.22, 0.18, 0, wr + 0.1, L / 2, trim);
      }
      const ly = name === 'truck' ? wr + 0.4 : lowY + lowH * 0.25;
      for (const s of [-1, 1]) {
        boxAt(lights, 0.34, 0.14, 0.04, s * (W / 2 - 0.25), ly, -L / 2 - 0.02, C('#fff4d6'));
        boxAt(lights, 0.34, 0.14, 0.04, s * (W / 2 - 0.25), ly, L / 2 + 0.02, C('#e8332a'));
      }
      return { body: body.geometry(), detail: detail.geometry(), lights: lights.geometry() };
    }
    const carMeshes = CAR_TYPES.map((type) => {
      const g = carGeometry(type);
      const meshes = ['body', 'detail', 'lights'].map((part) => {
        const inst = new THREE.InstancedMesh(g[part], carMats[part], MAX_CARS);
        inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        inst.castShadow = part !== 'lights';
        inst.frustumCulled = false;
        inst.count = 0;
        scene.add(inst);
        return inst;
      });
      return { type, meshes, used: 0 };
    });
    const cars = [];
    const DRIVABLE = (road) => road.len > 25 && road.base !== 'living_street';
    const laneOffset = (road, lane) => {
      if (road.base === 'motorway' && !road.link) return -road.hw + 1.5 + (lane + 0.5) * 3.7;
      if (road.oneway) return -road.hw + 0.4 + (lane + 0.5) * Math.min(3.6, (road.w - 1.6) / Math.max(1, road.lanes));
      if (['residential', 'unclassified'].includes(road.base)) return Math.min(2.4, road.hw * 0.45);
      const per = Math.max(1, Math.floor(road.lanes / 2));
      const center = road.lanes % 2 === 1 && road.lanes >= 3 ? 1.8 : 0.2;
      return Math.min(road.hw - 1.2, center + (Math.min(lane, per - 1) + 0.5) * 3.5);
    };
    const lanesPerDir = (road) => (road.oneway ? Math.max(1, road.lanes) : Math.max(1, Math.floor(road.lanes / 2)));
    const rp = {};
    const carRng = rng(2024);
    function spawnCar(px, pz, fx, fz, near) {
      // Find a drivable road segment some way from the player, preferably out of sight.
      for (let tries = 0; tries < 30; tries++) {
        const ang = carRng() * Math.PI * 2, dist = near ? 60 + carRng() * 400 : 220 + carRng() * 500;
        const x = px + Math.cos(ang) * dist, z = pz + Math.sin(ang) * dist;
        if (!near && (Math.cos(ang) * fx + Math.sin(ang) * fz) > 0.55 && dist < 450) continue;
        const hit = nearestRoad(x, z, 120, (r) => DRIVABLE(r) && (r.base !== 'residential' || carRng() < 0.15));
        if (!hit) continue;
        const road = hit.road;
        const dir = road.oneway ? 1 : carRng() < 0.5 ? 1 : -1;
        const type = (() => { let u = carRng(); for (const t of CAR_TYPES) { u -= t.p; if (u <= 0) return t; } return CAR_TYPES[0]; })();
        const lane = Math.floor(carRng() * lanesPerDir(road));
        const car = {
          road, s: hit.s, dir, lane, off: laneOffset(road, lane), type, color: pick(carRng, PAINT),
          speed: 0, cruise: road.mph * 0.447 * (0.9 + carRng() * 0.22), x: 0, y: 0, z: 0, yaw: 0, pitch: 0, vx: 0, vz: 0, fresh: true,
        };
        car.speed = car.cruise * 0.8;
        cars.push(car);
        return car;
      }
      return null;
    }
    // At a junction: carry on, or turn onto one of the roads that meet here.
    function chooseNext(car, p) {
      const members = car.road.junctions.get(p);
      if (!members) return false;
      const options = [];
      for (const [r2, p2] of members) {
        const road = roads[r2];
        if (!DRIVABLE(road)) continue;
        const weight = road.base === 'residential' ? 0.12 : road.link ? 0.5 : 1;
        if (r2 === car.road.id) continue;
        if (p2 < road.n - 1) options.push([road, p2, 1, weight]);
        if (p2 > 0 && !road.oneway) options.push([road, p2, -1, weight]);
      }
      const atEnd = car.dir > 0 ? p >= car.road.n - 1 : p <= 0;
      if (!atEnd) options.push([car.road, p, car.dir, 3]);
      if (!options.length) return false;
      let total = options.reduce((a, o) => a + o[3], 0), u = carRng() * total;
      for (const [road, p2, dir, w] of options) {
        u -= w;
        if (u > 0) continue;
        if (road !== car.road) {
          car.road = road;
          car.dir = dir;
          car.s = road.cum[p2] + dir * 0.01;
          car.lane = Math.min(car.lane, lanesPerDir(road) - 1);
          car.cruise = road.mph * 0.447 * (0.9 + carRng() * 0.22);
        }
        return true;
      }
      return true;
    }
    const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e4 = new THREE.Euler(0, 0, 0, 'YXZ'), p4 = new THREE.Vector3(), s4 = new THREE.Vector3(1, 1, 1);
    let trafficOn = true;
    function updateTraffic(dt, player) {
      // Keep the right number of cars around the player.
      const want = trafficOn ? MAX_CARS : 0;
      for (let i = cars.length - 1; i >= 0; i--) {
        const c = cars[i];
        if (!trafficOn || Math.hypot(c.x - player.x, c.z - player.z) > 950) cars.splice(i, 1);
      }
      for (let n = 0; n < 4 && cars.length < want; n++) spawnCar(player.x, player.z, -Math.sin(player.yaw), -Math.cos(player.yaw), cars.length < want * 0.5);
      for (const c of cars) {
        // Slow down for whatever is ahead in the same lane: another car or the player.
        let limit = c.cruise;
        const hx = -Math.sin(c.yaw), hz = -Math.cos(c.yaw);
        const check = (ox, oz, ov) => {
          const rx = ox - c.x, rz = oz - c.z;
          const ahead = rx * hx + rz * hz;
          if (ahead <= 0 || ahead > 34) return;
          const side = Math.abs(rx * -hz + rz * hx);
          if (side > 1.7) return;
          const gap = ahead - c.type.L / 2 - 3;
          limit = Math.min(limit, Math.max(0, ov + gap * 0.6));
        };
        for (const o of cars) if (o !== c && Math.abs(o.x - c.x) < 36 && Math.abs(o.z - c.z) < 36) check(o.x, o.z, o.speed * Math.max(0, (-Math.sin(o.yaw)) * hx + (-Math.cos(o.yaw)) * hz));
        check(player.x, player.z, Math.max(0, player.speed));
        c.speed += Math.max(-8, Math.min(2.5, (limit - c.speed) * 1.5)) * dt;
        c.speed = Math.max(0, c.speed);
        // Move along the road, crossing junctions as they come.
        const road0 = c.road;
        roadPoint(c.road, c.s, rp);
        const segBefore = rp.seg;
        c.s += c.dir * c.speed * dt;
        if (c.s < 0 || c.s > c.road.len) {
          const p = c.s < 0 ? 0 : c.road.n - 1;
          if (!chooseNext(c, p)) {
            if (!c.road.oneway) { c.dir = -c.dir; c.s = Math.max(0, Math.min(c.road.len, c.s)); }
            else { c.dead = true; continue; }
          }
        } else if (c.road === road0) {
          roadPoint(c.road, c.s, rp);
          const p = c.dir > 0 ? rp.seg : rp.seg + 1;
          if (rp.seg !== segBefore && c.road.junctions.has(p) && carRng() < 0.35) chooseNext(c, p);
        }
        roadPoint(c.road, c.s, rp);
        const dx = rp.dx * c.dir, dz = rp.dz * c.dir;
        const target = laneOffset(c.road, c.lane);
        c.off += Math.max(-1.5 * dt, Math.min(1.5 * dt, target - c.off));
        const x = rp.x - dz * c.off, z = rp.z + dx * c.off;
        const yawT = Math.atan2(-dx, -dz);
        let dy = yawT - c.yaw;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        c.yaw = c.fresh ? yawT : c.yaw + dy * Math.min(1, dt * 6);
        c.fresh = false;
        c.vx = (x - c.x) / dt; c.vz = (z - c.z) / dt;
        c.x = x; c.z = z;
        const half = c.type.L * 0.4;
        const hf = roadHeight(c.road, c.s + c.dir * half), hb = roadHeight(c.road, c.s - c.dir * half);
        c.y = roadHeight(c.road, c.s) + c.road.lift + 0.01;
        c.pitch = Math.atan2(hf - hb, half * 2);
      }
      for (let i = cars.length - 1; i >= 0; i--) if (cars[i].dead) cars.splice(i, 1);
      // Write the instance matrices.
      for (const cm of carMeshes) cm.used = 0;
      for (const c of cars) {
        const cm = carMeshes[CAR_TYPES.indexOf(c.type)];
        const k = cm.used++;
        q4.setFromEuler(e4.set(c.pitch, c.yaw, 0));
        m4.compose(p4.set(c.x, c.y, c.z), q4, s4);
        for (const mesh of cm.meshes) mesh.setMatrixAt(k, m4);
        cm.meshes[0].setColorAt(k, c.color);
      }
      for (const cm of carMeshes) {
        for (const mesh of cm.meshes) {
          mesh.count = cm.used;
          mesh.instanceMatrix.needsUpdate = true;
          if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        }
      }
    }
    // Is the point (with radius) inside a car? Returns the car.
    function hitCar(x, z, y, rad) {
      for (const c of cars) {
        const dx = x - c.x, dz = z - c.z;
        if (Math.abs(dx) > 8 || Math.abs(dz) > 8) continue;
        if (y > c.y + c.type.Hh + 0.3) continue;
        const hx = -Math.sin(c.yaw), hz = -Math.cos(c.yaw);
        const along = dx * hx + dz * hz, side = dx * -hz + dz * hx;
        if (Math.abs(along) < c.type.L / 2 + rad && Math.abs(side) < c.type.W / 2 + rad) return c;
      }
      return null;
    }

    // -------------------------------------------------------------------------
    // Time of day
    // -------------------------------------------------------------------------
    let timeName = 'day';
    let envMap = null;
    function setTime(name) {
      const t = TIMES[name] || TIMES.day;
      timeName = TIMES[name] ? name : 'day';
      const el = THREE.MathUtils.degToRad(t.sunEl), az = THREE.MathUtils.degToRad(t.sunAz);
      sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
      sun.color.set(t.sun);
      sun.intensity = t.sunI;
      hemi.color.set(t.hemiSky);
      hemi.groundColor.set(t.hemiGround);
      hemi.intensity = t.hemiI;
      const u = skyMat.uniforms;
      u.uZenith.value.set(t.zenith); u.uHorizon.value.set(t.horizon); u.uGround.value.set(t.ground);
      u.uSunColor.value.set(t.sun); u.uCloud.value.set(t.cloud); u.uCloudShade.value.set(t.cloudShade); u.uCover.value = t.cover;
      const o = oceanMat.uniforms;
      o.uSunColor.value.set(t.sun); o.uSky.value.set(t.zenith); o.uHorizon.value.set(t.horizon);
      o.uDeep.value.set(t.deep); o.uShallow.value.set(t.shallow); o.uFogColor.value.set(t.fog);
      o.uFogNear.value = t.fogNear; o.uFogFar.value = t.fogFar;
      // A low sun hits walls at a grazing angle, which makes speckled "shadow
      // acne"; push the shadow test further off the surface when it's low.
      sun.shadow.normalBias = t.sunEl < 15 ? 0.14 : 0.05;
      sun.shadow.bias = t.sunEl < 15 ? -0.0012 : -0.0005;
      scene.fog.color.set(t.fog);
      scene.fog.near = t.fogNear;
      scene.fog.far = t.fogFar;
      scene.background = scene.fog.color;
      facadeUniforms.uNight.value = t.night;
      carMats.lights.color.setScalar(1 + t.night * 0.6);
      // Reflections for the shiny bike parts: render the sky into an environment map.
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envScene = new THREE.Scene();
      const envSky = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), skyMat);
      envScene.add(envSky);
      const ground = new THREE.Mesh(new THREE.CircleGeometry(90, 24), new THREE.MeshBasicMaterial({ color: t.ground }));
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -8;
      envScene.add(ground);
      const target = pmrem.fromScene(envScene, 0.02);
      pmrem.dispose();
      if (envMap) envMap.dispose();
      envMap = target.texture;
      world.envMap = envMap;
      return t;
    }

    // -------------------------------------------------------------------------
    // Cities and the minimap
    // -------------------------------------------------------------------------
    const CITY = map.cities;
    function cityAt(x, z) {
      const i = Math.round((x - X0) / CITY.cell), j = Math.round((z - Z0) / CITY.cell);
      if (i < 0 || j < 0 || i >= CITY.nx || j >= CITY.nz) return '';
      return CITY.names[cityGrid[j * CITY.nx + i]] || '';
    }
    const ROAD_STYLE = (road) => (road.base === 'motorway' ? ['#f3b54a', 2.6] : road.base === 'trunk' || road.base === 'primary' ? ['#f2efe6', 2.0]
      : road.base === 'secondary' || road.base === 'tertiary' ? ['#d9d4c8', 1.6] : ['#8d969c', 1.0]);
    function drawMinimap(ctx, size, x, z, yaw, radius, extras = []) {
      const k = size / 2 / radius;
      ctx.save();
      ctx.clearRect(0, 0, size, size);
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = '#26332c';
      ctx.fillRect(0, 0, size, size);
      ctx.translate(size / 2, size / 2);
      ctx.rotate(yaw);          // heading-up
      ctx.scale(k, k);
      ctx.translate(-x, -z);
      // ocean
      ctx.fillStyle = '#2f6f93';
      const i0 = Math.max(0, Math.floor((x - radius * 1.5 - X0) / CELL)), i1 = Math.min(NX - 1, Math.ceil((x + radius * 1.5 - X0) / CELL));
      const j0 = Math.max(0, Math.floor((z - radius * 1.5 - Z0) / CELL)), j1 = Math.min(NZ - 1, Math.ceil((z + radius * 1.5 - Z0) / CELL));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (T[j * NX + i] === GT.SEABED) ctx.fillRect(X0 + i * CELL - CELL / 2, Z0 + j * CELL - CELL / 2, CELL + 1, CELL + 1);
      ctx.lineCap = 'round';
      const order = [];
      forEachSegmentNear(x, z, radius * 1.5, (road, i, ax, az, bx, bz) => order.push([road, ax, az, bx, bz]));
      order.sort((a, b) => b[0].k - a[0].k);
      for (const [road, ax, az, bx, bz] of order) {
        const [color, w] = ROAD_STYLE(road);
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(w / k, road.w * 0.9);
        ctx.beginPath();
        ctx.moveTo(ax, az);
        ctx.lineTo(bx, bz);
        ctx.stroke();
      }
      for (const l of landmarks) {
        if (Math.abs(l.x - x) > radius * 1.5 || Math.abs(l.z - z) > radius * 1.5) continue;
        ctx.fillStyle = '#ff8a3d';
        ctx.beginPath();
        ctx.arc(l.x, l.z, 4.5 / k, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const c of cars) {
        if (Math.abs(c.x - x) > radius * 1.5 || Math.abs(c.z - z) > radius * 1.5) continue;
        ctx.fillStyle = '#e8eef2';
        ctx.fillRect(c.x - 2 / k, c.z - 2 / k, 4 / k, 4 / k);
      }
      for (const [ex, ez, color] of extras) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(ex, ez, 5 / k, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    // The whole map, for the M key. Drawn once and kept.
    let overview = null;
    function overviewCanvas() {
      if (overview) return overview;
      const scale = 1 / 9; // pixels per metre
      const w = Math.round((XMAX - X0) * scale), h = Math.round((ZMAX - Z0) * scale);
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const ctx = cv.getContext('2d');
      const img = ctx.createImageData(NX, NZ);
      const LAND = [[96, 102, 72], [150, 132, 92], [108, 128, 82], [214, 198, 156], [140, 120, 96], [150, 146, 138], [47, 111, 147], [96, 136, 74]];
      for (let k = 0; k < NX * NZ; k++) {
        const c = LAND[T[k]];
        const shade = T[k] === GT.SEABED ? 1 : Math.min(1.25, 0.8 + H[k] / 400);
        img.data[k * 4] = c[0] * shade; img.data[k * 4 + 1] = c[1] * shade; img.data[k * 4 + 2] = c[2] * shade; img.data[k * 4 + 3] = 255;
      }
      const tmp = document.createElement('canvas');
      tmp.width = NX; tmp.height = NZ;
      tmp.getContext('2d').putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(tmp, 0, 0, w, h);
      ctx.lineCap = 'round';
      const sorted = [...roads].sort((a, b) => b.k - a.k);
      for (const road of sorted) {
        const [color, lw] = ROAD_STYLE(road);
        ctx.strokeStyle = color;
        ctx.lineWidth = road.base === 'residential' || road.base === 'unclassified' ? 0.8 : lw;
        ctx.beginPath();
        for (let i = 0; i < road.n; i++) {
          const px = (road.pts[2 * i] - X0) * scale, pz = (road.pts[2 * i + 1] - Z0) * scale;
          if (i) ctx.lineTo(px, pz); else ctx.moveTo(px, pz);
        }
        ctx.stroke();
      }
      overview = { canvas: cv, scale, toWorld: (px, py) => [X0 + px / scale, Z0 + py / scale], toMap: (wx, wz) => [(wx - X0) * scale, (wz - Z0) * scale] };
      return overview;
    }

    // -------------------------------------------------------------------------
    // Per-frame update
    // -------------------------------------------------------------------------
    let clock = 0, visT = 0, propT = 0;
    const LAYERS = Object.keys(VIEW);
    const live = new Set();
    function updateVisibility(cam) {
      for (const ch of chunks) {
        const dx = Math.max(0, Math.abs(cam.x - ch.x) - TILE * CELL / 2), dz = Math.max(0, Math.abs(cam.z - ch.z) - TILE * CELL / 2);
        const d = Math.hypot(dx, dz);
        for (const layer of LAYERS) {
          const list = ch.layers[layer];
          if (!list) continue;
          let show = d < VIEW[layer];
          if (layer === 'terrainLo') show = !(d < VIEW.terrainHi) && d < VIEW.terrainLo;
          for (const m of list) m.visible = show;
        }
      }
    }
    function updateProps(cam) {
      for (const p of props) {
        const d = Math.hypot(cam.x - p.x, cam.z - p.z);
        if (d < p.range && !p.obj) {
          p.obj = p.build();
          scene.add(p.obj);
          live.add(p);
        } else if (d > p.range * 1.25 && p.obj) {
          scene.remove(p.obj);
          p.obj.traverse((o) => {
            if (o.isMesh) {
              o.geometry.dispose();
              for (const mt of [].concat(o.material)) if (mt !== poleMat && mt !== bladeBack && mt !== gantryMat) mt.dispose();
            }
          });
          if (p.obj.userData.dispose) p.obj.userData.dispose();
          p.obj = null;
          live.delete(p);
        }
      }
    }

    const world = {
      map, roads, landmarks, spawns: map.spawns, times: TIMES,
      bounds: { x0: X0 + 40, z0: Z0 + 40, x1: XMAX - 40, z1: ZMAX - 40 },
      heightAt, groundTypeAt, GT, nearestRoad, isRoad, cityAt, hitBuilding, hitTree, hitCar,
      roadPoint, roadHeight, cars, drawMinimap, overviewCanvas, envMap: null,
      debug: { terrainMat, roadMats, chunks },
      get time() { return timeName; },
      setTime,
      setTraffic(on) { trafficOn = on; },
      // Ground surface under a point: height and how grippy it is.
      surfaceAt(x, z) {
        const rs = roadSurface(x, z);
        if (rs) return { y: rs.y, road: rs.road, walk: !rs.road, grip: 1, drag: rs.road ? 0 : 0.1 };
        const y = heightAt(x, z);
        if (y < -0.05 && groundTypeAt(x, z) === GT.SEABED) return { y: -0.45, water: true, grip: 3, drag: 4 };
        const t = groundTypeAt(x, z);
        const drag = [2.0, 1.2, 0.8, 3.5, 2.4, 0.2, 4, 0.8][t];
        return { y, grip: [1.2, 1.25, 1.3, 1.6, 1.0, 1.0, 3, 1.3][t], drag, type: t };
      },
      update(dt, player, camera) {
        clock += dt;
        skyMat.uniforms.uTime.value = clock;
        oceanMat.uniforms.uTime.value = clock;
        sky.position.copy(camera.position);
        // The sun's shadow box follows the player, snapped to whole texels so edges don't shimmer.
        const snap = 120 / 2048;
        const sx = Math.round(player.x / snap) * snap, sz = Math.round(player.z / snap) * snap;
        sun.target.position.set(sx, player.y, sz);
        sun.position.set(sx + sunDir.x * 300, player.y + sunDir.y * 300, sz + sunDir.z * 300);
        sun.target.updateMatrixWorld();
        visT -= dt;
        if (visT <= 0) { visT = 0.2; updateVisibility(camera.position); }
        propT -= dt;
        if (propT <= 0) { propT = 0.5; updateProps(camera.position); }
        updateTraffic(Math.min(dt, 0.05), player);
        for (const spin of spinners) spin(clock);
        for (const l of landmarks) {
          const d = Math.hypot(camera.position.x - l.x, camera.position.z - l.z);
          l.label.visible = d < VIEW.labels && d > 18;
          l.dist = Math.hypot(player.x - l.x, player.z - l.z);
        }
      },
      resetTraffic() { cars.length = 0; },
    };
    setTime('day');
    await step('Ready', 1);
    return world;
  };
})();
