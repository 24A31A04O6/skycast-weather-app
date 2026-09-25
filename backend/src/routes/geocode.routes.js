/* ============================================================================
 * SkyCast backend — src/routes/geocode.routes.js
 * ----------------------------------------------------------------------------
 * GET /api/v1/geocode?q=…            (forward: city search)
 * GET /api/v1/geocode/reverse?lat=&lon=  (reverse: GPS button support)
 *
 * PHASE 1 STUB — 501 until the geocoding proxy (Phase 2/3).
 * ========================================================================== */
import { Router } from "express";
import { AppError, asyncHandler } from "../utils/errors.js";

export const geocodeRoutes = Router();

const stub = asyncHandler(async () => {
  throw new AppError(
    501,
    "NOT_IMPLEMENTED",
    "GET /api/v1/geocode arrives in Phases 2–3. See ARCHITECTURE.md."
  );
});

geocodeRoutes.get("/", stub);
geocodeRoutes.get("/reverse", stub);
