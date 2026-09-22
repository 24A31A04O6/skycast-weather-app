# 🌤️ SkyCast — Production-Grade Weather Dashboard

A modern, responsive weather dashboard built with **vanilla HTML, CSS, and JavaScript** — no frameworks, no build step, no dependencies. Live data from the OpenWeatherMap API, wrapped in an atmospheric UI with dynamic weather-reactive skies, glassmorphism panels, and fluid micro-interactions.

![SkyCast desktop screenshot](docs/screenshot-desktop.png)

## ✨ Features

### Dynamic atmospheric backgrounds
- 🌌 Sky theme **adapts to the weather condition + day/night cycle** — deep starry nights, bright sunny skies, moody overcast, stormy purple, snowy pastels
- 🌧️ Ambient FX layer: soft **rain streaks, drifting snowflakes, glowing sun/moon radial, drifting light clouds, fog banks, twinkling stars + shooting stars, and lightning flashes** during storms
- Smooth 1.4 s cross-fade between skies when you switch cities

### Fluid micro-interactions
- 🫧 **Skeleton shimmer loading** (mirrors the dashboard layout — zero layout shift)
- 🎞️ Staggered entrance animations, hover elevations, and press states on every card, chip, and button
- 🔄 City switches dim-and-refresh existing content instead of flashing a spinner

### Rich dashboard
- 🕐 **24-hour forecast slider** — horizontal scroll (drag on desktop, native swipe on touch) with per-hour icon, temperature, and precipitation-probability
- 📅 **5-day forecast** with min/max temps and gradient **temperature range bars**
- 📊 **8 metric tiles**: Humidity · Wind · Feels Like · **UV Index** · **Visibility** · **Atmospheric Pressure** · **Sunrise** · **Sunset**

### Frictionless search & location
- 📍 **"Use my location"** GPS button (reverse-geocoded to a city name)
- 🗂️ **Recent-search chips** (saved in `localStorage`) — one tap to switch cities
- 🛑 Contextual **error toasts with an inline Retry button** — plus a "Continue in demo mode" escape hatch if your API key is rejected
- ⌨️ Enter-to-search, drag-scrollable strips, keyboard focus states throughout

### Unit toggle
- 🔁 Segmented **°C ⇄ °F switch** — converts every value **instantly from cached data, with zero extra API calls** (preference persisted)

## 🚀 Getting Started

1. **Clone / download** this repository.
2. Open `script.js` and paste your OpenWeatherMap API key at the top:

   ```js
   const API_KEY = "YOUR_API_KEY_HERE"; // ← your key goes here
   ```

   > No key yet? Grab a free one at [openweathermap.org](https://home.openweathermap.org/api_keys). Brand-new keys can take ~10 minutes to activate.
   > Until a valid key is set, SkyCast runs in **demo mode** powered by the free [Open-Meteo](https://open-meteo.com) API — full feature set, no key required.
3. Serve the folder (or just open `index.html`):

   ```bash
   python3 -m http.server 8080
   # then visit http://localhost:8080
   ```

## 📁 Project Structure

```
weather-app/
├── index.html    # Layout: hero, hourly slider, 5-day strip, 8 metric tiles, skeleton
├── style.css     # Sky themes, ambient FX, glassmorphism, shimmer, responsive grid
├── script.js     # API layer (async/await), FX engine, toasts, chips, unit system
└── docs/         # Screenshots
```

## 🖼️ Screenshots

| Desktop | Error toast | Mobile |
| --- | --- | --- |
| ![Desktop](docs/screenshot-desktop.png) | ![Error](docs/screenshot-error.png) | ![Mobile](docs/screenshot-mobile.png) |

## 🧠 Implementation Notes

- **One normalised data shape** — whether data comes from OpenWeatherMap or Open-Meteo, the render layer receives the same object, so both sources feed the identical UI
- **UV in OWM mode** — OpenWeatherMap's free plan has no UV endpoint, so SkyCast quietly borrows the current-hour UV from Open-Meteo (key-less); it degrades gracefully to "—"
- **Metric internally** — all temperatures are stored in °C and converted only at render time, which is what makes the unit toggle instant
- **Timeouts & friendly errors** — every fetch uses `AbortController` timeouts, and HTTP statuses map to human messages (404 → "couldn't find that city", 401 → key help, 429 → rate limit…)
- **Accessible** — ARIA roles/labels, `aria-live` toasts, visible focus rings, and full `prefers-reduced-motion` support (all particles freeze)
- **Performant FX** — every particle animates with `transform`/`opacity` only, and counts scale with condition intensity

## 🛠️ Built With

- **HTML5** — semantic, accessible markup
- **CSS3** — custom properties, `backdrop-filter` glass (with solid fallback), fluid `clamp()` type, keyframe particle system
- **Vanilla JavaScript (ES2020+)** — `async/await`, `AbortController`, `localStorage`, inline SVG icons, zero dependencies

## 🙌 Credits

Weather data: [OpenWeatherMap](https://openweathermap.org/api) · Demo & UV fallback: [Open-Meteo](https://open-meteo.com) · Reverse geocoding: [BigDataCloud](https://www.bigdatacloud.com)
