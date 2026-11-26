import { describe, expect, it } from "vitest";
import {
  shouldShowAddToHomeScreenHint,
  type AddToHomeScreenContext,
} from "./pwa-install-hint";

/** iPadOS 17+ Safari, default "desktop website" mode. */
const IPAD_SAFARI_DESKTOP_MODE =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";
/** iPad Safari with "Request Mobile Website". */
const IPAD_SAFARI_MOBILE_MODE =
  "Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const MAC_SAFARI = IPAD_SAFARI_DESKTOP_MODE;
const IPAD_CHROME =
  "Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0.6367.88 Mobile/15E148 Safari/604.1";
const IPAD_FIREFOX =
  "Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/125.0 Mobile/15E148 Safari/605.1.15";
const IPAD_GOOGLE_APP =
  "Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/313.0.627215084 Mobile/15E148 Safari/604.1";
const IPAD_FACEBOOK =
  "Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/460.0.0.0]";
const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const MAC_CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const BEREAN_DESKTOP =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Berean/1.0.0 Chrome/140.0.0.0 Electron/45.3.2 Safari/537.36";
const ANDROID_TABLET_CHROME =
  "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function context(
  overrides: Partial<AddToHomeScreenContext> = {},
): AddToHomeScreenContext {
  return {
    userAgent: IPAD_SAFARI_DESKTOP_MODE,
    maxTouchPoints: 5,
    isStandalone: false,
    isDesktop: false,
    isDismissed: false,
    ...overrides,
  };
}

describe("shouldShowAddToHomeScreenHint", () => {
  it("shows on iPad Safari in its default desktop-website mode", () => {
    expect(shouldShowAddToHomeScreenHint(context())).toBe(true);
  });

  it("shows on iPad Safari in mobile-website mode", () => {
    expect(
      shouldShowAddToHomeScreenHint(
        context({ userAgent: IPAD_SAFARI_MOBILE_MODE }),
      ),
    ).toBe(true);
  });

  it("hides once Berean runs from the home screen", () => {
    expect(shouldShowAddToHomeScreenHint(context({ isStandalone: true }))).toBe(
      false,
    );
  });

  it("hides after the user dismissed it", () => {
    expect(shouldShowAddToHomeScreenHint(context({ isDismissed: true }))).toBe(
      false,
    );
  });

  it("never shows in the desktop app, whatever the user agent says", () => {
    expect(shouldShowAddToHomeScreenHint(context({ isDesktop: true }))).toBe(
      false,
    );
    expect(
      shouldShowAddToHomeScreenHint(
        context({ userAgent: BEREAN_DESKTOP, maxTouchPoints: 0 }),
      ),
    ).toBe(false);
    expect(
      shouldShowAddToHomeScreenHint(context({ userAgent: BEREAN_DESKTOP })),
    ).toBe(false);
  });

  it("hides on a Mac: same user agent as iPad, but no touch screen", () => {
    expect(
      shouldShowAddToHomeScreenHint(
        context({ userAgent: MAC_SAFARI, maxTouchPoints: 0 }),
      ),
    ).toBe(false);
    expect(
      shouldShowAddToHomeScreenHint(
        context({ userAgent: MAC_SAFARI, maxTouchPoints: 1 }),
      ),
    ).toBe(false);
  });

  it.each([
    ["Chrome on iPad", IPAD_CHROME],
    ["Firefox on iPad", IPAD_FIREFOX],
    ["the Google app on iPad", IPAD_GOOGLE_APP],
    ["Facebook's in-app browser on iPad", IPAD_FACEBOOK],
    ["Safari on iPhone", IPHONE_SAFARI],
    ["Chrome on a Mac", MAC_CHROME],
    ["Chrome on an Android tablet", ANDROID_TABLET_CHROME],
    ["an empty user agent", ""],
  ])("hides on %s", (_label, userAgent) => {
    expect(shouldShowAddToHomeScreenHint(context({ userAgent }))).toBe(false);
  });
});
