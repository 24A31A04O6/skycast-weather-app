/* ============================================================================
 * SkyCast backend — src/routes/health.routes.js
 * ----------------------------------------------------------------------------
 * GET /api/v1/health — liveness + provider chain + live cache statistics.
 * Consumed by uptime monitors, CI smoke tests, and curious humans.
 * ========================================================================== */
import { Router } from "express";
import { createRequire } from "node:module";
import { env } from "../config/env.js";
import { cache } from "../cache/memoryCache.js";
import { providerChain } from "../providers/index.js";

const require = createRequire(import.meta.url);
const { version } = require("../../package.json");

export const healthRoutes = Router();

healthRoutes.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "skycast-backend",
    version,
    environment: env.NODE_ENV,
    uptimeSeconds: Math.round(process.uptime()),
    providers: {
      chain: providerChain().map((p) => p.name),
      openweather: env.OPENWEATHER_API_KEY ? "configured" : "not_configured",
      openmeteo: "keyless (backup / demo)",
    },
    cache: {
      backend: "memory",
      status: "active",
      ...cache.stats(),
      ttl: {
        currentSeconds: env.CACHE_CURRENT_TTL,
        geocodeSeconds: env.CACHE_GEOCODE_TTL,
      },
    },
    timestamp: new Date().toISOString(),
  });
});
