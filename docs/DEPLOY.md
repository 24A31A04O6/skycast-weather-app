# 🚀 Deploying SkyCast

The repo ships with everything each platform needs. **Pick ONE path** — all of them run the same thing: the Express backend, which serves the frontend and the API on a single origin.

> The architecture means there is exactly **one service** to deploy and **one secret** to set (`OPENWEATHER_API_KEY`). No CDN config, no CORS, no build step.

**After deploying, verify with the checklist at the bottom** ✅

---

## Option A — Render (has a genuinely free tier, ~5 minutes)

The repo includes a Blueprint (`render.yaml`) — Render reads it and configures everything.

1. Push the repo to GitHub (already done) and go to **https://dashboard.render.com**
2. **New → Blueprint** → select `24A31A04O6/skycast-weather-app`
3. Render detects `render.yaml` and shows the service definition. Before applying, it will **prompt you for `OPENWEATHER_API_KEY`** — paste your key ([free key here](https://home.openweathermap.org/api_keys))
4. Click **Apply** → first build takes ~2 minutes
5. Your URL appears as `https://skycast-xxxx.onrender.com`

**Free-tier note:** the service sleeps after ~15 min of inactivity; the first request afterwards takes ~30–50 s to wake. A cron ping (e.g. cron-job.org hitting `/api/v1/health` every 10 min) keeps it warm.

<details><summary>Manual setup (if you prefer not to use the Blueprint)</summary>

New → Web Service → pick the repo → **Root Directory:** `backend` · **Build:** `npm ci` · **Start:** `npm start` · **Health Check Path:** `/api/v1/health` · add env vars `NODE_ENV=production`, `OPENWEATHER_API_KEY=<your key>`
</details>

---

## Option B — Railway (~3 minutes)

The repo includes `backend/railway.json` (build/start/healthcheck config).

1. Go to **https://railway.app** → **New Project → Deploy from GitHub repo** → pick `skycast-weather-app`
2. In the service → **Settings → Root Directory**: set to `backend`
3. **Variables** tab → add:
   - `OPENWEATHER_API_KEY` = your key
   - `NODE_ENV` = `production`
4. **Settings → Networking → Generate Domain** → you get `https://…up.railway.app`
5. Railway uses `railway.json`'s healthcheck (`/api/v1/health`) automatically

> Railway requires a verified account (small one-time verification); its trial credit is generous but not unlimited-free like Render.

---

## Option C — Docker (anywhere: Fly.io, VPS, Cloud Run, your box)

```bash
docker build -t skycast .
docker run -d -p 3000:3000 -e OPENWEATHER_API_KEY=your_key skycast
# → http://localhost:3000
```

Fly.io example: `fly launch --dockerfile Dockerfile` then `fly secrets set OPENWEATHER_API_KEY=…` and `fly deploy`.

---

## ✅ Post-deploy checklist

Run these once your URL exists (replace `$URL`):

```bash
# 1. Health — status ok, providers.openweather: "configured", cache.status: "active"
curl $URL/api/v1/health

# 2. Weather contract — 200, X-Cache: MISS then HIT on repeat
curl -i "$URL/api/v1/weather?city=hyderabad" | grep -E "x-cache|HTTP/"
curl -i "$URL/api/v1/weather?city=hyderabad" | grep -i x-cache

# 3. Error contract
curl "$URL/api/v1/weather?city=xyzzy"        # → 404 CITY_NOT_FOUND

# 4. The app itself — open in a browser, search a city, toggle °C/°F
open $URL
```

What to eyeball in the UI:
- Footer says **"Live data: OpenWeatherMap"** once the key is set (it says **Open-Meteo** if the key is missing/wrong — the app still works, just key-less)
- Sky theme + particles react to the weather you search
- Chips, °F toggle, and the hourly slider all behave as in dev

## 🔐 Security notes

- The API key exists **only** in your platform's environment variables — never in git, never in the browser bundle (enforced by CI + CSP)
- Rotating the key: change it in the platform dashboard → service restarts with the new key
- The public rate limit (60 req/min/IP) and the upstream cache are already active in production; tune via env (`RATE_LIMIT_PER_MINUTE`, `CACHE_*_TTL_SECONDS` — see `backend/.env.example`)
