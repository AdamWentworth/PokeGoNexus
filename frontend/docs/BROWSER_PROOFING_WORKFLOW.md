# Browser Proofing Workflow

This project uses Playwright from `frontend/apps/web` to run the same app flows across Chromium, Firefox, WebKit, mobile Safari emulation, and mobile Chrome emulation.

WebKit is the closest local Linux signal for Safari rendering and JavaScript engine issues. It is not a perfect replacement for real Safari on macOS or iOS, so treat this as the fast local gate. The same tests can later run on a macOS CI runner or a device-cloud provider when you need true Safari/iOS proof.

## One-time setup

```bash
cd frontend
npm ci
npm --workspace apps/web run install:browsers
```

On a fresh Ubuntu machine, WebKit may need extra system libraries. If Playwright reports missing packages, run:

```bash
cd frontend
npm --workspace apps/web run install:browsers:deps
```

That command uses `sudo` because it installs OS packages.

If `sudo npx` cannot see your `nvm` Node install, use apt directly:

```bash
sudo apt-get update
sudo apt-get install -y libevent-2.1-7t64 libavif16
```

## Daily commands

Run the full local browser matrix:

```bash
cd frontend
npm --workspace apps/web run test:browsers
```

Focus on Safari-family failures:

```bash
cd frontend
npm --workspace apps/web run test:browsers:safari
```

Watch the browser while debugging:

```bash
cd frontend
npm --workspace apps/web run test:browsers:headed
```

Open the saved report:

```bash
cd frontend
npm --workspace apps/web run test:browsers:report
```

Artifacts are written under `frontend/apps/web/.artifacts/browser/`, including screenshots, traces, videos on failure, JSON results, and captured browser console/network diagnostics.

The npm scripts run Playwright through `scripts/run-playwright-clean-env.mjs`, which strips Snap-provided `SNAP_*`, `GTK_*`, and `GIO_*` variables. That prevents WebKit from accidentally loading VS Code Snap libraries instead of Ubuntu system libraries.

## Target Known-Bad Pages

By default the browser smoke test opens the public, collection, discovery,
trade, battle, ranking, and Trade Board routes:

```text
/, /getting-started, /login, /register, /terms, /privacy, /data-deletion,
/pokedex, /pokemon, /search, /trades, /raid, /raid/methodology, /max,
/pvp, /pvp/methodology, /rankings, /trade-board
```

To target only pages reported by friends or QA:

```bash
cd frontend
E2E_ROUTE_PATHS="/pokemon,/search" npm --workspace apps/web run test:browsers:safari
```

Use `E2E_SETTLE_MS=3000` when a page needs more time for async rendering before diagnostics are evaluated.

## Testing Another Running App

If you already have a dev server running, point Playwright at it:

```bash
cd frontend
E2E_BASE_URL=http://127.0.0.1:3000 E2E_SKIP_WEBSERVER=1 npm --workspace apps/web run test:browsers:safari
```

The tests mock core API and image calls so browser failures are easier to separate from backend availability. Set `E2E_FAIL_ON_REQUEST_FAILED=1` when you want failed network requests to break the run too.

## Production-safe smoke

The read-only production smoke checks the deployed SPA routes, every built
asset referenced by the deployed entry document, the PWA manifest and service
worker, and the public Pokémon catalog manifest. It never logs in and only
issues GET or HEAD requests.

```bash
cd frontend
npm --workspace apps/web run smoke:production
```

Use `PRODUCTION_SMOKE_BASE_URL` to target another HTTPS deployment. The
scheduled `smoke-frontend-prod` workflow runs this check daily and uploads its
JSON report without requiring production credentials.
