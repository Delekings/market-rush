/*!
 * Market Rush Live - streaming server.
 * Runs the game scene in a virtual screen, sends it to YouTube with FFmpeg,
 * reads YouTube live chat, and links the phone remote to the scene.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const Studio = require('./studio');
const YouTubeChat = require('./youtube-chat');

const PORT = parseInt(process.env.PORT || '8080', 10);
const PASSCODE = process.env.CONTROL_PASSCODE || '';
const DATA_DIR = process.env.DATA_DIR || '/tmp/market-rush-live';
const PUBLIC = path.join(__dirname, 'public');
const GAME_ASSETS = path.join(__dirname, '..', 'assets');
const BROADCAST_TOKEN = process.env.BROADCAST_TOKEN || crypto.randomBytes(16).toString('hex');
const MAX_MUSIC_BYTES = 40 * 1024 * 1024;

if (!PASSCODE) console.warn('[warn] CONTROL_PASSCODE is not set. Set it before deploying, or anyone can control your stream.');
fs.mkdirSync(DATA_DIR, { recursive: true });

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

let streamKey = process.env.YT_STREAM_KEY || '';
let music = null; // { file, type }
let lastState = null;
const controls = new Set();
let broadcast = null;

function checkPass(p) {
  if (!PASSCODE) return true;
  const a = Buffer.from(String(p || '')), b = Buffer.from(PASSCODE);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function sendFile(res, file, extraHeaders) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, Object.assign({ 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': 'no-cache' }, extraHeaders || {}));
    fs.createReadStream(file).pipe(res);
  });
}

function safeJoin(base, rel) {
  const p = path.normalize(path.join(base, rel));
  return p.startsWith(base + path.sep) ? p : null;
}

/* ---------------- broadcasting to clients ---------------- */
function toControls(msg) { const s = JSON.stringify(msg); controls.forEach((c) => { if (c.readyState === 1) c.send(s); }); }
function toBroadcast(msg) { if (broadcast && broadcast.readyState === 1) broadcast.send(JSON.stringify(msg)); }

let captureReady = false;
const studio = new Studio({
  port: PORT, token: BROADCAST_TOKEN, onStatus: () => pushStatus(),
  onEncoderStart: () => toBroadcast({ type: 'capture', on: true }),
  onEncoderStop: () => toBroadcast({ type: 'capture', on: false })
});
const chat = new YouTubeChat({
  apiKey: process.env.YT_API_KEY || '',
  minPollMs: parseInt(process.env.CHAT_POLL_MS || '5000', 10),
  onMessages: (items) => toBroadcast({ type: 'chat', items }),
  onStatus: () => pushStatus()
});

function status() {
  return {
    type: 'status',
    live: studio.live, since: studio.since, encoder: studio.encoder, sceneReady: !!(broadcast && broadcast.readyState === 1),
    sceneError: studio.sceneError, localMode: studio.mode === 'local', captureReady, streamKeySet: !!streamKey, chat: chat.status(), customMusic: !!music
  };
}
function pushStatus() { toControls(status()); }

/* ---------------- HTTP ---------------- */
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;

  if (p === '/healthz') { res.writeHead(200); return res.end('ok'); }
  if (p === '/' ) { res.writeHead(302, { Location: '/control' }); return res.end(); }
  if (p === '/control') return sendFile(res, path.join(PUBLIC, 'control.html'));
  if (p === '/broadcast') return sendFile(res, path.join(PUBLIC, 'broadcast.html'));
  if (p.startsWith('/live/')) { const f = safeJoin(PUBLIC, p.slice(6)); return f ? sendFile(res, f) : (res.writeHead(404), res.end()); }
  if (p.startsWith('/assets/')) { const f = safeJoin(GAME_ASSETS, p.slice(8)); return f ? sendFile(res, f) : (res.writeHead(404), res.end()); }

  if (p === '/media/music') {
    if (!music) { res.writeHead(404); return res.end(); }
    return sendFile(res, music.file, { 'Content-Type': music.type });
  }

  if (p === '/api/music' && req.method === 'POST') {
    if (!checkPass(req.headers['x-passcode'])) { res.writeHead(401); return res.end('Wrong passcode'); }
    const type = String(req.headers['content-type'] || '');
    if (!/^audio\//.test(type)) { res.writeHead(415); return res.end('Please upload an audio file'); }
    const file = path.join(DATA_DIR, 'music-upload');
    const out = fs.createWriteStream(file);
    let size = 0, aborted = false;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_MUSIC_BYTES && !aborted) { aborted = true; out.destroy(); res.writeHead(413); res.end('File too big (40 MB max)'); req.destroy(); }
    });
    req.pipe(out);
    out.on('finish', () => {
      if (aborted) return;
      music = { file, type };
      toBroadcast({ type: 'cmd', cmd: 'music', source: 'custom', url: '/media/music?v=' + Date.now(), on: true });
      pushStatus();
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}');
    });
    return;
  }

  res.writeHead(404); res.end('Not found');
});

/* ---------------- WebSockets ---------------- */
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 8 * 1024 * 1024 });

wss.on('connection', (ws, req) => {
  const q = new URL(req.url, 'http://x').searchParams;
  const role = q.get('role');

  if (role === 'broadcast') {
    if (q.get('token') !== BROADCAST_TOKEN) return ws.close(4001, 'bad token');
    if (broadcast) try { broadcast.close(); } catch (e) { /* ignore */ }
    broadcast = ws;
    ws.on('message', (data) => {
      let m; try { m = JSON.parse(data); } catch (e) { return; }
      if (m.type === 'state') { lastState = m; toControls(m); }
      else if (m.type === 'capture-ready') { captureReady = true; pushStatus(); }
      else if (m.type === 'capture-lost') { captureReady = false; pushStatus(); }
    });
    ws.on('close', () => { if (broadcast === ws) { broadcast = null; captureReady = false; } pushStatus(); });
    ws.send(JSON.stringify({ type: 'hello' }));
    pushStatus();
    return;
  }

  if (role === 'ingest') {
    if (q.get('token') !== BROADCAST_TOKEN) return ws.close(4001, 'bad token');
    ws.on('message', (data, isBinary) => { if (isBinary) studio.feed(data); });
    return;
  }

  if (role === 'control') {
    if (!checkPass(q.get('pass'))) return ws.close(4003, 'wrong passcode');
    controls.add(ws);
    ws.send(JSON.stringify(status()));
    if (lastState) ws.send(JSON.stringify(lastState));
    ws.on('message', (data) => {
      let m; try { m = JSON.parse(data); } catch (e) { return; }
      handleControl(ws, m);
    });
    ws.on('close', () => controls.delete(ws));
    return;
  }
  ws.close(4000, 'unknown role');
});

function reply(ws, msg) { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); }

async function handleControl(ws, m) {
  switch (m.type) {
    case 'set-key':
      streamKey = String(m.key || '').trim();
      pushStatus();
      break;
    case 'golive':
      if (m.key) streamKey = String(m.key).trim();
      if (!streamKey && !process.env.OUTPUT_URL) return reply(ws, { type: 'toast', level: 'error', text: 'Add your YouTube stream key first' });
      if (studio.mode === 'local' && !captureReady) return reply(ws, { type: 'toast', level: 'error', text: 'On your Mac, click "Start studio" in the Market Rush window first' });
      studio.goLive(process.env.OUTPUT_URL || ('rtmps://a.rtmps.youtube.com:443/live2/' + streamKey));
      break;
    case 'endlive':
      studio.endLive();
      break;
    case 'chat-connect':
      try { await chat.connect(String(m.video || '')); reply(ws, { type: 'toast', text: 'Chat connected' }); }
      catch (e) { reply(ws, { type: 'toast', level: 'error', text: e.message }); }
      pushStatus();
      break;
    case 'chat-disconnect':
      chat.disconnect(); pushStatus();
      break;
    case 'test-chat':
      toBroadcast({ type: 'chat', items: [{ author: String(m.author || 'Tester').slice(0, 24), text: String(m.text || '').slice(0, 200) }] });
      break;
    case 'restart-scene':
      studio.restartScene();
      break;
    case 'cmd':
      toBroadcast(Object.assign({}, m, { type: 'cmd' }));
      break;
  }
}

server.listen(PORT, () => {
  console.log('[server] listening on :' + PORT + '  phone remote: /control');
  if (process.env.SCENE !== 'off') studio.startScene();
});

function shutdown() { studio.shutdown(); process.exit(0); }
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
