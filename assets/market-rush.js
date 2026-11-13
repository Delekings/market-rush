/*!
 * Market Rush - a match-3 puzzle game
 * (c) The Tech Forge Ltd. GPL-2.0-or-later.
 */
(function () {
  'use strict';

  var ROWS = 8, COLS = 8;
  var FRUITS = ['🥭', '🍍', '🌶️', '🥥', '🍌', '🍊'];
  var FRUIT_NAMES = ['mangoes', 'pineapples', 'peppers', 'coconuts', 'bananas', 'oranges'];
  var TINTS = ['#ffd166', '#b5e48c', '#ff8fa3', '#d9b48f', '#fff1a8', '#ffb86b'];
  var CHEERS = ['Nice!', 'Oshey!', 'Mad o!', 'Correct!', 'E choke!', 'Na wa!'];
  var STORE_KEY = 'marketRush.v1';
  var MAX_LEVEL = 30;

  /* ---------------- helpers ---------------- */
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function rand(n) { return Math.floor(Math.random() * n); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function K(r, c) { return r * COLS + c; }
  var nextId = 1;
  function newTile(type) { return { id: nextId++, type: type, special: null, el: null }; }

  /* ---------------- levels ---------------- */
  // Layout key:  .  normal cell     #  hole (no cell)
  //              b  basket (1 hit)  B  tied basket (2 hits)
  //              s  sand (1 sweep)  S  thick sand (2 sweeps)
  var L = {
    plain:    ['........', '........', '........', '........', '........', '........', '........', '........'],
    diamond:  ['##....##', '#......#', '........', '........', '........', '........', '#......#', '##....##'],
    cross:    ['##....##', '##....##', '........', '........', '........', '........', '##....##', '##....##'],
    holes:    ['........', '.#....#.', '........', '...##...', '...##...', '........', '.#....#.', '........'],
    hourglass:['........', '#......#', '##....##', '##....##', '##....##', '##....##', '#......#', '........'],
    zigzag:   ['#.......', '##......', '........', '.....##.', '.##.....', '........', '......##', '.......#'],
    basketPairs: ['........', '........', '........', '.bb..bb.', '.bb..bb.', '........', '........', '........'],
    basketRing:  ['........', '........', '..bbbb..', '..b..b..', '..b..b..', '..bbbb..', '........', '........'],
    basketScatter: ['........', '.b....b.', '..B..B..', '........', '........', '..B..B..', '.b....b.', '........'],
    basketCorners: ['BB....BB', 'BB....BB', '........', '........', '........', '........', '........', '........'],
    basketWall:  ['........', '........', '........', 'bb.bb.bb', 'BB.BB.BB', '........', '........', '........'],
    tiedRing:    ['........', '.BBBBBB.', '.B....B.', '.B....B.', '.B....B.', '.B....B.', '.BBBBBB.', '........'],
    basketCheck: ['........', '........', 'b.b.b.b.', '.b.b.b.b', 'b.b.b.b.', '.b.b.b.b', '........', '........'],
    sandCenter:  ['........', '........', '..ssss..', '..ssss..', '..ssss..', '..ssss..', '........', '........'],
    sandCross:   ['##....##', '#..ss..#', '..ssss..', '.ssssss.', '.ssssss.', '..ssss..', '#..ss..#', '##....##'],
    sandRing:  ['........', '.ssssss.', '.s....s.', '.s....s.', '.s....s.', '.s....s.', '.ssssss.', '........'],
    sandBaskets: ['........', '.b....b.', '..ssss..', '..sSSs..', '..sSSs..', '..ssss..', '.b....b.', '........'],
    thickDiamond:['##....##', '#.ssss.#', '.sSSSSs.', '.sS..Ss.', '.sS..Ss.', '.sSSSSs.', '#.ssss.#', '##....##'],
    sandRingBaskets: ['........', '.ssssss.', '.sb..bs.', '.s....s.', '.s....s.', '.sb..bs.', '.ssssss.', '........'],
    sandBig:    ['........', '.ssssss.', '.ssssss.', '.ssSSss.', '.ssSSss.', '.ssssss.', '.ssssss.', '........'],
    crossBaskets:['##....##', '##....##', '........', '...bb...', '...bb...', '........', '##....##', '##....##'],
    diamondBaskets: ['##....##', '#......#', '..b..b..', '........', '........', '..b..b..', '#......#', '##....##'],
    fortress:    ['........', '.BbbbbB.', '.b....b.', '........', '........', '.b....b.', '.BbbbbB.', '........'],
    market:      ['#......#', '.b.ss.b.', '.Ss..sS.', '.sBssBs.', '.sBssBs.', '.Ss..sS.', '.b.ss.b.', '#......#']
  };

  // goal: score | collect | baskets | sand. Moves and targets tuned by simulation.
  var LEVELS = [
    { goal: 'score', colors: 4, layout: 'plain', moves: 25, target: 6800 },
    { goal: 'collect', colors: 4, layout: 'plain', moves: 24, target: 71 },
    { goal: 'score', colors: 5, layout: 'diamond', moves: 24, target: 2050 },
    { goal: 'baskets', colors: 5, layout: 'basketPairs', moves: 12 },
    { goal: 'collect', colors: 5, layout: 'cross', moves: 23, target: 24 },
    { goal: 'sand', colors: 5, layout: 'sandCenter', moves: 17 },
    { goal: 'score', colors: 5, layout: 'holes', moves: 22, target: 1300 },
    { goal: 'baskets', colors: 5, layout: 'basketRing', moves: 11 },
    { goal: 'sand', colors: 6, layout: 'sandCross', moves: 33 },
    { goal: 'score', colors: 6, layout: 'hourglass', moves: 22, target: 1200 },
    { goal: 'collect', colors: 6, layout: 'basketCorners', moves: 22, target: 15 },
    { goal: 'baskets', colors: 6, layout: 'basketScatter', moves: 23 },
    { goal: 'sand', colors: 6, layout: 'sandRing', moves: 34 },
    { goal: 'score', colors: 6, layout: 'zigzag', moves: 20, target: 1050 },
    { goal: 'sand', colors: 6, layout: 'sandBaskets', moves: 23 },
    { goal: 'collect', colors: 6, layout: 'diamond', moves: 20, target: 15 },
    { goal: 'baskets', colors: 6, layout: 'basketWall', moves: 29 },
    { goal: 'sand', colors: 6, layout: 'thickDiamond', moves: 34 },
    { goal: 'score', colors: 6, layout: 'crossBaskets', moves: 20, target: 1550 },
    { goal: 'baskets', colors: 6, layout: 'tiedRing', moves: 36 },
    { goal: 'collect', colors: 6, layout: 'hourglass', moves: 20, target: 15 },
    { goal: 'sand', colors: 6, layout: 'sandRingBaskets', moves: 33 },
    { goal: 'score', colors: 6, layout: 'holes', moves: 18, target: 950 },
    { goal: 'baskets', colors: 6, layout: 'basketCheck', moves: 18 },
    { goal: 'sand', colors: 6, layout: 'sandBig', moves: 34 },
    { goal: 'collect', colors: 6, layout: 'basketWall', moves: 20, target: 19 },
    { goal: 'baskets', colors: 6, layout: 'fortress', moves: 26 },
    { goal: 'sand', colors: 6, layout: 'thickDiamond', moves: 29 },
    { goal: 'score', colors: 6, layout: 'diamondBaskets', moves: 18, target: 1650 },
    { goal: 'sand', colors: 6, layout: 'market', moves: 30 }
  ];

  function countLayout(rows) {
    var baskets = 0, sand = 0, cells = 0;
    rows.forEach(function (row) {
      for (var i = 0; i < row.length; i++) {
        var ch = row[i];
        if (ch !== '#') cells++;
        if (ch === 'b' || ch === 'B') baskets++;
        if (ch === 's') sand += 1;
        if (ch === 'S') sand += 2;
      }
    });
    return { baskets: baskets, sand: sand, cells: cells };
  }

  function levelConfig(n) {
    var d = LEVELS[n - 1] || LEVELS[LEVELS.length - 1];
    var rows = L[d.layout];
    var cnt = countLayout(rows);
    var cfg = { n: n, colors: d.colors, moves: d.moves, type: d.goal, layout: rows, target: d.target };
    if (d.goal === 'collect') cfg.fruit = (n * 2) % d.colors;
    if (d.goal === 'baskets') cfg.target = cnt.baskets;
    if (d.goal === 'sand') cfg.target = cnt.sand;
    return cfg;
  }

  /* ---------------- engine (pure grid logic) ---------------- */
  function newCrate(hp) { return { id: nextId++, type: -1, crate: true, hp: hp, special: null, el: null }; }
  function ty(t) { return t && !t.crate ? t.type : -1; }
  function isVoid(g, r, c) { return !!(g.mask && g.mask[r][c]); }
  function inB(r, c) { return r >= 0 && r < ROWS && c >= 0 && c < COLS; }

  function findGroups(g) {
    var groups = [], r, c, e, t, k, cells;
    for (r = 0; r < ROWS; r++) {
      c = 0;
      while (c < COLS) {
        t = ty(g[r][c]);
        e = c + 1;
        while (t >= 0 && e < COLS && ty(g[r][e]) === t) e++;
        if (t >= 0 && e - c >= 3) {
          cells = [];
          for (k = c; k < e; k++) cells.push([r, k]);
          groups.push({ dir: 'h', cells: cells });
        }
        c = e;
      }
    }
    for (c = 0; c < COLS; c++) {
      r = 0;
      while (r < ROWS) {
        t = ty(g[r][c]);
        e = r + 1;
        while (t >= 0 && e < ROWS && ty(g[e][c]) === t) e++;
        if (t >= 0 && e - r >= 3) {
          cells = [];
          for (k = r; k < e; k++) cells.push([k, c]);
          groups.push({ dir: 'v', cells: cells });
        }
        r = e;
      }
    }
    return groups;
  }

  function blastArea(g, special, r, c) {
    var out = [], i, j;
    if (special === 'row') { for (j = 0; j < COLS; j++) out.push([r, j]); }
    else if (special === 'col') { for (i = 0; i < ROWS; i++) out.push([i, c]); }
    else if (special === 'bomb') {
      for (i = r - 1; i <= r + 1; i++) for (j = c - 1; j <= c + 1; j++) if (inB(i, j)) out.push([i, j]);
    }
    return out.filter(function (p) { return !isVoid(g, p[0], p[1]); }).map(function (p) { return K(p[0], p[1]); });
  }

  function pickPos(cells, swapCells) {
    if (swapCells) {
      for (var s = 0; s < swapCells.length; s++)
        for (var i = 0; i < cells.length; i++)
          if (cells[i][0] === swapCells[s][0] && cells[i][1] === swapCells[s][1]) return cells[i];
    }
    return cells[Math.floor(cells.length / 2)];
  }

  function sweep(g, r, c, out) {
    if (g.sand && g.sand[r][c] > 0) { g.sand[r][c]--; out.push([r, c]); }
  }

  // Finds matches, clears tiles, makes specials, damages baskets, sweeps sand.
  // Returns null when there is nothing to clear.
  function clearStep(g, swapCells, combo) {
    var groups = findGroups(g);
    if (!groups.length) return null;
    var clear = {}, count = {}, create = {};
    groups.forEach(function (gr) {
      gr.cells.forEach(function (p) { var k = K(p[0], p[1]); clear[k] = true; count[k] = (count[k] || 0) + 1; });
    });
    groups.forEach(function (gr) {
      var len = gr.cells.length;
      if (len < 4) return;
      var p = pickPos(gr.cells, swapCells);
      create[K(p[0], p[1])] = len >= 5 ? 'bomb' : (gr.dir === 'h' ? 'col' : 'row');
    });
    Object.keys(count).forEach(function (k) { if (count[k] > 1) create[k] = 'bomb'; });

    // Chain-detonate existing specials caught in the clear.
    var queue = Object.keys(clear).map(Number), seen = {}, blasts = [];
    while (queue.length) {
      var k = queue.pop();
      if (seen[k]) continue;
      seen[k] = true;
      var r = Math.floor(k / COLS), c = k % COLS, t = g[r][c];
      if (!t || !t.special) continue;
      delete create[k];
      blasts.push({ r: r, c: c, special: t.special });
      blastArea(g, t.special, r, c).forEach(function (kk) {
        clear[kk] = true;
        if (!seen[kk]) queue.push(kk);
      });
    }

    var created = [], swept = [];
    Object.keys(create).forEach(function (k) {
      k = Number(k);
      var r = Math.floor(k / COLS), c = k % COLS, t = g[r][c];
      if (!t || t.crate) return;
      delete clear[k];
      t.special = create[k];
      created.push(t);
      sweep(g, r, c, swept);
    });

    var cleared = [], hits = {};
    Object.keys(clear).forEach(function (k) {
      k = Number(k);
      var r = Math.floor(k / COLS), c = k % COLS, t = g[r][c];
      if (!t) return;
      if (t.crate) { hits[k] = true; return; }
      cleared.push({ tile: t, r: r, c: c });
      g[r][c] = null;
      sweep(g, r, c, swept);
    });
    // Baskets next to a cleared fruit take a hit (once per step).
    cleared.forEach(function (it) {
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var rr = it.r + d[0], cc = it.c + d[1];
        if (inB(rr, cc) && g[rr][cc] && g[rr][cc].crate) hits[K(rr, cc)] = true;
      });
    });
    var crateHits = [], broken = 0;
    Object.keys(hits).forEach(function (k) {
      k = Number(k);
      var r = Math.floor(k / COLS), c = k % COLS, t = g[r][c];
      t.hp--;
      if (t.hp <= 0) { g[r][c] = null; broken++; crateHits.push({ tile: t, r: r, c: c, broken: true }); }
      else crateHits.push({ tile: t, r: r, c: c, broken: false });
    });

    var gained = cleared.length * 10 * combo + created.length * 30 + blasts.length * 40 + broken * 60 + swept.length * 20;
    return { cleared: cleared, created: created, blasts: blasts, crateHits: crateHits, broken: broken, swept: swept, gained: gained };
  }

  // Drops fruit down (sliding diagonally around baskets) and fills from the top.
  // chooser(g, r, c) returns a fruit type for new fruit.
  function gravityStep(g, chooser) {
    var spawned = [], colSpawn = [], r, c, changed = true, guard = 0, dirs;
    for (c = 0; c < COLS; c++) colSpawn.push(0);
    function emptyCell(r, c) { return inB(r, c) && !isVoid(g, r, c) && !g[r][c]; }
    function canFallStraight(r, c) {
      var rb = r + 1;
      while (rb < ROWS && isVoid(g, rb, c)) rb++;
      return rb < ROWS && !g[rb][c];
    }
    while (changed && guard++ < 400) {
      changed = false;
      for (r = ROWS - 1; r >= 0; r--) for (c = 0; c < COLS; c++) {
        if (!emptyCell(r, c)) continue;
        var rr = r - 1;
        while (rr >= 0 && (isVoid(g, rr, c) || !g[rr][c])) rr--;
        if (rr < 0) {
          var nt = newTile(chooser(g, r, c));
          colSpawn[c]++;
          nt.spawnFrom = -colSpawn[c];
          g[r][c] = nt;
          spawned.push(nt);
          changed = true;
          continue;
        }
        if (!g[rr][c].crate) { g[r][c] = g[rr][c]; g[rr][c] = null; changed = true; continue; }
        // Blocked by a basket: slide in diagonally from above-left or above-right.
        dirs = Math.random() < 0.5 ? [-1, 1] : [1, -1];
        for (var i = 0; i < 2; i++) {
          var sr = r - 1, sc = c + dirs[i];
          if (!inB(sr, sc) || isVoid(g, sr, sc)) continue;
          var src = g[sr][sc];
          if (!src || src.crate || canFallStraight(sr, sc)) continue;
          g[r][c] = src; g[sr][sc] = null; changed = true;
          break;
        }
      }
    }
    // Cells fenced in by baskets with nothing able to fall in: fruit pops up in place.
    for (r = 0; r < ROWS; r++) for (c = 0; c < COLS; c++) {
      if (!emptyCell(r, c)) continue;
      var pt = newTile(chooser(g, r, c));
      pt.spawnFrom = r;
      pt.popIn = true;
      g[r][c] = pt;
      spawned.push(pt);
    }
    return spawned;
  }

  function lineMatchAt(g, r, c) {
    var t = ty(g[r][c]);
    if (t < 0) return false;
    var h = 1, v = 1, i;
    for (i = c - 1; i >= 0 && ty(g[r][i]) === t; i--) h++;
    for (i = c + 1; i < COLS && ty(g[r][i]) === t; i++) h++;
    for (i = r - 1; i >= 0 && ty(g[i][c]) === t; i--) v++;
    for (i = r + 1; i < ROWS && ty(g[i][c]) === t; i++) v++;
    return h >= 3 || v >= 3;
  }

  function swapCells(g, r1, c1, r2, c2) { var t = g[r1][c1]; g[r1][c1] = g[r2][c2]; g[r2][c2] = t; }
  function swappable(g, r, c) { return inB(r, c) && ty(g[r][c]) >= 0; }

  function allMoves(g) {
    var out = [];
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
      [[0, 1], [1, 0]].forEach(function (d) {
        var r2 = r + d[0], c2 = c + d[1];
        if (!swappable(g, r, c) || !swappable(g, r2, c2)) return;
        swapCells(g, r, c, r2, c2);
        if (lineMatchAt(g, r, c) || lineMatchAt(g, r2, c2)) out.push([[r, c], [r2, c2]]);
        swapCells(g, r, c, r2, c2);
      });
    }
    return out;
  }

  function createBoard(cfg) {
    var rows = cfg.layout || L.plain, colors = cfg.colors, g;
    for (var attempt = 0; attempt < 200; attempt++) {
      g = []; g.mask = []; g.sand = [];
      for (var r = 0; r < ROWS; r++) {
        g.push([]); g.mask.push([]); g.sand.push([]);
        for (var c = 0; c < COLS; c++) {
          var ch = rows[r][c];
          g.mask[r].push(ch === '#');
          g.sand[r].push(ch === 's' ? 1 : (ch === 'S' ? 2 : 0));
          if (ch === '#') { g[r].push(null); continue; }
          if (ch === 'b' || ch === 'B') { g[r].push(newCrate(ch === 'B' ? 2 : 1)); continue; }
          var t, tries = 0;
          do { t = rand(colors); tries++; } while (tries < 50 && (
            (c >= 2 && ty(g[r][c - 1]) === t && ty(g[r][c - 2]) === t) ||
            (r >= 2 && ty(g[r - 1][c]) === t && ty(g[r - 2][c]) === t)));
          g[r].push(newTile(t));
        }
      }
      if (!findGroups(g).length && allMoves(g).length >= 3) return g;
    }
    return g;
  }

  function shuffleBoard(g) {
    var pos = [], tiles = [], r, c;
    for (r = 0; r < ROWS; r++) for (c = 0; c < COLS; c++) if (ty(g[r][c]) >= 0) { pos.push([r, c]); tiles.push(g[r][c]); }
    for (var attempt = 0; attempt < 200; attempt++) {
      for (var i = tiles.length - 1; i > 0; i--) { var j = rand(i + 1), x = tiles[i]; tiles[i] = tiles[j]; tiles[j] = x; }
      pos.forEach(function (p, idx) { g[p[0]][p[1]] = tiles[idx]; });
      if (!findGroups(g).length && allMoves(g).length) return true;
    }
    return false;
  }

  function remaining(g) {
    var b = 0, s = 0;
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
      if (g[r][c] && g[r][c].crate) b++;
      if (g.sand) s += g.sand[r][c];
    }
    return { baskets: b, sand: s };
  }

  var Engine = {
    ROWS: ROWS, COLS: COLS, LEVELS: LEVELS, LAYOUTS: L, levelConfig: levelConfig, findGroups: findGroups,
    clearStep: clearStep, gravityStep: gravityStep, allMoves: allMoves, createBoard: createBoard,
    shuffleBoard: shuffleBoard, swapCells: swapCells, swappable: swappable, newTile: newTile,
    isVoid: isVoid, remaining: remaining, ty: ty
  };

  if (typeof window === 'undefined') {
    if (typeof module !== 'undefined') module.exports = Engine;
    return;
  }

  /* ---------------- save ---------------- */
  function loadSave() {
    try {
      var s = JSON.parse(window.localStorage.getItem(STORE_KEY) || '{}');
      return { unlocked: s.unlocked || 1, stars: s.stars || {}, best: s.best || {}, muted: !!s.muted };
    } catch (e) { return { unlocked: 1, stars: {}, best: {}, muted: false }; }
  }
  function writeSave(s) { try { window.localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ } }

  /* ---------------- sound ---------------- */
  function Sound(game) { this.game = game; this.ctx = null; }
  Sound.prototype.tone = function (freq, dur, type, delay) {
    if (this.game.save.muted) return;
    try {
      if (!this.ctx) { var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; this.ctx = new AC(); }
      var ctx = this.ctx, t0 = ctx.currentTime + (delay || 0);
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(ctx.destination); o.start(t0); o.stop(t0 + dur + 0.02);
    } catch (e) { /* ignore */ }
  };
  Sound.prototype.pop = function (combo) { this.tone(420 * Math.pow(2, Math.min(combo - 1, 8) * 2 / 12), 0.12, 'triangle'); };
  Sound.prototype.special = function () { this.tone(660, 0.1, 'square'); this.tone(990, 0.15, 'square', 0.06); };
  Sound.prototype.boom = function () { this.tone(110, 0.25, 'sawtooth'); };
  Sound.prototype.win = function () { var s = this; [523, 659, 784, 1046].forEach(function (f, i) { s.tone(f, 0.22, 'triangle', i * 0.11); }); };
  Sound.prototype.lose = function () { var s = this; [392, 330, 262].forEach(function (f, i) { s.tone(f, 0.25, 'sine', i * 0.14); }); };
  Sound.prototype.bad = function () { this.tone(180, 0.12, 'sine'); };

  /* ---------------- game (browser) ---------------- */
  function Game(root) {
    this.root = root;
    this.assist = root.getAttribute('data-assist') !== 'off';
    this.maxW = parseInt(root.getAttribute('data-max-width'), 10) || 480;
    this.save = loadSave();
    this.sound = new Sound(this);
    this.busy = true;
    this.sel = null;
    this.grid = null;
    this.mult = 1;
    this.build();
    this.layout();
    if (root.getAttribute('data-menu') === 'off') {
      this.cfg = levelConfig(1); this.grid = createBoard(this.cfg); this.buildCells(); this.render(true);
      this.movesLeft = this.cfg.moves; this.score = 0; this.collected = 0; this.broken = 0; this.swept = 0; this.updateHud();
    } else this.showMenu();
    var self = this;
    window.addEventListener('resize', function () { self.layout(); self.render(true); });
  }

  Game.prototype.q = function (s) { return this.root.querySelector(s); };

  // Events for embedders (e.g. the live-stream studio): mr:level, mr:move, mr:clear, mr:win, mr:lose
  Game.prototype.emit = function (name, detail) {
    try { this.root.dispatchEvent(new CustomEvent('mr:' + name, { detail: detail || {} })); } catch (e) { /* ignore */ }
  };

  // Programmatic move. Resolves true if the swap made a match.
  Game.prototype.playMove = function (r1, c1, r2, c2) {
    var self = this;
    if (this.busy) return Promise.resolve(false);
    var before = this.movesLeft;
    return this.trySwap(r1, c1, r2, c2).then(function () { return self.movesLeft < before; });
  };

  Game.prototype.build = function () {
    this.root.innerHTML =
      '<div class="mr-wrap">' +
        '<div class="mr-hud">' +
          '<div class="mr-stat"><span class="mr-label">Level</span><span class="mr-val mr-level">1</span></div>' +
          '<div class="mr-goal"><div class="mr-goal-text"></div><div class="mr-bar"><div class="mr-bar-fill"></div></div></div>' +
          '<div class="mr-stat"><span class="mr-label">Moves</span><span class="mr-val mr-moves">0</span></div>' +
        '</div>' +
        '<div class="mr-board-wrap"><div class="mr-cells"></div><div class="mr-board" role="grid" aria-label="Game board"></div><div class="mr-fx"></div><div class="mr-overlay"></div></div>' +
        '<div class="mr-foot"><span class="mr-score">Score 0</span>' +
          '<span class="mr-foot-btns"><button type="button" class="mr-ghost mr-levels-btn">Levels</button>' +
          '<button type="button" class="mr-ghost mr-mute" aria-label="Toggle sound"></button></span></div>' +
      '</div>';
    this.board = this.q('.mr-board');
    this.boardWrap = this.q('.mr-board-wrap');
    this.cellsLayer = this.q('.mr-cells');
    this.fx = this.q('.mr-fx');
    this.overlay = this.q('.mr-overlay');
    var self = this;
    this.q('.mr-levels-btn').addEventListener('click', function () { if (!self.busy || self.overlay.classList.contains('mr-show')) self.showMenu(); });
    this.q('.mr-mute').addEventListener('click', function () { self.save.muted = !self.save.muted; writeSave(self.save); self.updateMute(); });
    this.updateMute();
    this.bindInput();
  };

  Game.prototype.updateMute = function () { this.q('.mr-mute').textContent = this.save.muted ? '🔇' : '🔊'; };

  Game.prototype.layout = function () {
    var avail = this.root.clientWidth || this.maxW;
    var w = Math.min(avail - 16, this.maxW);
    this.ts = Math.max(30, Math.floor(w / COLS));
    var px = this.ts * COLS;
    this.boardWrap.style.width = px + 'px';
    this.boardWrap.style.height = px + 'px';
    this.root.style.setProperty('--mr-ts', this.ts + 'px');
    this.q('.mr-wrap').style.maxWidth = (px + 24) + 'px';
    this.buildCells();
  };

  // Background cells: holes are left empty, sand is drawn on the cell.
  Game.prototype.buildCells = function () {
    if (!this.grid) return;
    var g = this.grid, ts = this.ts, html = '';
    this.cellsLayer.innerHTML = '';
    this.cellEls = [];
    for (var r = 0; r < ROWS; r++) {
      this.cellEls.push([]);
      for (var c = 0; c < COLS; c++) {
        if (isVoid(g, r, c)) { this.cellEls[r].push(null); continue; }
        var d = document.createElement('div');
        d.className = 'mr-cell' + ((r + c) % 2 ? ' mr-cell-alt' : '');
        d.style.left = (c * ts) + 'px'; d.style.top = (r * ts) + 'px';
        d.innerHTML = '<div class="mr-sand"></div>';
        this.cellsLayer.appendChild(d);
        this.cellEls[r].push(d);
        this.updateSand(r, c);
      }
    }
  };

  Game.prototype.updateSand = function (r, c) {
    var d = this.cellEls && this.cellEls[r][c];
    if (!d) return;
    var v = this.grid.sand ? this.grid.sand[r][c] : 0;
    d.classList.toggle('mr-sand1', v === 1);
    d.classList.toggle('mr-sand2', v >= 2);
  };

  Game.prototype.makeEl = function (tile) {
    var el = document.createElement('div');
    el.className = 'mr-tile';
    el.innerHTML = '<div class="mr-face"><span class="mr-fruit"></span></div>';
    tile.el = el;
    this.board.appendChild(el);
    this.look(tile);
  };

  Game.prototype.look = function (tile) {
    var face = tile.el.firstChild;
    if (tile.crate) {
      face.className = 'mr-face mr-crate' + (tile.hp >= 2 ? ' mr-crate2' : '');
      face.firstChild.textContent = '🧺';
      return;
    }
    face.style.setProperty('--mr-tint', TINTS[tile.type]);
    face.firstChild.textContent = FRUITS[tile.type];
    face.classList.remove('mr-sp-row', 'mr-sp-col', 'mr-sp-bomb');
    if (tile.special) face.classList.add('mr-sp-' + tile.special);
  };

  Game.prototype.pos = function (tile, r, c) {
    tile.el.style.transform = 'translate(' + (c * this.ts) + 'px,' + (r * this.ts) + 'px)';
  };

  Game.prototype.render = function (instant) {
    if (!this.grid) return;
    var r, c, t, spawning = [];
    if (instant) this.board.classList.add('mr-notrans');
    for (r = 0; r < ROWS; r++) for (c = 0; c < COLS; c++) {
      t = this.grid[r][c];
      if (!t) continue;
      if (!t.el) this.makeEl(t);
      if (t.spawnFrom !== undefined) {
        t.el.classList.add('mr-notrans');
        this.pos(t, t.spawnFrom, c);
        spawning.push(t);
        delete t.spawnFrom;
        if (t.popIn) { t.el.firstChild.classList.add('mr-born'); delete t.popIn; }
      }
    }
    void this.board.offsetHeight; // reflow so transitions start from spawn position
    spawning.forEach(function (s) { s.el.classList.remove('mr-notrans'); });
    for (r = 0; r < ROWS; r++) for (c = 0; c < COLS; c++) { t = this.grid[r][c]; if (t) this.pos(t, r, c); }
    if (instant) { void this.board.offsetHeight; this.board.classList.remove('mr-notrans'); }
  };

  /* ----- input ----- */
  Game.prototype.cellAt = function (e) {
    var rect = this.board.getBoundingClientRect();
    var c = Math.floor((e.clientX - rect.left) / this.ts), r = Math.floor((e.clientY - rect.top) / this.ts);
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return null;
    return [r, c];
  };

  Game.prototype.bindInput = function () {
    var self = this, drag = null;
    this.board.addEventListener('pointerdown', function (e) {
      if (self.busy) return;
      var cell = self.cellAt(e);
      if (!cell) return;
      e.preventDefault();
      self.sound.tone(1, 0.001); // unlock audio on first gesture
      drag = { r: cell[0], c: cell[1], x: e.clientX, y: e.clientY, done: false };
      try { self.board.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });
    this.board.addEventListener('pointermove', function (e) {
      if (!drag || drag.done || self.busy) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < self.ts * 0.35) return;
      drag.done = true;
      var r2 = drag.r, c2 = drag.c;
      if (Math.abs(dx) > Math.abs(dy)) c2 += dx > 0 ? 1 : -1; else r2 += dy > 0 ? 1 : -1;
      self.select(null);
      self.trySwap(drag.r, drag.c, r2, c2);
    });
    var end = function () {
      if (drag && !drag.done) self.tap(drag.r, drag.c);
      drag = null;
    };
    this.board.addEventListener('pointerup', end);
    this.board.addEventListener('pointercancel', function () { drag = null; });
  };

  Game.prototype.select = function (cell) {
    if (this.sel) { var t = this.grid[this.sel[0]][this.sel[1]]; if (t && t.el) t.el.classList.remove('mr-sel'); }
    this.sel = cell;
    if (cell) { var n = this.grid[cell[0]][cell[1]]; if (n && n.el) n.el.classList.add('mr-sel'); }
  };

  Game.prototype.shake = function (r, c) {
    var t = this.grid && this.grid[r] && this.grid[r][c];
    if (!t || !t.el) return;
    var f = t.el.firstChild;
    f.classList.remove('mr-shake'); void f.offsetWidth; f.classList.add('mr-shake');
  };

  Game.prototype.tap = function (r, c) {
    if (this.busy) return;
    if (!swappable(this.grid, r, c)) { this.shake(r, c); this.select(null); return; }
    if (this.sel) {
      var s = this.sel;
      if (s[0] === r && s[1] === c) { this.select(null); return; }
      if (Math.abs(s[0] - r) + Math.abs(s[1] - c) === 1) { this.select(null); this.trySwap(s[0], s[1], r, c); return; }
    }
    this.select([r, c]);
  };

  /* ----- hints ----- */
  Game.prototype.clearHint = function () {
    clearTimeout(this.hintT);
    var hs = this.board.querySelectorAll('.mr-hint');
    for (var i = 0; i < hs.length; i++) hs[i].classList.remove('mr-hint');
  };
  Game.prototype.armHint = function () {
    var self = this;
    this.clearHint();
    this.hintT = setTimeout(function () {
      if (self.busy) return;
      var m = allMoves(self.grid);
      if (!m.length) return;
      var mv = m[rand(m.length)];
      mv.forEach(function (p) { var t = self.grid[p[0]][p[1]]; if (t && t.el) t.el.classList.add('mr-hint'); });
    }, 6000);
  };

  /* ----- difficulty balancing ----- */
  // Gently nudges which fruit drops in, based on how the player is doing versus
  // where they "should" be at this point in the level. Never touches rewards or prices.
  Game.prototype.goalValue = function () {
    switch (this.cfg.type) {
      case 'score': return this.score;
      case 'collect': return this.collected;
      case 'baskets': return this.broken;
      default: return this.swept;
    }
  };

  Game.prototype.pickType = function (g, r, c) {
    var cfg = this.cfg, uniform = rand(cfg.colors);
    if (!this.assist || this.movesUsed < 2) return uniform;
    var expected = this.movesUsed / cfg.moves;
    var progress = clamp(this.goalValue() / cfg.target, 0, 1);
    var gap = progress - expected;
    var pHelp = clamp((-gap - 0.08) * 1.2, 0, 0.3);
    var pHard = clamp((gap - 0.15) * 1.0, 0, 0.3);
    var near = [];
    if (r + 1 < ROWS && ty(g[r + 1][c]) >= 0) near.push(g[r + 1][c].type);
    if (c > 0 && ty(g[r][c - 1]) >= 0) near.push(g[r][c - 1].type);
    if (c + 1 < COLS && ty(g[r][c + 1]) >= 0) near.push(g[r][c + 1].type);
    var x = Math.random();
    if (x < pHelp) {
      var cands = near.slice();
      if (cfg.type === 'collect') cands.push(cfg.fruit, cfg.fruit);
      if (cands.length) return cands[rand(cands.length)];
    } else if (x < pHelp + pHard) {
      var others = [];
      for (var t = 0; t < cfg.colors; t++) if (near.indexOf(t) < 0) others.push(t);
      if (others.length) return others[rand(others.length)];
    }
    return uniform;
  };

  /* ----- moves ----- */
  Game.prototype.trySwap = async function (r1, c1, r2, c2) {
    if (this.busy || !swappable(this.grid, r1, c1) || !swappable(this.grid, r2, c2)) { if (!this.busy) this.shake(r1, c1); return; }
    this.busy = true;
    this.clearHint();
    swapCells(this.grid, r1, c1, r2, c2);
    this.render();
    await wait(190);
    if (!this.engineHasMatch()) {
      this.emit('move', { valid: false, from: [r1, c1], to: [r2, c2] });
      this.sound.bad();
      swapCells(this.grid, r1, c1, r2, c2);
      this.render();
      await wait(190);
      this.busy = false;
      this.armHint();
      return;
    }
    this.movesLeft--;
    this.movesUsed++;
    this.emit('move', { valid: true, from: [r1, c1], to: [r2, c2] });
    this.updateHud();
    await this.cascade([[r2, c2], [r1, c1]]);
    this.endCheck();
  };

  Game.prototype.engineHasMatch = function () { return findGroups(this.grid).length > 0; };

  Game.prototype.cascade = async function (swapped) {
    var self = this, combo = 0;
    for (;;) {
      var info = clearStep(this.grid, combo === 0 ? swapped : null, combo + 1);
      if (!info) break;
      combo++;
      var sx = 0, sy = 0;
      info.cleared.forEach(function (it) {
        sx += it.c; sy += it.r;
        if (self.cfg.type === 'collect' && it.tile.type === self.cfg.fruit) self.collected++;
        if (it.tile.el) {
          var el = it.tile.el;
          el.firstChild.classList.add('mr-pop');
          setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 320);
        }
      });
      info.crateHits.forEach(function (h) {
        if (h.broken) {
          var el = h.tile.el;
          el.firstChild.classList.add('mr-pop');
          setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 320);
        } else { self.look(h.tile); self.shake(h.r, h.c); }
      });
      this.broken += info.broken;
      this.swept += info.swept.length;
      info.swept.forEach(function (p) { self.updateSand(p[0], p[1]); });
      info.created.forEach(function (t) {
        self.look(t);
        t.el.firstChild.classList.remove('mr-born'); void t.el.offsetWidth; t.el.firstChild.classList.add('mr-born');
      });
      info.blasts.forEach(function (b) { self.flash(b); });
      if (info.blasts.length) this.sound.boom(); else if (info.created.length) this.sound.special(); else this.sound.pop(combo);
      info.gained *= this.mult || 1;
      this.score += info.gained;
      this.emit('clear', { combo: combo, gained: info.gained, cleared: info.cleared.length, specials: info.created.length, blasts: info.blasts.length });
      var n = info.cleared.length || 1;
      this.floatText('+' + info.gained, (sx / n + 0.5) * this.ts, (sy / n + 0.5) * this.ts);
      if (combo >= 3 || info.cleared.length >= 8) this.cheer(CHEERS[rand(CHEERS.length)]);
      this.updateHud();
      await wait(240);
      gravityStep(this.grid, function (g, r, c) { return self.pickType(g, r, c); });
      this.render();
      await wait(260);
    }
    if (!allMoves(this.grid).length) {
      this.cheer('Shuffle!');
      await wait(400);
      shuffleBoard(this.grid);
      this.render();
      await wait(320);
      if (findGroups(this.grid).length) await this.cascade(null);
    }
  };

  Game.prototype.endCheck = function () {
    if (this.goalValue() >= this.cfg.target) return this.win();
    if (this.movesLeft <= 0) return this.lose();
    this.busy = false;
    this.armHint();
  };

  /* ----- effects ----- */
  Game.prototype.floatText = function (txt, x, y) {
    var d = document.createElement('div');
    d.className = 'mr-float'; d.textContent = txt;
    d.style.left = x + 'px'; d.style.top = y + 'px';
    this.fx.appendChild(d);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 900);
  };
  Game.prototype.cheer = function (txt) {
    var d = document.createElement('div');
    d.className = 'mr-cheer'; d.textContent = txt;
    this.fx.appendChild(d);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 1000);
  };
  Game.prototype.flash = function (b) {
    var d = document.createElement('div'), ts = this.ts;
    d.className = 'mr-flash';
    if (b.special === 'row') { d.style.left = '0'; d.style.top = (b.r * ts) + 'px'; d.style.width = (COLS * ts) + 'px'; d.style.height = ts + 'px'; }
    else if (b.special === 'col') { d.style.left = (b.c * ts) + 'px'; d.style.top = '0'; d.style.width = ts + 'px'; d.style.height = (ROWS * ts) + 'px'; }
    else { d.style.left = ((b.c - 1) * ts) + 'px'; d.style.top = ((b.r - 1) * ts) + 'px'; d.style.width = (3 * ts) + 'px'; d.style.height = (3 * ts) + 'px'; d.classList.add('mr-flash-bomb'); }
    this.fx.appendChild(d);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 450);
  };

  /* ----- HUD ----- */
  Game.prototype.goalLabel = function (cfg, val) {
    val = Math.min(val, cfg.target);
    if (cfg.type === 'score') return 'Score ' + val + ' / ' + cfg.target;
    if (cfg.type === 'baskets') return 'Break baskets 🧺 ' + val + ' / ' + cfg.target;
    if (cfg.type === 'sand') return 'Sweep sand 🧹 ' + val + ' / ' + cfg.target;
    return 'Collect ' + FRUITS[cfg.fruit] + ' ' + Math.min(val, cfg.target) + ' / ' + cfg.target;
  };
  Game.prototype.updateHud = function () {
    var cfg = this.cfg, v = this.goalValue();
    this.q('.mr-level').textContent = cfg.n;
    var mv = this.q('.mr-moves');
    mv.textContent = this.movesLeft;
    mv.classList.toggle('mr-low', this.movesLeft <= 3);
    this.q('.mr-goal-text').textContent = this.goalLabel(cfg, v);
    this.q('.mr-bar-fill').style.width = (clamp(v / cfg.target, 0, 1) * 100) + '%';
    this.q('.mr-score').textContent = 'Score ' + this.score;
  };

  /* ----- screens ----- */
  Game.prototype.showOverlay = function (html) {
    this.overlay.innerHTML = '<div class="mr-card">' + html + '</div>';
    this.overlay.classList.add('mr-show');
  };
  Game.prototype.hideOverlay = function () { this.overlay.classList.remove('mr-show'); };

  Game.prototype.showMenu = function () {
    this.busy = true;
    this.clearHint();
    var html = '<div class="mr-title">Market Rush</div>' +
      '<div class="mr-sub">Swap neighbouring fruits to line up 3 or more. Match 4 for a striped fruit, 5 or an L shape for a bomb. Break baskets 🧺 by matching next to them and sweep sand by matching on it.</div>' +
      '<div class="mr-levels">';
    for (var i = 1; i <= MAX_LEVEL; i++) {
      var locked = i > this.save.unlocked, st = this.save.stars[i] || 0;
      html += '<button type="button" class="mr-lvl' + (locked ? ' mr-locked' : '') + (i === this.save.unlocked ? ' mr-current' : '') + '" data-l="' + i + '"' + (locked ? ' disabled' : '') + '>' +
        '<span>' + (locked ? '🔒' : i) + '</span><small>' + (locked ? '&nbsp;' : '★★★'.slice(0, st) + '☆☆☆'.slice(0, 3 - st)) + '</small></button>';
    }
    html += '</div><button type="button" class="mr-btn mr-play">Play level ' + Math.min(this.save.unlocked, MAX_LEVEL) + '</button>';
    this.showOverlay(html);
    var self = this;
    this.overlay.querySelectorAll('.mr-lvl').forEach(function (b) {
      b.addEventListener('click', function () { self.startLevel(parseInt(b.getAttribute('data-l'), 10)); });
    });
    this.overlay.querySelector('.mr-play').addEventListener('click', function () { self.startLevel(Math.min(self.save.unlocked, MAX_LEVEL)); });
    if (!this.grid) { this.cfg = levelConfig(1); this.grid = createBoard(this.cfg); this.buildCells(); this.render(true); this.movesLeft = this.cfg.moves; this.score = 0; this.collected = 0; this.broken = 0; this.swept = 0; this.updateHud(); }
  };

  Game.prototype.startLevel = async function (n) {
    this.cfg = levelConfig(n);
    this.movesLeft = this.cfg.moves;
    this.movesUsed = 0;
    this.score = 0;
    this.collected = 0;
    this.broken = 0;
    this.swept = 0;
    this.sel = null;
    this.board.innerHTML = '';
    this.grid = createBoard(this.cfg);
    this.buildCells();
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) if (this.grid[r][c]) this.grid[r][c].spawnFrom = r - ROWS - 1;
    this.hideOverlay();
    this.updateHud();
    this.render();
    var goal = {
      score: 'Reach ' + this.cfg.target + ' points',
      collect: 'Collect ' + this.cfg.target + ' ' + FRUIT_NAMES[this.cfg.fruit],
      baskets: 'Match next to baskets to break them',
      sand: 'Match on the sand to sweep it'
    }[this.cfg.type];
    this.cheer('Level ' + n);
    this.emit('level', { n: n, type: this.cfg.type, target: this.cfg.target, moves: this.cfg.moves });
    this.floatText(goal, (COLS * this.ts) / 2, (ROWS * this.ts) * 0.62);
    await wait(500);
    this.busy = false;
    this.armHint();
  };

  Game.prototype.win = function () {
    var cfg = this.cfg, left = this.movesLeft / cfg.moves;
    var stars = left >= 0.35 ? 3 : (left >= 0.15 ? 2 : 1);
    this.save.stars[cfg.n] = Math.max(this.save.stars[cfg.n] || 0, stars);
    this.save.best[cfg.n] = Math.max(this.save.best[cfg.n] || 0, this.score);
    this.save.unlocked = Math.max(this.save.unlocked, Math.min(cfg.n + 1, MAX_LEVEL));
    writeSave(this.save);
    this.sound.win();
    this.emit('win', { n: cfg.n, stars: stars, score: this.score, movesLeft: this.movesLeft });
    var last = cfg.n >= MAX_LEVEL;
    this.showOverlay(
      '<div class="mr-title">' + (last ? 'Market cleared!' : 'Level ' + cfg.n + ' done!') + '</div>' +
      '<div class="mr-stars">' + '★★★'.slice(0, stars) + '<span class="mr-dim">' + '☆☆☆'.slice(0, 3 - stars) + '</span></div>' +
      '<div class="mr-sub">Score ' + this.score + ' · ' + this.movesLeft + ' moves to spare</div>' +
      '<div class="mr-row">' + (last ? '' : '<button type="button" class="mr-btn mr-next">Next level</button>') +
      '<button type="button" class="mr-btn mr-alt mr-replay">Replay</button></div>');
    var self = this;
    if (!last) this.overlay.querySelector('.mr-next').addEventListener('click', function () { self.startLevel(cfg.n + 1); });
    this.overlay.querySelector('.mr-replay').addEventListener('click', function () { self.startLevel(cfg.n); });
  };

  Game.prototype.lose = function () {
    var cfg = this.cfg, pct = Math.round(clamp(this.goalValue() / cfg.target, 0, 1) * 100);
    this.sound.lose();
    this.emit('lose', { n: cfg.n, pct: pct, score: this.score });
    this.showOverlay(
      '<div class="mr-title">Out of moves</div>' +
      '<div class="mr-sub">You got ' + pct + '% of the way. Give am another go!</div>' +
      '<div class="mr-row"><button type="button" class="mr-btn mr-retry">Try again</button>' +
      '<button type="button" class="mr-btn mr-alt mr-menu">Levels</button></div>');
    var self = this;
    this.overlay.querySelector('.mr-retry').addEventListener('click', function () { self.startLevel(cfg.n); });
    this.overlay.querySelector('.mr-menu').addEventListener('click', function () { self.showMenu(); });
  };

  /* ---------------- boot ---------------- */
  function boot() {
    var roots = document.querySelectorAll('.mr-root');
    for (var i = 0; i < roots.length; i++) {
      if (!roots[i].__mr) roots[i].__mr = new Game(roots[i]);
    }
  }
  window.MarketRush = { boot: boot, engine: Engine, FRUITS: FRUITS, MAX_LEVEL: MAX_LEVEL };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
