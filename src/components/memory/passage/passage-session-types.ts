import type { FunctionReturnType } from "convex/server";

import { api } from "../../../../convex/_generated/api";

export type PassageView = NonNullable<
  FunctionReturnType<typeof api.passageMemory.getForPack>
>;
