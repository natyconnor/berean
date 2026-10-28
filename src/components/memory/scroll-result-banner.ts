function sessionScroller(el: HTMLElement): HTMLElement | null {
  const scroller =
    el.closest("[data-slot='scroll-area-viewport']") ??
    el.closest(".overflow-auto");
  return scroller instanceof HTMLElement ? scroller : null;
}

/** Keep a session title or result banner fully below the session header. */
export function scrollBelowSessionHeader(el: HTMLElement | null) {
  if (!el || typeof el.scrollIntoView !== "function") return;
  el.scrollIntoView({ block: "start", inline: "nearest" });
  const header = document.querySelector("header");
  if (!header) return;
  const overlap =
    header.getBoundingClientRect().bottom - el.getBoundingClientRect().top;
  if (overlap <= 0) return;
  const scroller = sessionScroller(el);
  if (scroller) {
    scroller.scrollTop -= overlap + 8;
  }
}

/** Put the result banner fully below the session header after Check answer. */
export function scrollResultBannerIntoView(banner: HTMLElement | null) {
  scrollBelowSessionHeader(banner);
}

/** Keep a focused field above the Notes/Memory dock. */
export function scrollClearOfModeDock(el: HTMLElement | null) {
  if (!el || typeof el.scrollIntoView !== "function") return;
  el.scrollIntoView({ block: "nearest", inline: "nearest" });
  const dock = document.querySelector('[aria-label="Mode"]');
  if (!(dock instanceof HTMLElement)) return;
  const overlap =
    el.getBoundingClientRect().bottom - dock.getBoundingClientRect().top;
  if (overlap <= 0) return;
  const scroller = sessionScroller(el);
  if (scroller) {
    scroller.scrollTop += overlap + 8;
  }
}
