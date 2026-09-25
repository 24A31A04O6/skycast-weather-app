/* ============================================================================
 * SkyCast backend — src/server.js
 * ----------------------------------------------------------------------------
 * Entrypoint: binds the port and handles graceful shutdown (SIGINT/SIGTERM).
 * Run:  npm start  (or  npm run dev  for --watch restarts)
 * ========================================================================== */
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { app } from "./app.js";

const server = app.listen(env.PORT, () => {
  logger.info(`SkyCast backend v${process.env.npm_package_version ?? "dev"} listening on :${env.PORT} (${env.NODE_ENV})`);
  if (!env.OPENWEATHER_API_KEY) {
    logger.warn("OPENWEATHER_API_KEY is not set — /api/v1/weather is served by the key-less Open-Meteo provider (add a key to enable the OpenWeatherMap primary).");
  }
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    logger.info(`${signal} received — shutting down gracefully…`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref(); // hard-exit safety net
  });
}
