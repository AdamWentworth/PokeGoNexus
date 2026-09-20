# Frontend Workspace

This folder is the frontend monorepo workspace for Pokémon Go Nexus.

The workspace contains the production web app, the Expo mobile shell, and shared packages that keep API contracts and UI tokens consistent across clients.

## Layout

- `apps/web` - Vite React web app host: Vite config, Playwright config, CI scripts, env files, and build output.
- `apps/mobile` - Expo React Native shell that can load the deployed web app through a WebView.
- `packages/app-core` - Canonical web app source: routes, pages, components, stores, services, IndexedDB access, and tests.
- `packages/shared-contracts` - Shared API path helpers and transport DTOs used by web/mobile clients.
- `packages/shared-ui-tokens` - Platform-neutral design tokens plus the web CSS variable sheet.
- `docs` - Frontend-specific workflows and product/UX notes.

## Tooling

- Use Node `24` from the repo `.nvmrc`.
- Install dependencies from `frontend/`, not from individual workspaces.
- The root `frontend/package-lock.json` is the lockfile for all frontend workspaces.

```bash
cd frontend
nvm use
npm ci
```

## Common Commands

Run workspace-level CI parity:

```bash
npm run lint
npm run lint:dead-code
npm run typecheck
npm run test
```

Run just the web app:

```bash
npm --workspace apps/web run dev
npm --workspace apps/web run build
npm --workspace apps/web run test
npm --workspace apps/web run test:browsers
npm --workspace apps/web run smoke:production
```

Run just the mobile app:

```bash
npm --workspace apps/mobile run start
npm --workspace apps/mobile run lint
npm --workspace apps/mobile run typecheck
npm --workspace apps/mobile run test
```

## Where To Start

- New frontend contributor: start with `apps/web/README.md`.
- User-flow overview: see the Mermaid diagram in `apps/web/README.md`.
- Source ownership and folder map: see `packages/app-core/README.md`.
- Safari/cross-browser proofing: see `docs/BROWSER_PROOFING_WORKFLOW.md`.
- UX messaging policy: see `docs/UX_MESSAGING_POLICY.md`.
- Performance captures: see `docs/PERF_BASELINE_WORKFLOW.md`.

## Development Notes

- Shared assets live at repo-root `assets/` and are served by the frontend nginx image under `/media/...`.
- Generated artifacts live under `.artifacts/`, `dist/`, coverage folders, and Playwright output folders; they should remain untracked.
- Real `.env*` files are intentionally local/deploy configuration. Do not add secrets to docs or commits.
