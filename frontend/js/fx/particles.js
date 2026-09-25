/* ============================================================================
 * SkyCast frontend — js/fx/particles.js
 * ----------------------------------------------------------------------------
 * Particle/glow markup builders for the ambient FX layer. Every element
 * animates with transform/opacity only (off the main paint path) and is
 * frozen under prefers-reduced-motion via the stylesheet.
 * ========================================================================== */

export const rnd = (min, max) => min + Math.random() * (max - min);

export const cloud = (n, o) => Array.from({ length: n }, () =>
  `<span class="fx-cloud" style="--w:${rnd(38, 60).toFixed(0)}vmin;top:${rnd(-6, 34).toFixed(0)}%;` +
  `--d:${rnd(55, 110).toFixed(0)}s;--delay:${(-rnd(0, 90)).toFixed(0)}s;--o:${(o * rnd(0.7, 1)).toFixed(2)}"></span>`
).join("");

export const stars = (n) => Array.from({ length: n }, () =>
  `<span class="fx-star" style="left:${rnd(0, 100).toFixed(1)}%;top:${rnd(0, 68).toFixed(1)}%;` +
  `--s:${rnd(1.5, 3).toFixed(1)}px;--d:${rnd(2, 5).toFixed(1)}s;--delay:${rnd(0, 4).toFixed(1)}s"></span>`
).join("");

export const shooting = () =>
  `<span class="fx-shooting" style="--y:${rnd(8, 28).toFixed(0)}%;--delay:${rnd(2, 8).toFixed(0)}s"></span>`;

export const rain = (n) => Array.from({ length: n }, () =>
  `<span class="fx-rain" style="left:${rnd(0, 100).toFixed(1)}%;--len:${rnd(48, 96).toFixed(0)}px;` +
  `--d:${rnd(0.55, 1.05).toFixed(2)}s;--delay:${rnd(0, 1.6).toFixed(2)}s;--tilt:${rnd(7, 12).toFixed(0)}deg"></span>`
).join("");

export const snow = (n) => Array.from({ length: n }, () =>
  `<span class="fx-snow" style="left:${rnd(0, 100).toFixed(1)}%;--s:${rnd(3, 7).toFixed(1)}px;` +
  `--d:${rnd(7, 14).toFixed(1)}s;--delay:${rnd(0, 10).toFixed(1)}s;--sway:${rnd(-7, 7).toFixed(1)}vw;` +
  `--o:${rnd(0.45, 0.9).toFixed(2)}"></span>`
).join("");

export const fog = (n) => Array.from({ length: n }, (_, i) =>
  `<span class="fx-fog" style="top:${18 + i * 26}%;--h:${rnd(13, 20).toFixed(0)}vh;` +
  `--d:${rnd(38, 70).toFixed(0)}s;--o:${rnd(0.55, 0.85).toFixed(2)}"></span>`
).join("");
