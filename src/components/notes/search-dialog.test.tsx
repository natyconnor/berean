import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

import { SearchDialog } from "./search-dialog";

vi.mock("convex-helpers/react/cache", () => ({
  useQuery: () => [],
}));

vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    tags: {
      listCatalog: "tags.listCatalog",
      backfillCatalogFromNotes: "tags.backfillCatalogFromNotes",
    },
    notes: { searchWorkspace: "notes.searchWorkspace" },
  },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("@/lib/use-tabs", () => ({
  useTabs: () => ({ openTab: vi.fn() }),
}));

vi.mock("@/lib/tag-color-styles", () => ({
  useStarterTagBadgeStyle: () => () => undefined,
}));

async function openSearchDialog() {
  const user = userEvent.setup();
  render(
    <TooltipProvider>
      <SearchDialog />
    </TooltipProvider>,
  );
  await user.click(screen.getByRole("button", { name: /Search notes/ }));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  return user;
}

describe("SearchDialog on browser Back and Forward", () => {
  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("closes on popstate", async () => {
    await openSearchDialog();

    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("stays open on in-app pushState navigation", async () => {
    await openSearchDialog();

    act(() => {
      window.history.pushState(null, "", "/search");
    });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
