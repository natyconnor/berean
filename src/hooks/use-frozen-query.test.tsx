import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useFrozenQuery } from "./use-frozen-query";

const { useQueryMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
}));

vi.mock("convex-helpers/react/cache", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args) as unknown,
}));

const QUERY = "savedVerses.listAll" as never;

describe("useFrozenQuery", () => {
  beforeEach(() => {
    useQueryMock.mockReset();
  });

  it("skips after the first result and ignores later live values", () => {
    const live = { current: ["first"] as string[] | undefined };
    useQueryMock.mockImplementation((_query: unknown, args: unknown) =>
      args === "skip" ? undefined : live.current,
    );

    const { result, rerender } = renderHook(
      ({ resetKey }: { resetKey: number }) =>
        useFrozenQuery(QUERY, { now: 1 } as never, resetKey),
      { initialProps: { resetKey: 0 } },
    );

    expect(result.current).toEqual(["first"]);
    expect(useQueryMock).toHaveBeenLastCalledWith(QUERY, "skip");

    live.current = ["stale-update"];
    rerender({ resetKey: 0 });
    expect(result.current).toEqual(["first"]);
    expect(useQueryMock).toHaveBeenLastCalledWith(QUERY, "skip");
  });

  it("re-subscribes when resetKey changes", () => {
    const liveByGeneration = new Map<number, string[]>([
      [0, ["page-one"]],
      [1, ["page-two"]],
    ]);
    useQueryMock.mockImplementation((_query: unknown, args: unknown) => {
      if (args === "skip") return undefined;
      const generation = (args as { generation: number }).generation;
      return liveByGeneration.get(generation);
    });

    const { result, rerender } = renderHook(
      ({ resetKey }: { resetKey: number }) =>
        useFrozenQuery(
          QUERY,
          { now: 1, generation: resetKey } as never,
          resetKey,
        ),
      { initialProps: { resetKey: 0 } },
    );

    expect(result.current).toEqual(["page-one"]);

    rerender({ resetKey: 1 });
    expect(result.current).toEqual(["page-two"]);
    expect(useQueryMock).toHaveBeenLastCalledWith(QUERY, "skip");
  });

  it("does not subscribe when args are skip", () => {
    useQueryMock.mockReturnValue(["should-not-use"]);

    const { result } = renderHook(() => useFrozenQuery(QUERY, "skip"));

    expect(result.current).toBeUndefined();
    expect(useQueryMock).toHaveBeenCalledWith(QUERY, "skip");
  });
});
