import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RootRouteComponent } from "@/components/routes/root-route-component";

const { authState, locationState } = vi.hoisted(() => ({
  authState: { isAuthenticated: false, isLoading: false },
  locationState: { pathname: "/privacy", searchStr: "" },
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
    latestVersion: null,
    showRefreshPrompt: false,
    refreshToLatestVersion: vi.fn(),
  }),
}));

vi.mock("@/components/login-page", () => ({
  LoginPage: ({ isLoading }: { isLoading?: boolean }) => (
    <div data-testid="login-page">{isLoading ? "Loading…" : "Sign in"}</div>
  ),
}));

vi.mock("@/components/layout/app-shell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => (
    <div data-testid="app-shell">{children}</div>
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
