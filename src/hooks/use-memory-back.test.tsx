import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useMemoryExit } from "./use-memory-back";

const navigate = vi.fn();
const queryState = vi.hoisted(() => ({
  pack: undefined as { name: string } | null | undefined,
  verse: undefined as
    | {
        book: string;
        chapter: number;
        startVerse: number;
        endVerse: number;
      }
    | null
    | undefined,
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
}));

vi.mock("convex/react", () => ({
  useQuery: (_query: unknown, args: unknown) => {
    if (args === "skip") return undefined;
    if (args && typeof args === "object" && "id" in args) {
      return queryState.pack;
    }
    if (args && typeof args === "object" && "verseRefId" in args) {
      return queryState.verse;
    }
    return undefined;
  },
}));

vi.mock("@/hooks/use-live-now", () => ({
  useLiveNow: () => 0,
}));

function ExitButton({
  returnTo,
  fallbackHref,
}: {
  returnTo?: string;
  fallbackHref?: string;
}) {
  const exit = useMemoryExit(returnTo, fallbackHref);
  return (
    <button type="button" onClick={exit.go}>
      {exit.label}
    </button>
  );
}

describe("useMemoryExit", () => {
  const back = vi.spyOn(window.history, "back");

  beforeEach(() => {
    navigate.mockReset();
    queryState.pack = undefined;
    queryState.verse = undefined;
    back.mockReset();
    back.mockImplementation(() => {});
  });

  it("goes to Memory from a bare session and names it", async () => {
    render(<ExitButton />);

    await userEvent.click(
      screen.getByRole("button", { name: "Back to Memory" }),
    );

    expect(navigate).toHaveBeenCalledWith({ href: "/memory", replace: true });
    expect(back).not.toHaveBeenCalled();
  });

  it("goes to a valid return, even with history behind the session", async () => {
    render(<ExitButton returnTo="/memory?panel=pack:merced" />);

    await userEvent.click(
      screen.getByRole("button", { name: "Back to Memory" }),
    );

    expect(navigate).toHaveBeenCalledWith({
      href: "/memory?panel=pack:merced",
      replace: true,
    });
    expect(back).not.toHaveBeenCalled();
  });

  it("returns to a passage and names the chapter", async () => {
    render(<ExitButton returnTo="/passage/John-3" />);

    await userEvent.click(
      screen.getByRole("button", { name: "Back to John 3" }),
    );

    expect(navigate).toHaveBeenCalledWith({
      href: "/passage/John-3",
      replace: true,
    });
    expect(back).not.toHaveBeenCalled();
  });

  it("drops an unsafe return and goes to Memory", async () => {
    render(<ExitButton returnTo="https://evil.com/memory" />);

    await userEvent.click(
      screen.getByRole("button", { name: "Back to Memory" }),
    );

    expect(navigate).toHaveBeenCalledWith({ href: "/memory", replace: true });
    expect(back).not.toHaveBeenCalled();
  });

  it("uses a pack fallback and the loaded pack name", async () => {
    queryState.pack = { name: "Merced Team" };
    render(<ExitButton fallbackHref="/memory/merced" />);

    await userEvent.click(
      screen.getByRole("button", { name: "Back to Merced Team" }),
    );

    expect(navigate).toHaveBeenCalledWith({
      href: "/memory/merced",
      replace: true,
    });
  });

  it("falls back to Memory when the return pack is gone", async () => {
    queryState.pack = null;
    render(<ExitButton returnTo="/memory/deletedpack" />);

    await userEvent.click(
      screen.getByRole("button", { name: "Back to Memory" }),
    );

    expect(navigate).toHaveBeenCalledWith({ href: "/memory", replace: true });
  });
});
