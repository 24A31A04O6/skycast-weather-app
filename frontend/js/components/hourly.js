/* ============================================================================
 * SkyCast frontend — js/components/hourly.js
 * ----------------------------------------------------------------------------
 * Next-24-hours slider: horizontal scroll with drag-to-scroll on desktop,
 * native swipe + vertical-wheel translation on touch. Data comes from the
 * backend's hourly array (first entry = "Now").
 * ========================================================================== */
import { ICONS, ICON_MINI, ICON_COLOR } from "../utils/icons.js";
import { hourLabel, tval } from "../utils/format.js";

const el = {
  hourly: document.getElementById("hourly"),
};

export function renderHourly(dto) {
  el.hourly.innerHTML = (dto.hourly ?? []).map((h, i) => `
    <div class="hour${i === 0 ? " hour--now" : ""}" role="listitem">
      <span class="hour__time">${i === 0 ? "Now" : hourLabel(h.time)}</span>
      <span class="hour__icon" style="color:${ICON_COLOR[h.iconKey] ?? "#e6edff"}">${ICONS[h.iconKey] ?? ICONS.cloud}</span>
      <span class="hour__temp">${Number.isFinite(h.temp) ? tval(h.temp) + "°" : "--"}</span>
      <span class="hour__pop">${h.popPct ? ICON_MINI.drop + h.popPct + "%" : ""}</span>
    </div>`).join("");
}

/** Drag-to-scroll + wheel→horizontal translation for the strip. */
export function initHourlyScroller() {
  let dragging = false, startX = 0, startScroll = 0;

  el.hourly.addEventListener("pointerdown", (e) => {
    dragging = true;
    startX = e.clientX;
    startScroll = el.hourly.scrollLeft;
    el.hourly.setPointerCapture(e.pointerId);
  });
  el.hourly.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 4) el.hourly.classList.add("is-dragging");
    el.hourly.scrollLeft = startScroll - dx;
  });
  const stop = () => { dragging = false; el.hourly.classList.remove("is-dragging"); };
  el.hourly.addEventListener("pointerup", stop);
  el.hourly.addEventListener("pointercancel", stop);

  el.hourly.addEventListener("wheel", (e) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      el.hourly.scrollLeft += e.deltaY;
    }
  }, { passive: false });
}
