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
The same game as a WordPress plugin lives in `wordpress-plugin/market-rush`. Zip that folder and upload it under Plugins > Add New > Upload Plugin, then add `[market_rush]` to any page. It is excluded from the Vercel deploy via `.vercelignore`.

Note: `assets/` at the repo root and `wordpress-plugin/market-rush/assets/` are copies of the same files. Update both when you change the game.
