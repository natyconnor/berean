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
| `main.ts`              | Windows, menu, navigation guard, offline fallback             |
| `preload.ts`           | Exposes `window.bereanDesktop` (`{ isDesktop, platform }`)    |
| `offline.html`         | Local "needs an internet connection" page with Retry          |
| `ipc-channels.ts`      | IPC channel names shared by main and preload                  |
| `electron-builder.yml` | Packaging: app id, `berean://` scheme, icon, mac `dir` target |

- **One session.** Every window uses the `persist:berean` partition, so File →
  New Window is already signed in and the session survives relaunch.
- **Navigation guard.** A window only ever renders the app origin or
  `offline.html`. Any other navigation, redirect or `window.open` is cancelled
  and, if it is an `http(s)` URL, opened in the system browser. The guard is
  attached to every `WebContents` the app creates.
- **Offline.** If the app URL fails to load, the window shows `offline.html`.
  Retry (or View → Reload, or the network coming back) asks main to load the
  app URL again.
- **Menu.** File → New Window is Cmd+N. The web app owns Cmd+K, Cmd+G, Cmd+,,
  Cmd+J and Cmd+Enter; do not bind those in the menu.
- **Security defaults.** `contextIsolation: true`, `nodeIntegration: false`,
  `sandbox: true`, no `<webview>`.

The `berean://` scheme is declared in `electron-builder.yml`. macOS only
honours a custom scheme for a packaged app, so anything involving `berean://`
links has to be tested with `desktop:pack`, not `desktop:dev`.

Signing, notarization, the `.dmg`, self-update and the release workflow are
not here yet; they arrive with PR 6 of the plan.
