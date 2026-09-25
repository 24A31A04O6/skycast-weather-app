/* ============================================================================
 * SkyCast backend — test/api.test.js
 * ----------------------------------------------------------------------------
 * HTTP-level contract tests for the always-on surface (no provider mocks
 * needed here — these routes never leave the server):
 *   • health answers 200 with a known shape (incl. live cache stats)
 *   • unknown routes → 404 { error: { code: "NOT_FOUND" } }
 *   • / serves the frontend HTML (single-origin wiring) + CSP header
 * Weather/geocode endpoint behaviour lives in weather.api.test.js, where
 * the provider chain is mocked.
 * ========================================================================== */
import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

describe("GET /api/v1/health", () => {
  it("responds 200 with the health contract", async () => {
    const res = await request(app).get("/api/v1/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.service).toBe("skycast-backend");
    expect(typeof res.body.uptimeSeconds).toBe("number");
    expect(Array.isArray(res.body.providers.chain)).toBe(true);
    expect(res.body.providers.chain).toContain("openmeteo");
    expect(res.body.cache.status).toBe("active");
    expect(typeof res.body.cache.hitRate).toBe("number");
    expect(typeof res.body.timestamp).toBe("string");
  });
});

describe("API 404 shape", () => {
  it("unknown API routes return the uniform error shape", async () => {
    const res = await request(app).get("/api/v1/definitely-not-a-route");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(typeof res.body.error.message).toBe("string");
    expect(res.body.error.message).not.toMatch(/stack|at\s+\//i); // no stack leakage
  });
});

describe("Single-origin static frontend", () => {
  it("GET / serves the app's HTML", async () => {
    const res = await request(app).get("/");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/html/);
    expect(res.text).toContain("SkyCast");
  });

  it("sets a Content-Security-Policy header", async () => {
    const res = await request(app).get("/");

    expect(res.headers["content-security-policy"]).toContain("default-src 'self'");
  });
});
