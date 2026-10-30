import type { MemorySessionKind } from "./memory-session";

export type PracticeEndKind = "again" | "next" | "finish";

export const PRACTICE_AGAIN_LABEL = "Practice again";
export const PRACTICE_NEXT_VERSE_LABEL = "Practice the next verse";
export const FINISH_LABEL = "Finish";

export function practiceEndKind(args: {
  kind: MemorySessionKind;
  total: number;
  remainingAfter: number;
}): PracticeEndKind | null {
  if (args.kind !== "practice") return null;
  if (args.remainingAfter > 0) return "next";
  return args.total <= 1 ? "again" : "finish";
}

export function practiceEndLabel(kind: PracticeEndKind): string {
  switch (kind) {
    case "again":
      return PRACTICE_AGAIN_LABEL;
    case "next":
      return PRACTICE_NEXT_VERSE_LABEL;
    case "finish":
      return FINISH_LABEL;
  }
}
