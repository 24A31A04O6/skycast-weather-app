/* ============================================================================
 * SkyCast frontend — js/components/chips.js
 * ----------------------------------------------------------------------------
 * Recent-city quick chips. One tap = one precise lat/lon lookup through the
 * backend. The active chip mirrors the currently displayed city.
 * ========================================================================== */
import { ICON_MINI } from "../utils/icons.js";
import { getRecents } from "../store/recents.js";
import { state } from "../store/state.js";

const host = document.getElementById("chips");
let onPick = null;

/** @param {(lat: number, lon: number, label: string) => void} callback */
export function initChips(callback) {
  onPick = callback;
}

export function renderChips() {
  const recents = getRecents();
  if (!recents.length) {
    host.hidden = true;
    host.innerHTML = "";
    return;
  }

  host.hidden = false;
  host.innerHTML = "";

  recents.forEach((r, i) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.style.animationDelay = `${i * 45}ms`;

    const isActive =
      state.lastData &&
      r.label.toLowerCase() === (state.lastData.place?.city ?? "").toLowerCase() &&
      (r.country ?? "").toLowerCase() === (state.lastData.place?.country ?? "").toLowerCase();
    if (isActive) chip.classList.add("is-active");

    const icon = document.createElement("span");
    icon.innerHTML = ICON_MINI.pin;
    chip.appendChild(icon.firstChild);

    const label = document.createElement("span");
    label.textContent = r.label;
    chip.appendChild(label);

    if (r.country) {
      const cc = document.createElement("small");
      cc.textContent = r.country;
      chip.appendChild(cc);
    }

    chip.setAttribute("aria-label", `Show weather for ${r.label}`);
    chip.addEventListener("click", () => onPick?.(r.lat, r.lon, r.label));
    host.appendChild(chip);
  });
}
