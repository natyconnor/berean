import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { StrictMode } from "react";
import {
  Link,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RootRouteComponent } from "@/components/routes/root-route-component";
import { useTutorial } from "@/components/tutorial/tutorial-context";
import { useTabs } from "@/lib/use-tabs";
import { canonicalRedirectHref } from "../../../shared/http-routes";

const { authState } = vi.hoisted(() => ({
  authState: { isAuthenticated: true, isLoading: false },
}));

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
  LoginPage: () => <div>Sign in</div>,
}));

vi.mock("@/components/layout/app-shell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => (
    <div data-testid="app-shell">{children}</div>
  ),
}));

vi.mock("@/lib/tab-context", async () => {
  const React = await import("react");
  const { TabContext } = await import("@/lib/tab-context-internal");
  const value = {
    tabs: [],
    activeTabId: null,
    backPassageId: "John-1",
    searchModeActive: false,
    openTab: () => undefined,
    navigateActiveTab: () => undefined,
    closeTab: () => undefined,
    reorderTabs: () => undefined,
    setActiveTab: () => undefined,
    setSearchModeActive: () => undefined,
  };
  return {
    TabProvider: ({ children }: { children: ReactNode }) =>
      React.createElement(TabContext.Provider, { value }, children),
  };
});

vi.mock("@/components/tutorial/tutorial-provider", async () => {
  const React = await import("react");
  const { TutorialContext } =
    await import("@/components/tutorial/tutorial-context");
  const value = {
    activeTour: null,
    activeStep: null,
    stepIndex: 0,
    stepCount: 0,
    startTour: () => undefined,
    isTourActive: () => false,
    isStepActive: () => false,
    isFocusModeTutorialComplete: true,
    isMainTutorialComplete: true,
  };
  return {
    TutorialProvider: ({ children }: { children: ReactNode }) =>
      React.createElement(TutorialContext.Provider, { value }, children),
  };
});

vi.mock("@/components/tutorial/staged-onboarding-provider", () => ({
  StagedOnboardingProvider: ({ children }: { children: ReactNode }) => children,
}));

function SettingsPageProbe() {
  useTutorial();
  useTabs();
  return (
    <div>
      <h1>Settings</h1>
      <Link to="/privacy">Privacy Policy</Link>
      <Link to="/terms">Terms of Service</Link>
      <Link to="/license">License</Link>
    </div>
  );
}

function providerErrorText(value: unknown): string | undefined {
  const text = value instanceof Error ? value.message : String(value);
  if (
    text.includes("useTutorial must be used within TutorialProvider") ||
    text.includes("useTabs must be used within TabProvider")
  ) {
    return text;
  }
  return undefined;
}

function createTestRouter(initialPath: string, onProviderError: () => void) {
  const rootRoute = createRootRoute({
    component: RootRouteComponent,
    beforeLoad: ({ location }) => {
      const href = canonicalRedirectHref(
        location.pathname,
        location.searchStr,
        location.hash,
      );
      if (href) {
        redirect({ href, replace: true, throw: true });
      }
    },
    errorComponent: ({ error }) => {
      if (providerErrorText(error)) onProviderError();
      return (
        <div data-testid="route-error">
          {error instanceof Error ? error.message : String(error)}
        </div>
      );
    },
  });

  const routeTree = rootRoute.addChildren([
    createRoute({
      getParentRoute: () => rootRoute,
      path: "/settings",
      component: SettingsPageProbe,
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: "/privacy",
      component: () => <h1>Privacy Policy</h1>,
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: "/terms",
      component: () => <h1>Terms of Service</h1>,
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: "/license",
      component: () => <h1>License</h1>,
    }),
  ]);

  return createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
}

describe("Settings to legal page navigation", () => {
  const loggedProviderErrors: string[] = [];

  beforeEach(() => {
    authState.isAuthenticated = true;
    authState.isLoading = false;
    loggedProviderErrors.length = 0;
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      for (const arg of args) {
        const text = providerErrorText(arg);
        if (text) loggedProviderErrors.push(text);
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function expectNoProviderErrors(seenBoundaryErrors: string[]) {
    expect(screen.queryByTestId("route-error")).not.toBeInTheDocument();
    expect(seenBoundaryErrors).toEqual([]);
    expect(loggedProviderErrors).toEqual([]);
  }

  it.each([
    { link: "Privacy Policy", heading: "Privacy Policy" },
    { link: "Terms of Service", heading: "Terms of Service" },
    { link: "License", heading: "License" },
  ] as const)(
    "does not throw provider errors when opening $link from Settings",
    async ({ link, heading }) => {
      const seenBoundaryErrors: string[] = [];
      const router = createTestRouter("/settings", () => {
        seenBoundaryErrors.push("provider");
      });
      const user = userEvent.setup();

      render(
        <StrictMode>
          <RouterProvider router={router} />
        </StrictMode>,
      );

      expect(
        await screen.findByRole("heading", { name: "Settings" }),
      ).toBeInTheDocument();

      await user.click(screen.getByRole("link", { name: link }));

      expect(
        await screen.findByRole("heading", { name: heading }),
      ).toBeInTheDocument();
      expectNoProviderErrors(seenBoundaryErrors);
    },
  );

  it("does not throw provider errors on browser Forward from Settings to a legal page", async () => {
    const seenBoundaryErrors: string[] = [];
    const router = createTestRouter("/settings", () => {
      seenBoundaryErrors.push("provider");
    });

    render(
      <StrictMode>
        <RouterProvider router={router} />
      </StrictMode>,
    );

    expect(
      await screen.findByRole("heading", { name: "Settings" }),
    ).toBeInTheDocument();

    await act(async () => {
      await router.navigate({ to: "/privacy" });
    });
    expect(
      await screen.findByRole("heading", { name: "Privacy Policy" }),
    ).toBeInTheDocument();
    expectNoProviderErrors(seenBoundaryErrors);

    act(() => {
      router.history.back();
    });
    expect(
      await screen.findByRole("heading", { name: "Settings" }),
    ).toBeInTheDocument();
    expectNoProviderErrors(seenBoundaryErrors);

    act(() => {
      router.history.forward();
    });

    expect(
      await screen.findByRole("heading", { name: "Privacy Policy" }),
    ).toBeInTheDocument();
    expectNoProviderErrors(seenBoundaryErrors);
  });

  it("does not throw provider errors when moving from Terms to Privacy", async () => {
    const seenBoundaryErrors: string[] = [];
    const router = createTestRouter("/terms", () => {
      seenBoundaryErrors.push("provider");
    });

    render(
      <StrictMode>
        <RouterProvider router={router} />
      </StrictMode>,
    );

    expect(
      await screen.findByRole("heading", { name: "Terms of Service" }),
    ).toBeInTheDocument();

    await act(async () => {
      await router.navigate({ to: "/privacy" });
    });

    expect(
      await screen.findByRole("heading", { name: "Privacy Policy" }),
    ).toBeInTheDocument();
    expectNoProviderErrors(seenBoundaryErrors);
  });

  it("serves /license signed out without the login page", async () => {
    authState.isAuthenticated = false;
    const seenBoundaryErrors: string[] = [];
    const router = createTestRouter("/license", () => {
      seenBoundaryErrors.push("provider");
    });

    render(
      <StrictMode>
        <RouterProvider router={router} />
      </StrictMode>,
    );

    expect(
      await screen.findByRole("heading", { name: "License" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Sign in")).not.toBeInTheDocument();
    expect(screen.queryByTestId("app-splash-overlay")).not.toBeInTheDocument();
    expectNoProviderErrors(seenBoundaryErrors);
  });

  it("loads Settings after a legal page without the splash overlay", async () => {
    const seenBoundaryErrors: string[] = [];
    const router = createTestRouter("/privacy", () => {
      seenBoundaryErrors.push("provider");
    });

    render(
      <StrictMode>
        <RouterProvider router={router} />
      </StrictMode>,
    );

    expect(
      await screen.findByRole("heading", { name: "Privacy Policy" }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("app-splash-overlay")).not.toBeInTheDocument();

    await act(async () => {
      await router.navigate({ to: "/settings" });
    });

    expect(
      await screen.findByRole("heading", { name: "Settings" }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("app-splash-overlay")).not.toBeInTheDocument();
    expectNoProviderErrors(seenBoundaryErrors);
  });
});
