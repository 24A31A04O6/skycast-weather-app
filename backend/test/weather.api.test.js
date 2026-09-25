/* ============================================================================
 * SkyCast backend — test/weather.api.test.js
 * ----------------------------------------------------------------------------
 * Integration tests for the LIVE data endpoints (Phase 3). The provider
 * chain module is fully mocked — no network, deterministic DTOs. Covers:
 *   • 200 contract DTO on ?city= and ?lat&lon=
 *   • X-Cache MISS → HIT within TTL (and STALE after TTL when upstream dies)
 *   • query normalisation (case-insensitive city, 2dp coordinate grid)
 *   • 400 BAD_QUERY on malformed input (both/neither modes, out-of-range)
 *   • 404 CITY_NOT_FOUND contract shape
 *   • 429 RATE_LIMITED shape via a tight factory limiter
 *   • geocode + reverse endpoints incl. caching
 * ========================================================================== */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";

/* Provider-chain mock — every service call lands here, never on the network. */
const wxMock = vi.fn();
const geoMock = vi.fn();
const revMock = vi.fn();

vi.mock("../src/providers/index.js", () => ({
  fetchWeatherWithFailover: (...a) => wxMock(...a),
  geocodeWithFailover: (...a) => geoMock(...a),
  reverseWithFailover: (...a) => revMock(...a),
  providerChain: () => [{ name: "openweather" }, { name: "openmeteo" }],
}));

import { app } from "../src/app.js";
import { AppError } from "../src/utils/errors.js";
import { cache } from "../src/cache/memoryCache.js";
import { createRateLimit } from "../src/middleware/rateLimit.js";

const dto = (city = "Hyderabad") => ({
  source: "openmeteo",
  place: { city, country: "IN", lat: 17.38, lon: 78.48 },
  current: { temp: 26.7, feelsLike: 28.1, humidity: 64, windKmh: 13.9,
    pressureHpa: 946.5, visibilityKm: 16.34, uv: 0.2,
    description: "overcast", iconKey: "cloud", theme: "cloudy",
    sunrise: "06:05", sunset: "18:10", localTime: "2026-09-25T20:30" },
  hourly: [{ time: "2026-09-25T20:00", temp: 26.0, iconKey: "cloud", popPct: 3 }],
  daily: [{ date: "2026-09-25", min: 24.7, max: 30.2, iconKey: "cloud", popPct: 0 }],
  meta: { cached: false, fetchedAt: "2026-09-25T15:00:58.380Z" },
});

beforeEach(() => {
  wxMock.mockReset();
  geoMock.mockReset();
  revMock.mockReset();
  cache.clear();
  vi.useFakeTimers({ toFake: ["Date"] }); // fake the clock only — real timers keep supertest alive
  vi.setSystemTime(new Date("2026-09-25T15:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("GET /api/v1/weather", () => {
  it("returns the contract DTO for a city query (X-Cache: MISS)", async () => {
    wxMock.mockResolvedValue(dto());

    const res = await request(app).get("/api/v1/weather?city=hyderabad");

    expect(res.status).toBe(200);
    expect(res.headers["x-cache"]).toBe("MISS");
    expect(res.body.source).toBe("openmeteo");
    expect(res.body.place.city).toBe("Hyderabad");
    expect(res.body.current.temp).toBe(26.7);
    expect(res.body.hourly).toHaveLength(1);
    expect(res.body.daily).toHaveLength(1);
    expect(res.body.meta.cached).toBe(false);
    expect(wxMock).toHaveBeenCalledWith({ city: "hyderabad" });
  });

  it("serves a HIT from cache on an identical repeat (provider called once)", async () => {
    wxMock.mockResolvedValue(dto());

    await request(app).get("/api/v1/weather?city=hyderabad");
    const second = await request(app).get("/api/v1/weather?city=hyderabad");

    expect(second.headers["x-cache"]).toBe("HIT");
    expect(second.body.meta.cached).toBe(true);
    expect(second.body.current.temp).toBe(26.7);
    expect(wxMock).toHaveBeenCalledTimes(1);
  });

  it("normalises city case but distinguishes different cities", async () => {
    wxMock.mockResolvedValue(dto("Tokyo"));

    await request(app).get("/api/v1/weather?city=HYDERABAD");
    await request(app).get("/api/v1/weather?city=hyderabad"); // same key → HIT
    const tokyo = await request(app).get("/api/v1/weather?city=Tokyo");

    expect(tokyo.headers["x-cache"]).toBe("MISS");
    expect(wxMock).toHaveBeenCalledTimes(2);
  });

  it("rounds coordinates to a 2-decimal grid for the cache key", async () => {
    wxMock.mockResolvedValue(dto());

    await request(app).get("/api/v1/weather?lat=17.38123&lon=78.48499");
    const near = await request(app).get("/api/v1/weather?lat=17.38222&lon=78.48111");

    expect(near.headers["x-cache"]).toBe("HIT"); // both → grid point 17.38,78.48
    expect(wxMock).toHaveBeenCalledTimes(1);
  });

  it("serves STALE data when TTL elapsed AND the provider chain fails", async () => {
    wxMock.mockResolvedValue(dto());
    await request(app).get("/api/v1/weather?city=hyderabad");

    vi.advanceTimersByTime(11 * 60 * 1000); // past the 10-min current TTL
    wxMock.mockRejectedValue(new AppError(502, "UPSTREAM_DOWN", "providers down"));

    const res = await request(app).get("/api/v1/weather?city=hyderabad");

    expect(res.status).toBe(200);
    expect(res.headers["x-cache"]).toBe("STALE");
    expect(res.body.meta.cached).toBe(true);
  });

  it("propagates CITY_NOT_FOUND after the chain misses (no stale fallback)", async () => {
    wxMock.mockRejectedValue(new AppError(404, "CITY_NOT_FOUND", "no such city"));

    const res = await request(app).get("/api/v1/weather?city=xyzzy");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("CITY_NOT_FOUND");
  });

  it("returns a fresh MISS once TTL elapsed and the provider recovers", async () => {
    wxMock.mockResolvedValue(dto());
    await request(app).get("/api/v1/weather?city=hyderabad");

    vi.advanceTimersByTime(11 * 60 * 1000);
    const res = await request(app).get("/api/v1/weather?city=hyderabad");

    expect(res.headers["x-cache"]).toBe("MISS");
    expect(wxMock).toHaveBeenCalledTimes(2);
  });
});

describe("GET /api/v1/weather validation", () => {
  it("400 on city AND coordinates together", async () => {
    const res = await request(app).get("/api/v1/weather?city=hyd&lat=17.4&lon=78.5");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_QUERY");
  });

  it("400 on neither mode", async () => {
    const res = await request(app).get("/api/v1/weather");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_QUERY");
  });

  it("400 on out-of-range coordinates", async () => {
    const res = await request(app).get("/api/v1/weather?lat=91&lon=78.5");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_QUERY");
    expect(res.body.error.details).toBeTruthy();
  });

  it("400 on junk city characters", async () => {
    const res = await request(app).get(`/api/v1/weather?city=${encodeURIComponent("<script>x</script>")}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_QUERY");
  });

  it("accepts digits in city names (typo checks reach the provider)", async () => {
    wxMock.mockResolvedValue(dto());
    const res = await request(app).get("/api/v1/weather?city=Area%201");
    expect(res.status).toBe(200);
  });

  it("400 on oversized city strings", async () => {
    const res = await request(app).get(`/api/v1/weather?city=${"a".repeat(81)}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_QUERY");
  });
});

describe("GET /api/v1/geocode", () => {
  it("returns search results and caches them", async () => {
    geoMock.mockResolvedValue([{ name: "Hyderabad", country: "IN", state: "Telangana", lat: 17.38, lon: 78.45 }]);

    const first = await request(app).get("/api/v1/geocode?q=hyd");
    expect(first.status).toBe(200);
    expect(first.headers["x-cache"]).toBe("MISS");
    expect(first.body.results).toHaveLength(1);

    const second = await request(app).get("/api/v1/geocode?q=hyd");
    expect(second.headers["x-cache"]).toBe("HIT");
    expect(geoMock).toHaveBeenCalledTimes(1);
  });

  it("400 when q is missing", async () => {
    const res = await request(app).get("/api/v1/geocode");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_QUERY");
  });

  it("reverse returns the place label (or null without failing)", async () => {
    revMock.mockResolvedValue({ name: "Hyderabad", country: "IN" });
    const hit = await request(app).get("/api/v1/geocode/reverse?lat=17.38&lon=78.48");
    expect(hit.status).toBe(200);
    expect(hit.body.place.name).toBe("Hyderabad");

    revMock.mockResolvedValue(null);
    const miss = await request(app).get("/api/v1/geocode/reverse?lat=0&lon=0");
    expect(miss.status).toBe(200);
    expect(miss.body.place).toBeNull();
  });
});

describe("rate limiting", () => {
  it("429 RATE_LIMITED after the configured burst, with Retry-After", async () => {
    wxMock.mockResolvedValue(dto());

    /* Scratch app: same routes, but a 3-req/min limiter. */
    const { weatherRoutes } = await import("../src/routes/weather.routes.js");
    const { validateQuery, weatherQuerySchema } = await import("../src/middleware/validate.js");
    const { getWeather } = await import("../src/controllers/weather.controller.js");

    const tight = express();
    tight.use("/api/v1/weather", createRateLimit({ max: 3, windowMs: 60_000 }));
    tight.get("/api/v1/weather", validateQuery(weatherQuerySchema), getWeather);
    tight.use((err, req, res, next) => { // minimal error shape for the scratch app
      res.status(err.status ?? 500).json({ error: { code: err.code ?? "INTERNAL_ERROR", message: err.message } });
    });

    for (let i = 0; i < 3; i++) {
      const ok = await request(tight).get("/api/v1/weather?city=hyderabad");
      expect(ok.status).toBe(200);
    }
    const blocked = await request(tight).get("/api/v1/weather?city=hyderabad");
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("RATE_LIMITED");
    expect(blocked.headers["retry-after"]).toBeDefined();
  });
});
