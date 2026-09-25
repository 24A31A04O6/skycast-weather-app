/* ============================================================================
 * SkyCast frontend — js/components/search.js
 * ----------------------------------------------------------------------------
 * Search form + GPS button. Pure DOM wiring — handlers are injected from
 * main.js so this module stays free of data logic.
 * ========================================================================== */
import { ICON_MINI } from "../utils/icons.js";
import { toast } from "./toasts.js";

const el = {
  form: document.getElementById("search-form"),
  input: document.getElementById("search-input"),
  btn: document.getElementById("search-btn"),
  gps: document.getElementById("gps-btn"),
};

let onCity = null;
let onGps = null;

export function initSearch({ onCitySearch, onGpsClick }) {
  onCity = onCitySearch;
  onGps = onGpsClick;

  el.form.addEventListener("submit", (event) => {
    event.preventDefault();
    const city = el.input.value.trim();
    if (!city) {
      toast({ type: "info", message: "Please type a city name — for example “Hyderabad” or “Tokyo”.", duration: 5000 });
      el.input.focus();
      return;
    }
    onCity(city);
  });

  el.gps.addEventListener("click", () => onGps?.());
}

export function setSearchBusy(busy) {
  el.btn.disabled = busy;
  el.input.setAttribute("aria-busy", String(busy));
}

export function setGpsBusy(busy) {
  el.gps.disabled = busy;
  el.gps.classList.toggle("is-busy", busy);
}

export function clearInput() {
  el.input.value = "";
}

export function blurInput() {
  el.input.blur();
}

export function focusInput() {
  el.input.focus();
}

export { ICON_MINI };
