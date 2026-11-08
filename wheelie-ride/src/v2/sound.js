// Wheelie Ride v2: sound. Everything is made live with the Web Audio API
// (oscillators, filtered noise), so there are no sound files.
//
//  * Ninja H2R: an inline four fires twice per turn of the crank, so the
//    engine note is rpm / 60 x 2 (43 Hz at idle, 467 Hz at the 14,000 rpm
//    redline). Two sawtooth waves and a square wave an octave down, put
//    through a little distortion and a filter that opens up with the
//    throttle. On top: the supercharger's whistle, and pops and crackles
//    when you shut the throttle at high revs.
//  * Sur-Ron: an electric motor's whine, rpm / 60 x its 4 magnet pole pairs,
//    louder the harder it's working.
//  * Bicycles: the freewheel ratchet clicks while you coast (24 clicks per
//    turn of the wheel, so it ticks slowly and buzzes fast), and the chain
//    whirs while you pedal.
//  * Everything: tyre noise (different on road, dirt and sand), wind that
//    grows with speed, the glove scraping in a hand drag, thumps when you
//    land or crash, gear-shift clicks, traffic going past and waves when
//    you're near the ocean.
// Browsers only allow sound after you press a key or click, so start() is
// called on the first one.
(() => {
  'use strict';

  function createSound() {
    let ctx = null, master = null, noise = null;
    let enabled = true, paused = false;
    const v = {};
    let ride = 'gas';
    let popT = 0;

    const now = () => ctx.currentTime;
    const set = (param, value, time = 0.04) => param.setTargetAtTime(value, now(), time);

    function makeNoise() {
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      return buf;
    }
    function noiseSource() {
      const s = ctx.createBufferSource();
      s.buffer = noise;
      s.loop = true;
      s.loopStart = Math.random();
      s.start(0, Math.random() * 1.9);
      return s;
    }
    function osc(type, freq) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.start();
      return o;
    }
    function gain(value = 0) {
      const g = ctx.createGain();
      g.gain.value = value;
      return g;
    }
    function filter(type, freq, q = 0.7) {
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      return f;
    }
    function chain(...nodes) {
      for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
      return nodes[nodes.length - 1];
    }
    function distortion(amount) {
      const n = 1024, curve = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * 2 - 1;
        curve[i] = ((1 + amount) * x) / (1 + amount * Math.abs(x));
      }
      const w = ctx.createWaveShaper();
      w.curve = curve;
      w.oversample = '2x';
      return w;
    }

    function start() {
      if (ctx) { if (ctx.state === 'suspended' && !paused) ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      noise = makeNoise();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 6;
      master = gain(enabled ? 0.8 : 0);
      master.connect(comp).connect(ctx.destination);

      // --- Ninja H2R engine ---------------------------------------------------
      v.gas = gain(0);
      v.gas.connect(master);
      v.g1 = osc('sawtooth', 50);
      v.g2 = osc('sawtooth', 100);
      v.g2.detune.value = 7;
      v.gSub = osc('square', 25);
      const mix = gain(1);
      chain(v.g1, gain(0.5), mix);
      chain(v.g2, gain(0.22), mix);
      chain(v.gSub, gain(0.3), mix);
      v.gIntake = filter('bandpass', 300, 1.2);
      chain(noiseSource(), v.gIntake, (v.gIntakeGain = gain(0.0)), mix);
      v.gFilter = filter('lowpass', 600, 2.5);
      chain(mix, distortion(6), v.gFilter, v.gas);
      v.gWhine = osc('sine', 1500);   // supercharger
      chain(v.gWhine, (v.gWhineGain = gain(0)), master);

      // --- Sur-Ron motor ------------------------------------------------------
      v.elec = gain(0);
      v.elec.connect(master);
      v.e1 = osc('triangle', 100);
      v.e2 = osc('sine', 300);
      chain(v.e1, gain(0.6), filter('lowpass', 3000), v.elec);
      chain(v.e2, gain(0.15), v.elec);
      v.eHum = filter('bandpass', 180, 2);
      chain(noiseSource(), v.eHum, gain(0.25), v.elec);

      // --- Bicycle freewheel and chain -----------------------------------------
      v.wheel = gain(0);
      v.wheel.connect(master);
      v.fw = osc('square', 10);
      chain(v.fw, filter('highpass', 2200, 0.5), (v.fwGain = gain(0)), v.wheel);
      v.chainF = filter('bandpass', 1800, 3);
      chain(noiseSource(), v.chainF, (v.chainGain = gain(0)), v.wheel);
      v.wheel.gain.value = 1;

      // --- Tyres, wind, scraping, traffic, surf ---------------------------------
      v.tyreF = filter('bandpass', 500, 0.8);
      chain(noiseSource(), v.tyreF, (v.tyre = gain(0)), master);
      v.windF = filter('lowpass', 1200, 0.5);
      chain(noiseSource(), filter('highpass', 250, 0.5), v.windF, (v.wind = gain(0)), master);
      v.scrapeF = filter('bandpass', 2800, 2.2);
      chain(noiseSource(), v.scrapeF, (v.scrape = gain(0)), master);
      v.carF = filter('bandpass', 260, 1);
      chain(noiseSource(), v.carF, (v.car = gain(0)), master);
      chain(noiseSource(), filter('lowpass', 650, 0.5), (v.surf = gain(0)), master);

      setRide(ride);
    }

    // A short burst of filtered noise (pops, clicks, the noise part of thumps).
    function burst(freq, type, dur, level, q = 1) {
      if (!ctx || !enabled) return;
      const s = ctx.createBufferSource();
      s.buffer = noise;
      const f = filter(type, freq, q);
      const g = gain(0);
      chain(s, f, g, master);
      const t = now();
      g.gain.setValueAtTime(level, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.start(t, Math.random() * 1.5, dur + 0.05);
    }
    // A low boom that drops in pitch: landings and crash impacts.
    function thump(strength) {
      if (!ctx || !enabled || strength < 0.05) return;
      const k = Math.min(1, strength);
      const o = ctx.createOscillator();
      o.type = 'sine';
      const g = gain(0);
      chain(o, g, master);
      const t = now();
      o.frequency.setValueAtTime(110, t);
      o.frequency.exponentialRampToValueAtTime(38, t + 0.28);
      g.gain.setValueAtTime(0.9 * k, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.start(t);
      o.stop(t + 0.4);
      burst(500, 'lowpass', 0.25, 0.6 * k);
    }
    function shift(kind) {
      if (kind === 'pedal') burst(4000, 'highpass', 0.05, 0.12);
      else burst(1200, 'bandpass', 0.06, 0.25, 2);
    }

    function setRide(kind) {
      ride = kind;
      if (!ctx) return;
      set(v.gas.gain, 0, 0.05);
      set(v.elec.gain, 0, 0.05);
      set(v.wheel.gain, kind === 'pedal' ? 1 : 0, 0.05);
      set(v.gWhineGain.gain, 0, 0.05);
    }

    // s: { kind, rpm, throttle, cut, kw, speed, airborne, dragging, crashed,
    //      slide, surface: 'road'|'dirt'|'sand'|'water', carDist, seaDist, time }
    function update(s) {
      if (!ctx || paused) return;
      const sp = s.speed;
      if (s.kind === 'gas' && !s.crashed) {
        const f = Math.max(22, (s.rpm / 60) * 2);
        set(v.g1.frequency, f, 0.02);
        set(v.g2.frequency, f * 2, 0.02);
        set(v.gSub.frequency, f / 2, 0.02);
        set(v.gIntake.frequency, f * 3, 0.03);
        const load = s.cut ? 0.1 : s.throttle;
        set(v.gFilter.frequency, 280 + 3800 * Math.min(1, s.rpm / 14000) * (0.35 + 0.65 * load), 0.03);
        set(v.gIntakeGain.gain, 0.15 * load, 0.05);
        set(v.gas.gain, (0.12 + 0.3 * load) * (s.cut ? 0.4 : 1), 0.03);
        set(v.gWhine.frequency, 600 + s.rpm * 0.42, 0.03);
        set(v.gWhineGain.gain, 0.012 * Math.min(1, s.rpm / 9000) * (0.3 + load), 0.08);
        // pops and crackles on a closed throttle at high revs
        popT -= s.dt;
        if (!s.throttle && s.rpm > 6500 && popT <= 0) {
          popT = 0.04 + Math.random() * 0.25;
          if (Math.random() < 0.6) burst(700 + Math.random() * 900, 'bandpass', 0.05 + Math.random() * 0.05, 0.35, 1.5);
        }
      } else if (s.kind === 'gas') {
        set(v.gas.gain, 0, 0.3);
        set(v.gWhineGain.gain, 0, 0.3);
      }
      if (s.kind === 'electric') {
        const f = Math.max(1, (s.rpm / 60) * 4);
        set(v.e1.frequency, f, 0.02);
        set(v.e2.frequency, f * 3, 0.02);
        set(v.eHum.frequency, 120 + f * 0.5, 0.05);
        const work = Math.min(1, Math.max(0, s.kw) / 6);
        set(v.elec.gain, s.crashed ? 0 : Math.min(0.35, sp * 0.006 + work * 0.2), 0.05);
      }
      if (s.kind === 'pedal') {
        const wheelHz = sp / 2.1;
        const coasting = !s.throttle && sp > 0.3 && !s.crashed;
        set(v.fw.frequency, Math.max(2, wheelHz * 24), 0.02);
        set(v.fwGain.gain, coasting ? 0.05 : 0, 0.03);
        set(v.chainGain.gain, s.throttle && sp > 0.3 && !s.crashed ? 0.035 + Math.min(0.04, sp * 0.003) : 0, 0.05);
      }
      // tyres
      const rolling = s.airborne || s.crashed ? 0 : sp;
      const rough = s.surface === 'dirt' ? 1.8 : s.surface === 'sand' ? 1.3 : 1;
      set(v.tyreF.frequency, s.surface === 'road' ? 350 + Math.min(900, sp * 12) : 220 + Math.min(400, sp * 6), 0.1);
      set(v.tyre.gain, Math.min(0.22, rolling * 0.008 * rough) * (s.surface === 'dirt' ? 0.7 + Math.random() * 0.6 : 1), 0.05);
      // wind
      const w = Math.min(1, sp / 45);
      set(v.windF.frequency, 500 + w * 2500, 0.1);
      set(v.wind.gain, Math.min(0.4, w * w * 0.35 + (s.airborne ? 0.05 : 0)), 0.1);
      // glove (or bike and rider) scraping along the road
      const scrape = s.dragging ? 0.22 + Math.random() * 0.08 : s.crashed ? Math.min(0.35, s.slide * 0.03) : 0;
      set(v.scrapeF.frequency, 2200 + Math.random() * 1500, 0.02);
      set(v.scrape.gain, scrape, 0.03);
      // traffic going past, and the waves
      const near = Math.max(0, 1 - s.carDist / 45);
      set(v.car.gain, near * near * 0.3, 0.1);
      const sea = Math.max(0, 1 - s.seaDist / 250);
      set(v.surf.gain, sea * (0.12 + 0.1 * Math.sin((s.time * Math.PI * 2) / 8.5)), 0.3);
    }

    return {
      start,
      update,
      thump,
      shift,
      setRide,
      get enabled() { return enabled; },
      setEnabled(on) {
        enabled = on;
        if (master) set(master.gain, on ? 0.8 : 0, 0.05);
      },
      setPaused(p) {
        paused = p;
        if (!ctx) return;
        if (p) ctx.suspend(); else ctx.resume();
      },
    };
  }

  window.WR_SOUND = { createSound };
})();
