/**
 * What the Electron preload script exposes as `window.bereanDesktop`.
 * The `Window` augmentation lives in `src/vite-env.d.ts`.
 */
export type BereanDesktopBridge = {
  isDesktop: true;
  platform: "darwin" | "win32" | "linux";
};

/** Where the browser lands after sign-in started from the desktop app. */
export const DESKTOP_AUTH_REDIRECT_PATH = "/desktop-auth.html";

/** True inside the Berean desktop (Electron) shell. */
export function isBereanDesktop(): boolean {
  if (typeof window === "undefined") return false;
  return window.bereanDesktop?.isDesktop === true;
}

/** True when running as an installed PWA (home-screen app), not in a tab. */
export function isPwaStandalone(): boolean {
  if (typeof window === "undefined") return false;

  if (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches
  ) {
    return true;
  }

  // iOS Safari predates the display-mode media query for home-screen apps.
  const navigatorWithStandalone: Navigator & { standalone?: boolean } =
    window.navigator;
  return navigatorWithStandalone.standalone === true;
}
