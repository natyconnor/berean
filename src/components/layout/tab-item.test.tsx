import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Reorder } from "framer-motion";
import { describe, expect, it, vi } from "vitest";
import { TabItem } from "./tab-item";

describe("TabItem", () => {
  it("activates from the keyboard via the semantic button trigger", async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn();
    const onClose = vi.fn();

    render(
      <Reorder.Group
        axis="x"
        values={[{ id: "john-1", passageId: "John-1", label: "John 1" }]}
        onReorder={() => {}}
      >
        <TabItem
          tab={{ id: "john-1", passageId: "John-1", label: "John 1" }}
          isActive={false}
          onActivate={onActivate}
          onClose={onClose}
        />
      </Reorder.Group>,
    );

    await user.tab();
    await user.keyboard("{Enter}");

    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Close John 1" }),
    ).toBeInTheDocument();
  });

  it("places the active indicator above the horizontal scrollbar", () => {
    render(
      <Reorder.Group
        axis="x"
        values={[{ id: "john-1", passageId: "John-1", label: "John 1" }]}
        onReorder={() => {}}
      >
        <TabItem
          tab={{ id: "john-1", passageId: "John-1", label: "John 1" }}
          isActive
          onActivate={() => {}}
          onClose={() => {}}
        />
      </Reorder.Group>,
    );

    expect(
      screen.getByRole("button", { name: "John 1" }).parentElement,
    ).toHaveClass(
      "border-t-[3px]",
      "border-t-primary",
      "bg-primary/10",
      "font-semibold",
    );
  });
});
