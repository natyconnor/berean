import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPage } from "./settings-page";

const navigateMock = vi.fn();
const startTourMock = vi.fn();
const useQueryMock = vi.fn<(reference: unknown, args?: unknown) => unknown>();
const addManyMock = vi.fn();
const removeManyMock = vi.fn();
const removeCustomTagAndDetachMock = vi.fn();
const completeSetupMock = vi.fn();
const setCategoryColorMock = vi.fn();
const seedDevChapterNotesMock = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
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
      case "api.userSettings.completeStarterTagsSetup":
        return completeSetupMock;
      case "api.userSettings.setStarterTagCategoryColor":
        return setCategoryColorMock;
      case "api.seed.seedDevChapterNotes":
        return seedDevChapterNotesMock;
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
      completeStarterTagsSetup: "api.userSettings.completeStarterTagsSetup",
      setStarterTagCategoryColor: "api.userSettings.setStarterTagCategoryColor",
    },
    seed: {
      seedDevChapterNotes: "api.seed.seedDevChapterNotes",
    },
  },
}));

vi.mock("@/components/settings/import-export-section", () => ({
  ImportExportSection: () => <div data-testid="import-export-section" />,
}));

vi.mock("@/components/tutorial/tutorial-context", () => ({
  useTutorial: () => ({
    startTour: startTourMock,
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
    completeSetupMock.mockReset();
    setCategoryColorMock.mockReset();
    seedDevChapterNotesMock.mockReset();
  });

  it("runs the dev seed mutation and renders the returned summary", async () => {
    const user = userEvent.setup();
    const catalog: Array<{ tag: string }> = [];
    const setupStatus = {
      needsStarterTagsSetup: false,
      categoryColors: {},
    };
    useQueryMock.mockImplementation((reference: string) => {
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
});
