# SkyCast — Full-Stack Architecture

> **Prime directive:** the Frontend never talks to external weather APIs. Every request
> flows Browser → Our Backend → Provider. The API key never leaves the server.

> **Progress:** ✅ Phase 0 restructure · ✅ Phase 1 backend skeleton — next: Phase 2 provider adapters.

---

## 0) System Overview

```
┌─────────────────────────┐         ┌──────────────────────────┐         ┌─────────────────────┐
│  BROWSER (frontend/)    │  HTTP   │  OUR BACKEND (backend/)  │  HTTPS  │  EXTERNAL PROVIDERS │
│  UI · state · FX · UX   │ ──────► │  routes · cache · keys   │ ──────► │  OpenWeatherMap     │
│                         │  /api/* │  transform · fallback    │         │  Open-Meteo (B)     │
│  ❌ no API keys         │         │  ✅ holds secrets        │         │  BigDataCloud (geo) │
│  ❌ no provider calls   │ ◄────── │  ✅ rate-limit guards    │ ◄────── │                     │
└─────────────────────────┘  JSON   └──────────────────────────┘  DTO    └─────────────────────┘
```

**Deployment topology (start simple):** Express serves `/frontend` as static files and
the API on the **same origin** → no CORS, one deploy, one URL. Scale path later: static
frontend on GitHub Pages / CDN + backend on Railway/Render/Fly (set `API_BASE_URL` in
the frontend env; enable CORS allow-list).

---

## 1) FRONT-END — Responsibilities & Tech Stack

### Tech stack
| Concern | Choice | Notes |
|---|---|---|
| Framework | **None — vanilla JS (ES modules)** | The existing SkyCast UI is already built; no rewrite needed |
| Build tool (optional) | **Vite** | Dev server + proxy to backend + minified bundle. Zero-config, removable |
| Styling | Hand-written CSS (current `style.css`) | Custom properties, glassmorphism, FX keyframes |
| Testing | **Playwright** (E2E) | Skeleton, toggle, toasts, slider flows |

### The frontend OWNS
1. **UI components & layout** — hero card, hourly slider, 5-day strip, 8 metric tiles,
   chips, toasts, skeleton shimmer (all exist today; they get *split into modules*).
2. **State management** — a tiny module store (`store.js`):
   `units ('c'|'f') · lastPayload · uiState ('idle'|'loading'|'error') · recents[]`.
   `units` and `recents` persist to `localStorage`; weather data is **never** persisted
   as truth — the backend is the only source.
3. **User location handling** — `navigator.geolocation`, permission-denied UX, then it
   sends `lat/lon` **to our backend** (reverse geocoding happens server-side too).
4. **Presentation logic** — °C⇄°F conversion at render time (instant toggle, zero
   refetch), wind km/h⇄mph, sunrise/sunset clocks, date localisation.
5. **Icons & animations** — inline SVG icon set, sky/FX engine (rain, snow, stars,
   lightning), entrance animations, skeleton shimmer.
6. **Error rendering** — maps backend error **codes** (`CITY_NOT_FOUND`, `RATE_LIMITED`,
   `UPSTREAM_DOWN`) to friendly toasts with Retry; `navigator.onLine` offline banner;
   auto-retry on reconnect.
7. **The API chokepoint** — exactly one module (`api/client.js`) knows the backend
   exists. Every other module imports from it. This is the wall.

### The frontend NEVER does
- ❌ Holds or reads `OPENWEATHER_API_KEY` (or any provider key) — enforced by CSP and CI grep
- ❌ Calls `api.openweathermap.org`, `api.open-meteo.com`, or any provider host
- ❌ Knows which provider answered — it consumes one stable DTO
- ❌ Implements caching/expiry policy for weather data (UI display-cache of the last
  payload is fine for instant repaint; the *authority* is the backend)
- ❌ Handles rate limiting or provider failover

**CSP guard (defense-in-depth), served as a header by the backend:**
```
Content-Security-Policy: default-src 'self'; connect-src 'self';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src https://fonts.gstatic.com; img-src 'self' data:;
```
`connect-src 'self'` makes any direct provider call from the browser **fail at browser
level**, even if someone sneaks one into the code.

---

## 2) BACK-END — Responsibilities & Tech Stack

### Tech stack
| Concern | Choice | Notes |
|---|---|---|
| Runtime | **Node.js 20 LTS** | One language across the whole project |
| Framework | **Express 5** | Minimal, ubiquitous. (Fastify is a fine swap) |
| Validation | **Zod** | Query params & DTO shapes |
| HTTP client | native `fetch` + `AbortController` | Timeouts per provider call |
| Rate limiting | `express-rate-limit` | Per-IP; plus a daily provider-quota counter |
| Security headers | `helmet` | CSP, HSTS, no-sniff |
| Cache (start) | in-memory LRU `Map` | Zero infra. Swap to Redis later, same interface |
| Tests | **Vitest** + **Supertest** | Unit for providers/normalisers; HTTP-level for routes |
| Config | `dotenv` + strict `env.js` | Boot fails fast if a var is missing |

### The backend OWNS
1. **Secret keeping** — `OPENWEATHER_API_KEY` lives only in the server env
   (`.env` locally, platform secrets in prod). Never in git, never in a response, never logged.
2. **API routing (contract below)** — versioned under `/api/v1/*`, serves the static
   frontend on the same origin.
3. **Provider orchestration** — adapter per provider behind one interface:
   `getCurrentAndForecast(query)`. Primary OpenWeatherMap → automatic **failover to
   Open-Meteo** (circuit-breaker: after N consecutive failures, prefer backup for a
   cooldown). The frontend never knows or cares who answered.
4. **Data transformation** — every provider response is normalised into **one stable
   DTO** (the exact shape SkyCast v2 already renders — see contract in §2.1).
   Provider quirks (m/s→km/h, icon-code maps, WMO codes, 3h→daily aggregation, UV
   stitching) are absorbed **here**, not in the UI.
5. **Caching** — cache-aside pattern:
   | Key | TTL | Notes |
   |---|---|---|
   | `wx:{normalizedCity}` or `wx:{lat,#2dp},{lon,#2dp}` | **10 min** | current conditions |
   | `fc:{...same}` | **60 min** | forecast arrays |
   | `geo:{query}` / `geo:rev:{lat},{lon}` | **24 h** | geocoding is near-static |
   Responses carry `X-Cache: HIT|MISS` for debugging. This is what keeps you under
   OWM's free-tier limits: 100 users × 1 city ≈ a handful of upstream calls per hour.
6. **Rate limiting & abuse guard** — `60 req/min/IP` public limit; a global daily
   upstream-call counter that trips a "quota conserving" mode (serve stale-while-error).
7. **Error mapping** — provider failures become clean, frontend-friendly codes:
   | Upstream | Our response |
   |---|---|
   | OWM `404` | `404 { code: "CITY_NOT_FOUND" }` |
   | OWM `401` | `502 { code: "UPSTREAM_CONFIG" }` (our config problem, not user's) |
   | OWM `429` | `503 { code: "RATE_LIMITED" }` + `Retry-After` |
   | timeout / network | `504 { code: "UPSTREAM_TIMEOUT" }` after failover also fails |
   | bad query params | `400 { code: "BAD_QUERY" }` |
8. **Input validation & sanitisation** — city strings length-checked and
   control-char-stripped; `lat/lon` range-checked (`lat ∈ [-90,90]`, `lon ∈ [-180,180]`).
9. **Geocoding proxy** — city search **and** reverse geocoding (for the GPS button)
   go through `/api/v1/geocode`, hiding the geocoding provider too.

### The backend NEVER does
- ❌ Renders UI or emits HTML fragments (it serves static files at most)
- ❌ Stores user PII (no accounts in scope; `recents`/`units` stay client-side)
- ❌ Leaks provider URLs, keys, or raw provider errors to the client
- ❌ Does per-user unit conversion (that's presentation — stays in the frontend)

### 2.1) API Contract (v1)

```
GET /api/v1/weather?city=hyderabad
GET /api/v1/weather?lat=17.38&lon=78.48          (one aggregate call per view)
GET /api/v1/geocode?q=hyd                        (autocomplete / disambiguation)
GET /api/v1/health                               (uptime + provider + cache stats)
```

**`/api/v1/weather` response — the single stable DTO:**
```json
{
  "source": "openweathermap",
  "place": { "city": "Hyderabad", "country": "IN", "lat": 17.38, "lon": 78.48 },
  "current": {
    "temp": 24.7, "feelsLike": 28.3, "humidity": 88,
    "windKmh": 11.2, "pressureHpa": 1009, "visibilityKm": 9.0, "uv": 0.4,
    "description": "drizzle", "iconKey": "drizzle", "theme": "rain",
    "sunrise": "05:59", "sunset": "18:07", "localTime": "2026-09-22T22:15"
  },
  "hourly":  [{ "time": "…T23:00", "temp": 24.1, "iconKey": "cloud", "popPct": 8 }],
  "daily":   [{ "date": "2026-09-23", "min": 22.9, "max": 30.8, "iconKey": "storm", "popPct": 41 }],
  "meta":    { "cached": true, "fetchedAt": "2026-09-22T16:45:10Z" }
}
```
> Times are ISO strings in the **location's** timezone; temperatures are **°C, wind
> km/h** (metric over the wire; the frontend converts for display).
> `iconKey`/`theme` reuse SkyCast's existing icon+sky-theme vocabulary, so the current
> renderer keeps working with a near-verbatim data shim.

**Error shape (every non-2xx):**
```json
{ "error": { "code": "CITY_NOT_FOUND", "message": "We couldn't find that city." } }
```

---

## 3) File / Directory Structure

```
skycast-weather-app/
├── ARCHITECTURE.md                  ← this document
├── README.md
├── .github/
│   └── workflows/ci.yml             ← lint + tests + "no provider URLs in frontend" grep-guard
│
├── frontend/                        ← BROWSER TERRITORY (no secrets cross this line)
│   ├── index.html
│   ├── styles/
│   │   ├── base.css                 (reset, tokens, glass utility)
│   │   ├── themes.css               (sky themes per condition)
│   │   └── components.css           (hero, cards, tiles, chips, toasts, skeleton)
│   ├── public/
│   │   ├── favicon.svg
│   │   └── manifest.webmanifest     (PWA-ready later)
│   ├── js/
│   │   ├── main.js                  (boot: wire events, first load)
│   │   ├── api/
│   │   │   └── client.js            ★ THE ONLY module allowed to call the backend
│   │   ├── store/
│   │   │   ├── state.js             (current payload, uiState, pub/sub)
│   │   │   ├── units.js             (°C/°F persistence + conversion fns)
│   │   │   └── recents.js           (localStorage chips)
│   │   ├── components/
│   │   │   ├── hero.js  ├── hourly.js  ├── daily.js  ├── tiles.js
│   │   │   ├── chips.js ├── toasts.js  ├── skeleton.js └── search.js
│   │   ├── fx/
│   │   │   ├── engine.js            (theme → particle selection)
│   │   │   └── particles.js         (rain/snow/stars/clouds/fog/lightning)
│   │   └── utils/
│   │       ├── format.js            (temps, wind, visibility, clocks)
│   │       ├── icons.js             (inline SVG set)
│   │       └── errors.js            (backend code → friendly message map)
│   └── tests/
│       └── e2e/                     (Playwright specs)
│
├── backend/                         ← SERVER TERRITORY (all secrets live here)
│   ├── package.json
│   ├── .env                         (git-ignored — real keys)
│   ├── .env.example                 (committed — key NAMES only)
│   └── src/
│       ├── server.js                (http listener — entrypoint)
│       ├── app.js                   (express wiring: static + /api/v1 + middleware order)
│       ├── config/
│       │   ├── env.js               (validated env access — the only place process.env is read)
│       │   └── constants.js         (TTLs, limits, provider order)
│       ├── routes/
│       │   ├── weather.routes.js
│       │   ├── geocode.routes.js
│       │   └── health.routes.js
│       ├── controllers/
│       │   └── weather.controller.js
│       ├── services/
│       │   └── weather.service.js   (orchestration: cache → provider → fallback → DTO)
│       ├── providers/
│       │   ├── provider.interface.md (shape every adapter must return)
│       │   ├── openweather.provider.js
│       │   ├── openmeteo.provider.js
│       │   └── index.js             (registry + failover chain)
│       ├── cache/
│       │   └── memoryCache.js       (LRU + TTL — Redis drop-in later)
│       ├── middleware/
│       │   ├── rateLimit.js
│       │   ├── validate.js          (zod schemas for query params)
│       │   └── errorHandler.js      (→ uniform { error: { code, message } })
│       └── utils/
│           ├── logger.js
│           └── normalize.js         (icon maps, WMO codes, aggregations)
│
└── docs/                            (screenshots, ADRs)
```

**Migration from today's flat layout:** `index.html` → `frontend/`, `style.css` →
`frontend/styles/`, `script.js` → split across `frontend/js/*`. Nothing is rewritten —
only re-homed and modularised. `docs/screenshot-*` keep living in `docs/`.

---

## 4) Step-by-Step Development Plan

### Phase 0 — Contract & Restructure (½ day)  *no new features*
- [ ] Move existing files into `frontend/` (mapping above); verify the app still renders
- [ ] Write `ARCHITECTURE.md` + freeze the **API contract** (§2.1) — the DTO is now law
- [ ] Add `backend/.env.example`, update `.gitignore` (`.env`, `node_modules/`)
- [ ] CI: add the grep-guard — fail the build if `openweathermap|open-meteo|api\.`
      appears in `frontend/` source
- ✅ *Exit:* frontend unchanged visually; repo split; contract committed

### Phase 1 — Backend Skeleton (1 day)
- [ ] `npm init` backend; Express + helmet + CORS + morgan-lite + `/api/v1/health`
- [ ] `config/env.js` (fail-fast), `middleware/errorHandler.js` (uniform error shape)
- [ ] Serve `frontend/` as static from Express (same-origin, no CORS headaches)
- [ ] Supertest: 404 JSON shape, health returns `{"status":"ok"}`
- ✅ *Exit:* `curl localhost:3000/api/v1/health` green; frontend served by the backend

### Phase 2 — Provider Layer (1–2 days)
- [ ] `openweather.provider.js` + `openmeteo.provider.js` behind one interface
- [ ] `utils/normalize.js` — port the v2 icon maps / WMO table / aggregations (already written!)
- [ ] Timeouts via `AbortController`; unit tests with **mocked** provider responses
- ✅ *Exit:* both adapters return the DTO from fixtures; 100% mocked, no live calls in CI

### Phase 3 — Cache, Rate Limit, Weather Endpoint (1 day)
- [ ] `memoryCache.js` (LRU+TTL) + TTL table; `X-Cache` header
- [ ] `weather.service.js`: cache-aside → provider chain → failover → error mapping
- [ ] `rateLimit.js` (60/min/IP) + zod validation on all query params
- [ ] Supertest integration: HIT on 2nd call, `CITY_NOT_FOUND` on junk city, 400 on bad lat/lon
- ✅ *Exit:* `/api/v1/weather?city=…` contract-stable under failure injection

### Phase 4 — Frontend Refactor (1–2 days)
- [ ] Extract `api/client.js` (fetch wrapper: timeout, `error.code` parsing, offline check)
- [ ] Replace the v2 dual pipeline (OWM/demo) with **one** call to our API —
      provider fallback now lives server-side
- [ ] Split `script.js` into `store/`, `components/`, `fx/`, `utils/` modules
- [ ] Map backend error codes → existing toast system (add offline banner + auto-retry)
- ✅ *Exit:* pixel-identical UI, but zero provider knowledge in the browser bundle

### Phase 5 — Integration & E2E (1 day)
- [ ] Playwright suite against the Express-served app: search → hero/hourly/daily render,
      unit toggle, GPS stub, toast+retry on 404, skeleton on cold start
- [ ] Verify CSP `connect-src 'self'` blocks external calls (devtools console proof)
- [ ] Cache-behaviour test: two searches inside TTL → 1 upstream call (spy on provider module)
- ✅ *Exit:* full user journey green; separation verified mechanically

### Phase 6 — Hardening & Deploy (1 day)
- [ ] Deploy backend (Railway/Render/Fly) with secrets in platform env
- [ ] Either keep same-origin serving, **or** static frontend to Pages +
      `API_BASE_URL` env + CORS allow-list
- [ ] Redis flag behind the cache interface (off by default); CI: lint, test, grep-guard
- [ ] Optional next: PWA manifest, `/api/v1/air-quality`, server-side recents once accounts exist

**Total: ~5–7 focused days to production-grade, each phase independently shippable.**

---

## Enforcement Checklist (print this)

| Rule | Enforced by |
|---|---|
| Key only on server | `.env` git-ignored; grep-guard in CI scans frontend for `appid=` / key patterns |
| FE → providers directly | CSP `connect-src 'self'` (browser-level block) + single `api/client.js` chokepoint |
| One data shape | `providers/provider.interface.md` + normaliser unit tests are merge-blocking |
| No secret leakage in errors | `errorHandler.js` allow-lists codes; raw upstream bodies never forwarded |
| Rate-limit survival | Cache TTLs + per-IP limit + daily upstream counter |
