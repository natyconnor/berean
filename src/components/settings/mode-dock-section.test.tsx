import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ModeDockSection } from "./mode-dock-section";

vi.mock("convex/react", () => ({
  useQuery: () => "auto-hide",
  useMutation: () => vi.fn(),
}));

describe("ModeDockSection", () => {
  it("names Notes, Memory, and Study, and says the dock is hidden here", () => {
    render(<ModeDockSection />);

    expect(
      screen.getByText(/floating Notes \/ Memory \/ Study pill/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText("The dock is hidden on Settings."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Notes \/ Study pill/i)).not.toBeInTheDocument();
  });
});
