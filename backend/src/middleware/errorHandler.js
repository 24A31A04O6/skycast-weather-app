/* ============================================================================
 * SkyCast backend — src/middleware/errorHandler.js
 * ----------------------------------------------------------------------------
 * Terminal middleware pair producing the contract's uniform error shape:
 *     404s            → notFoundHandler
 *     everything else → errorHandler  →  { error: { code, message } }
 *
 * Rules:
 *  • AppError            → status + code + message exposed as-is
 *  • body-parser errors  → 400 BAD_JSON (message masked)
 *  • anything else       → 500 INTERNAL_ERROR (message masked, stack logged)
 * Raw upstream/provider errors are NEVER forwarded — this is the leak-guard.
 * ========================================================================== */
import { AppError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export function notFoundHandler(req, res, next) {
  next(new AppError(404, "NOT_FOUND", `Route ${req.method} ${req.originalUrl} does not exist.`));
}

// eslint-disable-next-line no-unused-vars — Express needs the 4-arg signature
export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    if (err.status >= 500) logger.error(`${err.code}:`, err.message, err.cause ?? "");
    if (!res.headersSent) {
      res.status(err.status).json({
        error: {
          code: err.code,
          message: err.expose ? err.message : "Internal server error.",
          ...(err.details ? { details: err.details } : {}),
        },
      });
    }
    return;
  }

  /* Malformed JSON bodies etc. (body-parser sets .type/.status) */
  if (err?.type === "entity.parse.failed" || err?.status === 400) {
    if (!res.headersSent) {
      res.status(400).json({
        error: { code: "BAD_JSON", message: "Request body is not valid JSON." },
      });
    }
    return;
  }

  /* Unknown bug — log it fully, expose nothing. */
  logger.error("UNHANDLED:", err?.stack || err);
  if (!res.headersSent) {
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Something went wrong on our side." },
    });
  }
}
