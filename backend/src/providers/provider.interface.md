# Provider Interface

Every weather provider adapter in `src/providers/` MUST implement this shape.
The normaliser (`src/utils/normalize.js`) and its unit tests are the law —
an adapter that cannot produce this DTO from a fixture is merge-blocked.

## Contract

```js
export const <name>Provider = {
  name: "<provider-name>",            // "openweather" | "openmeteo"
  isConfigured: () => boolean,        // false → excluded from the failover chain
  async fetchWeather(query),          // → DTO below (never throws non-AppError)
  async geocode(q),                   // → [{ name, country, state?, lat, lon }]
  async reverse(lat, lon),            // → { name, country } | null (best-effort)
};
```

`query` is exactly one of:
- `{ city: string }`        — free-text city lookup (adapter resolves coordinates)
- `{ lat, lon }`            — precise coordinates (GPS button)

## The DTO (ARCHITECTURE.md §2.1)

```jsonc
{
  "source": "openweather|openmeteo",
  "place":  { "city": "Hyderabad", "country": "IN", "lat": 17.38, "lon": 78.48 },
  "current": {
    "temp": 24.7,          // °C            (metric over the wire — ALWAYS)
    "feelsLike": 28.3,     // °C
    "humidity": 88,        // %
    "windKmh": 11.2,       // km/h          (convert m/s here, not in the UI)
    "pressureHpa": 1009,   // hPa | null
    "visibilityKm": 9.0,   // km  | null
    "uv": 0.4,             // index | null
    "description": "drizzle",
    "iconKey": "drizzle",  // frontend icon vocabulary
    "theme": "rain",       // frontend sky-theme vocabulary
    "sunrise": "05:59",    // HH:mm, city-local wall clock
    "sunset": "18:07",
    "localTime": "2026-09-22T22:15"  // city-local ISO (no offset suffix)
  },
  "hourly": [{ "time": "2026-09-22T23:00", "temp": 24.1, "iconKey": "cloud", "popPct": 8 }],
  "daily":  [{ "date": "2026-09-23", "min": 22.9, "max": 30.8, "iconKey": "storm", "popPct": 41 }],
  "meta":   { "cached": false, "fetchedAt": "2026-09-22T16:45:10Z" }
}
```

## Rules

1. **Times are city-local ISO strings with no timezone suffix** — derived from the
   provider payload, never from the server's clock or zone.
2. **Units are metric** (°C, km/h, km, hPa). Presentation conversion (°F, mph) is
   frontend-only.
3. Unknown/absent optional metrics become `null` — never `undefined`, never omitted,
   never fabricated.
4. `iconKey`/`theme` MUST come from the shared vocabulary in `normalize.js`
   (`sun, moon, cloudSun, cloudMoon, cloud, drizzle, rain, thunder, snow, mist`).
5. Failures are raised as `AppError` with stable codes; provider quirk-mapping
   (m/s→km/h, icon codes, WMO codes, 3h→daily aggregation, UV stitching) happens
   inside the adapter/normaliser — never downstream.
