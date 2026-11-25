/**
 * Launch argument carrying the shell version to the preload, which is
 * sandboxed and cannot ask `app` for it.
 */
export const SHELL_VERSION_ARG = "--berean-shell-version";

/** Sent by the offline page's Retry button; main reloads the app URL. */
export const RETRY_LOAD_CHANNEL = "berean:retry-load";

/** Main → page: the update state changed. Page → main (invoke): read it. */
export const UPDATE_STATE_CHANNEL = "berean:update-state";
/** Page → main (invoke): run "Check for Updates…" and return what it found. */
export const UPDATE_CHECK_CHANNEL = "berean:update-check";
/** Page → main: quit and install the downloaded update. */
export const UPDATE_INSTALL_CHANNEL = "berean:update-install";

/** Page → main: whether this window has unsaved notes. */
export const UNSAVED_NOTES_CHANNEL = "berean:unsaved-notes";
/** Page → main (invoke): whether any window has unsaved notes. */
export const ANY_UNSAVED_NOTES_CHANNEL = "berean:any-unsaved-notes";
/**
 * Main → page: ask "Discard unsaved notes?" (with a request id). The page
 * answers on the same channel with the id and true for Discard.
 */
export const DISCARD_REQUEST_CHANNEL = "berean:discard-request";
