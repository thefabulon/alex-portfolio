/* plans.js: the ground plan drawings, shared by the three gallery versions.
   Everything from "The 10 early concept plans" to "Little header doodles" is copied unchanged from
   gallery-ground-plans.html, so the plans stay traced from the real game files. Each function returns
   SVG markup with plain classes (w = wall, t = thin line, fl = filled shape, p = your path...).
   hand.js then redraws that markup with a pen, a marker or a brush. */
(function (global) {
// ---------- The 10 early concept plans (unchanged drawings) ----------
const S=(x,y,n)=>`<g class="st"><circle cx="${x}" cy="${y}" r="10"/><text x="${x}" y="${y+3.8}" text-anchor="middle">${n}</text></g>`;
const L=(x,y,t,a='start')=>`<text class="lb" x="${x}" y="${y}" text-anchor="${a}">${t}</text>`;
const P=d=>`<path class="p" d="${d}"/>`;
const W=d=>`<path class="w" d="${d}"/>`;
const E=(x,y,r=0)=>`<g class="en" transform="translate(${x} ${y}) rotate(${r})"><path d="M-7 -6 L7 0 L-7 6 Z"/></g>`;
const SG=(x,y,w=16)=>`<rect class="sg" x="${x-w/2}" y="${y-2}" width="${w}" height="4"/>`;
const R=(x,y,w,h,c='t')=>`<rect class="${c}" x="${x}" y="${y}" width="${w}" height="${h}"/>`;
const C=(x,y,r,c='t')=>`<circle class="${c}" cx="${x}" cy="${y}" r="${r}"/>`;
const palm=(x,y)=>`<g>${C(x,y,7,'f')}<path class="f" d="M${x-7} ${y} H${x+7} M${x} ${y-7} V${y+7} M${x-5} ${y-5} L${x+5} ${y+5} M${x+5} ${y-5} L${x-5} ${y+5}"/></g>`;

function studs(){let s='';for(let x=30;x<=370;x+=20)for(let y=20;y<=240;y+=20)s+=C(x,y,3.5,'f');return s}
function risers(){let s='';for(let i=0;i<3;i++){const y=172+i*20;s+=R(48,y,132,13)+R(220,y,132,13)}return s}
function levels(){let s='';for(let i=0;i<3;i++){const x=20+i*125;
  s+=W(`M${x} 40 H${x+110} V225 H${x} Z`);
  for(let k=0;k<6;k++)s+=`<path class="t" d="M${x+8+k*19} 40 V68"/>`;
  s+=R(x+66,182,40,40,'fl')+`<path class="f" d="M${x+66} 202 L${x+86} 182 M${x+66} 222 L${x+106} 182 M${x+86} 222 L${x+106} 202"/>`;
  s+=L(x+55,30,'LEVEL '+(i+1),'middle')+S(x+40,125,i+1)+SG(x+40,147)+L(x+86,178,'RAMP','middle');
  if(i<2)s+=P(`M${x+106} 195 C${x+116} 195 ${x+120} 110 ${x+128} 110`);
 }return s+E(40,238,-90)+P('M40 230 V140')}

const TRK="M90 50 H290 C340 50 355 85 330 112 L300 140 C285 158 300 185 330 190 C360 196 358 225 325 228 H90 C45 228 30 200 30 165 V110 C30 70 55 50 90 50 Z";

const plans=[
{name:"Pit Lane",tag:"Each project gets its own race-team garage.",
 move:"Walk down pit lane and turn into each bay. Cars on the track behind the pit wall keep the space alive.",
 fit:"Built from your love of racing. Each bay is like a small stage set, dressed and lit for one project.",
 watch:"Three bays can look the same. Give each one its own color, lighting and props.",effort:2,
 svg:()=>W("M30 105 V25 H370 V105")+W("M143 25 V105 M257 25 V105")+`<path class="d" d="M30 105 H370"/>`
  +S(86,62,1)+S(200,62,2)+S(314,62,3)+SG(86,92)+SG(200,92)+SG(314,92)
  +L(36,38,'BAY A')+L(149,38,'BAY B')+L(263,38,'BAY C')
  +E(22,145)+P("M32 145 H368")+P("M86 145 V114")+P("M200 145 V114")+P("M314 145 V114")
  +L(200,166,'PIT LANE','middle')+W("M15 178 H385")+L(385,173,'PIT WALL','end')
  +R(15,192,370,52,'fl')+`<path class="d" d="M15 218 H385"/>`+L(200,238,'TRACK · CARS LOOP PAST','middle')},

{name:"Grand Prix Circuit",tag:"You drive your own Lego F1 car through the gallery.",
 move:"Start at the grid in the orange car. Pull into the infield to stop at each display, then rejoin the lap.",
 fit:"This was your first idea. It shows you think about how an audience moves, which is a big part of set design.",
 watch:"Driving can pull attention away from the work. Keep it slow, or make the displays pit stops.",effort:3,
 svg:()=>`<path class="road-o" stroke-width="31" d="${TRK}"/><path class="road" stroke-width="28" d="${TRK}"/><path class="d" d="${TRK}"/>`
  +`<path class="w" d="M112 36 V64"/>`+L(112,28,'START / FINISH','middle')+E(80,50)+P("M128 50 H250")
  +R(70,118,70,46,'fl')+S(105,141,1)+R(160,118,70,46,'fl')+S(195,141,2)+C(258,182,22,'fl')+S(258,182,3)
  +SG(105,175)+SG(195,175)+L(160,104,'INFIELD DISPLAYS','middle')
  +P("M60 112 C60 140 64 140 68 141")+L(342,58,'PIT ENTRY','end')},

{name:"Minifig Scale",tag:"Shrink down and walk across a giant Lego baseplate.",
 move:"You are minifigure size. Climb between giant bricks; each brick top holds one project.",
 fit:"Playing with scale is a real set-design tool (think forced perspective). It also shows off how you see the world.",
 watch:"It could look like a Lego ad. Keep your own builds and photos as the main thing.",effort:2,
 svg:()=>R(20,10,360,240)+studs()
  +R(52,42,100,58,'fl')+S(102,71,1)+R(240,30,120,60,'fl')+S(300,60,2)+R(140,162,112,60,'fl')+S(196,192,3)
  +SG(102,108)+SG(300,98)+SG(196,154)
  +E(30,140)+P("M40 140 C70 140 80 128 92 110")+P("M140 112 C190 132 240 120 286 98")+P("M300 102 C300 140 250 150 214 158")
  +`<g>${C(62,214,3.5,'solid')}<rect class="solid" x="58.5" y="218.5" width="7" height="9"/></g>`+L(72,224,'YOU · MINIFIG SCALE')},

{name:"The Shop",tag:"Workbenches, pegboard and sawdust: where things get made.",
 move:"Come in through the roll-up door. Each project sits on its own workbench with a sign, like your original idea.",
 fit:"A production program runs a scene shop, so this speaks their language. It puts your process front and center.",
 watch:"It needs your real build photos and sketches on the walls, or it's just an empty room.",effort:1,
 svg:()=>W("M190 240 H20 V20 H380 V240 H250")+`<path class="d" d="M190 240 H250"/>`+L(220,254,'ROLL-UP DOOR','middle')
  +R(60,24,280,9,'fl')+L(200,46,'PEGBOARD · TOOLS YOU USED','middle')
  +R(45,88,110,52,'fl')+S(100,114,1)+L(100,152,'SAWHORSES','middle')
  +R(245,88,110,52,'fl')+S(300,114,2)+L(300,152,'BENCH','middle')
  +R(296,176,74,56,'fl')+S(333,204,3)+C(282,204,7,'ft')
  +SG(100,84)+SG(300,84)+SG(333,172)
  +R(26,162,12,70)+L(44,230,'LUMBER RACK')
  +E(220,232,-90)+P("M220 224 V184 C220 166 160 166 112 148")+P("M150 162 C210 170 260 166 288 148")+P("M310 150 C330 158 333 162 333 186")},

{name:"Black Box",tag:"An empty theater. Lights fade up on one project at a time.",
 move:"Enter up the audience aisle and step onto the stage. Each pool of light is one project; the next light cues as you move.",
 fit:"Uses the school's own vocabulary: center line, plaster line, lighting cues. Shows you think like a theater maker.",
 watch:"Dark rooms are hard to read. Light the photos and signs well enough to see clearly.",effort:2,
 svg:()=>W("M20 15 H380 V250 H20 Z")
  +C(100,88,40,'d')+C(200,88,40,'d')+C(300,88,40,'d')
  +S(100,88,1)+S(200,88,2)+S(300,88,3)+SG(100,118)+SG(200,118)+SG(300,118)
  +L(100,38,'CUE 1','middle')+L(200,38,'CUE 2','middle')+L(300,38,'CUE 3','middle')
  +`<path class="cl" d="M200 18 V160"/>`+L(205,155,'CL')+`<path class="cl" d="M30 152 H370"/>`+L(370,147,'PL','end')
  +risers()+L(114,234,'AUDIENCE','middle')+L(286,234,'AUDIENCE','middle')
  +E(200,244,-90)+P("M200 236 V170 C200 146 120 146 106 132")+P("M136 92 H160")+P("M236 92 H260")},

{name:"Turntable",tag:"One stage, three sets. The floor spins to the next project.",
 move:"You stand at the edge of the stage. Press a button and the turntable rotates the next set into view.",
 fit:"Turntables are real stage machinery for fast scene changes. It shows you understand how sets move.",
 watch:"Standing still means less exploring. Let visitors step onto each set after it turns.",effort:3,
 svg:()=>C(200,95,78,'fl')+C(200,95,6,'ft')+W("M200 95 L200 17 M200 95 L267.5 134 M200 95 L132.5 134")
  +S(200,140,1)+S(241.6,71,2)+S(158.4,71,3)
  +P("M286.5 63.5 A92 92 0 0 1 286.5 126.5")+L(300,96,'ROTATES 120°')
  +W("M20 178 H130 M270 178 H380")+`<path class="d" d="M130 178 H270"/>`+L(200,193,'PROSCENIUM OPENING','middle')
  +SG(200,165,22)+E(200,226,-90)+L(200,250,'YOU STAND HERE','middle')
  +L(28,170,'WING')+L(372,170,'WING','end')},

{name:"My Street",tag:"The street where you shot the Lego photos, at car height.",
 move:"Walk the sidewalk. Exhibits sit in driveways, and the cul-de-sac turns into a car meet.",
 fit:"Personal and real. Your street photos already live here, so the space tells your story.",
 watch:"Keep houses and signs generic. Don't model your real house numbers or address.",effort:2,
 svg:()=>`<path class="road-o" stroke-width="42" d="M10 135 H290"/>`+C(320,135,50,'fl')+`<path class="road" stroke-width="39" d="M10 135 H300"/>`+`<path class="d" d="M10 135 H262"/>`
  +R(30,18,80,52)+R(150,18,80,52)+R(30,196,80,48)+R(150,196,80,48)+R(282,8,82,30)
  +R(60,70,24,44,'f')+S(72,95,1)+SG(72,76)+R(178,156,24,40,'f')+S(190,173,2)+SG(190,192)
  +S(320,135,3)+L(320,108,'CAR MEET','middle')
  +`<rect class="solid" x="140" y="131" width="20" height="8"/>`+L(150,124,'LEGO CAR','middle')
  +palm(128,92)+palm(250,92)+palm(250,180)+palm(128,182)
  +E(20,104)+P("M28 104 H58")+P("M86 104 H178 C200 104 210 150 202 158")+P("M210 170 C250 170 260 140 300 138")},

{name:"White Cube",tag:"Three clean rooms, one project in each.",
 move:"Walk straight through three rooms in a row. Each has a plinth, a wall sign and a bench.",
 fit:"Classic and easy for reviewers to read. Puts every bit of attention on the work.",
 watch:"Safe can feel forgettable. The photos, sketches and writing have to carry it.",effort:1,
 svg:()=>W("M20 115 V50 H380 V210 H20 V145")+W("M140 50 V115 M140 145 V210 M260 50 V115 M260 145 V210")
  +R(60,74,40,28,'fl')+S(80,88,1)+R(180,74,40,28,'fl')+S(200,88,2)+R(300,74,40,28,'fl')+S(320,88,3)
  +SG(80,54,24)+SG(200,54,24)+SG(320,54,24)
  +R(60,168,40,8)+R(180,168,40,8)+R(300,168,40,8)
  +L(80,198,'ROOM 1','middle')+L(200,198,'ROOM 2','middle')+L(320,198,'ROOM 3','middle')
  +E(12,130)+P("M22 130 H368")+L(200,32,'WALL TEXT ABOVE EACH PLINTH','middle')},

{name:"Showroom",tag:"Glass walls and spinning plinths, like a car dealership.",
 move:"Step in from the street and loop past the turntable plinths. The go-kart gets the biggest spot.",
 fit:"Treats your builds as worth showing off. Shows display and lighting skills.",
 watch:"Glossy can feel cold. Add your sketches and process photos to warm it up.",effort:2,
 svg:()=>`<path class="t" d="M185 220 H20 V20 H380 V220 H215 M185 216 H24 V24 H376 V216 H215"/>`
  +C(110,95,44,'fl')+C(110,95,32)+S(110,95,1)+C(290,90,36,'fl')+C(290,90,25)+S(290,90,2)
  +C(312,174,24,'fl')+S(312,174,3)+SG(110,150)+SG(290,137)+SG(272,174)
  +`<path class="w" d="M60 190 Q105 166 150 190"/>`+L(105,206,'DESK','middle')
  +L(200,12,'GLASS CURTAIN WALL','middle')+L(200,248,'STREET','middle')
  +E(200,232,-90)+P("M200 214 C200 170 170 150 158 118")+P("M120 46 C180 30 230 40 252 66")+P("M296 132 C300 140 304 144 306 146")},

{name:"Parking Structure",tag:"Drive up the ramp. Each level is a chapter.",
 move:"Start on level 1 with your first project and drive up a ramp to each next level.",
 fit:"Shows order and storytelling: oldest build at the bottom, newest at the top.",
 watch:"Concrete levels repeat. Change the lighting and color on each floor.",effort:3,
 svg:()=>levels()}
];

// ---------- Shared bits for the new plans ----------
const NS = 'http://www.w3.org/2000/svg';
const r1 = n => Math.round(n * 10) / 10;
const line = (pts, closed) => 'M' + pts.map(p => r1(p[0]) + ' ' + r1(p[1])).join(' L') + (closed ? ' Z' : '');
const T = (x, y, t, a = 'start', c = 'lb', extra = '') => `<text class="${c}" x="${r1(x)}" y="${r1(y)}" text-anchor="${a}" ${extra}>${t}</text>`;
const rng = seed => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
// A tree seen from above: a lumpy crown with a few scribbles.
const tree = (x, y, r) => {
  let d = '';
  for (let k = 0; k <= 8; k++) { const a = k / 8 * Math.PI * 2, rr = r * (k % 2 ? 0.82 : 1); d += (k ? ' L' : 'M') + r1(x + Math.cos(a) * rr) + ' ' + r1(y + Math.sin(a) * rr); }
  return `<path class="fl" d="${d} Z"/><path class="f" d="M${r1(x - r * .4)} ${r1(y)} q${r1(r * .4)} ${r1(-r * .45)} ${r1(r * .8)} 0"/><circle class="solid" cx="${r1(x)}" cy="${r1(y)}" r="1"/>`;
};
// A little film camera with a dashed cone looking along `ang`.
const cam = (x, y, ang, len = 34, spread = .42) => {
  const a1 = ang - spread, a2 = ang + spread;
  return `<path class="d" d="M${r1(x)} ${r1(y)} L${r1(x + Math.cos(a1) * len)} ${r1(y + Math.sin(a1) * len)} M${r1(x)} ${r1(y)} L${r1(x + Math.cos(a2) * len)} ${r1(y + Math.sin(a2) * len)}"/>`
    + `<g transform="translate(${r1(x)} ${r1(y)}) rotate(${r1(ang * 180 / Math.PI)})"><rect class="solid" x="-9" y="-4.5" width="10" height="9" rx="2"/><path class="solid" d="M1 -2.5 L5 -4 L5 4 L1 2.5 Z"/></g>`;
};
// A car seen from above, nose pointing +x, centred on 0,0.
const carTop = (l, w) => `<rect class="ft" x="${-l / 2}" y="${-w / 2}" width="${l}" height="${w}" rx="${w * .35}"/>`
  + `<path class="fl" d="M${-l * .18} ${-w * .36} H${l * .14} Q${l * .24} 0 ${l * .14} ${w * .36} H${-l * .18} Q${-l * .26} 0 ${-l * .18} ${-w * .36} Z"/>`
  + `<rect class="solid" x="${-l * .4}" y="${-w * .62}" width="${l * .18}" height="${w * .14}" rx="1"/><rect class="solid" x="${l * .22}" y="${-w * .62}" width="${l * .18}" height="${w * .14}" rx="1"/>`
  + `<rect class="solid" x="${-l * .4}" y="${w * .48}" width="${l * .18}" height="${w * .14}" rx="1"/><rect class="solid" x="${l * .22}" y="${w * .48}" width="${l * .18}" height="${w * .14}" rx="1"/>`;
// A game cartridge from the front.
const cart = (x, y, w, h, mark) => `<g transform="translate(${x} ${y})">`
  + `<path class="ft" d="M${-w / 2} ${h} V${h * .2} Q${-w / 2} 0 ${-w / 2 + 6} 0 H${w / 2 - 6} Q${w / 2} 0 ${w / 2} ${h * .2} V${h} Z"/>`
  + `<path class="tk" d="M${-w / 2 + 4} ${h * .12} H${w / 2 - 4} M${-w / 2 + 4} ${h * .2} H${w / 2 - 4}"/>`
  + `<rect class="fl" x="${-w / 2 + 5}" y="${h * .3}" width="${w - 10}" height="${h * .56}" rx="3"/>${mark}</g>`;

// A closed centripetal Catmull-Rom spline (the same kind of curve three.js uses for the go-kart track), resampled evenly.
function spline(pts, n) {
  const d = (a, b) => Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])) || 1e-4;
  const lerp = (a, b, ta, tb, t) => [0, 1].map(k => ((tb - t) * a[k] + (t - ta) * b[k]) / (tb - ta));
  const raw = [], m = pts.length;
  for (let i = 0; i < m; i++) {
    const p0 = pts[(i - 1 + m) % m], p1 = pts[i], p2 = pts[(i + 1) % m], p3 = pts[(i + 2) % m];
    const t1 = d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3);
    for (let k = 0; k < 40; k++) {
      const t = t1 + (t2 - t1) * k / 40;
      const A1 = lerp(p0, p1, 0, t1, t), A2 = lerp(p1, p2, t1, t2, t), A3 = lerp(p2, p3, t2, t3, t);
      raw.push(lerp(lerp(A1, A2, 0, t2, t), lerp(A2, A3, t1, t3, t), t1, t2, t));
    }
  }
  const cum = [0];
  for (let i = 1; i <= raw.length; i++) cum.push(cum[i - 1] + Math.hypot(...[0, 1].map(k => raw[i % raw.length][k] - raw[i - 1][k])));
  const L = cum[raw.length], out = [];
  for (let j = 0, i = 0; j < n; j++) {
    const s = j / n * L;
    while (cum[i + 1] < s) i++;
    const f = (s - cum[i]) / (cum[i + 1] - cum[i] || 1), a = raw[i], b = raw[(i + 1) % raw.length];
    out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
  }
  return { pts: out, len: L };
}

// ---------- The Lobby (lobby/v2.html: ROOM, cabinet, tv, consoleG, rack, portal, SPOTS) ----------
function drawLobby() {
  const X = x => 180 + x * 40, Y = z => 30 + (z + 1.6) * 40; // 40 px per meter, back wall at the top
  let s = '';
  // rug (radius 2.2 m) with braid rings
  s += `<circle class="soft" cx="180" cy="${Y(1)}" r="88"/><circle class="f" cx="180" cy="${Y(1)}" r="80"/><circle class="f" cx="180" cy="${Y(1)}" r="66"/>`;
  s += W('M20 30 H340 V270 H20 Z');
  // window on the left wall, z 0 to 2.4
  s += `<rect class="ft" x="16" y="${Y(0)}" width="8" height="96"/><path class="tk" d="M20 ${Y(0)} V${Y(2.4)}"/>`;
  s += `<path class="f" d="M30 ${Y(1.2) - 14} a10 10 0 0 1 0 28 M34 ${Y(1.2) - 6} H40 M34 ${Y(1.2)} H42 M34 ${Y(1.2) + 6} H40"/>`;
  // neon sign on the back wall
  s += `<rect class="acc" x="${X(-1.3)}" y="33" width="104" height="4" rx="2"/>`;
  // cabinet, TV, console, joystick, rack
  s += R(X(-1.3), Y(-1.1), 104, 28, 'fl') + `<path class="f" d="M${X(-1.2)} ${Y(-0.8)} q12 -4 24 0 t24 0 M${X(0.6)} ${Y(-0.55)} q10 -3 20 0 t20 0"/>`;
  s += `<rect class="solid" x="${X(-.47)}" y="${Y(-1.19)}" width="37.6" height="20.8" rx="3"/><path class="f" style="stroke:var(--sheet)" d="M${X(-.4)} ${Y(-0.7)} H${X(.25)}"/>`;
  s += `<rect class="ft" x="${X(-.21)}" y="${Y(-.66)}" width="16.8" height="11.2" rx="2"/><circle class="solid" cx="${X(-.45)}" cy="${Y(-.5)}" r="2.4"/>`;
  s += `<rect class="ft" x="${X(.43)}" y="${Y(-.645)}" width="29.6" height="5.4" rx="1"/>`;
  for (let i = 1; i < 6; i++) s += `<path class="tk" d="M${r1(X(.43) + i * 29.6 / 6)} ${Y(-.645)} v5.4"/>`;
  // detail callout around the cabinet
  s += `<ellipse class="d" cx="180" cy="${Y(-.75)}" rx="66" ry="25"/><path class="d" d="M246 ${Y(-.75)} C290 ${Y(-.75)} 310 70 352 70"/>`;
  // portal by the window: pad, swirl, ring seen edge-on (rotation.y = 0.8)
  const px = X(-2), pz = Y(0.15), rx = 31 * Math.cos(0.8), rz = -31 * Math.sin(0.8);
  s += `<circle class="fl" cx="${px}" cy="${pz}" r="24.8"/><circle class="f" cx="${px}" cy="${pz}" r="19"/>`;
  s += `<path class="acc-l" d="M${px} ${pz} m0 -2 a2 2 0 1 1 -2 2 a5 5 0 0 1 8 -5 a8 8 0 0 1 -3 13 a11 11 0 0 1 -14 -9"/>`;
  s += `<path class="w" style="stroke-width:3.4" d="M${r1(px - rx)} ${r1(pz - rz)} L${r1(px + rx)} ${r1(pz + rz)}"/>`;
  // posters on the right wall
  s += `<rect class="solid" x="335" y="${Y(.2) - 18}" width="5" height="36"/><rect class="fl" x="335" y="${Y(2) - 16}" width="5" height="32"/>`;
  // beanbag and plant
  s += `<path class="fl" d="M266 192 C263 176 282 169 295 174 C307 179 305 201 292 207 C279 212 268 206 266 192 Z"/><path class="f" d="M276 186 q8 6 18 2"/>`;
  s += `<circle class="ft" cx="${X(-3.4)}" cy="${Y(-1.1)}" r="6.4"/>`;
  for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; s += `<path class="t" d="M${X(-3.4)} ${Y(-1.1)} q${r1(Math.cos(a + .5) * 6)} ${r1(Math.sin(a + .5) * 6)} ${r1(Math.cos(a) * 14)} ${r1(Math.sin(a) * 14)}"/>`; }
  // Bit's four stops: home, console, rack, portal
  const B = { home: [X(-.75), Y(-.1)], rack: [X(.95), Y(-.2)], con: [X(-.35), Y(-.15)], portal: [X(-1.3), Y(.45)] };
  s += `<path class="bitp" d="M${B.home} Q${X(-.55)} ${Y(.2)} ${B.con} Q${X(.3)} ${Y(.15)} ${B.rack} Q${X(.1)} ${Y(.75)} ${B.portal} Q${X(-1.1)} ${Y(.1)} ${B.home}"/>`;
  s += `<g transform="translate(${B.home})"><circle class="ft" r="7"/><path class="solid" d="M-5 -1.5 Q0 -5 5 -1.5 V1.5 Q0 4 -5 1.5 Z"/><circle r="1.2" cx="-2" cy="0" style="fill:var(--sheet)"/><circle r="1.2" cx="2" cy="0" style="fill:var(--sheet)"/><path class="tk" d="M0 -7 V-11"/><circle class="solid" cy="-12" r="1.5"/></g>`;
  for (const k of ['rack', 'con', 'portal']) s += `<circle class="solid" cx="${B[k][0]}" cy="${B[k][1]}" r="1.8"/>`;
  // your path: start, rack, console, portal
  s += E(X(-.4), Y(2.5) + 10, -90);
  s += P(`M${X(-.4)} ${Y(2.5)} C${X(-.2)} ${Y(1.6)} ${X(.7)} ${Y(.6)} ${X(.8)} ${Y(-.32)}`);
  s += P(`M${X(.6)} ${Y(-.25)} C${X(.4)} ${Y(-.05)} ${X(.1)} ${Y(-.05)} ${X(.02)} ${Y(-.28)}`);
  s += P(`M${X(-.25)} ${Y(-.2)} C${X(-.9)} ${Y(.5)} ${X(-1.3)} ${Y(.45)} ${X(-1.62)} ${Y(.3)}`);
  s += `<path class="p" d="M${px - 26} ${pz - 2} C${px - 40} ${pz - 6} ${px - 48} ${pz - 16} ${px - 52} ${pz - 24}"/>`;
  s += S(X(1.45), Y(-.1), 1) + S(X(-.05), Y(.35), 2) + S(X(-2.75), Y(.85), 3);
  // labels
  s += T(180, 24, 'BACK WALL', 'middle') + T(X(1.3) + 5, 40, 'NEON SIGN');
  s += T(250, 80, 'CABINET · SEE A');
  s += T(px, pz + 40, 'PORTAL', 'middle') + T(27, pz - 30, 'INTO THE GAME');
  s += T(26, Y(2.4) + 16, 'WINDOW · SUNSET');
  s += T(330, Y(.2) + 4, 'GO-KART POSTER', 'end') + T(330, Y(2) - 20, 'POSTER', 'end');
  s += T(286, 222, 'BEANBAG', 'middle') + T(X(-3.4) + 16, Y(-1.1) + 4, 'PLANT');
  s += T(B.home[0] - 11, B.home[1] + 4, 'BIT', 'end');
  s += T(X(-.4), Y(2.5) + 28, 'YOU START HERE', 'middle') + T(122, Y(1) + 58, 'RUG', 'middle');
  s += T(28, 264, '70s DEN · 8 m × 6 m');

  // Detail A: the cabinet top at 70 px per meter
  const X2 = x => 455 + x * 70, Y2 = z => 70 + (z + 1.1) * 70;
  s += `<rect class="d" x="356" y="30" width="198" height="110" rx="16"/>`;
  s += R(X2(-1.3), Y2(-1.1), 182, 49, 'fl') + `<path class="f" d="M${X2(-1.2)} ${Y2(-.5)} q14 -5 28 0 t28 0"/>`;
  s += `<rect class="solid" x="${X2(-.47)}" y="${Y2(-1.19)}" width="65.8" height="36.4" rx="5"/>`;
  s += `<rect class="ft" x="${X2(-.21)}" y="${Y2(-.66)}" width="29.4" height="19.6" rx="3"/><path class="solid" d="M${X2(-.21)} ${Y2(-.66) + 13} h29.4 v3 h-29.4 Z"/>`;
  s += `<rect class="fl" x="${X2(-.07)}" y="${Y2(-.6)}" width="9.8" height="5" rx="1"/>`;
  s += `<circle class="ft" cx="${X2(-.45)}" cy="${Y2(-.5)}" r="4.5"/><circle class="solid" cx="${X2(-.45)}" cy="${Y2(-.5)}" r="2"/><circle class="acc" cx="${X2(-.45) - 3}" cy="${Y2(-.5) - 3.5}" r="1.4"/>`;
  s += `<path class="tk" d="M${X2(-.45) + 4} ${Y2(-.5)} C${X2(-.35)} ${Y2(-.42)} ${X2(-.3)} ${Y2(-.55)} ${X2(-.21)} ${Y2(-.58)}"/>`;
  s += `<rect class="ft" x="${X2(.43)}" y="${Y2(-.645)}" width="51.8" height="9.1" rx="2"/>`;
  for (let i = 0; i < 6; i++) s += `<rect class="${i < 3 ? 'solid' : 'fl'}" x="${r1(X2(.43) + 1.6 + i * 8.4)}" y="${r1(Y2(-.645) + 1.8)}" width="6.6" height="5.5" rx="1"/>`;
  s += T(362, 46, 'DETAIL A · CABINET TOP', 'start', 'lbk');
  s += T(X2(0) + 0.5, Y2(-.95) + 2, 'CRT TV', 'middle', 'lbi');
  s += T(X2(-.45) - 4, Y2(-.4) + 18, 'JOYSTICK', 'end') + T(X2(0), Y2(-.4) + 18, 'ALEX-2600', 'middle') + T(X2(.85), Y2(-.4) + 18, '6-SLOT RACK', 'middle');
  // the cartridges
  s += T(362, 166, 'THE CARTRIDGES', 'start', 'lbk');
  const mk = [
    `<path class="t" d="M-9 22 h18 M-6 22 v4 M6 22 v4"/><circle class="solid" cx="-6" cy="27" r="2.4"/><circle class="solid" cx="6" cy="27" r="2.4"/>`,
    `<circle class="t" cx="-7" cy="30" r="4"/><circle class="t" cx="8" cy="22" r="4"/><path class="t" d="M-7 30 L4 25 L8 22 M-2 27 l2 -7"/>`,
    `<path class="t" d="M-8 30 q2 -9 14 -10"/><rect class="solid" x="2" y="17" width="9" height="6" rx="1.5" transform="rotate(-25 6 20)"/><circle class="f" cx="-8" cy="31" r="2"/><circle class="f" cx="-12" cy="28" r="1.6"/>`
  ];
  [['GO-KART', ''], ['WHEELIE', 'SIM'], ['DRIFTING', 'GAME']].forEach(([a, b], i) => {
    const cx = 392 + i * 63;
    s += cart(cx, 174, 44, 48, mk[i]) + T(cx, 238, a, 'middle', 'lbk') + (b ? T(cx, 251, b, 'middle', 'lbk') : '');
  });
  s += P('M380 268 H534') + T(455, 284, 'PLUG IN → PORTAL → PLAY', 'middle');
  return s;
}

// ---------- Go-kart (gokart/v2.html: TRACK_PTS × 1.3, HALF 3.5, WALL 5.5, stands, sign, SKY_SPOT, GRID) ----------
const KART_PTS = [[-30, -28], [0, -30], [28, -28], [42, -18], [41, -2], [28, 6], [22, 17], [25, 26], [22, 36], [12, 42],
  [-6, 34], [-16, 21], [-31, 20], [-42, 29], [-52, 26], [-59, 12], [-51, -14]].map(([x, z]) => [x * 1.3, z * 1.3]);
let kartLen = 0;
function drawKart() {
  const N = 640, { pts: CL, len } = spline(KART_PTS, N); kartLen = len;
  const SP = len / N, wrap = i => ((i % N) + N) % N;
  const TAN = CL.map((_, i) => { const a = CL[wrap(i - 1)], b = CL[wrap(i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]); return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; });
  const NRM = TAN.map(t => [-t[1], t[0]]); // to the driver's right, which is the infield
  const at = (i, off) => { i = wrap(Math.round(i)); return [CL[i][0] + NRM[i][0] * off, CL[i][1] + NRM[i][1] * off]; };
  const S0 = 30 / SP, STAND_I = S0 + 12 / SP;
  // stands: 22 m long, 7 rows of 0.9 m, front edge 6.7 m outside the center line
  const sc0 = at(STAND_I, -6.7), t0 = TAN[wrap(Math.round(STAND_I))], n0 = NRM[wrap(Math.round(STAND_I))];
  const st = (a, b) => [sc0[0] + t0[0] * a - n0[0] * b, sc0[1] + t0[1] * a - n0[1] * b];
  // fit everything into the drawing
  const all = [...CL.map((_, i) => at(i, -8)), ...CL.map((_, i) => at(i, 8)), st(-11, 6.3), st(11, 6.3)];
  const minX = Math.min(...all.map(p => p[0])), maxX = Math.max(...all.map(p => p[0]));
  const minY = Math.min(...all.map(p => p[1])), maxY = Math.max(...all.map(p => p[1]));
  const k = Math.min(372 / (maxX - minX), 236 / (maxY - minY));
  const ox = (400 - (maxX - minX) * k) / 2, oy = 14 + (242 - (maxY - minY) * k) / 2;
  const M = p => [ox + (p[0] - minX) * k, oy + (p[1] - minY) * k];
  const ring = off => line(CL.map((_, i) => M(at(i, off))), true);
  let s = '';
  // hills far off
  s += `<path class="f" d="M8 ${oy + 6} q10 -14 22 -4 q8 -10 18 0"/><path class="f" d="M352 ${262} q10 -14 22 -4 q8 -10 18 0"/>`;
  // barriers, asphalt, center line
  s += `<path class="t" d="${ring(-5.5)}"/><path class="t" d="${ring(5.5)}"/>`;
  s += `<path class="road-o" stroke-width="${r1(7 * k + 2)}" d="${ring(0)}"/><path class="road" stroke-width="${r1(7 * k - 1)}" d="${ring(0)}"/>`;
  s += `<path class="cl" d="${ring(0)}"/>`;
  // curbs where the track really bends
  let curbs = '';
  for (let i = 0; i < N; i += 2) {
    const a = TAN[wrap(i - 4)], b = TAN[wrap(i + 4)], curv = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1]))) / (8 * SP);
    if (curv < 1 / 24) continue;
    const cross = a[0] * b[1] - a[1] * b[0], side = cross > 0 ? 1 : -1; // curb on the inside of the bend
    if ((i / 2) % 2) continue;
    curbs += `M${M(at(i, side * 3.5)).map(r1)} L${M(at(i, side * 4.6)).map(r1)} `;
  }
  s += `<path class="w" style="stroke-width:1.8" d="${curbs}"/>`;
  // light towers outside the walls
  for (let q = 0; q < 9; q++) { const p = M(at((q + .5) * N / 9, (q % 2 ? 1 : -1) * 7.5)); s += `<rect class="ft" x="${r1(p[0] - 3)}" y="${r1(p[1] - 3)}" width="6" height="6"/><path class="tk" d="M${r1(p[0] - 3)} ${r1(p[1] - 3)} l6 6 m0 -6 l-6 6"/>`; }
  // start line, gantry and grid
  const g1 = M(at(S0, -5.5)), g2 = M(at(S0, 5.5));
  s += `<path class="w" d="M${g1.map(r1)} L${g2.map(r1)}"/>`;
  const c1 = M(at(S0 + .6 / SP, -3.5)), c2 = M(at(S0 + .6 / SP, 3.5));
  s += `<path class="road-o" style="stroke-width:3;stroke-dasharray:2.2 2.2" d="M${c1.map(r1)} L${c2.map(r1)}"/>`;
  [[3, -1.4], [3, 1.4], [6, -1.4], [6, 1.4], [9, 0]].forEach(([back, side], i) => {
    const p = M(at(S0 - back / SP, side));
    s += `<circle class="${i === 4 ? 'acc' : 'solid'}" cx="${r1(p[0])}" cy="${r1(p[1])}" r="${i === 4 ? 2.6 : 2}"/>`;
  });
  // grandstand and the build sign straight across from it
  const sp = [st(-11, 0), st(11, 0), st(11, 6.3), st(-11, 6.3)].map(M);
  s += `<path class="fl" d="${line(sp, true)}"/>`;
  for (let r = 1; r < 7; r++) s += `<path class="f" d="M${M(st(-11, r * .9)).map(r1)} L${M(st(11, r * .9)).map(r1)}"/>`;
  const sg1 = M(at(STAND_I - 4.5 / SP, 9)), sg2 = M(at(STAND_I + 4.5 / SP, 9));
  s += `<path class="w" style="stroke-width:4" d="M${sg1.map(r1)} L${sg2.map(r1)}"/>`;
  s += cam(...M(st(0, 3)), Math.atan2(n0[1], n0[0]), 15 * k * .9, .3);
  // Brian's Skyline on its turntable, at the roomiest spot in the infield
  let best = [0, 0], bestD = 0;
  const xs = CL.map(p => p[0]), ys = CL.map(p => p[1]);
  for (let x = Math.min(...xs); x <= Math.max(...xs); x += 2) for (let z = Math.min(...ys); z <= Math.max(...ys); z += 2) {
    let inside = false, dd = Infinity;
    for (let i = 0, j = N - 1; i < N; j = i++) {
      const a = CL[j], b = CL[i];
      if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
      dd = Math.min(dd, (b[0] - x) ** 2 + (b[1] - z) ** 2);
    }
    if (inside && dd > bestD) { bestD = dd; best = [x, z]; }
  }
  const sk = M(best);
  s += `<circle class="fl" cx="${r1(sk[0])}" cy="${r1(sk[1])}" r="${r1(3.7 * k)}"/><circle class="acc-l" cx="${r1(sk[0])}" cy="${r1(sk[1])}" r="${r1(3.7 * k - 2)}" style="stroke-width:1.2"/>`;
  s += `<g transform="translate(${r1(sk[0])} ${r1(sk[1])}) rotate(-28)">${carTop(4.5 * k, 1.8 * k)}</g>`;
  s += `<path class="acc-l" d="M${r1(sk[0] + 3.7 * k + 4)} ${r1(sk[1] - 5)} a${r1(3.7 * k + 4)} ${r1(3.7 * k + 4)} 0 0 1 -6 ${r1(3.7 * k + 4)}" marker-end="url(#arr)"/>`;
  // the crew cruising, and the driving direction
  [150, 250, 370, 470].forEach(i => { const p = M(at(i, (i % 3) - 1)); s += `<circle class="solid" cx="${r1(p[0])}" cy="${r1(p[1])}" r="2"/>`; });
  s += `<path class="p" d="${line(CL.slice(Math.round(S0 + 20 / SP), Math.round(S0 + 44 / SP)).map((_, j) => M(at(S0 + 20 / SP + j, -1.8))))}"/>`;
  // labels
  const near = j => { let b = 0, bd = Infinity; CL.forEach((p, i) => { const d = Math.hypot(p[0] - KART_PTS[j][0], p[1] - KART_PTS[j][1]); if (d < bd) { bd = d; b = i; } }); return b; };
  const lab = (j, off, t, a = 'middle', dy = 4) => { const p = M(at(near(j), off)); return T(p[0], p[1] + dy, t, a); };
  const stc = M(st(0, 8.2));
  s += T(stc[0], stc[1] - 1, 'GRANDSTAND · STANDS CAM', 'middle');
  const sgc = M(at(STAND_I, 12.5));
  s += T(sgc[0], sgc[1] + 6, 'SIGN: HOW I BUILT THE KART', 'middle');
  s += T(sk[0], sk[1] + 3.7 * k + 13, "BRIAN'S SKYLINE", 'middle') + T(sk[0], sk[1] + 3.7 * k + 25, 'ON A TURNTABLE', 'middle');
  s += lab(4, 10, 'FAST SWEEPER', 'end') + lab(6, -10, 'THE S', 'start') + lab(9, -11, 'HAIRPIN');
  s += lab(15, 13, 'FAST BEND', 'start') + lab(15, 13, 'HOME', 'start', 16);
  return s;
}

// ---------- Wheelie Sim (wheelie-ride/src/main.js: road 11 m, trees every 7.7 m, cameras, recycling) ----------
function drawBike() {
  const k = 5, BX = 150, CY = 100; // 5 px per meter; the bike sits still at BX
  const SX = z => BX - z * k, SY = x => CY + x * k; // the road runs along -z, drawn left to right
  let s = '';
  s += `<rect class="soft" x="0" y="${CY - 27.5}" width="400" height="55"/>`;
  s += `<path class="t" d="M0 ${CY - 27.5} H400 M0 ${CY + 27.5} H400"/><path class="f" d="M0 ${CY - 25.5} H400 M0 ${CY + 25.5} H400"/>`;
  let dash = '';
  for (let z = 12; z > -60; z -= 7) dash += `M${r1(SX(z))} ${CY} h${-2.2 * k} `;
  s += `<path class="w" style="stroke-width:1.6" d="${dash}"/>`;
  // trees and signs, i % 2 picks the side, i % 3 how far out
  for (let i = -1; i < 9; i++) {
    const side = ((i % 2) + 2) % 2 ? 1 : -1, x = side * (8 + (((i % 3) + 3) % 3) * 2.8), z = 10 - i * 7.7;
    s += tree(SX(z), SY(x), 5.8);
    if ([0, 1, 3, 4, 6, 7].includes(((i % 9) + 9) % 9)) {
      const sx = SX(z - .15), sy = SY(x + side * 1.7), rot = side < 0 ? -10 : 10;
      s += `<path class="w" style="stroke-width:2.4" transform="rotate(${rot} ${r1(sx)} ${r1(sy)})" d="M${r1(sx)} ${r1(sy - 7)} V${r1(sy + 7)}"/>`;
    }
  }
  // the bike and rider from above
  s += `<g transform="translate(${BX} ${CY + 8})"><path class="t" style="stroke-width:2.4" d="M-6 0 H6"/><rect class="solid" x="-8" y="-1.5" width="4" height="3" rx="1"/><rect class="solid" x="4" y="-1.5" width="4" height="3" rx="1"/><path class="t" d="M4 -3.5 V3.5"/><circle class="ft" cx="-1" cy="0" r="2.8"/></g>`;
  // the world slides back toward you
  s += P(`M260 ${CY - 13} H200`) + P(`M370 ${CY - 13} H310`) + P(`M330 ${CY + 13} H270`) + P(`M110 ${CY + 13} H50`);
  // ...and loops back ahead once it's behind
  s += `<path class="p" d="M${SX(17)} 26 C${SX(17)} 10 392 10 392 26"/>`;
  s += T(230, 9, 'PAST YOU → JUMPS 185 m AHEAD', 'middle');
  // cameras: 3rd person (1.5 right, 9.4 back), side cam (5.7 right, 11.8 back), 1st person in the helmet
  s += cam(SX(9.4), SY(1.5), Math.atan2(SY(0) - SY(1.5), SX(-4) - SX(9.4)), 40, .32);
  s += cam(SX(11.8), SY(5.7), Math.atan2(SY(1.05) - SY(5.7), SX(-4.5) - SX(11.8)), 40, .26);
  s += cam(BX + 3, CY + 1, 0, 30, .55);
  // labels
  s += T(SX(9.4) - 12, SY(1.5) + 3, '3RD', 'end') + T(SX(11.8) - 4, SY(5.7) + 16, 'SIDE', 'end') + T(BX + 14, CY + 22, '1ST');
  s += T(BX - 6, CY - 6, 'YOU STAY PUT', 'end');
  s += T(392, CY - 18, 'ROAD SLIDES TOWARD YOU', 'end');
  s += T(392, CY + 82, 'ALPINESTARS SIGNS', 'end') + T(392, CY + 94, '+ PINE TREES', 'end');
  s += T(6, CY - 32, '11 m ROAD');
  // side view: how far back you can pull (wheel 0.56 m, axles 1.64 m apart; 30 px per meter)
  const gy = 290, ax = 300, ay = gy - 16.8, ang = 48 * Math.PI / 180, fx = ax + 49 * Math.cos(ang), fy = ay - 49 * Math.sin(ang);
  s += `<path class="t" d="M206 ${gy} H392"/><path class="f" d="M206 ${gy + 4} h8 m6 0 h10 m8 0 h6 m30 0 h12 m40 0 h8"/>`;
  s += `<path class="d" d="M${ax} ${ay} L${r1(ax + 70 * Math.cos(66 * Math.PI / 180))} ${r1(ay - 70 * Math.sin(66 * Math.PI / 180))}"/>`;
  s += `<path class="acc-l" style="stroke-dasharray:4 4" d="M${ax} ${ay} L${r1(ax + 74 * Math.cos(85 * Math.PI / 180))} ${r1(ay - 74 * Math.sin(85 * Math.PI / 180))}"/>`;
  s += `<path class="f" d="M${ax + 40} ${ay} A40 40 0 0 0 ${r1(ax + 40 * Math.cos(ang))} ${r1(ay - 40 * Math.sin(ang))}"/>`;
  s += `<circle class="ft" cx="${ax}" cy="${r1(ay)}" r="16.8"/><circle class="t" cx="${ax}" cy="${r1(ay)}" r="12"/><circle class="solid" cx="${ax}" cy="${r1(ay)}" r="2"/>`;
  s += `<circle class="ft" cx="${r1(fx)}" cy="${r1(fy)}" r="16.8"/><circle class="t" cx="${r1(fx)}" cy="${r1(fy)}" r="12"/><circle class="solid" cx="${r1(fx)}" cy="${r1(fy)}" r="2"/>`;
  s += `<path class="w" d="M${ax} ${r1(ay)} L${r1(ax + 26 * Math.cos(ang) - 6)} ${r1(ay - 26 * Math.sin(ang) + 2)} L${r1(fx - 4)} ${r1(fy - 12)} M${r1(fx)} ${r1(fy)} L${r1(fx - 5)} ${r1(fy - 14)}"/>`;
  // rider leaning back, one hand on the bars, one dragging on the road with sparks
  const hip = [ax + 14, ay - 22];
  s += `<path class="w" d="M${hip} L${hip[0] - 16} ${hip[1] - 4} M${hip[0] - 8} ${hip[1] - 2} L${r1(fx - 6)} ${r1(fy - 14)} M${hip[0] - 10} ${hip[1] - 3} Q${hip[0] - 22} ${hip[1] + 14} ${hip[0] - 20} ${gy - 1}"/>`;
  s += `<circle class="solid" cx="${hip[0] - 20}" cy="${hip[1] - 7}" r="6.5"/><path class="acc-l" d="M${hip[0] - 26} ${hip[1] - 9} h-5"/>`;
  s += `<path class="acc-l" d="M${hip[0] - 24} ${gy - 3} l-7 -4 M${hip[0] - 25} ${gy - 1} l-9 0 M${hip[0] - 23} ${gy - 5} l-4 -6"/>`;
  s += T(r1(ax + 70 * Math.cos(66 * Math.PI / 180)) + 4, r1(ay - 70 * Math.sin(66 * Math.PI / 180)) + 4, '66° HAND DRAG');
  s += T(r1(ax + 74 * Math.cos(85 * Math.PI / 180)) - 6, r1(ay - 74 * Math.sin(85 * Math.PI / 180)) + 4, '85° LOOP OUT', 'end');
  s += T(ax - 20, gy - 32, 'PIVOTS ON THE', 'end') + T(ax - 20, gy - 20, 'REAR AXLE', 'end');
  s += T(8, 222, 'SIDE VIEW', 'start', 'lbk') + T(8, 238, 'HOLD SPACE TO PULL BACK');
  s += T(8, 262, '5 RIDES: STREET · TRAIL · SPRINT') + T(8, 276, 'SUR-RON · NINJA H2R');
  return s;
}

// ---------- Drift Garage (drift-garage/index.html: routes, scenery per course, garage) ----------
const DRIFT_ROUTES = [
  [[-34, 18], [-27, 4], [-18, -18], [-2, -26], [17, -23], [29, -10], [24, 4], [11, 11], [4, 25], [-8, 30], [-24, 27], [-34, 18]],
  [[-26, 0], [-15, -22], [1, -19], [14, -7], [28, -22], [33, 8], [14, 21], [-9, 13], [-26, 0]],
  [[-25, 0], [-20, -23], [19, -23], [30, 0], [19, 24], [-19, 24], [-25, 0]]
].map(r => r.map(([x, z]) => [x * 2.2, z * 2.2]));
function drawDrift() {
  let s = '';
  const CELL = [8, 146, 284, 422], CW = 130, TOP = 30, H = 168;
  // the garage
  const gx = CELL[0];
  s += W(`M${gx + 40} ${TOP + H} H${gx} V${TOP} H${gx + CW} V${TOP + H} H${gx + 90}`) + `<path class="d" d="M${gx + 40} ${TOP + H} H${gx + 90}"/>`;
  s += R(gx + 8, TOP + 6, CW - 16, 12, 'fl') + `<path class="tk" d="M${gx + 20} ${TOP + 9} v6 M${gx + 30} ${TOP + 9} v6 M${gx + 44} ${TOP + 9} l4 6 M${gx + 92} ${TOP + 8} v8 M${gx + 102} ${TOP + 8} l-3 8"/>`;
  s += `<circle class="soft" cx="${gx + 65}" cy="${TOP + 80}" r="44"/><circle class="t" cx="${gx + 65}" cy="${TOP + 80}" r="44"/><circle class="f" cx="${gx + 65}" cy="${TOP + 80}" r="38"/>`;
  s += `<g transform="translate(${gx + 65} ${TOP + 80}) rotate(-22)">${carTop(50, 23)}</g>`;
  s += `<path class="acc-l" d="M${gx + 113} ${TOP + 70} a48 48 0 0 1 -10 42" marker-end="url(#arr)"/><path class="acc-l" d="M${gx + 17} ${TOP + 92} a48 48 0 0 1 10 -42" marker-end="url(#arr)"/>`;
  s += R(gx + 6, TOP + 138, 34, 20, 'fl') + R(gx + 90, TOP + 138, 34, 20, 'fl');
  s += T(gx + 65, TOP + 30, 'TUNING WALL', 'middle') + T(gx + 65, TOP + 135, 'DRAG TO SPIN', 'middle');
  s += T(gx + 23, TOP + 152, 'PAINT', 'middle') + T(gx + 107, TOP + 152, 'SAVES', 'middle');
  s += E(gx + 65, TOP + H + 10, -90);
  s += T(gx + 2, 20, 'GARAGE', 'start', 'lbk') + T(gx, TOP + H + 22, 'AE86 · S15 · SUPRA', 'start') + T(gx, TOP + H + 35, 'RX-7 · NINJA H2', 'start');
  s += P(`M${gx + 94} ${TOP + H + 4} C${gx + 132} ${TOP + H + 2} ${gx + 134} ${TOP + 100} ${CELL[1] - 4} ${TOP + 96}`);
  // the three courses, each fitted into its cell along with its scenery
  const names = [['01 DOCKYARD ROUTE', 'LONG SWEEPERS, PORT'], ['02 TOUGE RUN', 'TIGHT BENDS'], ['03 DRIFT PLAYGROUND', 'OPEN LOT + CONES']];
  const boxes = [[-100, -121, 100, 72], [-74, -66, 82, 62], [-82, -70, 82, 70]];
  DRIFT_ROUTES.forEach((route, i) => {
    const cx = CELL[i + 1], [x0, z0, x1, z1] = boxes[i], k = Math.min(CW / (x1 - x0), H / (z1 - z0));
    const M = ([x, z]) => [cx + (CW - (x1 - x0) * k) / 2 + (x - x0) * k, TOP + (H - (z1 - z0) * k) / 2 + (z - z0) * k];
    const dist = (x, z) => { let d = Infinity; for (let j = 0; j < route.length - 1; j++) { const a = route[j], b = route[j + 1], dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz))); d = Math.min(d, Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t)); } return d; };
    const r = rng(7 + i * 31);
    let scen = '';
    s += `<rect class="d" x="${cx}" y="${TOP}" width="${CW}" height="${H}" rx="14"/>`;
    if (i === 0) {
      const w1 = M([-100, -121]), w2 = M([100, -95]);
      scen += `<rect class="soft" x="${r1(w1[0])}" y="${r1(w1[1])}" width="${r1(w2[0] - w1[0])}" height="${r1(w2[1] - w1[1])}" rx="6"/>`;
      scen += `<path class="f" d="M${r1(w1[0] + 8)} ${r1(w1[1] + 7)} q6 -4 12 0 t12 0 M${r1(w1[0] + 60)} ${r1(w1[1] + 12)} q6 -4 12 0 t12 0"/>`;
      for (let n = 0, tries = 0; n < 14 && tries < 400; tries++) {
        const x = -90 + r() * 180, z = -88 + r() * 150;
        if (dist(x, z) < 16) continue;
        n++; const p = M([x, z]), rot = r() < .5 ? 0 : 90;
        scen += `<rect class="${r() < .35 ? 'solid' : 'fl'}" x="${r1(p[0] - 5)}" y="${r1(p[1] - 2.2)}" width="10" height="4.4" transform="rotate(${rot} ${r1(p[0])} ${r1(p[1])})"/>`;
      }
      for (const [x, z] of [[-95, -60], [95, 40]]) { const p = M([x, z]), q = M([x + 5, z - 21]); scen += `<rect class="ft" x="${r1(p[0] - 4)}" y="${r1(q[1])}" width="8" height="${r1(p[1] - q[1] + 6)}"/><path class="tk" d="M${r1(p[0] - 4)} ${r1(q[1])} l8 6 m-8 0 l8 6 m-8 0 l8 6"/>`; }
      s += T(cx + CW - 6, TOP + 14, 'WATER', 'end');
    } else if (i === 1) {
      for (let n = 0, tries = 0; n < 34 && tries < 600; tries++) {
        const x = x0 + r() * (x1 - x0), z = z0 + r() * (z1 - z0);
        if (dist(x, z) < 11) continue;
        n++; const p = M([x, z]);
        scen += r() < .18 ? `<path class="solid" d="M${r1(p[0] - 3)} ${r1(p[1] + 2)} l2 -4 l3 -1 l2 3 l-1 3 Z"/>` : tree(p[0], p[1], 4 + r() * 2);
      }
    } else {
      const a = M([-75, -62]), b = M([75, 62]);
      scen += `<rect class="soft" x="${r1(a[0])}" y="${r1(a[1])}" width="${r1(b[0] - a[0])}" height="${r1(b[1] - a[1])}" rx="4"/>`;
      for (let x = -30; x <= 30; x += 10) for (const z of [-16, 0, 16]) { const p = M([x + (z === 0 ? 5 : 0), z]); scen += `<path class="acc" d="M${r1(p[0])} ${r1(p[1] - 3)} l2.4 4.4 h-4.8 Z"/>`; }
      for (const [x, z] of [[-80, -66], [80, -66], [-80, 66], [80, 66]]) { const p = M([x, z]); scen += `<circle class="solid" cx="${r1(p[0])}" cy="${r1(p[1])}" r="2.2"/><path class="f" d="M${r1(p[0])} ${r1(p[1])} m-5 0 h-3 m16 0 h-3 m-5 -5 v-3 m0 16 v-3"/>`; }
    }
    const pts = route.map(M), roadW = Math.max(6, 14 * k);
    s += scen + `<path class="road-o" stroke-width="${r1(roadW + 2.4)}" d="${line(pts)}"/><path class="road" stroke-width="${r1(roadW)}" d="${line(pts)}"/><path class="cl" d="${line(pts)}"/>`;
    if (i === 1) {
      // guardrails both sides of the mountain road
      const off = sgn => route.slice(0, -1).map((a, j) => { const b = route[j + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = (b[1] - a[1]) / l, nz = -(b[0] - a[0]) / l; return [M([a[0] + nx * sgn * 11, a[1] + nz * sgn * 11]), M([b[0] + nx * sgn * 11, b[1] + nz * sgn * 11])]; });
      for (const sgn of [-1, 1]) s += `<path class="tk" style="stroke-dasharray:5 2" d="${off(sgn).map(([a, b]) => `M${a.map(r1)} L${b.map(r1)}`).join(' ')}"/>`;
    }
    s += T(cx + 2, 20, names[i][0], 'start', 'lbk') + T(cx, TOP + H + 22, names[i][1], 'start');
  });
  s += T(CELL[3] + CW, TOP + H + 35, 'PICK ONE, DRIFT FOR POINTS', 'end');
  return s;
}

// ---------- Little header doodles ----------
const SPOTS = {
  'spot-lobby': cart(31, 4, 36, 40, `<path class="t" d="M-8 26 h16 M-5 26 v3 M5 26 v3"/><circle class="solid" cx="-5" cy="30" r="2"/><circle class="solid" cx="5" cy="30" r="2"/>`)
    + `<path class="acc-l" d="M54 10 l4 -4 M56 18 h5 M8 10 l-4 -4"/>`,
  'spot-kart': `<rect class="ft" x="10" y="14" width="40" height="18" rx="5"/><rect class="solid" x="6" y="8" width="11" height="6" rx="2"/><rect class="solid" x="6" y="32" width="11" height="6" rx="2"/><rect class="solid" x="43" y="8" width="11" height="6" rx="2"/><rect class="solid" x="43" y="32" width="11" height="6" rx="2"/><circle class="fl" cx="28" cy="23" r="5"/><path class="t" d="M36 17 v12"/><path class="acc-l" d="M2 16 h-4 M2 23 h-7 M2 30 h-4"/>`,
  'spot-bike': `<path class="t" d="M4 42 H60"/><circle class="ft" cx="18" cy="34" r="8"/><circle class="ft" cx="38" cy="12" r="8"/><path class="w" d="M18 34 L30 26 L38 12 M24 30 l6 -12"/><circle class="solid" cx="22" cy="10" r="5"/><path class="t" d="M22 15 L27 26 M24 18 L34 13 M23 18 Q14 30 12 41"/><path class="acc-l" d="M10 41 l-5 -3 M9 42 h-6"/>`,
  'spot-drift': `<g transform="translate(36 22) rotate(-24)">${carTop(30, 15)}</g><circle class="f" cx="12" cy="34" r="5"/><circle class="f" cx="6" cy="26" r="4"/><circle class="f" cx="14" cy="22" r="3"/><path class="acc-l" d="M44 40 q8 -6 14 -4"/>`
};

// ---------- Alex's notebook sketch of the whole gallery (ground plans/IMG_0786.HEIC, left page) ----------
// Traced by eye from the photo. Coordinates are in photo pixels of gallery-versions/img/notebook-gallery.jpg
// scaled to 794 wide, so the wobbles and lines that run past the corners are his.
function drawSketch() {
  const room = (cls, pts) => `<path class="${cls}" d="M${pts.map(p => p.join(' ')).join(' L')} Z"/>`;
  let s = '';
  // rooms, so each one can get its own colour
  s += room('tint1', [[35, 42], [378, 40], [380, 335], [218, 480], [35, 420]]);           // go-kart room
  s += room('tint2', [[378, 18], [775, 15], [760, 135], [380, 335]]);                      // rose
  s += room('tint3', [[380, 335], [775, 128], [775, 492], [540, 495]]);                    // builds
  s += room('tint4', [[380, 335], [540, 495], [540, 553], [238, 555], [218, 480]]);        // lobby
  s += room('tint5', [[540, 495], [775, 492], [775, 712], [540, 712]]);                    // play
  s += room('tint6', [[238, 555], [540, 553], [540, 712], [222, 712]]);                    // entrance
  s += room('tint7', [[35, 420], [218, 480], [238, 555], [222, 712], [35, 712]]);          // lego rc
  // the go-kart track: a band between two loops
  const outer = 'M100 80 C160 58 262 60 287 102 C312 160 306 300 286 342 C258 384 140 388 100 352 C68 320 68 200 78 132 C82 104 90 86 100 80 Z';
  const inner = 'M126 116 C172 96 236 100 254 132 C274 182 270 290 250 320 C226 352 152 352 130 322 C106 284 104 182 126 116 Z';
  s += `<path class="soft" fill-rule="evenodd" d="${outer} ${inner}"/><path class="t" d="${outer}"/><path class="t" d="${inner}"/>`;
  // walls, the way he drew them (some run past the corners)
  s += W('M35 44 L380 40 M378 16 L776 14 L775 712 L35 714 L35 44');
  s += W('M378 16 L380 336 M762 134 L380 336 L218 480 M380 336 L540 496 L776 492 M540 496 L540 712');
  s += W('M35 420 Q130 440 218 480 L238 556 L540 553 M238 556 L216 736');
  s += `<path class="t" d="M655 502 L660 690"/>`;                                            // stage line in Play
  // rose, seen from above
  s += `<ellipse class="fl" cx="538" cy="104" rx="56" ry="43"/><ellipse class="t" cx="538" cy="106" rx="30" ry="25"/>`;
  // the fort in Builds, with a post at each corner
  s += `<path class="w" d="M534 286 L690 268 L702 432 L540 456 Z"/>`;
  for (const [x, y] of [[534, 286], [690, 268], [702, 432], [540, 456]]) s += R(x - 8, y - 8, 16, 16, 'fl');
  // lego rc cars waiting in a row, and the go-kart parked by the track
  for (let i = 0; i < 5; i++) s += R(76 + i * 22, 470 + (i % 2) * 2, 13, 19, 'ft');
  s += `<g transform="translate(96 388) rotate(-60)">${carTop(44, 30)}</g>`;
  // room names, where he wrote them
  s += T(452, 212, 'Rose', 'middle', 'lbt') + T(470, 336, 'Builds', 'middle', 'lbt');
  s += T(250, 418, 'Go-kart room', 'middle', 'lbt', 'transform="rotate(-34 250 418)"');
  s += T(360, 500, 'Lobby', 'middle', 'lbt') + T(130, 590, 'Lego RC', 'middle', 'lbt') + T(130, 612, 'room', 'middle', 'lbt');
  s += T(380, 650, 'Entrance', 'middle', 'lbt') + T(598, 585, 'Play', 'middle', 'lbt');
  s += E(380, 728, -90) + T(390, 748, 'way in', 'start');
  return s;
}

global.GP = {
  concepts: plans,
  lobby: drawLobby,
  kart: () => { const s = drawKart(); GP.kartLen = kartLen; return s; },
  bike: drawBike,
  drift: drawDrift,
  sketch: drawSketch,
  spots: SPOTS,
  kartLen: 0
};
})(window);
