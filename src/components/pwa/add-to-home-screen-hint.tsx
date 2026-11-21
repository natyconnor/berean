import { Share, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { logInteraction } from "@/lib/dev-log";
import { isBereanDesktop, isPwaStandalone } from "@/lib/desktop-platform";
import {
  ADD_TO_HOME_SCREEN_DISMISSED_KEY,
  shouldShowAddToHomeScreenHint,
} from "@/lib/pwa-install-hint";

function readDismissed(): boolean {
  try {
    return (
      window.localStorage.getItem(ADD_TO_HOME_SCREEN_DISMISSED_KEY) !== null
    );
  } catch {
    // No storage (private mode, blocked): do not nag on every visit.
    return true;
  }
}

function rememberDismissed(): void {
  try {
    window.localStorage.setItem(ADD_TO_HOME_SCREEN_DISMISSED_KEY, "1");
  } catch {
    // Nothing to do; the hint is hidden for this visit either way.
  }
}

function shouldShowNow(): boolean {
  if (typeof window === "undefined") return false;
  return shouldShowAddToHomeScreenHint({
    userAgent: window.navigator.userAgent,
    maxTouchPoints: window.navigator.maxTouchPoints ?? 0,
    isStandalone: isPwaStandalone(),
    isDesktop: isBereanDesktop(),
    isDismissed: readDismissed(),
  });
}

/**
 * A small, dismissible suggestion to install Berean from Safari's share
 * sheet. iPad Safari only (see `shouldShowAddToHomeScreenHint`); never in the
 * desktop app or once installed. Dismissing it hides it for good.
 */
export function AddToHomeScreenHint() {
  const [isVisible, setIsVisible] = useState(shouldShowNow);

  if (!isVisible) return null;

  const dismiss = () => {
    rememberDismissed();
    logInteraction("pwa", "add-to-home-screen-hint-dismissed", {});
    setIsVisible(false);
  };

  return (
    <div
      aria-live="polite"
      className="fixed bottom-3 left-3 z-50 flex w-[min(22rem,calc(100vw-1.5rem))] items-start gap-3 rounded-xl border border-border/70 bg-background/95 p-4 text-left text-foreground shadow-2xl backdrop-blur"
      role="status"
    >
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-semibold tracking-tight">
          Add Berean to your Home Screen
        </p>
        <p className="text-sm text-muted-foreground">
          Tap{" "}
          <Share
            aria-label="Share"
            className="inline size-4 -translate-y-px align-middle"
          />{" "}
          in Safari, then choose <strong>Add to Home Screen</strong> to open
          Berean like an app.
        </p>
      </div>
      <Button
        aria-label="Dismiss"
        className="-mt-1 -mr-1"
        onClick={dismiss}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <X />
      </Button>
    </div>
  );
}
