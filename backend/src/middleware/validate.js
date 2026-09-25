/* ============================================================================
 * SkyCast backend — src/middleware/validate.js
 * ----------------------------------------------------------------------------
 * Zod schemas for every query string we accept, plus a tiny middleware
 * factory. Validated (and sanitised) values replace req.query as
 * req.validated — controllers never touch raw input.
 * ========================================================================== */
import { z } from "zod";
import { AppError } from "../utils/errors.js";

/** Free-text city: unicode letters/spaces + common punctuation, 1–80 chars. */
const citySchema = z.string().trim().min(1).max(80)
  .regex(/^[\p{L}\p{M}\p{N}\s'’.,\-()]+$/u, "contains unsupported characters");

export const weatherQuerySchema = z
  .object({
    city: citySchema.optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lon: z.coerce.number().min(-180).max(180).optional(),
  })
  .refine(
    (v) => (v.city != null ? v.lat == null && v.lon == null : v.lat != null && v.lon != null),
    { message: "Provide either ?city=… or both ?lat= and ?lon= — not both, not neither." }
  )
  .transform((v) => (v.city != null ? { city: v.city } : { lat: v.lat, lon: v.lon }));

export const geocodeQuerySchema = z.object({ q: citySchema });

export const reverseQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});

/**
 * Middleware factory — validates req.query against `schema`.
 * On success: req.validated = parsed value. On failure: 400 BAD_QUERY with
 * per-field details (zod issues flattened).
 */
export const validateQuery = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.query ?? {});
  if (!result.success) {
    return next(new AppError(400, "BAD_QUERY", "Invalid query parameters.", {
      details: result.error.flatten().fieldErrors,
    }));
  }
  req.validated = result.data;
  next();
};
