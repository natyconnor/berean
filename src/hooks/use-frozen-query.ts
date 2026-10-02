import { useState } from "react";
import { useQuery } from "convex-helpers/react/cache";
import type { OptionalRestArgsOrSkip } from "convex/react";
import type { FunctionReference, FunctionReturnType } from "convex/server";

/**
 * Subscribe until the first result, then skip.
 *
 * Convex `await mutation()` does not resolve until every subscribed query that
 * read a written document has re-run. Session pages snapshot their queue at
 * mount; keeping those queries live would make Saving... grow with library
 * size. After the first value, this unsubscribes.
 *
 * Pass a new `resetKey` (and distinct query args, e.g. `generation`) to
 * subscribe again — Review's "Keep reviewing" uses that to load the next
 * due-queue page without reusing a stale skipped result.
 */
export function useFrozenQuery<Query extends FunctionReference<"query">>(
  query: Query,
  args: OptionalRestArgsOrSkip<Query>[0],
  resetKey = 0,
): FunctionReturnType<Query> | undefined {
  const [frozen, setFrozen] = useState<{
    resetKey: number;
    value: FunctionReturnType<Query>;
  } | null>(null);

  const isFrozen = frozen !== null && frozen.resetKey === resetKey;
  const live = useQuery(
    query,
    args === "skip" || isFrozen ? ("skip" as const) : args,
  );

  if (!isFrozen && args !== "skip" && live !== undefined) {
    setFrozen({ resetKey, value: live });
  }

  if (args === "skip") return undefined;
  if (isFrozen) return frozen.value;
  return live;
}
