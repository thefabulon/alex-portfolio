// Wheelie Ride — a small three.js riding game.
// Loaded as a classic script after three.min.js, so `THREE` is a global.
(() => {
  // ---------------------------------------------------------------------------
  // Renderer, scene, camera, lights
  // ---------------------------------------------------------------------------
  const host = document.getElementById('scene');
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#a9ccce');
  scene.fog = new THREE.Fog('#a9ccce', 28, 105);

  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 200);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x66756b, 2.5));
  const sun = new THREE.DirectionalLight(0xfff2d4, 2.7);
  sun.position.set(-8, 15, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22 });
  scene.add(sun);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const mat = (color, roughness = 0.75) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.12 });

  function box(w, h, d, material, x, y, z, parent = scene) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }

  const asphalt = mat('#35444b');
  const grass = mat('#718e73');
  const stripe = mat('#eeddb1');
  const dark = mat('#151e23');
  const chrome = mat('#c3d7d2', 0.3);

  // ---------------------------------------------------------------------------
  // World: ground, road, lane markings, trees and roadside signs
  // ---------------------------------------------------------------------------
  box(210, 0.12, 230, grass, 0, -0.14, -45);
  box(11, 0.07, 230, asphalt, 0, -0.055, -45);
  box(0.13, 0.025, 230, stripe, -5.33, 0, -45);
  box(0.13, 0.025, 230, stripe, 5.33, 0, -45);

  const markings = [];
  for (let i = 0; i < 30; i++) markings.push(box(0.13, 0.025, 2.2, stripe, 0, 0.005, 12 - i * 7));

  const trunkMat = mat('#4b5443');
  const leafMat = mat('#366f67');

  const signTexture = (() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f3f0e7';
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = '#101b23';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, 502, 118);
    ctx.fillStyle = '#101b23';
    ctx.font = '900 58px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('alpinestars', 256, 66);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  })();
  const signMat = new THREE.MeshStandardMaterial({ map: signTexture, roughness: 0.55 });

  const props = [];
  for (let i = 0; i < 24; i++) {
    const group = new THREE.Group();
    scene.add(group);
    const side = i % 2 ? 1 : -1;
    group.position.set(side * (8 + (i % 3) * 2.8), 0, 10 - i * 7.7);

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, 1.5, 7), trunkMat);
    trunk.position.y = 0.75;
    trunk.castShadow = true;
    group.add(trunk);

    const crown = new THREE.Mesh(new THREE.ConeGeometry(1.15, 3, 7), leafMat);
    crown.position.y = 2.65;
    crown.castShadow = true;
    group.add(crown);

    if (Math.random() < 0.58) {
      const sign = new THREE.Group();
      sign.position.set(side * 1.7, 1.75, 0.15);
      sign.rotation.y = side < 0 ? 0.18 : -0.18;
      box(0.075, 1.75, 0.075, dark, 0, -0.875, 0, sign);
      const board = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.7, 0.08), signMat);
      board.castShadow = true;
      sign.add(board);
      group.add(sign);
    }
    props.push(group);
  }

  // ---------------------------------------------------------------------------
  // Vehicles
  // ---------------------------------------------------------------------------
  // max: top speed (m/s), turn: steering response, raise: how fast the front lifts,
  // mass: kg, used when the bike crashes and tumbles
  const MODELS = {
    street:   { color: '#d6f05b', max: 20,  turn: 1.25, raise: 0.82, mass: 95 },
    trail:    { color: '#fb9e6d', max: 17,  turn: 1.55, raise: 0.7,  mass: 90 },
    sprint:   { color: '#75d8e1', max: 25,  turn: 1.05, raise: 0.95, mass: 85 },
    'sur-ron':{ color: '#e8edf0', max: 55,  turn: 1.18, raise: 0.9,  mass: 65 },
    kawasaki: { color: '#39e75f', max: 140, turn: 0.92, raise: 1.08, mass: 210 },
  };

  const bikeRig = new THREE.Group();
  scene.add(bikeRig);

  const contactShadowMat = new THREE.MeshBasicMaterial({
    color: '#17252a', transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide,
  });
  const contactShadows = [-0.82, 0.82].map((z) => {
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.52, 32), contactShadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.set(1.55, 0.42, 1);
    shadow.position.set(0, -0.071, z);
    bikeRig.add(shadow);
    return shadow;
  });

  // Wheelies rotate around the REAR AXLE, not the middle of the bike. If the
  // bike rotated around its centre, lifting the front would push the rear
  // wheel underground by the same amount. Rotating around the axle keeps the
  // rear tyre exactly where it is, touching the road.
  const WHEEL_Y = 0.56;      // axle height
  const AXLE_OFFSET = 0.82;  // distance from bike centre to each axle
  const wheeliePivot = new THREE.Group();
  // The rear axle sits at +Z in rig space because the bike is turned 180°.
  wheeliePivot.position.set(0, WHEEL_Y, AXLE_OFFSET);
  bikeRig.add(wheeliePivot);

  const bike = new THREE.Group();
  // The model's front wheel is at local +Z; turn it to face the road ahead (-Z).
  bike.rotation.y = Math.PI;
  // Shift the model so its rear axle lands on the pivot point.
  bike.position.set(0, -WHEEL_Y, -AXLE_OFFSET);
  wheeliePivot.add(bike);

  let selected = 'street';
  let wheels = [];
  // Rider parts that move during a hand drag (rebuilt with each bike).
  // Each arm and leg is a two-part "limb" (see makeLimb) with an elbow or knee.
  let rider, dragArm, gripArm, legs = [], glove;
  // The torso and head, hidden in 1st person so the camera isn't inside your own head.
  let riderShell = [];
  let fit; // how the rider sits on the current bike (see FITS)

  const Y_AXIS = new THREE.Vector3(0, 1, 0);
  const Z_AXIS = new THREE.Vector3(0, 0, 1);

  // A soft sky to reflect in the shiny parts (the H2R's mirror paint, chrome,
  // brake discs). Without something to reflect, metal just renders black.
  const envMap = (() => {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    const geo = new THREE.SphereGeometry(10, 32, 16);
    const top = new THREE.Color('#f2fbfb'), horizon = new THREE.Color('#a9ccce'), ground = new THREE.Color('#2e3a3c');
    const colors = [];
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 10;
      const c = y > 0 ? horizon.clone().lerp(top, Math.sqrt(y)) : horizon.clone().lerp(ground, Math.min(1, -y * 4));
      colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    envScene.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    const glow = new THREE.Mesh(new THREE.SphereGeometry(1.4, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 4.6, 4) }));
    glow.position.set(-5, 7, 5); // the sun, roughly where the real one is
    envScene.add(glow);
    const target = pmrem.fromScene(envScene, 0.02);
    pmrem.dispose();
    return target.texture;
  })();
  const shiny = (color, metalness, roughness, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness, envMap, ...extra });

  function rod(a, b, radius, material, parent = bike) {
    const A = new THREE.Vector3(...a);
    const B = new THREE.Vector3(...b);
    const delta = B.clone().sub(A);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), 10), material);
    mesh.position.copy(A).add(B).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(Y_AXIS, delta.normalize());
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }
  // A tube from a (radius r1) to b (radius r2): exhausts and ducts.
  function taper(a, b, r1, r2, material, parent = bike) {
    const mesh = rod(a, b, 1, material, parent);
    mesh.geometry = new THREE.CylinderGeometry(r2, r1, mesh.geometry.parameters.height, 16);
    return mesh;
  }
  // A flat bar from a to b, w wide (sideways) and h thick: frame spars, swingarms, fenders.
  function slab(a, b, w, h, material, parent = bike) {
    const A = new THREE.Vector3(...a);
    const B = new THREE.Vector3(...b);
    const delta = B.clone().sub(A);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, delta.length()), material);
    mesh.position.copy(A).add(B).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(Z_AXIS, delta.normalize());
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }
  // A squashed sphere: fuel tank, head, hips.
  function blob(rx, ry, rz, material, x, y, z, parent = bike) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 22, 16), material);
    mesh.scale.set(rx, ry, rz);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }
  // A disc facing sideways: brake rotors, sprockets, hubs.
  function disc(r, thick, material, x, y, z, parent = bike) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, thick, 28), material);
    mesh.rotation.z = Math.PI / 2;
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }
  const lerp3 = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

  // Painted-on lettering ("SUR-RON", "H2R").
  function decal(text, w, h, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = Math.max(32, Math.round((512 * h) / w));
    const ctx = canvas.getContext('2d');
    let size = canvas.height * 0.86;
    do { ctx.font = `italic 900 ${size}px Arial`; size -= 4; } while (ctx.measureText(text).width > 480 && size > 8);
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, canvas.height / 2);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    return new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({ map, transparent: true, roughness: 0.5, depthWrite: false }));
  }
  // The same lettering on both sides. `rise` tips it so the front end is higher.
  function sideDecals(text, w, h, color, x, y, z, rise = 0) {
    for (const s of [-1, 1]) {
      const d = decal(text, w, h, color);
      d.position.set(s * x, y, z);
      d.rotation.set(-rise, s * Math.PI / 2, 0);
      bike.add(d);
    }
  }

  // ---------------------------------------------------------------------------
  // How the rider sits on each kind of bike, in the bike model's own space
  // (front wheel toward +Z, rear axle at z = -0.82, both axles 0.56 up).
  // hip: where the hips sit. grip / foot: right hand and right foot (the left
  // side is the mirror image). pitch: how far the body leans forward (radians):
  // upright on a bicycle, attack position on the Sur-Ron, a full tuck on the H2R.
  // eyeDown: extra head tilt in 1st person, so the bars stay in view.
  // scrape: x, y, z, radius of the hard parts that grind on the road in a crash.
  // ---------------------------------------------------------------------------
  const FITS = {
    bicycle: {
      hip: [0, 1.62, -0.32], grip: [0.35, 1.67, 0.55], foot: [0.18, 0.75, -0.1], pitch: 0,
      scrape: [
        [-0.42, 1.68, 0.57, 0.05], [0.42, 1.68, 0.57, 0.05], [0, 1.68, 0.57, 0.05], // bars
        [0, 1.43, -0.68, 0.06], [0, 1.43, -0.14, 0.06],                         // saddle
        [-0.22, 0.71, -0.05, 0.04], [0.22, 0.71, -0.05, 0.04],                  // pedals
        [0, 1.35, 0.51, 0.05],                                                  // head tube
      ],
    },
    'sur-ron': {
      hip: [0, 1.6, -0.3], grip: [0.37, 1.67, 0.38], foot: [0.21, 0.76, -0.2], pitch: 0.22, eyeDown: -0.18,
      scrape: [
        [-0.44, 1.67, 0.37, 0.05], [0.44, 1.67, 0.37, 0.05], [0, 1.63, 0.43, 0.05], // bars
        [0, 1.45, 0.14, 0.06], [0, 1.44, -0.64, 0.06],                         // seat
        [-0.26, 0.72, -0.2, 0.04], [0.26, 0.72, -0.2, 0.04],                    // footpegs
        [0, 1.4, 0.66, 0.05], [0, 1.08, 1.12, 0.03], [0, 1.42, -1.12, 0.03],    // number plate, fender tips
        [-0.13, 0.68, 0.08, 0.06], [0.13, 0.68, 0.08, 0.06],                    // motor
      ],
    },
    kawasaki: {
      hip: [0, 1.52, -0.38], grip: [0.31, 1.41, 0.43], foot: [0.22, 0.97, -0.36], pitch: 0.6,
      scrape: [
        [-0.37, 1.4, 0.42, 0.04], [0.37, 1.4, 0.42, 0.04],                      // clip-on bar ends
        [0, 1.3, 1.03, 0.05], [0, 1.67, 0.39, 0.03],                            // nose, screen
        [-0.37, 1.4, 0.63, 0.03], [0.37, 1.4, 0.63, 0.03],                      // winglets
        [0, 1.58, 0.1, 0.05], [0, 1.44, -0.32, 0.05], [0, 1.5, -0.96, 0.04],    // tank, seat, tail
        [-0.26, 0.95, -0.36, 0.03], [0.26, 0.95, -0.36, 0.03],                  // footpegs
        [0.3, 0.94, -0.62, 0.1], [-0.34, 1.0, 0.0, 0.06],                       // exhaust, supercharger
        [-0.2, 0.66, 0.06, 0.04], [0.2, 0.66, 0.06, 0.04],                      // engine cases
        [-0.28, 1.06, 0.5, 0.04], [0.28, 1.06, 0.5, 0.04],                      // side panels
      ],
    },
  };

  // Rider anchor points, in the bike model's own space. HIP, GRIP_* and PEDAL_*
  // are set from FITS whenever a bike is built.
  const HIP = new THREE.Vector3();
  const SHOULDER_L = new THREE.Vector3(-0.19, 0.42, 0.19); // relative to HIP
  const SHOULDER_R = new THREE.Vector3(0.19, 0.42, 0.19);
  const HIP_L = new THREE.Vector3(-0.11, 0.0, -0.02);
  const HIP_R = new THREE.Vector3(0.11, 0.0, -0.02);
  const GRIP_L = new THREE.Vector3(), GRIP_R = new THREE.Vector3();
  const PEDAL_L = new THREE.Vector3(), PEDAL_R = new THREE.Vector3();
  // Hand-drag pose: slide down off the left side of the seat and bend out
  // sideways. The body tips forward against the wheelie so it stays fairly
  // upright in the world instead of falling back with the bike.
  const DRAG_SHIFT = new THREE.Vector3(-0.3, -0.4, -0.3);
  const DRAG_BACK = 0.4;  // radians the body still leans back in the world
  const DRAG_ROLL = 0.8;  // radians of sideways bend toward the road
  const ARM_REACH = 0.95; // how far the hand reaches before it's on the road

  function buildBike() {
    while (bike.children.length) bike.remove(bike.children[0]);
    wheels = [];
    const kind = FITS[selected] ? selected : 'bicycle';
    fit = FITS[kind];
    HIP.fromArray(fit.hip);
    GRIP_R.fromArray(fit.grip);
    GRIP_L.copy(GRIP_R).setX(-GRIP_R.x);
    PEDAL_R.fromArray(fit.foot);
    PEDAL_L.copy(PEDAL_R).setX(-PEDAL_R.x);

    if (kind === 'sur-ron') buildSurRon();
    else if (kind === 'kawasaki') buildNinja();
    else buildBicycle(mat(MODELS[selected].color, 0.37));
    buildRider();
  }

  function addWheel(z) {
    const wheel = new THREE.Group();
    wheel.position.set(0, WHEEL_Y, z);
    bike.add(wheel);
    wheels.push(wheel);
    return wheel;
  }
  // A tyre is a torus standing on edge. `width` stretches it sideways.
  function tyre(wheel, radius, tube, material, width = 1) {
    const tire = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 12, 36), material);
    tire.rotation.y = Math.PI / 2;
    tire.scale.z = width;
    tire.castShadow = true;
    wheel.add(tire);
    return tire;
  }

  // ---------------------------------------------------------------------------
  // Street, Trail and Sprint: bicycles
  // ---------------------------------------------------------------------------
  function buildBicycle(frame) {
    for (const z of [-0.82, 0.82]) {
      const wheel = addWheel(z);
      tyre(wheel, 0.44, 0.095, dark);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.018, 7, 28), chrome);
      rim.rotation.y = Math.PI / 2;
      wheel.add(rim);
      for (let s = 0; s < 8; s++) {
        const a = (s * Math.PI) / 4;
        rod([0, 0, 0], [0, Math.sin(a) * 0.34, Math.cos(a) * 0.34], 0.012, chrome, wheel);
      }
    }

    const rear = [0, 0.47, -0.82], front = [0, 0.47, 0.82], pedal = [0, 0.71, -0.05];
    const seat = [0, 1.43, -0.38], head = [0, 1.35, 0.51];
    [[rear, pedal], [pedal, seat], [seat, rear], [pedal, head], [head, seat], [head, front]]
      .forEach(([a, b]) => rod(a, b, 0.045, frame));
    rod([0, 1.35, 0.51], [0, 1.68, 0.57], 0.045, chrome);       // stem
    rod([-0.42, 1.68, 0.57], [0.42, 1.68, 0.57], 0.038, dark);  // handlebar
    rod([0, 1.43, -0.68], [0, 1.43, -0.14], 0.052, dark);       // saddle
    rod([-0.22, 0.71, -0.05], [0.22, 0.71, -0.05], 0.035, chrome); // pedals
  }

  // ---------------------------------------------------------------------------
  // Sur-Ron Light Bee X: a light electric dirt bike. What makes it look like
  // one: a raw aluminium frame wrapped around a tall black battery box, the
  // motor slung underneath with a chain on the left, gold upside-down forks,
  // a long flat seat, high white motocross fenders, a number plate with a
  // round headlight, knobby tyres and a red-spring shock.
  // ---------------------------------------------------------------------------
  function buildSurRon() {
    const plastic = shiny(MODELS['sur-ron'].color, 0, 0.42);
    const alu = shiny('#c4ccd0', 0.85, 0.32);
    const black = shiny('#1b1f22', 0.25, 0.55);
    const gold = shiny('#d9a83e', 1, 0.28);
    const rubber = mat('#1a1d1f', 0.95);
    const steel = shiny('#d5dadc', 1, 0.2);

    for (const z of [-0.82, 0.82]) {
      const wheel = addWheel(z);
      tyre(wheel, 0.45, 0.085, rubber);
      // Knobs on the tread, two staggered rows.
      for (let i = 0; i < 40; i++) {
        const a = (i / 40) * Math.PI * 2;
        const knob = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.045), rubber);
        knob.position.set(i % 2 ? 0.04 : -0.04, Math.sin(a) * 0.523, Math.cos(a) * 0.523);
        knob.rotation.x = Math.PI / 2 - a;
        wheel.add(knob);
      }
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.362, 0.02, 6, 32), black);
      rim.rotation.y = Math.PI / 2;
      wheel.add(rim);
      disc(0.045, 0.16, alu, 0, 0, 0, wheel); // hub
      for (let s = 0; s < 32; s++) {           // laced spokes, alternating sides of the hub
        const a = (s / 32) * Math.PI * 2;
        rod([s % 2 ? 0.06 : -0.06, Math.sin(a + 0.3) * 0.04, Math.cos(a + 0.3) * 0.04],
          [0, Math.sin(a) * 0.355, Math.cos(a) * 0.355], 0.005, steel, wheel);
      }
      disc(z > 0 ? 0.13 : 0.11, 0.008, steel, z > 0 ? -0.075 : 0.075, 0, 0, wheel); // brake rotor
      if (z < 0) disc(0.15, 0.012, black, -0.1, 0, 0, wheel);                     // rear sprocket
    }
    box(0.03, 0.09, 0.07, black, -0.08, 0.66, 0.72, bike); // front caliper
    box(0.03, 0.08, 0.06, black, 0.08, 0.66, -0.74, bike); // rear caliper

    // Upside-down forks: thin gold sliders at the bottom, fat black tubes up top.
    for (const s of [-1, 1]) {
      const axle = [s * 0.11, 0.56, 0.82], top = [s * 0.11, 1.52, 0.45];
      const mid = lerp3(axle, top, 0.45);
      rod(axle, mid, 0.026, gold);
      rod(mid, top, 0.043, black);
      disc(0.035, 0.05, black, s * 0.11, 0.56, 0.82); // axle clamp
    }
    box(0.32, 0.05, 0.12, alu, 0, 1.24, 0.56, bike); // lower triple clamp
    box(0.32, 0.05, 0.12, alu, 0, 1.5, 0.46, bike);  // top triple clamp
    rod([0, 1.2, 0.5], [0, 1.47, 0.42], 0.045, alu); // head tube

    // Tall motocross bars with a crossbar pad.
    rod([0, 1.52, 0.46], [0, 1.6, 0.44], 0.028, black);
    rod([-0.14, 1.61, 0.43], [0.14, 1.61, 0.43], 0.022, black);
    for (const s of [-1, 1]) {
      rod([s * 0.13, 1.61, 0.43], [s * 0.45, 1.67, 0.37], 0.022, black);
      rod([s * 0.3, 1.655, 0.385], [s * 0.45, 1.672, 0.368], 0.032, rubber); // grip
      rod([s * 0.2, 1.65, 0.42], [s * 0.37, 1.63, 0.48], 0.01, alu);         // lever
    }
    box(0.16, 0.05, 0.05, plastic, 0, 1.64, 0.43, bike); // bar pad

    // Number plate with the round headlight.
    const plate = box(0.26, 0.32, 0.03, black, 0, 1.34, 0.64, bike);
    plate.rotation.x = -0.38;
    const lamp = disc(0.065, 0.03, shiny('#f4fbff', 0.2, 0.1, { emissive: '#d9f2ff', emissiveIntensity: 0.6 }), 0, 0.02, 0.02, plate);
    lamp.rotation.set(Math.PI / 2, 0, 0);

    // High front fender: narrow between the fork legs, wide in front and behind.
    slab([0, 1.15, 0.22], [0, 1.19, 0.5], 0.2, 0.022, plastic);
    slab([0, 1.19, 0.5], [0, 1.2, 0.66], 0.12, 0.022, plastic);
    slab([0, 1.2, 0.66], [0, 1.17, 0.9], 0.2, 0.022, plastic);
    slab([0, 1.17, 0.9], [0, 1.08, 1.12], 0.19, 0.022, plastic);

    // Frame: two raw aluminium side plates looping round the battery.
    for (const s of [-1, 1]) {
      const x = s * 0.125;
      slab([s * 0.05, 1.42, 0.44], [x, 1.34, 0.12], 0.035, 0.09, alu);   // top spar
      slab([x, 1.34, 0.12], [x, 1.31, -0.1], 0.035, 0.09, alu);
      slab([s * 0.05, 1.22, 0.5], [x, 0.8, 0.2], 0.035, 0.1, alu);       // down spar
      slab([x, 0.8, 0.2], [x, 0.74, -0.14], 0.035, 0.09, alu);           // under the motor
      slab([x, 1.31, -0.1], [x, 0.74, -0.17], 0.035, 0.11, alu);         // rear upright
      rod([s * 0.1, 1.3, -0.1], [s * 0.08, 1.3, -0.72], 0.016, alu);     // subframe
      rod([s * 0.12, 0.95, -0.16], [s * 0.08, 1.28, -0.6], 0.014, alu);
    }
    const battery = box(0.22, 0.5, 0.3, black, 0, 1.05, 0.06, bike);
    battery.rotation.x = 0.22;
    for (const s of [-1, 1]) { // matte side covers on the battery
      const cover = box(0.012, 0.42, 0.26, shiny('#2a3136', 0.1, 0.7), s * 0.116, 1.05, 0.06, bike);
      cover.rotation.x = 0.22;
    }
    sideDecals('SUR-RON', 0.3, 0.07, '#f3f5f6', 0.124, 1.07, 0.06, 0.22);

    // Motor under the battery, chain on the left side.
    disc(0.11, 0.24, shiny('#30363a', 0.5, 0.45), 0, 0.68, 0.08);
    disc(0.08, 0.02, alu, -0.13, 0.68, 0.08);
    slab([-0.135, 0.68, 0.08], [-0.135, 0.79, -0.17], 0.02, 0.13, black); // primary belt cover
    disc(0.05, 0.015, black, -0.1, 0.8, -0.17);                           // countershaft sprocket
    rod([-0.1, 0.85, -0.17], [-0.1, 0.71, -0.82], 0.01, black);           // chain, top run
    rod([-0.1, 0.75, -0.17], [-0.1, 0.41, -0.82], 0.01, black);           // bottom run

    // Swingarm and the red-spring shock.
    for (const s of [-1, 1]) slab([s * 0.135, 0.79, -0.17], [s * 0.13, 0.56, -0.82], 0.035, 0.09, alu);
    rod([-0.15, 0.79, -0.17], [0.15, 0.79, -0.17], 0.025, alu); // pivot
    const shockA = new THREE.Vector3(0, 0.76, -0.24), shockB = new THREE.Vector3(0, 1.28, -0.12);
    rod(shockA.toArray(), shockB.toArray(), 0.022, black);
    const springDir = shockB.clone().sub(shockA).normalize();
    const springMat = shiny('#d8382f', 0.3, 0.35);
    for (let i = 0; i < 8; i++) {
      const coil = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.011, 6, 16), springMat);
      coil.position.lerpVectors(shockA, shockB, 0.25 + i * 0.075);
      coil.quaternion.setFromUnitVectors(Z_AXIS, springDir);
      bike.add(coil);
    }

    // Long flat seat, white side panels, high rear fender and tail light.
    slab([0, 1.4, 0.16], [0, 1.39, -0.66], 0.24, 0.1, black);
    for (const s of [-1, 1]) slab([s * 0.125, 1.27, -0.18], [s * 0.11, 1.3, -0.66], 0.02, 0.15, plastic);
    slab([0, 1.33, -0.6], [0, 1.42, -1.12], 0.2, 0.022, plastic);
    box(0.09, 0.04, 0.04, shiny('#ff3b30', 0, 0.3, { emissive: '#ff2a1f', emissiveIntensity: 0.5 }), 0, 1.36, -0.92, bike);

    // Serrated footpegs.
    for (const s of [-1, 1]) box(0.13, 0.03, 0.06, steel, s * 0.19, 0.72, -0.2, bike);
  }

  // ---------------------------------------------------------------------------
  // Kawasaki Ninja H2R: the track-only supercharged hyperbike. What makes it
  // look like one: mirror-chrome bodywork, a green steel trellis frame, a
  // pointed nose with no headlights, carbon winglets on the sides of the
  // fairing, the supercharger's air intake running down the left side, a
  // single-sided swingarm (left) so the right of the rear wheel is bare, a
  // short fat exhaust on the right, slick tyres, 5-split-spoke wheels with a
  // green pinstripe, and big front discs with gold calipers.
  // ---------------------------------------------------------------------------
  function buildNinja() {
    const green = shiny(MODELS.kawasaki.color, 0.3, 0.28);
    const mirror = shiny('#e6ecef', 1, 0.07);
    const mirrorFacets = shiny('#e6ecef', 1, 0.07, { flatShading: true });
    const carbon = shiny('#1b1f22', 0.45, 0.32);
    const black = shiny('#15181a', 0.5, 0.38);
    const engineMat = shiny('#3a4045', 0.6, 0.45);
    const alloy = shiny('#c8cfd3', 1, 0.22);
    const titanium = shiny('#b9ad97', 1, 0.25);
    const gold = shiny('#d9a83e', 1, 0.28);
    const rubber = mat('#1a1d1f', 0.7);

    for (const z of [-0.82, 0.82]) {
      const front = z > 0;
      const wheel = addWheel(z);
      tyre(wheel, 0.455, 0.08, rubber, front ? 1.5 : 1.85); // slicks, the rear one fatter
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.375, 0.375, 0.17, 36, 1, true),
        shiny('#15181a', 0.5, 0.38, { side: THREE.DoubleSide }));
      rim.rotation.z = Math.PI / 2;
      wheel.add(rim);
      for (const x of [-0.07, 0.07]) {                      // green pinstripes on the rim lips
        const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.372, 0.007, 4, 40), green);
        stripe.rotation.y = Math.PI / 2;
        stripe.position.x = x;
        wheel.add(stripe);
      }
      disc(0.075, 0.2, black, 0, 0, 0, wheel);              // hub
      for (let k = 0; k < 5; k++) {                         // five split spokes
        const a = (k / 5) * Math.PI * 2;
        for (const off of [-0.11, 0.11]) {
          rod([0, Math.sin(a) * 0.07, Math.cos(a) * 0.07],
            [0, Math.sin(a + off) * 0.37, Math.cos(a + off) * 0.37], 0.017, black, wheel);
        }
      }
      if (front) {
        for (const s of [-1, 1]) disc(0.2, 0.01, alloy, s * 0.11, 0, 0, wheel); // twin discs
      } else {
        disc(0.13, 0.01, alloy, 0.1, 0, 0, wheel);   // rear disc
        disc(0.13, 0.014, black, -0.17, 0, 0, wheel); // sprocket
      }
    }
    for (const s of [-1, 1]) box(0.05, 0.15, 0.07, gold, s * 0.12, 0.69, 0.67, bike); // front calipers
    box(0.04, 0.08, 0.06, gold, 0.1, 0.68, -0.72, bike);                             // rear caliper

    // Forks: gold sliders, black tubes, mostly hidden behind the fairing.
    for (const s of [-1, 1]) {
      const axle = [s * 0.15, 0.56, 0.82], top = [s * 0.13, 1.44, 0.5];
      const mid = lerp3(axle, top, 0.42);
      rod(axle, mid, 0.03, gold);
      rod(mid, top, 0.046, black);
    }
    // Low front fender hugging the tyre.
    const fenderGeo = new THREE.TorusGeometry(0.575, 0.04, 6, 14, 0.95);
    fenderGeo.rotateZ(1.4);
    const fender = new THREE.Mesh(fenderGeo, carbon);
    fender.rotation.y = Math.PI / 2;
    fender.scale.z = 2.7;
    fender.position.set(0, WHEEL_Y, 0.82);
    fender.castShadow = true;
    bike.add(fender);

    // Clip-on bars below the top clamp, and a little dash.
    box(0.34, 0.04, 0.12, alloy, 0, 1.45, 0.49, bike);
    for (const s of [-1, 1]) {
      rod([s * 0.13, 1.43, 0.49], [s * 0.25, 1.41, 0.45], 0.024, alloy);
      rod([s * 0.24, 1.41, 0.45], [s * 0.37, 1.4, 0.42], 0.032, black);
      rod([s * 0.21, 1.43, 0.5], [s * 0.35, 1.43, 0.53], 0.01, alloy);
    }
    box(0.16, 0.08, 0.1, black, 0, 1.52, 0.43, bike);

    // Engine: inline four, tilted forward, with the supercharger on the left.
    box(0.4, 0.3, 0.46, engineMat, 0, 0.8, 0.05, bike);
    const block = box(0.44, 0.3, 0.24, engineMat, 0, 1.04, 0.22, bike);
    block.rotation.x = 0.45;
    const cam = box(0.44, 0.07, 0.24, black, 0, 1.19, 0.3, bike);
    cam.rotation.x = 0.45;
    const radiator = box(0.4, 0.3, 0.05, black, 0, 1.06, 0.46, bike);
    radiator.rotation.x = -0.35;
    disc(0.1, 0.13, alloy, -0.27, 1.0, 0.0);                                      // supercharger
    taper([-0.08, 1.27, 0.94], [-0.2, 1.17, 0.6], 0.04, 0.05, black);             // ram-air duct, mostly
    taper([-0.2, 1.17, 0.6], [-0.24, 1.02, 0.06], 0.05, 0.06, black);             // behind the fairing
    for (const x of [-0.15, -0.05, 0.05, 0.15]) {                                 // exhaust headers
      rod([x, 1.1, 0.38], [x * 0.9, 0.72, 0.28], 0.022, titanium);
      rod([x * 0.9, 0.72, 0.28], [x * 0.4 + 0.05, 0.62, 0.0], 0.022, titanium);
    }
    rod([0.05, 0.62, 0.0], [0.2, 0.69, -0.22], 0.05, titanium);
    taper([0.2, 0.69, -0.22], [0.29, 0.95, -0.64], 0.06, 0.1, titanium);          // short fat can
    const tip = taper([0.29, 0.95, -0.64], [0.3, 0.97, -0.67], 0.1, 0.1, black);
    tip.material = black;

    // Green trellis frame, both sides.
    for (const s of [-1, 1]) {
      const H1 = [s * 0.1, 1.38, 0.47], H2 = [s * 0.1, 1.2, 0.5];
      const U1 = [s * 0.2, 1.33, 0.24], U2 = [s * 0.22, 1.27, -0.02], UP3 = [s * 0.2, 1.18, -0.2];
      const L1 = [s * 0.21, 1.06, 0.3], L2 = [s * 0.22, 0.98, 0.05], LP = [s * 0.2, 0.86, -0.18];
      [[H1, U1], [U1, U2], [U2, UP3], [H2, L1], [L1, L2], [L2, LP], [UP3, LP], [H1, H2],
        [H2, U1], [U1, L1], [L1, U2], [U2, L2], [L2, UP3]].forEach(([a, b]) => rod(a, b, 0.02, green));
    }

    // Mirror-chrome tank.
    blob(0.25, 0.17, 0.32, mirror, 0, 1.42, 0.1);

    // Pointed nose (no headlights on an H2R), with the air intake at the tip.
    const noseGeo = new THREE.ConeGeometry(1, 1, 6);
    noseGeo.rotateX(Math.PI / 2);
    const nose = new THREE.Mesh(noseGeo, mirrorFacets);
    nose.scale.set(0.29, 0.2, 0.56);
    nose.position.set(0, 1.36, 0.76);
    nose.rotation.x = 0.16;
    nose.castShadow = true;
    bike.add(nose);
    box(0.1, 0.08, 0.1, black, -0.07, 1.28, 0.93, bike);
    // Carbon winglets, two per side.
    for (const s of [-1, 1]) {
      for (const [y, z, len] of [[1.42, 0.62, 0.17], [1.31, 0.68, 0.19]]) {
        const wing = box(len, 0.014, 0.13, carbon, s * (0.19 + len / 2), y, z, bike);
        wing.rotation.set(0.1, 0, s * 0.12);
      }
    }
    // Smoked screen.
    const screen = box(0.3, 0.24, 0.012, new THREE.MeshStandardMaterial({
      color: '#2a363c', roughness: 0.05, metalness: 0.3, envMap, transparent: true, opacity: 0.6,
    }), 0, 1.6, 0.48, bike);
    screen.rotation.x = -1.0;
    // Side fairings with a green flash and the H2R lettering.
    for (const s of [-1, 1]) {
      slab([s * 0.25, 1.24, 0.7], [s * 0.27, 0.98, 0.16], 0.03, 0.36, mirror);
      slab([s * 0.265, 1.43, 0.66], [s * 0.285, 1.17, 0.12], 0.012, 0.035, green);
    }
    sideDecals('H2R', 0.24, 0.09, '#15181a', 0.288, 1.08, 0.42, 0.45);

    // Short seat, pointed tail with a green stripe and a tail light.
    box(0.28, 0.07, 0.34, mat('#202326', 0.8), 0, 1.36, -0.33, bike);
    const tailGeo = new THREE.ConeGeometry(1, 1, 6);
    tailGeo.rotateX(-Math.PI / 2);
    const tail = new THREE.Mesh(tailGeo, mirrorFacets);
    tail.scale.set(0.2, 0.13, 0.5);
    tail.position.set(0, 1.44, -0.72);
    tail.rotation.x = 0.22;
    tail.castShadow = true;
    bike.add(tail);
    for (const s of [-1, 1]) slab([s * 0.15, 1.42, -0.5], [s * 0.05, 1.5, -0.92], 0.012, 0.025, green);
    box(0.2, 0.08, 0.35, black, 0, 1.27, -0.6, bike);
    box(0.1, 0.03, 0.03, shiny('#ff3b30', 0, 0.3, { emissive: '#ff2a1f', emissiveIntensity: 0.5 }), 0, 1.47, -0.95, bike);

    // Single-sided swingarm on the left, chain inside it.
    slab([-0.21, 0.86, -0.2], [-0.21, 0.56, -0.82], 0.06, 0.14, black);
    disc(0.09, 0.08, black, -0.19, 0.56, -0.82);
    rod([-0.24, 0.86, -0.2], [0.2, 0.86, -0.2], 0.03, alloy); // pivot
    disc(0.05, 0.015, black, -0.17, 0.8, -0.05);
    rod([-0.17, 0.85, -0.05], [-0.17, 0.69, -0.82], 0.01, black);
    rod([-0.17, 0.75, -0.05], [-0.17, 0.43, -0.82], 0.01, black);

    // Rearsets: high footpegs with heel plates.
    for (const s of [-1, 1]) {
      rod([s * 0.14, 0.95, -0.36], [s * 0.26, 0.95, -0.36], 0.016, alloy);
      box(0.01, 0.13, 0.08, alloy, s * 0.17, 1.0, -0.41, bike);
    }
  }

  // ---------------------------------------------------------------------------
  // The rider: red jersey, white sleeves, dark trousers, knee pads, a
  // hydration pack, sunglasses and a gloss-black motocross helmet (full face,
  // long peak, pointed chin bar), in the same colours as the rider on the
  // lobby cartridge.
  // The torso and head sit in a `rider` group that pivots at the hips, so the
  // whole upper body can lean off the side for a hand drag. Arms and legs are
  // two-part limbs re-aimed every frame (see poseRider): hands stay on the bars
  // and feet on the pegs, and elbows and knees bend to fit.
  // ---------------------------------------------------------------------------
  function buildRider() {
    const jersey = mat('#e54b45', 0.8), sleeve = mat('#f3f0e7', 0.8), lime = mat('#d6f05b', 0.5);
    const pants = mat('#1d2a31', 0.85), pads = mat('#10171b', 0.55), skin = mat('#bd8b6c', 0.7);
    const gloveMat = mat('#151e23', 0.7), shoeMat = mat('#2a3237', 0.7);
    const helmetMat = shiny('#08090a', 0.3, 0.12, { side: THREE.DoubleSide }); // gloss black
    const peakMat = shiny('#08090a', 0.3, 0.2, { envMapIntensity: 0.35 });
    const linerMat = mat('#1c1f22', 0.95);
    linerMat.side = THREE.BackSide;
    const trimMat = mat('#2a2d30', 0.6); // matte black rubber and bolts
    const lensMat = shiny('#0d1418', 0.9, 0.08, { side: THREE.DoubleSide });

    rider = new THREE.Group();
    // Default 'XYZ' order bends sideways in the rider's own frame first,
    // then tips the whole body. (Rolling around the bike's axis instead
    // does almost nothing when the bike is standing near vertical.)
    rider.position.copy(HIP);
    bike.add(rider);

    blob(0.17, 0.12, 0.15, pants, 0, -0.04, -0.02, rider); // hips

    const torso = new THREE.Group();
    torso.rotation.x = Math.atan2(SHOULDER_R.z, SHOULDER_R.y); // lean toward the shoulders
    rider.add(torso);
    const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.2, 6, 14), jersey);
    chest.position.y = 0.25;
    chest.scale.set(1.3, 1, 0.82);
    chest.castShadow = true;
    torso.add(chest);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.153, 0.153, 0.05, 18, 1, true), lime);
    band.position.y = 0.2;
    band.scale.set(1.3, 1, 0.82);
    torso.add(band);
    box(0.22, 0.27, 0.08, mat('#2a3a44', 0.7), 0, 0.27, -0.14, torso); // hydration pack
    box(0.16, 0.025, 0.085, lime, 0, 0.35, -0.145, torso);

    const neck = rod([0, 0.4, 0.18], [0, 0.55, 0.24], 0.05, skin, rider);

    // Head with wraparound sunglasses.
    const head = new THREE.Group();
    head.position.set(0, 0.64, 0.25);
    rider.add(head);
    blob(0.115, 0.13, 0.12, skin, 0, 0, 0, head);
    box(0.03, 0.045, 0.04, skin, 0, -0.025, 0.12, head); // nose
    const glasses = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.045, 18, 1, true, -1.3, 2.6), lensMat);
    glasses.position.y = 0.015;
    head.add(glasses);

    // Motocross helmet, all gloss black: a full-face shell with a wide
    // eyeport, a long peak and a chin bar that juts out in a point.
    const R = 0.165, COLS = 64, ROWS = 40, OPEN = Math.PI * 0.86;
    const shellGeo = new THREE.SphereGeometry(R, COLS, ROWS, 0, Math.PI * 2, 0, OPEN);
    // Where a point on the plain dome moves to. The lower front is pulled out
    // and down into the chin bar, most at the centre, so it comes to a point.
    const sculpt = (v) => {
      const front = Math.max(0, Math.cos(Math.atan2(v.x, v.z))) ** 4;
      const polar = Math.acos(Math.min(1, v.y / R)) / Math.PI; // min(): rounding at the top pole would make acos NaN
      const low = THREE.MathUtils.smoothstep(polar, 0.55, 0.84) * front;
      return v.set(v.x * (1 - 0.12 * low), v.y - 0.03 * low, v.z + 0.1 * low);
    };
    {
      // Cut the eyeport out of the front, between the brow and the chin bar.
      // Whole grid cells go, so the edges are straight: rows 18-25 down from
      // the top, and 9 columns either side of straight ahead.
      const pos = shellGeo.attributes.position, idx = shellGeo.index.array, keep = [];
      const c = new THREE.Vector3(), v = new THREE.Vector3();
      for (let i = 0; i < idx.length; i += 3) {
        c.set(0, 0, 0);
        for (let k = 0; k < 3; k++) c.add(v.fromBufferAttribute(pos, idx[i + k]));
        const row = Math.floor(Math.acos(c.y / c.length()) / (OPEN / ROWS));
        const col = Math.floor(Math.abs(Math.atan2(c.x, c.z)) / (Math.PI * 2 / COLS)); // 0 = straight ahead
        if (!(row >= 18 && row <= 25 && col < 9)) keep.push(idx[i], idx[i + 1], idx[i + 2]);
      }
      shellGeo.setIndex(keep);
      for (let i = 0; i < pos.count; i++) pos.setXYZ(i, ...sculpt(v.fromBufferAttribute(pos, i)).toArray());
      // Fresh normals for the reshaped chin bar; everywhere else the sphere's
      // own normals are cleaner (the top pole would get a dark spot).
      const sphereNormals = shellGeo.attributes.normal.clone();
      shellGeo.computeVertexNormals();
      const norm = shellGeo.attributes.normal;
      for (let i = 0; i < pos.count; i++) {
        if (pos.getY(i) > -0.02) norm.setXYZ(i, sphereNormals.getX(i), sphereNormals.getY(i), sphereNormals.getZ(i));
      }
    }
    const shell = new THREE.Mesh(shellGeo, helmetMat);
    shell.position.set(0, 0.015, -0.01);
    shell.scale.set(1, 1.04, 1.15);
    shell.castShadow = true;
    head.add(shell);
    const liner = new THREE.Mesh(shellGeo, linerMat); // the padding you see through the eyeport
    liner.scale.setScalar(0.97);
    shell.add(liner);
    // Two vent slots on the front of the chin bar.
    for (const polar of [0.66, 0.74]) {
      const v = sculpt(new THREE.Vector3(0, Math.cos(polar * Math.PI) * R, Math.sin(polar * Math.PI) * R));
      const slot = box(0.05, 0.01, 0.012, trimMat, 0, 0, 0, shell);
      slot.position.copy(v);
      slot.rotation.x = polar * Math.PI - Math.PI / 2;
    }
    // The peak: long and flat, angled down over the eyeport, bolted on at each side.
    const peak = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.016, 30, 1, false, -0.55, 1.1), peakMat);
    peak.position.set(0, 0.105, -0.03);
    peak.rotation.x = 0.22;
    peak.castShadow = true;
    head.add(peak);
    for (const s of [-1, 1]) disc(0.014, 0.012, trimMat, s * 0.152, 0.075, 0.045, head); // peak bolts
    riderShell = [torso, neck, head];

    const gloveGeo = new THREE.BoxGeometry(0.075, 0.11, 0.09);
    gloveGeo.translate(0, 0.03, 0);
    const shoeGeo = new THREE.BoxGeometry(0.1, 0.08, 0.22);
    shoeGeo.translate(0, -0.01, 0.05);
    const makeGlove = () => new THREE.Mesh(gloveGeo, gloveMat);
    const makeShoe = () => new THREE.Mesh(shoeGeo, shoeMat);
    // Elbows bend out, down and back; knees bend forward and a little out.
    dragArm = makeLimb(0.44, 0.42, 0.058, 0.05, sleeve, sleeve, makeGlove(), [-1, -0.7, -0.6]); // left: reaches for the road
    gripArm = makeLimb(0.44, 0.42, 0.058, 0.05, sleeve, sleeve, makeGlove(), [1, -0.7, -0.6]);  // right: stays on the bar
    legs = [
      makeLimb(0.55, 0.55, 0.085, 0.065, pants, pads, makeShoe(), [-0.35, 0.25, 1]),
      makeLimb(0.55, 0.55, 0.085, 0.065, pants, pads, makeShoe(), [0.35, 0.25, 1]),
    ];
    for (const leg of legs) leg.joint.scale.setScalar(1.25); // knee pads
    glove = dragArm.end;
  }

  // A two-part arm or leg: upper and lower segments, a ball at the root
  // (shoulder or hip), a ball at the middle joint, and a hand or foot at the
  // end. `hint` is the way the middle joint bends, in the rider's own frame.
  function makeLimb(len1, len2, r1, r2, upperMat, lowerMat, end, hint) {
    const group = new THREE.Group();
    bike.add(group);
    const segment = (r, material) => {
      const geo = new THREE.CylinderGeometry(r * 0.88, r, 1, 12);
      geo.translate(0, 0.5, 0);
      const mesh = new THREE.Mesh(geo, material);
      mesh.castShadow = true;
      group.add(mesh);
      return mesh;
    };
    const upper = segment(r1, upperMat), lower = segment(r2, lowerMat);
    const root = new THREE.Mesh(new THREE.SphereGeometry(r1 * 1.1, 12, 8), upperMat);
    const joint = new THREE.Mesh(new THREE.SphereGeometry(r1 * 0.95, 12, 8), lowerMat);
    end.castShadow = true;
    group.add(root, joint, end);
    return { group, upper, lower, root, joint, end, len1, len2, hint: new THREE.Vector3(...hint), tip: new THREE.Vector3() };
  }

  // Two-bone IK: put the limb's root at `from` and its hand or foot at `to`,
  // and work out where the elbow or knee goes so both segments keep their
  // length. `q` turns the bend hint into the limb's space. `endQ` sets the
  // foot's angle; hands just follow the forearm.
  const ikDir = new THREE.Vector3(), ikBend = new THREE.Vector3(), ikMid = new THREE.Vector3();
  function solveLimb(limb, from, to, q, endQ = null) {
    ikDir.subVectors(to, from);
    const d = ikDir.length();
    ikDir.divideScalar(d || 1);
    const a = limb.len1, b = limb.len2;
    ikBend.copy(limb.hint).applyQuaternion(q);
    ikBend.addScaledVector(ikDir, -ikBend.dot(ikDir));
    if (ikBend.lengthSq() < 1e-8) ikBend.set(0, 0, 1);
    ikBend.normalize();
    let along, out = 0;
    if (d >= a + b) {
      along = (d * a) / (a + b); // out of reach: straight (and a little stretched)
    } else {
      const dc = Math.max(d, Math.abs(a - b) + 1e-3);
      along = (a * a - b * b + dc * dc) / (2 * dc);
      out = Math.sqrt(Math.max(0, a * a - along * along));
    }
    ikMid.copy(from).addScaledVector(ikDir, along).addScaledVector(ikBend, out);
    aimLimb(limb.upper, from, ikMid);
    aimLimb(limb.lower, ikMid, to);
    limb.root.position.copy(from);
    limb.joint.position.copy(ikMid);
    limb.end.position.copy(to);
    limb.end.quaternion.copy(endQ || limb.lower.quaternion);
    limb.tip.copy(to);
  }

  const UP = new THREE.Vector3(0, 1, 0);
  const NO_TURN = new THREE.Quaternion();
  const tmpDir = new THREE.Vector3();
  function aimLimb(mesh, from, to) {
    tmpDir.subVectors(to, from);
    const len = tmpDir.length();
    mesh.position.copy(from);
    mesh.quaternion.setFromUnitVectors(UP, tmpDir.divideScalar(len || 1));
    mesh.scale.set(1, len, 1);
  }

  buildBike();

  // ---------------------------------------------------------------------------
  // Game state
  // ---------------------------------------------------------------------------
  const LEAN_LIMIT = 1.48;       // radians (~85°); crossing this ends the ride
  const HAND_DRAG_ANGLE = 1.15;  // radians (~66°); past this the rider's hand touches the road
  const DRAG_POSE_START = 0.95;  // the rider starts leaning out a little before the hand lands
  const ROAD_HALF_WIDTH = 4.65;
  const keys = new Set();
  const touch = new Set();
  const pressed = (code) => keys.has(code) || touch.has(code);

  let speed = 0, lean = 0, distance = 0, lateral = 0, heading = 0, crashed = false;
  let dragging = false, dragDistance = 0;
  let leanRate = 0, lateralVel = 0; // how fast the wheelie and steering are moving, for the crash

  const speedEl = document.getElementById('speed');
  const distEl = document.getElementById('distance');
  const leanEl = document.getElementById('lean-readout');
  const fill = document.getElementById('meter-fill');
  const meter = document.getElementById('meter');
  const crashScreen = document.getElementById('crash-screen');
  const dragEl = document.getElementById('hand-drag');
  const dragCallout = document.getElementById('drag-callout');
  const crashDescription = document.getElementById('crash-description');
  document.querySelector('.meter-zone').style.left = (HAND_DRAG_ANGLE / LEAN_LIMIT) * 100 + '%';

  function reset() {
    if (crashed) restoreBike();
    speed = 0; lean = 0; distance = 0; lateral = 0; heading = 0; crashed = false;
    dragging = false; dragDistance = 0; leanRate = 0; lateralVel = 0; shake = 0;
    for (const spark of sparks) spark.visible = false;
    wheeliePivot.rotation.x = 0;
    bikeRig.rotation.z = 0;
    crashScreen.hidden = true;
    updateHud();
  }

  function updateHud() {
    speedEl.textContent = Math.round(speed * 3.6) + ' km/h';
    distEl.textContent = Math.floor(distance) + ' m';
    dragEl.textContent = Math.floor(dragDistance) + ' m';
    dragCallout.hidden = !dragging;
    leanEl.textContent = Math.round((lean * 180) / Math.PI) + '°';
    const pct = Math.min(100, (lean / LEAN_LIMIT) * 100);
    fill.style.width = pct + '%';
    fill.style.background = pct > 93 ? '#ff725f' : lean >= HAND_DRAG_ANGLE ? '#fb9e6d' : '#d6f05b';
    meter.setAttribute('aria-valuenow', String(Math.round(pct)));
  }

  function tick(dt) {
    if (crashed) { crashTick(dt); updateHud(); return; }
    const m = MODELS[selected];
    const leanBefore = lean, lateralBefore = lateral;

    // Throttle, coasting, brake, drag
    if (pressed('ArrowUp')) speed = Math.min(m.max, speed + 14 * dt);
    else speed = Math.max(0, speed - 3.1 * dt);
    if (pressed('ArrowDown')) speed = Math.max(0, speed - 22 * dt);
    if (pressed('KeyE')) speed = Math.max(0, speed - 5.5 * dt);

    // Steering
    const steer = (pressed('ArrowRight') ? 1 : 0) - (pressed('ArrowLeft') ? 1 : 0);
    lateral = THREE.MathUtils.clamp(
      lateral + steer * m.turn * (0.4 + speed / m.max) * dt * 2.5,
      -ROAD_HALF_WIDTH, ROAD_HALF_WIDTH,
    );
    heading = THREE.MathUtils.damp(heading, -steer * 0.15, 6, dt);
    lateralVel = (lateral - lateralBefore) / dt;

    // Wheelie. Once the hand is on the road it works like a kickstand: the
    // front keeps rising, but much more slowly, so you can hold the drag.
    const brace = dragging ? 0.35 : 1;
    if (pressed('Space') && speed > 1.5) lean += m.raise * (0.48 + speed / m.max) * brace * dt;
    else lean = Math.max(0, lean - 1.15 * dt);
    dragging = lean >= HAND_DRAG_ANGLE && speed > 1;
    if (dragging) {
      speed = Math.max(0, speed - 1.2 * dt); // a glove on asphalt is a small brake
      dragDistance += speed * dt;
    }
    leanRate = (lean - leanBefore) / dt;
    if (lean >= LEAN_LIMIT) {
      // Looped out: hand the bike and rider over to the crash physics.
      lean = LEAN_LIMIT;
      wheeliePivot.rotation.x = lean;
      startCrash(m);
      updateHud();
      return;
    }

    distance += speed * dt;

    // Pose the rig
    bikeRig.position.set(lateral, 0, 3);
    bikeRig.rotation.y = heading;
    bikeRig.rotation.z = THREE.MathUtils.damp(bikeRig.rotation.z, steer * -0.075, 5, dt);
    wheeliePivot.rotation.x = lean;
    wheels.forEach((w) => { w.rotation.x -= (speed * dt) / 0.44; });
    poseRider(dt);

    // Scroll the world toward the camera and recycle what passes behind
    for (const mark of markings) {
      mark.position.z += speed * dt;
      if (mark.position.z > 16) mark.position.z -= 210;
    }
    for (const prop of props) {
      prop.position.z += speed * dt;
      if (prop.position.z > 17) prop.position.z -= 185;
    }

    updateHud();
  }

  // ---------------------------------------------------------------------------
  // Hand drag: rider pose and sparks
  // ---------------------------------------------------------------------------
  const sparkMat = new THREE.MeshBasicMaterial({ color: '#ffc46b' });
  const sparkGeo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
  const sparks = [];
  for (let i = 0; i < 48; i++) {
    const spark = new THREE.Mesh(sparkGeo, sparkMat);
    spark.visible = false;
    spark.userData = { vel: new THREE.Vector3(), life: 0 };
    scene.add(spark);
    sparks.push(spark);
  }
  let nextSpark = 0;

  const shoulderL = new THREE.Vector3(), shoulderR = new THREE.Vector3();
  const hipL = new THREE.Vector3(), hipR = new THREE.Vector3();
  const reach = new THREE.Vector3(), ground = new THREE.Vector3(), outward = new THREE.Vector3();

  function poseRider(dt) {
    // 0 = riding normally, 1 = fully leaned out for the hand drag
    const k = THREE.MathUtils.smoothstep(lean, DRAG_POSE_START, HAND_DRAG_ANGLE);
    rider.position.copy(HIP).addScaledVector(DRAG_SHIFT, k);
    rider.rotation.set(fit.pitch * (1 - k) + Math.max(0, lean - DRAG_BACK) * k, 0, DRAG_ROLL * k);
    rider.updateMatrix();
    bikeRig.updateMatrixWorld(true);

    shoulderL.copy(SHOULDER_L).applyMatrix4(rider.matrix);
    shoulderR.copy(SHOULDER_R).applyMatrix4(rider.matrix);
    hipL.copy(HIP_L).applyMatrix4(rider.matrix);
    hipR.copy(HIP_R).applyMatrix4(rider.matrix);
    solveLimb(gripArm, shoulderR, GRIP_R, rider.quaternion);
    solveLimb(legs[0], hipL, PEDAL_L, rider.quaternion, NO_TURN);
    solveLimb(legs[1], hipR, PEDAL_R, rider.quaternion, NO_TURN);

    // Where the glove meets the road: just outside and behind the left shoulder.
    bike.localToWorld(ground.copy(shoulderL));
    outward.set(-1, 0, 0).transformDirection(bike.matrixWorld).setY(0).normalize();
    ground.addScaledVector(outward, 0.28);
    ground.z += 0.12;
    ground.y = 0.085; // glove radius, so it rests on the road
    bike.worldToLocal(ground);

    if (dragging) {
      reach.copy(ground);
    } else {
      // Reach from the bar toward the road, but no longer than the arm.
      reach.lerpVectors(GRIP_L, ground, k).sub(shoulderL);
      if (reach.length() > ARM_REACH) reach.setLength(ARM_REACH);
      reach.add(shoulderL);
    }
    solveLimb(dragArm, shoulderL, reach, rider.quaternion);

    // Sparks fly off the glove and back down the road.
    if (dragging && speed > 2) {
      const origin = bike.localToWorld(reach.clone());
      for (let n = 0; n < 2; n++) {
        emitSpark(origin, (Math.random() - 0.5) * 2, 1 + Math.random() * 2.2, speed * 0.25 + Math.random() * 3);
      }
    }
    updateSparks(dt, speed * dt);
  }

  function emitSpark(origin, vx, vy, vz) {
    const spark = sparks[nextSpark];
    nextSpark = (nextSpark + 1) % sparks.length;
    spark.position.copy(origin);
    spark.userData.vel.set(vx, vy, vz);
    spark.userData.life = 0.25 + Math.random() * 0.25;
    spark.visible = true;
  }

  // `scroll` is how far the road moved toward the camera this step.
  function updateSparks(dt, scroll) {
    for (const spark of sparks) {
      if (!spark.visible) continue;
      const d = spark.userData;
      d.life -= dt;
      if (d.life <= 0) { spark.visible = false; continue; }
      d.vel.y -= 9.8 * dt;
      spark.position.addScaledVector(d.vel, dt);
      spark.position.z += scroll;
      if (spark.position.y < 0.02) { spark.position.y = 0.02; d.vel.y *= -0.3; }
      spark.scale.setScalar(Math.min(1, d.life * 4));
    }
  }

  // ---------------------------------------------------------------------------
  // Crash physics
  // ---------------------------------------------------------------------------
  // When the wheelie loops out, the bike and the rider each become a rigid
  // body. They keep the speed and spin they had at the moment of the crash,
  // gravity and air drag pull on them, and every contact point that touches
  // the ground gets an impulse: one straight up so it can't sink in (with a
  // little bounce), and one against the sliding direction (friction). Each
  // body has its own mass and its own resistance to spinning (inertia), so a
  // heavy bike and a light rider tumble differently.
  const GRAVITY = 9.8;
  const SUBSTEPS = 5;        // physics steps per game step, so fast hits don't tunnel
  const ITERATIONS = 6;      // passes over the contacts per step
  const BOUNCE = 0.22;       // how much of a hard hit bounces back
  const ROAD_EDGE = 5.5;     // past this the bodies are on the grass
  const GRASS_DROP = -0.06;  // the grass sits a little lower than the road
  const GRASS_GRIP = 1.25;   // grass grabs harder than asphalt
  const CRASH_CARD_DELAY = 7; // seconds before the card shows even if things are still sliding

  // Where the weight sits, in each part's own space.
  const BIKE_COM = new THREE.Vector3(0, 0.95, 0);
  const RIDER_COM = new THREE.Vector3(0, 0.3, 0.1); // relative to the hips

  function makeBody(drag) {
    const obj = new THREE.Group();
    scene.add(obj);
    return {
      obj, drag, points: [], asleep: false,
      invMass: 0, invI: new THREE.Vector3(),
      vel: new THREE.Vector3(), angVel: new THREE.Vector3(),
    };
  }
  // drag: air resistance. A tumbling rider tops out around 55 m/s in free fall.
  const bikeBody = makeBody(0.0015);
  const riderBody = makeBody(0.003);

  // Mass plus a box-shaped inertia (w, h, d in the body's own axes).
  function setMass(b, mass, w, h, d) {
    b.invMass = 1 / mass;
    b.invI.set(12 / (mass * (h * h + d * d)), 12 / (mass * (w * w + d * d)), 12 / (mass * (w * w + h * h)));
  }

  // Contact points are little spheres: p (relative to the centre of mass), radius r,
  // grip mu, and whether scraping that point throws sparks.
  function point(x, y, z, r, mu, spark = false, origin = BIKE_COM) {
    return { p: new THREE.Vector3(x, y, z).sub(origin), r, mu, spark,
      rw: new THREE.Vector3(), accN: 0, accT: new THREE.Vector3(), target: 0, kN: 1, touching: false };
  }

  function bikePoints() {
    const pts = [];
    // Tyres roll, so they barely grip in this simple model.
    for (const z of [-0.82, 0.82]) {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        pts.push(point(0, 0.56 + Math.sin(a) * 0.44, z + Math.cos(a) * 0.44, 0.095, 0.12));
      }
    }
    // Metal and plastic scrape: more grip, and sparks.
    for (const [x, y, z, r] of fit.scrape) pts.push(point(x, y, z, r, 0.5, true));
    return pts;
  }

  function riderPoints() {
    const p = (x, y, z, r) => point(x, y, z, r, 0.7, false, RIDER_COM); // riding gear on asphalt
    return [
      p(0, 0.68, 0.24, 0.2),                                       // helmet
      p(0, 0.55, 0.15, 0.23), p(0, 0.05, 0.05, 0.22),              // chest, hips
      p(-0.66, 0.57, 0.44, 0.08), p(0.66, 0.57, 0.44, 0.08),       // hands
      p(-0.32, -0.72, 0.22, 0.1), p(0.32, -0.72, 0.22, 0.1),       // feet
    ];
  }

  const qInv = new THREE.Quaternion(), tq = new THREE.Quaternion();
  const tA = new THREE.Vector3(), tB = new THREE.Vector3(), vp = new THREE.Vector3();
  const tDir = new THREE.Vector3(), newT = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);

  // Inverse inertia in world space: turn into the body's frame, scale, turn back.
  function applyInvI(b, v) {
    qInv.copy(b.obj.quaternion).invert();
    return v.applyQuaternion(qInv).multiply(b.invI).applyQuaternion(b.obj.quaternion);
  }
  function pointVelocity(b, r, out) {
    return out.crossVectors(b.angVel, r).add(b.vel);
  }
  function applyImpulse(b, r, j) {
    b.vel.addScaledVector(j, b.invMass);
    b.angVel.add(applyInvI(b, tA.crossVectors(r, j)));
  }
  // How hard it is to change the speed of point r along dir (mass + spin together).
  function effectiveInverseMass(b, r, dir) {
    applyInvI(b, tA.crossVectors(r, dir));
    return b.invMass + tB.crossVectors(tA, r).dot(dir);
  }

  function stepBody(b, h) {
    if (b.asleep) return;
    const pos = b.obj.position, q = b.obj.quaternion;
    b.vel.y -= GRAVITY * h;
    b.vel.multiplyScalar(Math.max(0, 1 - b.drag * b.vel.length() * h));
    b.angVel.multiplyScalar(Math.exp(-0.35 * h));

    // Find contacts
    let deepest = 0, touching = 0;
    for (const c of b.points) {
      c.rw.copy(c.p).applyQuaternion(q);
      const onGrass = Math.abs(pos.x + c.rw.x) > ROAD_EDGE;
      const depth = (onGrass ? GRASS_DROP : 0) + c.r - (pos.y + c.rw.y);
      c.touching = depth > 0;
      if (!c.touching) continue;
      touching++;
      deepest = Math.max(deepest, depth);
      c.grip = c.mu * (onGrass ? GRASS_GRIP : 1);
      c.accN = 0;
      c.accT.set(0, 0, 0);
      c.kN = effectiveInverseMass(b, c.rw, up);
      const vn = pointVelocity(b, c.rw, vp).y;
      c.target = vn < -1.5 ? -BOUNCE * vn : 0;
      if (vn < -3) shake = Math.max(shake, Math.min(1, -vn / 10));
      // Scraping metal throws sparks.
      if (c.spark && Math.hypot(vp.x, vp.z) > 3 && Math.random() < 0.12) {
        emitSpark(tB.copy(pos).add(c.rw), vp.x * 0.5 + (Math.random() - 0.5) * 2, 1 + Math.random() * 2, vp.z * 0.5);
      }
    }

    // Solve them: push up, then rub against the slide
    for (let it = 0; it < ITERATIONS && touching; it++) {
      for (const c of b.points) {
        if (!c.touching) continue;
        const vn = pointVelocity(b, c.rw, vp).y;
        const acc = Math.max(0, c.accN + (c.target - vn) / c.kN);
        tDir.set(0, acc - c.accN, 0);
        c.accN = acc;
        applyImpulse(b, c.rw, tDir);

        pointVelocity(b, c.rw, vp).setY(0);
        const slide = vp.length();
        if (slide < 1e-5) continue;
        tDir.copy(vp).divideScalar(slide);
        newT.copy(c.accT).addScaledVector(tDir, -slide / effectiveInverseMass(b, c.rw, tDir));
        const maxT = c.grip * c.accN;
        if (newT.length() > maxT) newT.setLength(maxT);
        tDir.subVectors(newT, c.accT);
        c.accT.copy(newT);
        applyImpulse(b, c.rw, tDir);
      }
    }

    // Move and spin
    pos.addScaledVector(b.vel, h);
    const w = b.angVel;
    tq.set(w.x * h * 0.5, w.y * h * 0.5, w.z * h * 0.5, 0).multiply(q);
    q.set(q.x + tq.x, q.y + tq.y, q.z + tq.z, q.w + tq.w).normalize();
    pos.y += deepest * 0.6; // nudge out of the ground

    // Fall asleep once it's lying still, so it doesn't jitter forever
    if (touching && b.vel.length() < 0.12 && b.angVel.length() < 0.25) {
      b.vel.set(0, 0, 0);
      b.angVel.set(0, 0, 0);
      b.asleep = true;
    }
  }

  let crashT = 0, crashSlide = 0, settledT = 0, wheelSpin = 0, shake = 0, spread = 0;
  const focus = new THREE.Vector3(), toBike = new THREE.Vector3();
  const CAMERA_SPREAD = 12; // metres: the camera keeps the bike in shot up to this far from the rider
  const limbStarts = [];

  function startCrash(m) {
    crashed = true;
    dragging = false;
    crashT = 0; crashSlide = 0; settledT = 0;
    wheelSpin = speed / 0.44;
    contactShadows.forEach((s) => { s.visible = false; });
    bikeRig.updateMatrixWorld(true);

    // How the bike was moving when it let go: forward speed, any steering
    // drift, and the wheelie spin around the rear axle.
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(bikeRig.quaternion);
    const linear = forward.clone().multiplyScalar(speed);
    linear.x += lateralVel;
    const pivot = wheeliePivot.getWorldPosition(new THREE.Vector3());
    const spin = new THREE.Vector3(1, 0, 0)
      .applyQuaternion(wheeliePivot.getWorldQuaternion(tq))
      .multiplyScalar(Math.max(leanRate, 1.1));
    // A random twist and roll, so no two crashes look the same.
    spin.y += (Math.random() - 0.5) * 0.9;
    spin.addScaledVector(forward, (Math.random() - 0.5) * 1.4);
    const velocityAt = (p) => tA.subVectors(p, pivot).cross(spin).negate().add(linear);

    // Where each limb ends right now, in the rider's frame, so the flail blends in.
    const toRider = rider.matrix.clone().invert();
    limbStarts.length = 0;
    for (const limb of [dragArm, gripArm, legs[0], legs[1]]) limbStarts.push(limb.tip.clone().applyMatrix4(toRider));

    // The rider lets go: one rigid body at the hips, thrown up and back off the seat.
    setMass(riderBody, 75, 0.5, 1.6, 0.4);
    riderBody.points = riderPoints();
    riderBody.asleep = false;
    rider.localToWorld(riderBody.obj.position.copy(RIDER_COM));
    rider.getWorldQuaternion(riderBody.obj.quaternion);
    riderBody.obj.updateMatrixWorld(true);
    riderBody.vel.copy(velocityAt(riderBody.obj.position))
      .addScaledVector(forward, -1.2)
      .add(tB.set((Math.random() - 0.5) * 1.6, 1.4, 0));
    riderBody.angVel.copy(spin).multiplyScalar(0.6)
      .add(tB.set((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 4));
    riderBody.obj.attach(rider);
    rider.updateMatrix();
    // The limbs are posed in their parent's space every step, so they just move over.
    for (const limb of [dragArm, gripArm, ...legs]) riderBody.obj.add(limb.group);
    poseCrashedRider();

    // The bike becomes its own body, centred on its centre of mass.
    setMass(bikeBody, m.mass, 0.6, 1.6, 2.3);
    bikeBody.points = bikePoints();
    bikeBody.asleep = false;
    bike.localToWorld(bikeBody.obj.position.copy(BIKE_COM));
    bike.getWorldQuaternion(bikeBody.obj.quaternion);
    bikeBody.obj.updateMatrixWorld(true);
    bikeBody.vel.copy(velocityAt(bikeBody.obj.position));
    bikeBody.angVel.copy(spin);
    bikeBody.obj.attach(bike);
  }

  // Put the bike and rider back together on the rig.
  function restoreBike() {
    wheeliePivot.add(bike);
    bike.position.set(0, -WHEEL_Y, -AXLE_OFFSET);
    bike.rotation.set(0, Math.PI, 0);
    bike.add(rider);
    for (const limb of [dragArm, gripArm, ...legs]) bike.add(limb.group);
    contactShadows.forEach((s) => { s.visible = true; });
  }

  // Arms and legs fling out while the rider tumbles, and go limp as it slows.
  const jointA = new THREE.Vector3(), jointB = new THREE.Vector3();
  const FLAIL = [
    // joint (rider frame), where the hand or foot flings to, phase
    [SHOULDER_L, new THREE.Vector3(-0.5, 0.15, 0.25), 0],
    [SHOULDER_R, new THREE.Vector3(0.5, 0.15, 0.25), 2],
    [HIP_L, new THREE.Vector3(-0.2, -0.75, 0.25), 4],
    [HIP_R, new THREE.Vector3(0.2, -0.75, 0.25), 1],
  ];
  function poseCrashedRider() {
    const flail = THREE.MathUtils.clamp(riderBody.angVel.length() / 5 + riderBody.vel.length() / 12, 0, 1);
    const blend = Math.min(1, crashT * 4);
    const limbs = [dragArm, gripArm, legs[0], legs[1]];
    FLAIL.forEach(([joint, offset, phase], i) => {
      jointB.copy(joint).add(offset);
      jointB.y += 0.25 * flail * Math.sin(crashT * 11 + phase);
      jointB.z += 0.25 * flail * Math.cos(crashT * 9 + phase);
      jointB.lerpVectors(limbStarts[i], jointB, blend).applyMatrix4(rider.matrix);
      jointA.copy(joint).applyMatrix4(rider.matrix);
      solveLimb(limbs[i], jointA, jointB, rider.quaternion, i > 1 ? rider.quaternion : null);
    });
  }

  function crashTick(dt) {
    crashT += dt;
    const h = dt / SUBSTEPS;
    for (let s = 0; s < SUBSTEPS; s++) {
      stepBody(bikeBody, h);
      stepBody(riderBody, h);
    }
    wheelSpin *= Math.exp(-0.6 * dt);
    wheels.forEach((w) => { w.rotation.x -= wheelSpin * dt; });
    poseCrashedRider();
    shake = Math.max(0, shake - dt * 2.5);

    // Keep the rider in front of the camera by sliding the world instead.
    const scroll = 3 - riderBody.obj.position.z;
    bikeBody.obj.position.z += scroll;
    riderBody.obj.position.z += scroll;
    // Frame the rider and the bike together, unless the bike has slid far away.
    toBike.subVectors(bikeBody.obj.position, riderBody.obj.position);
    spread = Math.min(toBike.length(), CAMERA_SPREAD);
    focus.copy(riderBody.obj.position).addScaledVector(toBike.setLength(spread), 0.5);
    for (const mark of markings) {
      mark.position.z += scroll;
      if (mark.position.z > 16) mark.position.z -= 210;
    }
    for (const prop of props) {
      prop.position.z += scroll;
      if (prop.position.z > 17) prop.position.z -= 185;
    }
    updateSparks(dt, scroll);
    crashSlide += Math.max(0, scroll);
    speed = Math.max(0, scroll / dt);

    // Show the card once everything has stopped (or after a while).
    const still = (b) => b.asleep || (b.vel.length() < 0.3 && b.angVel.length() < 0.6);
    settledT = still(bikeBody) && still(riderBody) ? settledT + dt : 0;
    if (crashScreen.hidden && (settledT > 0.6 || crashT > CRASH_CARD_DELAY)) {
      const slid = `You slid ${Math.round(crashSlide)} m.`;
      crashDescription.textContent = dragDistance >= 1
        ? `You looped it. Hand drag this run: ${Math.floor(dragDistance)} m. ${slid} Ease off Space sooner to stay in the orange zone.`
        : `You crossed the lean limit. ${slid} Keep the front wheel lower on your next run.`;
      crashScreen.hidden = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Render loop (fixed 50 Hz simulation step)
  // ---------------------------------------------------------------------------
  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------------------------------------------------------------------------
  // Camera views, like the go-kart game: 3rd person, 1st person, side cam
  // ---------------------------------------------------------------------------
  // third: behind the bike and a little to the right, looking down the road.
  // first: from inside the rider's helmet. Your head follows about half of the
  //        wheelie (you keep your eyes on the road) and tilts during a hand drag.
  //        Drag on the game to look around; let go and it eases back.
  // side:  the original camera, off to the side, best for judging the angle.
  // In a crash, 1st person cuts to the 3rd-person crash camera: a helmet cam
  // tumbling down the road would be too much.
  const VIEWS = ['third', 'first', 'side'];
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private window */ } },
  };
  const EYE = new THREE.Vector3(0, 0.655, 0.34); // at the eyes, under the helmet peak, in the rider group's space
  const HEAD_FOLLOW = 0.5;   // how much of the wheelie angle your head follows in 1st person
  const HEAD_DOWN = -0.35;   // radians: looking down at the bars and the road
  const PORTRAIT_DOWN = -0.12; // a bit more on tall phone screens, so the bars clear the lean meter
  // In a hand drag your head tilts and turns toward the side the hand is on.
  // Turning also moves the raised front wheel out of the middle of the view.
  // (The glove itself ends up almost straight below your eyes, so it stays out of shot.)
  const DRAG_HEAD_TILT = 0.2;  // radians of tilt toward that side
  const DRAG_HEAD_TURN = 0.35; // radians of turn toward that side
  let view = 'third';
  let lookYaw = 0, lookPitch = 0, looking = null;

  function setView(v) {
    if (!VIEWS.includes(v)) return;
    view = v;
    lookYaw = 0; lookPitch = 0; looking = null;
    store.set('wheelie.view', v);
    document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === v)));
  }

  const gloveAt = new THREE.Vector3();
  function helmetCam() {
    bikeRig.updateMatrixWorld(true);
    rider.localToWorld(camera.position.copy(EYE));
    const k = THREE.MathUtils.smoothstep(lean, DRAG_POSE_START, HAND_DRAG_ANGLE);
    // Tilt toward whichever side the hand is reaching.
    const side = glove.getWorldPosition(gloveAt).x > bikeRig.position.x ? 1 : -1;
    camera.rotation.set(
      HEAD_DOWN + (fit.eyeDown || 0) + (camera.aspect < 1 ? PORTRAIT_DOWN : 0) + lean * HEAD_FOLLOW + lookPitch,
      bikeRig.rotation.y - DRAG_HEAD_TURN * k * side + lookYaw,
      bikeRig.rotation.z - DRAG_HEAD_TILT * k * side,
      'YXZ',
    );
  }

  const canvas = renderer.domElement;
  canvas.addEventListener('pointerdown', (e) => {
    if (view !== 'first' || crashed) return;
    looking = { x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!looking) return;
    lookYaw = THREE.MathUtils.clamp(lookYaw - (e.clientX - looking.x) * 0.005, -1.6, 1.6);
    lookPitch = THREE.MathUtils.clamp(lookPitch - (e.clientY - looking.y) * 0.005, -0.9, 0.9);
    looking = { x: e.clientX, y: e.clientY };
  });
  const stopLooking = () => { looking = null; };
  canvas.addEventListener('pointerup', stopLooking);
  canvas.addEventListener('pointercancel', stopLooking);

  const STEP = 0.02;
  const cameraTarget = new THREE.Vector3();
  const look = new THREE.Vector3(0, 1.05, -4.5), lookGoal = new THREE.Vector3(), jolt = new THREE.Vector3();
  let previous = performance.now();
  let acc = 0;
  function animate(now) {
    const frameDt = Math.min((now - previous) / 1000, 0.1);
    acc = Math.min(acc + frameDt, 0.12);
    previous = now;
    while (acc >= STEP) { tick(STEP); acc -= STEP; }

    const firstPerson = view === 'first' && !crashed;
    riderShell.forEach((part) => { part.visible = !firstPerson; });
    if (!looking) {
      lookYaw = THREE.MathUtils.damp(lookYaw, 0, 2.5, frameDt);
      lookPitch = THREE.MathUtils.damp(lookPitch, 0, 2.5, frameDt);
    }

    let fov = 52;
    if (firstPerson) {
      helmetCam();
      fov = 75 + Math.min(speed, 40) * 0.3; // a touch wider at speed, like the go-kart
    } else {
      if (crashed && view === 'side') {
        // Follow the crash, pulling back as the bike and rider slide apart.
        camera.position.lerp(cameraTarget.set(focus.x + 4.6 + spread * 0.2, 3.1 + spread * 0.3, focus.z + 9.5 + spread * 0.75), 0.05);
        look.lerp(lookGoal.set(focus.x, 0.6, focus.z - 1.5), 0.1);
      } else if (crashed) {
        // 3rd person (and 1st person, which cuts out here): from behind, same pull-back.
        camera.position.lerp(cameraTarget.set(focus.x + 1.8 + spread * 0.15, 2.8 + spread * 0.35, focus.z + 7.5 + spread * 0.8), 0.05);
        look.lerp(lookGoal.set(focus.x, 0.6, focus.z - 1.5), 0.1);
      } else if (view === 'side') {
        camera.position.lerp(cameraTarget.set(lateral * 0.35 + 5.7, 3.65, 11.8), 0.045);
        look.set(lateral * 0.55, 1.05, -4.5);
      } else {
        camera.position.lerp(cameraTarget.set(lateral + 1.5, 2.55, 9.4), 0.08);
        look.set(lateral * 0.9, 1.25, -5);
        fov = 56 + Math.min(speed, 40) * 0.3;
      }
      camera.lookAt(look);
    }
    if (Math.abs(camera.fov - fov) > 0.05) {
      camera.fov += (fov - camera.fov) * Math.min(1, 4 * frameDt);
      camera.updateProjectionMatrix();
    }
    // Hard hits shake the camera for a moment.
    jolt.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(shake * 0.3);
    camera.position.add(jolt);
    renderer.render(scene, camera);
    camera.position.sub(jolt);
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------
  const CONTROL_KEYS = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyE'];
  window.addEventListener('keydown', (e) => {
    if (CONTROL_KEYS.includes(e.code)) { e.preventDefault(); keys.add(e.code); }
    if (e.code === 'KeyC' && !e.repeat) setView(VIEWS[(VIEWS.indexOf(view) + 1) % VIEWS.length]);
  });
  window.addEventListener('keyup', (e) => {
    if (CONTROL_KEYS.includes(e.code)) { e.preventDefault(); keys.delete(e.code); }
  });
  window.addEventListener('blur', () => { keys.clear(); touch.clear(); });

  document.querySelectorAll('[data-bike]').forEach((btn) => btn.addEventListener('click', () => {
    reset(); // first, so a crashed bike is put back together before it's rebuilt
    selected = btn.dataset.bike;
    buildBike();
    poseRider(0);
    document.querySelectorAll('[data-bike]').forEach((b) => {
      const active = b === btn;
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', String(active));
    });
  }));

  document.getElementById('restart').addEventListener('click', reset);
  document.querySelectorAll('[data-view]').forEach((btn) => btn.addEventListener('click', () => setView(btn.dataset.view)));
  // ?view=first (or third, side) picks a camera, then whatever you used last time.
  setView([new URLSearchParams(location.search).get('view'), store.get('wheelie.view')].find((v) => VIEWS.includes(v)) || 'third');

  document.querySelectorAll('[data-control]').forEach((btn) => {
    const key = btn.dataset.control;
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      btn.setPointerCapture(e.pointerId);
      touch.add(key);
    });
    const release = () => touch.delete(key);
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('lostpointercapture', release);
  });

  poseRider(0);
  updateHud();
})();
