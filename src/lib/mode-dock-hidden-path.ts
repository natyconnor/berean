/**
 * Routes where the Mode Dock should not render (and its shortcuts should not
 * fire). Settings is inside AppShell; public legal pages are usually outside
 * it, but the same guard covers them if they are ever mounted under the shell.
 */
const MODE_DOCK_HIDDEN_PATH_PREFIXES = [
  "/settings",
  "/privacy",
  "/terms",
  "/license",
] as const;

export function shouldHideModeDock(pathname: string): boolean {
  return MODE_DOCK_HIDDEN_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
