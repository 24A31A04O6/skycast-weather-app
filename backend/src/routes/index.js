/* ============================================================================
 * SkyCast backend — src/routes/index.js
 * ----------------------------------------------------------------------------
 * Mounts all feature routers under the versioned API prefix (/api/v1).
 * ========================================================================== */
import { Router } from "express";
import { healthRoutes } from "./health.routes.js";
import { weatherRoutes } from "./weather.routes.js";
import { geocodeRoutes } from "./geocode.routes.js";

export const apiRouter = Router();

apiRouter.use("/health", healthRoutes);
apiRouter.use("/weather", weatherRoutes);
apiRouter.use("/geocode", geocodeRoutes);
