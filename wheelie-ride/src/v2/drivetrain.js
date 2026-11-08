// Wheelie Ride v2: gears, RPM and pushing force for each ride.
//
// Each ride has a real drivetrain behind the gauges:
//  * Bicycles: chainring and cog teeth. The "RPM" gauge is pedal cadence
//    (how fast your legs turn). Low gears push hard but spin out early;
//    high gears are fast but heavy to start in.
//  * Sur-Ron Light Bee X: an electric motor with one fixed reduction, so the
//    gear always reads D. Shows motor RPM, power and battery.
//  * Kawasaki Ninja H2R: the real 6-speed gear ratios, primary and final
//    drive, a torque curve that peaks at 12,500 rpm, a 14,000 rpm redline,
//    a quickshifter on the way up and a throttle blip on the way down.
// Force at the rear tyre = engine torque x every ratio in between / tyre radius.
// That force (minus drag) is what speeds the bike up, and it is also what
// lifts the front wheel: 1st gear wheelies easily, 6th barely at all.
(() => {
  'use strict';

  const pedalGears = (rings, cogs) => {
    const list = [];
    for (const ring of rings) for (const cog of cogs) list.push({ ring, cog, ratio: ring / cog });
    return list;
  };

  const SPECS = {
    street: {
      kind: 'pedal', label: 'Hybrid · 7-speed', mass: 15, cda: 0.46, crr: 0.006, circ: 2.11,
      gears: pedalGears([44], [28, 24, 21, 18, 16, 14, 12]), power: 950, crankTorque: 230, cadMax: 135,
    },
    trail: {
      kind: 'pedal', label: 'Mountain bike · 1×12', mass: 14, cda: 0.5, crr: 0.011, circ: 2.33,
      gears: pedalGears([32], [51, 45, 39, 34, 30, 26, 23, 20, 17, 15, 12, 10]), power: 900, crankTorque: 240, cadMax: 135,
    },
    sprint: {
      kind: 'pedal', label: 'Road bike · 2×11', mass: 8, cda: 0.32, crr: 0.004, circ: 2.1,
      // A real rider uses these 13 of the 22 combinations, in this order.
      gears: [...pedalGears([39], [28, 25, 23, 21, 19]), ...pedalGears([53], [21, 19, 17, 15, 14, 13, 12, 11])],
      power: 1150, crankTorque: 250, cadMax: 140,
    },
    'sur-ron': {
      kind: 'electric', label: 'Light Bee X · direct drive', mass: 57, cda: 0.55, crr: 0.012, circ: 1.96,
      reduction: 8.4, wheelTorque: 250, powerKW: 6, motorMax: 6200, batteryWh: 1900,
    },
    kawasaki: {
      kind: 'gas', label: 'Ninja H2R · 6-speed', mass: 216, cda: 0.32, crr: 0.014, circ: 2.13,
      primary: 1.551, final: 43 / 18, ratios: [3.188, 2.526, 2.045, 1.727, 1.524, 1.36],
      idle: 1300, redline: 14000, limiter: 14400,
      // [rpm, newton-metres]: supercharged, so it keeps pulling to the top
      torque: [[0, 60], [1300, 70], [3000, 92], [5000, 108], [7000, 124], [9000, 140], [11000, 156], [12500, 165], [14000, 156], [14500, 140]],
    },
  };

  const RIDER_KG = 75;
  const AIR = 1.2; // kg/m^3, sea-level Orange County air

  function lookup(table, x) {
    if (x <= table[0][0]) return table[0][1];
    for (let i = 1; i < table.length; i++) {
      if (x <= table[i][0]) {
        const [x0, y0] = table[i - 1], [x1, y1] = table[i];
        return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
      }
    }
    return table[table.length - 1][1];
  }

  class Drivetrain {
    constructor(id) {
      this.id = id;
      this.spec = SPECS[id];
      this.mass = this.spec.mass + RIDER_KG;
      this.radius = this.spec.circ / (2 * Math.PI);
      this.auto = true;
      this.reset();
    }

    reset() {
      const s = this.spec;
      this.gear = s.kind === 'pedal' ? Math.min(2, s.gears.length - 1) : 0;
      this.rpm = s.kind === 'gas' ? s.idle : 0;
      this.shiftCooldown = 0;
      this.cut = 0;          // quickshifter / limiter power cut, seconds
      this.blip = 0;         // downshift throttle blip, seconds
      this.battery = 1;      // electric only
      this.kw = 0;
      this.lastShift = '';
    }

    get gearCount() {
      const s = this.spec;
      return s.kind === 'pedal' ? s.gears.length : s.kind === 'gas' ? s.ratios.length : 1;
    }

    // Overall ratio between the engine/crank and the rear wheel.
    ratio(g = this.gear) {
      const s = this.spec;
      if (s.kind === 'pedal') return s.gears[g].ratio;
      if (s.kind === 'electric') return s.reduction;
      return s.primary * s.ratios[g] * s.final;
    }

    // Engine/crank/motor turns per minute at this road speed in gear g.
    rpmAt(speed, g = this.gear) {
      const wheelRpm = (speed / this.spec.circ) * 60;
      return this.spec.kind === 'pedal' ? wheelRpm / this.ratio(g) : wheelRpm * this.ratio(g);
    }

    shift(dir) {
      const next = this.gear + dir;
      if (next < 0 || next >= this.gearCount || this.shiftCooldown > 0) return false;
      this.gear = next;
      this.shiftCooldown = this.spec.kind === 'gas' ? 0.18 : 0.3;
      if (this.spec.kind === 'gas') {
        if (dir > 0) this.cut = 0.06; else this.blip = 0.12;
      }
      this.lastShift = dir > 0 ? 'up' : 'down';
      return true;
    }

    // Resistances (rolling + air) as a deceleration, m/s^2.
    drag(speed) {
      const s = this.spec;
      return s.crr * 9.81 + (0.5 * AIR * s.cda * speed * speed) / this.mass;
    }

    // One step. throttle and brake are 0..1. Returns the forward acceleration
    // from the drivetrain alone (m/s^2, can be negative for engine braking).
    update(dt, speed, throttle, brake) {
      const s = this.spec;
      this.shiftCooldown = Math.max(0, this.shiftCooldown - dt);
      this.cut = Math.max(0, this.cut - dt);
      this.blip = Math.max(0, this.blip - dt);
      let force = 0;

      if (s.kind === 'pedal') {
        const cadence = this.rpmAt(speed);
        if (this.auto && this.shiftCooldown === 0) {
          if (speed < 0.6 && this.gear > 2) this.shift(-1);
          else if (throttle && cadence > 98 && this.gear < this.gearCount - 1) this.shift(1);
          else if (cadence < 62 && this.gear > 0) this.shift(-1);
        }
        const c = this.rpmAt(speed);
        if (throttle > 0 && c < s.cadMax) {
          // Legs push hardest around 90 rpm and fade out spinning very fast or grinding slowly.
          const eff = Math.max(0.2, 1 - ((c - 90) / 75) ** 2);
          const torqueLimited = (s.crankTorque * this.ratio()) / this.radius;
          const powerLimited = (s.power * eff) / Math.max(speed, 0.8);
          force = Math.min(torqueLimited, powerLimited) * throttle;
        }
        // Cadence on the gauge: legs only turn while you pedal.
        const target = throttle > 0 ? Math.min(c, s.cadMax + 10) : 0;
        this.rpm += (target - this.rpm) * Math.min(1, dt * 8);
      } else if (s.kind === 'electric') {
        const motor = this.rpmAt(speed);
        const flat = this.battery <= 0.02 ? 0.25 : 1; // limp mode when the battery is flat
        if (throttle > 0 && motor < s.motorMax) {
          const torqueLimited = s.wheelTorque / this.radius;
          const powerLimited = (s.powerKW * 1000) / Math.max(speed, 0.5);
          force = Math.min(torqueLimited, powerLimited) * throttle * flat;
        }
        const watts = force * speed;
        // regen braking puts a little back
        const regen = brake > 0 ? Math.min(1500, 300 * speed) * brake : 0;
        this.battery = Math.min(1, Math.max(0, this.battery - ((watts / 0.88 - regen * 0.6) * dt) / 3600 / s.batteryWh));
        this.kw += ((watts - regen) / 1000 - this.kw) * Math.min(1, dt * 6);
        this.rpm = motor;
      } else {
        // Gas: work out the engine speed from the wheel, slipping the clutch when slow.
        let rpm = this.rpmAt(speed);
        const launch = 3800;
        if (this.gear === 0 && rpm < launch) {
          rpm = throttle > 0 ? Math.max(rpm, launch * (0.6 + 0.4 * Math.min(1, speed / 3))) : Math.max(rpm, s.idle);
        }
        rpm = Math.max(rpm, s.idle);
        if (this.blip > 0) rpm *= 1.04;
        if (this.auto && this.shiftCooldown === 0) {
          if (throttle > 0 && rpm > 13600 && this.gear < 5) this.shift(1);
          else if (this.gear > 0 && this.rpmAt(speed, this.gear - 1) < 11500 &&
            (rpm < 4300 || (brake > 0 && rpm < 7000))) this.shift(-1);
        }
        if (rpm >= s.limiter) this.cut = Math.max(this.cut, 0.05); // bouncing off the limiter
        if (throttle > 0 && this.cut === 0) {
          force = (lookup(s.torque, rpm) * this.ratio() * 0.9 * throttle) / this.radius;
        } else if (throttle === 0 && speed > 1) {
          // engine braking: stronger in low gears
          force = -(0.14 * lookup(s.torque, rpm) * this.ratio() * 0.9) / this.radius;
        }
        this.rpm += (rpm - this.rpm) * Math.min(1, dt * 18);
      }

      this.force = force;
      return force / this.mass;
    }

    // How hard the drivetrain could push right now at full throttle (m/s^2).
    // Used to scale how fast the front wheel lifts.
    pullNow(speed) {
      const s = this.spec;
      if (s.kind === 'pedal') {
        const c = this.rpmAt(speed);
        const eff = Math.max(0.2, 1 - ((c - 90) / 75) ** 2);
        return Math.min((s.crankTorque * this.ratio()) / this.radius, (s.power * eff) / Math.max(speed, 0.8)) / this.mass;
      }
      if (s.kind === 'electric') {
        return Math.min(s.wheelTorque / this.radius, (s.powerKW * 1000) / Math.max(speed, 0.5)) / this.mass;
      }
      const rpm = Math.max(this.rpm, 3800);
      return (lookup(s.torque, rpm) * this.ratio() * 0.9) / this.radius / this.mass;
    }

    // Top speed on flat ground, found by stepping the physics.
    topSpeed() {
      const t = new Drivetrain(this.id);
      let v = 0;
      for (let i = 0; i < 6000; i++) v = Math.max(0, v + (t.update(0.05, v, 1, 0) - t.drag(v)) * 0.05);
      return v;
    }

    // Everything the gauges need.
    readout() {
      const s = this.spec;
      if (s.kind === 'pedal') {
        const g = s.gears[this.gear];
        return {
          gear: String(this.gear + 1), gearSub: `${g.ring}×${g.cog}`, gearOf: this.gearCount,
          rpm: this.rpm, rpmMax: 150, rpmLabel: 'CADENCE', rpmUnit: 'rpm',
          green: [80, 100], red: 120, shiftNow: false,
        };
      }
      if (s.kind === 'electric') {
        return {
          gear: 'D', gearSub: 'direct', gearOf: 1, rpm: this.rpm, rpmMax: 6500, rpmLabel: 'MOTOR RPM', rpmUnit: 'rpm',
          green: [2500, 5600], red: 6000, shiftNow: false, kw: this.kw, battery: this.battery,
        };
      }
      return {
        gear: String(this.gear + 1), gearSub: this.auto ? 'auto' : 'manual', gearOf: 6,
        rpm: this.rpm, rpmMax: 15000, rpmLabel: 'RPM ×1000', rpmUnit: 'rpm',
        green: [11000, 13500], red: 14000, shiftNow: !this.auto && this.rpm > 13200 && this.gear < 5,
      };
    }
  }

  window.WR_DRIVETRAIN = { Drivetrain, SPECS };
})();
