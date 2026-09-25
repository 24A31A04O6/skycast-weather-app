/* ============================================================================
 * SkyCast frontend — js/components/skeleton.js
 * ----------------------------------------------------------------------------
 * Loading orchestration. First paint (nothing rendered yet) → skeleton
 * shimmer mirroring the dashboard layout; any later refresh → the existing
 * content dims subtly, so switching cities never jars or shifts layout.
 * ========================================================================== */

const el = {
  skeleton: document.getElementById("skeleton"),
  content: document.getElementById("content"),
};

export function beginLoading() {
  if (el.content.hidden) {
    el.skeleton.hidden = false;
  } else {
    el.content.classList.add("is-refreshing");
  }
}

export function endLoading() {
  el.skeleton.hidden = true;
  el.content.classList.remove("is-refreshing");
}

/** Reveal after a successful load, replaying the staggered entrance. */
export function revealContent(animate = true) {
  el.skeleton.hidden = true;
  el.content.hidden = false;
  el.content.classList.remove("is-refreshing");
  if (animate) {
    el.content.classList.remove("anim-children");
    void el.content.offsetWidth; // restart the entrance animation
    el.content.classList.add("anim-children");
  }
}
