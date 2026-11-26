import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DESKTOP_AUTH_REDIRECT_PATH } from "@/lib/desktop-platform";
import { STORAGE_KEY as TABS_STORAGE_KEY } from "@/lib/tab-context-internal";
import { isWebSignInReturn } from "@/lib/web-sign-in-return";

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
  Link: ({
    to,
    params,
    children,
    className,
  }: {
    to: string;
    params?: { passageId: string };
    children: ReactNode;
    className?: string;
  }) => (
    <a
      href={params ? to.replace("$passageId", params.passageId) : to}
      className={className}
    >
      {children}
    </a>
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
const DESKTOP_REDIRECT = new RegExp(
  `^${DESKTOP_AUTH_REDIRECT_PATH.replace(".", "\\.")}\\?signInAttempt=[\\w-]{16,64}$`,
);

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
  localStorage.clear();
  sessionStorage.clear();
});

describe("LoginPage signed in on the web", () => {
  it("shows Enter Berean, linked to the first open tab, instead of Sign in", () => {
    localStorage.setItem(
      TABS_STORAGE_KEY,
      JSON.stringify([{ id: "t1", passageId: "Romans-8", label: "Romans 8" }]),
    );
    render(<LoginPage isSignedIn />);

    const enter = screen.getByRole("link", { name: "Enter Berean" });
    expect(enter).toHaveAttribute("href", "/passage/Romans-8");
    // Same frosted style as Sign in with Google, with keyboard focus ring.
    expect(enter).toHaveClass(
      "rounded-md",
      "border-white/20",
      "bg-white/10",
      "backdrop-blur-sm",
      "focus-visible:ring-white/50",
    );
    expect(enter.querySelector("svg.lucide-arrow-right")).toHaveClass(
      "h-4",
      "w-4",
    );
    expect(
      screen.queryByRole("button", { name: /Sign in with Google/ }),
    ).not.toBeInTheDocument();
  });

  it("falls back to John 1 when no tabs are saved", () => {
    render(<LoginPage isSignedIn />);

    expect(screen.getByRole("link", { name: "Enter Berean" })).toHaveAttribute(
      "href",
      "/passage/John-1",
    );
  });

  it("shows only Loading… until auth is known", () => {
    render(<LoginPage isLoading isSignedIn />);

    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Enter Berean" })).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
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
    // Coming back from Google goes into the app, not the landing page.
    expect(isWebSignInReturn()).toBe(true);
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

const MAC_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const WINDOWS_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function stubUserAgent(userAgent: string) {
  vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(userAgent);
}

function downloadLink(): HTMLElement | null {
  return screen.queryByRole("link", { name: "Download for Mac" });
}

describe("LoginPage Download for Mac", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sits after Sign in with Google on a Mac, quieter, linking to /download", () => {
    stubUserAgent(MAC_UA);
    render(<LoginPage />);

    const signIn = screen.getByRole("button", { name: "Sign in with Google" });
    const download = downloadLink();
    expect(download).toHaveAttribute("href", "/download");
    expect(download).toHaveClass(
      "rounded-md",
      "border-white/15",
      "bg-transparent",
      "text-white/75",
      "hover:border-white/30",
      "hover:bg-white/10",
      "hover:text-white/90",
      "focus-visible:ring-white/50",
      "sm:flex-1",
    );
    expect(download).not.toHaveClass("border-white/20", "bg-white/10");
    expect(download?.querySelector("svg.lucide-download")).toHaveClass(
      "h-4",
      "w-4",
    );
    expect(signIn).toHaveClass("sm:flex-1");
    expect(
      signIn.compareDocumentPosition(download as HTMLElement) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    // Stacked full width below 640px, side by side from there up.
    expect(signIn.parentElement).toHaveClass(
      "w-full",
      "max-w-xs",
      "sm:max-w-lg",
      "flex",
      "flex-col",
      "gap-3",
      "sm:flex-row",
      "mt-12",
    );
  });

  it("sits after Enter Berean when signed in on a Mac", () => {
    stubUserAgent(MAC_UA);
    render(<LoginPage isSignedIn />);

    const enter = screen.getByRole("link", { name: "Enter Berean" });
    expect(enter).toHaveClass("sm:flex-1");
    expect(enter.nextElementSibling).toBe(downloadLink());
  });

  it("stays clickable while Signing in… shows", async () => {
    stubUserAgent(MAC_UA);
    mocks.signIn.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(
      screen.getByRole("button", { name: "Sign in with Google" }),
    );

    expect(screen.getByRole("button", { name: "Signing in…" })).toBeDisabled();
    expect(downloadLink()).toHaveAttribute("href", "/download");
    expect(downloadLink()).not.toHaveAttribute("aria-disabled");
  });

  it("shows with the connection trouble box too", () => {
    stubUserAgent(MAC_UA);
    render(<LoginPage authBootstrapStalled onRetryConnection={() => {}} />);

    expect(screen.getByText(/Having trouble connecting/)).toBeInTheDocument();
    expect(downloadLink()).toBeInTheDocument();
  });

  it("is absent off a Mac, and the single button keeps today's width", () => {
    stubUserAgent(WINDOWS_UA);
    render(<LoginPage />);

    expect(downloadLink()).toBeNull();
    const signIn = screen.getByRole("button", { name: "Sign in with Google" });
    expect(signIn).not.toHaveClass("sm:flex-1");
    expect(signIn.parentElement).toHaveClass("w-full", "max-w-xs", "mt-12");
    expect(signIn.parentElement).not.toHaveClass("sm:max-w-lg", "sm:flex-row");
  });

  it("is absent inside the Mac app", () => {
    stubUserAgent(MAC_UA);
    window.bereanDesktop = { isDesktop: true, platform: "darwin" };
    render(<LoginPage />);

    expect(downloadLink()).toBeNull();
    expect(screen.queryByText("Download for Mac")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Sign in with Google" }).parentElement,
    ).not.toHaveClass("sm:flex-row");
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
      redirectTo: expect.stringMatching(DESKTOP_REDIRECT) as unknown,
    });
    expect(await screen.findByText(WAITING_TEXT)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Sign in with Google|Signing in/ }),
    ).not.toBeInTheDocument();
    expect(isWebSignInReturn()).toBe(false);
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
    // Each attempt gets its own id, so only the newest tab's code is redeemed.
    const redirects = mocks.signIn.mock.calls.map(
      (call) => (call[1] as { redirectTo: string }).redirectTo,
    );
    expect(redirects[1]).toMatch(DESKTOP_REDIRECT);
    expect(redirects[1]).not.toBe(redirects[0]);
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
