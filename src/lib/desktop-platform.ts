/** The shell's self-update, as the page sees it. */
export type DesktopUpdateState = {
  /** False for unpackaged and unsigned copies: they never update themselves. */
  canSelfUpdate: boolean;
  state: "idle" | "checking" | "downloading" | "downloaded";
  /** The version downloading, while `state` is "downloading". */
  downloadingVersion: string | null;
  /** The version downloaded and installed on the next quit or restart. */
  readyVersion: string | null;
};

/** What one "Check for updates" found. */
export type DesktopUpdateCheckResult =
  | { kind: "unsupported" }
  | { kind: "up-to-date" }
  | { kind: "downloading"; version: string }
  | { kind: "ready"; version: string }
  | { kind: "error" };

/**
 * What the Electron preload script exposes as `window.bereanDesktop`.
 *
 * Everything after `platform` arrived with shell 1.0.2. The web app is newer
 * than the shell it runs in, so it must check each one before using it.
 */
export type BereanDesktopBridge = {
  isDesktop: true;
  platform: "darwin" | "win32" | "linux";
  /** The shell's own version, e.g. "1.0.2". */
  shellVersion?: string;
  /** Calls `listener` with the current state, then on every change. */
  subscribeToUpdates?: (
    listener: (state: DesktopUpdateState) => void,
  ) => () => void;
  /** The same check as Berean → Check for Updates…, without its windows. */
  checkForUpdates?: () => Promise<DesktopUpdateCheckResult>;
  /** Quits and installs a downloaded update. Ask about unsaved notes first. */
  installUpdate?: () => void;
  /** Tells the shell whether this window has unsaved notes. */
  setHasUnsavedNotes?: (hasUnsavedNotes: boolean) => void;
  /** Whether any window has unsaved notes. */
  hasUnsavedNotes?: () => Promise<boolean>;
  /**
   * Lets the shell ask this window "Discard unsaved notes?" before it quits.
   * `confirm` resolves true for Discard, false for Keep editing.
   */
  onDiscardRequest?: (confirm: () => Promise<boolean>) => () => void;
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

/**
 * True on a Mac, in a browser rather than the Berean desktop app: the place
 * to offer Berean for Mac. Read synchronously so the first paint is right.
 * Every Mac browser's user agent says "Macintosh"; when it can't be read,
 * this is not a Mac. An iPad that asks for desktop sites counts as a Mac.
 */
export function isMacBrowser(): boolean {
  if (isBereanDesktop() || typeof navigator === "undefined") return false;
  return /Macintosh/.test(navigator.userAgent);
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
