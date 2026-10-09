import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  NOT_FOUND_DOCUMENT_TITLE,
  NotFoundPage,
} from "@/components/routes/not-found-page";

const { authState, routerState } = vi.hoisted(() => ({
  authState: { isAuthenticated: false, isLoading: false },
  routerState: {
    pathname: "/this-page-does-not-exist-123",
    canGoBack: false,
  },
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => authState,
}));

vi.mock("@tanstack/react-router", async () => {
  const React = await import("react");
  return {
    useLocation: () => ({ pathname: routerState.pathname }),
    useCanGoBack: () => routerState.canGoBack,
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

afterEach(() => {
  authState.isAuthenticated = false;
  authState.isLoading = false;
  routerState.pathname = "/this-page-does-not-exist-123";
  routerState.canGoBack = false;
  document.title = "";
  document
    .querySelectorAll('meta[name="robots"]')
    .forEach((node) => node.remove());
});

describe("NotFoundPage", () => {
  it("shows the signed-out not-found copy and marks the page noindex", async () => {
    render(<NotFoundPage />);

    const heading = screen.getByRole("heading", {
      level: 1,
      name: "This page isn't here",
    });
    expect(heading).toBeInTheDocument();
    expect(
      screen.getByText("The link may be mistyped, or the page may have moved."),
    ).toBeInTheDocument();
    expect(screen.getByText("404")).toBeInTheDocument();
    expect(
      screen.getByText("/this-page-does-not-exist-123"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Berean" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: "Berean" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(
      screen.queryByRole("button", { name: "Go back" }),
    ).not.toBeInTheDocument();

    await waitFor(() => {
      expect(document.title).toBe(NOT_FOUND_DOCUMENT_TITLE);
      expect(heading).toHaveFocus();
    });
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex",
    );
  });

  it("offers notes and history when the reader is signed in and can go back", () => {
    authState.isAuthenticated = true;
    routerState.canGoBack = true;
    routerState.pathname = "/missing-note";
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});

    render(<NotFoundPage />);

    expect(
      screen.getByRole("link", { name: "Back to your notes" }),
    ).toHaveAttribute("href", "/");
    fireEvent.click(screen.getByRole("button", { name: "Go back" }));
    expect(back).toHaveBeenCalledOnce();
    back.mockRestore();
  });
});
