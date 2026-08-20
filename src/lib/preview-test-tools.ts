/**
 * UI-only helpers for Vercel preview and local `pnpm dev`.
 * Production builds compile `__IS_PREVIEW__` and `import.meta.env.DEV` to false.
 */
export function isPreviewTestToolsEnabled(): boolean {
  return Boolean(__IS_PREVIEW__) || import.meta.env.DEV;
}
