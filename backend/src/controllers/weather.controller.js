/* ============================================================================
 * SkyCast backend — src/controllers/weather.controller.js
 * ----------------------------------------------------------------------------
 * Thin HTTP adapters: validated query in → service call → DTO + X-Cache out.
 * All business rules live in services/; all error mapping in errorHandler.
 * ========================================================================== */
import { asyncHandler } from "../utils/errors.js";
import * as weatherService from "../services/weather.service.js";

export const getWeather = asyncHandler(async (req, res) => {
  const { dto, cacheState } = await weatherService.getWeather(req.validated);
  res
    .status(200)
    .set("X-Cache", cacheState)
    .set("Cache-Control", "no-store") // freshness policy is OURS (X-Cache), not the browser's
    .json(dto);
});
