/*!
 * Market Rush Live - broadcast scene logic.
 * Runs inside the streaming browser: reads chat, runs votes, polls and hype, plays music,
 * and takes commands from the phone remote via the server.
 */
(function () {
  'use strict';

  var COLS = 'ABCDEFGH';
  var ARROWS = { up: '↑', down: '↓', left: '←', right: '→' };
  var DIRS = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };
  var BOT = 'Iya Oloja';
  var TIPS = [
    'Type a move like C4 right to vote', 'Most-voted move gets played', 'Type YES or NO when a level starts to predict it',
    'Spam 🔥 to fill the hype meter and start a MARKET RUSH', 'Win a vote and your name goes on the Top helpers board',
    'Baskets 🧺 break when you match next to them', 'Sweep the sand by matching on top of it', 'Match 4 for a striped fruit, 5 for a bomb'
  ];

  var root = document.getElementById('game');
  if (!root.__mr) window.MarketRush.boot();
  var game = root.__mr;
  var E = window.MarketRush.engine;
  var $ = function (id) { return document.getElementById(id); };

  var S = {
    mode: 'chat', voteMs: 12000, voteEnd: Date.now() + 12000, votes: {}, empty: 0,
    hype: 0, rushUntil: 0, leaders: {}, poll: null, versus: { chat: 0, host: 0 },
    lastMove: null, creditShown: false, pending: null, chat: [], music: { on: true, vol: 0.55, source: 'groove', url: '' }
  };

  /* ---------------- helpers ---------------- */
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function turn() {
    if (S.mode === 'chat') return 'chat';
    if (S.mode === 'host') return 'host';
    return game.cfg && game.cfg.n % 2 === 0 ? 'host' : 'chat';
  }
  function cellName(r, c) { return COLS[c] + (r + 1); }
  function canonical(r, c, r2, c2) {
    if (r2 * 8 + c2 < r * 8 + c) { var a = r, b = c; r = r2; c = c2; r2 = a; c2 = b; }
    var dir = r2 > r ? 'down' : 'right';
    return { key: r + ',' + c + ',' + dir, r: r, c: c, r2: r2, c2: c2, label: cellName(r, c) + ' ' + ARROWS[dir] };
  }
  function parseMove(text) {
    var t = text.toLowerCase().replace(/⬆️|⬆|↑/g, ' up ').replace(/⬇️|⬇|↓/g, ' down ').replace(/⬅️|⬅|←/g, ' left ').replace(/➡️|➡|→/g, ' right ');
    var m = t.match(/(?:^|[^a-z])([a-h])\s*([1-8])\s*(up|down|left|right|u|d|l|r)(?![a-z])/);
    if (!m) return null;
    var dir = { u: 'up', d: 'down', l: 'left', r: 'right' }[m[3]] || m[3];
    var r = parseInt(m[2], 10) - 1, c = COLS.indexOf(m[1].toUpperCase());
    var r2 = r + DIRS[dir][0], c2 = c + DIRS[dir][1];
    if (r2 < 0 || r2 > 7 || c2 < 0 || c2 > 7) return null;
    return canonical(r, c, r2, c2);
  }
  function addPoints(name, n) { if (name && name !== BOT) S.leaders[name] = (S.leaders[name] || 0) + n; renderLeaders(); }

  /* ---------------- board coordinates ---------------- */
  function drawCoords() {
    var wrap = root.querySelector('.mr-board-wrap');
    if (!wrap) return;
    wrap.querySelectorAll('.coord').forEach(function (e) { e.remove(); });
    var ts = game.ts;
    for (var i = 0; i < 8; i++) {
      var a = document.createElement('div'); a.className = 'coord coord-col'; a.textContent = COLS[i];
      a.style.left = (i * ts + ts / 2) + 'px'; wrap.appendChild(a);
      var b = document.createElement('div'); b.className = 'coord coord-row'; b.textContent = i + 1;
      b.style.top = (i * ts + ts / 2) + 'px'; wrap.appendChild(b);
    }
  }

  /* ---------------- UI renderers ---------------- */
  function renderMode() {
    var t = turn();
    $('mode-badge').textContent = S.mode === 'chat' ? 'CHAT PLAYS' : (S.mode === 'host' ? 'HOST PLAYS' : 'VERSUS');
    $('turn-label').textContent = t === 'chat' ? "Chat's move" : "Host's turn (chat can still predict)";
    $('versus').classList.toggle('hidden', S.mode !== 'versus');
    $('versus-score').textContent = 'Chat ' + S.versus.chat + ' : ' + S.versus.host + ' Host';
    $('howto').style.opacity = t === 'chat' ? 1 : 0.55;
  }

  function topVotes(n) {
    return Object.keys(S.votes).map(function (k) { return S.votes[k]; })
      .sort(function (a, b) { return b.count - a.count || a.at - b.at; }).slice(0, n || 3);
  }

  function renderVotes() {
    var list = topVotes(3), el = $('vote-list');
    root.querySelectorAll('.mr-voted').forEach(function (e) { e.classList.remove('mr-voted'); });
    if (!list.length) { el.innerHTML = '<li class="empty">' + (turn() === 'chat' ? 'No votes yet. Be the first!' : 'Host is playing this one') + '</li>'; return; }
    var max = list[0].count;
    el.innerHTML = list.map(function (v) {
      return '<li><span class="mv">' + esc(v.label) + '</span><span class="bar"><i style="width:' + Math.round(v.count / max * 100) + '%"></i></span>' +
        '<span class="n">' + v.count + '</span><span class="who">' + esc(v.voters.slice(0, 3).join(', ')) + '</span></li>';
    }).join('');
    var top = list[0];
    [[top.r, top.c], [top.r2, top.c2]].forEach(function (p) { var t = game.grid[p[0]][p[1]]; if (t && t.el) t.el.classList.add('mr-voted'); });
  }

  function renderChat() {
    var el = $('chat-list');
    el.innerHTML = S.chat.slice(-11).map(function (m) {
      return '<li class="' + (m.cmd ? 'cmd' : '') + '"><span class="au" style="color:' + m.color + '">' + esc(m.author) + '</span>' + esc(m.text) + '</li>';
    }).join('');
  }

  function renderLeaders() {
    var arr = Object.keys(S.leaders).map(function (k) { return [k, S.leaders[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 5);
    $('leaders').innerHTML = arr.length ? arr.map(function (x, i) { return '<li><span>' + ['🥇', '🥈', '🥉', '4.', '5.'][i] + ' ' + esc(x[0]) + '</span><span>' + x[1] + '</span></li>'; }).join('')
      : '<li class="empty">Win a vote to get on the board</li>';
  }

  function renderHype() {
    var p = Math.round(S.hype);
    $('hype-fill').style.width = p + '%';
    $('hype-pct').textContent = (Date.now() < S.rushUntil ? 'RUSH!' : p + '%');
    $('hype').classList.toggle('full', p >= 80);
  }

  var bannerT = null, announceT = null;
  function banner(text, ms) {
    var b = $('banner');
    b.innerHTML = '<span>' + esc(text) + '</span>';
    b.classList.remove('hidden');
    clearTimeout(bannerT);
    bannerT = setTimeout(function () { b.classList.add('hidden'); }, ms || 2600);
  }
  function announce(text) {
    var a = $('announce');
    a.innerHTML = '<span>📣 ' + esc(text) + '</span>';
    a.classList.remove('hidden');
    clearTimeout(announceT);
    announceT = setTimeout(function () { a.classList.add('hidden'); }, 9000);
  }
  function confetti(n) {
    var box = $('confetti'), colors = ['#ffd166', '#f77f00', '#e63946', '#52b788', '#b5e48c', '#ff8fa3'];
    for (var i = 0; i < (n || 80); i++) {
      var d = document.createElement('div');
      d.className = 'cf';
      d.style.left = Math.random() * 1280 + 'px';
      d.style.background = colors[i % colors.length];
      d.style.animationDuration = (1.8 + Math.random() * 1.6) + 's';
      d.style.animationDelay = (Math.random() * 0.6) + 's';
      box.appendChild(d);
      (function (x) { setTimeout(function () { x.remove(); }, 4200); })(d);
    }
  }

  /* ---------------- chat ---------------- */
  var nameColors = ['#ffd166', '#b5e48c', '#ff8fa3', '#8ecae6', '#ffb86b', '#cdb4db', '#90e0ef'];
  function colorFor(name) { var h = 0; for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0; return nameColors[h % nameColors.length]; }

  function onChat(msg) {
    var author = (msg.author || 'viewer').slice(0, 24), text = String(msg.text || '').slice(0, 200);
    var mv = parseMove(text), isPoll = /^\s*(yes|no|y|n)\s*[!.]*\s*$/i.test(text);
    S.chat.push({ author: author, text: text, color: colorFor(author), cmd: !!mv || isPoll });
    if (S.chat.length > 60) S.chat.shift();
    S.hype += 1.5;
    var fires = (text.match(/🔥/g) || []).length;
    S.hype += Math.min(fires, 5) * 3;
    if (/!hype/i.test(text)) S.hype += 3;

    if (isPoll && S.poll && S.poll.open) {
      S.poll.answers[author] = /^\s*y/i.test(text) ? 'yes' : 'no';
      renderPoll();
    }
    if (mv && turn() === 'chat' && !game.busy) {
      var cellsOk = E.swappable(game.grid, mv.r, mv.c) && E.swappable(game.grid, mv.r2, mv.c2);
      if (cellsOk) {
        // One vote per person per round: a new vote replaces the old one.
        Object.keys(S.votes).forEach(function (k) {
          var v = S.votes[k], i = v.voters.indexOf(author);
          if (i >= 0) { v.voters.splice(i, 1); v.count--; if (!v.count) delete S.votes[k]; }
        });
        var v = S.votes[mv.key] || (S.votes[mv.key] = { key: mv.key, label: mv.label, r: mv.r, c: mv.c, r2: mv.r2, c2: mv.c2, count: 0, voters: [], at: Date.now() });
        v.count++; v.voters.push(author);
        S.hype += 2;
        renderVotes();
      }
    }
    S.hype = Math.min(100, S.hype);
    renderChat(); renderHype();
    dirty();
  }

  /* ---------------- votes ---------------- */
  function executeMove(r, c, r2, c2, by, names) {
    S.lastMove = { by: by, names: names || [] };
    S.creditShown = false;
    return game.playMove(r, c, r2, c2).then(function (ok) {
      if (by === 'chat' && names && names.length) {
        names.forEach(function (n) { addPoints(n, 1); });
        if (!ok) banner('Oops! ' + names[0] + "'s move didn't match", 1800);
      }
      dirty();
      return ok;
    });
  }

  function voteTick() {
    var now = Date.now(), t = turn();
    var left = Math.max(0, S.voteEnd - now);
    $('vote-timer').textContent = t === 'chat' ? Math.ceil(left / 1000) : '–';
    $('vote-bar-fill').style.width = (t === 'chat' ? (left / S.voteMs) * 100 : 0) + '%';
    if (t !== 'chat' || game.busy || S.pending) { if (game.busy || S.pending) S.voteEnd = Math.max(S.voteEnd, now + 1500); return; }
    if (left > 0) return;
    var top = topVotes(1)[0];
    S.voteEnd = now + S.voteMs;
    if (top) {
      S.empty = 0;
      S.votes = {};
      renderVotes();
      executeMove(top.r, top.c, top.r2, top.c2, 'chat', top.voters);
    } else {
      S.empty++;
      if (S.empty >= 2) {
        S.empty = 0;
        var moves = E.allMoves(game.grid);
        if (moves.length) {
          var m = moves[Math.floor(Math.random() * moves.length)];
          banner(BOT + ' plays while chat is quiet', 1800);
          executeMove(m[0][0], m[0][1], m[1][0], m[1][1], 'bot', [BOT]);
        }
      }
    }
  }

  /* ---------------- polls ---------------- */
  function openPoll(n) {
    S.poll = { n: n, open: true, answers: {}, closes: Date.now() + 25000 };
    $('poll-q').textContent = 'Will ' + (turn() === 'chat' ? 'chat' : 'the host') + ' clear level ' + n + '?';
    $('poll').classList.remove('hidden');
    renderPoll();
  }
  function renderPoll() {
    if (!S.poll) return;
    var y = 0, n = 0;
    Object.keys(S.poll.answers).forEach(function (k) { if (S.poll.answers[k] === 'yes') y++; else n++; });
    $('poll-yes').textContent = 'YES ' + y;
    $('poll-no').textContent = 'NO ' + n;
    var secs = Math.max(0, Math.ceil((S.poll.closes - Date.now()) / 1000));
    $('poll-timer').textContent = S.poll.open ? '(' + secs + 's)' : '(closed)';
  }
  function pollTick() {
    if (!S.poll) return;
    if (S.poll.open && Date.now() >= S.poll.closes) { S.poll.open = false; setTimeout(function () { $('poll').classList.add('hidden'); }, 1500); }
    renderPoll();
  }
  function resolvePoll(won) {
    if (!S.poll) return;
    var names = Object.keys(S.poll.answers), right = names.filter(function (k) { return (S.poll.answers[k] === 'yes') === won; });
    right.forEach(function (k) { addPoints(k, 1); });
    S.poll.open = false;
    $('poll').classList.add('hidden');
    S.poll = null;
    return names.length ? Math.round(right.length / names.length * 100) : null;
  }

  /* ---------------- hype & rush ---------------- */
  function hypeTick() {
    var now = Date.now();
    if (now < S.rushUntil) { renderHype(); return; }
    if (game.mult !== 1) {
      game.mult = 1; groove.setIntensity(0); $('stage').classList.remove('rushing');
    }
    if (S.hype >= 100) return startRush();
    S.hype = Math.max(0, S.hype - 0.6);
    renderHype();
  }
  function startRush() {
    S.hype = 0;
    S.rushUntil = Date.now() + 20000;
    game.mult = 2;
    groove.setIntensity(1);
    $('stage').classList.add('rushing');
    var r = $('rush'); r.classList.remove('hidden'); r.style.animation = 'none'; void r.offsetWidth; r.style.animation = '';
    setTimeout(function () { r.classList.add('hidden'); }, 1700);
    confetti(120);
    renderHype();
  }

  /* ---------------- game events ---------------- */
  root.addEventListener('mr:level', function (e) {
    S.votes = {}; S.voteEnd = Date.now() + S.voteMs; S.empty = 0; S.pending = null;
    renderVotes(); renderMode(); drawCoords();
    openPoll(e.detail.n);
    dirty();
  });
  root.addEventListener('mr:clear', function (e) {
    var d = e.detail, lm = S.lastMove;
    if (lm && lm.by === 'chat' && !S.creditShown && (d.specials || d.blasts || d.combo >= 3)) {
      S.creditShown = true;
      banner(lm.names[0] + "'s move " + (d.blasts ? 'set off a blast! 💥' : d.combo >= 3 ? 'started a cascade!' : 'made a special fruit! ✨'));
      addPoints(lm.names[0], 2);
    }
    dirty();
  });
  function afterLevel(won, d) {
    var player = turn();
    var pct = resolvePoll(won);
    if (S.mode === 'versus' && won) S.versus[player]++;
    renderMode();
    if (won) confetti(90);
    var msg = won ? 'Level ' + d.n + ' cleared!' : 'So close! ' + d.pct + '% done';
    if (pct !== null) msg += ' · ' + pct + '% of chat called it';
    banner(msg, 3500);
    var next = won ? (d.n >= window.MarketRush.MAX_LEVEL ? 1 : d.n + 1) : d.n, count = 9;
    clearInterval(S.pending);
    S.pending = setInterval(function () {
      count--;
      if (count <= 5 && count > 0) banner((won ? 'Next level' : 'Retry') + ' in ' + count + '…', 1100);
      if (count <= 0) { clearInterval(S.pending); S.pending = null; game.startLevel(next); }
    }, 1000);
    dirty();
  }
  root.addEventListener('mr:win', function (e) { afterLevel(true, e.detail); });
  root.addEventListener('mr:lose', function (e) { afterLevel(false, e.detail); });

  /* ---------------- music ---------------- */
  var groove = new window.AfroGroove();
  var custom = $('custom-music');
  function applyMusic() {
    var m = S.music;
    custom.volume = m.vol;
    groove.setVolume(m.vol);
    if (!m.on) { groove.stop(); custom.pause(); return; }
    if (m.source === 'custom' && m.url) {
      groove.stop();
      if (custom.getAttribute('src') !== m.url) custom.src = m.url;
      custom.play().catch(function () { /* autoplay blocked in preview */ });
    } else { custom.pause(); groove.start(); }
  }

  /* ---------------- capture mode (Mac: Chrome records its own tab) ---------------- */
  var CAPTURE = new URLSearchParams(location.search).get('capture') === '1';
  var cap = { stream: null, rec: null, ingest: null };
  function fitStage() {
    var s = window.innerWidth / 1280;
    $('stage').style.transformOrigin = '0 0';
    $('stage').style.transform = 'scale(' + s + ')';
  }
  function captureGate(show, msg) {
    var g = $('capture-gate');
    if (!g) {
      g = document.createElement('div'); g.id = 'capture-gate';
      g.innerHTML = '<div class="cg-card"><div class="cg-title">Market Rush Studio</div><div class="cg-msg"></div>' +
        '<button type="button" id="cg-btn">Start studio</button><div class="cg-small">Chrome will ask to share this tab. Choose <b>Allow</b> / <b>Share</b>.<br>Keep this window open. It can sit behind other windows, but don\'t minimise it.</div></div>';
      document.body.appendChild(g);
      $('cg-btn').onclick = startCapture;
    }
    g.querySelector('.cg-msg').textContent = msg || 'Click Start studio so this window can be sent to YouTube.';
    g.style.display = show ? 'flex' : 'none';
  }
  function startCapture() {
    navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 30, max: 30 }, width: { max: 1280 }, height: { max: 800 } }, audio: { suppressLocalAudioPlayback: true },
      preferCurrentTab: true, selfBrowserSurface: 'include', surfaceSwitching: 'exclude', monitorTypeSurfaces: 'exclude'
    }).then(function (stream) {
      cap.stream = stream;
      stream.getVideoTracks()[0].addEventListener('ended', function () {
        cap.stream = null; stopRecorder(); captureGate(true, 'Sharing stopped. Click Start studio again.'); send({ type: 'capture-lost' });
      });
      captureGate(false);
      send({ type: 'capture-ready' });
    }).catch(function () { captureGate(true, 'Sharing was not allowed. Click Start studio and choose Allow / Share.'); });
  }
  function startRecorder() {
    stopRecorder();
    if (!cap.stream) { send({ type: 'capture-lost' }); captureGate(true); return; }
    var tracks = cap.stream.getVideoTracks().slice();
    var a = cap.stream.getAudioTracks();
    tracks.push(a.length ? a[0] : groove.streamTrack());
    var types = ['video/webm;codecs=h264,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    var mime = types.filter(function (t) { return window.MediaRecorder && MediaRecorder.isTypeSupported(t); })[0];
    var token = new URLSearchParams(location.search).get('token') || '';
    var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    var ing = cap.ingest = new WebSocket(proto + '//' + location.host + '/ws?role=ingest&token=' + encodeURIComponent(token));
    ing.binaryType = 'arraybuffer';
    ing.onopen = function () {
      var rec = cap.rec = new MediaRecorder(new MediaStream(tracks), { mimeType: mime, videoBitsPerSecond: 4000000, audioBitsPerSecond: 128000 });
      var vt = cap.stream.getVideoTracks()[0];
      send({ type: 'diag', info: { mime: mime, settings: vt.getSettings ? vt.getSettings() : null, dpr: window.devicePixelRatio, inner: [innerWidth, innerHeight], ua: navigator.userAgent } });
      var n = 0, sz = 0;
      clearInterval(cap.diagT);
      cap.diagT = setInterval(function () { send({ type: 'diag', info: { chunks5s: n, kb5s: Math.round(sz / 1024), visibility: document.visibilityState, recState: rec.state } }); n = 0; sz = 0; }, 5000);
      rec.addEventListener('dataavailable', function (e) { n++; sz += e.data ? e.data.size : 0; });
      rec.ondataavailable = function (e) {
        if (e.data && e.data.size && ing.readyState === 1) e.data.arrayBuffer().then(function (b) { if (ing.readyState === 1) ing.send(b); });
      };
      rec.start(250);
    };
  }
  function stopRecorder() {
    clearInterval(cap.diagT);
    if (cap.rec) { try { cap.rec.stop(); } catch (e) { /* ignore */ } cap.rec = null; }
    if (cap.ingest) { var i = cap.ingest; cap.ingest = null; setTimeout(function () { try { i.close(); } catch (e) { /* ignore */ } }, 400); }
  }
  if (CAPTURE) {
    document.documentElement.classList.add('capture-mode');
    fitStage(); window.addEventListener('resize', fitStage);
    captureGate(true);
  }

  /* ---------------- server link ---------------- */
  var ws = null, isDirty = true;
  function dirty() { isDirty = true; }
  function send(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); }
  function stateMsg() {
    var g = game.grid, cells = [];
    for (var r = 0; r < 8; r++) {
      var row = [];
      for (var c = 0; c < 8; c++) {
        var t = g[r][c];
        if (E.isVoid(g, r, c)) row.push('#');
        else if (!t) row.push('');
        else if (t.crate) row.push('b' + t.hp);
        else row.push(String(t.type) + (t.special ? t.special[0] : ''));
      }
      cells.push(row);
    }
    var cfg = game.cfg;
    return {
      type: 'state', cells: cells, sand: g.sand, level: cfg.n, levelType: cfg.type, moves: game.movesLeft,
      goal: game.goalLabel(cfg, game.goalValue()), score: game.score, busy: !!game.busy, mode: S.mode, turn: turn(),
      votes: topVotes(3).map(function (v) { return { label: v.label, count: v.count }; }), hype: Math.round(S.hype),
      rush: Date.now() < S.rushUntil, versus: S.versus, music: S.music, voteMs: S.voteMs, fruits: window.MarketRush.FRUITS
    };
  }
  function onCommand(m) {
    switch (m.cmd) {
      case 'move':
        if (turn() === 'host' || m.force) executeMove(m.from[0], m.from[1], m.to[0], m.to[1], 'host', ['Host']);
        break;
      case 'mode': S.mode = m.mode; S.votes = {}; S.voteEnd = Date.now() + S.voteMs; renderMode(); renderVotes(); break;
      case 'level': clearInterval(S.pending); S.pending = null; game.startLevel(Math.max(1, Math.min(window.MarketRush.MAX_LEVEL, m.n))); break;
      case 'announce': if (m.text) announce(m.text); break;
      case 'hype': S.hype = Math.min(100, S.hype + 25); renderHype(); break;
      case 'rush': startRush(); break;
      case 'vote-window': S.voteMs = Math.max(5000, Math.min(30000, m.ms | 0)); break;
      case 'music': ['on', 'vol', 'source', 'url'].forEach(function (k) { if (m[k] !== undefined) S.music[k] = m[k]; }); applyMusic(); break;
      case 'reset-board': S.leaders = {}; S.versus = { chat: 0, host: 0 }; renderLeaders(); renderMode(); break;
    }
    dirty();
  }
  function connect() {
    var token = new URLSearchParams(location.search).get('token') || '';
    var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    try { ws = new WebSocket(proto + '//' + location.host + '/ws?role=broadcast&token=' + encodeURIComponent(token)); } catch (e) { return setTimeout(connect, 3000); }
    ws.onopen = function () { isDirty = true; if (cap.stream) send({ type: 'capture-ready' }); else if (CAPTURE) send({ type: 'capture-lost' }); };
    ws.onmessage = function (ev) {
      var m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.type === 'chat') (m.items || []).forEach(onChat);
      else if (m.type === 'cmd') onCommand(m);
      else if (m.type === 'hello') { isDirty = true; if (cap.stream) send({ type: 'capture-ready' }); }
      else if (m.type === 'capture') { if (m.on) startRecorder(); else stopRecorder(); }
    };
    ws.onclose = function () { setTimeout(connect, 2000); };
  }

  /* ---------------- boot ---------------- */
  $('ticker-text').textContent = TIPS.join('     •     ');
  renderMode(); renderChat(); renderLeaders(); renderHype();
  window.MarketRushLive = { onChat: onChat, onCommand: onCommand, state: S, game: game };
  setInterval(voteTick, 250);
  setInterval(pollTick, 500);
  setInterval(hypeTick, 1000);
  setInterval(function () { if (isDirty) { isDirty = false; send(stateMsg()); } }, 400);
  setInterval(function () { isDirty = true; }, 3000);
  applyMusic();
  game.startLevel(1);
  connect();
})();
