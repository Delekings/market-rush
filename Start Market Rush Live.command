#!/bin/bash
# Market Rush Live: start the streaming studio on this Mac (no Docker needed).
# Double-click this file. Keep this window open while you stream; close it to stop everything.

cd "$(dirname "$0")" || exit 1
ROOT="$(pwd)"
PORT=8080

yellow() { printf "\n\033[1;33m%s\033[0m\n" "$1"; }
green()  { printf "\033[1;32m%s\033[0m\n" "$1"; }
red()    { printf "\n\033[1;31m%s\033[0m\n" "$1"; }
pause_exit() { echo; read -r -p "Press Enter to close this window." _; exit "${1:-1}"; }

clear
printf "\033[1;32m  🥭  MARKET RUSH LIVE\033[0m\n  Streaming studio for YouTube, controlled from your phone\n"

# 1. Google Chrome (shows the studio and records it)
if [ ! -d "/Applications/Google Chrome.app" ] && [ ! -d "$HOME/Applications/Google Chrome.app" ]; then
  red "Google Chrome is needed. Opening the download page; install it, then double-click this file again."
  open "https://www.google.com/chrome/"; pause_exit
fi
green "✓ Google Chrome found"

# 2. Node.js (runs the studio)
if ! command -v node >/dev/null 2>&1 && [ -s "$HOME/.nvm/nvm.sh" ]; then . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1; fi
for d in /usr/local/bin /opt/homebrew/bin "$HOME/.homebrew/bin"; do [ -x "$d/node" ] && PATH="$d:$PATH"; done
if ! command -v node >/dev/null 2>&1; then
  red "Node.js is needed. Opening the download page: install the LTS version, then double-click this file again."
  open "https://nodejs.org/en/download"; pause_exit
fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 18 ]; then
  red "Your Node.js is version $NODE_MAJOR. Version 18 or newer is needed. Opening the download page."
  open "https://nodejs.org/en/download"; pause_exit
fi
green "✓ Node.js $(node -v)"

# 3. FFmpeg (sends the video to YouTube)
FF=""
if command -v ffmpeg >/dev/null 2>&1; then FF="$(command -v ffmpeg)"; fi
if [ -z "$FF" ] && [ -x "$ROOT/bin/ffmpeg" ]; then FF="$ROOT/bin/ffmpeg"; fi
if [ -z "$FF" ]; then
  yellow "Downloading FFmpeg (one time, about 30 MB)…"
  mkdir -p "$ROOT/bin"
  [ "$(uname -m)" = "arm64" ] && A=arm64 || A=x64
  if curl -fL --progress-bar "https://github.com/eugeneware/ffmpeg-static/releases/download/b6.0/ffmpeg-darwin-$A.gz" -o "$ROOT/bin/ffmpeg.gz" \
     && gunzip -f "$ROOT/bin/ffmpeg.gz" && chmod +x "$ROOT/bin/ffmpeg" && "$ROOT/bin/ffmpeg" -version >/dev/null 2>&1; then
    FF="$ROOT/bin/ffmpeg"
  else
    rm -f "$ROOT/bin/ffmpeg" "$ROOT/bin/ffmpeg.gz"
    BREW="$(command -v brew || ls "$HOME/.homebrew/bin/brew" /usr/local/bin/brew /opt/homebrew/bin/brew 2>/dev/null | head -1)"
    if [ -n "$BREW" ]; then
      yellow "Trying Homebrew instead (this can take a while)…"
      "$BREW" install ffmpeg && FF="$("$BREW" --prefix)/bin/ffmpeg"
    fi
  fi
fi
if [ -z "$FF" ] || [ ! -x "$FF" ]; then red "Couldn't get FFmpeg. Check your internet connection and try again."; pause_exit; fi
green "✓ FFmpeg ready"

# 4. Cloudflare link tool (free, no account needed)
CF="$(command -v cloudflared || true)"
if [ -z "$CF" ]; then
  CF="$ROOT/bin/cloudflared"
  if [ ! -x "$CF" ]; then
    yellow "Downloading the free Cloudflare link tool (one time)…"
    mkdir -p "$ROOT/bin"
    [ "$(uname -m)" = "arm64" ] && PKG=cloudflared-darwin-arm64.tgz || PKG=cloudflared-darwin-amd64.tgz
    if ! curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/$PKG" -o "$ROOT/bin/cf.tgz"; then
      red "Couldn't download cloudflared. Check your internet connection and try again."; pause_exit
    fi
    tar -xzf "$ROOT/bin/cf.tgz" -C "$ROOT/bin" && rm -f "$ROOT/bin/cf.tgz"; chmod +x "$CF"
  fi
fi
green "✓ Link tool ready"

# 5. Studio code
if [ ! -d "$ROOT/live/node_modules/ws" ]; then
  yellow "Installing the studio (one time)…"
  (cd "$ROOT/live" && npm install --omit=dev --no-audit --no-fund >/tmp/mr-npm.log 2>&1) || { red "Install failed:"; tail -15 /tmp/mr-npm.log; pause_exit; }
fi

# 6. Settings
if [ ! -f "$ROOT/live/.env" ]; then
  cp "$ROOT/live/.env.example" "$ROOT/live/.env"
  yellow "First run: add your settings."
  echo "A settings file is opening in TextEdit. Change the passcode (and add your YouTube keys if you have them),"
  echo "save it (Cmd+S), close it, then come back here."
  open -e "$ROOT/live/.env"
  read -r -p "Press Enter when you've saved the settings… " _
fi
if grep -q '^CONTROL_PASSCODE=change-me' "$ROOT/live/.env"; then
  red "Please change CONTROL_PASSCODE in the settings file first (it protects your remote)."
  open -e "$ROOT/live/.env"; pause_exit
fi
green "✓ Settings found"

cleanup() {
  echo; yellow "Stopping the studio…"
  [ -n "$CF_PID" ] && kill "$CF_PID" 2>/dev/null
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null
  [ -n "$AWAKE_PID" ] && kill "$AWAKE_PID" 2>/dev/null
  sleep 1
  green "Stopped. You can close this window."
}
trap cleanup EXIT INT TERM HUP

# 7. Start the studio
if lsof -ti tcp:$PORT >/dev/null 2>&1; then
  yellow "Something is already using port $PORT (maybe an earlier studio). Closing it…"
  lsof -ti tcp:$PORT | xargs kill 2>/dev/null; sleep 1
fi
set -a; . "$ROOT/live/.env"; set +a
export STUDIO_MODE=local PORT FFMPEG_BIN="$FF" FFMPEG_VCODEC="${FFMPEG_VCODEC:-h264_videotoolbox}"
node "$ROOT/live/server.js" >/tmp/mr-server.log 2>&1 &
SERVER_PID=$!
for i in $(seq 1 30); do curl -fs "http://127.0.0.1:$PORT/healthz" >/dev/null 2>&1 && break; sleep 1; done
if ! curl -fs "http://127.0.0.1:$PORT/healthz" >/dev/null 2>&1; then red "The studio didn't start:"; tail -15 /tmp/mr-server.log; pause_exit; fi
green "✓ Studio running"

caffeinate -dimsu &
AWAKE_PID=$!

# 8. Public link for the phone remote
yellow "Creating your phone link…"
: > /tmp/mr-tunnel.log
"$CF" tunnel --no-autoupdate --url "http://127.0.0.1:$PORT" >/tmp/mr-tunnel.log 2>&1 &
CF_PID=$!
URL=""
for i in $(seq 1 45); do
  URL="$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' /tmp/mr-tunnel.log | head -1)"
  [ -n "$URL" ] && break; sleep 1
done
[ -z "$URL" ] && { red "Couldn't create the phone link. The remote still works on this Mac:"; URL="http://localhost:$PORT"; }

REMOTE="$URL/control"
echo "$REMOTE" | pbcopy
clear
printf "\033[1;32m  🥭  MARKET RUSH LIVE IS READY\033[0m\n\n"
echo "  1. A Market Rush window opened in Chrome. Click the green \"Start studio\" button in it"
echo "     and choose Allow / Share. Keep that window open (it can sit behind other windows,"
echo "     but don't minimise it)."
echo
printf "  2. Open this on your phone:\n\n     \033[1;36m%s\033[0m\n\n" "$REMOTE"
echo "     (It's copied to your clipboard. Send it to your phone with AirDrop, WhatsApp or Notes.)"
echo "     Enter your passcode, then tap Go live."
echo
echo "  The phone link changes each time you start the studio."
echo "  Keep this window open while you stream. Close it, or press Ctrl+C, to stop everything."

wait "$CF_PID"
