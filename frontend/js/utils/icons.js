/* ============================================================================
 * SkyCast frontend — js/utils/icons.js
 * ----------------------------------------------------------------------------
 * Inline stroke SVG icon set (zero external requests) + per-condition colors.
 * The ONLY weather "vocabulary" the frontend knows: iconKey strings that the
 * backend's normaliser guarantees (see backend/src/utils/normalize.js).
 * ========================================================================== */

const svgWrap = (inner, sw = 2) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" ` +
  `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

export const ICONS = {
  sun: svgWrap(
    `<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/>` +
    `<line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>` +
    `<line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/>` +
    `<line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>` +
    `<line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>`),
  moon: svgWrap(`<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>`),
  cloudSun: svgWrap(
    `<path d="M12 2v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="M20 12h2"/>` +
    `<path d="m19.07 4.93-1.41 1.41"/><path d="M15.947 12.65a4 4 0 0 0-5.925-4.128"/>` +
    `<path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"/>`),
  cloudMoon: svgWrap(
    `<g transform="translate(10.2,-0.4) scale(0.52)"><path stroke-width="3.8" ` +
    `d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></g>` +
    `<path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"/>`),
  cloud: svgWrap(`<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>`),
  drizzle: svgWrap(
    `<path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"/>` +
    `<line x1="8" y1="19" x2="8" y2="21"/><line x1="8" y1="13" x2="8" y2="15"/>` +
    `<line x1="16" y1="19" x2="16" y2="21"/><line x1="16" y1="13" x2="16" y2="15"/>` +
    `<line x1="12" y1="21" x2="12" y2="23"/><line x1="12" y1="15" x2="12" y2="17"/>`),
  rain: svgWrap(
    `<path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"/>` +
    `<line x1="16" y1="13" x2="16" y2="21"/><line x1="8" y1="13" x2="8" y2="21"/>` +
    `<line x1="12" y1="15" x2="12" y2="23"/>`),
  thunder: svgWrap(
    `<path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"/>` +
    `<polygon points="13 11 9 17 15 17 11 23 13 11"/>`),
  snow: svgWrap(
    `<path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"/>` +
    `<line x1="8" y1="16" x2="8" y2="18"/><line x1="8" y1="12" x2="8" y2="14"/>` +
    `<line x1="16" y1="18" x2="16" y2="20"/><line x1="16" y1="12" x2="16" y2="14"/>` +
    `<line x1="12" y1="14" x2="12" y2="16"/><line x1="12" y1="18" x2="12" y2="20"/>`),
  mist: svgWrap(
    `<line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="13" x2="21" y2="13"/>` +
    `<line x1="8" y1="17" x2="16" y2="17"/>`),
};

export const ICON_MINI = {
  pin: svgWrap(`<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>`, 2.2),
  drop: svgWrap(`<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>`, 2.4),
  retry: svgWrap(`<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>`, 2.4),
  alert: svgWrap(`<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>`),
  info: svgWrap(`<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>`),
  close: svgWrap(`<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>`, 2.4),
};

export const ICON_COLOR = {
  sun: "#ffd166", moon: "#c3ccff", cloudSun: "#ffdf9e", cloudMoon: "#bfc9f5",
  cloud: "#e6edff", drizzle: "#9fd6ff", rain: "#8ecbff", thunder: "#ffe08a",
  snow: "#d6ecff", mist: "#ccd6e6",
};
