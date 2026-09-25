/* ============================================================================
 * SkyCast backend — test/fixtures.js
 * ----------------------------------------------------------------------------
 * Minimal-but-realistic provider payloads. Timestamps are chosen to be
 * arithmetically clean (see comments) so assertions are exact.
 * ========================================================================== */

const TZ = 19800; // IST — +5:30, a half-hour zone on purpose

/* 1758758400 = 2025-09-25T00:00:00Z → local (IST) 2025-09-25T05:30 */
export const OWM_DT_BASE = 1758758400;

export const owmCurrent = {
  coord: { lat: 17.385, lon: 78.4867 },
  weather: [{ id: 803, main: "Clouds", description: "broken clouds", icon: "04d" }],
  main: { temp: 31.0, feels_like: 33.5, temp_min: 28.0, temp_max: 33.8, pressure: 1009, humidity: 56 },
  visibility: 9000,
  wind: { speed: 4.1, deg: 260 },
  dt: OWM_DT_BASE,
  sys: {
    country: "IN",
    sunrise: OWM_DT_BASE + 21000, /* UTC 05:50 → local 11:20 */
    sunset: OWM_DT_BASE + 63600,  /* UTC 17:40 → local 23:10 */
  },
  timezone: TZ,
  id: 1269843,
  name: "Hyderabad",
};

export const owmForecast = {
  city: { timezone: TZ, name: "Hyderabad", country: "IN" },
  cnt: 4,
  list: [
    // local 2025-09-25T05:30
    { dt: OWM_DT_BASE, main: { temp: 31.0, temp_min: 29.5, temp_max: 32.0 }, weather: [{ icon: "04d" }], pop: 0.1 },
    // local 2025-09-25T08:30 — closest to noon among day-1 entries → daily icon
    { dt: OWM_DT_BASE + 10800, main: { temp: 29.0, temp_min: 28.5, temp_max: 29.5 }, weather: [{ icon: "04n" }], pop: 0.4 },
    // local 2025-09-26T05:30
    { dt: OWM_DT_BASE + 86400, main: { temp: 30.0, temp_min: 27.0, temp_max: 33.0 }, weather: [{ icon: "10d" }], pop: 0.8 },
    // local 2025-09-26T17:30 — closest to noon among day-2 entries → daily icon
    { dt: OWM_DT_BASE + 86400 + 43200, main: { temp: 26.0, temp_min: 25.0, temp_max: 27.0 }, weather: [{ icon: "01n" }], pop: 0 },
  ],
};

/** Key-less UV supplement bundle (Open-Meteo hourly uv_index). */
export const uvBundle = {
  current: { time: "2025-09-25T05:30", temperature_2m: 24.7 },
  hourly: {
    time: Array.from({ length: 9 }, (_, i) => `2025-09-25T${String(i).padStart(2, "0")}:00`),
    uv_index: [0.0, 0.0, 0.2, 1.1, 3.0, 6.2, 8.4, 7.1, 4.0], // idx 5 → anchor 05:xx
  },
};

export const owmGeocode = [
  { name: "Hyderabad", country: "IN", state: "Telangana", lat: 17.38405, lon: 78.45636 },
  { name: "Hyderabad", country: "PK", lat: 25.4, lon: 68.4 },
];

/* ── Open-Meteo ──────────────────────────────────────────────────────────── */

export const meteoGeocode = {
  results: [
    {
      id: 1269843, name: "Hyderabad", latitude: 17.38405, longitude: 78.45636,
      country: "India", country_code: "IN", admin1: "Telangana", timezone: "Asia/Kolkata",
    },
  ],
};

/** Local wall-clock "2025-09-25THH:mm" for hour h, minute 30. */
const localIso = (h, m = 30) =>
  `2025-09-25T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

export const meteoForecast = (() => {
  const n = 24;
  const times = Array.from({ length: n }, (_, i) => localIso((5 + i) % 24, 30));
  return {
    latitude: 17.398945,
    longitude: 78.457085,
    timezone: "Asia/Kolkata",
    current: {
      time: localIso(5), // idx 0 of hourly
      temperature_2m: 24.7,
      relative_humidity_2m: 88,
      apparent_temperature: 28.3,
      is_day: 1,
      weather_code: 53,
      wind_speed_10m: 11.2,
    },
    hourly: {
      time: times,
      temperature_2m: Array.from({ length: n }, (_, i) => 24.7 - i * 0.1),
      weather_code: Array.from({ length: n }, (_, i) => (i === 3 ? 95 : 53)),
      precipitation_probability: Array.from({ length: n }, (_, i) => 10 + i),
      is_day: Array.from({ length: n }, (_, i) => (i < 13 ? 1 : 0)),
      uv_index: Array.from({ length: n }, (_, i) => i * 0.3),
      visibility: Array.from({ length: n }, (_, i) => 12000 - i * 100),
      surface_pressure: Array.from({ length: n }, (_, i) => 1010 + i * 0.5),
    },
    daily: {
      time: ["2025-09-25", "2025-09-26", "2025-09-27", "2025-09-28", "2025-09-29"],
      weather_code: [53, 61, 95, 3, 0],
      temperature_2m_max: [30.8, 29.9, 31.2, 28.4, 33.0],
      temperature_2m_min: [22.9, 23.1, 24.0, 21.5, 24.2],
      sunrise: ["2025-09-25T05:59", "2025-09-26T05:59", "2025-09-27T05:59", "2025-09-28T06:00", "2025-09-29T06:00"],
      sunset: ["2025-09-25T18:07", "2025-09-26T18:06", "2025-09-27T18:05", "2025-09-28T18:04", "2025-09-29T18:03"],
    },
  };
})();

export const bigDataCloudReverse = {
  city: "Hyderabad",
  locality: "Hyderabad",
  principalSubdivision: "Telangana",
  countryCode: "IN",
};
