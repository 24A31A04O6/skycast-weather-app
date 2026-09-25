/* ============================================================================
 * SkyCast backend — src/routes/weather.routes.js
 * ----------------------------------------------------------------------------
 * GET /api/v1/weather?city=… | ?lat=&lon=
 *
 * PHASE 1 STUB — the route is contract-live but returns 501 until the
 * provider adapters (Phase 2) and cache/service layer (Phase 3) land.
 * Deliberately NOT wired to any provider yet: separation before features.
 * ========================================================================== */
import { Router } from "express";
import { AppError, asyncHandler } from "../utils/errors.js";

export const weatherRoutes = Router();

weatherRoutes.get(
  "/",
  asyncHandler(async () => {
    throw new AppError(
      501,
      "NOT_IMPLEMENTED",
      "GET /api/v1/weather arrives in Phases 2–3 (provider adapters + cache). See ARCHITECTURE.md."
    );
  })
);
