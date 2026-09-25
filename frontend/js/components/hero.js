/* ============================================================================
 * SkyCast frontend — js/components/hero.js
 * ----------------------------------------------------------------------------
 * The main dashboard card: city, local date/time, floating condition icon,
 * big temperature, description, and today's H/L range.
 * ========================================================================== */
import { ICONS } from "../utils/icons.js";
import { heroDateTime, tval, tunit, capitalize } from "../utils/format.js";

const el = {
  city: document.getElementById("city-name"),
  date: document.getElementById("local-date"),
  iconBox: document.getElementById("weather-icon"),
  temp: document.getElementById("temp-value"),
  tempUnit: document.getElementById("temp-unit"),
  desc: document.getElementById("weather-desc"),
  hiLo: document.getElementById("hi-lo"),
  hi: document.getElementById("hi-value"),
  lo: document.getElementById("lo-value"),
};

export function renderHero(dto) {
  const { place, current, daily } = dto;

  el.city.textContent = place.country ? `${place.city}, ${place.country}` : place.city;
  el.date.textContent = heroDateTime(current.localTime);

  el.iconBox.dataset.icon = current.iconKey;
  el.iconBox.innerHTML = ICONS[current.iconKey] ?? ICONS.cloud;

  el.temp.textContent = Number.isFinite(current.temp) ? tval(current.temp) : "--";
  el.tempUnit.textContent = tunit();
  el.desc.textContent = capitalize(current.description ?? "") || "—";

  const today = daily?.[0];
  if (today && Number.isFinite(today.min) && Number.isFinite(today.max)) {
    el.hi.textContent = `${tval(today.max)}°`;
    el.lo.textContent = `${tval(today.min)}°`;
    el.hiLo.hidden = false;
  } else {
    el.hiLo.hidden = true;
  }
}
