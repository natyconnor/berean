export type AppVersionInfo = {
  appVersion: string;
  buildId: string;
};

const STALE_CLIENT_ERROR_PATTERNS = [
  /ChunkLoadError/i,
  /Loading CSS chunk \d+ failed/i,
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
];

export function isValidAppVersionInfo(
  candidate: unknown,
): candidate is AppVersionInfo {
  if (!candidate || typeof candidate !== "object") return false;

  const { appVersion, buildId } = candidate as Partial<AppVersionInfo>;
  return (
    typeof appVersion === "string" &&
    appVersion.length > 0 &&
    typeof buildId === "string" &&
    buildId.length > 0
  );
}

export function hasDetectedNewBuild(
  currentBuildId: string,
  latestBuildId: string | null | undefined,
): boolean {
  return (
    typeof latestBuildId === "string" &&
    latestBuildId.length > 0 &&
    latestBuildId !== currentBuildId
  );
}

function collectErrorMessages(
  value: unknown,
  visited: Set<unknown>,
  messages: string[],
): void {
  if (value == null || visited.has(value)) return;
  visited.add(value);

  if (typeof value === "string") {
    messages.push(value);
    return;
  }

  if (value instanceof Error) {
    messages.push(value.message);
    collectErrorMessages(value.cause, visited, messages);
    return;
  }

  if (typeof value === "object") {
    for (const nestedValue of Object.values(value)) {
      collectErrorMessages(nestedValue, visited, messages);
    }
  }
}

export function isStaleClientError(error: unknown): boolean {
  const messages: string[] = [];
  collectErrorMessages(error, new Set<unknown>(), messages);

  return messages.some((message) =>
    STALE_CLIENT_ERROR_PATTERNS.some((pattern) => pattern.test(message)),
  );
}
