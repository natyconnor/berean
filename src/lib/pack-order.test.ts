import { describe, expect, it } from "vitest";

import {
  dropTargetIndex,
  moveItem,
  orderByKeys,
  planPackReorder,
  planRestoreAt,
} from "./pack-order";

function rows(...ids: string[]) {
  return ids.map((id) => ({ verseRefId: id, inMemory: !id.startsWith("x") }));
}

describe("moveItem", () => {
  it("moves up and down", () => {
    expect(moveItem(["a", "b", "c"], 2, 1)).toEqual(["a", "c", "b"]);
    expect(moveItem(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
  });

  it("leaves out-of-range moves alone", () => {
    expect(moveItem(["a", "b"], 0, -1)).toEqual(["a", "b"]);
    expect(moveItem(["a", "b"], 1, 2)).toEqual(["a", "b"]);
  });
});

describe("dropTargetIndex", () => {
  it("maps a drop gap to the moved index", () => {
    expect(dropTargetIndex(0, 3)).toBe(2);
    expect(dropTargetIndex(2, 0)).toBe(0);
    expect(dropTargetIndex(1, 1)).toBeNull();
    expect(dropTargetIndex(1, 2)).toBeNull();
  });
});

describe("orderByKeys", () => {
  const key = (item: { id: string }) => item.id;
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }];

  it("follows the keys and keeps unlisted items after them", () => {
    expect(orderByKeys(items, ["c", "a"], key).map(key)).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  it("skips unknown and repeated keys", () => {
    expect(orderByKeys(items, ["z", "b", "b"], key).map(key)).toEqual([
      "b",
      "a",
      "c",
    ]);
    expect(orderByKeys(items, null, key).map(key)).toEqual(["a", "b", "c"]);
  });
});

describe("planPackReorder", () => {
  it("accepts a permutation of every row", () => {
    expect(planPackReorder(rows("a", "b", "c"), ["c", "a", "b"])).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  it("keeps hidden rows in their slots when only shown rows are listed", () => {
    expect(planPackReorder(rows("a", "x1", "b", "c"), ["c", "a", "b"])).toEqual(
      ["c", "x1", "a", "b"],
    );
  });

  it("accepts every row, hidden ones included", () => {
    expect(planPackReorder(rows("a", "x1", "b"), ["x1", "b", "a"])).toEqual([
      "x1",
      "b",
      "a",
    ]);
  });

  it("rejects lists that are not a permutation", () => {
    expect(planPackReorder(rows("a", "b", "c"), ["a", "b"])).toBeNull();
    expect(planPackReorder(rows("a", "b"), ["a", "b", "c"])).toBeNull();
    expect(planPackReorder(rows("a", "b"), ["a", "a"])).toBeNull();
    expect(planPackReorder(rows("a", "b"), ["a", "z"])).toBeNull();
    expect(planPackReorder(rows("a", "x1", "b"), ["a", "x1"])).toBeNull();
  });

  it("accepts an empty pack", () => {
    expect(planPackReorder(rows(), [])).toEqual([]);
  });
});

describe("planRestoreAt", () => {
  const at = (...orders: Array<[string, number]>) =>
    orders.map(([id, order]) => ({ id, order }));

  function restore(
    current: Array<{ id: string; order: number }>,
    id: string,
    order: number,
  ) {
    const plan = planRestoreAt(current, order);
    const shifted = new Set(plan.shift.map((row) => row.id));
    return [
      ...current.map((row) =>
        shifted.has(row.id) ? { ...row, order: row.order + 1 } : row,
      ),
      { id, order: plan.order },
    ]
      .sort((a, b) => a.order - b.order)
      .map((row) => row.id);
  }

  it("puts a removed verse back in its free slot without moving others", () => {
    const remaining = at(["a", 0], ["c", 2]);
    expect(planRestoreAt(remaining, 1)).toEqual({ order: 1, shift: [] });
    expect(restore(remaining, "b", 1)).toEqual(["a", "b", "c"]);
  });

  it("shifts later rows down when the slot was taken by a reorder", () => {
    const reordered = at(["c", 0], ["a", 1]);
    expect(planRestoreAt(reordered, 1).shift.map((row) => row.id)).toEqual([
      "a",
    ]);
    expect(restore(reordered, "b", 1)).toEqual(["c", "b", "a"]);
  });

  it("clamps junk orders", () => {
    expect(planRestoreAt(at(["a", 0]), -3)).toEqual({
      order: 0,
      shift: [{ id: "a", order: 0 }],
    });
    expect(planRestoreAt(at(), 2.7).order).toBe(2);
  });
});
