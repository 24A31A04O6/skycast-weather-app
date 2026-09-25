/* ============================================================================
 * SkyCast backend — src/utils/logger.js
 * ----------------------------------------------------------------------------
 * Zero-dependency leveled logger. Swap for pino later behind this interface.
 * Never log secrets: callers pass messages, not raw provider payloads.
 * ========================================================================== */
const stamp = () => new Date().toISOString();

export const logger = {
  info: (...args) => console.log(`[${stamp()}] INFO `, ...args),
  warn: (...args) => console.warn(`[${stamp()}] WARN `, ...args),
  error: (...args) => console.error(`[${stamp()}] ERROR`, ...args),
};
