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
- The desktop version (`electron/package.json`, starting at `1.0.0`) is
  independent of the web app's release-please version.
- Dependabot has a separate entry for `/electron`. Electron major updates are
  not ignored there, because only the newest few major lines get security
  fixes.

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

| File                   | Role                                                          |
| ---------------------- | ------------------------------------------------------------- |
| `main.ts`              | Windows, menu, navigation guard, offline, sign-in hand-back   |
| `preload.ts`           | Exposes `window.bereanDesktop` (`{ isDesktop, platform }`)    |
| `offline.html`         | Local "needs an internet connection" page with Retry          |
| `ipc-channels.ts`      | IPC channel names shared by main and preload                  |
| `shell-policy.ts`      | Pure URL checks used by main (sign-in, origins, frames)       |
| `electron-builder.yml` | Packaging: app id, `berean://` scheme, icon, mac `dir` target |

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
- **Menu.** File → New Window is Cmd+N. The web app owns Cmd+K, Cmd+G, Cmd+,,
  Cmd+J and Cmd+Enter; do not bind those in the menu.
- **Security defaults.** `contextIsolation: true`, `nodeIntegration: false`,
  `sandbox: true`, no `<webview>`. Every permission request and check
  (notifications, geolocation, clipboard read, camera, …) is denied: the web
  app uses none.

The `berean://` scheme is declared in `electron-builder.yml`. macOS only
honours a custom scheme for a packaged app, so anything involving `berean://`
links has to be tested with `desktop:pack`, not `desktop:dev`.

Signing, notarization, the `.dmg`, self-update and the release workflow are
not here yet; they arrive with PR 6 of the plan. So do `berean://` links to app
routes (PR 4): today the shell only acts on `berean://auth`.

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
   sign-in for that window, good for 10 minutes. The login
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
   `parseBereanOpenUrl`. If a sign-in is pending, it reloads the window that
   started sign-in at its current URL with `?code=…&signInAttempt=…` added,
   and brings it to the front. If that window is gone it uses the first
   window, or opens a new one. The pending sign-in is **not** used up: every
   code inside the 10 minutes is delivered (see below). With no pending
   sign-in (none started, or it expired, including a link that launches the
   app) the link is ignored and Berean just comes to the front, so another
   site cannot reload the app with a code of its choosing.
6. **The web app** loads and finds `?code=`. Its `shouldHandleCode`
   (`src/lib/desktop-sign-in-attempt.ts`) lets Convex Auth redeem the code
   only if its attempt id is the latest one started in this app, and uses the
   attempt up. Convex Auth exchanges the code using the stored verifier and
   strips the param. The user is signed in, in every window. A code that is
   not redeemed is just removed from the URL.

### Why codes carry an attempt id

Convex Auth keeps one verifier, which every `signIn` overwrites, and it
deletes the verifier _before_ it tries a code. A failed exchange also clears
the session (`tokens: null`). So, without the attempt check:

- after **Open browser again**, finishing the older tab spends the newer
  verifier on a code that cannot match it, and the newer tab then fails too;
- a code that arrives after sign-in succeeded (the hand-back page opening
  Berean twice, or a second tab finished later) signs the user out.

With it, only the newest attempt's code is redeemed, once, whichever order the
tabs finish in. That is also why main no longer consumes the pending sign-in
on the first code. A code without an attempt id (from an older hand-back page)
is redeemed as before.

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
**Sign in with Google** (close the browser tab it opens), then within 10
minutes:

```bash
open "berean://auth?code=test"
```

The window reloads at `…/?code=test`, the app strips the param, the exchange
fails (the code is fake) and the login page comes back. Run the same `open`
again and the window reloads again: codes keep being delivered for 10 minutes.
A link with an attempt id the app did not start
(`open "berean://auth?code=test&signInAttempt=0000000000000000"`) reloads the
window, but the app drops the code without trying it. If `open` starts a
different copy of Berean, or nothing, re-register the packed app:

```bash
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister \
  -f electron/release/mac-arm64/Berean.app
```

The main process logs each hand-off to the terminal (`[berean] Opening … in
the default browser`, `[berean] Sign-in code received from the browser`). It
never logs the code.
