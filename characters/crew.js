/*
  Alex's crew: the five characters from the sketch page (sketches/), built as 3D models.

  Every character comes in three looks, each one mixing the references in styles/:
    toon    flat bright color, big round eyes, blush and a thick ink outline
    galaxy  glossy and glowing, with sparkles and blush
    carlo   (shown as "Painted") googly eyes, screaming mouths, fuzz, painted hatching, wobbly line, cut-out timing

  This is a plain script, not a module, so pages still work when opened straight from disk.
  Inside a module:
    const Crew = makeCrew(THREE, { DecalGeometry, mergeVertices });
    const ember = Crew.build("ember", "galaxy", { pose: "drive", hat: "crown" });
    scene.add(ember);
    ember.userData.tick(dt, time, { speed, steer, hands: [leftHandWorld, rightHandWorld] });

  Characters are about 1 unit tall, stand on y = 0 and face +Z.
*/
(function () {
  window.makeCrew = function (THREE, { DecalGeometry, mergeVertices }) {
    const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
    const UP = V(0, 1, 0);
    const INK = 0x1c1424, INK_CSS = "#1c1424";

    const CHARACTERS = [
      { id: "jimbob", name: "Jimbob", kind: "Slime ball", blurb: "A big, wobbly ball of slime with curly drips around the bottom. One eye sits up high and the other down low, just like the drawing." },
      { id: "srank", name: "Srank", kind: "Star", blurb: "A squishy star with a little ω mouth, a swirl on one cheek and a heart on the other." },
      { id: "jimmy", name: "Jimmy", kind: "Cat", blurb: "A loaf-shaped cat with pointy ears and a cat mouth with its tongue out." },
      { id: "ember", name: "Ember", kind: "Flame", blurb: "A drop of fire with two big black eyes. No mouth in the drawing, so Ember only gets one in some looks." },
      { id: "bernie", name: "Bernie", kind: "Stegosaurus", blurb: "A stubby stegosaurus in a bowler hat. He was almost named Sprout." }
    ];
    const LOOKS = [
      { id: "toon", name: "Toon", note: "Flat, bright colors, big round eyes and blush, with a thick ink outline." },
      { id: "galaxy", name: "Galaxy", note: "Glossy and glowing, with sparkles and soft blush." },
      { id: "carlo", name: "Painted", note: "Googly eyes, screaming mouths, fuzz, painted hatching and a wobbly line. Moves on twos like cut-out animation." }
    ];
    const PAL = {
      jimbob: { toon: [0xff8cc6, 0xff5fa8], galaxy: [0xb48cff, 0x7fe8ff], carlo: [0xa6e84a, 0x8b5cf6] },
      srank: { toon: [0xffd23f, 0xff9f1c], galaxy: [0xffe45c, 0xfff3b0], carlo: [0xff6fb5, 0x3fd0c9] },
      jimmy: { toon: [0x6ec4f0, 0xff9fc0], galaxy: [0xbfa8ff, 0xff9fd6], carlo: [0xd9822b, 0xff8fb1] },
      ember: { toon: [0xff7a2f, 0xffc94d], galaxy: [0x6f86ff, 0xc7a4ff], carlo: [0xc04cff, 0x52e0ff] },
      bernie: { toon: [0x7ed957, 0xff8a3d], galaxy: [0x5fe08a, 0xff7ad9], carlo: [0x3fc1b0, 0xff7ab8] }
    };

    // ---------- Materials ----------
    const cache = new Map();
    const once = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };

    function ramp(levels) {
      const data = new Uint8Array(levels.length * 4);
      levels.forEach((v, i) => data.set([v, v, v, 255], i * 4));
      const t = new THREE.DataTexture(data, levels.length, 1);
      t.minFilter = t.magFilter = THREE.NearestFilter;
      t.generateMipmaps = false;
      t.needsUpdate = true;
      return t;
    }
    const RAMP = { toon: ramp([135, 205, 255]), carlo: ramp([120, 190, 255]) };

    const NOISE = `
      float crewHash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      float crewNoise(vec3 p) {
        vec3 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(crewHash(i), crewHash(i + vec3(1.0, 0.0, 0.0)), f.x), mix(crewHash(i + vec3(0.0, 1.0, 0.0)), crewHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
                   mix(mix(crewHash(i + vec3(0.0, 0.0, 1.0)), crewHash(i + vec3(1.0, 0.0, 1.0)), f.x), mix(crewHash(i + vec3(0.0, 1.0, 1.0)), crewHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
      }
    `;
    // Fuzz: random spikes along the normal, kept off the front so faces stay clean.
    const FUZZ = "(3.5 * pow(crewHash(floor(position * 36.0)), 3.0) * smoothstep(0.75, 0.2, normal.z))";

    // Carlo look: painted color wash, purple patches and pencil hatching in the shadows.
    function painted(m, { stripes = false, fuzz = 0 } = {}) {
      m.onBeforeCompile = s => {
        s.vertexShader = "varying vec3 vCrewPos;\n" + NOISE + s.vertexShader.replace("#include <begin_vertex>",
          `#include <begin_vertex>
          vCrewPos = position;
          ${fuzz ? `transformed += normal * ${fuzz.toFixed(4)} * ${FUZZ};` : ""}`);
        s.fragmentShader = "varying vec3 vCrewPos;\n" + NOISE + s.fragmentShader
          .replace("#include <color_fragment>", `#include <color_fragment>
            float wash = crewNoise(vCrewPos * 6.0) * 0.6 + crewNoise(vCrewPos * 17.0) * 0.4;
            diffuseColor.rgb *= 0.84 + 0.3 * wash;
            diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.86, 0.8, 1.18), smoothstep(0.55, 0.85, crewNoise(vCrewPos * 2.5 + 7.0)));
            ${stripes ? `float band = sin(vCrewPos.y * 30.0 + atan(vCrewPos.x, vCrewPos.z) * 3.0);
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.9, 1.0), smoothstep(0.3, 0.5, band) * 0.8);` : ""}`)
          .replace("#include <opaque_fragment>", `
            float crewLum = dot(outgoingLight, vec3(0.3, 0.59, 0.11)) / max(0.05, dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)));
            float crewDark = 1.0 - smoothstep(0.5, 1.1, crewLum);
            float h1 = 1.0 - smoothstep(0.05, 0.13, abs(fract(dot(vCrewPos, vec3(44.0, 36.0, 12.0))) - 0.5));
            float h2 = 1.0 - smoothstep(0.05, 0.13, abs(fract(dot(vCrewPos, vec3(-40.0, 34.0, 16.0))) - 0.5));
            outgoingLight *= 1.0 - 0.55 * (h1 * smoothstep(0.05, 0.4, crewDark) + h2 * smoothstep(0.5, 0.9, crewDark));
            #include <opaque_fragment>`);
      };
      m.customProgramCacheKey = () => `crew-paint-${stripes}-${fuzz}`;
      return m;
    }

    function skin(look, color, o = {}) {
      return once(`skin:${look}:${color}:${o.glow ?? "-"}:${o.stripes ? 1 : 0}:${o.fuzz || 0}`, () => {
        if (look === "galaxy") {
          return new THREE.MeshPhysicalMaterial({
            color, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.18, sheen: 0.7, sheenRoughness: 0.45,
            sheenColor: new THREE.Color(0xffffff), emissive: color, emissiveIntensity: o.glow ?? 0.3
          });
        }
        const m = new THREE.MeshToonMaterial({ color, gradientMap: RAMP[look], emissive: o.glow ? color : 0x000000, emissiveIntensity: o.glow || 0 });
        return look === "carlo" ? painted(m, o) : m;
      });
    }
    const flat = color => once("flat:" + color, () => new THREE.MeshBasicMaterial({ color }));
    const glossBlack = () => once("glossBlack", () => new THREE.MeshPhysicalMaterial({ color: 0x0c0a14, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 }));

    // Ink outline: a back-facing shell pushed out along the normals.
    const INK_W = { toon: 0.014, carlo: 0.016, galaxy: 0 };
    function inkMat(w, mode) {
      return once(`ink:${w}:${mode}`, () => {
        const m = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
        const amount = mode === "fuzz" ? `(1.0 + ${FUZZ})` : mode === "wobble" ? "(0.45 + 1.1 * crewNoise(position * 9.0))" : "1.0";
        m.onBeforeCompile = s => {
          s.vertexShader = NOISE + s.vertexShader.replace("#include <begin_vertex>", `vec3 transformed = position + normal * ${w.toFixed(4)} * ${amount};`);
        };
        m.customProgramCacheKey = () => `crew-ink-${w}-${mode}`;
        return m;
      });
    }
    // Galaxy glow: an additive fresnel shell, bright at the edges.
    function rimMat(color) {
      return once("rim:" + color, () => new THREE.ShaderMaterial({
        uniforms: { c: { value: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.35) } },
        vertexShader: `varying vec3 n; varying vec3 v;
          void main() { vec4 mv = modelViewMatrix * vec4(position + normal * 0.006, 1.0); n = normalize(normalMatrix * normal); v = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `uniform vec3 c; varying vec3 n; varying vec3 v;
          void main() { float f = pow(1.0 - abs(dot(normalize(n), normalize(v))), 2.4); gl_FragColor = vec4(c * f * 1.6, 1.0); }`,
        blending: THREE.AdditiveBlending, transparent: true, depthWrite: false
      }));
    }

    // Smooth, welded copy of a geometry: outlines and fuzz need one normal per corner or they crack.
    const welded = new WeakMap();
    function smoothGeo(geo) {
      if (!welded.has(geo)) {
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", geo.attributes.position.clone());
        if (geo.index) g.setIndex(geo.index.clone());
        const m = mergeVertices(g, 1e-4);
        m.computeVertexNormals();
        welded.set(geo, m);
      }
      return welded.get(geo);
    }
    function weld(geo) { return smoothGeo(geo); }

    // ---------- Drawn face parts (stuck on with decals) ----------
    function tex(key, draw) {
      return once("tex:" + key, () => {
        const c = document.createElement("canvas");
        c.width = c.height = 256;
        const g = c.getContext("2d");
        g.lineCap = g.lineJoin = "round";
        draw(g);
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 4;
        return t;
      });
    }
    function dShape(top, bottom, left = 30, right = 226) {
      const p = new Path2D();
      p.moveTo(left, top);
      p.quadraticCurveTo(128, top - 18, right, top);
      p.quadraticCurveTo(right - 8, bottom, 128, bottom + 4);
      p.quadraticCurveTo(left + 8, bottom, left, top);
      p.closePath();
      return p;
    }
    const PAINT = {
      smile(g) { g.strokeStyle = INK_CSS; g.lineWidth = 22; g.beginPath(); g.arc(128, 30, 160, Math.PI * 0.3, Math.PI * 0.7); g.stroke(); },
      tiny(g) { g.strokeStyle = INK_CSS; g.lineWidth = 26; g.beginPath(); g.arc(128, 60, 80, Math.PI * 0.25, Math.PI * 0.75); g.stroke(); },
      oh(g) { g.fillStyle = "#3a0d1c"; g.beginPath(); g.ellipse(128, 128, 70, 90, 0, 0, 7); g.fill(); },
      open(g) { // Toon: open D mouth with a tongue
        const p = dShape(60, 210);
        g.fillStyle = "#4a1020"; g.fill(p);
        g.save(); g.clip(p); g.fillStyle = "#ff7d93"; g.beginPath(); g.ellipse(128, 222, 70, 52, 0, 0, 7); g.fill(); g.restore();
        g.strokeStyle = INK_CSS; g.lineWidth = 14; g.stroke(p);
      },
      w(g) { // Srank's ω
        g.strokeStyle = INK_CSS; g.lineWidth = 18;
        g.beginPath(); g.arc(84, 100, 44, 0.05, Math.PI - 0.05); g.stroke();
        g.beginPath(); g.arc(172, 100, 44, 0.05, Math.PI - 0.05); g.stroke();
      },
      cat(g) { // Jimmy: nose, ω and a little tongue
        g.strokeStyle = INK_CSS; g.lineWidth = 14;
        g.fillStyle = "#ff8fa8"; g.beginPath(); g.ellipse(128, 168, 28, 34, 0, 0, 7); g.fill(); g.stroke();
        g.lineWidth = 16;
        g.beginPath(); g.arc(88, 118, 40, 0.05, Math.PI - 0.05); g.stroke();
        g.beginPath(); g.arc(168, 118, 40, 0.05, Math.PI - 0.05); g.stroke();
        g.beginPath(); g.moveTo(128, 76); g.lineTo(128, 120); g.stroke();
        g.fillStyle = INK_CSS; g.beginPath(); g.ellipse(128, 66, 22, 16, 0, 0, 7); g.fill();
      },
      scream(g) { // Carlo: wide open, two buck teeth, squiggly tongue
        const p = new Path2D();
        p.moveTo(30, 52); p.quadraticCurveTo(128, 18, 226, 52); p.quadraticCurveTo(252, 236, 128, 244); p.quadraticCurveTo(4, 236, 30, 52); p.closePath();
        g.fillStyle = "#5a0e22"; g.fill(p);
        g.save(); g.clip(p);
        g.fillStyle = "#ff6f86"; g.beginPath(); g.ellipse(128, 246, 96, 74, 0, 0, 7); g.fill();
        g.strokeStyle = "#c2183e"; g.lineWidth = 9; g.beginPath(); g.moveTo(92, 214); g.bezierCurveTo(116, 186, 136, 232, 166, 200); g.stroke();
        g.fillStyle = "#fffdf2"; g.strokeStyle = INK_CSS; g.lineWidth = 7;
        g.fillRect(90, 20, 38, 64); g.strokeRect(90, 20, 38, 64);
        g.fillRect(130, 20, 36, 56); g.strokeRect(130, 20, 36, 56);
        g.restore();
        g.strokeStyle = INK_CSS; g.lineWidth = 13; g.stroke(p);
      },
      fangs(g) { // Carlo, furry-monster version: wavy line and two fangs
        g.fillStyle = "#fffdf2"; g.strokeStyle = INK_CSS; g.lineWidth = 8;
        for (const x of [86, 170]) { g.beginPath(); g.moveTo(x - 20, 112); g.lineTo(x, 190); g.lineTo(x + 20, 112); g.closePath(); g.fill(); g.stroke(); }
        g.lineWidth = 16; g.beginPath(); g.moveTo(22, 120); g.bezierCurveTo(80, 92, 176, 140, 234, 104); g.stroke();
      },
      blush(g, color) {
        const r = g.createRadialGradient(128, 128, 10, 128, 128, 124);
        r.addColorStop(0, color); r.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = r; g.beginPath(); g.ellipse(128, 128, 124, 124, 0, 0, 7); g.fill();
      },
      freckles(g) {
        PAINT.blush(g, "rgba(255,120,150,.7)");
        g.fillStyle = "#7a3b2a";
        for (const [x, y] of [[96, 110], [140, 96], [156, 140], [110, 150]]) { g.beginPath(); g.arc(x, y, 9, 0, 7); g.fill(); }
      },
      swirl(g) {
        g.strokeStyle = INK_CSS; g.lineWidth = 16; g.beginPath();
        for (let a = 0; a < Math.PI * 4.2; a += 0.1) { const r = 10 + a * 8.5; const x = 128 + Math.cos(a) * r, y = 128 + Math.sin(a) * r; a ? g.lineTo(x, y) : g.moveTo(x, y); }
        g.stroke();
      },
      heart(g) {
        const p = new Path2D();
        p.moveTo(128, 222); p.bezierCurveTo(30, 160, 10, 100, 50, 60); p.bezierCurveTo(86, 26, 120, 50, 128, 84);
        p.bezierCurveTo(136, 50, 170, 26, 206, 60); p.bezierCurveTo(246, 100, 226, 160, 128, 222); p.closePath();
        g.fillStyle = "#ff6f9a"; g.fill(p); g.strokeStyle = INK_CSS; g.lineWidth = 14; g.stroke(p);
      },
      bowtie(g, color) {
        g.fillStyle = color; g.strokeStyle = INK_CSS; g.lineWidth = 10;
        g.beginPath(); g.moveTo(128, 128); g.lineTo(24, 64); g.lineTo(24, 192); g.closePath(); g.fill(); g.stroke();
        g.beginPath(); g.moveTo(128, 128); g.lineTo(232, 64); g.lineTo(232, 192); g.closePath(); g.fill(); g.stroke();
        g.beginPath(); g.ellipse(128, 128, 26, 34, 0, 0, 7); g.fill(); g.stroke();
      },
    };
    const paintTex = (name, arg) => tex(name + ":" + (arg || ""), g => PAINT[name](g, arg));
    const stickerMat = (name, arg) => once(`sticker:${name}:${arg || ""}`, () => new THREE.MeshBasicMaterial({
      map: paintTex(name, arg), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4
    }));

    // ---------- Placing things on the body ----------
    const ray = new THREE.Raycaster();
    function aim(obj, n, up, roll = 0) {
      const z = n.clone().normalize();
      const x = new THREE.Vector3().crossVectors(up, z).normalize();
      const y = new THREE.Vector3().crossVectors(z, x);
      obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
      if (roll) obj.rotateZ(roll);
    }
    // Shoot a ray at the body from in front of the face; (u, v) are offsets across the face.
    function hitFace(ctx, u, v) {
      const { center, right, up, fwd } = ctx.face;
      ctx.group.updateMatrixWorld(true);
      const from = center.clone().addScaledVector(right, u).addScaledVector(up, v).addScaledVector(fwd, 3);
      ray.set(from, fwd.clone().negate());
      const hit = ray.intersectObjects(ctx.targets, false)[0];
      if (!hit) return null;
      return { point: hit.point, normal: hit.face.normal.clone().transformDirection(hit.object.matrixWorld), mesh: hit.object };
    }
    function onFace(ctx, obj, u, v, lift = 0, roll = 0) {
      const hit = hitFace(ctx, u, v);
      if (!hit) return null;
      obj.position.copy(hit.point).addScaledVector(hit.normal, lift);
      aim(obj, hit.normal, ctx.face.up, roll);
      ctx.core.add(obj);
      return hit;
    }
    function sticker(ctx, name, u, v, w, h, { arg, roll = 0 } = {}) {
      const hit = hitFace(ctx, u, v);
      if (!hit) return null;
      const o = new THREE.Object3D();
      aim(o, hit.normal, ctx.face.up, roll);
      const geo = new DecalGeometry(hit.mesh, hit.point, new THREE.Euler().setFromQuaternion(o.quaternion), V(w, h, Math.min(0.12, Math.max(w, h))));
      const m = new THREE.Mesh(geo, stickerMat(name, arg));
      m.userData.sticker = true;
      ctx.core.add(m);
      return m;
    }

    function part(ctx, parent, geo, color, o = {}) {
      const look = ctx.look;
      const mat = o.mat || skin(look, color, { glow: o.glow, stripes: o.stripes });
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      const w = INK_W[look] * (o.inkScale ?? 1);
      if (w && o.ink !== false) {
        const mode = look === "carlo" ? (o.fuzz ? "fuzz" : "wobble") : "";
        const hull = new THREE.Mesh(weld(geo), inkMat(+w.toFixed(4), mode));
        hull.userData.ink = true;
        m.add(hull);
      }
      if (look === "carlo" && o.fuzz) {
        const fur = new THREE.Mesh(weld(geo), skin(look, color, { fuzz: 0.013, glow: o.glow }));
        fur.userData.ink = true;
        m.add(fur);
      }
      if (look === "galaxy" && o.rim) {
        const rim = new THREE.Mesh(weld(geo), rimMat(o.rimColor ?? color));
        rim.userData.ink = true;
        m.add(rim);
      }
      parent.add(m);
      return m;
    }
    function body(ctx, geo, color, o = {}) {
      const m = part(ctx, ctx.core, geo, color, { rim: true, ...o });
      ctx.targets.push(m);
      return m;
    }
    const spline = pts => new THREE.SplineCurve(pts.map(([x, y]) => new THREE.Vector2(x, y))).getPoints(60);
    function dome(r, h, seg = 28) { const g = new THREE.SphereGeometry(r, seg, 12, 0, Math.PI * 2, 0, Math.PI / 2); g.scale(1, h / r, 1); return g; }
    function smoothed(geo) { // weld seams so lathe/sphere shapes shade without a crease
      const m = weld(geo).clone();
      m.computeVertexNormals();
      return m;
    }

    // ---------- Eyes and faces ----------
    function eye(ctx, u, v, r, kind, look = [0.12, -0.05]) {
      const L = ctx.look, grp = new THREE.Group();
      const black = L === "galaxy" ? glossBlack() : flat(0x120d18);
      const white = L === "galaxy" ? skin("galaxy", 0xffffff, { glow: 0.15 }) : skin(L === "carlo" ? "carlo" : "toon", 0xfffdf6);
      const glint = (x, y, z, s) => { const g = new THREE.Mesh(new THREE.SphereGeometry(s, 10, 8), flat(0xffffff)); g.position.set(x, y, z); grp.add(g); };
      if (kind === "big" || kind === "googly") {
        const w = part(ctx, grp, new THREE.SphereGeometry(r, 28, 18), 0, { mat: white, inkScale: kind === "googly" ? 0.7 : 0.8 });
        w.scale.set(1, kind === "big" ? 1.15 : 1.05, kind === "googly" ? 0.75 : 0.5);
        const pr = r * (kind === "big" ? 0.36 : 0.24);
        const p = new THREE.Mesh(new THREE.SphereGeometry(pr, 16, 12), black);
        const depth = r * (kind === "googly" ? 0.72 : 0.47);
        p.position.set(look[0] * r * 0.5, look[1] * r * 0.5, depth);
        p.scale.z = 0.45;
        grp.add(p);
        glint(p.position.x + pr * 0.35, p.position.y + pr * 0.4, depth + pr * 0.3, pr * 0.32);
      } else {
        const b = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), black);
        b.scale.set(kind === "dot" ? 1 : 0.74, kind === "dot" ? 1 : 1.22, 0.45);
        grp.add(b);
        if (kind !== "dot") glint(r * 0.2, r * 0.5, r * 0.42, r * 0.22);
      }
      onFace(ctx, grp, u, v, kind === "googly" ? -r * 0.05 : -r * 0.12);
      ctx.eyes.push(grp);
      return grp;
    }

    function features(ctx, f) {
      const L = ctx.look;
      const kind = { toon: f.toonEyes || "big", galaxy: "glossy", carlo: "googly" }[L];
      const grow = { toon: 1.45, galaxy: 0.95, carlo: 1.4 }[L];
      const gaze = L === "carlo" ? [[0.5, 0.2], [-0.4, -0.45]] : [[0.12, -0.05], [0.12, -0.05]];
      f.eyes.forEach(([u, v], i) => eye(ctx, u, v, f.r * grow * (L === "carlo" && i === 1 ? 1.25 : 1), kind, gaze[i]));
      const mouth = f.mouth && { toon: f.toonMouth || "open", galaxy: f.galaxyMouth || "tiny", carlo: f.carloMouth || "scream" }[L];
      if (mouth && mouth !== "none") {
        const [u, v, w, h] = f.mouth;
        const [kw, kh] = { open: [1, 1], tiny: [0.55, 0.5], oh: [0.32, 0.42], scream: [1.35, 1.55], fangs: [1.2, 0.9], cat: [1, 1], w: [1, 0.8], smile: [1, 0.8] }[mouth];
        sticker(ctx, mouth, u, v - Math.max(0, kh - 1) * h * 0.45, w * kw, h * kh);
      }
      if (f.cheeks) {
        const [u, v, s] = f.cheeks;
        const name = { toon: "blush", galaxy: "blush", carlo: "freckles" }[L];
        const arg = L === "galaxy" ? "rgba(255,105,170,.75)" : "rgba(255,120,160,.55)";
        for (const side of [-1, 1]) sticker(ctx, name, side * u, v, s, s * 0.72, { arg });
      }
    }

    // ---------- Hats ----------
    function hat(ctx, kind) {
      const g = new THREE.Group();
      const add = (geo, color, x = 0, y = 0, z = 0, o) => { const m = part(ctx, g, geo, color, o); m.position.set(x, y, z); return m; };
      const cyl = (r1, r2, h, seg = 32) => new THREE.CylinderGeometry(r1, r2, h, seg);
      switch (kind) {
        case "cap": {
          add(dome(0.21, 0.17), 0xc0392b);
          const brim = add(cyl(0.16, 0.16, 0.025), 0xa93226, 0, 0.012, 0.15);
          brim.scale.z = 1.3;
          add(new THREE.SphereGeometry(0.026, 10, 8), 0xa93226, 0, 0.17, 0);
          break;
        }
        case "straw":
          add(dome(0.2, 0.15), 0xe9c46a);
          add(cyl(0.205, 0.205, 0.05), 0xc8102e, 0, 0.026, 0);
          add(cyl(0.4, 0.4, 0.022, 40), 0xe9c46a, 0, 0.006, 0);
          break;
        case "boater":
          add(cyl(0.17, 0.18, 0.12), 0xf0d27a, 0, 0.06, 0);
          add(cyl(0.183, 0.183, 0.04), 0x8b5cf6, 0, 0.03, 0);
          add(cyl(0.3, 0.3, 0.02, 40), 0xf0d27a, 0, 0.005, 0);
          break;
        case "crown":
        case "tiara": {
          const gold = kind === "crown" ? 0xf4c430 : 0xcfe3ff;
          add(cyl(0.17, 0.15, 0.1, 24), gold, 0, 0.05, 0, { glow: 0.15 });
          for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2;
            add(new THREE.ConeGeometry(0.045, 0.12, 12), gold, Math.sin(a) * 0.15, 0.16, Math.cos(a) * 0.15, { glow: 0.15 });
          }
          add(new THREE.SphereGeometry(0.03, 12, 8), kind === "crown" ? 0xe63946 : 0x4f7cff, 0, 0.055, 0.165, { glow: 0.4 });
          if (kind === "tiara") { g.scale.setScalar(0.6); g.rotation.z = 0.25; }
          break;
        }
        case "leaf": {
          add(cyl(0.014, 0.02, 0.1, 8), 0x6b4a2b, 0, 0.05, 0);
          const blade = new THREE.SphereGeometry(0.2, 24, 12);
          blade.scale(0.5, 0.07, 1);
          const b = add(blade, 0x6ab04c, 0, 0.12, 0.05);
          b.rotation.set(-0.5, 0, 0.45);
          break;
        }
        case "bowler":
          add(dome(0.17, 0.16), 0x2b2b33, 0, 0.015, 0);
          add(cyl(0.24, 0.24, 0.02), 0x2b2b33, 0, 0.01, 0);
          add(cyl(0.172, 0.172, 0.035), ctx.look === "galaxy" ? 0xffd23f : 0x7a2333, 0, 0.035, 0, { ink: false });
          break;
      }
      return g;
    }
    function wearHat(ctx, kind) {
      const at = ctx.hatAt, h = hat(ctx, kind);
      h.position.copy(at.pos);
      h.scale.multiplyScalar(at.scale);
      h.rotation.z += at.tilt || 0;
      h.rotation.x += at.pitch || 0;
      ctx.core.add(h);
      ctx.hat = h;
    }

    function sparkles(ctx, color, { count = 22, radius = 0.75, y = 0.5 } = {}) {
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const d = V(Math.random() - 0.5, (Math.random() - 0.5) * 0.8, Math.random() - 0.5).normalize().multiplyScalar(radius * (0.8 + Math.random() * 0.35));
        pos.set([d.x, d.y + y, d.z], i * 3);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const star = tex("sparkle", g => {
        const r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
        r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.25, "rgba(255,255,255,.5)"); r.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = r; g.fillRect(0, 0, 256, 256);
        g.fillStyle = "#fff";
        g.beginPath(); g.moveTo(128, 0); g.quadraticCurveTo(138, 118, 256, 128); g.quadraticCurveTo(138, 138, 128, 256); g.quadraticCurveTo(118, 138, 0, 128); g.quadraticCurveTo(118, 118, 128, 0); g.fill();
      });
      const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.11, map: star, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      pts.userData.ink = true;
      ctx.root.add(pts);
      ctx.ticks.push(t => { pts.rotation.y = t * 0.35; pts.material.opacity = 0.7 + 0.3 * Math.sin(t * 3.1); });
    }

    // ---------- The five characters ----------
    const BUILD = {
      jimbob(ctx) {
        const { look } = ctx, [col, acc] = ctx.pal;
        const geo = new THREE.LatheGeometry(spline([[0, 0.3], [0.3, 0.27], [0.55, 0.29], [0.65, 0.38], [0.66, 0.52], [0.61, 0.68], [0.5, 0.84], [0.32, 0.96], [0.12, 1.0], [0, 1.0]]), 64);
        geo.scale(1, 1, 0.86);
        body(ctx, smoothed(geo), col, { fuzz: true });
        // Curly slime drips around the bottom, like the squiggles in the drawing, each ending in a blob.
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI * 2 + 0.2;
          const out = V(Math.sin(a), 0, Math.cos(a)), side = V(Math.cos(a), 0, -Math.sin(a));
          const pts = [];
          for (let k = 0; k <= 12; k++) {
            const s = k / 12;
            pts.push(V().addScaledVector(UP, -0.27 * s).addScaledVector(side, Math.sin(s * Math.PI * 3 + i) * 0.05).addScaledVector(out, 0.05 * s));
          }
          const pivot = new THREE.Group();
          pivot.position.set(Math.sin(a) * 0.5, 0.31, Math.cos(a) * 0.43);
          ctx.core.add(pivot);
          part(ctx, pivot, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.032, 10, false), acc, { inkScale: 0.8 });
          part(ctx, pivot, new THREE.SphereGeometry(0.045, 16, 10), acc, { inkScale: 0.8 }).position.copy(pts[12]);
          ctx.ticks.push(t => { const w = Math.sin(t * 2.6 + i * 0.9) * 0.2; pivot.rotation.x = w * Math.cos(a); pivot.rotation.z = -w * Math.sin(a); });
        }
        ctx.face = { center: V(0, 0.64, 0), right: V(1, 0, 0), up: UP, fwd: V(0, 0, 1) };
        features(ctx, { eyes: [[-0.3, -0.06], [0.3, 0.17]], r: 0.075, mouth: [0.02, -0.17, 0.3, 0.2], cheeks: [0.42, -0.13, 0.17] });
        ctx.hatAt = { pos: V(0, 0.98, 0), scale: 1.3 };
        ctx.ownHat = { carlo: "boater" }[look];
        ctx.shoulders = [V(-0.52, 0.42, 0.2), V(0.52, 0.42, 0.2)];
        ctx.armColor = acc;
        ctx.breathe = [2.6, 0.03];
      },

      srank(ctx) {
        const { look } = ctx, [col, acc] = ctx.pal;
        // A squishy five-point star: a sphere pushed out into star points, thinner at the tips.
        const R = [0.57, 0.53, 0.55, 0.5, 0.58], rIn = 0.27;
        const starR = th => {
          const k = ((th - Math.PI / 2) / (Math.PI * 2 / 5)) % 5, i = ((Math.round(k) % 5) + 5) % 5;
          const d = Math.abs(k - Math.round(k)) * Math.PI * 2 / 5;
          return rIn + (R[i] - rIn) * Math.pow(Math.max(0, Math.cos(d * 2.5)), 1.7);
        };
        const geo = new THREE.SphereGeometry(1, 180, 44);
        geo.rotateX(Math.PI / 2);
        const p = geo.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i), y = p.getY(i), z = p.getZ(i), q = Math.hypot(x, y);
          const rho = starR(Math.atan2(y, x));
          const thick = 0.22 * (1 + (0.55 * rIn / rho + 0.45 - 1) * q * q);
          p.setXYZ(i, x * rho, y * rho, z * thick);
        }
        geo.rotateZ(0.06);
        geo.translate(0, 0.44, 0);
        body(ctx, smoothed(geo), col, { glow: look === "galaxy" ? 0.55 : 0 });
        ctx.face = { center: V(0.04, 0.47, 0), right: V(1, 0, 0), up: UP, fwd: V(0, 0, 1) };
        features(ctx, {
          eyes: [[-0.03, 0.08], [0.15, 0.1]], r: 0.065,
          mouth: [0.06, -0.06, 0.16, 0.12], toonMouth: "w", galaxyMouth: "w", cheeks: look === "galaxy" ? [0.2, -0.04, 0.1] : null
        });
        sticker(ctx, "heart", -0.2, -0.14, 0.11, 0.11);
        sticker(ctx, "swirl", 0.27, -0.02, 0.09, 0.09);
        if (look === "carlo") { // a third eye on a stalk, because why not
          const stalk = new THREE.Group();
          stalk.position.set(0.3, 0.72, 0);
          stalk.rotation.z = -0.5;
          ctx.core.add(stalk);
          part(ctx, stalk, new THREE.CylinderGeometry(0.018, 0.022, 0.28, 10).translate(0, 0.14, 0), acc);
          const ball = new THREE.Group();
          ball.position.set(0, 0.32, 0);
          stalk.add(ball);
          part(ctx, ball, new THREE.SphereGeometry(0.065, 20, 14), 0, { mat: skin("carlo", 0xfffdf6) });
          const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 8), flat(0x120d18));
          pupil.position.set(0.02, 0, 0.055);
          ball.add(pupil);
          ctx.ticks.push(t => { stalk.rotation.z = -0.5 + Math.sin(t * 3) * 0.15; ball.rotation.y = Math.sin(t * 1.3) * 0.8; });
        }
        ctx.hatAt = { pos: V(0, 0.88, 0), scale: 0.78 };
        ctx.shoulders = [V(-0.42, 0.57, 0.05), V(0.45, 0.58, 0.05)];
        ctx.breathe = [2, 0.02];
        ctx.ticks.push(t => { ctx.core.rotation.z = Math.sin(t * 1.8) * 0.06; });
      },

      jimmy(ctx) {
        const { look } = ctx, [col, acc] = ctx.pal;
        const geo = new THREE.LatheGeometry(spline([[0, 0], [0.42, 0], [0.56, 0.04], [0.62, 0.16], [0.6, 0.32], [0.52, 0.5], [0.36, 0.66], [0.16, 0.75], [0, 0.77]]), 64);
        geo.scale(1, 1, 0.8);
        body(ctx, smoothed(geo), col, { fuzz: true });
        const ears = [];
        for (const s of [-1, 1]) {
          const ear = new THREE.Group();
          ear.position.set(s * 0.36, 0.56, -0.02);
          ear.rotation.z = -s * 0.5;
          ctx.core.add(ear);
          part(ctx, ear, new THREE.ConeGeometry(0.12, 0.32, 28).translate(0, 0.16, 0), col);
          const inner = part(ctx, ear, new THREE.ConeGeometry(0.075, 0.2, 20).translate(0, 0.1, 0), acc, { ink: false });
          inner.position.set(0, 0.06, 0.055);
          inner.scale.z = 0.4;
          ears.push(ear);
        }
        const tail = new THREE.Group();
        tail.position.set(0, 0.12, -0.38);
        ctx.core.add(tail);
        part(ctx, tail, new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0, 0, 0), V(0.04, 0.16, -0.18), V(0.14, 0.36, -0.2), V(0.1, 0.48, -0.1)]), 24, 0.045, 10, false), col);
        ctx.ticks.push(t => {
          tail.rotation.z = Math.sin(t * 3.2) * 0.35;
          const twitch = Math.max(0, Math.sin(t * 0.9) - 0.94) * 4;
          ears[0].rotation.z = 0.5 + twitch;
        });
        ctx.face = { center: V(0, 0.4, 0), right: V(1, 0, 0), up: UP, fwd: V(0, 0, 1) };
        features(ctx, {
          eyes: [[-0.2, 0.1], [0.2, 0.1]], r: 0.058, mouth: [0, -0.04, 0.2, 0.16],
          toonMouth: "cat", galaxyMouth: "cat", carloMouth: "fangs", cheeks: [0.33, -0.05, 0.14]
        });
        if (look === "carlo") sticker(ctx, "bowtie", 0, -0.26, 0.22, 0.13, { arg: "#2a2550" });
        ctx.hatAt = { pos: V(0, 0.74, 0), scale: 1.1 };
        ctx.ownHat = { galaxy: "tiara" }[look];
        ctx.shoulders = [V(-0.45, 0.3, 0.22), V(0.45, 0.3, 0.22)];
        ctx.breathe = [2.2, 0.02];
      },

      ember(ctx) {
        const { look } = ctx, [col, acc] = ctx.pal;
        const flame = prof => {
          const g = new THREE.LatheGeometry(spline(prof), 64);
          const p = g.attributes.position;
          for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) + 0.4 * Math.max(0, p.getY(i) - 0.45) ** 2);
          return smoothed(g);
        };
        const drop = [[0, 0], [0.2, 0.02], [0.32, 0.1], [0.37, 0.22], [0.37, 0.35], [0.33, 0.48], [0.25, 0.62], [0.16, 0.76], [0.08, 0.89], [0.02, 0.98], [0, 1.0]];
        const glow = { toon: 0.25, galaxy: 0.7, carlo: 0.12 }[look];
        body(ctx, flame(drop), col, { glow, stripes: look === "carlo", rimColor: acc });
        // The extra lick of flame from the drawing, on the back.
        const lick = part(ctx, ctx.core, flame(drop), acc, { glow, inkScale: 2.2 });
        lick.scale.setScalar(0.45);
        lick.position.set(-0.2, 0.36, -0.14);
        lick.rotation.z = 0.55;
        ctx.ticks.push(t => {
          const f = Math.sin(t * 9) * 0.03 + Math.sin(t * 13.7) * 0.015;
          ctx.core.scale.set(1 - f * 0.5, 1 + f, 1 - f * 0.5);
          ctx.core.rotation.z = Math.sin(t * 2.3) * 0.04;
          lick.rotation.z = 0.55 + Math.sin(t * 7) * 0.12;
        });
        ctx.face = { center: V(0, 0.36, 0), right: V(1, 0, 0), up: UP, fwd: V(0, 0, 1) };
        features(ctx, {
          eyes: [[-0.14, 0.04], [0.14, 0.04]], r: 0.085, toonEyes: "dark",
          mouth: [0, -0.15, 0.2, 0.12], toonMouth: "none", galaxyMouth: "oh",
          cheeks: look === "galaxy" || look === "carlo" ? [0.24, -0.1, 0.12] : null
        });
        ctx.hatAt = { pos: V(0.06, 0.76, 0), scale: 0.95, tilt: -0.12 };
        ctx.shoulders = [V(-0.33, 0.3, 0.1), V(0.33, 0.3, 0.1)];
        ctx.breathe = [0, 0];
      },

      bernie(ctx) {
        const { look } = ctx, [col, acc] = ctx.pal;
        const torso = new THREE.CapsuleGeometry(0.25, 0.62, 12, 32);
        torso.rotateX(Math.PI / 2);
        torso.scale(1, 0.92, 1);
        torso.translate(0, 0.37, -0.08);
        body(ctx, torso, col);
        const head = new THREE.SphereGeometry(0.2, 36, 24);
        head.scale(1, 0.95, 1.1);
        head.translate(0, 0.42, 0.52);
        body(ctx, head, col);
        const plate = new THREE.Shape([new THREE.Vector2(-0.16, 0), new THREE.Vector2(0.16, 0), new THREE.Vector2(0, 0.36)]);
        for (const [z, h] of [[0.2, 0.33], [-0.08, 0.4], [-0.36, 0.32]]) {
          const g = new THREE.ExtrudeGeometry(plate, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2 });
          g.translate(0, 0, -0.025);
          g.scale(1, h / 0.36, 1);
          g.rotateY(Math.PI / 2);
          part(ctx, ctx.core, g, acc, { glow: look === "galaxy" ? 0.6 : 0 }).position.set(0, 0.52, z);
        }
        for (const [x, z] of [[-0.17, 0.26], [0.17, 0.26], [-0.17, -0.38], [0.17, -0.38]]) {
          part(ctx, ctx.core, new THREE.CapsuleGeometry(0.085, 0.08, 6, 16), col).position.set(x, 0.125, z);
        }
        const tail = new THREE.ConeGeometry(0.12, 0.4, 24);
        tail.rotateX(-Math.PI / 2 - 0.25);
        part(ctx, ctx.core, tail, col).position.set(0, 0.3, -0.78);
        ctx.face = { center: V(0, 0.44, 0.52), right: V(1, 0, 0), up: UP, fwd: V(0, 0, 1) };
        features(ctx, { eyes: [[-0.075, 0.04], [0.075, 0.04]], r: 0.042, mouth: [0, -0.075, 0.15, 0.1], toonMouth: "smile", cheeks: [0.13, -0.05, 0.08] });
        ctx.hatAt = { pos: V(0, 0.6, 0.5), scale: 0.62, tilt: -0.18, pitch: -0.1 };
        ctx.ownHat = "bowler";
        ctx.shoulders = [V(-0.2, 0.36, 0.3), V(0.2, 0.36, 0.3)];
        ctx.driveTilt = -0.6;
        ctx.breathe = [2, 0.015];
        ctx.ticks.push(t => { ctx.core.rotation.x = Math.sin(t * 1.4) * 0.03; });
      }
    };

    // ---------- Assembly ----------
    function build(id, look = "toon", { hat: hearthHat = null, pose = "stand", sparkle = false } = {}) {
      if (!PAL[id][look]) look = "toon"; // e.g. a saved "pirate" keeper from before that look was removed
      const group = new THREE.Group(), root = new THREE.Group(), core = new THREE.Group();
      group.add(root);
      root.add(core);
      group.name = id + "-" + look;
      const ctx = { id, look, pal: PAL[id][look], group, root, core, targets: [], eyes: [], ticks: [], breathe: [2, 0.02] };
      BUILD[id](ctx);
      const hatKind = hearthHat || ctx.ownHat;
      if (hatKind) wearHat(ctx, hatKind);

      if (pose === "drive" && ctx.driveTilt) root.rotation.x = ctx.driveTilt;
      group.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root);
      if (pose === "drive") root.position.y = -box.min.y;
      box.translate(V(0, root.position.y, 0));
      if (look === "galaxy" || sparkle) sparkles(ctx, look === "galaxy" ? ctx.pal[1] : 0xffe08a, { y: (box.min.y + box.max.y) / 2, radius: Math.max(0.65, box.max.x * 1.2) });

      // Arms only come out to drive: rubbery tubes from the shoulders to the hands.
      const arms = [];
      if (pose === "drive") {
        for (let i = 0; i < 2; i++) {
          const marker = new THREE.Object3D();
          marker.position.copy(ctx.shoulders[i]);
          core.add(marker);
          const color = ctx.armColor ?? ctx.pal[0];
          const arm = part(ctx, group, new THREE.CylinderGeometry(0.045, 0.05, 1, 12, 1).translate(0, 0.5, 0), color, { inkScale: 0.7 });
          const hand = part(ctx, group, new THREE.SphereGeometry(0.075, 16, 12), color, { inkScale: 0.7 });
          arms.push({ marker, arm, hand });
        }
      }
      const rest = [V(-0.25, 0.62, 0.62), V(0.25, 0.62, 0.62)];
      const tmp = V(), dir = V(), local = [V(), V()];
      function reach(hands) {
        root.updateMatrix(); core.updateMatrix();
        arms.forEach((a, i) => {
          const from = tmp.copy(a.marker.position).applyMatrix4(core.matrix).applyMatrix4(root.matrix);
          const to = hands ? group.worldToLocal(local[i].copy(hands[i])) : local[i].copy(rest[i]);
          dir.subVectors(to, from);
          const len = Math.max(dir.length(), 0.01);
          a.arm.position.copy(from);
          a.arm.scale.set(1, len, 1);
          a.arm.quaternion.setFromUnitVectors(UP, dir.divideScalar(len));
          a.hand.position.copy(to);
        });
      }

      group.traverse(o => { if (o.isMesh && (o.userData.ink || o.userData.sticker)) o.castShadow = false; });

      let blinkIn = 1 + Math.random() * 3, blinkFor = 0;
      function tick(dt, time, s = {}) {
        const t = look === "carlo" ? Math.floor(time * 12) / 12 : time; // carlo moves on twos, like cut-out animation
        blinkIn -= dt;
        if (blinkIn < 0) { blinkIn = 2.5 + Math.random() * 3.5; blinkFor = 0.13; }
        blinkFor -= dt;
        for (const e of ctx.eyes) e.scale.y = blinkFor > 0 ? 0.1 : 1;
        const [speed, amount] = ctx.breathe;
        if (amount) { const b = Math.sin(t * speed) * amount; core.scale.set(1 + b, 1 - b, 1 + b); }
        for (const f of ctx.ticks) f(t, s);
        if (pose === "drive") {
          root.rotation.z = THREE.MathUtils.lerp(root.rotation.z, (s.steer || 0) * 0.35, Math.min(1, dt * 6));
          core.position.y = Math.abs(Math.sin(t * 22)) * 0.012 * Math.min(1, Math.abs(s.speed || 0) / 4);
          reach(s.hands);
        } else {
          core.position.y = (Math.sin(t * 2.2) * 0.5 + 0.5) * 0.03;
        }
      }
      if (pose === "drive") reach(null);

      group.userData = {
        id, look, pose, tick, box, size: box.getSize(V()),
        info: CHARACTERS.find(c => c.id === id),
        setBodyVisible(v) { core.visible = v; },
        hasArms: arms.length > 0
      };
      return group;
    }

    // A copy that is safe to export as .glb: no ink shells, glow shells, fuzz or sparkles.
    function exportable(group) {
      const copy = group.clone(true);
      const drop = [];
      copy.traverse(o => { if (o.userData.ink || o.isPoints) drop.push(o); });
      drop.forEach(o => o.removeFromParent());
      return copy;
    }

    return { CHARACTERS, LOOKS, PALETTE: PAL, build, exportable };
  };
})();
