#!/bin/bash
# Market Rush Live: start the streaming studio on this Mac.
# Double-click this file. Keep the window open while you stream; close it to stop everything.

cd "$(dirname "$0")" || exit 1
ROOT="$(pwd)"
PORT=8080
NAME=market-rush-live

yellow() { printf "\n\033[1;33m%s\033[0m\n" "$1"; }
green()  { printf "\033[1;32m%s\033[0m\n" "$1"; }
red()    { printf "\n\033[1;31m%s\033[0m\n" "$1"; }
pause_exit() { echo; read -r -p "Press Enter to close this window." _; exit "${1:-1}"; }

clear
printf "\033[1;32m  🥭  MARKET RUSH LIVE\033[0m\n  Streaming studio for YouTube, controlled from your phone\n"

# 1. Docker Desktop
if ! command -v docker >/dev/null 2>&1; then
  red "Docker Desktop is not installed yet."
  echo "Opening the download page. Install it (choose Apple Silicon or Intel to match your Mac),"
  echo "open it once, then double-click this file again."
  open "https://www.docker.com/products/docker-desktop/"
  pause_exit
fi
if ! docker info >/dev/null 2>&1; then
  yellow "Starting Docker Desktop…"
  open -a Docker
  for i in $(seq 1 90); do docker info >/dev/null 2>&1 && break; sleep 2; done
  docker info >/dev/null 2>&1 || { red "Docker didn't start. Open Docker Desktop, wait until it says it's running, then try again."; pause_exit; }
fi
green "✓ Docker is running"

# 2. Settings
if [ ! -f "$ROOT/live/.env" ]; then
  cp "$ROOT/live/.env.example" "$ROOT/live/.env"
  yellow "First run: add your settings."
  echo "A settings file is opening in TextEdit. Fill in your passcode (and your YouTube keys if you have them),"
  echo "save it (Cmd+S), close it, then come back here."
  open -e "$ROOT/live/.env"
  read -r -p "Press Enter when you've saved the settings… " _
fi
if grep -q '^CONTROL_PASSCODE=change-me' "$ROOT/live/.env"; then
  red "Please change CONTROL_PASSCODE in the settings file first (it protects your remote)."
  open -e "$ROOT/live/.env"
  pause_exit
fi
green "✓ Settings found"

# 3. Cloudflare link tool (free, no account needed)
CF="$(command -v cloudflared || true)"
if [ -z "$CF" ]; then
  CF="$ROOT/bin/cloudflared"
  if [ ! -x "$CF" ]; then
    yellow "Downloading the free Cloudflare link tool (one time)…"
    mkdir -p "$ROOT/bin"
    ARCH="$(uname -m)"; [ "$ARCH" = "arm64" ] && PKG=cloudflared-darwin-arm64.tgz || PKG=cloudflared-darwin-amd64.tgz
    if ! curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/$PKG" -o "$ROOT/bin/cf.tgz"; then
      red "Couldn't download cloudflared. Check your internet, or install it with: brew install cloudflared"
      pause_exit
    fi
    tar -xzf "$ROOT/bin/cf.tgz" -C "$ROOT/bin" && rm -f "$ROOT/bin/cf.tgz"
    chmod +x "$CF"
  fi
fi
green "✓ Link tool ready"

# 4. Build and start the studio
yellow "Preparing the studio (the first time takes 5-10 minutes)…"
if ! docker build -q -f live/Dockerfile -t "$NAME" . >/tmp/mr-build.log 2>&1; then
  red "The studio failed to build. Details:"; tail -20 /tmp/mr-build.log; pause_exit
fi
docker rm -f "$NAME" >/dev/null 2>&1
if ! docker run -d --name "$NAME" --env-file "$ROOT/live/.env" -p "127.0.0.1:$PORT:8080" --shm-size=1g "$NAME" >/dev/null; then
  red "The studio failed to start. Is something else using port $PORT?"; pause_exit
fi
for i in $(seq 1 60); do curl -fs "http://127.0.0.1:$PORT/healthz" >/dev/null 2>&1 && break; sleep 1; done
green "✓ Studio running"

cleanup() {
  echo; yellow "Stopping the studio…"
  [ -n "$CF_PID" ] && kill "$CF_PID" 2>/dev/null
  [ -n "$AWAKE_PID" ] && kill "$AWAKE_PID" 2>/dev/null
  docker stop "$NAME" >/dev/null 2>&1
  green "Stopped. You can close this window."
}
trap cleanup EXIT INT TERM HUP

# Keep the Mac awake while this window is open
caffeinate -dimsu &
AWAKE_PID=$!

# 5. Public link for the phone remote
yellow "Creating your phone link…"
: > /tmp/mr-tunnel.log
"$CF" tunnel --no-autoupdate --url "http://127.0.0.1:$PORT" >/tmp/mr-tunnel.log 2>&1 &
CF_PID=$!
URL=""
for i in $(seq 1 45); do
  URL="$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' /tmp/mr-tunnel.log | head -1)"
  [ -n "$URL" ] && break; sleep 1
done
if [ -z "$URL" ]; then
  red "Couldn't create the phone link. You can still use the remote on this Mac:"
  URL="http://localhost:$PORT"
fi

REMOTE="$URL/control"
echo "$REMOTE" | pbcopy
clear
printf "\033[1;32m  🥭  MARKET RUSH LIVE IS READY\033[0m\n\n"
printf "  Open this on your phone:\n\n     \033[1;36m%s\033[0m\n\n" "$REMOTE"
echo "  (It's copied to your clipboard. Send it to your phone with AirDrop, WhatsApp or Notes.)"
echo "  Enter your passcode, then tap Go live."
echo
echo "  The link changes each time you start the studio."
echo "  Keep this window open while you stream. Close it, or press Ctrl+C, to stop everything."
open "$REMOTE"

wait "$CF_PID"
