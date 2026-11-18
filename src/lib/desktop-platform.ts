/** What the Electron preload script exposes as `window.bereanDesktop`. */
export type BereanDesktopBridge = {
  isDesktop: true;
  platform: "darwin" | "win32" | "linux";
};

// Declared here rather than in `vite-env.d.ts` so the Electron preload, which
// type-imports the bridge from this module, type-checks on its own.
declare global {
  interface Window {
    /** Present only inside the desktop (Electron) shell. */
    bereanDesktop?: BereanDesktopBridge;
  }
}

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
