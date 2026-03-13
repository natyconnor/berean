export interface SearchWorkspaceStoredParams {
  q?: string;
  tags?: string;
  mode?: "any" | "all";
  noteId?: string;
}

export interface SearchWorkspaceStoredState {
  params: SearchWorkspaceStoredParams;
  scrollTop: number;
}

const SEARCH_WORKSPACE_STORAGE_KEY = "search_workspace_state_v1";

const DEFAULT_STATE: SearchWorkspaceStoredState = {
  params: {},
  scrollTop: 0,
};

function hasWindow(): boolean {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

function normalizeParams(raw: unknown): SearchWorkspaceStoredParams {
  if (!raw || typeof raw !== "object") return {};
  const value = raw as Record<string, unknown>;

  const q =
    typeof value.q === "string" && value.q.trim().length > 0
      ? value.q
      : undefined;
  const tags =
    typeof value.tags === "string" && value.tags.trim().length > 0
      ? value.tags
      : undefined;
  const mode =
    value.mode === "all" ? "all" : value.mode === "any" ? "any" : undefined;
  const noteId =
    typeof value.noteId === "string" && value.noteId.trim().length > 0
      ? value.noteId
      : undefined;

  return { q, tags, mode, noteId };
}

function normalizeState(raw: unknown): SearchWorkspaceStoredState {
  if (!raw || typeof raw !== "object") return DEFAULT_STATE;
  const value = raw as Record<string, unknown>;
  const scrollTop =
    typeof value.scrollTop === "number" &&
    Number.isFinite(value.scrollTop) &&
    value.scrollTop > 0
      ? value.scrollTop
      : 0;
  return {
    params: normalizeParams(value.params),
    scrollTop,
  };
}

export function readSearchWorkspaceState(): SearchWorkspaceStoredState {
  if (!hasWindow()) return DEFAULT_STATE;
  try {
    const saved = window.localStorage.getItem(SEARCH_WORKSPACE_STORAGE_KEY);
    if (!saved) return DEFAULT_STATE;
    return normalizeState(JSON.parse(saved));
  } catch {
    return DEFAULT_STATE;
  }
}

export function writeSearchWorkspaceParams(
  params: SearchWorkspaceStoredParams,
) {
  if (!hasWindow()) return;
  const existing = readSearchWorkspaceState();
  const next: SearchWorkspaceStoredState = {
    ...existing,
    params: normalizeParams(params),
  };
  try {
    window.localStorage.setItem(
      SEARCH_WORKSPACE_STORAGE_KEY,
      JSON.stringify(next),
    );
  } catch {
    // ignore localStorage write failures
  }
}

export function writeSearchWorkspaceScroll(scrollTop: number) {
  if (!hasWindow()) return;
  const existing = readSearchWorkspaceState();
  const next: SearchWorkspaceStoredState = {
    ...existing,
    scrollTop: Number.isFinite(scrollTop) && scrollTop > 0 ? scrollTop : 0,
  };
  try {
    window.localStorage.setItem(
      SEARCH_WORKSPACE_STORAGE_KEY,
      JSON.stringify(next),
    );
  } catch {
    // ignore localStorage write failures
  }
}
