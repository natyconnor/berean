# Berean desktop shell

A thin Electron shell around the live web app. It opens a native window on
`https://berean.nathanconnor.dev` and does not bundle the Vite build, so every
web deploy reaches desktop users without a new desktop release.

The full plan is `docs/proposals/desktop-ipad-implementation-plan.html`.
Mac only for now.

## Running it

All commands run from the repository root.

```bash
pnpm run desktop:dev    # build main + preload, start Electron
pnpm run desktop:pack   # build an unsigned Berean.app
pnpm run desktop:check  # typecheck + lint electron/
pnpm run desktop:dist   # signed release build (see Releasing)
```

The first run installs this package's dependencies and downloads the Electron
binary. To install them without running anything: `pnpm --dir electron install`.

`desktop:pack` writes `electron/release/mac-arm64/Berean.app` (`mac-x64` on an
Intel Mac). It is deliberately unsigned, even if a signing certificate is in the
keychain. Open it with:

```bash
open electron/release/mac-arm64/Berean.app
```

### Pointing the shell at another origin

By default the shell loads production. Set `BEREAN_DESKTOP_URL` to load another
origin, for example the local dev server:

```bash
pnpm dev                                                    # terminal 1
BEREAN_DESKTOP_URL=http://localhost:5173 pnpm run desktop:dev   # terminal 2
```

Only the origin is used; any path is ignored. A value that is not an `http(s)`
URL is ignored with a warning. The override also works for the packed app, but
`open` does not pass your shell's environment along, so start the binary
directly:

```bash
BEREAN_DESKTOP_URL=http://localhost:5173 \
  electron/release/mac-arm64/Berean.app/Contents/MacOS/Berean
```

`desktop:dev` keeps its data in `~/Library/Application Support/Berean Dev`, so
it can run next to an installed or packed Berean
(`~/Library/Application Support/Berean`).

## How it is wired into the repo

`electron/` is a **standalone package**, not a pnpm workspace member. It has
its own `package.json`, version, `pnpm-lock.yaml` and `pnpm-workspace.yaml`.

- The web app's install (local, CI, Vercel) never pulls in Electron or
  electron-builder, and the web lockfile stays free of their dependency tree.
- The desktop version (`electron/package.json`) is independent of the web
  app's version. release-please manages both, as two packages (see
  [Releasing](#releasing)).
- Dependabot has a separate entry for `/electron`. Electron major updates are
  not ignored there, because only the newest few major lines get security
  fixes. Its commits are `fix(deps-dev): …`, so each merged update releases
  the shell.

The root `desktop:*` scripts are thin wrappers that delegate here.

`main.ts` and `preload.ts` are bundled by esbuild into `dist/main.js` and
`dist/preload.js`. Bundling means:

- the packed app ships no `node_modules` (it contains `dist/`, `offline.html`
  and `package.json` only), which sidesteps electron-builder's trouble with
  pnpm's symlinked layout;
- `main.ts` can import the shared helpers in `../shared/` directly, so the
  production origin (`CANONICAL_ORIGIN`) has one source of truth.

esbuild does not typecheck. `tsc` does, through `electron/tsconfig.json`, as
part of `desktop:pack` and `desktop:check`.

### Checks

The root ESLint config ignores `electron/`, and the root `tsc -b` does not
reference it, because its types exist only after this package's own install.
Web CI is therefore unaffected by this folder (Prettier still formats it).

`pnpm run desktop:check` typechecks and lints the shell. It is part of
`pnpm run agent:check`, and is skipped with a message when
`electron/node_modules` is absent.

## What the shell does

| File                           | Role                                                         |
| ------------------------------ | ------------------------------------------------------------ |
| `main.ts`                      | Windows, menu, navigation guard, offline, sign-in hand-back  |
| `preload.ts`                   | Exposes `window.bereanDesktop` (platform, version, updates)  |
| `offline.html`                 | Local "needs an internet connection" page with Retry         |
| `ipc-channels.ts`              | IPC channel names shared by main and preload                 |
| `shell-policy.ts`              | Pure checks used by main (sign-in, origins, frames, quit)    |
| `updater.ts`                   | Self-update from the GitHub releases, Check for Updates…     |
| `update-flow.ts`               | Pure update state and Check for Updates… messages            |
| `electron-builder.yml`         | Packaging: app id, `berean://` scheme, icon, dmg/zip targets |
| `electron-builder.release.yml` | Release builds: the above plus the update feed               |
| `entitlements.mac.plist`       | Hardened-runtime entitlements (JIT only)                     |

- **One session.** Every window uses the `persist:berean` partition, so File →
  New Window is already signed in and the session survives relaunch.
- **Navigation guard.** A window only ever renders the app origin or
  `offline.html`. Any other navigation, redirect or `window.open` is cancelled
  and, if it is an `http(s)` URL, opened in the system browser. The guard is
  attached to every `WebContents` the app creates. Frames inside the page may
  only load the app origin (or `about:blank`); any other navigation or
  redirect in a frame is cancelled.
- **Offline.** If the app URL fails to load, or redirects off the app origin
  before any app page has shown, the window shows `offline.html`. Retry (or
  View → Reload, or the network coming back) asks main to load the app URL
  again.
- **Menu.** File → New Window is Cmd+N. Berean → Check for Updates… checks
  the release feed. The web app owns Cmd+K, Cmd+G, Cmd+,, Cmd+J and
  Cmd+Enter; do not bind those in the menu.
- **Self-update.** See [Updates](#updates).
- **Security defaults.** `contextIsolation: true`, `nodeIntegration: false`,
  `sandbox: true`, no `<webview>`. Every permission request and check
  (notifications, geolocation, clipboard read, camera, …) is denied: the web
  app uses none.

The `berean://` scheme is declared in `electron-builder.yml`. macOS only
honours a custom scheme for a packaged app, so anything involving `berean://`
links has to be tested with `desktop:pack`, not `desktop:dev`.

## Releasing

A desktop release is a signed, notarized, universal (Apple silicon and Intel)
`Berean.dmg`, published with a zip and `latest-mac.yml` as a release of the
public repo [natyconnor/berean-desktop](https://github.com/natyconnor/berean-desktop).
The download link never changes:

<https://github.com/natyconnor/berean-desktop/releases/latest/download/Berean.dmg>

The desktop version is `version` in `electron/package.json`, independent of
the web app's version. Most web changes need no desktop release at all: the
shell loads the live site.

### When a release happens

release-please manages `electron/` with its own config and manifest
(`electron/release-please-config.json` and
`electron/.release-please-manifest.json`, component `desktop`, tags
`desktop-v<version>`, labels `autorelease: desktop-pending` /
`autorelease: desktop-tagged`), separate from the web app's config and manifest
at the repository root:

- A `feat:` or `fix:` commit that changes a file under `electron/` opens (or
  updates) a **desktop release PR**, "chore(main): release desktop N". It
  bumps `electron/package.json` and writes `electron/CHANGELOG.md`. Breaking
  changes bump the major, `feat` the minor, `fix` the patch. `chore:`,
  `docs:`, `refactor:` and so on do not release.
- Merging that PR makes the GitHub release `desktop-v<version>` in this repo
  and then runs the `Desktop release` workflow, which builds and publishes the
  app to `berean-desktop`. There is nothing to run by hand.
- The web app ignores commits that only touch `electron/`, and the desktop app
  ignores commits that never touch it. A commit that touches both counts for
  both. Because the two release PRs touch disjoint manifest files and use
  distinct labels, merging one never conflicts with or blocks the other.

**Files bundled from outside `electron/` are not tracked.** esbuild bundles
`shared/desktop-deep-link.ts`, `shared/http-routes.ts`,
`shared/passage-path.ts`, `src/lib/bible-books.ts` and
`src/lib/bible-verse-counts.ts` into the shell, but release-please only
assigns a commit to the desktop package when it changes something under
`electron/`. The usual case is a new route in `http-routes.ts`: installed apps
ignore a `berean://` link to it until the next desktop release, which picks
the change up. When that cannot wait, add a `fix:` commit under `electron/`
(for example a line in this README) to cut a release.

### Secrets

The `Desktop release` workflow (`.github/workflows/desktop-release.yml`) reads
these repository secrets on `natyconnor/berean`:

| Secret                   | What it is                                                        |
| ------------------------ | ----------------------------------------------------------------- |
| `CSC_LINK`               | The Developer ID Application certificate, `.p12`, base64-encoded  |
| `CSC_KEY_PASSWORD`       | The password of that `.p12`                                       |
| `APPLE_API_KEY`          | The **contents** of the App Store Connect API key (`.p8`)         |
| `APPLE_API_KEY_ID`       | That key's ID                                                     |
| `APPLE_API_ISSUER`       | Its issuer ID                                                     |
| `DESKTOP_RELEASES_TOKEN` | Fine-grained token for `berean-desktop`, Contents: read and write |

electron-builder 26 signs with `CSC_LINK` / `CSC_KEY_PASSWORD` and notarizes
with `APPLE_API_KEY`, `APPLE_API_KEY_ID` and `APPLE_API_ISSUER`, where
`APPLE_API_KEY` must be a **path** to the `.p8` file. The workflow therefore
writes the secret to a temporary file and passes that path, then deletes it.

Without all six secrets, a run started by hand still builds an unsigned
`Berean.dmg`, uploads it as a workflow artifact (kept 14 days) and publishes
nothing. A run started by a desktop release PR fails instead, so a release
never ends up unpublished behind a green check.

### Making a release

1. Merge the desktop release PR that release-please keeps open. Do not edit
   `version` in `electron/package.json` by hand; release-please owns it.
2. `Release Please` makes release `desktop-v<version>` here, then its
   `desktop-release` job calls the `Desktop release` workflow, which:
   - stops at once if `berean-desktop` already has release `v<version>`;
   - builds with `pnpm run dist` (`electron-builder.release.yml`), signing
     and notarizing the app;
   - refuses to publish unless the app has a Developer ID signature with the
     hardened runtime, a stapled notarization ticket, passes Gatekeeper
     (`spctl`) and is universal (electron-builder skips signing silently if
     it cannot use the certificate);
   - creates release `v<version>` on `berean-desktop`, marked latest, with
     `Berean.dmg`, `Berean-<version>-universal-mac.zip`, their `.blockmap`
     files and `latest-mac.yml`.

If the build fails (notarization timing out, say), retry it with **Re-run
failed jobs** on that `Release Please` run, or **Actions → Desktop release →
Run workflow** on `main`. Both build the version on `main`, which is not on
`berean-desktop` yet. **Re-run all jobs** does nothing useful: release-please
has already made the release, so it reports none and skips the build.

Signed releases are built from `main` only.

Locally, `pnpm run desktop:dist` builds the same thing; it signs with a
Developer ID certificate from your keychain, and notarizes only if the three
`APPLE_API_*` variables are set. `pnpm --dir electron run dist:unsigned`
builds the universal dmg and zip without signing (and without an update feed).
Outputs land in `electron/release/`.

## Updates

Only the shell updates itself; the web app updates with each web deploy.
`updater.ts` uses electron-updater with the GitHub releases of
`berean-desktop` as its feed (`publish` in `electron-builder.release.yml`,
built into the app as `app-update.yml`).

- It runs only in a packaged app built with a feed: signed release builds.
  `pack` and `dist:unsigned` builds carry no feed, because macOS refuses to
  install an update into an unsigned app. Their Check for Updates… says the
  copy does not update itself.
- It checks 10 seconds after launch and every 4 hours, downloads in the
  background, and installs on quit.
- When a download is ready no window opens. The page shows an arrow with a
  dot in its top bar, before Settings; its **Restart to update** quits and
  installs (after **Discard unsaved notes?** if any window has a draft).
  Ignored, the update installs on the next quit.
- It never blocks startup and never shows an error on its own. No network or
  no feed is logged (`[berean] Update failed: …`) and tried again later.
- **Berean → Check for Updates…** reports the result in a window: up to
  date, downloading version N, ready (use the arrow), or that it could not
  check. Settings → Berean for Mac runs the same check and shows the result
  in the page.
- Quit (Cmd+Q, menu or Dock) asks **Discard unsaved notes?** when any window
  has an unsaved note. Closing the last window never asks and never quits.
- Bridge methods added after 1.0.1 (`shellVersion`, `subscribeToUpdates`,
  …) are optional in `src/lib/desktop-platform.ts`: the web app checks for
  each one, because older shells keep running the latest web app.

### Testing an update

Needs two signed releases, so do it once the workflow has published one.

1. Install version N: download `Berean.dmg` from the latest release, drag
   Berean to Applications, open it (no Gatekeeper warning expected) and sign
   in.
2. Merge a `fix:` commit under `electron/`, then the desktop release PR for
   N+1 that it opens, and wait for the `desktop-release` job to finish.
3. In the running app choose **Berean → Check for Updates…**: it says it is
   downloading N+1. When the download finishes, an arrow with a dot appears
   before Settings. (Or wait: the app checks 10 seconds after launch and
   every 4 hours.)
4. Click the arrow, then **Restart to update**. Berean quits, comes back, and
   **Berean → About Berean** shows N+1. You are still signed in.
5. Repeat with **Not now**, then quit Berean (Cmd+Q) and reopen it: it is on
   the new version.

Run `Berean.app/Contents/MacOS/Berean` from a terminal to see the updater's
log lines.

## Links to app routes

`berean://` followed by an app path opens that route in the app:

| Link                                   | Opens                          |
| -------------------------------------- | ------------------------------ |
| `berean://passage/John-1`              | `/passage/John-1`              |
| `berean://passage/John-1?startVerse=3` | `/passage/John-1?startVerse=3` |
| `berean://settings`                    | `/settings`                    |
| `berean://`                            | `/`                            |

`parseBereanOpenUrl` accepts exactly the paths the web server serves
(`resolveAppPath` in `shared/http-routes.ts`), so a new web route works as a
link with no change here, once a desktop release has bundled the new route
table (see [When a release happens](#when-a-release-happens)). Anything else (`berean://nope`, a static file, a
host such as `berean://evil.example/…`) is ignored.

- **Running:** the route opens in a **new window**, which comes to the front.
  Existing windows are never reloaded: notes do not autosave, and a reload
  would skip the app's "Discard unsaved notes?" prompt and lose a note in
  progress.
- **Not running:** the link launches Berean, and its first window opens at
  the route.
- **Signed out:** the window shows the login page on that URL. Sign-in hands
  back to the same URL, so the route appears once signed in.

macOS delivers links through `open-url`. A link passed on the command line,
or to a second launch (`second-instance`, which is how other platforms
deliver them), is handled the same way. There are no Universal Links
(`https://` links that open the app).

### Testing route links

With the packed app (see below):

```bash
# Berean not running: launches it with one window, on John 1.
open "berean://passage/John-1"

# Berean running: opens a second window on Settings; the first is untouched.
open "berean://settings"

# Ignored; no window opens or changes.
open "berean://nope"
```

To check a note in progress survives, start typing a note in a passage, don't
save it, then run `open "berean://passage/John-2"`. John 2 opens in a new
window, and the note is still there in the first one.

Sign out first to check the signed-out case: the login page shows, the address
stays `/passage/John-1`, and after signing in the passage appears.

## Sign-in through the browser

Google does not allow sign-in from an embedded browser, and the shell never
renders a third-party page anyway. Sign-in happens in the user's default
browser and comes back through `berean://auth`:

1. **Login page** (`src/components/login-page.tsx`, desktop only) starts a
   _sign-in attempt_ with a random id, remembers it in `localStorage`, and
   calls `signIn("google", { redirectTo: "/desktop-auth.html?signInAttempt=…" })`.
   Convex Auth stores a _verifier_ in the app's `localStorage`, then points
   the window at `{CONVEX_SITE_URL}/api/auth/signin/google?…`.
2. **Main** sees that navigation leave the app origin, cancels it and opens it
   in the system browser. Because it is a Convex sign-in URL
   (`https://*.convex.site/api/auth/signin/…`), main records a pending
   sign-in for that window, with the attempt id from the URL's `redirectTo`,
   good for 10 minutes. A new sign-in replaces it. The login
   page stays put and shows "Finish signing in in your browser" with an **Open
   browser again** button, which simply starts over.
3. **The browser** goes through Google. Convex then redirects to
   `{SITE_URL}/desktop-auth.html?signInAttempt=…&code=…`.
4. **`public/desktop-auth.html`** navigates to
   `berean://auth?code=…&signInAttempt=…` and shows an **Open Berean** button
   with the same link, for browsers that block the automatic hand-back.
   Browsers ask the user to allow opening Berean; that prompt is expected. It
   removes the query from the address bar and history once the link is built.
5. **macOS** delivers the link to main as `open-url`. Main parses it with
   `parseBereanOpenUrl`, which rejects an auth link without a valid attempt
   id. If the link's attempt id is the pending sign-in's, main clears the
   pending sign-in, reloads the window that started it at its current URL
   with `?code=…&signInAttempt=…` added, and brings it to the front. If that
   window is gone it uses the first window, or opens a new one. Any other
   auth link (no sign-in pending, it expired, a different or missing attempt
   id, or a repeat of a code already delivered, including a link that
   launches the app) is ignored and Berean just comes to the front. So no
   window reloads, and no unsaved note is lost, for a code that is not the
   one the app is waiting for, and another site cannot reload the app with a
   code of its choosing.
6. **The web app** loads and finds `?code=`. Its `shouldHandleCode`
   (`src/lib/desktop-sign-in-attempt.ts`) lets Convex Auth redeem the code
   only if its attempt id is the latest one started in this app, and uses the
   attempt up. Convex Auth exchanges the code using the stored verifier and
   strips the param. The user is signed in, in every window. A code that is
   not redeemed (including one with no attempt id) is just removed from the
   URL. This repeats main's check inside the page.

### Why codes carry an attempt id

Convex Auth keeps one verifier, which every `signIn` overwrites, and it
deletes the verifier _before_ it tries a code. A failed exchange also clears
the session (`tokens: null`). So, without the attempt check:

- after **Open browser again**, finishing the older tab spends the newer
  verifier on a code that cannot match it, and the newer tab then fails too;
- a code that arrives after sign-in succeeded (the hand-back page opening
  Berean twice, or a second tab finished later) signs the user out.

With it, only the newest attempt's code is redeemed, once, whichever order the
tabs finish in. Main makes the same check before it reloads anything, so the
older tab's code, a repeat, or a stray link never reloads a window. A code
without an attempt id is never used.

Nothing under `convex/` changed for this: Convex Auth's default redirect
callback already accepts a `redirectTo` that starts with `/` and resolves it
against the `SITE_URL` environment variable.

### Why `desktop-auth.html` is a static file

The code is useless without the verifier, and the verifier never leaves the
desktop app's own storage. If the hand-back URL loaded the web app, its
`ConvexAuthProvider` would see `?code=` and try to redeem it right there in the
browser, where there is no verifier: the exchange would fail and the code would
be spent. So the page is plain HTML with an inline script, lives in `public/`,
and is served as a file (paths with an extension skip the SPA rewrite in
`middleware.ts`). Keep it that way: no bundle, no imports.

It also means **the web deployment has to contain `desktop-auth.html`** before
a desktop build that depends on it is released.

### Testing it

The scheme needs a packed app, and the redirect goes to `SITE_URL`, so test
against the local dev server (the dev Convex `SITE_URL` is
`http://localhost:5173`):

```bash
pnpm dev                 # terminal 1 — must be on port 5173
pnpm run desktop:pack    # terminal 2
BEREAN_DESKTOP_URL=http://localhost:5173 \
  electron/release/mac-arm64/Berean.app/Contents/MacOS/Berean
```

Click **Sign in with Google**: the default browser opens, and after choosing an
account it shows the hand-back page and Berean comes to the front signed in.

To exercise the hand-back without Google, with the app running as above, click
**Sign in with Google** and close the browser tab it opens. Get the attempt id
from View → Toggle Developer Tools → Console:
`localStorage.getItem("berean.desktopSignInAttempt")`. Then, within 10
minutes:

```bash
ATTEMPT=…   # the id from the console
open "berean://auth?code=test&signInAttempt=$ATTEMPT"
```

The window reloads at `…/?code=test&signInAttempt=…`, the app strips the
params, the exchange fails (the code is fake) and the login page comes back.
Each of these is ignored, with no reload:

- the same `open` again (the pending sign-in was used up);
- `open "berean://auth?code=test"` (no attempt id);
- `open "berean://auth?code=test&signInAttempt=0000000000000000"` (not the
  pending attempt).

To check **Open browser again**, click Sign in, note the id, click Open
browser again, and `open` a link with the first id: nothing reloads. A link
with the new id reloads. If `open` starts a different copy of Berean, or
nothing, re-register the packed app:

```bash
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister \
  -f electron/release/mac-arm64/Berean.app
```

The main process logs each hand-off to the terminal (`[berean] Opening … in
the default browser`, `[berean] Sign-in code received from the browser`). It
never logs the code.
