/* ============================================================================
 * SkyCast backend — src/services/weather.service.js
 * ----------------------------------------------------------------------------
 * Orchestration layer: cache-aside around the provider failover chain.
 *
 *   getWeather(query)      → { dto, cacheState: "HIT" | "MISS" | "STALE" }
 *   searchPlaces(q)        → { results, cacheState }
 *   reversePlace(lat, lon) → { place, cacheState }
 *
 * Stale-on-error ("quota conserving"): if the provider chain fails but a
 * previously-cached entry exists (even expired), serve it with cacheState
 * STALE rather than erroring — degraded freshness beats no data.
 *
 * Cache keys normalise the query so equivalent lookups share entries:
 *   city mode  → wx:city:<lowercased city>
 *   coord mode → wx:geo:<lat2dp>,<lon2dp>   (~1 km grid — good enough)
 * ========================================================================== */
import { env } from "../config/env.js";
import { cache } from "../cache/memoryCache.js";
import {
  fetchWeatherWithFailover,
  geocodeWithFailover,
  reverseWithFailover,
} from "../providers/index.js";
import { logger } from "../utils/logger.js";

const asCached = (dto) => ({ ...dto, meta: { ...dto.meta, cached: true } });

const weatherKey = (q) =>
  q.city != null
    ? `wx:city:${q.city.toLowerCase()}`
    : `wx:geo:${Number(q.lat).toFixed(2)},${Number(q.lon).toFixed(2)}`;

export async function getWeather(query) {
  const key = weatherKey(query);

  const fresh = cache.get(key);
  if (fresh) return { dto: asCached(fresh), cacheState: "HIT" };

  const stale = cache.getStale(key); // keep as a safety net before going upstream

  try {
    const dto = await fetchWeatherWithFailover(query);
    cache.set(key, dto, env.CACHE_CURRENT_TTL * 1000);
    return { dto, cacheState: "MISS" };
  } catch (err) {
    if (stale) {
      logger.warn(`serving STALE for ${key} — upstream failed: ${err.message}`);
      return { dto: asCached(stale), cacheState: "STALE" };
    }
    throw err;
  }
}

export async function searchPlaces(q) {
  const key = `geo:${q.toLowerCase()}`;

  const fresh = cache.get(key);
  if (fresh) return { results: fresh, cacheState: "HIT" };

  const results = await geocodeWithFailover(q);
  cache.set(key, results, env.CACHE_GEOCODE_TTL * 1000);
  return { results, cacheState: "MISS" };
}

export async function reversePlace(lat, lon) {
  const key = `georev:${Number(lat).toFixed(3)},${Number(lon).toFixed(3)}`;

  const fresh = cache.get(key);
  if (fresh) return { place: fresh, cacheState: "HIT" };

  const place = await reverseWithFailover(lat, lon); // null-safe: may be no label
  if (place) cache.set(key, place, env.CACHE_GEOCODE_TTL * 1000);
  return { place, cacheState: place ? "MISS" : "MISS" };
}
