function isApplePlatform() {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}

export function formatCommandOrControlShortcut(key: string) {
  return isApplePlatform() ? `\u2318${key}` : `Ctrl+${key}`;
}
