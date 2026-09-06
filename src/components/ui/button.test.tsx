import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./button";

describe("Button loading", () => {
  it("disables the button and shows a spinner while loading", () => {
    render(<Button loading>Save</Button>);

    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button.querySelector("[data-icon=spinner]")).not.toBeNull();
  });

  it("keeps a caller-disabled button disabled after loading ends", () => {
    const { rerender } = render(
      <Button disabled loading>
        Save
      </Button>,
    );

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

    rerender(
      <Button disabled loading={false}>
        Save
      </Button>,
    );

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save" })).not.toHaveAttribute(
      "aria-busy",
    );
    expect(
      screen
        .getByRole("button", { name: "Save" })
        .querySelector("[data-icon=spinner]"),
    ).toBeNull();
  });

  it("does not inject a spinner when rendering asChild", () => {
    render(
      <Button asChild loading>
        <a href="#save">Save</a>
      </Button>,
    );

    const link = screen.getByRole("link", { name: "Save" });
    expect(link.querySelector("[data-icon=spinner]")).toBeNull();
  });
});

describe("Button", () => {
  it("forwards clicks when it is not loading", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);

    screen.getByRole("button", { name: "Save" }).click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
