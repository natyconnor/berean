/**
 * When to suggest "Add to Home Screen" (installing Berean as a PWA).
 *
 * Only for Safari on iPad, only when Berean is not already running as an
 * installed app, never in the desktop shell, and never again once dismissed.
 * Detection is deliberately conservative: when unsure, do not show it.
 */

export type AddToHomeScreenContext = {
  userAgent: string;
  /** `navigator.maxTouchPoints`: tells an iPad apart from a Mac. */
  maxTouchPoints: number;
  /** Already launched from the home screen (`isPwaStandalone()`). */
  isStandalone: boolean;
  /** Inside the Berean desktop app (`isBereanDesktop()`). */
  isDesktop: boolean;
  /** The user closed the hint before. */
  isDismissed: boolean;
};

export const ADD_TO_HOME_SCREEN_DISMISSED_KEY = "berean:a2hsHintDismissed";

/**
 * Browsers on iPadOS that are not Safari but share its engine, and in-app
 * browsers. Their share sheets differ, so the Safari instructions would be
 * wrong.
 */
const NOT_SAFARI =
  /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|YaBrowser|DuckDuckGo|GSA\/|FBAN|FBAV|Instagram|Line\/|Twitter|LinkedInApp|Electron/i;

/**
 * iPad, either by name (older iPadOS, or "Request Mobile Website") or as the
 * desktop-class Safari iPadOS uses by default: a "Macintosh" user agent on a
 * touch screen. Real Macs report no touch points.
 */
function isIpad(userAgent: string, maxTouchPoints: number): boolean {
  if (/\biPad\b/.test(userAgent)) return true;
  return /\bMacintosh\b/.test(userAgent) && maxTouchPoints > 1;
}

function isSafari(userAgent: string): boolean {
  return (
    /\bVersion\/[\d.]+.*\bSafari\//.test(userAgent) &&
    !NOT_SAFARI.test(userAgent)
  );
}

export function shouldShowAddToHomeScreenHint(
  context: AddToHomeScreenContext,
): boolean {
  if (context.isDesktop || context.isStandalone || context.isDismissed) {
    return false;
  }
  return (
    isIpad(context.userAgent, context.maxTouchPoints) &&
    isSafari(context.userAgent)
  );
}
