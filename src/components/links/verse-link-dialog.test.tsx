import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { VerseLinkDialog } from "./verse-link-dialog";

const mutationMock = vi.fn();

vi.mock("convex/react", () => ({
  useMutation: () => mutationMock,
}));

const sourceRef = {
  book: "John",
  chapter: 1,
  startVerse: 1,
  endVerse: 1,
};

function renderDialog() {
  return render(
    <TooltipProvider delayDuration={0}>
      <VerseLinkDialog open onOpenChange={() => {}} sourceRef={sourceRef} />
    </TooltipProvider>,
  );
}

describe("VerseLinkDialog", () => {
  beforeEach(() => {
    mutationMock.mockReset();
    mutationMock.mockResolvedValue("ref-id");
  });

  it.each(["John 3:0", "John 3:5-3"])("does not save %s", async (input) => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByPlaceholderText(/target verse/i), input);
    await user.click(screen.getByRole("button", { name: /create link/i }));

    expect(screen.getByText(/enter a valid reference/i)).toBeInTheDocument();
    expect(mutationMock).not.toHaveBeenCalled();
  });

  it("saves a valid reference", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByPlaceholderText(/target verse/i), "John 3:16");
    await user.click(screen.getByRole("button", { name: /create link/i }));

    expect(mutationMock).toHaveBeenCalled();
  });
});
