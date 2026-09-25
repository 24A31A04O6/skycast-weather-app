/* ============================================================================
 * SkyCast frontend — js/components/toasts.js
 * ----------------------------------------------------------------------------
 * Contextual error/info toasts with inline retry actions. Messages come
 * straight from the backend's { error: { message } } copy — the frontend
 * never rewrites server semantics, it just presents them.
 * ========================================================================== */
import { ICON_MINI } from "../utils/icons.js";

const host = document.getElementById("toasts");

export function toast({ type = "error", message, actions = [], duration = 9000 }) {
  while (host.children.length >= 3) host.lastChild.remove();

  const node = document.createElement("div");
  node.className = `toast${type === "info" ? " toast--info" : ""}`;
  node.setAttribute("role", type === "error" ? "alert" : "status");

  const iconSpan = document.createElement("span");
  iconSpan.innerHTML = type === "error" ? ICON_MINI.alert : ICON_MINI.info;

  const body = document.createElement("div");
  body.className = "toast__msg";
  body.textContent = message; // textContent — safe for any server/city string

  if (actions.length) {
    const row = document.createElement("div");
    row.className = "toast__actions";
    for (const a of actions) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "toast__retry";
      b.innerHTML = `${a.icon ? a.icon : ""}<span></span>`;
      b.querySelector("span").textContent = a.label;
      b.addEventListener("click", () => { close(); a.onClick(); });
      row.appendChild(b);
    }
    body.appendChild(row);
  }

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "toast__close";
  closeBtn.setAttribute("aria-label", "Dismiss");
  closeBtn.innerHTML = ICON_MINI.close;

  const close = () => {
    if (!node.isConnected) return;
    node.classList.add("is-leaving");
    setTimeout(() => node.remove(), 260);
  };
  closeBtn.addEventListener("click", close);

  node.append(iconSpan, body, closeBtn);
  host.prepend(node);
  if (duration) setTimeout(close, duration);
  return { close };
}
