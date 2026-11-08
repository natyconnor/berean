import { describe, expect, it } from "vitest";

import type { Doc, Id } from "../../convex/_generated/dataModel";
import { passageReviewTries } from "../../convex/lib/passageMemory";

const PASSAGE = "passageMemory:1" as Id<"passageMemory">;
const OTHER = "passageMemory:2" as Id<"passageMemory">;

function log(
  kind: Doc<"passageReviews">["kind"],
  accuracy: number,
  createdAt: number,
  passageMemoryId = PASSAGE,
): Doc<"passageReviews"> {
  return {
    _id: `passageReviews:${createdAt}` as Id<"passageReviews">,
    _creationTime: createdAt,
    userId: "users:1" as Id<"users">,
    packId: "packs:1" as Id<"packs">,
    passageMemoryId,
    kind,
    quality: "close",
    accuracy,
    createdAt,
  };
}

describe("passageReviewTries", () => {
  it("R48: keeps only this passage's whole-passage reviews, newest first", () => {
    expect(
      passageReviewTries(
        [
          log("review", 40, 5),
          log("rope", 10, 4),
          log("review", 30, 3, OTHER),
          log("frontier", 20, 2),
          log("review", 90, 1),
        ],
        PASSAGE,
      ),
    ).toEqual([
      { accuracy: 40, createdAt: 5 },
      { accuracy: 90, createdAt: 1 },
    ]);
  });
});
