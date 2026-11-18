import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DESKTOP_AUTH_REDIRECT_PATH } from "@/lib/desktop-platform";

import { LoginPage } from "./login-page";

const mocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  logInteraction:
    vi.fn<
      (
        category: string,
        action: string,
        details?: Record<string, unknown>,
      ) => void
    >(),
}));

vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn: mocks.signIn }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock("@/components/login-page-atmosphere", () => ({
  LoginPageAtmosphere: () => null,
}));

vi.mock("@/lib/dev-log", () => ({
  devLog: { error: vi.fn() },
  logInteraction: mocks.logInteraction,
}));

const WAITING_TEXT = "Finish signing in in your browser";

function loggedActions(): string[] {
  return mocks.logInteraction.mock.calls.map(([, action]) => action);
}

beforeEach(() => {
  mocks.signIn.mockReset();
  mocks.logInteraction.mockReset();
  // Convex Auth resolves once it has pointed the page at the provider.
  mocks.signIn.mockResolvedValue({ signingIn: false });
});

afterEach(() => {
  delete window.bereanDesktop;
});

describe("LoginPage sign-in on the web", () => {
  it("starts Google sign-in with no redirect override and keeps the spinner", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(
      screen.getByRole("button", { name: "Sign in with Google" }),
    );

    expect(mocks.signIn).toHaveBeenCalledTimes(1);
    expect(mocks.signIn).toHaveBeenCalledWith("google");
    await waitFor(() => {
      expect(loggedActions()).toContain("sign-in-completed");
    });
    // The browser is navigating to Google; the button stays busy until then.
    expect(screen.getByRole("button", { name: "Signing in…" })).toBeDisabled();
    expect(screen.queryByText(WAITING_TEXT)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Open browser again" }),
    ).not.toBeInTheDocument();
    expect(loggedActions()).not.toContain("sign-in-handed-off-to-browser");
  });
});

describe("LoginPage sign-in in the desktop app", () => {
  beforeEach(() => {
    window.bereanDesktop = { isDesktop: true, platform: "darwin" };
  });

  it("sends the browser back to the hand-off page and shows the waiting state", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(
      screen.getByRole("button", { name: "Sign in with Google" }),
    );

    expect(mocks.signIn).toHaveBeenCalledTimes(1);
    expect(mocks.signIn).toHaveBeenCalledWith("google", {
      redirectTo: DESKTOP_AUTH_REDIRECT_PATH,
    });
    expect(await screen.findByText(WAITING_TEXT)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Sign in with Google|Signing in/ }),
    ).not.toBeInTheDocument();
    expect(loggedActions()).toContain("sign-in-handed-off-to-browser");
    expect(loggedActions()).not.toContain("sign-in-completed");
  });

  it("restarts sign-in from Open browser again", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(
      screen.getByRole("button", { name: "Sign in with Google" }),
    );
    const again = await screen.findByRole("button", {
      name: "Open browser again",
    });
    expect(again).toBeEnabled();

    await user.click(again);

    expect(mocks.signIn).toHaveBeenCalledTimes(2);
    expect(mocks.signIn).toHaveBeenLastCalledWith("google", {
      redirectTo: DESKTOP_AUTH_REDIRECT_PATH,
    });
    expect(screen.getByText(WAITING_TEXT)).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: "Open browser again" }),
    ).toBeEnabled();
  });

  it("returns to the sign-in button when starting sign-in fails", async () => {
    mocks.signIn.mockRejectedValueOnce(new Error("network down"));
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(
      screen.getByRole("button", { name: "Sign in with Google" }),
    );

    await waitFor(() => {
      expect(loggedActions()).toContain("sign-in-failed");
    });
    expect(
      screen.getByRole("button", { name: "Sign in with Google" }),
    ).toBeEnabled();
    expect(screen.queryByText(WAITING_TEXT)).not.toBeInTheDocument();
  });
});
