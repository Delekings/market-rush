/*!
 * Studio: a virtual screen (Xvfb) + virtual sound card (PulseAudio) + browser showing the
 * broadcast scene, and FFmpeg to send that screen and sound to YouTube.
 */
'use strict';

const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const W = parseInt(process.env.WIDTH || '1280', 10);
const H = parseInt(process.env.HEIGHT || '720', 10);
const FPS = parseInt(process.env.FPS || '30', 10);
const VIDEO_KBPS = parseInt(process.env.VIDEO_KBPS || '3500', 10);
const PRESET = process.env.X264_PRESET || 'veryfast';
const DISPLAY = process.env.STUDIO_DISPLAY || ':99';
const SINK = 'mr_sink';
const MODE = process.env.STUDIO_MODE || 'linux';            // 'linux' (virtual screen) or 'local' (your own Chrome records itself)
const FFMPEG = process.env.FFMPEG_BIN || 'ffmpeg';
const LOCAL_PROFILE = path.join(os.tmpdir(), 'mr-studio-profile');

function findChrome() {
  const list = [process.env.CHROME_BIN, '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'];
  return list.find((p) => p && fs.existsSync(p));
}

class Studio {
  constructor(opts) {
    this.port = opts.port; this.token = opts.token; this.onStatus = opts.onStatus || (() => {});
    this.procs = {}; this.live = false; this.since = null; this.encoder = null; this.sceneError = null;
    this.wantLive = null; this.stopping = false; this.restarts = 0;
    this.mode = MODE; this.vcodec = process.env.FFMPEG_VCODEC || 'libx264';
    this.onEncoderStart = opts.onEncoderStart || (() => {}); this.onEncoderStop = opts.onEncoderStop || (() => {});
  }

  /* ----- local mode: the scene runs in the user's own Chrome and sends its video here ----- */
  startLocalScene() {
    if (process.env.LOCAL_OPEN === 'off') return;
    const url = 'http://127.0.0.1:' + this.port + '/broadcast?capture=1&token=' + this.token;
    const flags = ['--app=' + url, '--user-data-dir=' + LOCAL_PROFILE, '--window-size=1280,800', '--window-position=60,60',
      '--autoplay-policy=no-user-gesture-required', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding',
      '--disable-background-timer-throttling', '--no-first-run', '--no-default-browser-check',
      // Keep drawing (and so keep streaming) even when other windows cover the studio window.
      '--disable-features=MacWebContentsOcclusion,CalculateNativeWinOcclusion'];
    let p;
    if (process.platform === 'darwin') p = spawn('open', ['-na', 'Google Chrome', '--args'].concat(flags), { stdio: 'ignore' });
    else { const c = findChrome(); if (!c) { this.sceneError = 'Chrome not found'; return this.onStatus(); } p = spawn(c, flags, { stdio: 'ignore', detached: true }); }
    p.on('error', (e) => { this.sceneError = 'Could not open Chrome: ' + e.message; this.onStatus(); });
    this.sceneError = null;
  }

  closeLocalScene() {
    try { execFileSync('pkill', ['-f', LOCAL_PROFILE], { stdio: 'ignore' }); } catch (e) { /* not running */ }
  }

  feed(chunk) {
    const p = this.procs.ffmpeg;
    if (p && p.stdin && p.stdin.writable) p.stdin.write(chunk);
  }

  env() { return Object.assign({}, process.env, { DISPLAY, PULSE_SINK: SINK }); }

  spawnLogged(name, cmd, args, opts) {
    const p = spawn(cmd, args, Object.assign({ env: this.env(), stdio: ['ignore', 'ignore', 'pipe'] }, opts || {}));
    p.stderr.on('data', (d) => { if (name !== 'ffmpeg' && process.env.DEBUG) process.stderr.write('[' + name + '] ' + d); });
    p.on('error', (e) => { this.sceneError = name + ': ' + e.message; this.onStatus(); });
    this.procs[name] = p;
    return p;
  }

  startScene() {
    this.stopping = false;
    if (this.mode === 'local') return this.startLocalScene();
    try {
      // 1. Virtual screen
      this.spawnLogged('xvfb', 'Xvfb', [DISPLAY, '-screen', '0', W + 'x' + H + 'x24', '-nolisten', 'tcp', '-ac']);
      // 2. Virtual sound card with a silent "speaker" we can record from
      try { execFileSync('pulseaudio', ['--check']); } catch (e) {
        try { execFileSync('pulseaudio', ['-D', '--exit-idle-time=-1', '--disallow-exit', '--log-target=stderr'], { env: this.env(), stdio: 'ignore' }); }
        catch (err) { this.sceneError = 'pulseaudio failed to start'; }
      }
      setTimeout(() => {
        try {
          execFileSync('pactl', ['load-module', 'module-null-sink', 'sink_name=' + SINK, 'sink_properties=device.description=MarketRush'], { env: this.env(), stdio: 'ignore' });
        } catch (e) { /* already loaded */ }
        try { execFileSync('pactl', ['set-default-sink', SINK], { env: this.env(), stdio: 'ignore' }); } catch (e) { /* ignore */ }
        this.startBrowser();
      }, 1200);
    } catch (e) {
      this.sceneError = e.message; this.onStatus();
    }
  }

  startBrowser() {
    const chrome = findChrome();
    if (!chrome) { this.sceneError = 'No Chrome/Chromium found'; return this.onStatus(); }
    const url = 'http://127.0.0.1:' + this.port + '/broadcast?token=' + this.token;
    const args = [
      '--no-first-run', '--no-default-browser-check', '--disable-infobars', '--noerrdialogs', '--disable-translate',
      '--disable-session-crashed-bubble', '--disable-features=Translate,MediaRouter', '--autoplay-policy=no-user-gesture-required',
      '--kiosk', '--window-position=0,0', '--window-size=' + W + ',' + H, '--force-device-scale-factor=1',
      '--user-data-dir=/tmp/mr-chrome-profile', '--disable-dev-shm-usage', '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--alsa-output-device=pulse',
      '--no-sandbox', url
    ];
    const p = this.spawnLogged('chrome', chrome, args);
    p.on('exit', () => {
      if (this.stopping) return;
      this.restarts++;
      setTimeout(() => this.startBrowser(), Math.min(10000, 1000 * this.restarts));
    });
    this.sceneError = null;
    this.onStatus();
  }

  restartScene() {
    if (this.mode === 'local') { this.closeLocalScene(); return setTimeout(() => this.startLocalScene(), 1500); }
    if (this.procs.chrome) { try { this.procs.chrome.kill('SIGKILL'); } catch (e) { /* ignore */ } }
  }

  goLive(outputUrl) {
    if (this.live) return;
    this.wantLive = outputUrl;
    this.startEncoder();
  }

  startEncoder() {
    const out = this.wantLive;
    if (!out) return;
    const isFile = !/^rtmps?:\/\//.test(out);
    const local = this.mode === 'local';
    const venc = this.vcodec === 'h264_videotoolbox'
      ? ['-c:v', 'h264_videotoolbox', '-realtime', '1', '-b:v', VIDEO_KBPS + 'k', '-maxrate', VIDEO_KBPS + 'k', '-bufsize', (VIDEO_KBPS * 2) + 'k']
      : ['-c:v', 'libx264', '-preset', PRESET, '-tune', 'zerolatency', '-b:v', VIDEO_KBPS + 'k', '-maxrate', VIDEO_KBPS + 'k', '-bufsize', (VIDEO_KBPS * 2) + 'k', '-sc_threshold', '0'];
    const localArgs = [
      '-hide_banner', '-loglevel', 'error', '-stats', '-y', '-fflags', '+genpts', '-thread_queue_size', '1024', '-i', 'pipe:0',
      // The tab may be taller than 16:9 and on a Retina screen: keep the top 16:9 area, then size to the output.
      '-vf', 'crop=iw:min(ih\\,trunc(iw*9/32)*2):0:0,scale=' + W + ':' + H + ',fps=' + FPS,
      ...venc, '-pix_fmt', 'yuv420p', '-g', String(FPS * 2), '-keyint_min', String(FPS * 2),
      '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2'
    ];
    const args = local ? localArgs : [
      '-hide_banner', '-loglevel', 'error', '-stats', '-y',
      '-thread_queue_size', '1024', '-f', 'x11grab', '-draw_mouse', '0', '-video_size', W + 'x' + H, '-framerate', String(FPS), '-i', DISPLAY + '.0+0,0',
      '-thread_queue_size', '1024', '-f', 'pulse', '-i', SINK + '.monitor',
      '-c:v', 'libx264', '-preset', PRESET, '-tune', 'zerolatency', '-pix_fmt', 'yuv420p',
      '-b:v', VIDEO_KBPS + 'k', '-maxrate', VIDEO_KBPS + 'k', '-bufsize', (VIDEO_KBPS * 2) + 'k',
      '-g', String(FPS * 2), '-keyint_min', String(FPS * 2), '-sc_threshold', '0',
      '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2'
    ];
    if (process.env.MAX_SECONDS) args.push('-t', process.env.MAX_SECONDS);
    args.push('-f', isFile && /\.mp4$/.test(out) ? 'mp4' : 'flv', out);

    const p = this.spawnLogged('ffmpeg', FFMPEG, args, local ? { stdio: ['pipe', 'ignore', 'pipe'] } : undefined);
    if (p.stdin) p.stdin.on('error', () => { /* encoder closed */ });
    if (local) setTimeout(() => this.onEncoderStart(), 300);
    this.live = true; this.since = this.since || Date.now(); this.encoder = { state: 'connecting' };
    let buf = '';
    p.stderr.on('data', (d) => {
      buf = (buf + d.toString()).slice(-2000);
      const m = buf.match(/fps=\s*([\d.]+).*?bitrate=\s*([\d.]+)kbits\/s(?![\s\S]*fps=)/);
      if (m) { this.encoder = { state: 'streaming', fps: parseFloat(m[1]), kbps: Math.round(parseFloat(m[2])) }; }
      const err = buf.match(/(Connection refused|Input\/output error|Server returned [^\n]*|Error [^\n]*|Failed [^\n]*)/i);
      if (err) this.encoder = Object.assign({}, this.encoder, { lastError: err[1].slice(0, 160) });
    });
    const ticker = setInterval(() => this.onStatus(), 2000);
    p.on('exit', (code) => {
      clearInterval(ticker);
      this.procs.ffmpeg = null;
      if (local) this.onEncoderStop();
      if (/Unknown encoder|videotoolbox|Error while opening encoder/i.test(buf) && this.vcodec !== 'libx264') this.vcodec = 'libx264';
      // Some FFmpeg builds can't do encrypted RTMPS: fall back to YouTube's plain RTMP address.
      if (/Protocol not found|rtmps/i.test(buf) && this.wantLive && /^rtmps:\/\/a\.rtmps\.youtube\.com(:443)?\//.test(this.wantLive)) {
        this.wantLive = this.wantLive.replace(/^rtmps:\/\/a\.rtmps\.youtube\.com(:443)?\//, 'rtmp://a.rtmp.youtube.com/');
      }
      if (this.wantLive && !this.stopping && !process.env.MAX_SECONDS) {
        // Dropped connection: retry automatically so the stream comes back by itself.
        this.encoder = Object.assign({}, this.encoder, { state: 'reconnecting' });
        this.onStatus();
        setTimeout(() => { if (this.wantLive) this.startEncoder(); }, 3000);
      } else {
        this.live = false; this.since = null; this.encoder = null; this.wantLive = null;
        this.onStatus();
      }
    });
    this.onStatus();
  }

  endLive() {
    this.wantLive = null;
    if (this.procs.ffmpeg) this.procs.ffmpeg.kill('SIGINT');
    else { this.live = false; this.since = null; this.encoder = null; this.onStatus(); }
  }

  shutdown() {
    this.stopping = true; this.wantLive = null;
    if (this.mode === 'local') this.closeLocalScene();
    Object.values(this.procs).forEach((p) => { try { p && p.kill('SIGKILL'); } catch (e) { /* ignore */ } });
    try { execFileSync('pulseaudio', ['--kill'], { stdio: 'ignore' }); } catch (e) { /* ignore */ }
  }
}

module.exports = Studio;
