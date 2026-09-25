/* ============================================================================
 * SkyCast backend — test/providers.test.js
 * ----------------------------------------------------------------------------
 * Adapter + normaliser unit tests. 100% mocked (global fetch is stubbed) —
 * no live provider calls in CI, per ARCHITECTURE.md Phase 2 exit criteria.
 * ========================================================================== */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/* env.js must see a key before the OWM provider module loads (dynamic import
   below guarantees ordering). */
process.env.OPENWEATHER_API_KEY = "test-key-owm";

import {
  owmIconKey, describeWMO, unixToLocalIso, aggregateOwmDaily, pickUvHour,
} from "../src/utils/normalize.js";
import {
  owmCurrent, owmForecast, uvBundle, owmGeocode, meteoGeocode, meteoForecast, bigDataCloudReverse,
} from "./fixtures.js";

const { openweatherProvider } = await import("../src/providers/openweather.provider.js");
const { openmeteoProvider } = await import("../src/providers/openmeteo.provider.js");

/* Route mocked fetch to the right fixture based on the URL. */
function stubFetch(routes) {
  const fn = vi.fn(async (url) => {
    for (const [pattern, responder] of routes) {
      if (url.includes(pattern)) {
        // function responders return a FULL response object (error stubs);
        // plain-data responders are fixture bodies wrapped as HTTP 200.
        if (typeof responder === "function") return await responder(url);
        return { ok: true, status: 200, json: async () => responder };
      }
    }
    return { ok: false, status: 404, json: async () => ({}) };
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe("normalize: vocabularies", () => {
  it("maps OWM icon codes (incl. suffix-less fallbacks)", () => {
    expect(owmIconKey("01d")).toBe("sun");
    expect(owmIconKey("01n")).toBe("moon");
    expect(owmIconKey("10d")).toBe("rain");
    expect(owmIconKey("04n")).toBe("cloud");
    expect(owmIconKey("09")).toBe("drizzle");
    expect(owmIconKey("zzz")).toBe("cloud");
  });

  it("maps WMO codes to day/night icons", () => {
    expect(describeWMO(0).day).toBe("sun");
    expect(describeWMO(0).night).toBe("moon");
    expect(describeWMO(2).day).toBe("cloudSun");
    expect(describeWMO(95).day).toBe("thunder");
    expect(describeWMO(9999).fallback).toBe("Unknown");
  });

  it("formats city-local ISO from shifted unix seconds", () => {
    expect(unixToLocalIso(1758758400 + 19800)).toBe("2025-09-25T05:30");
  });
});

describe("normalize: OWM daily aggregation", () => {
  it("groups 3-hour steps into days with min/max, noon-closest icon, max pop", () => {
    const days = aggregateOwmDaily(owmForecast.list, 19800, 5);
    expect(days).toHaveLength(2);

    expect(days[0]).toEqual({
      date: "2025-09-25",
      min: 28.5, max: 32.0,
      iconKey: "cloud",      // "04n" of the 08:30 entry — closest to noon
      popPct: 40,
    });
    expect(days[1]).toEqual({
      date: "2025-09-26",
      min: 25.0, max: 33.0,
      iconKey: "moon",       // "01n" of the 17:30 entry — closest to noon
      popPct: 80,
    });
  });
});

describe("normalize: pickUvHour", () => {
  it("selects the anchor hour's UV", () => {
    expect(pickUvHour(uvBundle.hourly.time, uvBundle.hourly.uv_index, "2025-09-25T05:30")).toBe(6.2);
  });
  it("degrades gracefully on empty/short arrays", () => {
    expect(pickUvHour([], [], "2025-09-25T05:30")).toBeNull();
    expect(pickUvHour(["2025-09-25T00:00"], [null], "2025-09-25T05:30")).toBeNull();
  });
});

describe("openweather provider", () => {
  it("normalises current+forecast into the contract DTO (UV stitched in)", async () => {
    const calls = stubFetch([
      ["data/2.5/weather", owmCurrent],
      ["data/2.5/forecast", owmForecast],
      ["api.open-meteo.com", uvBundle],
    ]);

    const dto = await openweatherProvider.fetchWeather({ city: "Hyderabad" });

    // three upstream calls: current, forecast, uv-supplement
    expect(calls).toHaveBeenCalledTimes(3);
    expect(calls.mock.calls[0][0]).toContain("q=Hyderabad");
    expect(calls.mock.calls[0][0]).toContain("appid=test-key-owm");

    expect(dto.source).toBe("openweather");
    expect(dto.place).toEqual({ city: "Hyderabad", country: "IN", lat: 17.385, lon: 78.4867 });
    expect(dto.meta.cached).toBe(false);
    expect(typeof dto.meta.fetchedAt).toBe("string");

    expect(dto.current.temp).toBe(31.0);
    expect(dto.current.feelsLike).toBe(33.5);
    expect(dto.current.humidity).toBe(56);
    expect(dto.current.windKmh).toBeCloseTo(14.76, 2);   // 4.1 m/s → km/h
    expect(dto.current.pressureHpa).toBe(1009);
    expect(dto.current.visibilityKm).toBe(9);            // 9000 m → 9 km
    expect(dto.current.uv).toBe(6.2);                    // stitched from Open-Meteo
    expect(dto.current.description).toBe("broken clouds");
    expect(dto.current.iconKey).toBe("cloud");
    expect(dto.current.theme).toBe("cloudy");
    expect(dto.current.sunrise).toBe("11:20");           // city-local wall clock
    expect(dto.current.sunset).toBe("23:10");
    expect(dto.current.localTime).toBe("2025-09-25T05:30");

    expect(dto.hourly).toHaveLength(4);
    expect(dto.hourly[0]).toEqual({
      time: "2025-09-25T05:30", temp: 31.0, iconKey: "cloud", popPct: 10,
    });

    expect(dto.daily).toHaveLength(2);
    expect(dto.daily[0].min).toBe(28.5);
    expect(dto.daily[0].max).toBe(32.0);
  });

  it("maps upstream statuses to contract codes", async () => {
    stubFetch([["data/2.5/weather", () => ({ ok: false, status: 404, json: async () => ({}) })]]);
    await expect(openweatherProvider.fetchWeather({ city: "Nowhere" }))
      .rejects.toMatchObject({ code: "CITY_NOT_FOUND", status: 404 });
  });

  it("treats 401 as a server-config problem, not the user's fault", async () => {
    stubFetch([
      ["data/2.5/weather", () => ({ ok: false, status: 401, json: async () => ({}) })],
      ["data/2.5/forecast", () => ({ ok: false, status: 401, json: async () => ({}) })],
    ]);
    await expect(openweatherProvider.fetchWeather({ city: "Hyderabad" }))
      .rejects.toMatchObject({ code: "UPSTREAM_CONFIG", status: 502 });
  });

  it("geocodes through OWM direct", async () => {
    stubFetch([["geo/1.0/direct", owmGeocode]]);
    const hits = await openweatherProvider.geocode("Hyderabad");
    expect(hits).toHaveLength(2);
    expect(hits[0]).toMatchObject({ name: "Hyderabad", country: "IN", state: "Telangana" });
  });
});

describe("openmeteo provider", () => {
  it("geocodes, then normalises the bundle into the contract DTO", async () => {
    const calls = stubFetch([
      ["geocoding-api.open-meteo.com", meteoGeocode],
      ["api.open-meteo.com", meteoForecast],
    ]);

    const dto = await openmeteoProvider.fetchWeather({ city: "Hyderabad" });

    expect(calls).toHaveBeenCalledTimes(2);
    expect(calls.mock.calls[0][0]).toContain("name=Hyderabad");

    expect(dto.source).toBe("openmeteo");
    expect(dto.place).toEqual({ city: "Hyderabad", country: "IN", lat: 17.38405, lon: 78.45636 });

    expect(dto.current.temp).toBe(24.7);
    expect(dto.current.feelsLike).toBe(28.3);
    expect(dto.current.humidity).toBe(88);
    expect(dto.current.windKmh).toBe(11.2);
    expect(dto.current.pressureHpa).toBe(1010);     // hourly[idx=0]
    expect(dto.current.visibilityKm).toBe(12);      // 12000 m → 12 km
    expect(dto.current.uv).toBe(0);                 // uv_index[0]
    expect(dto.current.description).toBe("Drizzle"); // WMO 53
    expect(dto.current.iconKey).toBe("drizzle");    // is_day = 1
    expect(dto.current.theme).toBe("rain");
    expect(dto.current.sunrise).toBe("05:59");
    expect(dto.current.sunset).toBe("18:07");
    expect(dto.current.localTime).toBe("2025-09-25T05:30");

    // 24 hourly cards from the current hour, night icons after is_day flips
    expect(dto.hourly).toHaveLength(24);
    expect(dto.hourly[0]).toEqual({ time: "2025-09-25T05:00", temp: 24.7, iconKey: "drizzle", popPct: 10 });
    expect(dto.hourly[3].iconKey).toBe("thunder");  // weather_code 95
    expect(dto.hourly[13].iconKey).toBe("drizzle"); // is_day 0 → night icon of 53 is still drizzle
    expect(dto.hourly[13].popPct).toBe(23);

    expect(dto.daily).toHaveLength(5);
    expect(dto.daily[0]).toEqual({ date: "2025-09-25", min: 22.9, max: 30.8, iconKey: "drizzle", popPct: 0 });
    expect(dto.daily[2].iconKey).toBe("thunder");   // WMO 95
  });

  it("uses reverse geocoding for coordinate queries (GPS button)", async () => {
    stubFetch([
      ["api.open-meteo.com", meteoForecast],
      ["bigdatacloud.net", bigDataCloudReverse],
    ]);

    const dto = await openmeteoProvider.fetchWeather({ lat: 17.384, lon: 78.4563 });
    expect(dto.place.city).toBe("Hyderabad");
    expect(dto.place.country).toBe("IN");
  });

  it("survives a dead reverse-geocoder with a generic label", async () => {
    stubFetch([
      ["api.open-meteo.com", meteoForecast],
      ["bigdatacloud.net", () => ({ ok: false, status: 500, json: async () => ({}) })],
    ]);

    const dto = await openmeteoProvider.fetchWeather({ lat: 17.384, lon: 78.4563 });
    expect(dto.place.city).toBe("My Location");
  });

  it("raises CITY_NOT_FOUND when the geocoder has no results", async () => {
    stubFetch([["geocoding-api.open-meteo.com", { results: [] }]]);
    await expect(openmeteoProvider.fetchWeather({ city: "Xyzzy" }))
      .rejects.toMatchObject({ code: "CITY_NOT_FOUND", status: 404 });
  });

  it("maps upstream timeouts to UPSTREAM_TIMEOUT", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      const e = new Error("aborted");
      e.name = "AbortError";
      throw e;
    }));
    await expect(openmeteoProvider.fetchWeather({ city: "Hyderabad" }))
      .rejects.toMatchObject({ code: "UPSTREAM_TIMEOUT", status: 504 });
  });
});
