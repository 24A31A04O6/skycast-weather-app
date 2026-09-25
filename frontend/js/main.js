/* ============================================================================
 * SkyCast frontend — js/main.js
 * ----------------------------------------------------------------------------
 * Application entrypoint: wires stores, components, and the API client
 * together. ALL data flows through js/api/client.js → our backend
 * (/api/v1/*). This module has zero knowledge of weather providers —
 * provider choice, failover, caching, and keys live entirely server-side.
 * ========================================================================== */
import { fetchWeather } from "./api/client.js";
import { state, setLastData, setLastAction, retryLast } from "./store/state.js";
import { setUnits, syncUnitsUI } from "./store/units.js";
import { addRecent } from "./store/recents.js";
import { hintFor } from "./utils/errors.js";
import { buildFX } from "./fx/engine.js";
import { initChips, renderChips } from "./components/chips.js";
import { initSearch, setSearchBusy, setGpsBusy, clearInput, blurInput } from "./components/search.js";
import { beginLoading, endLoading, revealContent } from "./components/skeleton.js";
import { toast } from "./components/toasts.js";
import { renderHero } from "./components/hero.js";
import { renderHourly, initHourlyScroller } from "./components/hourly.js";
import { renderDaily } from "./components/daily.js";
import { renderTiles } from "./components/tiles.js";
import { ICON_MINI } from "./utils/icons.js";

const DEFAULT_CITY = "Hyderabad";

const el = {
  unitsToggle: document.getElementById("units-toggle"),
  footer: document.getElementById("app-footer"),
};

/* ── Rendering ───────────────────────────────────────────────────────────── */

function renderAll(dto, { animate = true } = {}) {
  document.body.dataset.theme = dto.current.theme;
  document.title = `SkyCast · ${dto.place.city}`;
  buildFX(dto.current.theme);

  renderHero(dto);
  renderHourly(dto);
  renderDaily(dto);
  renderTiles(dto);

  el.footer.innerHTML =
    `<span class="footer-dot"></span> Live data: ${dto.source}` +
    (dto.meta?.cached ? ` · cached` : ``);

  revealContent(animate);
  renderChips();
}

/* ── Error presentation ──────────────────────────────────────────────────── */

function handleError(err) {
  console.error("[SkyCast]", err);
  const actions = [{ label: "Retry", icon: ICON_MINI.retry, onClick: retryLast }];
  toast({ type: "error", message: err.message, actions, ...hintFor(err.code) });
}

/* ── Lookups ─────────────────────────────────────────────────────────────── */

async function loadWeather(city) {
  setLastAction(() => loadWeather(city));
  setSearchBusy(true);
  beginLoading();
  try {
    const dto = await fetchWeather({ city });
    setLastData(dto);
    addRecent({ city: dto.place.city, country: dto.place.country, lat: dto.place.lat, lon: dto.place.lon });
    renderAll(dto);
    clearInput();
    blurInput();
  } catch (err) {
    handleError(err);
  } finally {
    setSearchBusy(false);
    endLoading();
  }
}

async function loadByCoords(lat, lon, label = null) {
  setLastAction(() => loadByCoords(lat, lon, label));
  beginLoading();
  try {
    const dto = await fetchWeather({ lat, lon });
    setLastData(dto);
    addRecent({ city: dto.place.city, country: dto.place.country, lat: dto.place.lat, lon: dto.place.lon });
    renderAll(dto);
  } catch (err) {
    handleError(err);
  } finally {
    endLoading();
  }
}

/* ── GPS ─────────────────────────────────────────────────────────────────── */

async function onGpsClick() {
  if (!("geolocation" in navigator)) {
    toast({ type: "info", message: "Geolocation isn't supported by this browser — try searching for a city instead.", duration: 6000 });
    return;
  }
  setGpsBusy(true);
  try {
    const pos = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5 * 60 * 1000,
      });
    });
    await loadByCoords(
      Number(pos.coords.latitude.toFixed(4)),
      Number(pos.coords.longitude.toFixed(4)),
      null // the backend reverse-geocodes the label for us
    );
  } catch (error) {
    const messages = {
      1: "Location access was denied. You can allow it in your browser settings, or simply search for a city.",
      2: "Your location is currently unavailable. Try again in a moment, or search for a city.",
      3: "Locating you took too long. Check your connection and try again.",
    };
    const actions = error?.code === 3 ? [{ label: "Retry", icon: ICON_MINI.retry, onClick: onGpsClick }] : [];
    toast({ type: "error", message: messages[error?.code] ?? "Couldn't determine your location. Try searching for a city instead.", actions });
  } finally {
    setGpsBusy(false);
  }
}

/* ── Boot ────────────────────────────────────────────────────────────────── */

function init() {
  syncUnitsUI(el.unitsToggle);

  el.unitsToggle.addEventListener("click", (e) => {
    const btn = e.target.closest(".units__btn");
    if (btn && setUnits(btn.dataset.unit) && state.lastData) {
      renderAll(state.lastData, { animate: false }); // instant repaint from cache — no refetch
    }
  });
  initSearch({ onCitySearch: loadWeather, onGpsClick });
  initChips((lat, lon, label) => loadByCoords(lat, lon, label));
  initHourlyScroller();

  /* Offline resilience: notify on drop, auto-retry the last lookup on return. */
  window.addEventListener("offline", () => {
    toast({ type: "info", message: "You're offline — showing the last loaded data until the connection returns.", duration: 6000 });
  });
  window.addEventListener("online", () => {
    if (state.lastAction) {
      toast({ type: "info", message: "Back online — refreshing…", duration: 4000 });
      retryLast();
    }
  });

  loadWeather(DEFAULT_CITY);
}

init();
