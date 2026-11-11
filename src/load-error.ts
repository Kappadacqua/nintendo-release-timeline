/**
 * Error state shared by the three pages: what failed, a way out (reload) and the technical
 * reason in small print. Announced to screen readers as an alert.
 */
export function showLoadError(status: HTMLElement, what: "games" | "studios", err: unknown) {
  status.textContent = "";
  status.classList.add("app-status--error");
  status.setAttribute("role", "alert");

  const message = document.createElement("strong");
  message.textContent = `Couldn't load the ${what}.`;
  const hint = document.createElement("span");
  hint.textContent = "Check your connection and try again.";
  const retry = document.createElement("button");
  retry.type = "button";
  retry.className = "app-status__retry";
  retry.textContent = "Try again";
  retry.addEventListener("click", () => location.reload());
  const detail = document.createElement("small");
  detail.textContent = err instanceof Error ? err.message : String(err);

  status.append(message, hint, retry, detail);
}
