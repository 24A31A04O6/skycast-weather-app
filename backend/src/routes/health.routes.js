/* ============================================================================
 * SkyCast backend — src/routes/health.routes.js
 * ----------------------------------------------------------------------------
 * GET /api/v1/health — liveness + provider/cache configuration snapshot.
 * Consumed by uptime monitors, CI smoke tests, and curious humans.
 * ========================================================================== */
import { Router } from "express";
import { createRequire } from "node:module";
import { env } from "../config/env.js";

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
      openweather: env.OPENWEATHER_API_KEY ? "configured" : "not_configured",
      openmeteo: "keyless (backup / demo)",
    },
    cache: { backend: "memory", status: "pending_phase_3" },
    timestamp: new Date().toISOString(),
  });
});
