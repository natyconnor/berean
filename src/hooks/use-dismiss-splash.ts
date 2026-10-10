import { useEffect } from "react";

/** Fade out the pre-bundle splash in `index.html` once React has mounted. */
export function useDismissSplashBackdrop() {
  useEffect(() => {
    const el = document.getElementById("splash-bg");
    if (!el) return;
    el.style.transition = "opacity 400ms ease-out";
    el.style.opacity = "0";
    const remove = () => el.remove();
    el.addEventListener("transitionend", remove, { once: true });
    // Fallback: remove even if transitionend doesn't fire (e.g. iPad Safari)
    const fallback = setTimeout(remove, 500);
    return () => clearTimeout(fallback);
  }, []);
}
