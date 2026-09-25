/* ============================================================================
 * SkyCast backend — src/utils/errors.js
 * ----------------------------------------------------------------------------
 * AppError: every intentional failure in this codebase raises one, carrying
 * an HTTP status + a stable machine code from ERROR_CODES. Anything else is
 * an unexpected bug and is masked as INTERNAL_ERROR before reaching clients.
 * Also: asyncHandler — tiny wrapper so rejected promises hit the error
 * middleware instead of crashing the process.
 * ========================================================================== */
import { ERROR_CODES } from "../config/constants.js";

export class AppError extends Error {
  /**
   * @param {number} status    HTTP status code
   * @param {string} code      stable machine code (ERROR_CODES)
   * @param {string} message   human-readable, safe-to-expose message
   * @param {object} [opts]    { details?, cause?, expose? }
   */
  constructor(status, code, message, { details = undefined, cause = undefined, expose = true } = {}) {
    super(message, { cause });
    this.name = "AppError";
    this.status = status;
    this.code = ERROR_CODES[code] ? code : ERROR_CODES.INTERNAL_ERROR;
    this.details = details;
    this.expose = expose;
  }
}

/** Wrap an async route handler so rejections flow into errorHandler. */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
