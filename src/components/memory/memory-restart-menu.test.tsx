import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  START_OVER_CONFIRM_BODY,
  START_OVER_CONFIRM_LABEL,
  START_OVER_MENU_LABEL,
  STARTED_OVER_LABEL,
  UNDO_LABEL,
  WHOLE_PACK_OPTION,
  shakyVersesOption,
} from "@/lib/memory-copy";

import { MemoryRestartMenu, VerseRestartMenu } from "./memory-restart-menu";
import type { Id } from "../../../convex/_generated/dataModel";

const navigateMock = vi.fn();
const mutations = vi.hoisted(() => ({
  byName: new Map<string, ReturnType<typeof vi.fn>>(),
}));

function mutation(name: string) {
  let fn = mutations.byName.get(name);
  if (!fn) {
    fn = vi.fn().mockResolvedValue({});
    mutations.byName.set(name, fn);
  }
  return fn;
}

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("convex/react", () => ({
  useMutation: (name: string) => mutation(name),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    verseMemory: {
      startOver: "verseMemory.startOver",
      undoStartOver: "verseMemory.undoStartOver",
      finishRefresh: "verseMemory.finishRefresh",
      stopMemorizing: "verseMemory.stopMemorizing",
    },
  },
}));

function renderMenu(
  overrides: Partial<Parameters<typeof MemoryRestartMenu>[0]> = {},
) {
  const onStartOver = vi.fn().mockResolvedValue(undefined);
  const onUndo = vi.fn().mockResolvedValue(undefined);
  const onRefresh = vi.fn().mockResolvedValue(undefined);
  const view = render(
    <MemoryRestartMenu
      name="Romans 8:28"
      isDrawer={false}
      refreshHref="/memory/practice"
      refreshTarget={{
        scope: "verse",
        mark: { status: "reviewing", learnStage: 3 },
      }}
      onRefresh={onRefresh}
      onStartOver={onStartOver}
      onUndo={onUndo}
      stop={{
        label: "Stop memorizing",
        title: "Stop memorizing Romans 8:28?",
        description: "Your progress is saved if you start again.",
        onConfirm: async () => {},
      }}
      {...overrides}
    />,
  );
  return {
    onStartOver,
    onUndo,
    onRefresh,
    unmount: view.unmount,
    rerender: view.rerender,
  };
}

async function openStartOverConfirm() {
  await userEvent.click(screen.getByRole("button", { name: "More actions" }));
  await userEvent.click(
    await screen.findByRole("menuitem", {
      name: new RegExp(START_OVER_MENU_LABEL),
    }),
  );
}

describe("MemoryRestartMenu", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    mutations.byName.clear();
  });

  it("hides Refresh and Start over when there is nothing to restart", async () => {
    renderMenu({ showRestart: false });
    await userEvent.click(screen.getByRole("button", { name: "More actions" }));
    expect(
      screen.queryByRole("menuitem", { name: /Refresh/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: /Start over/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Stop memorizing" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
  });

  it("hides Refresh on a new verse and keeps Start over", async () => {
    renderMenu({
      refreshTarget: { scope: "verse", mark: { status: "new", learnStage: 0 } },
    });
    await userEvent.click(screen.getByRole("button", { name: "More actions" }));
    expect(
      screen.queryByRole("menuitem", { name: /Refresh/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /Start over/ }),
    ).toBeInTheDocument();
  });

  it("keeps the Start over confirm open after a mouse click", async () => {
    renderMenu();
    await openStartOverConfirm();

    expect(
      await screen.findByRole("heading", { name: "Start Romans 8:28 over?" }),
    ).toBeInTheDocument();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
    });
    expect(
      screen.getByRole("heading", { name: "Start Romans 8:28 over?" }),
    ).toBeInTheDocument();
  });

  it("keeps the Start over confirm open after a touch select", async () => {
    renderMenu();
    await userEvent.click(screen.getByRole("button", { name: "More actions" }));
    const item = await screen.findByRole("menuitem", {
      name: new RegExp(START_OVER_MENU_LABEL),
    });
    await userEvent.pointer({ keys: "[TouchA]", target: item });
    await userEvent.pointer({ keys: "[/TouchA]", target: item });

    expect(
      await screen.findByRole("heading", { name: "Start Romans 8:28 over?" }),
    ).toBeInTheDocument();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
    });
    expect(
      screen.getByRole("heading", { name: "Start Romans 8:28 over?" }),
    ).toBeInTheDocument();
  });

  it("reopens the confirm after Cancel from the keyboard", async () => {
    renderMenu();
    const more = screen.getByRole("button", { name: "More actions" });
    more.focus();
    await userEvent.keyboard("{Enter}");
    const item = await screen.findByRole("menuitem", {
      name: new RegExp(START_OVER_MENU_LABEL),
    });
    item.focus();
    await userEvent.keyboard("{Enter}");

    const confirm = await screen.findByRole("heading", {
      name: "Start Romans 8:28 over?",
    });
    expect(confirm).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "Start Romans 8:28 over?" }),
      ).not.toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: "More actions" }));
    await userEvent.click(
      await screen.findByRole("menuitem", {
        name: new RegExp(START_OVER_MENU_LABEL),
      }),
    );
    expect(
      await screen.findByRole("heading", { name: "Start Romans 8:28 over?" }),
    ).toBeInTheDocument();
  });

  it("returns focus to More actions after Cancel", async () => {
    renderMenu();
    await openStartOverConfirm();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "Start Romans 8:28 over?" }),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "More actions" })).toHaveFocus();
  });

  it("returns focus to More actions after Undo", async () => {
    renderMenu();
    await openStartOverConfirm();
    await userEvent.click(
      screen.getByRole("button", { name: START_OVER_CONFIRM_LABEL }),
    );
    expect(await screen.findByText(STARTED_OVER_LABEL)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: UNDO_LABEL }));
    await waitFor(() => {
      expect(screen.queryByText(STARTED_OVER_LABEL)).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "More actions" })).toHaveFocus();
  });

  it("keeps the menu after Start over and hides Undo after leaving the page", async () => {
    const first = renderMenu();
    await openStartOverConfirm();
    await userEvent.click(
      screen.getByRole("button", { name: START_OVER_CONFIRM_LABEL }),
    );

    expect(await screen.findByText(STARTED_OVER_LABEL)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "More actions" }));
    expect(
      screen.queryByRole("menuitem", { name: /Refresh/ }),
    ).not.toBeInTheDocument();
    expect(first.onStartOver).toHaveBeenCalledWith("whole", {
      replaceUndo: true,
    });
    expect(
      screen.getByRole("button", { name: "More actions" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: UNDO_LABEL }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Learn/ }),
    ).not.toBeInTheDocument();

    first.unmount();
    renderMenu();
    expect(screen.queryByText(STARTED_OVER_LABEL)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "More actions" }),
    ).toBeInTheDocument();
  });

  it("keeps Undo after Start over when the verse becomes Up next", async () => {
    const onStartOver = vi.fn().mockResolvedValue(undefined);
    const onUndo = vi.fn().mockResolvedValue(undefined);
    const props = {
      name: "John 1:1",
      isDrawer: false as const,
      refreshHref: "/memory/practice?refresh=1",
      refreshTarget: {
        scope: "verse" as const,
        mark: { status: "mastered" as const, learnStage: 3 },
      },
      onStartOver,
      onUndo,
      showRestart: true,
      triggerLabel: "Options for John 1:1",
    };
    const { rerender } = render(<MemoryRestartMenu {...props} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Options for John 1:1" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: /Start over/ }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: START_OVER_CONFIRM_LABEL }),
    );
    expect(await screen.findByText(STARTED_OVER_LABEL)).toBeInTheDocument();

    rerender(
      <MemoryRestartMenu
        {...props}
        showRestart={false}
        refreshTarget={undefined}
      />,
    );
    expect(screen.getByText(STARTED_OVER_LABEL)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: UNDO_LABEL }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Options for John 1:1" }),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: UNDO_LABEL }));
    expect(onUndo).toHaveBeenCalled();
  });

  it("shows only the title and buttons when a passage has no shaky verses", async () => {
    renderMenu({ wholeLabel: "passage", shakyLabels: [] });
    await openStartOverConfirm();

    const popover = await screen.findByRole("heading", {
      name: "Start Romans 8:28 over?",
    });
    const dialog = popover.closest("[data-slot='popover-content']");
    expect(dialog).not.toBeNull();
    expect(
      within(dialog as HTMLElement).queryByText(START_OVER_CONFIRM_BODY),
    ).not.toBeInTheDocument();
    expect(
      within(dialog as HTMLElement).getByRole("button", { name: "Cancel" }),
    ).toBeInTheDocument();
    expect(
      within(dialog as HTMLElement).getByRole("button", {
        name: START_OVER_CONFIRM_LABEL,
      }),
    ).toBeInTheDocument();
  });

  it("defaults to the shaky verses once they load", async () => {
    const view = renderMenu({ wholeLabel: "pack", shakyLabels: [] });
    await openStartOverConfirm();
    expect(
      screen.queryByRole("button", { name: /Just the shaky verses/ }),
    ).not.toBeInTheDocument();

    view.rerender(
      <MemoryRestartMenu
        name="Romans 8:28"
        isDrawer={false}
        refreshHref="/memory/practice"
        refreshTarget={{
          scope: "verse",
          mark: { status: "reviewing", learnStage: 3 },
        }}
        onRefresh={view.onRefresh}
        onStartOver={view.onStartOver}
        onUndo={view.onUndo}
        stop={{
          label: "Stop memorizing",
          title: "Stop memorizing Romans 8:28?",
          description: "Your progress is saved if you start again.",
          onConfirm: async () => {},
        }}
        wholeLabel="pack"
        shakyLabels={["Psalm 119:105"]}
      />,
    );

    expect(
      await screen.findByRole("button", {
        name: shakyVersesOption("Psalm 119:105"),
      }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: START_OVER_CONFIRM_LABEL }),
    );
    expect(view.onStartOver).toHaveBeenCalledWith("shaky", {
      replaceUndo: true,
    });
  });

  it("keeps a whole-pack pick after shaky verses load again", async () => {
    const view = renderMenu({
      wholeLabel: "pack",
      shakyLabels: ["Psalm 119:105"],
    });
    await openStartOverConfirm();
    await userEvent.click(
      screen.getByRole("button", { name: WHOLE_PACK_OPTION }),
    );
    view.rerender(
      <MemoryRestartMenu
        name="Romans 8:28"
        isDrawer={false}
        refreshHref="/memory/practice"
        refreshTarget={{
          scope: "verse",
          mark: { status: "reviewing", learnStage: 3 },
        }}
        onRefresh={view.onRefresh}
        onStartOver={view.onStartOver}
        onUndo={view.onUndo}
        stop={{
          label: "Stop memorizing",
          title: "Stop memorizing Romans 8:28?",
          description: "Your progress is saved if you start again.",
          onConfirm: async () => {},
        }}
        wholeLabel="pack"
        shakyLabels={["Psalm 119:105"]}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: START_OVER_CONFIRM_LABEL }),
    );
    expect(view.onStartOver).toHaveBeenCalledWith("whole", {
      replaceUndo: true,
    });
  });
});

describe("VerseRestartMenu", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    mutations.byName.clear();
  });

  it("opens a learning verse Refresh sitting without applying the rung", async () => {
    render(
      <VerseRestartMenu
        verseRefId={"vr_1" as Id<"verseRefs">}
        reference="Romans 8:28"
        status="learning"
        learnStage={1}
        refreshHref="/memory/practice?refresh=1"
        isDrawer={false}
        onStopped={() => {}}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "More actions" }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: /Refresh/ }),
    );

    expect(mutation("verseMemory.finishRefresh")).not.toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith({
      href: "/memory/practice?refresh=1",
    });
  });

  it("keeps Start over and hides Refresh on Read", async () => {
    render(
      <VerseRestartMenu
        verseRefId={"vr_1" as Id<"verseRefs">}
        reference="Romans 8:28"
        status="learning"
        learnStage={0}
        refreshHref="/memory/practice?refresh=1"
        isDrawer={false}
        onStopped={() => {}}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "More actions" }));
    expect(
      screen.queryByRole("menuitem", { name: /Refresh/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /Start over/ }),
    ).toBeInTheDocument();
  });

  it("keeps Start over and hides Refresh on a new verse", async () => {
    render(
      <VerseRestartMenu
        verseRefId={"vr_1" as Id<"verseRefs">}
        reference="Romans 8:28"
        status="new"
        learnStage={0}
        refreshHref="/memory/practice?refresh=1"
        isDrawer={false}
        onStopped={() => {}}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "More actions" }));
    expect(
      screen.queryByRole("menuitem", { name: /Refresh/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /Start over/ }),
    ).toBeInTheDocument();
  });
});
