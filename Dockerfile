# ============================================================================
# SkyCast — production image
# ----------------------------------------------------------------------------
# Single small image: Express serves BOTH the API and the frontend (the exact
# repo geometry is preserved — backend/src + frontend side by side — so
# src/app.js's relative FRONTEND_DIR resolves identically).
#
# Build:   docker build -t skycast .
# Run:     docker run -p 3000:3000 -e OPENWEATHER_API_KEY=xxx skycast
# Probe:   curl http://localhost:3000/api/v1/health
# ============================================================================
FROM node:20-alpine

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app/backend

# Dependencies first — this layer caches unless the lockfile changes.
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Application code (backend + the static frontend it serves)
COPY backend/src ./src
COPY frontend /app/frontend

# Never run as root
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/v1/health" >/dev/null 2>&1 || exit 1

CMD ["node", "src/server.js"]
