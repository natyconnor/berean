const KEY = "berean:memory-return-focus";

/** Remember to focus a visible control after a Refresh sitting closes. */
export function markMemoryReturnFocus(): void {
  sessionStorage.setItem(KEY, "1");
}

/** True once after {@link markMemoryReturnFocus}, then cleared. */
export function takeMemoryReturnFocus(): boolean {
  if (sessionStorage.getItem(KEY) !== "1") return false;
  sessionStorage.removeItem(KEY);
  return true;
}
