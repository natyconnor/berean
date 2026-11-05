import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  resetApplyLeftoverHeldAttemptsForTests,
  useLeftoverHeldAttemptsReady,
} from "./use-apply-leftover-held-attempts";

const { applyMock, auth } = vi.hoisted(() => ({
  applyMock: vi.fn(() => Promise.resolve({ applied: 0 })),
  auth: { isAuthenticated: true, isLoading: false },
}));

vi.mock("convex/react", () => ({
  useMutation: () => applyMock,
  useConvexAuth: () => auth,
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    verseMemory: {
      applyLeftoverHeldAttempts: "verseMemory.applyLeftoverHeldAttempts",
    },
  },
}));

describe("useLeftoverHeldAttemptsReady", () => {
  beforeEach(() => {
    resetApplyLeftoverHeldAttemptsForTests();
    applyMock.mockReset();
    applyMock.mockResolvedValue({ applied: 0 });
    auth.isAuthenticated = true;
    auth.isLoading = false;
  });

  it("stays unready until leftover apply settles, then is ready", async () => {
    let release: (value: { applied: number }) => void = () => {};
    applyMock.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );

    const { result } = renderHook(() => useLeftoverHeldAttemptsReady());
    expect(result.current).toBe(false);
    expect(applyMock).toHaveBeenCalledWith({});

    release({ applied: 1 });
    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });
});
