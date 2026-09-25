/* ============================================================================
 * SkyCast backend — test/cache.test.js
 * ----------------------------------------------------------------------------
 * memoryCache unit tests: TTL expiry (fake clocks), LRU eviction, stats,
 * stale reads, clone-safety (mutating a returned value must not corrupt
 * the stored entry).
 * ========================================================================== */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMemoryCache } from "../src/cache/memoryCache.js";

describe("memoryCache", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("stores and returns fresh values", () => {
    const c = createMemoryCache({ name: "t" });
    c.set("k", { a: 1 }, 60_000);
    expect(c.get("k")).toEqual({ a: 1 });
  });

  it("expires entries after their TTL", () => {
    const c = createMemoryCache({ name: "t" });
    c.set("k", 42, 1_000);
    vi.advanceTimersByTime(999);
    expect(c.get("k")).toBe(42);
    vi.advanceTimersByTime(1);
    expect(c.get("k")).toBeNull();
  });

  it("getStale returns expired entries (and counts the serve)", () => {
    const c = createMemoryCache({ name: "t" });
    c.set("k", "stale-me", 500);
    vi.advanceTimersByTime(501);
    expect(c.get("k")).toBeNull();
    expect(c.getStale("k")).toBe("stale-me");
    expect(c.stats().staleServes).toBe(1);
  });

  it("evicts the least-recently-used entry beyond maxEntries", () => {
    const c = createMemoryCache({ name: "t", maxEntries: 2 });
    c.set("a", 1, 60_000);
    c.set("b", 2, 60_000);
    c.get("a");              // touch a → b is now LRU
    c.set("c", 3, 60_000);   // evicts b
    expect(c.get("a")).toBe(1);
    expect(c.get("b")).toBeNull();
    expect(c.get("c")).toBe(3);
    expect(c.stats().evictions).toBe(1);
  });

  it("tracks hits/misses/hitRate", () => {
    const c = createMemoryCache({ name: "t" });
    c.set("k", 1, 60_000);
    c.get("k");
    c.get("k");
    c.get("nope");
    const s = c.stats();
    expect(s.hits).toBe(2);
    expect(s.misses).toBe(1);
    expect(s.hitRate).toBeCloseTo(2 / 3, 3);
  });

  it("clones on write and read — callers can't corrupt the cache", () => {
    const c = createMemoryCache({ name: "t" });
    const value = { list: [1, 2] };
    c.set("k", value, 60_000);
    value.list.push(999);            // mutate the original after set
    const out = c.get("k");
    out.list.push(123);              // mutate what we got back
    expect(c.get("k").list).toEqual([1, 2]);
  });

  it("del() and clear() work", () => {
    const c = createMemoryCache({ name: "t" });
    c.set("a", 1, 60_000);
    c.set("b", 2, 60_000);
    c.del("a");
    expect(c.get("a")).toBeNull();
    c.clear();
    expect(c.get("b")).toBeNull();
    expect(c.stats().size).toBe(0);
  });
});
