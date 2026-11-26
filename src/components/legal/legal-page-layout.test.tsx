import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LegalPageLayout } from "@/components/legal/legal-page-layout";
import { STORAGE_KEY as TABS_STORAGE_KEY } from "@/lib/tab-context-internal";

const { authState, routerState, navigate } = vi.hoisted(() => ({
  authState: { isAuthenticated: false, isLoading: false },
  routerState: { canGoBack: false },
  navigate: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => authState,
}));

vi.mock("@tanstack/react-router", () => ({
  useCanGoBack: () => routerState.canGoBack,
  useNavigate: () => navigate,
}));

afterEach(() => {
  authState.isAuthenticated = false;
  routerState.canGoBack = false;
  navigate.mockReset();
  localStorage.clear();
});

function clickBack() {
  render(<LegalPageLayout>Policy</LegalPageLayout>);
  fireEvent.click(screen.getByRole("button", { name: "← Back" }));
}

describe("LegalPageLayout ← Back", () => {
  it("goes back through history when there is some", () => {
    authState.isAuthenticated = true;
    routerState.canGoBack = true;
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});

    clickBack();

    expect(back).toHaveBeenCalledOnce();
    expect(navigate).not.toHaveBeenCalled();
    back.mockRestore();
  });

  it("goes into the app at the first open tab when signed in with no history", () => {
    authState.isAuthenticated = true;
    localStorage.setItem(
      TABS_STORAGE_KEY,
      JSON.stringify([{ id: "t1", passageId: "Romans-8", label: "Romans 8" }]),
    );

    clickBack();

    expect(navigate).toHaveBeenCalledWith({
      to: "/passage/$passageId",
      params: { passageId: "Romans-8" },
    });
  });

  it("goes to the home page when signed out with no history", () => {
    clickBack();

    expect(navigate).toHaveBeenCalledWith({ to: "/" });
  });
});
