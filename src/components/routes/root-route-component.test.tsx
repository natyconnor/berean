import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RootRouteComponent } from "@/components/routes/root-route-component";

const {
  authState,
  locationState,
  queryState,
  ensureNoteMilestones,
  versionState,
  loginPaints,
} = vi.hoisted(() => ({
  loginPaints: [] as string[],
  authState: { isAuthenticated: false, isLoading: false },
  locationState: { pathname: "/privacy", searchStr: "" },
  queryState: { notesRollupMissing: false },
  ensureNoteMilestones: vi.fn(() => Promise.resolve(null)),
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
  useMutation: () => ensureNoteMilestones,
}));

vi.mock("convex-helpers/react/cache", () => ({
  useQuery: () =>
    queryState.notesRollupMissing
      ? null
      : {
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
        },
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
  LoginPage: ({
    isLoading,
    isSignedIn,
  }: {
    isLoading?: boolean;
    isSignedIn?: boolean;
  }) => {
    const text = isLoading
      ? "Loading…"
      : isSignedIn
        ? "Enter Berean"
        : "Sign in";
    loginPaints.push(text);
    return <div data-testid="login-page">{text}</div>;
  },
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
  queryState.notesRollupMissing = false;
  ensureNoteMilestones.mockClear();
  versionState.latestVersion = null;
  loginPaints.length = 0;
  sessionStorage.clear();
  window.history.replaceState(null, "", "/");
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

  it("waits for the note totals row and asks the server to build it", () => {
    authState.isAuthenticated = true;
    locationState.pathname = "/passage/John-1";
    queryState.notesRollupMissing = true;
    const { rerender } = render(<RootRouteComponent />);

    expect(screen.queryByTestId("app-shell")).not.toBeInTheDocument();
    expect(ensureNoteMilestones).toHaveBeenCalledTimes(1);

    queryState.notesRollupMissing = false;
    rerender(<RootRouteComponent />);
    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
    expect(ensureNoteMilestones).toHaveBeenCalledTimes(1);
  });

  it("does not call the note totals backfill once the row exists", () => {
    authState.isAuthenticated = true;
    locationState.pathname = "/passage/John-1";
    render(<RootRouteComponent />);

    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
    expect(ensureNoteMilestones).not.toHaveBeenCalled();
  });
});

describe("RootRouteComponent home page", () => {
  /** Auth resolves to signed in after the splash minimum, as on a real load. */
  function finishSignedInLoad(rerender: () => void) {
    act(() => {
      vi.advanceTimersByTime(600);
    });
    authState.isLoading = false;
    authState.isAuthenticated = true;
    rerender();
  }

  it("keeps a signed-in website visitor on the landing page without waiting on onboarding", () => {
    authState.isAuthenticated = true;
    locationState.pathname = "/";
    queryState.notesRollupMissing = true;
    render(<RootRouteComponent />);

    expect(screen.getByTestId("login-page")).toHaveTextContent("Enter Berean");
    expect(screen.queryByTestId("app-shell")).not.toBeInTheDocument();
    expect(loginPaints).not.toContain("Sign in");
  });

  it("shows Loading… then Enter Berean, never Sign in, while auth loads", () => {
    vi.useFakeTimers();
    authState.isLoading = true;
    locationState.pathname = "/";
    const { rerender } = render(<RootRouteComponent />);
    expect(screen.getByTestId("login-page")).toHaveTextContent("Loading…");

    finishSignedInLoad(() => rerender(<RootRouteComponent />));

    expect(screen.getByTestId("login-page")).toHaveTextContent("Enter Berean");
    expect(loginPaints).not.toContain("Sign in");
  });

  it("sends the Mac app straight into the app from /", () => {
    window.bereanDesktop = { isDesktop: true, platform: "darwin" };
    authState.isAuthenticated = true;
    locationState.pathname = "/";
    render(<RootRouteComponent />);

    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
    expect(screen.getByTestId("route-outlet")).toHaveTextContent("/");
    expect(loginPaints).not.toContain("Enter Berean");
  });

  it.each([
    [
      "the sign-in marker",
      () =>
        sessionStorage.setItem("berean.webSignInStartedAt", `${Date.now()}`),
    ],
    [
      "the ?code= callback",
      () => window.history.replaceState(null, "", "/?code=abc"),
    ],
  ])(
    "goes straight into the app after website sign-in (%s)",
    (_label, arrange) => {
      vi.useFakeTimers();
      arrange();
      authState.isLoading = true;
      locationState.pathname = "/";
      const { rerender } = render(<RootRouteComponent />);
      expect(screen.getByTestId("login-page")).toHaveTextContent("Loading…");

      finishSignedInLoad(() => rerender(<RootRouteComponent />));

      expect(screen.getByTestId("app-shell")).toBeInTheDocument();
      expect(loginPaints).not.toContain("Enter Berean");
    },
  );

  it("shows the landing page again on a refresh after sign-in", () => {
    sessionStorage.setItem("berean.webSignInStartedAt", `${Date.now()}`);
    authState.isAuthenticated = true;
    locationState.pathname = "/";
    const { unmount } = render(<RootRouteComponent />);
    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
    unmount();

    render(<RootRouteComponent />);
    expect(screen.getByTestId("login-page")).toHaveTextContent("Enter Berean");
  });

  it("opens an app route directly for a signed-in website visitor", () => {
    authState.isAuthenticated = true;
    locationState.pathname = "/passage/Romans-8";
    render(<RootRouteComponent />);

    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
    expect(screen.getByTestId("route-outlet")).toHaveTextContent(
      "/passage/Romans-8",
    );
    expect(screen.queryByTestId("login-page")).not.toBeInTheDocument();
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
