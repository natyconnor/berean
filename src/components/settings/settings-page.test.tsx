import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPage } from "./settings-page";

const navigateMock = vi.fn();
const startTourMock = vi.fn();
const useQueryMock = vi.fn<(...args: unknown[]) => unknown>();
const addManyMock = vi.fn();
const removeManyMock = vi.fn();
const removeCustomTagAndDetachMock = vi.fn();
const setCategoryColorMock = vi.fn();
const seedDevChapterNotesMock = vi.fn();
const resetHintMock = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
  Link: ({
    to,
    children,
    ...props
  }: {
    to: string;
    children: ReactNode;
  } & HTMLAttributes<HTMLAnchorElement>) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      ...props
    }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) => (
      <div {...props}>{children}</div>
    ),
  },
}));

vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
  useMutation: (reference: string) => {
    switch (reference) {
      case "api.tags.addMany":
        return addManyMock;
      case "api.tags.removeMany":
        return removeManyMock;
      case "api.tags.removeCustomTagAndDetach":
        return removeCustomTagAndDetachMock;
      case "api.userSettings.setStarterTagCategoryColor":
        return setCategoryColorMock;
      case "api.seed.seedDevChapterNotes":
        return seedDevChapterNotesMock;
      case "api.onboarding.resetHint":
        return resetHintMock;
      case "api.users.deleteMyAccount":
        return vi.fn();
      default:
        return vi.fn();
    }
  },
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    tags: {
      listCatalog: "api.tags.listCatalog",
      addMany: "api.tags.addMany",
      removeMany: "api.tags.removeMany",
      removeCustomTagAndDetach: "api.tags.removeCustomTagAndDetach",
    },
    userSettings: {
      getTutorialStatus: "api.userSettings.getTutorialStatus",
      setStarterTagCategoryColor: "api.userSettings.setStarterTagCategoryColor",
    },
    onboarding: {
      resetHint: "api.onboarding.resetHint",
    },
    seed: {
      seedDevChapterNotes: "api.seed.seedDevChapterNotes",
    },
    users: {
      deleteMyAccount: "api.users.deleteMyAccount",
    },
  },
}));

vi.mock("@/components/settings/import-export-section", () => ({
  ImportExportSection: () => <div data-testid="import-export-section" />,
}));

vi.mock("@/components/tutorial/tutorial-context", () => ({
  useTutorial: () => ({
    startTour: startTourMock,
    isFocusModeTutorialComplete: true,
  }),
}));

vi.mock("@/lib/use-tabs", () => ({
  useTabs: () => ({
    backPassageId: "John-3",
  }),
}));

vi.mock("@/components/ui/tooltip-button", () => ({
  TooltipButton: ({
    children,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

describe("SettingsPage", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    startTourMock.mockReset();
    useQueryMock.mockReset();
    addManyMock.mockReset();
    removeManyMock.mockReset();
    removeCustomTagAndDetachMock.mockReset();
    setCategoryColorMock.mockReset();
    seedDevChapterNotesMock.mockReset();
    resetHintMock.mockReset();
  });

  it("runs the dev seed mutation and renders the returned summary", async () => {
    const user = userEvent.setup();
    const catalog: Array<{ tag: string }> = [];
    const setupStatus = {
      categoryColors: {},
    };
    useQueryMock.mockImplementation((reference: unknown) => {
      if (reference === "api.tags.listCatalog") {
        return catalog;
      }
      if (reference === "api.userSettings.getTutorialStatus") {
        return setupStatus;
      }
      return undefined;
    });
    seedDevChapterNotesMock.mockResolvedValue({
      seed: 42,
      selectedChapters: 50,
      heavyChapters: 10,
      notesCreated: 500,
      verseRefsCreated: 250,
      linksCreated: 500,
      testamentDistribution: { ot: 30, nt: 20 },
      cleanup: {
        notesDeleted: 12,
        linksDeleted: 12,
        verseRefsDeleted: 6,
      },
      usedTags: ["faith", "love"],
    });

    render(<SettingsPage />);

    await user.click(
      screen.getByRole("button", { name: /generate dev test notes/i }),
    );

    expect(seedDevChapterNotesMock).toHaveBeenCalledWith({
      confirmReplace: true,
    });
    expect(
      screen.getByText((_, element) => {
        return (
          element?.tagName.toLowerCase() === "p" &&
          (element.textContent ?? "").includes("Seed 42 complete.")
        );
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/notes created:/i)).toBeInTheDocument();
    expect(screen.getAllByText("500")).toHaveLength(2);
    expect(screen.getByText(/starter tags used:/i)).toBeInTheDocument();
  });

  it("shows Berean for Mac just above the legal links, only in the Mac app", () => {
    useQueryMock.mockImplementation((reference: unknown) => {
      if (reference === "api.tags.listCatalog") return [];
      if (reference === "api.userSettings.getTutorialStatus") {
        return { categoryColors: {} };
      }
      return undefined;
    });

    const { unmount } = render(<SettingsPage />);
    expect(
      screen.queryByRole("heading", { name: "Berean for Mac" }),
    ).toBeNull();
    unmount();

    // A shell from before the version bridge: still no card.
    window.bereanDesktop = { isDesktop: true, platform: "darwin" };
    const oldShell = render(<SettingsPage />);
    expect(
      screen.queryByRole("heading", { name: "Berean for Mac" }),
    ).toBeNull();
    oldShell.unmount();

    window.bereanDesktop = {
      isDesktop: true,
      platform: "darwin",
      shellVersion: "1.0.2",
    };
    render(<SettingsPage />);
    const card = screen
      .getByRole("heading", { name: "Berean for Mac" })
      .closest("section");
    expect(card).toHaveTextContent("Version 1.0.2");
    expect(card?.nextElementSibling).toContainElement(
      screen.getByRole("link", { name: "Privacy Policy" }),
    );
    delete window.bereanDesktop;
  });

  it("offers Download for Mac first, only on a Mac in the browser", () => {
    useQueryMock.mockImplementation((reference: unknown) => {
      if (reference === "api.tags.listCatalog") return [];
      if (reference === "api.userSettings.getTutorialStatus") {
        return { categoryColors: {} };
      }
      return undefined;
    });
    const userAgent = vi.spyOn(window.navigator, "userAgent", "get");
    const downloadLink = () =>
      screen.queryByRole("link", { name: "Download for Mac" });

    userAgent.mockReturnValue(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
    );
    const mac = render(<SettingsPage />);
    const row = downloadLink()?.closest("section");
    expect(downloadLink()).toHaveAttribute("href", "/download");
    expect(row).toHaveClass("rounded-lg", "border", "bg-card", "p-4");
    expect(row).toHaveTextContent(
      "Berean for MacAll of Berean, in its own app on your Mac.",
    );
    expect(row?.nextElementSibling).toBe(
      screen.getByTestId("import-export-section"),
    );
    mac.unmount();

    // Inside the Mac app: no row, just the existing update card.
    window.bereanDesktop = {
      isDesktop: true,
      platform: "darwin",
      shellVersion: "1.0.2",
    };
    const app = render(<SettingsPage />);
    expect(downloadLink()).toBeNull();
    expect(screen.getByText("Version 1.0.2")).toBeInTheDocument();
    app.unmount();
    delete window.bereanDesktop;

    userAgent.mockReturnValue(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    );
    render(<SettingsPage />);
    expect(downloadLink()).toBeNull();
    expect(
      screen.queryByRole("heading", { name: "Berean for Mac" }),
    ).toBeNull();
    userAgent.mockRestore();
  });

  it("does not show Mode Dock preference options", () => {
    useQueryMock.mockImplementation((reference: unknown) => {
      if (reference === "api.tags.listCatalog") {
        return [];
      }
      if (reference === "api.userSettings.getTutorialStatus") {
        return { categoryColors: {} };
      }
      return undefined;
    });

    render(<SettingsPage />);

    expect(
      screen.queryByRole("heading", { name: /mode dock/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("radiogroup", { name: /mode dock behavior/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("radio", { name: /auto-hide/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("radio", { name: /always show/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("The dock is hidden on Settings."),
    ).not.toBeInTheDocument();
  });

  it("resets the Memory welcome explainer with the other feature hints", async () => {
    const user = userEvent.setup();
    useQueryMock.mockImplementation((reference: unknown) => {
      if (reference === "api.tags.listCatalog") {
        return [];
      }
      if (reference === "api.userSettings.getTutorialStatus") {
        return { categoryColors: {} };
      }
      return undefined;
    });
    resetHintMock.mockResolvedValue(null);

    render(<SettingsPage />);
    await user.click(
      screen.getByRole("button", { name: "Reset feature hints" }),
    );

    await waitFor(() => {
      expect(resetHintMock).toHaveBeenCalledWith({
        hintId: "memory-first-open-explainer",
      });
    });
  });
});
