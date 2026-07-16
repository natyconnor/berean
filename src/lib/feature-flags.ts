/**
 * Compile-time feature flags for hiding in-progress surfaces.
 *
 * Set `VITE_FEATURE_STUDY=true` in `.env.local` to enable Study locally.
 */
export const FEATURE_FLAGS = {
  study:
    import.meta.env.VITE_FEATURE_STUDY === "true" ||
    import.meta.env.VITE_FEATURE_STUDY === "1",
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FEATURE_FLAGS[flag];
}
