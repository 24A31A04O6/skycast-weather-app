/* ============================================================================
 * SkyCast backend — src/app.js
 * ----------------------------------------------------------------------------
 * Express application wiring (middleware order matters):
 *
 *   security headers → cors? → request log? → static frontend → /api/v1
 *     → 404 → uniform error handler
 *
 * `app` is exported WITHOUT listening so Supertest can drive it directly;
 * only src/server.js binds a port.
 * ========================================================================== */
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import cors from "cors";

import { env } from "./config/env.js";
import { API_PREFIX, CSP_DIRECTIVES } from "./config/constants.js";
import { apiRouter } from "./routes/index.js";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler.js";

const here = path.dirname(fileURLToPath(import.meta.url));
/** The single-origin deployment: this backend also serves the frontend. */
export const FRONTEND_DIR = path.resolve(here, "../../frontend");

export const app = express();

app.set("trust proxy", 1); // correct req.ips behind Railway/Render/Fly proxies

/* — Security headers (CSP per ARCHITECTURE.md §1; connect-src temporarily
     includes key-less provider hosts for the frontend's standalone demo
     mode — collapses to 'self' in Phase 4) — */
app.use(
  helmet({
    contentSecurityPolicy: { useDefaults: false, directives: CSP_DIRECTIVES },
  })
);

/* — CORS: same-origin needs nothing; enable only for split deployments — */
if (env.CORS_ORIGINS.length > 0) {
  app.use(cors({ origin: env.CORS_ORIGINS, maxAge: 86400 }));
}

/* — Request logging: human-readable in dev, silent in tests/prod — */
if (env.isDev) {
  app.use(morgan("dev"));
}

/* — Static frontend (single origin: no CORS, one deploy) — */
app.use(
  express.static(FRONTEND_DIR, {
    index: "index.html",
    maxAge: env.isProd ? "1h" : 0,
  })
);

/* — Versioned API — */
app.use(API_PREFIX, apiRouter);

/* — Terminal pair — */
app.use(notFoundHandler);
app.use(errorHandler);
