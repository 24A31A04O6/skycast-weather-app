/* ============================================================================
 * SkyCast backend — src/cache/memoryCache.js
 * ----------------------------------------------------------------------------
 * Zero-dependency in-memory cache: TTL + LRU eviction + hit/miss stats.
 * Purely lazy expiry (no timers) so tests can use fake clocks freely.
 *
 * Interface mirrors what a Redis-backed store would expose — swap it in
 * (Phase 6 option) without touching the service layer:
 *   get(key) · getStale(key) · set(key, value, ttlMs) · del(key) · clear()
 *   stats() → { name, size, hits, misses, hitRate, evictions, staleServes }
 * ========================================================================== */

/**
 * @param {object} opts
 * @param {string} opts.name          label for logs/stats
 * @param {number} opts.maxEntries    LRU cap (oldest-touched entry evicted)
 * @param {number} opts.ttlMsDefault  default entry lifetime
 */
export function createMemoryCache({ name = "memory", maxEntries = 300, ttlMsDefault = 600_000 } = {}) {
  /** key → { value, expiresAt } — Map order = LRU order (oldest first) */
  const map = new Map();
  const stats = { hits: 0, misses: 0, evictions: 0, staleServes: 0 };

  function touch(key, entry) {
    map.delete(key);
    map.set(key, entry);
  }

  function evictIfNeeded() {
    while (map.size > maxEntries) {
      const oldest = map.keys().next().value;
      map.delete(oldest);
      stats.evictions += 1;
    }
  }

  return {
    name,

    /** Fresh value only. `null` on miss or expiry (expired entries stay put for getStale). */
    get(key) {
      const entry = map.get(key);
      if (!entry) {
        stats.misses += 1;
        return null;
      }
      if (Date.now() >= entry.expiresAt) {
        stats.misses += 1;
        return null;
      }
      stats.hits += 1;
      touch(key, entry);
      return structuredClone(entry.value);
    },

    /** Expired-but-present value (or fresh one) WITHOUT counting stats — for stale-on-error. */
    getStale(key) {
      const entry = map.get(key);
      if (!entry) return null;
      const fresh = Date.now() < entry.expiresAt;
      if (!fresh) stats.staleServes += 1;
      touch(key, entry);
      return structuredClone(entry.value);
    },

    set(key, value, ttlMs = ttlMsDefault) {
      touch(key, { value: structuredClone(value), expiresAt: Date.now() + ttlMs });
      evictIfNeeded();
    },

    del(key) {
      map.delete(key);
    },

    clear() {
      map.clear();
    },

    stats() {
      const lookups = stats.hits + stats.misses;
      return {
        name,
        size: map.size,
        hits: stats.hits,
        misses: stats.misses,
        hitRate: lookups ? +(stats.hits / lookups).toFixed(3) : 0,
        evictions: stats.evictions,
        staleServes: stats.staleServes,
      };
    },
  };
}

/* Shared singleton used by the service layer. */
export const cache = createMemoryCache({
  name: "weather-cache",
  maxEntries: 300,
  ttlMsDefault: 600_000, // 10 min — backend/config/env.js CACHE_CURRENT_TTL governs real TTLs
});
