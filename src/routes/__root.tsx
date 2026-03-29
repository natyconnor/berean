import {
  createRootRoute,
  Navigate,
  Outlet,
  useLocation,
} from "@tanstack/react-router";
import { useConvexAuth } from "convex/react";
import { useQuery } from "convex-helpers/react/cache";
import { useEffect, useRef, useState } from "react";
import { TabProvider } from "@/lib/tab-context";
import { logInteraction } from "@/lib/dev-log";
import { ThemeProvider } from "@/lib/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/layout/app-shell";
import { TutorialProvider } from "@/components/tutorial/tutorial-provider";
import {
  readActiveTutorialTour,
  readSuppressSettingsRedirectAfterSkip,
} from "@/components/tutorial/tutorial-session";
import { LoginPage } from "@/components/login-page";
import {
  heroBackgroundLayerStyle,
  heroGradientOverlayLayerStyle,
} from "@/lib/hero-backdrop";
import { shouldRedirectToSettings } from "@/lib/tutorial-settings-redirect";
import { api } from "../../convex/_generated/api";
import { RootRouteError } from "@/components/error-fallbacks/root-route-error";
import { usePreviewAutoSignIn } from "@/hooks/use-preview-auto-sign-in";

const MIN_SPLASH_MS = 600;

export const Route = createRootRoute({
  component: RootComponent,
  errorComponent: RootRouteError,
});

const PUBLIC_LEGAL_PATHS = new Set(["/privacy", "/terms"]);

function RootComponent() {
  usePreviewAutoSignIn();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const location = useLocation();
  const isPublicLegalPath = PUBLIC_LEGAL_PATHS.has(location.pathname);
  const isSettingsRoute = location.pathname.startsWith("/settings");
  const tutorialStatus = useQuery(
    api.userSettings.getTutorialStatus,
    isAuthenticated ? {} : "skip",
  );
  const activeTutorialTour = readActiveTutorialTour();
  const suppressSettingsRedirectAfterSkip =
    readSuppressSettingsRedirectAfterSkip();
  const lastAuthStateRef = useRef<string | null>(null);
  const lastRouteKeyRef = useRef<string | null>(null);
  const lastSettingsRedirectPathRef = useRef<string | null>(null);
  const protectedShellReadyRef = useRef(false);

  const alreadyReady = !isLoading && isAuthenticated;

  const [minTimePassed, setMinTimePassed] = useState(() => alreadyReady);
  const [splashGone, setSplashGone] = useState(
    () => alreadyReady && tutorialStatus !== undefined,
  );

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

  useEffect(() => {
    if (minTimePassed) return;
    const timer = setTimeout(() => setMinTimePassed(true), MIN_SPLASH_MS);
    return () => clearTimeout(timer);
  }, [minTimePassed]);

  const isReady = !isLoading && minTimePassed;
  const shouldShowSettingsRedirect = shouldRedirectToSettings({
    isSettingsRoute,
    needsStarterTagsSetup: tutorialStatus?.needsStarterTagsSetup,
    mainTutorialCompletedAt: tutorialStatus?.mainTutorialCompletedAt,
    activeTutorialTour,
    suppressRedirectAfterSkip: suppressSettingsRedirectAfterSkip,
  });

  useEffect(() => {
    const authState = isLoading
      ? "loading"
      : isAuthenticated
        ? "authenticated"
        : "signed-out";
    if (lastAuthStateRef.current === authState) return;
    lastAuthStateRef.current = authState;
    logInteraction("app", "auth-state-changed", { state: authState });
  }, [isAuthenticated, isLoading]);

  useEffect(() => {
    const routeKey = `${location.pathname}${window.location.search}`;
    if (lastRouteKeyRef.current === routeKey) return;
    lastRouteKeyRef.current = routeKey;
    logInteraction("route", "viewed", {
      path: location.pathname,
      hasSearch: window.location.search.length > 0,
      isPublicLegalPath,
    });
  }, [isPublicLegalPath, location.pathname]);

  useEffect(() => {
    if (!isReady || !isAuthenticated || tutorialStatus === undefined) {
      protectedShellReadyRef.current = false;
      return;
    }
    if (protectedShellReadyRef.current) return;
    protectedShellReadyRef.current = true;
    logInteraction("app", "protected-shell-ready", {
      path: location.pathname,
      needsStarterTagsSetup: tutorialStatus.needsStarterTagsSetup,
    });
  }, [isAuthenticated, isReady, location.pathname, tutorialStatus]);

  useEffect(() => {
    if (!shouldShowSettingsRedirect) {
      lastSettingsRedirectPathRef.current = null;
      return;
    }
    if (lastSettingsRedirectPathRef.current === location.pathname) return;
    lastSettingsRedirectPathRef.current = location.pathname;
    logInteraction("app", "redirect-to-settings", {
      fromPath: location.pathname,
    });
  }, [location.pathname, shouldShowSettingsRedirect]);

  if (isPublicLegalPath) {
    return (
      <ThemeProvider>
        <Outlet />
      </ThemeProvider>
    );
  }

  if (!isReady || !isAuthenticated) {
    return <LoginPage isLoading={!isReady} />;
  }

  if (tutorialStatus === undefined) {
    return (
      <div className="fixed inset-0">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={heroBackgroundLayerStyle()}
        />
        <div
          className="absolute inset-0 bg-linear-to-b from-black/60 via-black/50 to-black/90"
          style={heroGradientOverlayLayerStyle()}
        />
      </div>
    );
  }

  if (shouldShowSettingsRedirect) {
    return <Navigate to="/settings" replace />;
  }

  return (
    <>
      <ThemeProvider>
        <TabProvider>
          <TooltipProvider>
            <TutorialProvider tutorialStatus={tutorialStatus}>
              <AppShell>
                <Outlet />
              </AppShell>
            </TutorialProvider>
          </TooltipProvider>
        </TabProvider>
      </ThemeProvider>

      {__IS_PREVIEW__ && (
        <div className="fixed bottom-2 left-2 z-50 rounded bg-amber-500/90 px-2 py-1 text-xs font-medium text-black">
          Preview Mode
        </div>
      )}

      {!splashGone && (
        <div
          className="animate-splash-exit pointer-events-none fixed inset-0 z-50"
          onAnimationEnd={() => setSplashGone(true)}
        >
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={heroBackgroundLayerStyle()}
          />
          <div
            className="absolute inset-0 bg-linear-to-b from-black/60 via-black/50 to-black/90"
            style={heroGradientOverlayLayerStyle()}
          />
        </div>
      )}
    </>
  );
}
