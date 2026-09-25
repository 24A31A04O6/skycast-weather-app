/* ============================================================================
 * SkyCast backend — test/failover.test.js
 * ----------------------------------------------------------------------------
 * The provider chain: primary → backup failover, CITY_NOT_FOUND pass-through,
 * and the circuit breaker (3 consecutive failures → 60 s open → half-open).
 * Both providers are module-mocked so no HTTP happens at all.
 * ========================================================================== */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/* openweather is a module mock: always fails with UPSTREAM_DOWN, counting calls. */
const owmFetch = vi.fn();

vi.mock("../src/providers/openweather.provider.js", () => ({
  openweatherProvider: {
    name: "openweather",
    isConfigured: () => true,
    fetchWeather: (...a) => owmFetch(...a),
    geocode: async () => [],
    reverse: async () => null,
  },
}));

/* openmeteo is a module mock too, so the chain test never touches network. */
const meteoFetch = vi.fn();

vi.mock("../src/providers/openmeteo.provider.js", () => ({
  openmeteoProvider: {
    name: "openmeteo",
    isConfigured: () => true,
    fetchWeather: (...a) => meteoFetch(...a),
    geocode: async () => [],
    reverse: async () => null,
  },
}));

const { fetchWeatherWithFailover, providerChain, resetBreakers } = await import("../src/providers/index.js");

const down = Object.assign(new Error("primary exploded"), { code: "UPSTREAM_DOWN", status: 502 });
const notFound = Object.assign(new Error("no such city"), { code: "CITY_NOT_FOUND", status: 404 });
const dto = (source) => ({ source, place: {}, current: {}, hourly: [], daily: [], meta: {} });

beforeEach(() => {
  owmFetch.mockReset();
  meteoFetch.mockReset();
  resetBreakers(); // breaker state is module-level — never leak between tests
  vi.useRealTimers();
});
afterEach(() => vi.useRealTimers());

describe("failover chain", () => {
  it("walks primary → backup when the primary fails", async () => {
    owmFetch.mockRejectedValueOnce(down);
    meteoFetch.mockResolvedValueOnce(dto("openmeteo"));

    const result = await fetchWeatherWithFailover({ city: "Hyderabad" });
    expect(result.source).toBe("openmeteo");
    expect(owmFetch).toHaveBeenCalledTimes(1);
    expect(meteoFetch).toHaveBeenCalledTimes(1);
  });

  it("returns the primary's DTO without touching the backup", async () => {
    owmFetch.mockResolvedValueOnce(dto("openweather"));

    const result = await fetchWeatherWithFailover({ city: "Hyderabad" });
    expect(result.source).toBe("openweather");
    expect(meteoFetch).not.toHaveBeenCalled();
  });

  it("prioritises CITY_NOT_FOUND when the whole chain misses", async () => {
    owmFetch.mockRejectedValueOnce(down);
    meteoFetch.mockRejectedValueOnce(notFound);

    await expect(fetchWeatherWithFailover({ city: "Xyzzy" }))
      .rejects.toMatchObject({ code: "CITY_NOT_FOUND" });
  });

  it("always ends with openmeteo in the chain (key-less floor)", () => {
    const names = providerChain().map((p) => p.name);
    expect(names).toContain("openmeteo");
    expect(names[names.length - 1]).toBe("openmeteo");
  });
});

describe("circuit breaker", () => {
  it("opens after 3 consecutive failures and skips the provider while cooling down", async () => {
    owmFetch.mockRejectedValue(down);
    meteoFetch.mockResolvedValue(dto("openmeteo"));

    // Three rounds of failure → breaker opens on the 3rd.
    for (let i = 0; i < 3; i++) await fetchWeatherWithFailover({ city: "Hyderabad" });
    expect(owmFetch).toHaveBeenCalledTimes(3);

    // 4th call: breaker is open → openweather is skipped entirely.
    await fetchWeatherWithFailover({ city: "Hyderabad" });
    expect(owmFetch).toHaveBeenCalledTimes(3); // unchanged
    expect(meteoFetch).toHaveBeenCalledTimes(4);

    // After the cooldown the breaker half-opens and the provider is retried.
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 61_000);
    await fetchWeatherWithFailover({ city: "Hyderabad" });
    expect(owmFetch).toHaveBeenCalledTimes(4);
  });

  it("resets the breaker after a success", async () => {
    owmFetch.mockRejectedValueOnce(down).mockRejectedValueOnce(down).mockResolvedValueOnce(dto("openweather"));
    meteoFetch.mockResolvedValue(dto("openmeteo"));

    await fetchWeatherWithFailover({ city: "a" });
    await fetchWeatherWithFailover({ city: "b" });
    const result = await fetchWeatherWithFailover({ city: "c" }); // success resets counter

    expect(result.source).toBe("openweather");
    // Two failures only — below the threshold — so nothing is skipped next round.
    owmFetch.mockRejectedValueOnce(down);
    await fetchWeatherWithFailover({ city: "d" });
    expect(owmFetch).toHaveBeenCalledTimes(4); // was still tried
  });
});
