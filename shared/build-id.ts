type BuildIdEnv = Record<string, string | undefined>;

// Empty or blank values count as missing: a prebuilt Vercel build can set
// VERCEL_DEPLOYMENT_ID to "" (#456), which would otherwise win.
export function chooseBuildId(env: BuildIdEnv, appVersion: string): string {
  const ids = [
    env.VERCEL_DEPLOYMENT_ID,
    env.VERCEL_GIT_COMMIT_SHA,
    env.GITHUB_SHA,
  ];
  return ids.find((id) => id?.trim()) ?? `dev-${appVersion}`;
}
