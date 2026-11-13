/*!
 * Afro Groove - an endless, original Afrocentric loop made with the Web Audio API.
 * 12/8 bell pattern, shekere, kick, conga, talking drum, bass and kalimba.
 * Sections and melodies keep changing so the loop never sounds stuck.
 * (c) The Tech Forge Ltd. GPL-2.0-or-later.
 */
(function () {
  'use strict';

  var BELL = [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1];      // standard West African 12/8 bell
  var PENTA = [0, 3, 5, 7, 10, 12, 15, 17, 19];          // minor pentatonic (semitones)
  var PROGS = [[0, 0, 5, 3], [0, 0, 7, 5], [0, 3, 5, 3], [0, 5, 0, 7]];
  var SECTIONS = ['groove', 'groove2', 'groove', 'break', 'groove2', 'groove', 'groove2', 'break'];

  function rnd(n) { return Math.floor(Math.random() * n); }
  function mtof(semisFromA4) { return 440 * Math.pow(2, semisFromA4 / 12); }

  function AfroGroove() {
    this.ctx = null; this.on = false; this.vol = 0.55; this.intensity = 0;
    this.bpm = 108; this.step = 0; this.bar = 0; this.timer = null;
  }

  AfroGroove.prototype.setup = function () {
    var AC = window.AudioContext || window.webkitAudioContext;
    var ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = 0;
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 3; comp.attack.value = 0.005; comp.release.value = 0.2;
    this.master.connect(comp); comp.connect(ctx.destination);
    // Echo bus for kalimba and bells
    this.echo = ctx.createDelay(1.5);
    this.echo.delayTime.value = (60 / this.bpm) * 0.5;
    var fb = ctx.createGain(); fb.gain.value = 0.28;
    var echoTone = ctx.createBiquadFilter(); echoTone.type = 'lowpass'; echoTone.frequency.value = 2600;
    this.echo.connect(echoTone); echoTone.connect(fb); fb.connect(this.echo);
    var echoOut = ctx.createGain(); echoOut.gain.value = 0.35;
    echoTone.connect(echoOut); echoOut.connect(this.master);
    // Noise buffer for shakers and slaps
    var len = ctx.sampleRate, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    this.newMelody();
    this.prog = PROGS[0];
  };

  AfroGroove.prototype.start = function () {
    if (this.on) return;
    if (!this.ctx) this.setup();
    var ctx = this.ctx, self = this;
    if (ctx.resume) ctx.resume();
    this.on = true;
    this.next = ctx.currentTime + 0.1;
    this.master.gain.cancelScheduledValues(ctx.currentTime);
    this.master.gain.setTargetAtTime(this.vol, ctx.currentTime, 0.4);
    this.timer = setInterval(function () { self.tick(); }, 25);
  };

  AfroGroove.prototype.stop = function () {
    if (!this.on) return;
    this.on = false;
    clearInterval(this.timer);
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
  };

  AfroGroove.prototype.setVolume = function (v) {
    this.vol = Math.max(0, Math.min(1, v));
    if (this.ctx && this.on) this.master.gain.setTargetAtTime(this.vol, this.ctx.currentTime, 0.2);
  };

  AfroGroove.prototype.setIntensity = function (v) { this.intensity = Math.max(0, Math.min(1, v)); };

  AfroGroove.prototype.tick = function () {
    var eighth = 60 / this.bpm / 3;
    while (this.next < this.ctx.currentTime + 0.15) {
      var t = this.next + (Math.random() - 0.5) * 0.006; // tiny human feel
      this.play(this.step, t, eighth);
      this.next += eighth;
      this.step = (this.step + 1) % 12;
      if (this.step === 0) this.onBar();
    }
  };

  AfroGroove.prototype.onBar = function () {
    this.bar++;
    if (this.bar % 8 === 0) {
      this.prog = PROGS[rnd(PROGS.length)];
      if (Math.random() < 0.7) this.newMelody();
    }
  };

  AfroGroove.prototype.section = function () {
    var s = SECTIONS[Math.floor(this.bar / 8) % SECTIONS.length];
    if (s === 'break' && this.bar % 8 >= 4) s = 'groove2';
    return s;
  };

  AfroGroove.prototype.newMelody = function () {
    // 24-step phrase (2 bars): a call, then a varied response.
    var call = [], idx = 3 + rnd(3);
    for (var i = 0; i < 12; i++) {
      if (Math.random() < 0.45) { call.push(null); continue; }
      idx = Math.max(0, Math.min(PENTA.length - 1, idx + rnd(5) - 2));
      call.push(PENTA[idx]);
    }
    var resp = call.map(function (n, i) {
      if (n === null) return Math.random() < 0.15 ? PENTA[rnd(5)] : null;
      if (i > 8) return PENTA[rnd(3)];
      return Math.random() < 0.3 ? PENTA[rnd(PENTA.length)] : n;
    });
    this.melody = call.concat(resp);
  };

  AfroGroove.prototype.play = function (step, t, eighth) {
    var sec = this.section(), hype = this.intensity;
    var root = this.prog[this.bar % 4];
    var full = sec !== 'break';

    // Bell: the timeline everything hangs on
    if (BELL[step]) this.bell(t, step === 0 ? 1 : 0.7, step === 0 || step === 7);
    if (hype > 0.5 && !BELL[step]) this.bell(t, 0.25, false);

    // Shekere on every eighth, accented on the beat
    this.shaker(t, step % 3 === 0 ? 0.9 : 0.45);

    // Kick on the dotted-quarter pulse
    if (step === 0 || step === 6 || (sec === 'groove2' && step === 9) || (hype > 0.5 && step === 3)) this.kick(t);

    // Conga tones and slaps
    if (full) {
      if (step === 3 || step === 4 || step === 10) this.conga(t, 'tone');
      if (step === 8 || (sec === 'groove2' && step === 11)) this.conga(t, 'slap');
    }

    // Talking drum phrases
    if ((sec === 'groove2' || sec === 'break') && (step === 1 || step === 5 || step === 9) && Math.random() < 0.55) this.talking(t, eighth);

    // Bass line
    if (full) {
      var bassPat = sec === 'groove2' ? { 0: 0, 3: 0, 5: 7, 6: 12, 9: 10, 11: 7 } : { 0: 0, 3: 0, 6: 7, 9: 5 };
      if (bassPat[step] !== undefined) this.bass(t, root + bassPat[step], eighth * 1.6);
    }

    // Kalimba melody (2-bar phrase), transposed with the chord
    var m = this.melody[(this.bar % 2) * 12 + step];
    if (m !== null && m !== undefined && (sec !== 'groove' || this.bar % 4 < 3)) this.kalimba(t, mtof(root + m - 9));
  };

  /* ---------------- instruments ---------------- */
  AfroGroove.prototype.env = function (g, t, peak, decay) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  };

  AfroGroove.prototype.bell = function (t, vel, low) {
    var ctx = this.ctx, f = low ? 784 : 1046;
    var g = ctx.createGain(), bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = f * 1.5; bp.Q.value = 1.2;
    [1, 2.76].forEach(function (k, i) {
      var o = ctx.createOscillator(); o.type = i ? 'sine' : 'triangle';
      o.frequency.value = f * k; o.connect(bp); o.start(t); o.stop(t + 0.25);
    });
    bp.connect(g); g.connect(this.master); g.connect(this.echo);
    this.env(g, t, 0.11 * vel, 0.18);
  };

  AfroGroove.prototype.shaker = function (t, vel) {
    var ctx = this.ctx, s = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = this.noise; hp.type = 'highpass'; hp.frequency.value = 6500;
    s.connect(hp); hp.connect(g); g.connect(this.master);
    this.env(g, t, 0.05 * vel, 0.06);
    s.start(t, Math.random() * 0.5, 0.08);
  };

  AfroGroove.prototype.kick = function (t) {
    var ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.16);
    o.connect(g); g.connect(this.master);
    this.env(g, t, 0.55, 0.32);
    o.start(t); o.stop(t + 0.35);
  };

  AfroGroove.prototype.conga = function (t, kind) {
    var ctx = this.ctx, g = ctx.createGain();
    if (kind === 'tone') {
      var o = ctx.createOscillator();
      o.frequency.setValueAtTime(230, t); o.frequency.exponentialRampToValueAtTime(190, t + 0.1);
      o.connect(g); o.start(t); o.stop(t + 0.22);
      this.env(g, t, 0.22, 0.2);
    } else {
      var s = ctx.createBufferSource(), bp = ctx.createBiquadFilter();
      s.buffer = this.noise; bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 2;
      s.connect(bp); bp.connect(g); s.start(t, Math.random() * 0.5, 0.1);
      this.env(g, t, 0.3, 0.09);
    }
    g.connect(this.master);
  };

  AfroGroove.prototype.talking = function (t, eighth) {
    var ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    var base = 150 + rnd(40), dur = eighth * (1.5 + rnd(2));
    lp.type = 'lowpass'; lp.frequency.value = 900;
    o.type = 'sine';
    o.frequency.setValueAtTime(base, t);
    o.frequency.linearRampToValueAtTime(base * (1.3 + Math.random() * 0.5), t + dur * 0.35);
    o.frequency.linearRampToValueAtTime(base * (0.85 + Math.random() * 0.2), t + dur);
    o.connect(lp); lp.connect(g); g.connect(this.master);
    this.env(g, t, 0.2, dur);
    o.start(t); o.stop(t + dur + 0.05);
  };

  AfroGroove.prototype.bass = function (t, semis, dur) {
    var ctx = this.ctx, o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = 55 * Math.pow(2, semis / 12);
    lp.type = 'lowpass'; lp.frequency.value = 500 + this.intensity * 500;
    o.connect(lp); lp.connect(g); g.connect(this.master);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.32, t + 0.01);
    g.gain.setTargetAtTime(0.0001, t + dur * 0.6, dur * 0.3);
    o.start(t); o.stop(t + dur + 0.3);
  };

  AfroGroove.prototype.kalimba = function (t, f) {
    var ctx = this.ctx, g = ctx.createGain();
    [[1, 1], [5.4, 0.18], [2, 0.12]].forEach(function (p) {
      var o = ctx.createOscillator(), pg = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f * p[0]; pg.gain.value = p[1];
      o.connect(pg); pg.connect(g); o.start(t); o.stop(t + 0.9);
    });
    g.connect(this.master); g.connect(this.echo);
    this.env(g, t, 0.12, 0.8);
  };

  window.AfroGroove = AfroGroove;
})();
