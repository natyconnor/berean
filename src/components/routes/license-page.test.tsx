import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LicensePage } from "@/components/routes/license-page";

vi.mock("@tanstack/react-router", async () => {
  const React = await import("react");
  return {
    useCanGoBack: () => false,
    useNavigate: () => vi.fn(),
    Link: React.forwardRef<
      HTMLAnchorElement,
      React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }
    >(function Link({ to, children, ...props }, ref) {
      return (
        <a ref={ref} href={to} {...props}>
          {children}
        </a>
      );
    }),
  };
});

describe("LicensePage", () => {
  it("renders the repository MIT license", () => {
    render(<LicensePage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "License" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/MIT License/)).toBeInTheDocument();
    expect(
      screen.getByText(/Copyright \(c\) 2026 Nathan Connor/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "← Back" })).toBeInTheDocument();
  });
});
