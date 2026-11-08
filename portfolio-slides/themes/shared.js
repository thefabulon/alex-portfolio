/* Shared engine for the three portfolio themes.
   - builds every page from content.js, using the theme's own page template (T.page)
   - generative art drawn into canvases: the particle rose (Dataland), the veil lattice (The Broad),
     folded bottle-cap metal (El Anatsui, via the Woven Room's Metal switch), chrome sculptures,
     and photos dissolving into light
   Pages are 1280 x 720 CSS px = 13.333 x 7.5 in, the same size as the original deck. */

const PW = 1280, PH = 720;

/* ------------------------------------------------------------------ small helpers */
function rng(seed) {                       // mulberry32: same picture every build
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const pad2 = n => String(n).padStart(2, "0");
const hex = (h, a = 1) => {
  h = h.replace("#", "");
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
const mix = (h1, h2, t) => {
  const a = parseInt(h1.replace("#", ""), 16), b = parseInt(h2.replace("#", ""), 16);
  const c = s => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return "#" + [16, 8, 0].map(s => c(s).toString(16).padStart(2, "0")).join("");
};

/* ------------------------------------------------------------------ HTML building blocks */
function figHTML(k, f, extraCls = "") {
  const cls = ["fig", f.fit === "contain" ? "contain" : "", f.bare ? "bare" : "", f.phone ? "phone" : "", extraCls].join(" ");
  const pos = f.pos ? ` style="object-position:${f.pos}"` : "";
  return `<figure class="${cls}" data-k="${k}" style="grid-area:${k}">
    <div class="frame"><img src="${f.src}" alt="${esc(f.alt)}"${pos}></div>
    ${f.note ? `<figcaption>${esc(f.note)}</figcaption>` : ""}</figure>`;
}

function descHTML(p, labels = DESC_LABELS) {
  return `<div class="desc">${p.desc.map((d, i) =>
    `<div class="d"><h4>${labels[i]}</h4><p>${esc(d)}</p></div>`).join("")}</div>`;
}

function extraHTML(key, x) {
  const L = x.label ? `<h5>${esc(x.label)}</h5>` : "";
  let body = "";
  switch (x.type) {
    case "stats":
      body = `<div class="stats">${x.items.map(([b, l]) => `<div class="stat"><b>${esc(b)}</b><span>${esc(l)}</span></div>`).join("")}</div>`; break;
    case "chips":
      body = `<div class="chips">${x.items.map(c => `<span>${esc(c)}</span>`).join("")}</div>`; break;
    case "swatches":
      body = `<div class="swatches">${x.items.map(([c, l]) => `<div><i style="background:#${c}"></i>${esc(l)}</div>`).join("")}</div>`; break;
    case "lessons":
      body = `<ol class="lessons">${x.items.map(([a, b]) => `<li><b>${esc(a)}</b> ${esc(b)}</li>`).join("")}</ol>`; break;
    case "steps":
      body = `<ol class="steps">${x.items.map(([src, h, t, alt], i) =>
        `<li><div class="frame"><img src="${src}" alt="${esc(alt)}"></div><div class="st"><em>${i + 1}</em><b>${esc(h)}</b><p>${esc(t)}</p></div></li>`).join("")}</ol>`; break;
    case "titleblock":
      body = `<div class="titleblock">${x.items.map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join("")}</div>`; break;
    case "role":
      body = `<div class="role"><b>${esc(x.text)}</b></div>`; break;
    case "mission":
      body = `<p class="mission">${esc(x.text)}</p>`; break;
    case "build":
      body = `<ol class="build">${x.items.map(([h, t], i) => `<li><em>${i + 1}</em><b>${esc(h)}</b><span>${esc(t)}</span></li>`).join("")}</ol>`; break;
    case "next":
      body = `<div class="next"><div class="frame"><img src="${x.src}" alt="${esc(x.alt)}"></div>
        <div class="nt"><b>${esc(x.title)}</b><p>${esc(x.text)}</p>${x.note ? `<small>${esc(x.note)}</small>` : ""}</div></div>`; break;
  }
  return `<div class="extra x-${x.type}" data-k="${key}" style="grid-area:${key}">${L}${body}</div>`;
}

/* The media grid: pictures + any extras the layout places. Returns [html, unplaced extras html]. */
function mediaHTML(p, which) {
  const lay = p[which];
  const used = new Set(lay.areas.join(" ").split(/\s+/));
  const figs = Object.entries(p.figs || {}).filter(([k]) => used.has(k)).map(([k, f]) => figHTML(k, f)).join("");
  const ex = Object.entries(p.extras || {});
  const placed = ex.filter(([k]) => used.has(k)).map(([k, x]) => extraHTML(k, x)).join("");
  const loose = ex.filter(([k]) => !used.has(k)).map(([k, x]) => extraHTML(k, x).replace(/ style="grid-area:[^"]*"/, "")).join("");
  const grid = `<div class="media" style="grid-template-columns:${lay.cols};grid-template-rows:${lay.rows};grid-template-areas:${lay.areas.map(a => `'${a}'`).join(" ")}">${figs}${placed}</div>`;
  return [grid, loose];
}

function featureHTML(p) {
  const F = p.feature;
  if (F.type === "themes") {
    return `<div class="themes">${F.items.map(t => `<div class="theme">
      <div class="frame screen"><img src="${IMG}theme-${t.key}.jpg" alt="Hearth in the ${esc(t.name)} theme"></div>
      <div class="chipstrip">${t.colors.map(c => `<i style="background:#${c}"></i>`).join("")}</div>
      <h3>${esc(t.name)}</h3><em class="mood">${esc(t.mood)}</em><p>${esc(t.story)}</p></div>`).join("")}</div>`;
  }
  if (F.type === "process") {
    return `<ol class="psteps">${F.steps.map(([h, t], i) => `<li><em>${i + 1}</em><b>${esc(h)}</b><p>${esc(t)}</p></li>`).join("")}</ol>
      <h5 class="plabel">What didn’t work, and what I did about it</h5>
      <div class="problems">${F.problems.map(([h, prob, fix, st]) => `<div class="problem ${st === "Fixed" ? "fixed" : "open"}">
        <b>${esc(h)}</b><p>${esc(prob)}</p><p class="fix"><strong>Fix:</strong> ${esc(fix)}</p><span class="stamp">${esc(st)}</span></div>`).join("")}</div>`;
  }
  if (F.type === "crew") {
    return `<div class="crew">
      <figure class="fig sketch"><div class="frame"><img src="${F.sketch.src}" alt="${esc(F.sketch.alt)}"></div><figcaption>${esc(F.sketch.note)}</figcaption></figure>
      <div class="looks"><div class="names"><span></span>${F.names.map(n => `<span>${n}</span>`).join("")}</div>
      ${F.looks.map(l => `<div class="look"><div class="ln"><b>${l.name}</b><em>${l.tag}</em></div><img src="${l.src}" alt="The five characters in the ${l.name} look"></div>`).join("")}</div></div>`;
  }
  if (F.type === "storyboard") {
    return `<div class="board">${F.rows.map(r => `<div class="ep">
      <div class="eh"><h5>Episode ${r.ep}</h5><h3>${esc(r.title)}</h3><p>${esc(r.line)}</p></div>
      <div class="panels" style="grid-template-columns:repeat(4,1fr)">${r.frames.map(([src, cap, alt], i) => `<figure class="panel">
        <div class="frame"><img src="${IMG}${src}" alt="${esc(alt)}"><span class="pn">${r.ep}.${i + 1}</span></div>
        <figcaption>${esc(cap)}</figcaption></figure>`).join("")}</div></div>`).join("")}</div>`;
  }
  return "";
}

/* ------------------------------------------------------------------ build + wait */
async function build(T) {
  const root = document.getElementById("deck");
  root.innerHTML = PAGES.map((p, i) => T.page(p, i + 1)).join("");
  const imgs = [...document.images];
  await Promise.all(imgs.map(im => im.complete ? 0 : new Promise(r => { im.onload = im.onerror = r; })));
  await document.fonts.ready;
  const pages = [...root.querySelectorAll(".page")];
  for (let i = 0; i < pages.length; i++) await T.decorate(pages[i], PAGES[i], i + 1);
  document.body.dataset.ready = "1";
  document.title = document.title + " ✓";
}

/* Canvas helper: a canvas covering box (x, y, w, h) in page px, drawn at `scale` px per CSS px.
   asJpeg turns the result into an <img> so the PDF stays small. */
function art(page, box, draw, { scale = 1.6, asJpeg = false, quality = 0.86, cls = "art", z = 0 } = {}) {
  const [x, y, w, h] = box;
  const c = document.createElement("canvas");
  c.width = Math.round(w * scale); c.height = Math.round(h * scale);
  const ctx = c.getContext("2d");
  ctx.scale(scale, scale);
  draw(ctx, w, h);
  let el = c;
  if (asJpeg) { el = new Image(); el.src = c.toDataURL("image/jpeg", quality); }
  el.className = cls;
  Object.assign(el.style, { position: "absolute", left: x + "px", top: y + "px", width: w + "px", height: h + "px", zIndex: z });
  el.setAttribute("aria-hidden", "true");
  page.prepend(el);
  return el;
}

/* ------------------------------------------------------------------ DATALAND: the particle rose
   A rose drawn only with points of light. Petals sit on the golden angle, each a crescent whose
   rim gets the most particles, so the shape reads as light caught on petal edges. `open` (0..1)
   unfurls it: the deck's rose opens a little more on every page. */
const ROSE_PAL = ["#7a0b3d", "#c3145e", "#ff2d7a", "#ff3fb4", "#ff6ac8", "#ffa3dc", "#ffd6ee"];
const ROSE_EXTRA = ["#ff5a3c", "#ff8a4c", "#4a6bff"];   // the coral + the one blue dot from the video

function drawRose(ctx, cx, cy, R, o = {}) {
  const r = rng(o.seed || 7), open = o.open ?? 1, K = o.petals || 38, dens = o.density || 1;
  const pal = o.palette || ROSE_PAL, rot = o.rotate || 0, squash = o.squash ?? 0.92;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const golden = Math.PI * (3 - Math.sqrt(5));
  const pts = [];
  for (let k = 0; k < K; k++) {
    const f = (k + 1) / K;                                   // 0 inner .. 1 outer
    const rk = R * (0.12 + 0.88 * Math.pow(f, 0.62 - 0.18 * open)) * (0.55 + 0.45 * open);
    const spread = (1.25 - 0.55 * f) * (0.9 + 0.5 * (1 - open)) + 0.35;   // angular width
    const phi = k * golden + rot;
    const inner = rk * (0.35 + 0.25 * f);
    const curl = 0.10 * f * open;                            // outer petals flip at the tip
    const n = Math.round((120 + 520 * f) * dens);
    for (let i = 0; i < n; i++) {
      const u = r() - 0.5;                                    // across the petal
      const edge = r() < 0.62;                                // most particles ride the rim
      const prof = Math.cos(u * Math.PI) ** 0.6;               // rounded petal end
      const notch = 1 - 0.07 * Math.exp(-((u * 9) ** 2));      // little dip in the middle of the rim
      const rimR = rk * (0.82 + 0.18 * prof) * notch * (1 + curl * prof);
      let rr = edge ? rimR * (1 - Math.abs(r() * r()) * 0.05) : inner + (rimR - inner) * Math.sqrt(r());
      const a = phi + u * spread;
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * squash;
      const depth = rr / R;
      let ci = Math.min(pal.length - 1, Math.floor((0.15 + 0.85 * f) * (pal.length - 1) * (edge ? 1.08 : 0.8)));
      let col = pal[Math.max(0, ci)];
      if (r() < 0.025) col = ROSE_EXTRA[Math.floor(r() * 2)];
      const size = edge ? 0.45 + r() * 1.25 : 0.35 + r() * 0.8;
      const al = edge ? 0.35 + 0.5 * r() : 0.12 + 0.22 * r() * (1 - depth * 0.3);
      pts.push([x, y, size, col, al]);
    }
  }
  // the heart of the rose: a tight spiral of bright points
  for (let i = 0; i < 700 * dens; i++) {
    const t = r() * 7 * Math.PI, rr = R * 0.012 * t * (0.6 + 0.4 * open);
    const x = cx + Math.cos(t + rot) * rr + (r() - .5) * 2, y = cy + Math.sin(t + rot) * rr * squash + (r() - .5) * 2;
    pts.push([x, y, 0.4 + r() * 0.9, r() < .5 ? "#ffd6ee" : "#ff3fb4", 0.25 + 0.5 * r()]);
  }
  for (const [x, y, s, c, a] of pts) { ctx.fillStyle = hex(c, a); ctx.beginPath(); ctx.arc(x, y, s, 0, 7); ctx.fill(); }
  // a few soft halos along the rim
  for (let i = 0; i < 26 * dens; i++) {
    const [x, y, , c] = pts[Math.floor(r() * pts.length)];
    const s = 6 + r() * 16, g = ctx.createRadialGradient(x, y, 0, x, y, s);
    g.addColorStop(0, hex(c, 0.28)); g.addColorStop(1, hex(c, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, s, 0, 7); ctx.fill();
  }
  // petals coming loose: particles streaming off in one direction, like the projection breaking up
  if (o.drift) {
    const { angle = 0, length = R * 2, count = 1400, wave = 0.6 } = o.drift;
    for (let i = 0; i < count * dens; i++) {
      const [sx, sy, , c] = pts[Math.floor(r() * pts.length)];
      const d = Math.pow(r(), 1.6) * length;
      const a = angle + Math.sin(d / 90 + i) * wave * 0.25 + (r() - .5) * 0.25;
      const x = sx + Math.cos(a) * d + Math.sin(d / 60) * 14 * wave, y = sy + Math.sin(a) * d + Math.cos(d / 70) * 14 * wave;
      const fade = 1 - d / length;
      const col = r() < 0.04 ? ROSE_EXTRA[2] : r() < 0.15 ? ROSE_EXTRA[0] : c;
      ctx.fillStyle = hex(col, 0.15 + 0.55 * fade * r());
      ctx.beginPath(); ctx.arc(x, y, 0.3 + 1.6 * r() * (0.4 + fade), 0, 7); ctx.fill();
    }
  }
  ctx.restore();
}

/* Soft out-of-focus dots, like the phone video at Dataland */
function drawBokeh(ctx, w, h, o = {}) {
  const r = rng(o.seed || 3), n = o.count || 40;
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < n; i++) {
    const x = r() * w, y = r() * h, s = (o.min || 6) + r() * (o.max || 26);
    const col = r() < 0.08 ? "#4a6bff" : r() < 0.3 ? "#ff5a3c" : r() < 0.6 ? "#ff3fb4" : "#e04bd0";
    const a = (o.alpha || 0.35) * (0.4 + 0.6 * r());
    const g = ctx.createRadialGradient(x, y, s * 0.55, x, y, s);
    g.addColorStop(0, hex(col, a)); g.addColorStop(0.8, hex(col, a * 0.7)); g.addColorStop(1, hex(col, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, s, s * (0.75 + 0.3 * r()), r() * 3, 0, 7); ctx.fill();
  }
  ctx.restore();
}

/* A photo breaking up into particles of its own colours along one edge (Bloom). */
function dissolveFig(page, fig, { side = "right", reach = 70, seed = 1, keep = 0.78 } = {}) {
  const img = fig.querySelector("img"), fr = fig.querySelector(".frame");
  if (!img || !img.naturalWidth) return;
  const pr = page.getBoundingClientRect(), b = fr.getBoundingClientRect();
  const x = b.left - pr.left, y = b.top - pr.top, w = b.width, h = b.height;
  // sample the image as it's shown (object-fit: cover)
  const off = document.createElement("canvas"); off.width = Math.round(w); off.height = Math.round(h);
  const oc = off.getContext("2d");
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
  try { oc.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh); } catch (e) { return; }
  let data; try { data = oc.getImageData(0, 0, off.width, off.height).data; } catch (e) { return; }
  const hor = side === "right" || side === "left";
  const box = side === "right" ? [x, y - 10, w + reach, h + 20] : side === "left" ? [x - reach, y - 10, w + reach, h + 20]
    : side === "bottom" ? [x - 10, y, w + 20, h + reach] : [x - 10, y - reach, w + 20, h + reach];
  const r = rng(seed);
  art(page, box, ctx => {
    const ox = x - box[0], oy = y - box[1];
    const N = Math.round((hor ? h : w) * 9);
    for (let i = 0; i < N; i++) {
      const t = Math.pow(r(), 0.7);                    // 0 = deep in the photo, 1 = at the edge
      const across = r();
      let px, py;
      if (side === "right") { px = w * (keep + (1 - keep) * t); py = across * h; }
      else if (side === "left") { px = w * (1 - keep) * (1 - t); py = across * h; }
      else if (side === "bottom") { px = across * w; py = h * (keep + (1 - keep) * t); }
      else { px = across * w; py = h * (1 - keep) * (1 - t); }
      const idx = (Math.min(off.height - 1, Math.floor(py)) * off.width + Math.min(off.width - 1, Math.floor(px))) * 4;
      const col = `rgba(${data[idx]},${data[idx + 1]},${data[idx + 2]},`;
      const fly = Math.pow(r(), 2.2) * reach * (0.3 + t);
      const wob = Math.sin(i * 1.7 + fly / 18) * 6 * (fly / reach);
      let qx = ox + px, qy = oy + py;
      if (side === "right") { qx += fly; qy += wob; } else if (side === "left") { qx -= fly; qy += wob; }
      else if (side === "bottom") { qy += fly; qx += wob; } else { qy -= fly; qx += wob; }
      const a = (0.55 + 0.45 * r()) * (1 - fly / (reach * 1.3));
      const sz = 0.5 + 1.8 * r() * (1 - fly / (reach * 1.5));
      ctx.fillStyle = col + a + ")"; ctx.fillRect(qx - sz / 2, qy - sz / 2, sz, sz);
    }
  }, { scale: 2, cls: "art dissolve", z: 3 });
  const dir = { right: "to right", left: "to left", bottom: "to bottom", top: "to top" }[side];
  fr.style.webkitMaskImage = fr.style.maskImage = `linear-gradient(${dir}, #000 ${keep * 100}%, rgba(0,0,0,.0) 100%)`;
}

/* ------------------------------------------------------------------ THE BROAD: the veil
   The Broad's honeycomb skin: rhomboid panels with rounded openings that swell and shrink,
   and a corner that lifts up like a curtain being raised. */
function drawVeil(ctx, w, h, o = {}) {
  const S = o.cell || 34, skew = o.skew ?? 0.42, panel = o.panel || "#f6f5f1";
  const lift = o.lift || null;                       // {x, y, r, k}: where the skin lifts
  const field = (x, y) => {                          // opening size, 0..1
    const v = 0.5 + 0.22 * Math.sin(x / 140 + (o.phase || 0)) + 0.18 * Math.sin(y / 95 - x / 260) + 0.1 * Math.sin((x + y) / 60);
    return Math.max(0.08, Math.min(0.92, v * (o.open ?? 1)));
  };
  const warp = (x, y) => {
    if (!lift) return [x, y];
    const d2 = ((x - lift.x) ** 2 + (y - lift.y) ** 2) / (lift.r * lift.r);
    const k = Math.exp(-d2) * (lift.k || 60);
    return [x + k * 0.25, y - k];
  };
  ctx.save();
  if (o.bg !== false) { ctx.fillStyle = panel; ctx.fillRect(0, 0, w, h); }
  const cols = Math.ceil(w / S) + 8, rows = Math.ceil(h / (S * 0.82)) + 4;
  const path = new Path2D();
  const shade = [];
  for (let j = -2; j < rows; j++) {
    for (let i = -6; i < cols; i++) {
      const bx = i * S + j * S * skew, by = j * S * 0.82;
      const cxp = bx + S * (0.5 + skew * 0.41), cyp = by + S * 0.41;
      if (cxp < -S || cxp > w + S || cyp < -S || cyp > h + S) continue;
      const f = field(cxp, cyp);
      if (o.mask && !o.mask(cxp, cyp)) continue;
      // opening: a rounded rhombus inside the cell
      const a = S * 0.5 * f, b = S * 0.41 * f;
      const q = [[-a - b * skew, b], [a - b * skew, b], [a + b * skew, -b], [-a + b * skew, -b]]
        .map(([dx, dy]) => warp(cxp + dx, cyp + dy));
      const rad = Math.min(a, b) * 0.9;
      roundPoly(path, q, rad);
      shade.push(q);
    }
  }
  ctx.fillStyle = o.hole || "#d8d6cf";
  ctx.fill(path);
  if (o.inner !== false) {           // a shadow on the top edge of every opening = depth
    ctx.strokeStyle = o.innerShade || "rgba(0,0,0,.10)"; ctx.lineWidth = 2;
    for (const q of shade) { ctx.beginPath(); ctx.moveTo(...q[3]); ctx.lineTo(...q[2]); ctx.stroke(); }
  }
  ctx.restore();
  return path;
}
function roundPoly(path, pts, r) {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
    const v1 = [p0[0] - p1[0], p0[1] - p1[1]], v2 = [p2[0] - p1[0], p2[1] - p1[1]];
    const l1 = Math.hypot(...v1), l2 = Math.hypot(...v2);
    const rr = Math.min(r, l1 / 2, l2 / 2);
    const a = [p1[0] + v1[0] / l1 * rr, p1[1] + v1[1] / l1 * rr], b = [p1[0] + v2[0] / l2 * rr, p1[1] + v2[1] / l2 * rr];
    if (i === 0) path.moveTo(...a); else path.lineTo(...a);
    path.quadraticCurveTo(p1[0], p1[1], b[0], b[1]);
  }
  path.closePath();
}

/* ------------------------------------------------------------------ EL ANATSUI: folded metal plates
   Small tilted plates, joined at the corners with copper wire, hanging in folds. Colours come
   from the Woven Room's sculptures; blocks + stripes echo the Stölzl tapestry. */
const WEAVE_PAL = ["#c23b2c", "#e48ca0", "#d9a83a", "#4d9a7e", "#1f2a5a", "#e2662f", "#efe6d6", "#8f1f1c"];
function drawMetal(ctx, w, h, o = {}) {
  const r = rng(o.seed || 11), pw = o.plate || 11, ph = pw * 0.62;
  const pal = o.palette || WEAVE_PAL, A = o.fold || 16, light = o.light || [-0.5, -0.7, 0.55];
  const L = Math.hypot(...light), Lx = light[0] / L, Ly = light[1] / L, Lz = light[2] / L;
  const z = (x, y) => A * Math.sin(x / (o.wave || 46) + 0.9 * Math.sin(y / 120)) + A * 0.45 * Math.sin(x / 19 + y / 210);
  const block = (x, y) => {      // tapestry-like colour blocks
    const bx = Math.floor((x + 30 * Math.sin(y / 80)) / (o.blockW || 70)), by = Math.floor(y / (o.blockH || 46));
    const stripe = Math.floor(y / (ph * 2)) % 3 === 0 && (bx + by) % 4 === 1;
    const i = (bx * 7 + by * 3 + (stripe ? 2 : 0)) % pal.length;
    return pal[(i + pal.length) % pal.length];
  };
  ctx.save();
  for (let y = -ph; y < h + ph; y += ph * 1.04) {
    const row = Math.round(y / ph);
    for (let x = -pw + (row % 2) * pw * 0.5; x < w + pw; x += pw * 1.06) {
      if (o.edge && y > o.edge(x)) continue;
      const e = 1.5, zx = (z(x + e, y) - z(x - e, y)) / (2 * e), zy = (z(x, y + e) - z(x, y - e)) / (2 * e);
      const nl = Math.hypot(zx, zy, 1), nx = -zx / nl, ny = -zy / nl, nz = 1 / nl;
      const diff = Math.max(0, nx * Lx + ny * Ly + nz * Lz);
      const spec = Math.pow(Math.max(0, nz * 0.9 + nx * 0.3), 18) * (o.shine ?? 0.9);
      const base = block(x, y);
      let c = mix("#000000", base, 0.25 + 0.85 * diff);
      c = mix(c, "#ffffff", Math.min(0.85, spec + r() * 0.05));
      ctx.save();
      ctx.translate(x + zx * 2, y);
      ctx.rotate(zx * 0.5 + (r() - 0.5) * 0.18);
      ctx.fillStyle = c;
      ctx.fillRect(-pw / 2, -ph / 2, pw * 0.94, ph * 0.86);
      ctx.fillStyle = "rgba(0,0,0,.18)"; ctx.fillRect(-pw / 2, ph * 0.3, pw * 0.94, ph * 0.08);
      if (r() < 0.5) { ctx.fillStyle = "#b8743c"; ctx.fillRect(pw * 0.42, -ph * 0.1, 1.4, 1.4); }   // copper wire
      ctx.restore();
    }
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ chrome sculptures (SVG)
   The Woven Room's mirror-finish pieces, after Koons-like shine at The Broad. */
function chromeTube(id, col) {
  return `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${mix(col, "#000", .55)}"/><stop offset=".22" stop-color="${mix(col, "#fff", .55)}"/>
    <stop offset=".34" stop-color="#fff"/><stop offset=".46" stop-color="${col}"/><stop offset=".78" stop-color="${mix(col, "#000", .35)}"/>
    <stop offset="1" stop-color="${mix(col, "#fff", .25)}"/></linearGradient>`;
}
function sculptureSVG(kind, w, h, cols = ["#c23b2c", "#d9a83a", "#e48ca0", "#4d9a7e", "#1f2a5a"], uid = "s") {
  let defs = "", body = "";
  if (kind === "wave") {
    cols.forEach((c, i) => {
      const id = `${uid}w${i}`; defs += chromeTube(id, c);
      const y = 18 + i * (h - 36) / cols.length, t = (h - 36) / cols.length * 0.95;
      body += `<path d="M ${t / 2} ${y + t * .9} C ${w * .2} ${y - t * .8}, ${w * .35} ${y + t * 1.6}, ${w * .55} ${y + t * .3} S ${w * .85} ${y - t * .4}, ${w - t / 2} ${y + t * .5}"
        fill="none" stroke="url(#${id})" stroke-width="${t}" stroke-linecap="round"/>`;
    });
  } else if (kind === "arch") {
    const n = cols.length, t = w / (n * 2 + 2.5);
    cols.forEach((c, i) => {
      const id = `${uid}a${i}`; defs += `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="${mix(c, "#000", .5)}"/><stop offset=".3" stop-color="${mix(c, "#fff", .6)}"/><stop offset=".42" stop-color="#fff"/>
        <stop offset=".55" stop-color="${c}"/><stop offset="1" stop-color="${mix(c, "#000", .45)}"/></linearGradient>`;
      const R = w / 2 - t / 2 - i * t * 1.02, cx = w / 2, top = R + t / 2 + 2;
      body += `<path d="M ${cx - R} ${h} L ${cx - R} ${top} A ${R} ${R} 0 0 1 ${cx + R} ${top} L ${cx + R} ${h}" fill="none" stroke="url(#${id})" stroke-width="${t}"/>`;
    });
  } else if (kind === "diamonds") {
    const pts = [[.32, .55, .3, .9, cols[3]], [.55, .5, .36, 1, cols[2]], [.72, .45, .26, .8, cols[1]], [.8, .72, .2, .5, cols[4]]];
    pts.forEach(([x, y, rw, rh, c], i) => {
      const id = `${uid}d${i}`; defs += `<radialGradient id="${id}" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#fff"/>
        <stop offset=".25" stop-color="${mix(c, "#fff", .4)}"/><stop offset=".7" stop-color="${c}"/><stop offset="1" stop-color="${mix(c, "#000", .5)}"/></radialGradient>`;
      const X = x * w, Y = y * h, RW = rw * w / 2, RH = rh * h / 2;
      body += `<path d="M ${X} ${Y - RH} Q ${X + RW * .9} ${Y - RH * .1} ${X} ${Y + RH} Q ${X - RW * .9} ${Y - RH * .1} ${X} ${Y - RH} Z" fill="url(#${id})"/>`;
    });
  }
  return `<svg class="sculpt" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><defs>${defs}</defs>${body}</svg>`;
}

/* Shrink a title until it fits its box (long project names, e.g. "LEGO Virtual Portfolio"). */
function fitText(el, maxW, maxH, min = 20) {
  if (!el) return;
  let size = parseFloat(getComputedStyle(el).fontSize);
  el.style.maxWidth = maxW + "px";
  while (size > min && (el.scrollWidth > maxW + 1 || el.offsetHeight > maxH)) {
    size -= 1; el.style.fontSize = size + "px";
  }
}
