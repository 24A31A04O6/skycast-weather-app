/* ============================================================================
 * SkyCast frontend — js/fx/engine.js
 * ----------------------------------------------------------------------------
 * Builds the themed ambient layer (blobs + condition particles) and
 * cross-fades it whenever the weather theme changes.
 * ========================================================================== */
import { cloud, stars, shooting, rain, snow, fog, rnd } from "./particles.js";

const host = document.getElementById("fx");
let fadeTimer = null;

const BLOBS = `<span class="fx-blob fx-blob--a"></span><span class="fx-blob fx-blob--b"></span><span class="fx-blob fx-blob--c"></span>`;

const fxMarkup = {
  "clear-day": () => `
    <span class="fx-glow"></span>
    ${cloud(2, 0.5)}`,
  "clear-night": () => `
    <span class="fx-glow fx-glow--moon"></span>
    ${stars(60)}${shooting()}`,
  "partly-day": () => `
    <span class="fx-glow fx-glow--soft"></span>
    ${cloud(3, 0.8)}`,
  "partly-night": () => `
    <span class="fx-glow fx-glow--moon"></span>
    ${cloud(3, 0.7)}${stars(20)}`,
  "cloudy": () => cloud(4, 0.9),
  "rain": () => `${cloud(3, 0.9)}${rain(55)}`,
  "storm": () => `${cloud(3, 0.95)}${rain(45)}<span class="fx-lightning" style="--d:${rnd(7, 11).toFixed(1)}s;--delay:${rnd(1, 5).toFixed(1)}s"></span>`,
  "snow": () => `${cloud(2, 0.7)}${snow(45)}`,
  "mist": () => fog(3),
  "default": () => "",
};

export function buildFX(theme) {
  clearTimeout(fadeTimer);
  host.classList.add("is-fading");
  fadeTimer = setTimeout(() => {
    const build = fxMarkup[theme] ?? fxMarkup.default;
    host.innerHTML = BLOBS + build();
    host.classList.remove("is-fading");
  }, 340);
}
