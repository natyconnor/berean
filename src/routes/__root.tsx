import {
  createRootRoute,
  Navigate,
  Outlet,
  useLocation,
} from "@tanstack/react-router";
import { useConvexAuth } from "convex/react";
import { useQuery } from "convex-helpers/react/cache";
import { useEffect, useState } from "react";
import { TabProvider } from "@/lib/tab-context";
import { ThemeProvider } from "@/lib/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/layout/app-shell";
import { TutorialProvider } from "@/components/tutorial/tutorial-provider";
import { readActiveTutorialTour } from "@/components/tutorial/tutorial-session";
import { LoginPage } from "@/components/login-page";
import {
  heroBackgroundLayerStyle,
  heroGradientOverlayLayerStyle,
} from "@/lib/hero-backdrop";
import { api } from "../../convex/_generated/api";

const MIN_SPLASH_MS = 600;

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const location = useLocation();
  const isSettingsRoute = location.pathname.startsWith("/settings");
  const tutorialStatus = useQuery(
    api.userSettings.getTutorialStatus,
    isAuthenticated ? {} : "skip",
  );
  const activeTutorialTour = readActiveTutorialTour();

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
    el.addEventListener("transitionend", () => el.remove(), { once: true });
  }, []);

  useEffect(() => {
    if (minTimePassed) return;
    const timer = setTimeout(() => setMinTimePassed(true), MIN_SPLASH_MS);
    return () => clearTimeout(timer);
  }, [minTimePassed]);

  const isReady = !isLoading && minTimePassed;

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

  if (
    !isSettingsRoute &&
    tutorialStatus.needsStarterTagsSetup &&
    tutorialStatus.mainTutorialCompletedAt !== undefined &&
    activeTutorialTour !== "main"
  ) {
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
