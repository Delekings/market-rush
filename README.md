# Market Rush (web version)

Static build of the Market Rush match-3 game. No build step, no server code.

## Deploy to Vercel

**Option A: GitHub (recommended, auto-deploys on every push)**
1. Create a new GitHub repo and push this folder to it.
2. On vercel.com, choose Add New > Project and import the repo.
3. Framework preset: **Other**. Leave Build Command and Output Directory empty.
4. Click Deploy.

**Option B: Vercel CLI**
```
npm i -g vercel
cd market-rush-web
vercel          # preview deploy
vercel --prod   # production deploy
```

## Embed elsewhere
Once live, you can drop it into any site (including WordPress) with:
```html
<iframe src="https://YOUR-PROJECT.vercel.app" width="100%" height="720" style="border:0;max-width:520px" title="Market Rush"></iframe>
```

## Options
In `index.html`, set `data-assist="off"` to disable difficulty balancing, or change `data-max-width` to resize the board.

## WordPress plugin
The same game as a WordPress plugin lives in `wordpress-plugin/market-rush`. Zip that folder and upload it under Plugins > Add New > Upload Plugin, then add `[market_rush]` to any page. It is excluded from the Vercel deploy via `.vercelignore`, as is `live/`.

Note: `assets/` at the repo root is the main copy of the game, used by the Vercel site and by Market Rush Live. `wordpress-plugin/market-rush/assets/` is a copy: update it when you change the game.

## Market Rush Live (stream to YouTube from your phone)

The `live/` folder is a small cloud server that runs the game, mixes in an original Afro groove,
reads your YouTube live chat so viewers can play, and streams it all to YouTube. You control it
from your phone at `/control`. No OBS or other streaming app needed.

### What viewers can do
* **Vote on moves** by typing them in chat, e.g. `C4 right` or `e5 up` (letter = column, number = row).
  Every 12 seconds (adjustable) the most-voted move is played, and voters get credit on screen.
* **Predict** each level by typing `YES` or `NO` at the start. Correct guesses earn points.
* **Fill the hype meter** by chatting and spamming 🔥. When it's full, a 20-second MARKET RUSH
  gives double points, confetti and a hotter groove.
* Climb the **Top helpers** leaderboard.

### What you can do from your phone
Go live or end the stream, switch between *Chat plays*, *I play* and *Versus* (you and chat take turns by level),
play moves by tapping the board, jump levels, show announcements, boost hype, switch music or upload your own track,
and send test chat messages to try everything before going live.

### Run it on your Mac (free, no card, no Docker)
You need Google Chrome and Node.js 18 or newer. The start file downloads FFmpeg and the Cloudflare link tool by itself.
1. Double-click **Start Market Rush Live.command**. If macOS blocks it, right-click it, choose **Open**, then **Open** again.
2. The first time, a settings file opens: set `CONTROL_PASSCODE`, add your YouTube stream key and API key if you have them, save, and press Enter in the window.
3. A **Market Rush** window opens in Chrome. Click **Start studio** and choose **Allow / Share**. Keep that window open (it can sit behind other windows, but don't minimise it).
4. The black window shows a link (also copied to your clipboard). Open it on your phone, enter your passcode, and tap **Go live**.
5. Keep the black window open while you stream (your Mac stays awake). Close it to stop everything.

How it works: Chrome records its own studio window and passes the video to FFmpeg on your Mac, which sends it to YouTube.
The phone link is a free Cloudflare quick tunnel, so it changes each time you start. Your Mac needs a steady upload of about
5 Mbps; if yours is slower, set `VIDEO_KBPS=2500` in `live/.env`.

### Cloud setup (one time, about 20 minutes)
1. **YouTube:** make sure live streaming is enabled on your channel (YouTube can take up to 24 hours to switch it on
   the first time). In the YouTube app or YouTube Studio, go to *Go live > Stream* and copy your **stream key**.
2. **YouTube API key (for chat):** in Google Cloud Console, create a project, enable **YouTube Data API v3**,
   and create an **API key**. The free quota allows roughly 2.5 to 3 hours of live chat per day at the default
   5-second refresh. Set `CHAT_POLL_MS` higher (e.g. `8000`) to stretch it.
3. **Deploy on Render:** New > Blueprint, pick this repo. Render reads `render.yaml`. Fill in:
   * `CONTROL_PASSCODE`: a passcode only you know (protects the remote)
   * `YT_STREAM_KEY`: your stream key (or type it in the remote instead)
   * `YT_API_KEY`: your API key
   Use an instance with **2 CPUs** (the blueprint asks for one). It must stay running, so a free/sleeping instance won't work.
   Any Docker host works too: `docker build -f live/Dockerfile -t market-rush-live .`
4. On your phone, open `https://YOUR-SERVICE.onrender.com/control` and enter your passcode.
   Tip: use *Add to Home Screen* so it opens like an app.

### Going live
1. In the remote, tap **Go live**. Within about 20 seconds YouTube shows the stream (with auto-start on in your stream settings).
2. Copy your live video link from YouTube, paste it under **Live chat**, and tap **Connect chat**.
3. Play, chat, announce. Tap **End stream** when you're done.

### Settings (environment variables)
| Variable | Default | What it does |
|---|---|---|
| `CONTROL_PASSCODE` | (none) | Passcode for the phone remote. Always set this. |
| `YT_STREAM_KEY` | (none) | YouTube stream key. Can also be entered in the remote. |
| `YT_API_KEY` | (none) | Enables live chat. |
| `CHAT_POLL_MS` | `5000` | How often chat is read. Higher saves API quota. |
| `VIDEO_KBPS` | `3500` | Stream bitrate. |
| `FPS` | `30` | Frames per second. |
| `X264_PRESET` | `veryfast` | Lower CPU: `superfast` or `ultrafast`. |

### Music
The built-in Afro groove (12/8 bell, shekere, talking drum, bass, kalimba) is generated live and changes sections
as it plays. It's original, so it won't trigger copyright claims. If you upload your own track, only use music you
own or have licensed: YouTube can mute or block streams that contain copyrighted songs.
