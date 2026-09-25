/* ============================================================================
 * SkyCast backend — src/config/env.js
 * ----------------------------------------------------------------------------
 * The ONLY module in the entire backend allowed to read process.env.
 * Loads backend/.env (git-ignored), validates, and exports a frozen `env`.
 * Phase 1: nothing is strictly required — a missing OpenWeatherMap key only
 * degrades the (future) weather endpoint; /api/v1/health reports the state.
 * ========================================================================== */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const here = path.dirname(fileURLToPath(import.meta.url));
/* .env lives at backend/.env — two levels up from src/config/ */
dotenv.config({ path: path.resolve(here, "../../.env") });

const NODE_ENV = (process.env.NODE_ENV ?? "development").toLowerCase();
const VALID_ENVS = new Set(["development", "test", "production"]);
if (!VALID_ENVS.has(NODE_ENV)) {
  throw new Error(
    `Invalid NODE_ENV "${NODE_ENV}" — expected one of: ${[...VALID_ENVS].join(", ")}`
  );
}

/** Read a string env var. `required: true` → boot fails when absent/empty. */
function str(name, { required = false, devFallback = undefined } = {}) {
  const raw = process.env[name];
  if (raw !== undefined && raw.trim() !== "") return raw.trim();
  if (required) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
      `Copy backend/.env.example to backend/.env and fill it in.`
    );
  }
  return devFallback;
}

/** Read an integer env var with a default and sane bounds. */
function int(name, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`Environment variable ${name} must be an integer in [${min}, ${max}], got "${raw}"`);
  }
  return value;
}

export const env = Object.freeze({
  NODE_ENV,
  isDev: NODE_ENV === "development",
  isTest: NODE_ENV === "test",
  isProd: NODE_ENV === "production",

  PORT: int("PORT", 3000, { min: 1, max: 65535 }),

  /** Provider secrets — server-side only, NEVER sent to the browser. */
  OPENWEATHER_API_KEY: str("OPENWEATHER_API_KEY", { devFallback: "" }),

  /** Optional base-URL overrides (testing / proxying). */
  OPENWEATHER_BASE_URL: str("OPENWEATHER_BASE_URL", { devFallback: "https://api.openweathermap.org/data/2.5" }),
  OPENWEATHER_GEO_URL: str("OPENWEATHER_GEO_URL", { devFallback: "https://api.openweathermap.org/geo/1.0" }),
  OPENMETEO_BASE_URL: str("OPENMETEO_BASE_URL", { devFallback: "https://api.open-meteo.com/v1" }),
  OPENMETEO_GEOCODE_URL: str("OPENMETEO_GEOCODE_URL", { devFallback: "https://geocoding-api.open-meteo.com/v1" }),
  REVERSE_GEO_URL: str("REVERSE_GEO_URL", { devFallback: "https://api.bigdatacloud.net/data/reverse-geocode-client" }),

  /** Comma-separated extra allowed CORS origins (for a future split deploy). */
  CORS_ORIGINS: (str("CORS_ORIGINS", { devFallback: "" }) ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  /** Cache TTLs (seconds) — consumed from Phase 3 onward. */
  CACHE_CURRENT_TTL: int("CACHE_CURRENT_TTL_SECONDS", 600, { min: 1 }),
  CACHE_FORECAST_TTL: int("CACHE_FORECAST_TTL_SECONDS", 3600, { min: 1 }),
  CACHE_GEOCODE_TTL: int("CACHE_GEOCODE_TTL_SECONDS", 86400, { min: 1 }),

  /** Public rate limit (requests/min/IP) — consumed from Phase 3 onward. */
  RATE_LIMIT_PER_MINUTE: int("RATE_LIMIT_PER_MINUTE", 60, { min: 1 }),
});
