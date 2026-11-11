/**
 * Adds a control built at runtime (What's new, View, filters) to the header actions,
 * right after the page links: the DOM order then matches what is on screen
 * (page links first), so Tab and screen readers follow the visual order.
 */
export function addHeaderControl(host: HTMLElement, control: HTMLElement) {
  const nav = host.querySelector(".app-nav");
  if (nav) nav.after(control);
  else host.prepend(control);
}
