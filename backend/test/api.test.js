/* ============================================================================
 * SkyCast backend — test/api.test.js
 * ----------------------------------------------------------------------------
 * HTTP-level contract tests for the Phase 1 skeleton (Supertest drives the
 * app without binding a port). These encode ARCHITECTURE.md §2.1:
 *   • health answers 200 with a known shape
 *   • unknown routes → 404 { error: { code: "NOT_FOUND" } }
 *   • contract-live stubs → 501 { error: { code: "NOT_IMPLEMENTED" } }
 *   • / serves the frontend HTML (single-origin wiring)
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
    expect(res.body.providers).toHaveProperty("openweather");
    expect(res.body.providers).toHaveProperty("openmeteo");
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

describe("Phase 1 contract stubs", () => {
  it("GET /api/v1/weather → 501 NOT_IMPLEMENTED", async () => {
    const res = await request(app).get("/api/v1/weather?city=hyderabad");

    expect(res.status).toBe(501);
    expect(res.body.error.code).toBe("NOT_IMPLEMENTED");
  });

  it("GET /api/v1/geocode → 501 NOT_IMPLEMENTED", async () => {
    const res = await request(app).get("/api/v1/geocode?q=hyd");

    expect(res.status).toBe(501);
    expect(res.body.error.code).toBe("NOT_IMPLEMENTED");
  });

  it("GET /api/v1/geocode/reverse → 501 NOT_IMPLEMENTED", async () => {
    const res = await request(app).get("/api/v1/geocode/reverse?lat=17.4&lon=78.5");

    expect(res.status).toBe(501);
    expect(res.body.error.code).toBe("NOT_IMPLEMENTED");
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
