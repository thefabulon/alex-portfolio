// Wheelie Ride v2: ride the real roads of south Orange County.
//
// Loaded as a classic script after three.min.js, drivetrain.js, oc-map.js and
// world.js. The bikes, the rider and the crash physics are the same as v1;
// what's new is the open world (world.js), real gears (drivetrain.js), and
// free riding: you steer anywhere instead of sliding left and right on one
// straight road.
(async () => {
  // ---------------------------------------------------------------------------
  // Renderer, scene, camera and the world
  // ---------------------------------------------------------------------------
  const host = document.getElementById('scene');
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.25, 12000);
  camera.rotation.order = 'YXZ';

  const params = new URLSearchParams(location.search);
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private window */ } },
  };

  const loading = document.getElementById('loading');
  const loadText = document.getElementById('load-text');
  const loadFill = document.getElementById('load-fill');
  let world;
  try {
    world = await window.createOCWorld(scene, renderer, (label, frac) => {
      loadText.textContent = label + '…';
      loadFill.style.width = Math.round(frac * 100) + '%';
    });
  } catch (err) {
    loadText.textContent = 'The map did not load: ' + err.message;
    loading.classList.add('failed');
    throw err;
  }
  const startTime = [params.get('time'), store.get('wheelie2.time')].find((t) => t && world.times[t]) || 'day';
  world.setTime(startTime);

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
  // Vehicles
  // ---------------------------------------------------------------------------
  // turn: steering response, raise: how fast the front lifts, mass: kg (for
  // the crash), brakes: m/s² of stopping with both wheels down.
  // Top speed (max) comes from the drivetrain: see drivetrain.js.
  const MODELS = {
    street:   { color: '#d6f05b', turn: 1.25, raise: 0.82, mass: 95, brakes: 6.0 },
    trail:    { color: '#fb9e6d', turn: 1.55, raise: 0.7,  mass: 90, brakes: 6.5 },
    sprint:   { color: '#75d8e1', turn: 1.05, raise: 0.95, mass: 85, brakes: 6.0 },
    'sur-ron':{ color: '#e8edf0', turn: 1.18, raise: 0.9,  mass: 65, brakes: 8.0 },
    kawasaki: { color: '#39e75f', turn: 0.92, raise: 1.08, mass: 210, brakes: 10.0 },
  };
  for (const id of Object.keys(MODELS)) MODELS[id].max = new window.WR_DRIVETRAIN.Drivetrain(id).topSpeed();

  const bikeRig = new THREE.Group();
  bikeRig.rotation.order = 'YXZ'; // turn (yaw), then hill pitch, then lean into corners
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

  let selected = MODELS[store.get('wheelie2.bike')] ? store.get('wheelie2.bike') : 'sur-ron';
  let wheels = [];
  // Rider parts that move during a hand drag (rebuilt with each bike).
  // Each arm and leg is a two-part "limb" (see makeLimb) with an elbow or knee.
  let rider, dragArm, gripArm, legs = [], glove;
  // The torso and head, hidden in 1st person so the camera isn't inside your own head.
  let riderShell = [];
  let fit; // how the rider sits on the current bike (see FITS)

  const Y_AXIS = new THREE.Vector3(0, 1, 0);
  const Z_AXIS = new THREE.Vector3(0, 0, 1);

  // Reflections for the shiny parts (the H2R's mirror paint, chrome, brake
  // discs) come from the world's sky, so they turn orange at sunset.
  let envMap = world.envMap;
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
  const TYRE_GRIP = 7.5;         // m/s² of sideways grip: how hard you can turn at speed
  const keys = new Set();
  const touch = new Set();
  const pressed = (code) => keys.has(code) || touch.has(code);
  const { Drivetrain } = window.WR_DRIVETRAIN;
  let drive = new Drivetrain(selected);
  const sound = window.WR_SOUND.createSound();
  sound.setEnabled(store.get('wheelie2.sound') !== '0');

  // Where you are: x and z on the map, y height, yaw the way you face
  // (0 = north, turning left makes it bigger).
  const player = { x: 0, y: 0, z: 0, yaw: 0, speed: 0 };
  let speed = 0, lean = 0, distance = 0, crashed = false;
  let pitch = 0, roll = 0, yawRate = 0, steerSmooth = 0;
  let dragging = false, dragDistance = 0, bestDrag = Number(store.get('wheelie2.bestDrag')) || 0;
  let leanRate = 0, lateralVel = 0; // how fast the wheelie and steering are moving, for the crash
  let crashReason = 'loop', crashPush = null;
  let lastSafe = null, safeT = 0;
  let surface = { grip: 1, drag: 0 };
  let here = null; // the road you're on (or nearest), refreshed a few times a second
  const SPAWNS = world.spawns;
  let spawn = SPAWNS.find((s) => s.name === store.get('wheelie2.spawn')) || SPAWNS[0];
  {
    const want = params.get('spawn');
    if (want) spawn = SPAWNS.find((s) => s.name.toLowerCase().includes(want.toLowerCase())) || spawn;
  }

  const $ = (id) => document.getElementById(id);
  const crashScreen = $('crash-screen');
  const crashTitle = $('crash-title');
  const crashDescription = $('crash-description');
  const dragCallout = $('drag-callout');

  function placeAt(x, z, yaw) {
    player.x = x; player.z = z; player.yaw = yaw;
    player.y = world.surfaceAt(x, z).y;
    pitch = 0; roll = 0; yawRate = 0;
    bikeRig.position.set(x, player.y, z);
    bikeRig.rotation.set(0, yaw, 0);
    camYaw = yaw;
    snapCamera = true;
  }

  function reset(where = lastSafe || spawn) {
    if (crashed) restoreBike();
    speed = 0; lean = 0; crashed = false;
    dragging = false; dragDistance = 0; leanRate = 0; lateralVel = 0; shake = 0;
    vy = 0; airborne = false; airTime = 0; landing = null;
    crashPush = null;
    drive.reset();
    for (const spark of sparks) spark.visible = false;
    wheeliePivot.rotation.x = 0;
    crashScreen.hidden = true;
    placeAt(where.x, where.z, where.heading ?? where.yaw ?? 0);
    lastSafe = { x: where.x, z: where.z, yaw: where.heading ?? where.yaw ?? 0 };
  }

  // A road heading (the direction of travel on that road) for a spot.
  function roadHeading(x, z, preferYaw = null) {
    const hit = world.nearestRoad(x, z, 300);
    if (!hit) return null;
    let yaw = Math.atan2(-hit.dirX, -hit.dirZ);
    if (preferYaw !== null && !hit.road.oneway) {
      const flip = Math.atan2(hit.dirX, hit.dirZ);
      if (Math.cos(flip - preferYaw) > Math.cos(yaw - preferYaw)) yaw = flip;
    } else if (!hit.road.oneway && preferYaw === null) {
      yaw = Math.atan2(-hit.dirX, -hit.dirZ);
    }
    // keep to the right-hand side of a two-way road
    const off = hit.road.oneway ? 0 : Math.min(2.4, hit.road.hw * 0.45);
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    return { x: hit.x - fz * off, z: hit.z + fx * off, heading: yaw, road: hit.road };
  }

  function startCrashFor(reason, push = null) {
    focus.set(player.x, player.y, player.z); // the crash camera starts where the bike is
    spread = 0;
    crashReason = reason;
    // keep falling (or rising) as fast as you were
    const p = push ? push.clone() : new THREE.Vector3();
    if (airborne) p.y += vy;
    airborne = false;
    crashPush = p;
    sound.thump(Math.min(1, 0.4 + speed / 30));
    startCrash(MODELS[selected], p);
  }

  // ---------------------------------------------------------------------------
  // Air. Every step the game asks: would gravity alone keep the bike on the
  // ground? If the ground falls away faster than that (over a crest at speed,
  // off a ridge, off the bluff above a beach), the bike flies. Riding up a
  // slope gives it upward speed, so the top of a ramp launches you. The
  // suspension soaks up the first few centimetres, so small bumps don't make
  // it hop. In the air, Space pulls the nose up and the brake pushes it down
  // (like throttle and back brake on a real bike), and steering barely works.
  // Land on the back wheel and you carry on in a wheelie; land too hard or
  // nose first and you crash.
  // ---------------------------------------------------------------------------
  const G = 9.81;
  const SUSPENSION = 0.04;      // metres per step the suspension soaks up before the wheels leave the ground
  const TOO_STEEP = 0.85;       // slope (rise / run) where the back wheel can't climb any more
  const NOSE_DOWN_LIMIT = -0.45; // radians: land nose-down further than this and you go over the bars
  const HARD_LANDING = { pedal: 8, electric: 11, gas: 12.5 }; // m/s into the ground you can ride away from
  let vy = 0, airborne = false, airTime = 0, airPitch = 0, airPeak = 0, airFrom = { x: 0, z: 0 };
  let bestAir = Number(store.get('wheelie2.bestAir')) || 0;
  let landing = null; // what happened at the last landing, for the HUD

  function takeOff() {
    airborne = true;
    airTime = 0;
    airPeak = 0;
    airPitch = pitch;
    airFrom = { x: player.x, z: player.z };
    dragging = false;
  }

  // Touch down. `slope` is the ground's rise / run along the way you're going.
  function touchDown(gy, slope) {
    airborne = false;
    player.y = gy;
    const groundPitch = Math.atan(slope);
    // How fast you hit the ground, straight into it.
    const impact = Math.max(0, (speed * slope - vy) * Math.cos(groundPitch));
    const nose = airPitch + lean - groundPitch; // nose-up, measured from the ground
    const flight = { time: airTime, dist: Math.hypot(player.x - airFrom.x, player.z - airFrom.z), high: airPeak, impact };
    vy = speed * slope;
    pitch = groundPitch;
    if (airTime > 0.35) {
      bestAir = Math.max(bestAir, airTime);
      store.set('wheelie2.bestAir', bestAir.toFixed(2));
    }
    if (surface.water) { startCrashFor('water'); return; }
    if (impact > HARD_LANDING[drive.spec.kind]) { startCrashFor('landing', new THREE.Vector3(0, -impact * 0.4, 0)); return; }
    if (nose < NOSE_DOWN_LIMIT) { startCrashFor('nose'); return; }
    if (nose >= LEAN_LIMIT) { lean = LEAN_LIMIT; startCrashFor('loop'); return; }
    lean = Math.max(0, nose);
    speed *= 1 - Math.min(0.25, impact * 0.02); // a hard landing scrubs off speed
    sound.thump(impact / 8);
    shake = Math.max(shake, Math.min(0.8, impact / 14));
    landing = { ...flight, wheelie: lean > 0.25, at: performance.now() };
  }

  function tick(dt) {
    if (crashed) { drive.update(dt, 0, 0, 1); crashTick(dt); return; } // engine winds down while you tumble
    const m = MODELS[selected];
    const leanBefore = lean;
    const throttle = pressed('ArrowUp') || pressed('KeyW') ? 1 : 0;
    const brake = pressed('ArrowDown') || pressed('KeyS') ? 1 : 0;
    const steer = (pressed('ArrowRight') || pressed('KeyD') ? 1 : 0) - (pressed('ArrowLeft') || pressed('KeyA') ? 1 : 0);

    if (!airborne) surface = world.surfaceAt(player.x, player.z);
    const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
    // Slope of whatever you're riding on (a road's smooth surface, or the ground).
    const slopeAt = (x, z, ax, az) => (world.surfaceAt(x + ax * 0.9, z + az * 0.9).y - world.surfaceAt(x - ax * 0.9, z - az * 0.9).y) / 1.8;
    const slope = slopeAt(player.x, player.z, fx, fz);

    // Speed. On the ground: engine (or legs), brakes, air and rolling drag,
    // rough ground, and gravity on hills. With the front wheel up only the
    // rear brake works, so braking in a wheelie is weak (and drops the
    // front). In the air: only air drag; the engine just revs.
    const push = drive.update(dt, speed, airborne ? 0 : throttle, brake);
    if (airborne) {
      const air = drive.drag(speed) - drive.spec.crr * G;
      speed = Math.max(0, speed - air * dt);
    } else {
      const gravity = -G * Math.sin(Math.atan(slope));
      const brakes = brake ? (lean > 0.08 ? 3.2 : m.brakes) : 0;
      const resist = speed > 0.05 ? drive.drag(speed) + surface.drag * Math.min(1, speed) + (pressed('KeyE') ? 5.5 : 0) : 0;
      const spin = slope > TOO_STEEP ? Math.min(1, (slope - TOO_STEEP) * 4) : 0; // too steep: the back wheel just spins
      speed = Math.max(0, speed + (push * (1 - spin) + gravity - resist - brakes) * dt);
    }

    // Steering: tight at walking pace, wide at speed (tyres only grip so much).
    steerSmooth += (steer - steerSmooth) * Math.min(1, dt * 7);
    const yawCap = Math.min(m.turn * 1.25, TYRE_GRIP / Math.max(speed, 0.5)) * (lean > 0.3 ? 0.55 : 1);
    yawRate = -steerSmooth * yawCap * Math.min(1, speed / 1.5) * (airborne ? 0.15 : 1);
    player.yaw += yawRate * dt;
    lateralVel = speed * yawRate;

    // Move, then check what we ran into.
    const nfx = -Math.sin(player.yaw), nfz = -Math.cos(player.yaw);
    let nx = player.x + nfx * speed * dt, nz = player.z + nfz * speed * dt;
    const b = world.bounds;
    nx = Math.max(b.x0, Math.min(b.x1, nx));
    nz = Math.max(b.z0, Math.min(b.z1, nz));
    const frontX = nx + nfx * 0.95, frontZ = nz + nfz * 0.95;
    const wall = world.hitBuilding(frontX, frontZ, 0.3, player.y + 0.4) || (player.y < world.heightAt(frontX, frontZ) + 4 && world.hitTree(frontX, frontZ, 0.25));
    if (wall) {
      if (speed > 7 || airborne) {
        player.x = nx; player.z = nz;
        startCrashFor(wall.kind, new THREE.Vector3(wall.nx, 0, wall.nz).multiplyScalar(speed * 0.5));
        return;
      }
      // A slow bump: stop and back off the wall.
      speed = 0;
      nx = player.x + wall.nx * 0.05;
      nz = player.z + wall.nz * 0.05;
    }
    const car = world.hitCar(frontX, frontZ, player.y + 0.6, 0.3) || world.hitCar(nx, nz, player.y + 0.6, 0.4);
    if (car && (airborne || speed + Math.hypot(car.vx, car.vz) > 2.5)) {
      player.x = nx; player.z = nz;
      startCrashFor('car', new THREE.Vector3(car.vx * 0.8, 2.5, car.vz * 0.8));
      return;
    } else if (car) {
      speed = 0;
    }
    player.x = nx; player.z = nz;
    surface = world.surfaceAt(nx, nz);
    const gy = surface.y;
    const slopeHere = slopeAt(nx, nz, nfx, nfz);

    // Up and down.
    const fallY = player.y + vy * dt - 0.5 * G * dt * dt; // where gravity alone would put you
    if (airborne) {
      vy -= G * dt;
      player.y = fallY;
      airTime += dt;
      airPeak = Math.max(airPeak, player.y - gy);
      // Nose up with Space, down with the brake; otherwise it slowly follows the arc.
      const arc = Math.atan2(vy, Math.max(speed, 1));
      const control = (pressed('Space') ? 1 : 0) - brake;
      airPitch += (control * 1.9 + (arc - airPitch) * 0.6) * dt;
      if (player.y <= gy) {
        touchDown(gy, slopeHere);
        if (crashed) return;
      }
    } else if (fallY > gy + SUSPENSION && speed > 2) {
      takeOff();
      vy -= G * dt;
      player.y = fallY;
    } else {
      // Riding along the surface: you rise and fall with its slope. A step
      // (like a curb) just moves you up or down; it doesn't throw you.
      vy = speed * slopeHere;
      player.y = gy;
    }
    if (!airborne && surface.water && speed > 0.5) { startCrashFor('water'); return; }
    if (!airborne) pitch += (Math.atan(slopeHere) - pitch) * Math.min(1, dt * 10);
    const rollGoal = THREE.MathUtils.clamp(Math.atan((speed * yawRate) / G), -0.8, 0.8) * (airborne ? 0.4 : 1);
    roll += (rollGoal - roll) * Math.min(1, dt * 6);

    // Wheelie (on the ground only). How fast the front lifts depends on how
    // hard the drivetrain can push right now: low gears and big torque lift
    // it easily. Once the hand is on the road it works like a kickstand.
    if (!airborne) {
      const pull = drive.pullNow(speed);
      const torque = THREE.MathUtils.clamp(pull / 4, 0.4, 1.7);
      const brace = dragging ? 0.35 : 1;
      if (pressed('Space') && speed > 1.2) lean += m.raise * (0.45 + 0.55 * torque) * brace * dt;
      else lean = Math.max(0, lean - (brake ? 2.2 : 1.15) * dt);
      dragging = lean >= HAND_DRAG_ANGLE && speed > 1;
      if (dragging) {
        speed = Math.max(0, speed - 1.2 * dt); // a glove on asphalt is a small brake
        dragDistance += speed * dt;
        if (dragDistance > bestDrag) bestDrag = dragDistance;
      }
      leanRate = (lean - leanBefore) / dt;
      if (lean >= LEAN_LIMIT) {
        lean = LEAN_LIMIT;
        wheeliePivot.rotation.x = lean;
        startCrashFor('loop');
        return;
      }
    } else {
      leanRate = 0;
    }
    distance += speed * dt;

    // Remember the last good spot on a road, for "Ride again".
    safeT -= dt;
    if (safeT <= 0 && !airborne && surface.road && speed > 2 && lean < 0.3) {
      safeT = 1;
      lastSafe = { x: player.x, z: player.z, yaw: player.yaw };
    }

    // Pose the rig.
    bikeRig.position.set(player.x, player.y, player.z);
    bikeRig.rotation.set(airborne ? airPitch : pitch, player.yaw, roll);
    contactShadows.forEach((sh) => { sh.visible = !airborne; }); // the soft ovals under the tyres stay on the ground
    wheeliePivot.rotation.x = lean;
    wheels.forEach((w) => { w.rotation.x -= ((airborne && throttle ? speed + 20 : speed) * dt) / 0.44; });
    poseRider(dt);
    player.speed = speed;
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
    ground.y = world.heightAt(ground.x, ground.z) + 0.15; // glove radius, so it rests on the road
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
        // they leave the glove going forward with the bike, then fall behind
        const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
        emitSpark(origin, fx * speed * 0.35 + (Math.random() - 0.5) * 2, 1 + Math.random() * 2.2, fz * speed * 0.35 + (Math.random() - 0.5) * 2);
      }
    }
    updateSparks(dt);
  }

  function emitSpark(origin, vx, vy, vz) {
    const spark = sparks[nextSpark];
    nextSpark = (nextSpark + 1) % sparks.length;
    spark.position.copy(origin);
    spark.userData.vel.set(vx, vy, vz);
    spark.userData.life = 0.25 + Math.random() * 0.25;
    spark.visible = true;
  }

  function updateSparks(dt) {
    for (const spark of sparks) {
      if (!spark.visible) continue;
      const d = spark.userData;
      d.life -= dt;
      if (d.life <= 0) { spark.visible = false; continue; }
      d.vel.y -= 9.8 * dt;
      spark.position.addScaledVector(d.vel, dt);
      const floor = world.heightAt(spark.position.x, spark.position.z) + 0.09;
      if (spark.position.y < floor) { spark.position.y = floor; d.vel.y *= -0.3; d.vel.x *= 0.7; d.vel.z *= 0.7; }
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

    // Walls: shove the body back out of any building it slid into.
    const wall = world.hitBuilding(pos.x, pos.z, 0.4, pos.y);
    if (wall) {
      pos.x += wall.nx * wall.depth;
      pos.z += wall.nz * wall.depth;
      const into = b.vel.x * wall.nx + b.vel.z * wall.nz;
      if (into < 0) { b.vel.x -= 1.4 * into * wall.nx; b.vel.z -= 1.4 * into * wall.nz; b.vel.multiplyScalar(0.6); }
    }
    // The ground under the body: road, dirt, sand or water, and how grippy it is.
    const ground = world.surfaceAt(pos.x, pos.z);

    // Find contacts
    let deepest = 0, touching = 0;
    for (const c of b.points) {
      c.rw.copy(c.p).applyQuaternion(q);
      const gy = ground.road || ground.walk ? ground.y : world.heightAt(pos.x + c.rw.x, pos.z + c.rw.z);
      const depth = Math.max(gy, ground.water ? -0.45 : gy) + c.r - (pos.y + c.rw.y);
      c.touching = depth > 0;
      if (!c.touching) continue;
      touching++;
      deepest = Math.max(deepest, depth);
      c.grip = c.mu * ground.grip;
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

  function startCrash(m, push = null) {
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
    if (push) linear.add(push);
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

    // Frame the rider and the bike together, unless the bike has slid far away.
    toBike.subVectors(bikeBody.obj.position, riderBody.obj.position);
    spread = Math.min(toBike.length(), CAMERA_SPREAD);
    focus.copy(riderBody.obj.position).addScaledVector(toBike.setLength(spread), 0.5);
    updateSparks(dt);
    const slide = Math.hypot(riderBody.vel.x, riderBody.vel.z);
    crashSlide += slide * dt;
    speed = slide;

    // Show the card once everything has stopped (or after a while).
    const still = (b) => b.asleep || (b.vel.length() < 0.3 && b.angVel.length() < 0.6);
    settledT = still(bikeBody) && still(riderBody) ? settledT + dt : 0;
    if (crashScreen.hidden && (settledT > 0.6 || crashT > CRASH_CARD_DELAY)) {
      const slid = `You slid ${Math.round(crashSlide)} m.`;
      const drag = dragDistance >= 1 ? ` Hand drag this run: ${Math.floor(dragDistance)} m.` : '';
      const where = here ? ` on ${here.road.label}` : '';
      const text = {
        loop: ['Too far back!', `You looped it${where}.${drag} ${slid} Ease off Space sooner to stay in the orange zone.`],
        car: ['Hit by traffic!', `You ran into a car${where}. ${slid} Watch the lanes, and slow down near other cars.`],
        building: ['Into the wall!', `You rode into a building. ${slid} Stick to the street.`],
        tree: ['Tree!', `You hit a tree. ${slid} Palm trunks don't move.`],
        water: ['Splash!', 'You rode into the Pacific. Your bike does not float.'],
        landing: ['Cased it!', `You landed too hard after ${airTime.toFixed(1)} s in the air. ${slid} Land on a downslope, or come in slower.`],
        nose: ['Over the bars!', `You landed nose first. ${slid} In the air, hold Space to bring the nose up before you land.`],
      }[crashReason] || ['Crash!', slid];
      crashTitle.textContent = text[0];
      crashDescription.textContent = text[1];
      store.set('wheelie2.bestDrag', String(Math.floor(bestDrag)));
      crashScreen.hidden = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Cameras: chase (3rd person), 1st person, side cam
  // ---------------------------------------------------------------------------
  // chase: low behind the bike, swinging round after it in corners.
  // first: from inside the rider's helmet. Your head follows about half of the
  //        wheelie and tilts during a hand drag. Drag on the game to look around.
  // side:  off to the right, best for judging the wheelie angle.
  // In a crash, 1st person cuts to the chase camera.
  const VIEWS = ['third', 'first', 'side'];
  const EYE = new THREE.Vector3(0, 0.655, 0.34);
  const HEAD_FOLLOW = 0.5, HEAD_DOWN = -0.22, PORTRAIT_DOWN = -0.1;
  const DRAG_HEAD_TILT = 0.2, DRAG_HEAD_TURN = 0.35;
  let view = 'third';
  let lookYaw = 0, lookPitch = 0, looking = null;
  let camYaw = 0, snapCamera = true;

  function setView(v) {
    if (!VIEWS.includes(v)) return;
    view = v;
    lookYaw = 0; lookPitch = 0; looking = null;
    store.set('wheelie2.view', v);
    document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === v)));
  }

  const gloveAt = new THREE.Vector3(), rigRight = new THREE.Vector3();
  function helmetCam() {
    bikeRig.updateMatrixWorld(true);
    rider.localToWorld(camera.position.copy(EYE));
    const k = THREE.MathUtils.smoothstep(lean, DRAG_POSE_START, HAND_DRAG_ANGLE);
    rigRight.set(1, 0, 0).applyQuaternion(bikeRig.quaternion);
    const side = glove.getWorldPosition(gloveAt).sub(bikeRig.position).dot(rigRight) > 0 ? 1 : -1;
    camera.rotation.set(
      HEAD_DOWN + (fit.eyeDown || 0) + (camera.aspect < 1 ? PORTRAIT_DOWN : 0) + lean * HEAD_FOLLOW + pitch + lookPitch,
      player.yaw - DRAG_HEAD_TURN * k * side + lookYaw,
      roll * 0.6 - DRAG_HEAD_TILT * k * side,
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

  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  resize();

  const camGoal = new THREE.Vector3(), look = new THREE.Vector3(), jolt = new THREE.Vector3();
  const angleDamp = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
  function updateCamera(frameDt) {
    if (window.__wheelie && window.__wheelie.freeCam) return; // debugging: something else is moving the camera
    const firstPerson = view === 'first' && !crashed;
    riderShell.forEach((part) => { part.visible = !firstPerson; });
    if (!looking) {
      lookYaw = THREE.MathUtils.damp(lookYaw, 0, 2.5, frameDt);
      lookPitch = THREE.MathUtils.damp(lookPitch, 0, 2.5, frameDt);
    }
    let fov = 58;
    if (firstPerson) {
      helmetCam();
      fov = 74 + Math.min(speed, 50) * 0.25;
    } else {
      let cx = player.x, cy = player.y, cz = player.z;
      if (crashed) { cx = focus.x; cy = focus.y; cz = focus.z; }
      else camYaw = angleDamp(camYaw, player.yaw, Math.min(1, frameDt * 3.2));
      const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw), rx = -fz, rz = fx;
      if (view === 'side' && !crashed) {
        camGoal.set(cx + rx * 6.2 - fx * 1.6, cy + 1.7, cz + rz * 6.2 - fz * 1.6);
        look.set(cx + fx * 0.6, cy + 1.0, cz + fz * 0.6);
      } else {
        const pull = crashed ? 7 + spread * 0.8 : 5.6 + Math.min(speed, 60) * 0.035;
        const up = crashed ? 2.6 + spread * 0.35 : 1.95 + Math.min(speed, 60) * 0.01;
        camGoal.set(cx - fx * pull + rx * (crashed ? 1.5 : 0.35), cy + up, cz - fz * pull + rz * (crashed ? 1.5 : 0.35));
        look.set(cx + fx * 4, cy + (crashed ? 0.6 : 1.15), cz + fz * 4);
        fov = 58 + Math.min(speed, 70) * 0.22;
      }
      // never under the hill behind you
      camGoal.y = Math.max(camGoal.y, world.heightAt(camGoal.x, camGoal.z) + 0.9);
      if (snapCamera) camera.position.copy(camGoal);
      else camera.position.lerp(camGoal, 1 - Math.exp(-frameDt * (crashed ? 3 : 9)));
      camera.lookAt(look);
    }
    snapCamera = false;
    if (Math.abs(camera.fov - fov) > 0.05) {
      camera.fov += (fov - camera.fov) * Math.min(1, 4 * frameDt);
      camera.updateProjectionMatrix();
    }
  }

  // ---------------------------------------------------------------------------
  // HUD: rev bar, dash, minimap, where you are
  // ---------------------------------------------------------------------------
  const REV_SEGS = 32;
  const revSegs = $('rev-segs');
  for (let i = 0; i < REV_SEGS; i++) revSegs.appendChild(document.createElement('i'));
  const revCells = [...revSegs.children];
  const ARC_SEGS = 26;
  const arc = $('dash-arc');
  const arcCells = [];
  for (let i = 0; i < ARC_SEGS; i++) {
    // segments on an arc across the top of the dash, left to right
    const a0 = Math.PI * (0.84 - (i / ARC_SEGS) * 0.68), a1 = Math.PI * (0.84 - ((i + 0.8) / ARC_SEGS) * 0.68);
    const R1 = 112, R0 = 100 - (i / ARC_SEGS) * 9, cx = 110, cy = 120;
    const pt = (r, a) => `${(cx + Math.cos(a) * r).toFixed(1)},${(cy - Math.sin(a) * r).toFixed(1)}`;
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    p.setAttribute('points', [pt(R0, a0), pt(R1, a0), pt(R1, a1), pt(R0, a1)].join(' '));
    arc.appendChild(p);
    arcCells.push(p);
  }
  const hud = {
    revSpeed: $('rev-speed'), revLabel: $('rev-label'), revScale: $('rev-scale'),
    speed: $('speed'), kmh: $('speed-kmh'), gear: $('gear'), gearSub: $('gear-sub'), gearOf: $('gear-of'),
    rpm: $('rpm-read'), extra: $('dash-extra'), odo: $('odo'), shift: $('shift-light'), dash: $('dash'),
    road: $('road-name'), city: $('city-name'), limit: $('limit'), limitNum: $('limit-num'),
    lean: $('lean-readout'), fill: $('meter-fill'), meter: $('meter'), drag: $('hand-drag'), best: $('best-drag'),
    toast: $('toast'), north: $('north'), mini: $('minimap'), drive: $('drive-label'),
    airCallout: $('air-callout'), airTime: $('air-time'), airLast: $('air-last'), bestAir: $('best-air'),
  };
  document.querySelector('.meter-zone').style.left = (HAND_DRAG_ANGLE / LEAN_LIMIT) * 100 + '%';
  const miniCtx = hud.mini.getContext('2d');
  let miniT = 0, whereT = 0, lastCity = '', toastT = 0;
  const landmarkSeen = new Map();
  function toast(text, sub = '') {
    hud.toast.innerHTML = '';
    const b = document.createElement('b');
    b.textContent = text;
    hud.toast.appendChild(b);
    if (sub) {
      const s = document.createElement('span');
      s.textContent = sub;
      hud.toast.appendChild(s);
    }
    hud.toast.hidden = false;
    toastT = 4;
  }
  let lastScale = '';
  function updateHud(frameDt) {
    const r = drive.readout();
    const mph = speed * 2.23694;
    hud.revSpeed.textContent = Math.round(mph);
    hud.speed.textContent = Math.round(mph);
    hud.kmh.textContent = Math.round(speed * 3.6) + ' km/h';
    hud.gear.textContent = r.gear;
    hud.gearSub.textContent = r.gearSub;
    hud.gearOf.textContent = r.gearOf > 1 ? `of ${r.gearOf}` : '';
    hud.rpm.textContent = `${Math.round(r.rpm).toLocaleString()} ${r.rpmLabel === 'CADENCE' ? 'rpm cadence' : 'rpm'}`;
    if (r.battery !== undefined) hud.extra.textContent = `${Math.max(0, r.kw).toFixed(1)} kW · ${Math.round(r.battery * 100)}%`;
    else hud.extra.textContent = drive.spec.kind === 'gas' ? (drive.auto ? 'AUTO' : 'MANUAL') : r.rpm > 1 ? 'pedaling' : 'coasting';
    hud.odo.textContent = (distance / 1609.34).toFixed(1) + ' mi';
    hud.revLabel.textContent = r.rpmLabel;
    const scaleText = r.rpmLabel === 'RPM ×1000' ? '0 · 3 · 6 · 9 · 12 · 15' : r.rpmLabel === 'CADENCE' ? '0 · 50 · 100 · 150' : '0 · 2k · 4k · 6k';
    if (scaleText !== lastScale) { hud.revScale.textContent = scaleText; lastScale = scaleText; }
    const lit = (r.rpm / r.rpmMax);
    const shade = (v) => (v >= r.red ? 'r' : v >= r.green[0] ? 'g' : 'w');
    revCells.forEach((c, i) => {
      const v = ((i + 0.5) / REV_SEGS) * r.rpmMax;
      c.className = (i + 0.5) / REV_SEGS <= lit ? 'on ' + shade(v) : shade(v);
    });
    arcCells.forEach((c, i) => {
      const v = ((i + 0.5) / ARC_SEGS) * r.rpmMax;
      c.setAttribute('class', (i + 0.5) / ARC_SEGS <= lit ? 'on ' + shade(v) : shade(v));
    });
    hud.shift.classList.toggle('flash', r.shiftNow || (drive.spec.kind === 'gas' && r.rpm > r.red - 200));
    // wheelie meter
    hud.lean.textContent = Math.round((lean * 180) / Math.PI) + '°';
    const pct = Math.min(100, (lean / LEAN_LIMIT) * 100);
    hud.fill.style.width = pct + '%';
    hud.fill.style.background = pct > 93 ? '#ff725f' : lean >= HAND_DRAG_ANGLE ? '#fb9e6d' : '#d6f05b';
    hud.meter.setAttribute('aria-valuenow', String(Math.round(pct)));
    hud.drag.textContent = Math.floor(dragDistance) + ' m';
    hud.best.textContent = 'best ' + Math.floor(bestDrag) + ' m';
    dragCallout.hidden = !dragging;
    // air time: a big counter while you fly, then a summary when you land
    hud.airCallout.hidden = !(airborne && airTime > 0.3);
    if (airborne) hud.airTime.textContent = airTime.toFixed(1);
    hud.bestAir.textContent = 'best ' + bestAir.toFixed(1) + ' s';
    if (landing && !landing.shown) {
      landing.shown = true;
      if (landing.time > 0.35) {
        hud.airLast.textContent = landing.time.toFixed(1) + ' s';
        toast(landing.wheelie ? 'Landed it in a wheelie!' : `${landing.time.toFixed(1)} s of air`,
          `${Math.round(landing.dist)} m far · ${landing.high.toFixed(1)} m high · best ${bestAir.toFixed(1)} s`);
      }
    }

    // where you are, a few times a second
    whereT -= frameDt;
    if (whereT <= 0) {
      whereT = 0.25;
      here = world.nearestRoad(player.x, player.z, 35);
      hud.road.textContent = here ? here.road.label || 'Unnamed road' : surface.water ? 'Pacific Ocean' : 'Off road';
      const city = world.cityAt(player.x, player.z);
      hud.city.textContent = city;
      if (city && city !== lastCity) {
        if (lastCity) toast(`Welcome to ${city}`);
        lastCity = city;
      }
      const limit = here && here.d < here.road.hw + 3 ? here.road.mph : 0;
      hud.limit.hidden = !limit;
      hud.limitNum.textContent = limit;
      hud.dash.classList.toggle('over', !!limit && mph > limit + 10);
      for (const l of world.landmarks) {
        if (l.dist < (l.model === 'giant_wheel' ? 220 : 110)) {
          const seen = landmarkSeen.get(l.name) || 0;
          if (performance.now() - seen > 90000) { toast(l.name, l.note); landmarkSeen.set(l.name, performance.now()); }
        }
      }
    }
    if (toastT > 0) { toastT -= frameDt; if (toastT <= 0) hud.toast.hidden = true; }
    miniT -= frameDt;
    if (miniT <= 0) {
      miniT = 1 / 15;
      const yaw = view === 'first' || crashed ? player.yaw : camYaw;
      world.drawMinimap(miniCtx, hud.mini.width, player.x, player.z, yaw, 260, [[spawn.x, spawn.z, '#d6f05b']]);
      miniCtx.save();
      miniCtx.translate(hud.mini.width / 2, hud.mini.height / 2);
      miniCtx.rotate(yaw - player.yaw);
      miniCtx.fillStyle = '#ff8a3d';
      miniCtx.strokeStyle = '#101b23';
      miniCtx.lineWidth = 3;
      miniCtx.beginPath();
      miniCtx.moveTo(0, -16); miniCtx.lineTo(11, 12); miniCtx.lineTo(0, 6); miniCtx.lineTo(-11, 12); miniCtx.closePath();
      miniCtx.stroke();
      miniCtx.fill();
      miniCtx.restore();
      // the N marker sits on the rim, pointing north
      hud.north.style.left = `${50 + Math.sin(yaw) * 43}%`;
      hud.north.style.top = `${50 - Math.cos(yaw) * 43}%`;
    }
  }

  // ---------------------------------------------------------------------------
  // The big map (M): see where everything is, click a road to go there
  // ---------------------------------------------------------------------------
  const bigmap = $('bigmap'), bigCanvas = $('bigmap-canvas'), bigCtx = bigCanvas.getContext('2d');
  let mapView = null;
  function drawBigMap() {
    const ov = world.overviewCanvas();
    const box = bigCanvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio, 2);
    bigCanvas.width = Math.round(box.width * dpr);
    bigCanvas.height = Math.round(box.height * dpr);
    const k = Math.min(bigCanvas.width / ov.canvas.width, bigCanvas.height / ov.canvas.height);
    const ox = (bigCanvas.width - ov.canvas.width * k) / 2, oy = (bigCanvas.height - ov.canvas.height * k) / 2;
    mapView = { k, ox, oy, ov, dpr };
    bigCtx.fillStyle = '#16232b';
    bigCtx.fillRect(0, 0, bigCanvas.width, bigCanvas.height);
    bigCtx.drawImage(ov.canvas, ox, oy, ov.canvas.width * k, ov.canvas.height * k);
    const toScreen = (x, z) => { const [mx, my] = ov.toMap(x, z); return [ox + mx * k, oy + my * k]; };
    bigCtx.font = `600 ${11 * dpr}px "IBM Plex Mono", monospace`;
    for (const l of world.landmarks) {
      const [sx, sy] = toScreen(l.x, l.z);
      bigCtx.fillStyle = '#ff8a3d';
      bigCtx.beginPath();
      bigCtx.arc(sx, sy, 3.5 * dpr, 0, Math.PI * 2);
      bigCtx.fill();
    }
    for (const s of SPAWNS) {
      const [sx, sy] = toScreen(s.x, s.z);
      bigCtx.fillStyle = '#d6f05b';
      bigCtx.fillRect(sx - 4 * dpr, sy - 4 * dpr, 8 * dpr, 8 * dpr);
    }
    const [px, py] = toScreen(player.x, player.z);
    bigCtx.save();
    bigCtx.translate(px, py);
    bigCtx.rotate(-player.yaw);
    bigCtx.fillStyle = '#ff2f8e';
    bigCtx.strokeStyle = '#101b23';
    bigCtx.lineWidth = 2 * dpr;
    bigCtx.beginPath();
    bigCtx.moveTo(0, -11 * dpr); bigCtx.lineTo(8 * dpr, 8 * dpr); bigCtx.lineTo(0, 4 * dpr); bigCtx.lineTo(-8 * dpr, 8 * dpr); bigCtx.closePath();
    bigCtx.stroke();
    bigCtx.fill();
    bigCtx.restore();
  }
  function toggleMap(open = bigmap.hidden) {
    bigmap.hidden = !open;
    sound.setPaused(open || paused);
    if (open) drawBigMap();
  }
  bigCanvas.addEventListener('click', (e) => {
    if (!mapView) return;
    const box = bigCanvas.getBoundingClientRect();
    const px = ((e.clientX - box.left) * mapView.dpr - mapView.ox) / mapView.k;
    const py = ((e.clientY - box.top) * mapView.dpr - mapView.oy) / mapView.k;
    const [wx, wz] = mapView.ov.toWorld(px, py);
    const spot = roadHeading(wx, wz, player.yaw);
    if (!spot) { toast('No road there', 'Click closer to a road.'); return; }
    reset({ x: spot.x, z: spot.z, heading: spot.heading });
    toggleMap(false);
    toast(spot.road.label || 'Teleported', world.cityAt(spot.x, spot.z));
  });
  $('bigmap-close').addEventListener('click', () => toggleMap(false));

  // ---------------------------------------------------------------------------
  // Pause menu, like the go-kart: Esc (or H, P, or the pause button) opens it,
  // and the ride stops while it's open.
  // ---------------------------------------------------------------------------
  const menu = $('menu');
  let paused = false;
  function setMenu(open) {
    paused = open;
    menu.hidden = !open;
    sound.setPaused(open || !bigmap.hidden);
    keys.clear();
    if (open) $('resume').focus();
    else if (menu.contains(document.activeElement)) document.activeElement.blur();
  }
  $('menu-btn').addEventListener('click', () => setMenu(true));
  $('resume').addEventListener('click', () => setMenu(false));
  menu.addEventListener('click', (e) => { if (e.target === menu) setMenu(false); }); // click outside the panel
  $('reset-menu').addEventListener('click', () => { reset(); setMenu(false); });
  $('start-menu').addEventListener('click', () => { reset(spawn); setMenu(false); });
  $('map-open').addEventListener('click', () => { setMenu(false); toggleMap(true); });
  $('map-cta').addEventListener('click', (e) => { toggleMap(true); e.currentTarget.blur(); });
  $('map-btn').addEventListener('click', (e) => { toggleMap(); e.currentTarget.blur(); });
  $('reset-btn').addEventListener('click', (e) => { reset(); e.currentTarget.blur(); });
  $('cam-btn').addEventListener('click', (e) => { cycleView(); e.currentTarget.blur(); });
  $('time-btn').addEventListener('click', (e) => { setTime(world.time === 'day' ? 'sunset' : 'day'); e.currentTarget.blur(); });

  // The camera's name shows for a moment when you switch.
  const camName = $('camname');
  const CAM_NAMES = { third: 'Chase cam', first: '1st person', side: 'Side cam' };
  let camNameTimer = 0;
  function cycleView() {
    setView(VIEWS[(VIEWS.indexOf(view) + 1) % VIEWS.length]);
    camName.textContent = CAM_NAMES[view];
    camName.classList.remove('gone');
    clearTimeout(camNameTimer);
    camNameTimer = setTimeout(() => camName.classList.add('gone'), 1400);
  }
  // The keyboard hints fade away once you've had a chance to read them.
  const hints = $('hints');
  setTimeout(() => { hints.classList.add('fade'); setTimeout(() => { hints.hidden = true; }, 900); }, 12000);

  const spawnList = $('spawns');
  for (const s of SPAWNS) {
    const b = document.createElement('button');
    b.textContent = s.name;
    b.title = s.tip || s.name;
    b.dataset.spawn = s.name;
    b.addEventListener('click', () => { goTo(s); b.blur(); });
    spawnList.appendChild(b);
  }
  function goTo(s) {
    spawn = s;
    store.set('wheelie2.spawn', s.name);
    lastSafe = null;
    reset(s);
    spawnList.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.spawn === s.name)));
    toast(s.name, s.tip || world.cityAt(s.x, s.z));
  }

  function selectBike(id) {
    if (!MODELS[id]) return;
    const wasCrashed = crashed;
    if (crashed) restoreBike();
    crashed = false;
    crashScreen.hidden = true;
    selected = id;
    store.set('wheelie2.bike', id);
    drive = new Drivetrain(id);
    drive.auto = store.get('wheelie2.manual') !== '1';
    sound.setRide(drive.spec.kind);
    buildBike();
    poseRider(0);
    if (wasCrashed) reset();
    speed = 0; lean = 0;
    document.querySelectorAll('[data-bike]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.bike === id)));
    hud.drive.textContent = `${drive.spec.label} · tops out near ${Math.round(MODELS[id].max * 2.237)} mph`;
    $('gearbox').hidden = drive.spec.kind === 'electric';
    syncGearbox();
  }
  document.querySelectorAll('[data-bike]').forEach((b) => b.addEventListener('click', () => { selectBike(b.dataset.bike); b.blur(); }));
  document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => { setView(b.dataset.view); b.blur(); }));
  function setTime(name) {
    const t = world.setTime(name);
    store.set('wheelie2.time', world.time);
    envMap = world.envMap;
    buildBike();
    poseRider(0);
    document.querySelectorAll('[data-time]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.time === world.time)));
    $('time-btn').setAttribute('aria-pressed', String(world.time === 'sunset'));
    return t;
  }
  document.querySelectorAll('[data-time]').forEach((b) => b.addEventListener('click', () => { setTime(b.dataset.time); b.blur(); }));
  const trafficBtn = $('traffic');
  let trafficOn = store.get('wheelie2.traffic') !== '0';
  function setTraffic(on) {
    trafficOn = on;
    world.setTraffic(on);
    trafficBtn.setAttribute('aria-pressed', String(on));
    store.set('wheelie2.traffic', on ? '1' : '0');
  }
  trafficBtn.addEventListener('click', () => { setTraffic(!trafficOn); trafficBtn.blur(); });
  function setSound(on) {
    sound.setEnabled(on);
    if (on) sound.start();
    store.set('wheelie2.sound', on ? '1' : '0');
    for (const id of ['sound', 'sound-btn']) $(id).setAttribute('aria-pressed', String(on));
  }
  $('sound').addEventListener('click', (e) => { setSound(!sound.enabled); e.currentTarget.blur(); });
  $('sound-btn').addEventListener('click', (e) => { setSound(!sound.enabled); e.currentTarget.blur(); });
  // Browsers only play sound after a key press or click.
  const wakeSound = () => { if (!paused && bigmap.hidden) sound.start(); };
  addEventListener('keydown', wakeSound);
  addEventListener('pointerdown', wakeSound);
  function syncGearbox() {
    document.querySelectorAll('[data-gearbox]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.gearbox === 'auto') === drive.auto)));
  }
  document.querySelectorAll('[data-gearbox]').forEach((b) => b.addEventListener('click', () => {
    drive.auto = b.dataset.gearbox === 'auto';
    store.set('wheelie2.manual', drive.auto ? '0' : '1');
    syncGearbox();
    b.blur();
  }));
  $('restart').addEventListener('click', () => reset());
  $('restart-start').addEventListener('click', () => reset(spawn));

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------
  const CONTROL_KEYS = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyE', 'KeyW', 'KeyA', 'KeyS', 'KeyD'];
  addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('input, select, textarea')) return;
    if (e.repeat && !CONTROL_KEYS.includes(e.code)) return;
    // Esc closes the map first; otherwise Esc, H and P open and close the menu.
    if (e.code === 'Escape' && !bigmap.hidden) { toggleMap(false); return; }
    if (e.code === 'Escape' || e.code === 'KeyH' || e.code === 'KeyP') { e.preventDefault(); setMenu(!paused); return; }
    if (paused) return;
    if (CONTROL_KEYS.includes(e.code)) { e.preventDefault(); keys.add(e.code); }
    if (e.repeat) return;
    if (e.code === 'KeyC') cycleView();
    if (e.code === 'KeyX') { drive.auto = false; drive.shift(1); syncGearbox(); }
    if (e.code === 'KeyZ') { drive.auto = false; drive.shift(-1); syncGearbox(); }
    if (e.code === 'KeyG') { drive.auto = !drive.auto; syncGearbox(); toast(drive.auto ? 'Automatic shifting' : 'Manual shifting', drive.auto ? '' : 'X shifts up, Z shifts down'); }
    if (e.code === 'KeyM') toggleMap();
    if (e.code === 'KeyT') setTime(world.time === 'day' ? 'sunset' : 'day');
    if (e.code === 'KeyV') setSound(!sound.enabled);
    if (e.code === 'KeyR') reset();
  });
  addEventListener('keyup', (e) => {
    if (CONTROL_KEYS.includes(e.code)) { e.preventDefault(); keys.delete(e.code); }
  });
  addEventListener('blur', () => { keys.clear(); touch.clear(); });
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
  // ?hold=ArrowUp,Space keeps keys held down (handy for testing and demos).
  for (const k of (params.get('hold') || '').split(',').filter(Boolean)) touch.add(k);
  // ?debug=1 prints how much the GPU is drawing, every 2 seconds.
  if (params.get('debug')) {
    renderer.info.autoReset = false;
    setInterval(() => {
      const r = renderer.info.render;
      console.log(`draw calls ${r.calls}, triangles ${(r.triangles / 1e6).toFixed(2)}M, frames ${r.frame}`);
      renderer.info.reset();
    }, 2000);
  }

  // ---------------------------------------------------------------------------
  // Go
  // ---------------------------------------------------------------------------
  setView([params.get('view'), store.get('wheelie2.view')].find((v) => VIEWS.includes(v)) || 'third');
  setTraffic(trafficOn);
  setSound(sound.enabled);
  selectBike(MODELS[params.get('bike')] ? params.get('bike') : selected);
  document.querySelectorAll('[data-time]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.time === world.time)));
  goTo(spawn);
  // ?at=x,z,heading drops you at an exact spot (heading in degrees, 0 = north).
  if (params.get('at')) {
    const [x, z, h = 0] = params.get('at').split(',').map(Number);
    reset({ x, z, heading: (h * Math.PI) / 180 });
  }
  if (params.get('map')) toggleMap(true);
  if (params.get('menu')) setMenu(true);
  loading.classList.add('done');
  setTimeout(() => { loading.hidden = true; }, 600);

  // ---------------------------------------------------------------------------
  // Feeding the sound: what the engine, tyres and surroundings are doing
  // ---------------------------------------------------------------------------
  let lastGear = -1, lastShake = 0, seaDist = 1e9, seaT = 0, soundTime = 0;
  function updateSound(frameDt) {
    soundTime += frameDt;
    const at = crashed ? focus : player;
    // how far the ocean is, a couple of times a second
    seaT -= frameDt;
    if (seaT <= 0) {
      seaT = 0.5;
      seaDist = 1e9;
      for (const d of [20, 60, 120, 220]) {
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * Math.PI * 2;
          if (world.groundTypeAt(at.x + Math.cos(a) * d, at.z + Math.sin(a) * d) === world.GT.SEABED) { seaDist = d; break; }
        }
        if (seaDist < 1e9) break;
      }
    }
    let carDist = 1e9;
    for (const c of world.cars) carDist = Math.min(carDist, Math.hypot(c.x - at.x, c.z - at.z));
    if (drive.gear !== lastGear) {
      if (lastGear !== -1) sound.shift(drive.spec.kind);
      lastGear = drive.gear;
    }
    if (crashed && shake > lastShake + 0.15) sound.thump(shake); // hard hits while tumbling
    lastShake = shake;
    const type = surface.road || surface.walk ? 'road' : surface.water ? 'water' : surface.type === world.GT.SAND ? 'sand' : 'dirt';
    sound.update({
      kind: drive.spec.kind, rpm: drive.rpm, throttle: !crashed && (pressed('ArrowUp') || pressed('KeyW')) ? 1 : 0,
      cut: drive.cut > 0, kw: drive.kw, speed, airborne, dragging, crashed, slide: speed,
      surface: type, carDist, seaDist, time: soundTime, dt: frameDt,
    });
  }

  const STEP = 0.02;
  let previous = performance.now();
  let acc = 0;
  function animate(now) {
    const frameDt = Math.min((now - previous) / 1000, 0.1);
    acc = Math.min(acc + frameDt, 0.12);
    previous = now;
    if (bigmap.hidden && !paused) {
      while (acc >= STEP) { tick(STEP); acc -= STEP; }
    } else {
      acc = 0;
    }
    updateCamera(frameDt);
    world.update(frameDt, crashed ? { x: focus.x, y: focus.y, z: focus.z, yaw: camYaw, speed: 0 } : player, camera);
    updateSound(frameDt);
    updateHud(frameDt);
    jolt.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(shake * 0.3);
    camera.position.add(jolt);
    renderer.render(scene, camera);
    camera.position.sub(jolt);
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
  // For testing from the browser console: window.__wheelie.freeCam = true lets you move `camera` yourself.
  window.__wheelie = { world, player, camera, scene, sound, get speed() { return speed; }, set speed(v) { speed = v; }, get air() { return { airborne, airTime, vy, y: player.y, ground: world.heightAt(player.x, player.z), bestAir, landing, crashed, crashReason }; }, drive: () => drive, goTo, reset, freeCam: false };
})();
