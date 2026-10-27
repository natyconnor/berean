/** Put the result banner fully below the session header after Check answer. */
export function scrollResultBannerIntoView(banner: HTMLElement | null) {
  if (!banner || typeof banner.scrollIntoView !== "function") return;
  banner.scrollIntoView({ block: "start", inline: "nearest" });
  const header = document.querySelector("header");
  if (!header) return;
  const overlap =
    header.getBoundingClientRect().bottom - banner.getBoundingClientRect().top;
  if (overlap <= 0) return;
  const scroller =
    banner.closest("[data-slot='scroll-area-viewport']") ??
    banner.closest(".overflow-auto");
  if (scroller instanceof HTMLElement) {
    scroller.scrollTop -= overlap + 8;
  }
}
