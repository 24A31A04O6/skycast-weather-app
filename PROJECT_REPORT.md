# 📋 SkyCast — Detailed Project Report

> **Repository:** https://github.com/24A31A04O6/skycast-weather-app
> **Final commit:** `9a1bfdc` · Phase 6 · main branch · all CI gates green
> **Date:** September 25, 2026

---

## 1) Executive Summary

SkyCast is a **production-grade weather dashboard** that began as a single-page vanilla-JS app and evolved, through six planned engineering phases, into a **full-stack system with absolute frontend/backend separation**:

- The **frontend** (2,142 lines, 20 files — vanilla HTML/CSS/ES-modules, zero frameworks) delivers a visually rich, animated UX: weather-reactive skies with ambient particles, glassmorphism panels, hourly & 5-day forecasts, eight metric tiles, GPS lookup, recent-city chips, and an instant °C⇄°F toggle.
- The **backend** (1,330 lines, 22 files — Node 20 / Express 5) is the sole holder of secrets and the single gateway to weather providers: it caches, rate-limits, validates, normalises two providers into one DTO, and fails over automatically.
- **Quality gates:** 49 backend tests + 8 browser E2E specs + 3 CI jobs that mechanically enforce the architecture (including a guard that fails any commit referencing providers in the browser bundle, and a CSP that makes provider calls browser-impossible).
- **Deployment artifacts** for Render (Blueprint), Railway, and Docker ship in the repo; going live is one service + one secret.

**Result:** a portfolio-ready system where "the API key never leaves the server" isn't a convention — it's enforced by code, browser policy, and CI simultaneously.

---

## 2) Project Evolution

| Stage | What happened |
|---|---|
| **v1 — Standalone app** | Vanilla HTML/CSS/JS weather app: search, current conditions, humidity/wind/feels-like, glassmorphism UI, async/await OpenWeatherMap integration with key-less Open-Meteo demo mode. |
| **v2 — UI/UX overhaul** | Production-grade redesign: dynamic atmospheric backgrounds (10 condition/day-night themes with rain, snow, stars, lightning, fog), skeleton shimmer, 24-hour slider, 5-day range bars, 8 metric tiles, GPS button, recents chips, error toasts with retry, segmented unit toggle. |
| **v3 — Full-stack re-architecture** | Phases 0–6 (below): the browser stopped calling providers entirely; all data now flows Browser → Our Backend → Provider. |

### The six phases

| Phase | Deliverable | Commit |
|---|---|---|
| 0 | `/frontend` + `/backend` restructure, frozen API contract, CI guard | `bb59dd9` |
| 1 | Express skeleton: `/api/v1/health`, uniform errors, CSP, single-origin serving | `e4ace07` |
| 2 | Provider adapters (OWM + Open-Meteo), normaliser, failover + circuit breaker (28 tests) | `126a51f` |
| 3 | Live `/api/v1/weather`: TTL cache, stale-on-error, rate limits, zod validation (49 tests) | `ef9f60f` |
| 4 | Frontend switchover: 17 ES modules, provider-free browser, CSP `'self'` | `470079b` |
| 5 | E2E suite: 8 Playwright specs wired into CI | `d0dc1a7` |
| 6 | Dockerfile, Render Blueprint, Railway config, deploy guide | `9a1bfdc` |

---

## 3) System Architecture

```
┌─────────────────────────┐         ┌──────────────────────────┐         ┌─────────────────────┐
│  BROWSER (frontend/)    │  HTTP   │  OUR BACKEND (backend/)  │  HTTPS  │  EXTERNAL PROVIDERS │
│  UI · state · FX · UX   │ ──────► │  routes · cache · keys   │ ──────► │  OpenWeatherMap ①   │
│                         │  /api/* │  transform · failover    │         │  Open-Meteo     ②   │
│  ❌ no API keys         │         │  ✅ holds secrets        │         │  BigDataCloud (geo) │
│  ❌ no provider calls   │ ◄────── │  ✅ rate-limit guards    │ ◄────── │                     │
└─────────────────────────┘  JSON   └──────────────────────────┘  DTO    └─────────────────────┘
```

**The prime directive** — the frontend never communicates with external weather APIs — is enforced by **three independent layers**:

| Layer | Mechanism |
|---|---|
| **Code** | Exactly one module (`frontend/js/api/client.js`) contains a `fetch`; it only targets same-origin `/api/v1/*` |
| **Browser** | Backend-served CSP: `connect-src 'self'` — direct provider calls are impossible at browser level (proven by an E2E probe) |
| **CI** | Grep guard over the whole `frontend/` tree (zero exemptions since Phase 4) fails on any provider URL / key pattern |

**Backend request pipeline:**

```
GET /api/v1/weather
  → helmet CSP → rate limit (60/min/IP) → zod validation (city XOR lat+lon)
  → cache-aside lookup (city lowercased · coords on a 2-dp ≈1 km grid)
      HIT  → serve (≈1.7 ms)
      MISS → provider failover chain [openweather → openmeteo]
             (circuit breaker: 3 consecutive failures → 60 s open → half-open)
      upstream failure + cached entry exists → serve STALE
  → normalised DTO + X-Cache: HIT|MISS|STALE header
```

**Why one aggregate endpoint?** A single `GET /api/v1/weather?city=…` returns *everything* the dashboard renders — current conditions, 24 h hourly, 5-day daily, UV, sun times — so one user action costs at most one upstream call (zero on a cache hit).

---

## 4) Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| Frontend UI | Vanilla HTML5 / CSS3 / ES2020+ modules | No build step, no framework lock-in; the whole UI is readable in one sitting |
| Frontend styling | Custom properties, `backdrop-filter` glass, keyframe FX, `clamp()` fluid type, `prefers-reduced-motion` support | Framework-free design system |
| Backend | Node.js 20 LTS + Express 5 | One language across the stack; minimal, ubiquitous framework |
| Validation | Zod | Declarative schemas with per-field error details |
| Rate limiting | express-rate-limit | Standard `RateLimit-*`/`Retry-After` headers |
| Security | helmet (CSP), uniform error handler, non-root Docker user | Defence in depth |
| Cache | In-memory LRU+TTL (Redis-shaped interface) | Zero infra to start; swappable in Phase 6+ |
| HTTP client | Native `fetch` + `AbortController` | Per-call timeouts, zero dependencies |
| Backend tests | Vitest + Supertest (49 tests) | Fast, fully mocked — no live API calls in CI |
| E2E | Playwright (8 specs, real Chromium) | Black-box drives the real stack; traces on failure |
| CI | GitHub Actions — 3 jobs | separation-of-concerns · backend · e2e |
| Deploy | Dockerfile · Render Blueprint · Railway config · Procfile | One service, one secret |

---

## 5) Feature Catalogue

### Frontend (user-facing)
- **Search** — city lookup with validation UX; Enter-to-search; busy states
- **GPS button** — browser geolocation → coordinates sent to the backend, which reverse-geocodes the label
- **Recent-city chips** — persisted in `localStorage`; one click = one precise lat/lon lookup; active-city highlight
- **Hero dashboard** — city + country, city-local date/time, floating condition icon, temperature, description, today's H/L
- **24-hour slider** — 24 cards (Open-Meteo) / 8 × 3-hourly (OWM): icon, temp, precipitation chance; drag-to-scroll, wheel-horizontal, touch-swipe
- **5-day strip** — min/max with gradient temperature range bars scaled to the week's span
- **8 metric tiles** — Humidity · Wind · Feels Like · UV Index (with level label) · Visibility · Pressure · Sunrise · Sunset
- **°C⇄°F toggle** — segmented control, converts instantly from cached metric data (zero refetch), persisted across visits
- **Dynamic skies** — 10 themes keyed to condition + day/night; ambient FX: rain streaks, snowfall, twinkling + shooting stars, drifting clouds, fog banks, lightning flashes, sun/moon glow — all transform/opacity-only animations
- **Loading & errors** — skeleton shimmer on cold start, dim-and-refresh on city switches (no layout shift), contextual toasts with inline Retry, offline detection with auto-retry on reconnect

### Backend (platform)
- `GET /api/v1/weather` — aggregate DTO (current + hourly + daily), cached, rate-limited, validated
- `GET /api/v1/geocode?q=…` and `/reverse` — cached 24 h
- `GET /api/v1/health` — liveness, provider chain, live cache statistics
- **Provider failover** — OpenWeatherMap primary (when keyed) → Open-Meteo backup; UV stitched from Open-Meteo in OWM mode (best-effort, degrades to `null`)
- **Circuit breaker** — 3 consecutive provider failures → 60 s cooldown → half-open retry
- **Stale-on-error** — if all providers fail but a cached entry exists (even expired), serve it rather than error
- **Uniform error contract** — every failure is `{ error: { code, message } }`; upstream bodies and stack traces never leak

---

## 6) API Contract (v1)

| Endpoint | Status | Cache TTL | Notes |
|---|---|---|---|
| `GET /api/v1/weather?city=…` | ✅ live | 10 min | one aggregate DTO per view |
| `GET /api/v1/weather?lat=&lon=` | ✅ live | 10 min | coords snap to ≈1 km grid keys |
| `GET /api/v1/geocode?q=…` | ✅ live | 24 h | city search |
| `GET /api/v1/geocode/reverse?lat=&lon=` | ✅ live | 24 h | GPS label lookup (may return `null` place) |
| `GET /api/v1/health` | ✅ live | — | providers + cache stats |

**Success DTO** (abbreviated — full shape in `ARCHITECTURE.md` §2.1):
```jsonc
{
  "source": "openweather|openmeteo",
  "place":  { "city": "Hyderabad", "country": "IN", "lat": 17.38, "lon": 78.48 },
  "current": { "temp": 26.7, "feelsLike": 28.1, "humidity": 64, "windKmh": 13.9,
               "pressureHpa": 946, "visibilityKm": 16.3, "uv": 0.2,
               "description": "overcast", "iconKey": "cloud", "theme": "cloudy",
               "sunrise": "06:05", "sunset": "18:10", "localTime": "…T20:30" },
  "hourly": [{ "time": "…T21:00", "temp": 26.0, "iconKey": "cloud", "popPct": 3 }],
  "daily":  [{ "date": "2026-09-25", "min": 24.7, "max": 30.2, "iconKey": "cloud", "popPct": 0 }],
  "meta":   { "cached": false, "fetchedAt": "…Z" }
}
```

**Error codes:** `CITY_NOT_FOUND` (404) · `BAD_QUERY` (400) · `RATE_LIMITED` (429) · `UPSTREAM_TIMEOUT` (504) · `UPSTREAM_DOWN` (502) · `UPSTREAM_CONFIG` (502) · `NOT_FOUND` (404) · `INTERNAL_ERROR` (500).

**Data rules:** metric over the wire (°C, km/h) — unit conversion is presentation-only, in the browser · times are city-local ISO strings · `iconKey`/`theme` form the shared visual vocabulary the normaliser guarantees.

---

## 7) Security Model

1. **Secret isolation** — the OWM key exists only in `backend/.env` (git-ignored) or platform secrets. Verified: no key material anywhere in the bundle; CI greps for key patterns in `frontend/`.
2. **Browser egress lockdown** — CSP `connect-src 'self'` (E2E-proven: an in-page `fetch` to a provider is blocked).
3. **Input hardening** — zod schemas: city charset/length whitelist, lat/lon range checks, mode XOR; upstream calls use `encodeURIComponent`.
4. **Error masking** — only allow-listed codes and human messages leave the server; the 500 path logs stacks server-side and returns a generic message.
5. **Abuse control** — 60 req/min/IP with standard headers; upstream quota protected by cache + breaker + stale serving. Docker image runs as non-root.

---

## 8) Performance & Resilience (measured)

| Metric | Value |
|---|---|
| Cold upstream fetch (real Open-Meteo, dev) | ≈ 1,375 ms |
| Cached response (same city, within TTL) | ≈ **1.7 ms** (≈800× faster) |
| Unit toggle repaint | 0 network calls (pure re-render from cached DTO) |
| Cache hit behaviour | verified live (`X-Cache: MISS → HIT`) and black-box in E2E |
| Stale-on-error | verified: TTL elapsed + providers down → `X-Cache: STALE`, HTTP 200 |
| Rate limiting | standard headers live; 429 contract shape tested |
| Reduced motion | all particle systems freeze via media query |

---

## 9) Quality & Testing

| Suite | Count | Scope |
|---|---|---|
| Backend — cache unit | 7 | TTL expiry (fake clocks), LRU eviction, stats, stale reads, clone-safety |
| Backend — providers + normaliser | 13 | icon/WMO vocabularies, DTO shapes, aggregation, UV stitch, error/timeout mapping, geocoding (all mocked) |
| Backend — failover | 8 | chain walk, 404 pass-through, breaker open/half-open/reset (module-mocked) |
| Backend — API integration | 21 | health, 404 shape, weather/geocode MISS→HIT→STALE, normalisation keys, validation 400s, 429 shape |
| **Backend total** | **49** | zero live calls in CI |
| E2E — journeys | 4 | cold-start skeleton, search re-render, unit toggle (0 refetch, network-counted), chips |
| E2E — resilience | 4 | toast + working Retry, cache HIT proof, mocked-geolocation GPS, network audit + CSP probe |
| **E2E total** | **8** | real Chromium against the real stack |
| CI gates | 3 | separation-of-concerns · backend · e2e — all green on every push |

**Additional verification performed during development:** live Open-Meteo smoke of the DTO contract (PASS), browser-level checks on every phase (zero console errors), manual `curl` sweeps of every endpoint and error path, Docker/config file validation.

---

## 10) Repository Map

```
skycast-weather-app/            8 commits · main
├── ARCHITECTURE.md             full blueprint: contract, policy, phases, enforcement
├── README.md                   features, quickstart, deployment
├── PROJECT_REPORT.md           ← this document
├── docs/DEPLOY.md              click-by-click Render/Railway/Docker guides + checklist
├── docs/*.png                  screenshots (desktop, mobile, °F, error toast)
├── Dockerfile · .dockerignore  production image (non-root, healthcheck)
├── render.yaml · backend/railway.json · backend/Procfile
├── .github/workflows/ci.yml    3-job pipeline
│
├── frontend/                   2,142 lines · 20 files — browser territory
│   ├── index.html              semantic shell: dashboard, skeleton, tiles, toggle
│   ├── styles/style.css        sky themes, FX keyframes, glass, responsive grid
│   └── js/                     17 ES modules
│       ├── main.js             entrypoint/orchestration
│       ├── api/client.js       ★ the only module that talks to a server
│       ├── store/              units · recents · volatile state
│       ├── components/         hero · hourly · daily · tiles · chips · toasts · skeleton · search
│       ├── fx/                 sky/particle engine
│       └── utils/              format (°C⇄°F, clocks) · icons · error hints
│
├── backend/                    1,330 lines · 22 files — server territory
│   ├── .env.example            key NAMES only (real .env git-ignored)
│   └── src/
│       ├── server.js · app.js  entrypoint + middleware wiring
│       ├── config/             env.js (validated, frozen) · constants.js
│       ├── routes/             weather · geocode · health (+ index)
│       ├── controllers/        thin HTTP adapters
│       ├── services/           weather.service.js — cache-aside orchestration
│       ├── providers/          openweather · openmeteo · index (failover+breaker) · interface.md
│       ├── cache/              memoryCache.js (LRU+TTL+stats)
│       ├── middleware/         validate.js (zod) · rateLimit.js · errorHandler.js
│       └── utils/              normalize.js · http.js · errors.js · logger.js
│   └── test/                   5 suites · 49 tests · fixtures.js
│
└── e2e/                        205 lines — cross-stack Playwright suite
    ├── playwright.config.js    webServer boots the backend, health-gated
    └── tests/                  journeys.spec.js · resilience.spec.js
```

---

## 11) By the Numbers

| | |
|---|---|
| Commits | 8 (v1 baseline + 7 phase commits) |
| Hand-written code | ≈ 3,680 lines (frontend 2,142 + backend 1,330 + e2e 205) |
| Backend tests | 49 |
| E2E specs | 8 |
| CI jobs per push | 3 |
| Runtime dependencies (backend) | 6 (express, helmet, cors, morgan, dotenv, zod, express-rate-limit) |
| Frontend dependencies | **0** |
| Secrets | **1** (`OPENWEATHER_API_KEY`, server-only) |
| Provider calls from the browser | **0** — enforced and E2E-proven |
| Services to deploy | 1 |

---

## 12) What Remains

### Must-do to go live (owner: you — ~5 minutes)
1. **Deploy** — Render Blueprint (free): https://dashboard.render.com → New → Blueprint → pick the repo → paste your OWM key when prompted. Full guide: `docs/DEPLOY.md`.
2. **Verify** — run the checklist in `docs/DEPLOY.md` (`/api/v1/health` shows `configured`, `X-Cache: MISS→HIT`, UI footer says "Live data: OpenWeatherMap").
3. **Revoke the session token** — it was still active at report time: https://github.com/settings/personal-access-tokens → delete.

### Nice-to-have roadmap (architecture already provides the seams)
- **PWA** — manifest + service worker for installability/offline shell (frontend-only)
- **Autocomplete** — `/api/v1/geocode?q=` already exists; wire a debounced dropdown to it
- **Air quality** — add `openweather.provider.js`/Open-Meteo AQ endpoint + a tiles row
- **Redis cache** — swap `memoryCache.js` (interface already matches)
- **Server-side favourites + auth** — only needed if recents should follow users across devices
- **Keep-warm cron** for Render's free-tier sleep (15 min idle) — noted in DEPLOY.md

---

## 13) Quick Reference

```bash
# Local dev
cd backend && cp .env.example .env   # paste your OWM key
npm install && npm start             # → http://localhost:3000

# Tests
cd backend && npm test               # 49 tests
cd e2e && npx playwright test        # 8 specs (boots the backend itself)

# Docker
docker build -t skycast . && docker run -p 3000:3000 -e OPENWEATHER_API_KEY=… skycast
```
