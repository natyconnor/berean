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

import { MemoryRestartMenu } from "./memory-restart-menu";

const navigateMock = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
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
      learnHref="/memory/learn"
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

  it("keeps the menu after Start over and hides Undo after leaving the page", async () => {
    const first = renderMenu();
    await openStartOverConfirm();
    await userEvent.click(
      screen.getByRole("button", { name: START_OVER_CONFIRM_LABEL }),
    );

    expect(await screen.findByText(STARTED_OVER_LABEL)).toBeInTheDocument();
    expect(first.onStartOver).toHaveBeenCalledWith("whole", {
      replaceUndo: true,
    });
    expect(
      screen.getByRole("button", { name: "More actions" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: UNDO_LABEL }),
    ).toBeInTheDocument();

    first.unmount();
    renderMenu();
    expect(screen.queryByText(STARTED_OVER_LABEL)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "More actions" }),
    ).toBeInTheDocument();
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
        learnHref="/memory/learn"
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
        learnHref="/memory/learn"
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
