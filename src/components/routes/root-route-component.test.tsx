import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RootRouteComponent } from "@/components/routes/root-route-component";

const { authState, locationState, versionState } = vi.hoisted(() => ({
  authState: { isAuthenticated: false, isLoading: false },
  locationState: { pathname: "/privacy", searchStr: "" },
  versionState: {
    latestVersion: null as { buildId: string; appVersion: string } | null,
  },
}));

vi.mock("@tanstack/react-router", async () => {
  const React = await import("react");
  return {
    Outlet: () =>
      React.createElement(
        "div",
        { "data-testid": "route-outlet" },
        locationState.pathname,
      ),
    useLocation: () => locationState,
    useMatches: () => [{ pathname: locationState.pathname }],
    useNavigate: () => vi.fn(),
    useCanGoBack: () => false,
    Link: React.forwardRef<
      HTMLAnchorElement,
      React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }
    >(function Link({ to, children, ...props }, ref) {
      return (
        <a ref={ref} href={to} {...props}>
          {children}
        </a>
      );
    }),
  };
});

vi.mock("convex/react", () => ({
  useConvexAuth: () => authState,
  useMutation: () => vi.fn(),
}));

vi.mock("convex-helpers/react/cache", () => ({
  useQuery: () => ({
    mainTutorialCompletedAt: 1,
    advancedSearchTutorialCompletedAt: 1,
    focusModeTutorialCompletedAt: 1,
    categoryColors: {},
    milestones: {
      notesCount: 0,
      taggedNotesCount: 0,
      distinctTagCount: 0,
      heartsCount: 0,
      hasInlineVerseLink: false,
      hasExplicitVerseLink: false,
      starterTagCount: 0,
      customTagCount: 0,
    },
    hints: [],
  }),
}));

vi.mock("@/hooks/use-dismiss-splash", () => ({
  useDismissSplashBackdrop: () => undefined,
}));

vi.mock("@/hooks/use-preview-auto-sign-in", () => ({
  usePreviewAutoSignIn: () => undefined,
}));

vi.mock("@/hooks/use-app-version-monitor", () => ({
  useAppVersionMonitor: () => ({
    latestVersion: versionState.latestVersion,
    showRefreshPrompt: versionState.latestVersion !== null,
    refreshToLatestVersion: vi.fn(),
  }),
}));

vi.mock("@/components/login-page", () => ({
  LoginPage: ({ isLoading }: { isLoading?: boolean }) => (
    <div data-testid="login-page">{isLoading ? "Loading…" : "Sign in"}</div>
  ),
}));

vi.mock("@/components/layout/app-shell", () => ({
  AppShell: ({
    children,
    webUpdate,
  }: {
    children: ReactNode;
    webUpdate?: { buildId: string } | null;
  }) => (
    <div data-testid="app-shell" data-web-update={webUpdate?.buildId ?? ""}>
      {children}
    </div>
  ),
}));

vi.mock("@/lib/tab-context", () => ({
  TabProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/components/tutorial/tutorial-provider", () => ({
  TutorialProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/components/tutorial/staged-onboarding-provider", () => ({
  StagedOnboardingProvider: ({ children }: { children: ReactNode }) => children,
}));

afterEach(() => {
  authState.isAuthenticated = false;
  authState.isLoading = false;
  locationState.pathname = "/privacy";
  locationState.searchStr = "";
  versionState.latestVersion = null;
  delete window.bereanDesktop;
  vi.useRealTimers();
});

function splashOverlay() {
  return screen.queryByTestId("app-splash-overlay");
}

describe("RootRouteComponent legal navigation", () => {
  it("loads a passage after a signed-out visit to a legal page without the splash overlay", () => {
    const { rerender } = render(<RootRouteComponent />);

    expect(screen.getByTestId("route-outlet")).toHaveTextContent("/privacy");
    expect(splashOverlay()).not.toBeInTheDocument();

    locationState.pathname = "/passage/John-1";
    rerender(<RootRouteComponent />);

    expect(screen.getByTestId("login-page")).toHaveTextContent("Sign in");
    expect(splashOverlay()).not.toBeInTheDocument();
  });

  it("loads a passage after a signed-in visit to a legal page without the splash overlay", () => {
    authState.isAuthenticated = true;
    const { rerender } = render(<RootRouteComponent />);

    expect(screen.getByTestId("route-outlet")).toHaveTextContent("/privacy");
    expect(splashOverlay()).not.toBeInTheDocument();

    locationState.pathname = "/passage/John-1";
    rerender(<RootRouteComponent />);

    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
    expect(screen.getByTestId("route-outlet")).toHaveTextContent(
      "/passage/John-1",
    );
    expect(splashOverlay()).not.toBeInTheDocument();
  });

  it("loads Settings after a legal page without the splash overlay", () => {
    authState.isAuthenticated = true;
    const { rerender } = render(<RootRouteComponent />);

    locationState.pathname = "/settings";
    rerender(<RootRouteComponent />);

    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
    expect(splashOverlay()).not.toBeInTheDocument();
  });

  it("treats /license as a public legal page", () => {
    locationState.pathname = "/license";
    render(<RootRouteComponent />);

    expect(screen.getByTestId("route-outlet")).toHaveTextContent("/license");
    expect(splashOverlay()).not.toBeInTheDocument();
    expect(screen.queryByTestId("login-page")).not.toBeInTheDocument();
  });

  it("clears a protected-route splash overlay even if animationend never fires", () => {
    vi.useFakeTimers();
    locationState.pathname = "/passage/John-1";
    render(<RootRouteComponent />);

    expect(splashOverlay()).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(splashOverlay()).not.toBeInTheDocument();
    expect(screen.getByTestId("login-page")).toHaveTextContent("Sign in");
    vi.useRealTimers();
  });
});

describe("RootRouteComponent web update", () => {
  const NEW_BUILD = { buildId: "build-2", appVersion: "1.23.0" };

  it("keeps the website's corner card, signed in or not", () => {
    versionState.latestVersion = NEW_BUILD;
    locationState.pathname = "/passage/John-1";
    const { rerender } = render(<RootRouteComponent />);
    expect(screen.getByText("An update is available.")).toBeInTheDocument();

    authState.isAuthenticated = true;
    rerender(<RootRouteComponent />);
    expect(screen.getByText("An update is available.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Refresh now" }),
    ).toBeInTheDocument();
  });

  it("hands a new build to the top bar instead of the card in the Mac app", () => {
    window.bereanDesktop = { isDesktop: true, platform: "darwin" };
    versionState.latestVersion = NEW_BUILD;
    locationState.pathname = "/passage/John-1";
    const { unmount } = render(<RootRouteComponent />);
    // Sign-in screen: no card, and no app shell for an arrow.
    expect(screen.queryByText("An update is available.")).toBeNull();
    expect(screen.queryByTestId("app-shell")).toBeNull();
    unmount();

    authState.isAuthenticated = true;
    render(<RootRouteComponent />);
    expect(screen.queryByText("An update is available.")).toBeNull();
    expect(screen.getByTestId("app-shell")).toHaveAttribute(
      "data-web-update",
      "build-2",
    );
  });
});
