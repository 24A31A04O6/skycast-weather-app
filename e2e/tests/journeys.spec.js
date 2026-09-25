/* ============================================================================
 * SkyCast E2E — tests/journeys.spec.js
 * ----------------------------------------------------------------------------
 * Core user journeys against the live stack:
 *   • cold start → skeleton shimmer → full dashboard
 *   • city search → hero / hourly / daily render
 *   • °C⇄°F toggle converts instantly with ZERO extra weather fetches
 *   • recent-search chips switch cities in one click
 * ========================================================================== */
import { expect, test } from "@playwright/test";

const INITIAL_CITY = "Hyderabad"; // the app's DEFAULT_CITY

async function waitForDashboard(page) {
  await expect(page.locator("#content")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("#city-name")).toContainText(INITIAL_CITY, { timeout: 20_000 });
}

test("cold start: skeleton shimmer first, then the full dashboard", async ({ page }) => {
  let delayed = false;
  await page.route("**/api/v1/weather*", async (route) => {
    if (!delayed) {
      delayed = true;
      await new Promise((r) => setTimeout(r, 2500)); // hold the FIRST lookup
    }
    await route.continue();
  });

  await page.goto("/");

  // While the (delayed) initial lookup is in flight: skeleton, no content
  await expect(page.locator("#skeleton")).toBeVisible();
  await expect(page.locator("#content")).toBeHidden();

  // Once it resolves: content, skeleton gone, all sections populated
  await waitForDashboard(page);
  await expect(page.locator("#skeleton")).toBeHidden();
  await expect(page.locator("#hourly .hour")).toHaveCount(24); // Open-Meteo serves 24 hourly steps
  await expect(page.locator("#daily .day")).toHaveCount(5);
  await expect(page.locator(".tile")).toHaveCount(8);
  await expect(page.locator("#weather-desc")).not.toHaveText("--");
});

test("searching a city re-renders the whole dashboard", async ({ page }) => {
  await page.goto("/");
  await waitForDashboard(page);

  await page.fill("#search-input", "Tokyo");
  await page.click("#search-btn");

  await expect(page.locator("#city-name")).toContainText("Tokyo", { timeout: 20_000 });
  await expect(page.locator("#temp-value")).not.toHaveText("--");
  await expect(page.locator("#hourly .hour").first()).toContainText("Now");
  await expect(page.locator("#daily .day")).toHaveCount(5);
  await expect(page.locator("#app-footer")).toContainText("Live data");
});

test("°C→°F toggle converts instantly from cached data (zero refetch)", async ({ page }) => {
  let weatherCalls = 0;
  page.on("request", (r) => {
    if (r.url().includes("/api/v1/weather")) weatherCalls += 1;
  });

  await page.goto("/");
  await waitForDashboard(page);
  const callsAfterLoad = weatherCalls;

  const tempC = Number(await page.locator("#temp-value").textContent());
  await expect(page.locator("#temp-unit")).toHaveText("°C");

  await page.click('.units__btn[data-unit="f"]');

  await expect(page.locator("#temp-unit")).toHaveText("°F");
  const tempF = Number(await page.locator("#temp-value").textContent());
  expect(tempF).toBeGreaterThanOrEqual(tempC + 20); // same physical temp, scaled
  await expect(page.locator("#m-wind")).toContainText("mph");

  // The whole point: presentation-only switch → no new weather requests
  expect(weatherCalls).toBe(callsAfterLoad);
});

test("recent-search chips switch cities in one click", async ({ page }) => {
  await page.goto("/");
  await waitForDashboard(page);

  await page.fill("#search-input", "Tokyo");
  await page.click("#search-btn");
  await expect(page.locator("#city-name")).toContainText("Tokyo", { timeout: 20_000 });

  const chipRow = page.locator("#chips");
  await expect(chipRow).toBeVisible();
  await expect(chipRow.locator(".chip", { hasText: "Tokyo" })).toBeVisible();

  await chipRow.locator(".chip", { hasText: "Hyderabad" }).click();
  await expect(page.locator("#city-name")).toContainText("Hyderabad", { timeout: 20_000 });
});
