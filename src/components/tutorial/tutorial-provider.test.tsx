import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TutorialProvider } from "./tutorial-provider";
import { readSuppressSettingsRedirectAfterSkip } from "./tutorial-session";

const mocks = vi.hoisted(() => {
  const location = { pathname: "/passage/John-1" };

  return {
    location,
    navigate: vi.fn((args: { to: string; params?: { passageId: string } }) => {
      if (args.to === "/settings") {
        location.pathname = "/settings";
        return Promise.resolve();
      }

      if (args.to === "/passage/$passageId" && args.params) {
        location.pathname = `/passage/${args.params.passageId}`;
      }

      return Promise.resolve();
    }),
    completeMainTutorial: vi.fn(() => Promise.resolve({ completedAt: 1 })),
    completeAdvancedSearchTutorial: vi.fn(() =>
      Promise.resolve({ completedAt: 1 }),
    ),
    completeFocusModeTutorial: vi.fn(() => Promise.resolve({ completedAt: 1 })),
  };
});

vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: mocks.location.pathname }),
  useNavigate: () => mocks.navigate,
}));

vi.mock("convex/react", () => ({
  useMutation: (reference: string) => {
    switch (reference) {
      case "api.userSettings.completeMainTutorial":
        return mocks.completeMainTutorial;
      case "api.userSettings.completeAdvancedSearchTutorial":
        return mocks.completeAdvancedSearchTutorial;
      case "api.userSettings.completeFocusModeTutorial":
        return mocks.completeFocusModeTutorial;
      default:
        return vi.fn();
    }
  },
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    userSettings: {
      completeMainTutorial: "api.userSettings.completeMainTutorial",
      completeAdvancedSearchTutorial:
        "api.userSettings.completeAdvancedSearchTutorial",
      completeFocusModeTutorial: "api.userSettings.completeFocusModeTutorial",
    },
  },
}));

function TutorialTargets() {
  return (
    <>
      <div data-tour-id="passage-verse-1">verse</div>
      <div data-tour-id="passage-add-note">add note</div>
      <div data-tour-id="note-editor-body">note body</div>
      <div data-tour-id="note-editor-link-demo">link demo</div>
      <div data-tour-id="note-editor-tags">tags</div>
      <div data-tour-id="passage-view-mode-toggle">reading mode</div>
      <div data-tour-id="app-toolbar">toolbar</div>
      <div data-tour-id="settings-import-section">import notes</div>
      <div data-tour-id="settings-starter-tags-section">starter tags</div>
      <div data-tour-id="settings-add-all-starter-tags">add starter tags</div>
      <div data-tour-id="settings-starter-tag-categories">
        starter categories
      </div>
    </>
  );
}

function renderProvider(children: ReactNode = <TutorialTargets />) {
  return render(
    <TutorialProvider
      tutorialStatus={{
        needsStarterTagsSetup: true,
        categoryColors: {},
      }}
    >
      {children}
    </TutorialProvider>,
  );
}

describe("TutorialProvider", () => {
  beforeEach(() => {
    mocks.location.pathname = "/passage/John-1";
    mocks.navigate.mockClear();
    mocks.completeMainTutorial.mockClear();
    mocks.completeAdvancedSearchTutorial.mockClear();
    mocks.completeFocusModeTutorial.mockClear();
    window.sessionStorage.clear();

    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      () =>
        ({
          x: 0,
          y: 0,
          left: 0,
          top: 0,
          right: 120,
          bottom: 24,
          width: 120,
          height: 24,
          toJSON: () => ({}),
        }) as DOMRect,
    );

    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });

    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn(() => 1),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("does not redirect to settings when the main tutorial is skipped", async () => {
    const user = userEvent.setup();

    renderProvider();

    expect(await screen.findByText("Add notes")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Skip" }));

    await waitFor(() => {
      expect(mocks.completeMainTutorial).toHaveBeenCalledWith({});
    });
    expect(readSuppressSettingsRedirectAfterSkip()).toBe(true);
    expect(
      mocks.navigate.mock.calls.some(
        ([args]) => (args as { to?: string }).to === "/settings",
      ),
    ).toBe(false);
  });

  it("keeps the previous step when backing from settings to the passage view", async () => {
    const user = userEvent.setup();

    renderProvider();

    expect(await screen.findByText("Add notes")).toBeInTheDocument();

    for (let i = 0; i < 6; i += 1) {
      await user.click(screen.getByRole("button", { name: "Next" }));
    }

    expect(await screen.findByText("Import your notes")).toBeInTheDocument();
    expect(mocks.location.pathname).toBe("/settings");

    await user.click(screen.getByRole("button", { name: "Back" }));

    await waitFor(() => {
      expect(screen.getByText("Explore the toolbar")).toBeInTheDocument();
    });
    expect(mocks.location.pathname).toBe("/passage/John-1");
    expect(screen.getByText("6 / 8")).toBeInTheDocument();
  });
});
