/* ============================================================================
 * SkyCast backend — src/controllers/geocode.controller.js
 * ----------------------------------------------------------------------------
 * Forward search (autocomplete / city lookup) and reverse label lookup for
 * the GPS button. Cached at 24 h — geocoding is near-static.
 * ========================================================================== */
import { asyncHandler } from "../utils/errors.js";
import * as weatherService from "../services/weather.service.js";

export const searchPlaces = asyncHandler(async (req, res) => {
  const { results, cacheState } = await weatherService.searchPlaces(req.validated.q);
  res.status(200).set("X-Cache", cacheState).set("Cache-Control", "no-store").json({
    results,
  });
});

export const reversePlaces = asyncHandler(async (req, res) => {
  const { place, cacheState } = await weatherService.reversePlace(
    req.validated.lat,
    req.validated.lon
  );
  res.status(200).set("X-Cache", cacheState).set("Cache-Control", "no-store").json({
    place, // may be null — cosmetic lookup, never an error
  });
});
