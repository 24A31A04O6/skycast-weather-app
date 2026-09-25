/* ============================================================================
 * SkyCast backend — src/middleware/rateLimit.js
 * ----------------------------------------------------------------------------
 * Per-IP request limiter (express-rate-limit, in-memory store) answering in
 * the contract's error shape. Applied to the data endpoints, not /health.
 * Behind a proxy (Railway/Render/Fly) app.js's `trust proxy` keeps IPs real.
 * ========================================================================== */
import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";

/** Factory so tests/deployments can tune limits without touching env. */
export function createRateLimit({ max, windowMs = 60_000 } = {}) {
  return rateLimit({
    windowMs,
    max: max ?? env.RATE_LIMIT_PER_MINUTE,
    standardHeaders: "draft-7", // RateLimit-* + Retry-After
    legacyHeaders: false,
    message: { error: { code: "RATE_LIMITED", message: "Too many requests — slow down and retry shortly." } },
    handler: (req, res /* , next, options */) => {
      res.status(429).json({
        error: { code: "RATE_LIMITED", message: "Too many requests — slow down and retry shortly." },
      });
    },
  });
}

/** Default limiter for the API surface. */
export const apiRateLimit = createRateLimit();
