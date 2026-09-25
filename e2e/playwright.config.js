/* ============================================================================
 * SkyCast E2E — playwright.config.js
 * ----------------------------------------------------------------------------
 * Boots the real stack (Express backend serving the frontend) via webServer
 * and drives it as a black box. In CI the server is always booted fresh;
 * locally an already-running instance on :3000 is reused.
 * ========================================================================== */
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],

  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },

  webServer: {
    command: "npm start",
    cwd: "../backend",
    url: "http://localhost:3000/api/v1/health",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
