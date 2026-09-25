/* ============================================================================
 * SkyCast backend — src/providers/index.js
 * ----------------------------------------------------------------------------
 * Provider registry + failover chain:
 *   chain = [openweather (if a key is configured), openmeteo (always)]
 * fetchWeatherWithFailover walks the chain; after BREAKER_THRESHOLD
 * consecutive failures a provider is skipped for COOLDOWN_MS (unless it is
 * the only one left — half-open behaviour). A 404 CITY_NOT_FOUND from one
 * provider does NOT stop the chain: coverage differs between providers, and
 * only if every provider misses does the 404 surface to the client.
 * ========================================================================== */
import { env } from "../config/env.js";
import { AppError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { openweatherProvider } from "./openweather.provider.js";
import { openmeteoProvider } from "./openmeteo.provider.js";

export const PROVIDERS = {
  openweather: openweatherProvider,
  openmeteo: openmeteoProvider,
};

/** Ordered chain of configured providers. */
export function providerChain() {
  const names = [];
  if (openweatherProvider.isConfigured()) names.push("openweather");
  names.push("openmeteo");
  return names.map((n) => PROVIDERS[n]);
}

/* ── Circuit breaker state ───────────────────────────────────────────────── */
const BREAKER_THRESHOLD = 3;     // consecutive failures before opening
const COOLDOWN_MS = 60_000;      // how long an open breaker stays open
const breaker = new Map();       // name → { fails, openedAt }

function breakerState(name) {
  if (!breaker.has(name)) breaker.set(name, { fails: 0, openedAt: 0 });
  return breaker.get(name);
}

export function isAvailable(name) {
  const s = breakerState(name);
  if (s.fails < BREAKER_THRESHOLD) return true;
  return Date.now() - s.openedAt >= COOLDOWN_MS; // cooldown elapsed → half-open
}

export function recordSuccess(name) {
  const s = breakerState(name);
  s.fails = 0;
  s.openedAt = 0;
}

export function recordFailure(name) {
  const s = breakerState(name);
  s.fails += 1;
  if (s.fails >= BREAKER_THRESHOLD) s.openedAt = Date.now();
}

/** Test helper — clear all breaker state. */
export function resetBreakers() {
  breaker.clear();
}

/* ── Failover walk ────────────────────────────────────────────────────────── */

/**
 * Try each configured provider in order until one returns a DTO.
 * @returns {Promise<object>} contract DTO (meta.source = winning provider)
 * @throws {AppError} the most user-relevant error after the chain is exhausted
 */
export async function fetchWeatherWithFailover(query) {
  const chain = providerChain();
  const failures = [];

  for (const provider of chain) {
    // Skip open breakers — unless this provider is the only option (half-open).
    if (!isAvailable(provider.name) && chain.length > 1) {
      logger.warn(`provider ${provider.name} skipped (breaker open)`);
      continue;
    }
    try {
      const dto = await provider.fetchWeather(query);
      recordSuccess(provider.name);
      return dto;
    } catch (err) {
      recordFailure(provider.name);
      failures.push(err);
      logger.warn(`provider ${provider.name} failed: ${err.message}`);
    }
  }

  const notFound = failures.find((e) => e?.code === "CITY_NOT_FOUND");
  if (notFound) throw notFound;
  if (failures.length) throw failures[failures.length - 1];
  throw new AppError(502, "UPSTREAM_DOWN", "No weather provider is configured.");
}

/** Geocode through the first provider that answers. */
export async function geocodeWithFailover(q) {
  const failures = [];
  for (const provider of providerChain()) {
    try {
      const results = await provider.geocode(q);
      if (results.length) return results;
      failures.push(new AppError(404, "CITY_NOT_FOUND", `No match for “${q}”.`));
    } catch (err) {
      failures.push(err);
    }
  }
  throw failures[0] ?? new AppError(404, "CITY_NOT_FOUND", `No match for “${q}”.`);
}

/** Reverse geocode through the first provider that returns a label (or null). */
export async function reverseWithFailover(lat, lon) {
  for (const provider of providerChain()) {
    try {
      const place = await provider.reverse(lat, lon);
      if (place) return place;
    } catch (err) {
      logger.warn(`reverse via ${provider.name} failed: ${err.message}`);
    }
  }
  return null; // cosmetic — the weather lookup itself doesn't need a label
}
