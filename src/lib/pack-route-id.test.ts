import { describe, expect, it } from "vitest";

import { get, resolveMembers, touch } from "../../convex/packs";
import { getForPack } from "../../convex/passageMemory";

const JUNK_PACK_ID = "abcdefgh";

type RegisteredFn<A> = {
  exportArgs: () => string;
  _handler: (ctx: unknown, args: A) => Promise<unknown>;
};

function registered<A>(fn: object): RegisteredFn<A> {
  return fn as RegisteredFn<A>;
}

function packIdFieldType(
  exportArgs: () => string,
  field: "id" | "packId",
): string {
  const args = JSON.parse(exportArgs()) as {
    value: Record<string, { fieldType: { type: string } }>;
  };
  return args.value[field].fieldType.type;
}

function ctxThatRejectsPackIds() {
  return {
    auth: {
      getUserIdentity: () => Promise.resolve({ subject: "user123|session" }),
    },
    db: {
      normalizeId: (table: string, id: string) => {
        expect(table).toBe("packs");
        expect(id).toBe(JUNK_PACK_ID);
        return null;
      },
      get: () => {
        throw new Error("db.get should not run for an unnormalized pack id");
      },
      patch: () => {
        throw new Error("db.patch should not run for an unnormalized pack id");
      },
    },
  };
}

describe("pack route ids", () => {
  const getFn = registered<{ id: string }>(get);
  const membersFn = registered<{ id: string; now: number }>(resolveMembers);
  const touchFn = registered<{ id: string }>(touch);
  const passageFn = registered<{
    packId: string;
    now: number;
    tzOffsetMinutes: number;
  }>(getForPack);

  it("accepts a well-formed junk pack id as a string, not a Convex id", () => {
    expect(packIdFieldType(getFn.exportArgs, "id")).toBe("string");
    expect(packIdFieldType(membersFn.exportArgs, "id")).toBe("string");
    expect(packIdFieldType(touchFn.exportArgs, "id")).toBe("string");
    expect(packIdFieldType(passageFn.exportArgs, "packId")).toBe("string");
  });

  it("returns not-found for a well-formed junk pack id without throwing", async () => {
    const ctx = ctxThatRejectsPackIds();
    await expect(getFn._handler(ctx, { id: JUNK_PACK_ID })).resolves.toBeNull();
    await expect(
      membersFn._handler(ctx, { id: JUNK_PACK_ID, now: 0 }),
    ).resolves.toEqual([]);
    await expect(
      passageFn._handler(ctx, {
        packId: JUNK_PACK_ID,
        now: 0,
        tzOffsetMinutes: 0,
      }),
    ).resolves.toBeNull();
    await expect(
      touchFn._handler(ctx, { id: JUNK_PACK_ID }),
    ).resolves.toBeNull();
  });
});
