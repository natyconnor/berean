import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  memoryExitLabel,
  memoryExitTarget,
  useMemoryExit,
  useMemoryExitLabel,
} from "./use-memory-back";

const navigate = vi.fn();
let canGoBack = false;

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  useCanGoBack: () => canGoBack,
}));

function ExitButton({
  returnTo,
  fallbackHref,
}: {
  returnTo?: string;
  fallbackHref?: string;
}) {
  const onExit = useMemoryExit(returnTo, fallbackHref);
  const label = useMemoryExitLabel(returnTo, fallbackHref);
  return (
    <button type="button" onClick={onExit}>
      {label}
    </button>
  );
}

describe("useMemoryExit", () => {
  const back = vi.spyOn(window.history, "back");

  beforeEach(() => {
    navigate.mockReset();
    canGoBack = false;
    back.mockReset();
    back.mockImplementation(() => {});
  });

  afterAll(() => {
    back.mockRestore();
  });

  it("goes to a valid return, open drawer included, even with history", async () => {
    canGoBack = true;
    render(<ExitButton returnTo="/memory?panel=pack:merced" />);

    await userEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(navigate).toHaveBeenCalledWith({
      href: "/memory?panel=pack:merced",
      replace: true,
    });
    expect(back).not.toHaveBeenCalled();
  });

  it("labels a return to Today", async () => {
    render(<ExitButton returnTo="/memory" />);

    await userEvent.click(
      screen.getByRole("button", { name: "Back to Today" }),
    );

    expect(navigate).toHaveBeenCalledWith({ href: "/memory", replace: true });
  });

  it("falls back to the previous screen when the return is invalid", async () => {
    canGoBack = true;
    render(<ExitButton returnTo="https://evil.com/memory" />);

    await userEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(back).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("falls back to the previous screen when there is no return", async () => {
    canGoBack = true;
    render(<ExitButton />);

    await userEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(back).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("lands on Today when there is no return and no history", async () => {
    render(<ExitButton returnTo="//evil.com" />);

    await userEvent.click(
      screen.getByRole("button", { name: "Back to Today" }),
    );

    expect(navigate).toHaveBeenCalledWith({ href: "/memory", replace: true });
    expect(back).not.toHaveBeenCalled();
  });

  it("uses a caller fallback when there is no return and no history", async () => {
    render(<ExitButton fallbackHref="/memory/merced" />);

    await userEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(navigate).toHaveBeenCalledWith({
      href: "/memory/merced",
      replace: true,
    });
  });
});

describe("memoryExitTarget", () => {
  it("prefers return, then history, then the fallback", () => {
    expect(memoryExitTarget("/memory/verses", true)).toEqual({
      kind: "return",
      href: "/memory/verses",
    });
    expect(memoryExitTarget(undefined, true)).toEqual({ kind: "history" });
    expect(memoryExitTarget(undefined, false)).toEqual({
      kind: "fallback",
      href: "/memory",
    });
  });

  it("names only a landing on Today as Back to Today", () => {
    expect(memoryExitLabel({ kind: "return", href: "/memory" })).toBe(
      "Back to Today",
    );
    expect(memoryExitLabel({ kind: "fallback", href: "/memory" })).toBe(
      "Back to Today",
    );
    expect(memoryExitLabel({ kind: "history" })).toBe("Back");
    expect(
      memoryExitLabel({ kind: "return", href: "/memory?panel=verses" }),
    ).toBe("Back");
  });
});
