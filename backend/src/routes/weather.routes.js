/* ============================================================================
 * SkyCast backend — src/routes/weather.routes.js
 * ----------------------------------------------------------------------------
 * GET /api/v1/weather?city=… | ?lat=&lon=
 *   rate-limited → validated → cached service → contract DTO
 * (LIVE as of Phase 3 — replaces the Phase 1 501 stub.)
 * ========================================================================== */
import { Router } from "express";
import { apiRateLimit } from "../middleware/rateLimit.js";
import { validateQuery, weatherQuerySchema } from "../middleware/validate.js";
import { getWeather } from "../controllers/weather.controller.js";

export const weatherRoutes = Router();

weatherRoutes.get("/", apiRateLimit, validateQuery(weatherQuerySchema), getWeather);
