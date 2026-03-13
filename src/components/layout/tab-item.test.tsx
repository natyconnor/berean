import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TabItem } from "./tab-item";

describe("TabItem", () => {
  it("activates from the keyboard via the semantic button trigger", async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn();
    const onClose = vi.fn();

    render(
      <TabItem
        tab={{ id: "john-1", passageId: "John-1", label: "John 1" }}
        isActive={false}
        onActivate={onActivate}
        onClose={onClose}
      />,
    );

    await user.tab();
    await user.keyboard("{Enter}");

    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Close John 1" }),
    ).toBeInTheDocument();
  });
});
