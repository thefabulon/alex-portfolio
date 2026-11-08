/* hand.js: redraws the ground plans by hand.
   Hand.draw(svg, tool) swaps every shape in an <svg> for marks made with one tool:
     'pen'    ballpoint on graph paper: wobbly lines, walls gone over twice, quick zigzag shading
     'marker' Sharpie and white paint pen on kraft paper: fat lines, streaky fills, strokes that run past corners
     'wash'   fine liner and watercolour: thin broken lines that cross at corners, soft washes of colour underneath
   It reads the classes plans.js uses (w wall, t thin, fl filled shape, p your path, ...), so the plans
   themselves never change, only the hand that draws them. */
(function (global) {
  const NS = 'http://www.w3.org/2000/svg';
  const f1 = n => Math.round(n * 10) / 10;
  const hash = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
  const rnd = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const noise = r => { const v = Array.from({ length: 256 }, () => r() * 2 - 1); return t => { const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f); return v[i & 255] + (v[(i + 1) & 255] - v[i & 255]) * u; }; };
  const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  const unit = (a, b) => { const l = dist(a, b) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
  const toD = (pts, close) => pts.length ? 'M' + pts.map(p => f1(p[0]) + ' ' + f1(p[1])).join(' L') + (close ? ' Z' : '') : '';
  let uid = 0;

  // ---------- reading the shapes ----------
  let probe;
  function probePath(d) {
    if (!probe) {
      const s = document.createElementNS(NS, 'svg');
      s.setAttribute('width', '0'); s.setAttribute('height', '0'); s.setAttribute('aria-hidden', 'true');
      s.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden';
      probe = document.createElementNS(NS, 'path'); s.appendChild(probe); document.body.appendChild(s);
    }
    probe.setAttribute('d', d); return probe;
  }
  const num = (el, a) => parseFloat(el.getAttribute(a)) || 0;
  function shapeD(el) {
    switch (el.tagName.toLowerCase()) {
      case 'path': return el.getAttribute('d') || '';
      case 'rect': {
        const x = num(el, 'x'), y = num(el, 'y'), w = num(el, 'width'), h = num(el, 'height');
        const rx = Math.min(num(el, 'rx') || num(el, 'ry'), w / 2, h / 2);
        if (!rx) return `M${x} ${y} H${x + w} V${y + h} H${x} Z`;
        return `M${x + rx} ${y} H${x + w - rx} A${rx} ${rx} 0 0 1 ${x + w} ${y + rx} V${y + h - rx} A${rx} ${rx} 0 0 1 ${x + w - rx} ${y + h} H${x + rx} A${rx} ${rx} 0 0 1 ${x} ${y + h - rx} V${y + rx} A${rx} ${rx} 0 0 1 ${x + rx} ${y} Z`;
      }
      case 'circle': { const cx = num(el, 'cx'), cy = num(el, 'cy'), r = num(el, 'r'); return `M${cx + r} ${cy} A${r} ${r} 0 1 1 ${cx - r} ${cy} A${r} ${r} 0 1 1 ${cx + r} ${cy} Z`; }
      case 'ellipse': { const cx = num(el, 'cx'), cy = num(el, 'cy'), rx = num(el, 'rx'), ry = num(el, 'ry'); return `M${cx + rx} ${cy} A${rx} ${ry} 0 1 1 ${cx - rx} ${cy} A${rx} ${ry} 0 1 1 ${cx + rx} ${cy} Z`; }
      case 'line': return `M${num(el, 'x1')} ${num(el, 'y1')} L${num(el, 'x2')} ${num(el, 'y2')}`;
      case 'polyline': case 'polygon': return 'M' + (el.getAttribute('points') || '').trim().replace(/\s+/g, ' ') + (el.tagName === 'polygon' ? ' Z' : '');
    }
    return '';
  }
  // Straight-line paths (most of the plans) are read directly, which is much faster than asking the browser.
  function straightPieces(d) {
    if (/[^MLHVZmlhvz0-9eE.,\s+-]/.test(d)) return null;
    const tk = d.match(/[MLHVZmlhvz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) || [];
    const subs = []; let cur = null, x = 0, y = 0, sx = 0, sy = 0, cmd = null, i = 0;
    const start = () => { cur = { v: [[x, y]], closed: false }; subs.push(cur); };
    while (i < tk.length) {
      if (/^[A-Za-z]$/.test(tk[i])) {
        cmd = tk[i++];
        if (cmd === 'Z' || cmd === 'z') { if (cur) cur.closed = true; x = sx; y = sy; cur = null; }
        continue;
      }
      if (!cmd) return null;
      const a = parseFloat(tk[i]), b = parseFloat(tk[i + 1]);
      switch (cmd) {
        case 'M': x = a; y = b; i += 2; sx = x; sy = y; start(); cmd = 'L'; continue;
        case 'm': x += a; y += b; i += 2; sx = x; sy = y; start(); cmd = 'l'; continue;
        case 'L': x = a; y = b; i += 2; break;
        case 'l': x += a; y += b; i += 2; break;
        case 'H': x = a; i++; break;
        case 'h': x += a; i++; break;
        case 'V': y = a; i++; break;
        case 'v': y += a; i++; break;
        default: return null;
      }
      if (!cur) start();
      cur.v.push([x, y]);
    }
    const out = [];
    for (const s of subs) {
      let v = s.v;
      if (s.closed && v.length > 2 && dist(v[0], v[v.length - 1]) < 1e-3) v = v.slice(0, -1);
      const segs = s.closed ? [...v, v[0]] : v;
      let L = 0; for (let k = 1; k < segs.length; k++) L += dist(segs[k - 1], segs[k]);
      if (!(L > 0.05)) continue;
      const step = Math.min(1.4, Math.max(0.3, L / 40)), pts = [];
      for (let k = 1; k < segs.length; k++) {
        const p = segs[k - 1], q = segs[k], n = Math.max(1, Math.ceil(dist(p, q) / step));
        for (let j = 0; j < n; j++) pts.push([p[0] + (q[0] - p[0]) * j / n, p[1] + (q[1] - p[1]) * j / n]);
      }
      if (!s.closed) pts.push(segs[segs.length - 1]);
      out.push({ pts, closed: s.closed, L });
    }
    return out;
  }
  function ellipsePieces(cx, cy, rx, ry) {
    const L = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry))), n = Math.max(14, Math.ceil(L / 1.2)), pts = [];
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
    return [{ pts, closed: true, L }];
  }
  // Splits a path into its pieces (each M starts a new pen stroke) and samples points along each.
  function strokesOf(d) {
    const fast = straightPieces(d);
    if (fast) return fast;
    const parts = d.match(/[Mm][^Mm]*/g) || [], out = [];
    let cx = 0, cy = 0;
    for (const part of parts) {
      const m = part.match(/^[Mm]\s*(-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?)[\s,]*(-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?)/i);
      if (!m) continue;
      let x = +m[1], y = +m[2];
      if (part[0] === 'm') { x += cx; y += cy; }
      const abs = `M${x} ${y}${part.slice(m[0].length)}`, closed = /[zZ]\s*$/.test(part);
      const p = probePath(abs), L = p.getTotalLength();
      if (closed) { cx = x; cy = y; } else { const e = p.getPointAtLength(L); cx = e.x; cy = e.y; }
      if (!(L > 0.05)) continue;
      // measure curves every few units, then fill in the gaps with straight bits
      const coarse = Math.min(3.5, Math.max(0.3, L / 40)), fine = Math.min(1.4, Math.max(0.3, L / 40));
      const n = Math.max(2, Math.ceil(L / coarse)), raw = [], pts = [];
      for (let i = 0; i <= n; i++) { const q = p.getPointAtLength(L * i / n); raw.push([q.x, q.y]); }
      for (let i = 1; i < raw.length; i++) {
        const a = raw[i - 1], b = raw[i], k = Math.max(1, Math.round(dist(a, b) / fine));
        for (let j = 0; j < k; j++) pts.push([a[0] + (b[0] - a[0]) * j / k, a[1] + (b[1] - a[1]) * j / k]);
      }
      if (!closed) pts.push(raw[raw.length - 1]);
      out.push({ pts, closed, L, d: abs });
    }
    return out;
  }

  // ---------- making lines look drawn ----------
  // Pushes each point sideways by a smooth random amount, so straight lines bow and curves breathe.
  function wobble(pts, closed, amp, wl, r) {
    const nz = noise(r), off = r() * 200, n = pts.length, out = [];
    let s = 0;
    for (let i = 0; i < n; i++) {
      const a = closed ? pts[(i - 1 + n) % n] : pts[Math.max(0, i - 1)], b = closed ? pts[(i + 1) % n] : pts[Math.min(n - 1, i + 1)];
      const [tx, ty] = unit(a, b);
      if (i) s += dist(pts[i - 1], pts[i]);
      const o = amp * nz(off + s / wl) + amp * 0.18 * nz(off * 3 + s / 3);
      out.push([pts[i][0] - ty * o, pts[i][1] + tx * o]);
    }
    return out;
  }
  // A closed shape drawn in one go: start somewhere random and run a little past where you started.
  function openLoop(pts, r, over) {
    const n = pts.length, k = Math.floor(r() * n), out = [];
    for (let i = 0; i < n; i++) out.push(pts[(k + i) % n]);
    let s = 0;
    for (let i = 0; i < n && s < over; i++) { const a = pts[(k + i) % n], b = pts[(k + i + 1) % n]; s += dist(a, b); out.push(b); }
    return out;
  }
  function extend(pts, e0, e1) {
    if (pts.length < 2) return pts;
    const a = pts[0], b = pts[Math.min(3, pts.length - 1)], c = pts[pts.length - 1], d = pts[Math.max(0, pts.length - 4)];
    const u = unit(b, a), v = unit(d, c);
    return [[a[0] + u[0] * e0, a[1] + u[1] * e0], ...pts, [c[0] + v[0] * e1, c[1] + v[1] * e1]];
  }
  // Breaks a line at its sharp corners, the way you'd lift the pen at the corner of a room.
  function splitCorners(pts, closed, deg) {
    const n = pts.length, lim = Math.cos(deg * Math.PI / 180), hits = [];
    if (n < 6) return [{ pts, closed }];
    for (let i = 0; i < n; i++) {
      if (!closed && (i < 2 || i > n - 3)) continue;
      const a = pts[(i - 2 + n) % n], b = pts[i], c = pts[(i + 2) % n];
      const u = unit(a, b), v = unit(b, c), dot = u[0] * v[0] + u[1] * v[1];
      if (dot < lim) hits.push({ i, dot });
    }
    if (!hits.length) return [{ pts, closed }];
    const cs = [];  // keep the sharpest index in each run of neighbours
    for (const h of hits) { const last = cs[cs.length - 1]; if (last && h.i - last.i <= 3) { if (h.dot < last.dot) cs[cs.length - 1] = h; } else cs.push(h); }
    if (closed && cs.length > 1 && cs[0].i + n - cs[cs.length - 1].i <= 3) { if (cs[cs.length - 1].dot < cs[0].dot) cs[0] = cs[cs.length - 1]; cs.pop(); }
    const idx = cs.map(c => c.i), pieces = [];
    if (closed) {
      for (let j = 0; j < idx.length; j++) {
        const a = idx[j], b = idx[(j + 1) % idx.length], seg = [];
        for (let i = a; ; i = (i + 1) % n) { seg.push(pts[i]); if (i === b && seg.length > 1) break; if (seg.length > n + 1) break; }
        pieces.push({ pts: seg, closed: false });
      }
    } else {
      let a = 0;
      for (const b of [...idx, n - 1]) { pieces.push({ pts: pts.slice(a, b + 1), closed: false }); a = b; }
    }
    return pieces.filter(p => p.pts.length > 1);
  }
  // Leaves small gaps, like a fine liner skipping on the paper.
  function breakUp(pts, r, every, gap) {
    const out = []; let cur = [], s = 0, next = every * (0.6 + r() * 0.8);
    for (let i = 0; i < pts.length; i++) {
      if (i) s += dist(pts[i - 1], pts[i]);
      if (s > next && s < next + gap) { if (cur.length > 1) out.push(cur); cur = []; continue; }
      if (s >= next + gap) next = s + every * (0.6 + r() * 0.8);
      cur.push(pts[i]);
    }
    if (cur.length > 1) out.push(cur);
    return out;
  }
  // A line with pressure: thicker in the middle of the stroke, thinner where the pen lands and lifts.
  function ribbon(pts, w, r) {
    const nz = noise(r), off = r() * 100, n = pts.length, cum = [0];
    for (let i = 1; i < n; i++) cum.push(cum[i - 1] + dist(pts[i - 1], pts[i]));
    const total = cum[n - 1], L = [], R = [];
    for (let i = 0; i < n; i++) {
      const [tx, ty] = unit(pts[Math.max(0, i - 1)], pts[Math.min(n - 1, i + 1)]);
      const t = Math.max(0, Math.min(1, cum[i] / 4, (total - cum[i]) / 5));
      const hw = w / 2 * (0.75 + 0.4 * (nz(off + cum[i] / 22) + 1) / 2) * (0.3 + 0.7 * Math.sqrt(t));
      L.push([pts[i][0] - ty * hw, pts[i][1] + tx * hw]); R.push([pts[i][0] + ty * hw, pts[i][1] - tx * hw]);
    }
    return toD(L) + ' L' + R.reverse().map(p => f1(p[0]) + ' ' + f1(p[1])).join(' L') + ' Z';
  }
  // Quick back-and-forth shading that fills a box at an angle.
  function zigzag(bb, angle, gap, r, wild = 0.35) {
    const cx = bb.x + bb.width / 2, cy = bb.y + bb.height / 2, R = Math.hypot(bb.width, bb.height) / 2 + gap;
    const ca = Math.cos(angle), sa = Math.sin(angle), P = (u, v) => [cx + u * ca - v * sa, cy + u * sa + v * ca];
    const pts = []; let v = -R, side = -1;
    while (v <= R + gap) { pts.push(P(side * R * (1 - r() * wild * 0.4), v + (r() - 0.5) * gap * wild)); v += gap * (0.85 + r() * 0.3); side = -side; }
    return pts;
  }
  function boxOf(pts) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of pts) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
    return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
  }
  function arrowHead(pts, size, r) {
    const n = pts.length; if (n < 3) return [];
    const tip = pts[n - 1], back = pts[Math.max(0, n - 1 - Math.max(2, Math.round(size / 1.2)))], [ux, uy] = unit(tip, back);
    const wing = s => { const a = s * (0.48 + r() * 0.12), c = Math.cos(a), sn = Math.sin(a); return [tip[0] + (ux * c - uy * sn) * size, tip[1] + (ux * sn + uy * c) * size]; };
    return [[wing(1), tip], [tip, wing(-1)]];
  }

  // ---------- what each shape is ----------
  const has = (el, k) => (' ' + (el.getAttribute('class') || '') + ' ').includes(' ' + k + ' ');
  function roleOf(el) {
    const st = el.getAttribute('style') || '', sw = parseFloat(el.style.strokeWidth || el.getAttribute('stroke-width')) || 0;
    const dash = el.style.strokeDasharray || null, arrowAttr = /url\(#arr\)/.test(el.getAttribute('marker-end') || '');
    const sheet = /--sheet/.test(st);
    if (el.closest('.st')) return { stroke: 'accent', sw: 2, fill: 'paper', stop: true };
    if (el.closest('.en') || has(el, 'en')) return { fill: 'accent', small: true };
    if (has(el, 'road-o')) return sw > 5 ? { edges: sw } : { stroke: 'ink', sw: sw || 1.4, dash };
    if (has(el, 'road')) return { band: sw || 10 };
    const tint = (el.getAttribute('class') || '').match(/\btint(\d)\b/);
    if (tint) return { fill: 'tint' + tint[1] };
    if (has(el, 'w')) return { stroke: /accent/.test(st) ? 'accent' : 'ink', sw: sw || 2.8, wall: true, dash };
    if (has(el, 't')) return { stroke: 'ink', sw: sw || 1.4, dash };
    if (has(el, 'tk')) return { stroke: 'ink', sw: sw || 1, dash };
    if (has(el, 'f')) return { stroke: sheet ? 'paper' : 'muted', sw: sw || 1, fine: true };
    if (has(el, 'd')) return { stroke: 'muted', sw: 1.3, dash: '3 5' };
    if (has(el, 'cl')) return { stroke: 'muted', sw: 1, dash: '12 4 2 4' };
    if (has(el, 'p') || has(el, 'p2')) return { stroke: 'accent', sw: 2.2, dash: 'dots', arrow: has(el, 'p'), path: true };
    if (has(el, 'bitp')) return { stroke: 'ink', sw: 1.1, dash: 'dots-fine' };
    if (has(el, 'acc-l')) return { stroke: 'accent', sw: sw || 1.8, dash, arrow: arrowAttr };
    if (has(el, 'fl')) return { fill: 'soft', stroke: 'ink', sw: 1.4 };
    if (has(el, 'soft')) return { fill: 'soft2' };
    if (has(el, 'solid')) return { fill: sheet ? 'paper' : 'ink' };
    if (has(el, 'ft')) return { fill: 'paper', stroke: 'ink', sw: 1.4 };
    if (has(el, 'acc') || has(el, 'sg') || has(el, 'ah')) return { fill: 'accent', small: true };
    if (/fill:\s*var\(--sheet\)/.test(st)) return { fill: 'paper' };
    return { stroke: 'ink', sw: 1 };
  }

  // ---------- the tools ----------
  const TOOLS = {
    pen: {
      col: { ink: '#22253a', muted: '#4d5468', accent: '#c8332b', paper: '#fbfaf5', soft: '#2a2f48', soft2: '#7a7f8c' },
      width: (role) => role.wall ? 1.75 : role.fine ? 0.75 : Math.max(0.75, role.sw * 0.62),
      amp: 0.75, wl: 30
    },
    marker: {
      col: { ink: '#16130f', muted: '#2a2119', accent: '#ff5a1f', paper: '#f3eee2', soft: '#f3eee2', soft2: '#f3eee2' },
      width: (role) => role.wall ? 3.6 : role.fine ? 1.5 : Math.max(1.5, role.sw * 1.25),
      amp: 0.6, wl: 60
    },
    wash: {
      col: { ink: '#2c241e', muted: '#6a5a4c', accent: '#b4412b', paper: '#f7f2e8', soft: '#c9a46a', soft2: '#9fb0b3' },
      width: (role) => role.wall ? 1.45 : role.fine ? 0.6 : Math.max(0.6, role.sw * 0.55),
      amp: 0.45, wl: 46
    }
  };

  function dashFor(tool, role, w) {
    const d = role.dash;
    if (!d) return null;
    if (d === 'dots') return tool === 'marker' ? '0.1 7' : tool === 'pen' ? '2.6 4.4' : '0.1 4.4';
    if (d === 'dots-fine') return tool === 'marker' ? '0.1 4.5' : '0.1 3.2';
    if (tool === 'marker') return d.split(/[\s,]+/).map(v => f1(parseFloat(v) * 1.5)).join(' ');
    return d;
  }

  function drawStroke(tool, T, role, strokes, r, out, ctx) {
    const col = T.col[role.stroke] || T.col.ink, w = T.width(role), dash = dashFor(tool, role, w);
    const strokeEl = (pts, extra = '') => `<path d="${toD(pts)}" fill="none" stroke="${col}" stroke-width="${f1(w * 100) / 100}" stroke-linecap="round" stroke-linejoin="round"${dash ? ` stroke-dasharray="${dash}"` : ''}${extra}/>`;
    let last = null;
    for (const s of strokes) {
      const L = s.L, amp = Math.min(T.amp * (0.6 + L / 160), T.amp * 2.2);
      if (tool === 'pen') {
        let pts = wobble(s.pts, s.closed, amp, T.wl, r);
        pts = s.closed ? openLoop(pts, r, 2 + r() * 5) : extend(pts, r() * 1.2, r() * 2);
        if (dash || role.stop) out.line += strokeEl(pts);
        else out.line += `<path d="${ribbon(pts, w * 1.15, r)}" fill="${col}"/>`;
        if (role.wall && L > 12) {   // gone over a second time, never quite on top of the first
          let p2 = wobble(s.pts, s.closed, amp * 1.3, T.wl * 0.8, r);
          p2 = s.closed ? openLoop(p2, r, r() * 4) : extend(p2, -r() * 2, r() * 1.5);
          out.line += `<path d="${ribbon(p2, w * 0.7, r)}" fill="${col}" opacity=".7"/>`;
        }
        last = pts;
      } else if (tool === 'marker') {
        const pieces = (role.wall || role.sw >= 1.4) && !dash ? splitCorners(s.pts, s.closed, 50) : [{ pts: s.pts, closed: s.closed }];
        for (const pc of pieces) {
          let pts = wobble(pc.pts, pc.closed, amp, T.wl, r);
          pts = pc.closed ? openLoop(pts, r, 3 + r() * 6) : extend(pts, 1 + r() * (pieces.length > 1 ? 3 : 1), 1 + r() * (pieces.length > 1 ? 4 : 1.5));
          out.line += strokeEl(pts, ' class="mk"');
          last = pts;
        }
      } else {
        const pieces = !dash && !role.stop && L > 8 ? splitCorners(s.pts, s.closed, 42) : [{ pts: s.pts, closed: s.closed }];
        for (const pc of pieces) {
          let pts = wobble(pc.pts, pc.closed, amp, T.wl, r);
          if (pc.closed) pts = openLoop(pts, r, 1 + r() * 3);
          else if (pieces.length > 1 || role.wall) pts = extend(pts, 1.5 + r() * (role.wall ? 4 : 2.5), 1.5 + r() * (role.wall ? 4 : 2.5));
          const runs = !dash && L > 40 ? breakUp(pts, r, 70, 1.6 + r() * 1.4) : [pts];
          for (const run of runs) out.line += strokeEl(run);
          last = pts;
        }
      }
    }
    if (role.arrow && last) {
      const wing = role.head || (tool === 'marker' ? 7 : tool === 'pen' ? 5.5 : 5);
      for (const seg of arrowHead(last, wing, r)) out.line += `<path d="${toD(seg)}" fill="none" stroke="${col}" stroke-width="${f1(Math.max(w, tool === 'marker' ? 2.4 : 1.1) * 100) / 100}" stroke-linecap="round"/>`;
    }
  }

  function drawFill(tool, T, role, strokes, el, r, out, ctx) {
    const key = role.fill, closedPts = strokes.filter(s => s.closed).map(s => s.pts);
    if (/^tint/.test(key) && tool !== 'wash') return;   // room colours are for the watercolour only
    const shapes = closedPts.length ? closedPts : strokes.map(s => s.pts);
    if (!shapes.length) return;
    const bb = boxOf(shapes.flat()), size = Math.min(bb.width, bb.height), big = Math.max(bb.width, bb.height);
    const rule = el.getAttribute('fill-rule') === 'evenodd' ? ' fill-rule="evenodd"' : '';
    const outline = (amp) => shapes.map(p => toD(wobble(p, true, amp, 18, r), true)).join(' ');

    if (tool === 'wash') {
      // watercolour goes on underneath everything, a little off the lines, in the colour this drawing asked for
      const pal = ctx.palette || {}, pick = v => Array.isArray(v) ? v[Math.floor(r() * v.length)] : v;
      const c = pick(pal[key]) || T.col[key] || pick(pal.soft) || T.col.soft;
      if (key === 'paper') { out.wash += `<path d="${outline(0.6)}" fill="${T.col.paper}" opacity=".9"${rule}/>`; return; }
      const strong = key === 'ink' ? 0.82 : key === 'accent' ? 0.8 : 0.55 + r() * 0.15;
      const dx = f1((r() - 0.5) * Math.min(3, size * 0.15)), dy = f1((r() - 0.5) * Math.min(3, size * 0.15));
      out.wash += `<path d="${outline(Math.min(2.2, 0.4 + size * 0.06))}" fill="${key === 'ink' ? T.col.ink : c}" opacity="${f1(strong * 100) / 100}" transform="translate(${dx} ${dy})"${rule}/>`;
      if (big > 24 && key !== 'ink') {   // a second, smaller pass where the paint pooled
        const cx = bb.x + bb.width * (0.3 + r() * 0.4), cy = bb.y + bb.height * (0.3 + r() * 0.4);
        out.wash += `<g opacity=".35"><path d="${outline(1.2)}" fill="${c}" transform="translate(${f1(cx)} ${f1(cy)}) scale(.55) translate(${f1(-cx)} ${f1(-cy)})"${rule}/></g>`;
      }
      return;
    }

    const col = T.col[key] || T.col.ink;
    if (key === 'paper') { out.fill += `<path d="${outline(0.5)}" fill="${col}" opacity="${tool === 'pen' ? 0.92 : 0.97}"${rule}/>`; return; }
    if (size < 9 || role.small) {     // too small to shade: just fill it in
      out.fill += `<path d="${outline(Math.min(0.5, size * 0.05))}" fill="${col}"${rule}/>`; return;
    }
    const id = 'hc' + (++uid);
    out.defs += `<clipPath id="${id}"><path d="${outline(tool === 'pen' ? 1 : 1.4)}"${rule ? ' clip-rule="evenodd"' : ''}/></clipPath>`;
    let gap, sw, op, ang = (tool === 'pen' ? -0.9 : -0.7) + (r() - 0.5) * 0.5;
    if (tool === 'pen') {
      if (key === 'ink' || key === 'accent') { gap = 1.3; sw = 1.1; op = 0.95; }
      else if (key === 'soft2') { gap = 4.2; sw = 0.55; op = 0.45; }
      else { gap = 3.2; sw = 0.6; op = 0.6; }
    } else {
      if (key === 'ink' || key === 'accent') { out.fill += `<path d="${outline(0.8)}" fill="${col}"${rule}/>`; return; }
      gap = key === 'soft2' ? 7 : 5.2; sw = gap * 0.78; op = key === 'soft2' ? 0.5 : 0.82;
    }
    const zz = zigzag(bb, ang, gap, r);
    out.fill += `<g clip-path="url(#${id})"><path d="${toD(zz)}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" opacity="${op}"${tool === 'marker' ? ' class="paint"' : ''}/></g>`;
    if (tool === 'pen' && (key === 'ink' || key === 'accent')) {   // dark fills get a second, crossing pass
      const zz2 = zigzag(bb, ang + 1.2, gap * 1.4, r);
      out.fill += `<g clip-path="url(#${id})"><path d="${toD(zz2)}" fill="none" stroke="${col}" stroke-width="${sw * 0.8}" stroke-linecap="round" opacity=".8"/></g>`;
    }
  }

  function drawBand(tool, T, role, strokes, r, out, ctx) {
    for (const s of strokes) {
      const pts = toD(wobble(s.pts, s.closed, 0.8, 50, r), s.closed);
      if (tool === 'wash') out.wash += `<path d="${pts}" fill="none" stroke="${(ctx.palette && ctx.palette.road) || '#8f9a9e'}" stroke-width="${role.band}" stroke-linejoin="round" opacity=".55"/>`;
      else if (tool === 'marker') out.fill += `<path d="${pts}" fill="none" stroke="#2b2722" stroke-width="${role.band}" stroke-linejoin="round" stroke-linecap="round" opacity=".22" class="mk"/>`;
      else out.fill += `<path d="${pts}" fill="none" stroke="#5c606c" stroke-width="${role.band}" stroke-linejoin="round" opacity=".09"/>`;
    }
  }
  // The outline of a wide road: two edges, drawn separately.
  function edges(strokes, w) {
    const out = [];
    for (const s of strokes) for (const side of [-1, 1]) {
      const n = s.pts.length, pts = s.pts.map((p, i) => {
        const a = s.closed ? s.pts[(i - 1 + n) % n] : s.pts[Math.max(0, i - 1)], b = s.closed ? s.pts[(i + 1) % n] : s.pts[Math.min(n - 1, i + 1)];
        const [tx, ty] = unit(a, b); return [p[0] - ty * side * w / 2, p[1] + tx * side * w / 2];
      });
      out.push({ pts, closed: s.closed, L: s.L });
    }
    return out;
  }

  // the transforms between a shape and its <svg>, so a wash laid on the bottom layer lands in the same place
  function chain(el, svg) {
    const t = [];
    for (let n = el; n && n !== svg; n = n.parentNode) { const a = n.getAttribute && n.getAttribute('transform'); if (a) t.unshift(a); }
    return t.join(' ');
  }

  // ---------- lettering ----------
  const KEEP = { "brian's": "Brian's", skyline: 'Skyline', bit: 'Bit', "bit's": "Bit's", 'alex-2600': 'ALEX-2600', crt: 'CRT', tv: 'TV', ae86: 'AE86', s15: 'S15', supra: 'Supra', 'rx-7': 'RX-7', ninja: 'Ninja', h2: 'H2', h2r: 'H2R', 'sur-ron': 'Sur-Ron', alpinestars: 'Alpinestars', lego: 'Lego', cl: 'CL', pl: 'PL', '1st': '1st', '3rd': '3rd', 'go-kart': 'go-kart', s: 'S', m: 'm', rc: 'RC', '70s': '70s', i: 'I', space: 'Space' };
  function sentence(str) {
    const bare = str.replace(/\b(m|\d+s)\b/g, '');
    if (bare !== bare.toUpperCase()) return str;
    let first = true;
    return str.split(/(\s+|·|→|\+|:)/).map(w => {
      if (!w.trim() || /^[·→+:]$/.test(w)) return w;
      const low = w.toLowerCase(), core = low.replace(/[^a-z0-9'’-]/g, ''), keep = KEEP[core];
      let out = keep ? low.replace(core, keep) : low;
      if (first && /[a-z]/.test(out[0])) out = out[0].toUpperCase() + out.slice(1);
      first = false; return out;
    }).join('').replace(/\b([a-ln-z])(?=\s*(?:·|$))/g, (m, c) => c.toUpperCase());   // "Bay a" → "Bay A", "Detail a ·" → "Detail A ·"
  }
  function letter(svg, tool, r, opts) {
    svg.querySelectorAll('text').forEach(t => {
      if (opts.sentence) t.textContent = sentence(t.textContent);
      if (t.closest('.st')) return;
      const x = num(t, 'x'), y = num(t, 'y'), rot = f1((r() - 0.5) * (opts.tilt ?? 3)), dy = f1((r() - 0.5) * 1.2);
      const old = t.getAttribute('transform') || '';
      t.setAttribute('transform', `${old} rotate(${rot} ${x} ${y}) translate(0 ${dy})`.trim());
      t.parentNode.appendChild(t);   // lettering goes on last, over the shading
    });
  }

  // ---------- the main call ----------
  function draw(svg, tool, opts = {}) {
    const T = TOOLS[tool], r = rnd(hash((svg.id || svg.getAttribute('aria-label') || '') + tool) + (opts.seed || 0));
    const ctx = { palette: opts.palette };
    svg.classList.add('hand', 'hand-' + tool);
    const shapes = [...svg.querySelectorAll('path,rect,circle,ellipse,line,polyline,polygon')].filter(el => !el.closest('defs,clipPath,marker,mask,text'));
    let defs = '', wash = '';
    for (const el of shapes) {
      const role = roleOf(el), d = shapeD(el), tag = el.tagName.toLowerCase();
      if (!d) { el.remove(); continue; }
      let strokes;
      try {
        strokes = tag === 'circle' ? ellipsePieces(num(el, 'cx'), num(el, 'cy'), num(el, 'r'), num(el, 'r'))
          : tag === 'ellipse' ? ellipsePieces(num(el, 'cx'), num(el, 'cy'), num(el, 'rx'), num(el, 'ry'))
          : strokesOf(d);
      } catch (e) { continue; }
      if (!strokes.length) { el.remove(); continue; }
      const out = { line: '', fill: '', defs: '', wash: '' };
      if (role.band) drawBand(tool, T, role, strokes, r, out, ctx);
      else if (role.edges) drawStroke(tool, T, { stroke: 'ink', sw: 1.4 }, edges(strokes, role.edges), r, out, ctx);
      else {
        if (role.fill) drawFill(tool, T, role, strokes, el, r, out, ctx);
        if (role.stroke) drawStroke(tool, T, role, strokes, r, out, ctx);
      }
      defs += out.defs;
      if (out.wash) { const tr = chain(el, svg); wash += tr ? `<g transform="${tr}">${out.wash}</g>` : out.wash; }
      const g = document.createElementNS(NS, 'g');
      const own = el.getAttribute('transform'); if (own) g.setAttribute('transform', own);
      g.innerHTML = out.fill + out.line;
      el.replaceWith(g);
    }
    if (defs) svg.insertAdjacentHTML('afterbegin', `<defs>${defs}</defs>`);
    if (wash) {
      const layer = document.createElementNS(NS, 'g');
      layer.setAttribute('class', 'wash-layer'); layer.setAttribute('filter', 'url(#wc-wash)');
      layer.innerHTML = wash;
      const after = svg.querySelector('defs');
      after ? after.after(layer) : svg.prepend(layer);
    }
    letter(svg, tool, r, opts);
    return svg;
  }

  // A hand-drawn line or loop on its own (underlines, circles round things, arrows between sections).
  function scribble(tool, pts, opts = {}) {
    const T = TOOLS[tool], r = rnd(opts.seed || 7), out = { line: '', fill: '', defs: '', wash: '' };
    const role = { stroke: opts.color || 'ink', sw: opts.sw || 1.4, arrow: !!opts.arrow, wall: !!opts.wall, dash: opts.dash || null, head: opts.head };
    const probeD = toD(pts, opts.closed);
    drawStroke(tool, T, role, strokesOf(probeD), r, out, {});
    return out.line;
  }

  global.Hand = { draw, scribble, sentence, tools: TOOLS };
})(window);
