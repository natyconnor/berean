import { Outlet, useLocation } from "@tanstack/react-router";
import { useConvexAuth } from "convex/react";
import { useQuery } from "convex-helpers/react/cache";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppRefreshPrompt } from "@/components/app-refresh-prompt";
import { AppShell } from "@/components/layout/app-shell";
import { LoginPage } from "@/components/login-page";
import { StagedOnboardingProvider } from "@/components/tutorial/staged-onboarding-provider";
import { TutorialProvider } from "@/components/tutorial/tutorial-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAppVersionMonitor } from "@/hooks/use-app-version-monitor";
import { usePreviewAutoSignIn } from "@/hooks/use-preview-auto-sign-in";
import { logInteraction } from "@/lib/dev-log";
import {
  heroBackgroundLayerStyle,
  heroGradientOverlayLayerStyle,
} from "@/lib/hero-backdrop";
import { TabProvider } from "@/lib/tab-context";
import { ThemeProvider } from "@/lib/theme-provider";
import { api } from "../../../convex/_generated/api";

const MIN_SPLASH_MS = 600;
const AUTH_BOOTSTRAP_DIAGNOSTIC_MS = 10_000;
const AUTH_BOOTSTRAP_TIMEOUT_MS = 15_000;
const PUBLIC_LEGAL_PATHS = new Set(["/privacy", "/terms"]);

export function RootRouteComponent() {
  usePreviewAutoSignIn();
  const { latestVersion, showRefreshPrompt, refreshToLatestVersion } =
    useAppVersionMonitor();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const location = useLocation();
  const isPublicLegalPath = PUBLIC_LEGAL_PATHS.has(location.pathname);
  const onboardingStatus = useQuery(
    api.onboarding.getOnboardingStatus,
    isAuthenticated ? {} : "skip",
  );
  const tutorialStatus = useMemo(() => {
    if (!onboardingStatus) return undefined;
    return {
      mainTutorialCompletedAt: onboardingStatus.mainTutorialCompletedAt,
      advancedSearchTutorialCompletedAt:
        onboardingStatus.advancedSearchTutorialCompletedAt,
      focusModeTutorialCompletedAt:
        onboardingStatus.focusModeTutorialCompletedAt,
      categoryColors: onboardingStatus.categoryColors,
    };
  }, [onboardingStatus]);
  const lastAuthStateRef = useRef<string | null>(null);
  const lastRouteKeyRef = useRef<string | null>(null);
  const protectedShellReadyRef = useRef(false);

  const alreadyReady = !isLoading && isAuthenticated;

  const [minTimePassed, setMinTimePassed] = useState(() => alreadyReady);
  const [splashGone, setSplashGone] = useState(
    () => alreadyReady && tutorialStatus !== undefined,
  );
  const [authBootstrapTimedOut, setAuthBootstrapTimedOut] = useState(false);

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

  useEffect(() => {
    if (isPublicLegalPath || !isLoading) return;

    const slowId = window.setTimeout(() => {
      if (isLoading) {
        logInteraction("app", "auth-bootstrap-slow", {
          ms: AUTH_BOOTSTRAP_DIAGNOSTIC_MS,
        });
      }
    }, AUTH_BOOTSTRAP_DIAGNOSTIC_MS);
    const timeoutId = window.setTimeout(() => {
      if (isLoading) {
        logInteraction("app", "auth-bootstrap-timeout", {
          ms: AUTH_BOOTSTRAP_TIMEOUT_MS,
        });
        setAuthBootstrapTimedOut(true);
      }
    }, AUTH_BOOTSTRAP_TIMEOUT_MS);
    return () => {
      window.clearTimeout(slowId);
      window.clearTimeout(timeoutId);
      setAuthBootstrapTimedOut(false);
    };
  }, [isLoading, isPublicLegalPath]);

  const isReady = !isLoading && minTimePassed;
  const authBootstrapShowingRecovery = authBootstrapTimedOut && isLoading;
  const effectiveReady = isReady || authBootstrapShowingRecovery;

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
    });
  }, [isAuthenticated, isReady, location.pathname, tutorialStatus]);

  const retryAuthBootstrap = () => {
    logInteraction("app", "auth-bootstrap-retry-navigation", {});
    window.location.reload();
  };

  const refreshPrompt =
    showRefreshPrompt && latestVersion ? (
      <AppRefreshPrompt onRefresh={refreshToLatestVersion} />
    ) : null;

  let content: ReactNode;

  if (isPublicLegalPath) {
    content = (
      <ThemeProvider>
        <Outlet />
      </ThemeProvider>
    );
  } else if (!effectiveReady || !isAuthenticated) {
    content = (
      <LoginPage
        isLoading={!effectiveReady}
        authBootstrapStalled={authBootstrapShowingRecovery}
        onRetryConnection={retryAuthBootstrap}
      />
    );
  } else if (tutorialStatus === undefined || onboardingStatus === undefined) {
    content = (
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
  } else {
    content = (
      <ThemeProvider>
        <TabProvider>
          <TooltipProvider>
            <StagedOnboardingProvider
              milestones={onboardingStatus.milestones}
              hints={onboardingStatus.hints}
              isLoading={false}
            >
              <TutorialProvider tutorialStatus={tutorialStatus}>
                <AppShell>
                  <Outlet />
                </AppShell>
              </TutorialProvider>
            </StagedOnboardingProvider>
          </TooltipProvider>
        </TabProvider>
      </ThemeProvider>
    );
  }

  return (
    <>
      {content}

      {__IS_PREVIEW__ && (
        <div className="fixed bottom-2 left-2 z-50 rounded bg-amber-500/90 px-2 py-1 text-xs font-medium text-black">
          Preview Mode
        </div>
      )}

      {refreshPrompt}

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
