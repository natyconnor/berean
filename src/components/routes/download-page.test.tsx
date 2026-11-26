import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEY as TABS_STORAGE_KEY } from "@/lib/tab-context-internal";
import { DownloadPage } from "./download-page";

const mocks = vi.hoisted(() => ({
  auth: { isAuthenticated: false, isLoading: false },
  navigate: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => mocks.auth,
}));

vi.mock("@tanstack/react-router", () => ({
  useCanGoBack: () => false,
  useNavigate: () => mocks.navigate,
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

const MAC_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const WINDOWS_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const DMG_URL =
  "https://github.com/natyconnor/berean-desktop/releases/latest/download/Berean.dmg";
const DESCRIPTION = "All of Berean, in its own app on your Mac.";
const NOT_A_MAC_NOTE =
  "Berean for Mac needs a Mac. You can keep using Berean in your browser.";

function stubUserAgent(userAgent: string) {
  vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(userAgent);
}

function downloadLink() {
  return screen.queryByRole("link", { name: "Download" });
}

beforeEach(() => {
  mocks.auth = { isAuthenticated: false, isLoading: false };
  mocks.navigate.mockReset();
});

describe("DownloadPage ← Back with no history", () => {
  it("goes into the app when signed in, home when signed out", () => {
    const signedOut = render(<DownloadPage />);
    fireEvent.click(screen.getByRole("button", { name: "← Back" }));
    expect(mocks.navigate).toHaveBeenLastCalledWith({ to: "/" });
    signedOut.unmount();

    mocks.auth = { isAuthenticated: true, isLoading: false };
    render(<DownloadPage />);
    fireEvent.click(screen.getByRole("button", { name: "← Back" }));
    expect(mocks.navigate).toHaveBeenLastCalledWith({
      to: "/passage/$passageId",
      params: { passageId: "John-1" },
    });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  delete window.bereanDesktop;
  localStorage.clear();
});

describe("DownloadPage on a Mac in the browser", () => {
  it("offers the .dmg as a plain link, then the first-run steps", () => {
    stubUserAgent(MAC_UA);
    render(<DownloadPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Berean for Mac" }),
    ).toHaveClass("mb-3", "text-3xl", "font-semibold", "tracking-tight");
    expect(screen.getByText(DESCRIPTION)).toBeInTheDocument();

    const download = downloadLink();
    expect(download).toHaveAttribute("href", DMG_URL);
    expect(download).not.toHaveAttribute("target");
    expect(download).not.toHaveAttribute("download");
    expect(download).toHaveAttribute("data-variant", "default");
    expect(download).toHaveAttribute("data-size", "lg");
    expect(download).toHaveClass("mt-6");
    expect(download?.querySelector("svg.lucide-download")).not.toBeNull();

    expect(
      screen.getByRole("heading", { level: 2, name: "After it downloads" }),
    ).toBeInTheDocument();
    const steps = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(steps).toEqual([
      "Open Berean.dmg.",
      "Drag Berean into Applications.",
      "Open Berean and sign in with Google. When your browser asks, allow it to open Berean.",
    ]);
    expect(screen.queryByText(NOT_A_MAC_NOTE)).toBeNull();
    expect(screen.getByText(DESCRIPTION).parentElement).toHaveClass("max-w-xl");
  });
});

describe("DownloadPage off a Mac", () => {
  beforeEach(() => {
    stubUserAgent(WINDOWS_UA);
  });

  it("hides Download and the steps, and shows the note", () => {
    render(<DownloadPage />);

    expect(screen.getByText(DESCRIPTION)).toBeInTheDocument();
    expect(downloadLink()).toBeNull();
    expect(screen.queryByText("After it downloads")).toBeNull();
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.getByText(NOT_A_MAC_NOTE)).toHaveClass(
      "mt-6",
      "rounded-lg",
      "border",
      "bg-muted/40",
      "p-4",
    );
  });

  it("opens the app when signed in", () => {
    localStorage.setItem(
      TABS_STORAGE_KEY,
      JSON.stringify([{ id: "t1", passageId: "Romans-8", label: "Romans 8" }]),
    );
    mocks.auth = { isAuthenticated: true, isLoading: false };
    render(<DownloadPage />);

    const open = screen.getByRole("link", { name: "Open Berean" });
    expect(open).toHaveAttribute("href", "/passage/Romans-8");
    expect(open).toHaveClass("mt-4", "bg-primary");
    expect(open.querySelector("svg")).toBeNull();
  });

  it("opens the home page when signed out", () => {
    render(<DownloadPage />);

    expect(screen.getByRole("link", { name: "Open Berean" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("points at the home page while auth is loading", () => {
    mocks.auth = { isAuthenticated: false, isLoading: true };
    render(<DownloadPage />);

    expect(screen.getByRole("link", { name: "Open Berean" })).toHaveAttribute(
      "href",
      "/",
    );
  });
});

describe("DownloadPage in the Mac app", () => {
  beforeEach(() => {
    stubUserAgent(MAC_UA);
  });

  it("shows the version and Check for updates on shell 1.0.2+", () => {
    window.bereanDesktop = {
      isDesktop: true,
      platform: "darwin",
      shellVersion: "1.0.2",
    };
    render(<DownloadPage />);

    expect(screen.getByText("You’re already using it.")).toBeInTheDocument();
    expect(screen.getByText("Version 1.0.2")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Check for updates" }),
    ).toBeInTheDocument();
    expect(downloadLink()).toBeNull();
    expect(screen.queryByText(DESCRIPTION)).toBeNull();
    expect(screen.queryByText("After it downloads")).toBeNull();
  });

  it("shows only the already-using title on shells before 1.0.2", () => {
    window.bereanDesktop = { isDesktop: true, platform: "darwin" };
    render(<DownloadPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Berean for Mac" }),
    ).toBeInTheDocument();
    expect(screen.getByText("You’re already using it.")).toBeInTheDocument();
    expect(screen.queryByText(/^Version/)).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Check for updates" }),
    ).toBeNull();
    expect(downloadLink()).toBeNull();
  });
});
