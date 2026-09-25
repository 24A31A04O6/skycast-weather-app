/* ============================================================================
 * SkyCast E2E — tests/resilience.spec.js
 * ----------------------------------------------------------------------------
 * Failure modes, caching, GPS, and the architecture's prime directive:
 *   • unknown city → contextual toast with a working inline Retry
 *   • same city twice within TTL → backend answers X-Cache: HIT (1 upstream call)
 *   • GPS button (mocked browser geolocation) → backend reverse-geocodes + renders
 *   • CSP `connect-src 'self'` blocks direct provider access from the page;
 *     across a whole journey the only external traffic is Google Fonts
 * ========================================================================== */
import { expect, test } from "@playwright/test";

const INITIAL_CITY = "Hyderabad";

async function waitForDashboard(page) {
  await expect(page.locator("#content")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("#city-name")).toContainText(INITIAL_CITY, { timeout: 20_000 });
}

test("unknown city → toast with inline Retry that re-attempts the lookup", async ({ page }) => {
  let weatherCalls = 0;
  page.on("request", (r) => {
    if (r.url().includes("/api/v1/weather")) weatherCalls += 1;
  });

  await page.goto("/");
  await waitForDashboard(page);
  const base = weatherCalls;

  await page.fill("#search-input", "Xyzzy Not A City 123");
  await page.click("#search-btn");

  const toast = page.locator(".toast").first();
  await expect(toast).toBeVisible({ timeout: 15_000 });
  await expect(toast).toContainText("couldn't find");
  await expect(toast.locator(".toast__retry")).toBeVisible();
  const afterBogus = weatherCalls;
  expect(afterBogus).toBeGreaterThan(base);

  // Retry re-attempts the SAME lookup (one more request), toast re-appears
  await toast.locator(".toast__retry").click();
  expect(weatherCalls).toBeGreaterThan(afterBogus);
  await expect(page.locator(".toast").first()).toBeVisible();

  // Dismiss works
  await page.locator(".toast__close").first().click();
  await expect(page.locator(".toast")).toHaveCount(0, { timeout: 5_000 });
});

test("same city twice within TTL → second answer is a cache HIT", async ({ page }) => {
  const cacheStates = [];
  page.on("response", (r) => {
    if (r.url().includes("/api/v1/weather")) cacheStates.push(r.headers()["x-cache"] ?? "none");
  });

  await page.goto("/");
  await waitForDashboard(page); // first lookup → MISS (upstream)

  await page.fill("#search-input", "hyderabad"); // same key after normalisation
  await page.click("#search-btn");
  await expect(page.locator("#city-name")).toContainText("Hyderabad", { timeout: 20_000 });
  await expect(cacheStates.at(-1)).toBe("HIT"); // served from cache → upstream called once
});

test.describe("GPS button (mocked geolocation)", () => {
  test.use({
    permissions: ["geolocation"],
    geolocation: { latitude: 17.385, longitude: 78.4867 }, // Hyderabad, IN
  });

  test("uses coordinates; the backend reverse-geocodes the label", async ({ page }) => {
    await page.goto("/");
    await waitForDashboard(page);

    await page.click("#gps-btn");

    // The backend resolves the label for our coords — an Indian city, not "My Location"
    await expect(page.locator("#city-name")).toContainText(", IN", { timeout: 25_000 });
    await expect(page.locator("#city-name")).not.toContainText("My Location");
  });
});

test("prime directive: no provider traffic from the page, CSP blocks direct calls", async ({ page }) => {
  const externalRequests = [];
  page.on("request", (r) => {
    if (!r.url().startsWith("http://localhost:3000")) externalRequests.push(r.url());
  });

  await page.goto("/");
  await waitForDashboard(page);
  await page.fill("#search-input", "Tokyo");
  await page.click("#search-btn");
  await expect(page.locator("#city-name")).toContainText("Tokyo", { timeout: 20_000 });

  // Journey-level network proof: only font CDN traffic left the origin
  const offenders = externalRequests.filter((u) => !u.includes("fonts.g"));
  expect(offenders).toEqual([]);

  // Browser-level proof: CSP makes a direct provider fetch impossible
  const cspBlocked = await page.evaluate(async () => {
    try {
      await fetch("https://api.open-meteo.com/v1/forecast?latitude=0&longitude=0");
      return false; // fetched → separation is broken
    } catch {
      return true; // blocked by CSP, as designed
    }
  });
  expect(cspBlocked).toBe(true);
});
