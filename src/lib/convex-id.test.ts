import { describe, expect, it } from "vitest";

import { asTableId } from "./convex-id";

describe("asTableId", () => {
  it("rejects a junk route param that Convex would not accept", () => {
    expect(asTableId("xyz")).toBeNull();
    expect(asTableId("v1")).toBeNull();
    expect(asTableId("")).toBeNull();
  });

  it("keeps a document-shaped id", () => {
    expect(asTableId("j97xyz_9-Q")).toBe("j97xyz_9-Q");
    expect(asTableId("abcdefgh")).toBe("abcdefgh");
  });
});
