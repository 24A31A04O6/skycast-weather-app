/* ============================================================================
 * SkyCast frontend — js/components/daily.js
 * ----------------------------------------------------------------------------
 * 5-day forecast rows with gradient min→max temperature range bars, scaled
 * across the week's overall span.
 * ========================================================================== */
import { ICONS, ICON_COLOR } from "../utils/icons.js";
import { dayLabel, tval } from "../utils/format.js";

const el = {
  daily: document.getElementById("daily"),
};

export function renderDaily(dto) {
  const days = dto.daily ?? [];
  const mins = days.map((d) => d.min).filter(Number.isFinite);
  const maxs = days.map((d) => d.max).filter(Number.isFinite);
  const weekMin = mins.length ? Math.min(...mins) : 0;
  const weekMax = maxs.length ? Math.max(...maxs) : 1;
  const span = Math.max(weekMax - weekMin, 1);

  el.daily.innerHTML = days.map((d, i) => {
    const left = Number.isFinite(d.min) ? ((d.min - weekMin) / span) * 100 : 0;
    const width = Number.isFinite(d.min) && Number.isFinite(d.max)
      ? Math.max(((d.max - d.min) / span) * 100, 6) : 6;
    return `
    <div class="day" role="listitem" style="animation-delay:${i * 55}ms">
      <span class="day__name${i === 0 ? " day__name--today" : ""}">${i === 0 ? "Today" : dayLabel(d.date)}</span>
      <span class="day__icon" style="color:${ICON_COLOR[d.iconKey] ?? "#e6edff"}">${ICONS[d.iconKey] ?? ICONS.cloud}</span>
      <span class="day__min">${Number.isFinite(d.min) ? tval(d.min) + "°" : "--"}</span>
      <span class="day__bar"><span class="day__bar-fill" style="left:${left.toFixed(1)}%;width:${width.toFixed(1)}%"></span></span>
      <span class="day__max">${Number.isFinite(d.max) ? tval(d.max) + "°" : "--"}</span>
    </div>`;
  }).join("");
}
