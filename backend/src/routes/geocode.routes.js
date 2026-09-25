/* ============================================================================
 * SkyCast backend — src/routes/geocode.routes.js
 * ----------------------------------------------------------------------------
 * GET /api/v1/geocode?q=…                — forward city search
 * GET /api/v1/geocode/reverse?lat=&lon=  — reverse label for the GPS button
 * (LIVE as of Phase 3 — replaces the Phase 1 501 stubs.)
 * ========================================================================== */
import { Router } from "express";
import { apiRateLimit } from "../middleware/rateLimit.js";
import { validateQuery, geocodeQuerySchema, reverseQuerySchema } from "../middleware/validate.js";
import { searchPlaces, reversePlaces } from "../controllers/geocode.controller.js";

export const geocodeRoutes = Router();

geocodeRoutes.get("/", apiRateLimit, validateQuery(geocodeQuerySchema), searchPlaces);
geocodeRoutes.get("/reverse", apiRateLimit, validateQuery(reverseQuerySchema), reversePlaces);
