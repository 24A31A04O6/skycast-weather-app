/* ============================================================================
 * SkyCast frontend — js/components/tiles.js
 * ----------------------------------------------------------------------------
 * The 8 metric tiles: humidity, wind, feels-like, UV, visibility, pressure,
 * sunrise, sunset. All values re-derived from the cached DTO on unit flips.
 * ========================================================================== */
import { tval, tunit, windText, visText, uvLabel, clock12 } from "../utils/format.js";

const el = {
  humidity: document.getElementById("m-humidity"),
  wind: document.getElementById("m-wind"),
  windSub: document.getElementById("m-wind-sub"),
  feels: document.getElementById("m-feels"),
  uv: document.getElementById("m-uv"),
  uvSub: document.getElementById("m-uv-sub"),
  vis: document.getElementById("m-vis"),
  visSub: document.getElementById("m-vis-sub"),
  pres: document.getElementById("m-pres"),
  sunrise: document.getElementById("m-sunrise"),
  sunset: document.getElementById("m-sunset"),
};

export function renderTiles(dto) {
  const c = dto.current ?? {};

  el.humidity.textContent = Number.isFinite(c.humidity) ? `${Math.round(c.humidity)}%` : "--";

  el.wind.textContent = Number.isFinite(c.windKmh) ? windText(c.windKmh) : "--";
  el.windSub.textContent = `Surface wind · ${c.windKmh == null ? "km/h" : (tunit() === "°F" ? "mph" : "km/h")}`;

  el.feels.textContent = Number.isFinite(c.feelsLike) ? `${tval(c.feelsLike)}${tunit()}` : "--";

  if (Number.isFinite(c.uv)) {
    el.uv.textContent = c.uv < 10 ? c.uv.toFixed(1) : String(Math.round(c.uv));
    el.uvSub.textContent = uvLabel(c.uv);
  } else {
    el.uv.textContent = "--";
    el.uvSub.textContent = "—";
  }

  if (Number.isFinite(c.visibilityKm)) {
    el.vis.textContent = visText(c.visibilityKm);
    el.visSub.textContent = `Air clarity · ${tunit() === "°F" ? "miles" : "km"}`;
  } else {
    el.vis.textContent = "--";
    el.visSub.textContent = "—";
  }

  el.pres.textContent = Number.isFinite(c.pressureHpa) ? `${Math.round(c.pressureHpa)} hPa` : "--";
  el.sunrise.textContent = c.sunrise ? clock12(c.sunrise) : "--";
  el.sunset.textContent = c.sunset ? clock12(c.sunset) : "--";
}
