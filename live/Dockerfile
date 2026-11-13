# Market Rush Live: game scene + YouTube streamer + phone remote
# Build from the repo root:  docker build -f live/Dockerfile -t market-rush-live .
FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium xvfb pulseaudio ffmpeg fonts-noto-color-emoji fonts-dejavu-core ca-certificates dbus-x11 \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production CHROME_BIN=/usr/bin/chromium PORT=8080 DATA_DIR=/tmp/market-rush-live
WORKDIR /app
COPY assets ./assets
COPY live/package.json live/package-lock.json ./live/
RUN cd live && npm ci --omit=dev --no-audit --no-fund
COPY live ./live

RUN useradd -m -u 10001 streamer && chown -R streamer /app \
    && mkdir -p /tmp/runtime-streamer && chown streamer /tmp/runtime-streamer && chmod 700 /tmp/runtime-streamer
ENV XDG_RUNTIME_DIR=/tmp/runtime-streamer HOME=/home/streamer
USER streamer
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "live/server.js"]
