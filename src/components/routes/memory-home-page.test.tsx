import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { MemoryHomeSearch } from "@/lib/memory-panel";
import { MemoryHomePage } from "./memory-home-page";

const navigateMock = vi.fn();
let search: MemoryHomeSearch = { panel: "verses" };
let todayProps: {
  previewSeedTokens?: string[];
  previewReseed?: boolean;
  onPreviewReseeded?: () => void;
} = {};

vi.mock("@/components/memory/today/today-page", () => ({
  TodayPage: (props: typeof todayProps) => {
    todayProps = props;
    return <div>Today page stub</div>;
  },
}));

vi.mock("@/routes/memory/index", () => ({
  Route: {
    useSearch: () => search,
    useNavigate: () => navigateMock,
  },
}));

vi.mock("@/components/memory/drawer/memory-panel-host", () => ({
  MemoryPanelHost: ({ panel }: { panel?: string }) => (
    <div>Panel host: {panel}</div>
  ),
}));

describe("MemoryHomePage", () => {
  it("renders Today with the panel host and no welcome dialog", () => {
    search = { panel: "verses" };
    render(<MemoryHomePage />);

    expect(screen.getByText("Today page stub")).toBeInTheDocument();
    expect(screen.getByText("Panel host: verses")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Welcome to Memory" }),
    ).not.toBeInTheDocument();
    expect(todayProps.previewSeedTokens).toBeUndefined();
    expect(todayProps.previewReseed).toBe(false);
  });

  it("passes the parsed preview set and reseed flag to Today", () => {
    search = { previewSeed: "john-3-16,sample-mix", previewReseed: 1 };
    render(<MemoryHomePage />);
    expect(todayProps.previewSeedTokens).toEqual(["john-3-16", "sample-mix"]);
    expect(todayProps.previewReseed).toBe(true);
  });

  it("after a reseed, strips only previewReseed, keeping previewSeed, panel and from", () => {
    search = {
      panel: "pack:abc",
      from: "verses",
      previewSeed: "sample-mix",
      previewReseed: 1,
    };
    render(<MemoryHomePage />);
    todayProps.onPreviewReseeded?.();

    expect(navigateMock).toHaveBeenCalledTimes(1);
    const call = navigateMock.mock.calls[0]?.[0] as {
      search: (prev: MemoryHomeSearch) => MemoryHomeSearch;
      replace: boolean;
    };
    expect(call.replace).toBe(true);
    expect(call.search(search)).toEqual({
      panel: "pack:abc",
      from: "verses",
      previewSeed: "sample-mix",
      previewReseed: undefined,
    });
  });
});
