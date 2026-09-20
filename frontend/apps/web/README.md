# Pokémon Go Nexus Frontend

This is the **React web frontend** for the Pokémon Go Nexus platform. It is the primary client for managing Pokémon ownership, proposing trades, maintaining wanted lists, browsing Pokédex data, searching trainers/Pokémon, and validating Safari/WebKit behavior before production deploys.

---

## 🧩 Overview

The app supports:

- Ownership tracking with caught/trade/wanted instance detail.
- Pokédex browsing, variant filtering, sorting, and tag-driven collection views.
- Trade proposal, mirror-trade targeting, status review, and trade resolution flows.
- Search and map-based discovery across Pokémon, ownership modes, friendship filters, locations, and trainers.
- Fusion, Mega, Crown, Max, background, costume, shiny, shadow, and other variant display rules.
- IndexedDB-backed boot performance, queued receiver updates, and SSE/missed-update syncing.

> The frontend is actively evolving. When changing behavior, add or update tests that lock down the user experience, especially around overlays, Safari/WebKit behavior, IndexedDB, touch gestures, and grid layout.

---

## 🗂 Monorepo Layout (Current)

- `frontend/packages/app-core/` → canonical app source (`src`), app public assets (`public`), HTML entry, and Vitest test source (`tests`).
- `frontend/apps/web/` → web host/build shell: Vite config, Playwright config, CI scripts, env files, and `dist` output.
- `frontend/apps/web/.artifacts/` → generated local/CI browser and test artifacts only.
- `frontend/packages/shared-contracts/` → shared API contracts and DTO types.
- `frontend/packages/shared-ui-tokens/` → shared design tokens and web CSS variables.
- repo-root `assets/` → canonical shared media/static asset source served by frontend nginx at `/media/...`.

---

## 🧭 User Flow Diagram

This diagram is intentionally a user-flow map, not a component dependency graph. Use it to understand where a trainer can go, what major choices they make, and which flows write back to local state, IndexedDB, or backend services.

```mermaid
flowchart TD
  Start([User opens web app]) --> Home["/ Home"]

  Home -->|New trainer| Register["/register"]
  Home -->|Existing trainer| Login["/login"]
  Home -->|Browse own collection| OwnCollection["/pokemon<br/>My collection"]
  Home -->|Find Pokemon or trainers| Search["/search"]
  Home -->|Review trade activity| Trades["/trades"]

  Register -->|Create account + location choices| RegisterSuccess["Auto-login<br/>Seed user profile data"]
  RegisterSuccess --> OwnCollection

  Login -->|Submit credentials| LoginSuccess["Store auth session<br/>Fetch user overview<br/>Hydrate instances + trades"]
  LoginSuccess --> OwnCollection

  Home --> Account["/account"]
  Account -->|Update profile, location, password| AccountSaved["Account saved"]
  AccountSaved --> Account
  Account -->|Logout| Login
  Account -->|Delete account| Home

  OwnCollection --> PokedexPanel["Pokedex panel<br/>Browse filtered variant lists"]
  OwnCollection --> PokemonPanel["Pokemon panel<br/>Search, sort, view cards"]
  OwnCollection --> TagsPanel["Tags panel<br/>Caught, Trade, Wanted, custom tags"]

  PokedexPanel -->|Select list/filter| PokemonPanel
  TagsPanel -->|Select tag bucket| PokemonPanel

  PokemonPanel -->|Open unowned variant| PokedexOverlay["Pokedex overlay<br/>Variant details"]
  PokemonPanel -->|Open owned instance| InstanceOverlay["Instance overlay"]

  InstanceOverlay --> CaughtOverlay["Caught view<br/>Caught details + stats"]
  InstanceOverlay --> TradeOverlay["Trade view<br/>Offer details"]
  InstanceOverlay --> WantedOverlay["Wanted view<br/>Wanted criteria"]

  TradeOverlay --> TradeTargets["Trade targets panel<br/>Wanted matches + mirror targets"]
  TradeTargets -->|Open wanted target| WantedOverlay
  WantedOverlay -->|Open matching offer| TradeOverlay

  CaughtOverlay -->|Save changes| SyncUpdates["Update Zustand stores<br/>Persist IndexedDB<br/>Queue receiver batch"]
  TradeOverlay -->|Save changes| SyncUpdates
  WantedOverlay -->|Save changes| SyncUpdates
  SyncUpdates --> PokemonPanel

  OwnCollection -->|View another trainer| PublicCollection["/pokemon/:username<br/>Public trainer collection"]
  Search --> SearchMode{"Choose search mode"}

  SearchMode --> PokemonSearch["Pokemon search<br/>Variant, ownership, friendship, location filters"]
  SearchMode --> TrainerSearch["Trainer search"]

  TrainerSearch --> PublicCollection
  PokemonSearch --> SearchResults{"Results view"}
  SearchResults --> ListResults["List view"]
  SearchResults --> MapResults["Map view"]
  ListResults --> TradeProposal["Open result details<br/>Start trade proposal"]
  MapResults --> TradeProposal
  TradeProposal --> Trades

  Trades --> TradeStatuses["Status tabs<br/>Offers, Proposed, Pending, Completed, Cancelled"]
  TradeStatuses --> TradeCards["Trade cards"]
  TradeCards -->|Accept or deny| TradeDecision["Trade decision"]
  TradeCards -->|Complete or cancel| TradeResolution["Trade resolution"]
  TradeCards -->|Re-propose| TradeProposal
  TradeDecision --> SyncUpdates
  TradeResolution --> SyncUpdates
```

### Reading Guide

- The standalone catalog workflow begins at `/pokedex`, while the main collection workflow lives at `/pokemon`, which currently has three horizontally sliding panels: Pokédex, Pokémon, and Tags.
- Opening a Pokémon card branches into either a Pokédex overlay for variant-only data or an instance overlay for owned/caught/trade/wanted data.
- Search is separate from collection management: it helps users discover Pokémon or trainers, then leads into trade proposals or public trainer collections.
- Trades are managed from `/trades` by status, with actions that write back through the same store, IndexedDB, and receiver update path used by instance edits.
- App bootstrapping, IndexedDB hydration, service worker batching, and SSE updates run behind these screens to keep variants, instances, tags, and trades current.

### Logged-In vs Logged-Out Feature Notes

The current app does not treat every route as a hard auth boundary. Instead, authentication mainly changes whether the user has a trainer identity, hydrated user-owned data, and permission to write changes.

| Feature area | Logged out | Logged in |
| --- | --- | --- |
| Home and navigation | Can view the landing page, browse public navigation, switch theme, and go to Login/Register. | Sees Account instead of Login/Register and can use the app as a known trainer. |
| Register/Login | Can create an account or sign in. | Login/register are no longer the main path; account management becomes available. |
| Account | No user profile is available. | Can edit profile details, location preferences, password, logout, or delete account. |
| `/pokedex` catalog | Can browse Pokédex-style variant data and open raw variant details. | Same catalog browsing flow, with future collector-complete registrations able to use the authenticated trainer identity. |
| `/pokemon` collection | Can browse Pokédex-style variant data, but user-owned instance data and durable edits depend on an authenticated user session. | Hydrates the trainer's instances, tags, and trades; supports editing caught/trade/wanted details, changing tags, and queueing updates. |
| `/pokemon/:username` public collection | Can view another trainer's public collection if the profile exists. | Same public viewing flow, while still retaining the logged-in user's own session and local data. |
| Search | Can use discovery-oriented search surfaces where backend endpoints allow it. Trade-oriented actions may be limited because there is no current trainer identity. | Can search Pokémon/trainers, inspect list or map results, and move into trade proposal flows as the current trainer. |
| Trades | May render empty or unauthenticated state because there is no user overview/trade store hydrated for the visitor. | Shows Offers, Proposed, Pending, Completed, and Cancelled trades; actions sync through trade stores and backend updates. |
| Background sync | No authenticated SSE stream or receiver batch identity. | Auth state is posted to the service worker; IndexedDB, queued receiver updates, and SSE/missed-update handling keep local data current. |

---

## ⚙️ Tech Stack

- **React 19** and **React Router 7** for the web app shell and route model.
- **Vite 8** for development, production builds, and preview-mode browser tests.
- **TypeScript 6** across app source and tests.
- **Zustand** for domain state stores: variants, instances, tags, trades, auth, users, and location.
- **React Context** for cross-cutting app concerns: auth API, theme, modal dialogs, loading overlay, and SSE events.
- **IndexedDB** via `idb` for variant, instance, tag, trade, and queued-update persistence.
- **Server-Sent Events** and receiver batching for real-time and offline-ish sync.
- **Vitest**, **Testing Library**, **Playwright**, **ESLint**, and **Stylelint** for quality gates.

---

## 🚀 Getting Started

### 1. Install dependencies

```bash
cd frontend
nvm use
npm ci
```

### 2. Configure environment

Use `frontend/apps/web/.env.development` for local API URLs and `frontend/apps/web/.env.production` for production build defaults. If you want local frontend work to hit live APIs, copy the production values into your local development env.

When public DNS is unavailable but the stack is reachable on the local network, add these ignored overrides to `frontend/apps/web/.env.development.local`:

```dotenv
DEV_PROXY_TARGET=https://192.168.1.77
DEV_PROXY_HOST=pokegonexus.com
DEV_PROXY_SECURE=false
VITE_ASSET_ORIGIN=
```

Restart Vite after changing `.env*` values.

### 3. Start the dev server

```bash
npm --workspace apps/web run dev
```

### 4. Run local checks

```bash
npm --workspace apps/web run lint
npm --workspace apps/web run typecheck
npm --workspace apps/web run test:unit
npm --workspace apps/web run test:browsers:safari
```

---

## 🎞️ Demo Media Capture

The live demo capture commands log in to the production web surface and use a read-only Playwright guard that blocks Pokémon, trade, and profile mutation requests. Auth session-token metadata may still change because the capture performs a normal login.

```bash
npm --workspace apps/web run capture:demo:media:live
```

That all-media command prompts once for the AdamZilla credentials, then runs the screenshot,
AdamZilla video, disposable auth video, disposable workflow video, and video-poster steps.
Use `DEMO_MEDIA_STEPS=screenshots,videos,auth,workflows,posters` to run a subset.

The same steps can also be run individually:

```bash
npm --workspace apps/web run capture:demo:live
npm --workspace apps/web run capture:demo:video:live
npm --workspace apps/web run capture:demo:auth:live
npm --workspace apps/web run capture:demo:workflows:live
npm --workspace apps/web run capture:demo:posters:live
```

- Screenshots are written to `frontend/apps/web/.artifacts/demo-media-live/`.
- Video poster images are written to `frontend/apps/web/.artifacts/demo-media-live/video-posters/`.
- Videos are written to `frontend/apps/web/.artifacts/demo-video-live/`.
- Screenshots capture dark and light themes for desktop and mobile.
- Videos default to dark and light themes for desktop and mobile, producing four variants per flow.
- Running the full media command produces 16 hand-captured screenshots, 32 videos, and 32 video poster images.
- The 32 videos are 8 read-only AdamZilla demo videos, 4 auth lifecycle videos, and 20 Pokémon workflow videos.
- Videos use a disposable warm-up page for login/cache priming, then record a fresh page and trim each clip from the visual-ready frame.
- Videos keep the app viewport size and are capped just under 15 seconds by default.
- Desktop videos include an in-page demo cursor because browser video capture does not record the operating-system cursor.
- Mobile videos show a brief circular tap ripple for scripted interactions.
- Video capture suppresses notification toasts so location/auth messages do not cover the demo surface.
- Auth lifecycle capture creates a generated disposable account, records Home-to-register navigation, registration auto-login, account edit/deletion, and deletes the account before finishing. It does not use a real user account.
- Workflow capture creates generated disposable accounts, records Pokémon catalog/search and instance workflows, then deletes each account before finishing. Service workers are blocked during workflow recording, so Pokémon instance edits stay in the disposable browser session and are not batch-synced to the backend.

Video capture can be narrowed when Phlosion or README embeds only need a subset:

```bash
DEMO_VIDEO_THEMES=dark npm --workspace apps/web run capture:demo:video:live
DEMO_VIDEO_VIEWPORTS=desktop npm --workspace apps/web run capture:demo:video:live
DEMO_VIDEO_FLOWS=collection-overlay npm --workspace apps/web run capture:demo:video:live
DEMO_VIDEO_MAX_SECONDS=14.5 DEMO_VIDEO_CRF=18 npm --workspace apps/web run capture:demo:video:live
DEMO_VIDEO_COLLECTION_FAVORITES_PAUSE_MS=500 npm --workspace apps/web run capture:demo:video:live
DEMO_VIDEO_SEARCH_COSTUME_MENU_PAUSE_MS=1100 npm --workspace apps/web run capture:demo:video:live
DEMO_VIDEO_SEARCH_MAP_POPUP_PAUSE_MS=2800 npm --workspace apps/web run capture:demo:video:live
DEMO_AUTH_VIDEO_MAX_SECONDS=26 npm --workspace apps/web run capture:demo:auth:live
DEMO_AUTH_INCLUDE_EXPLICIT_LOGIN=1 DEMO_AUTH_VIDEO_MAX_SECONDS=36 npm --workspace apps/web run capture:demo:auth:live
DEMO_WORKFLOW_FLOWS=caught-instance,trade-instance npm --workspace apps/web run capture:demo:workflows:live
DEMO_WORKFLOW_THEMES=dark npm --workspace apps/web run capture:demo:workflows:live
DEMO_WORKFLOW_VIEWPORTS=desktop npm --workspace apps/web run capture:demo:workflows:live
DEMO_WORKFLOW_VIDEO_MAX_SECONDS=18 npm --workspace apps/web run capture:demo:workflows:live
DEMO_WORKFLOW_EDIT_VIDEO_MAX_SECONDS=25 npm --workspace apps/web run capture:demo:workflows:live
DEMO_POSTER_OFFSET_SECONDS=4 npm --workspace apps/web run capture:demo:posters:live
DEMO_MEDIA_STEPS=videos,posters npm --workspace apps/web run capture:demo:media:live
```

Current read-only video flows are `collection-overlay` and `search-results`. Current disposable workflow flows are `caught-instance`, `catalog-search`, `wanted-instance`, `trade-instance`, and `instance-edit`. Keep dark media as the primary Phlosion surface, and expose light media as an alternate view when a page has room for a theme toggle.

---

## CI/CD (GitHub Actions)

This service now has dedicated frontend workflows:

- `ci-frontend` (`.github/workflows/ci-frontend.yml`)
- private HomeOps `deploy-pokegonexus-frontend`

### What `ci-frontend` does

- Runs on changes under `frontend/**`, `nginx/**`, and the frontend workflow files.
- Installs workspace deps with `npm ci` from `frontend/`.
- Builds with `npm run build`.
- Enforces a blocking production audit gate with `npm audit --omit=dev --audit-level=moderate`.
- Runs full (prod + dev) audit as informational output for visibility without blocking deploys.
- Builds nginx image after staging `frontend/apps/web/dist` into `nginx/build`.
- Runs Trivy scans and publishes an SBOM artifact.
- Pushes `adamwentworth/frontend-nginx` tags (`sha-<commit>` + `latest`) when `DOCKERHUB_TOKEN` is set.

### What the private HomeOps deployment does

- Accepts the current full PokeGoNexus `master` SHA.
- Rejects images whose embedded source revision does not match.
- Deploys the immutable SHA-tagged frontend image.
- Validates Compose, Docker networks, TLS, Nginx, and external HTTPS health.
- Rolls back a failed replacement without checking out public source on the production runner.

### Required repository secret

- `DOCKERHUB_TOKEN` (used by CI for DockerHub login/push)

---

## ⚙️ Environment Configuration

Set up API connection values in `frontend/apps/web/.env.*`.
If you're developing the frontend and don't need to run the backend locally, use production-style values to connect directly to the live APIs.

### 🛠️ `.env.development`

```env
VITE_POKEMON_API_URL=http://localhost:3001/pokemon
VITE_AUTH_API_URL=http://localhost:3002/auth
VITE_RECEIVER_API_URL=http://localhost:3003/api
VITE_USERS_API_URL=http://localhost:3005/api
VITE_SEARCH_API_URL=http://localhost:3006/api
VITE_LOCATION_SERVICE_URL=http://localhost:3007
VITE_EVENTS_API_URL=http://localhost:3008/api

VITE_FORCED_REFRESH_TIMESTAMP=1740519179122
```

### 🚀 `.env.production`

```env
VITE_POKEMON_API_URL=https://pokegonexus.com/api/pokemon
VITE_AUTH_API_URL=https://pokegonexus.com/api/auth
VITE_RECEIVER_API_URL=https://pokegonexus.com/api/receiver
VITE_USERS_API_URL=https://pokegonexus.com/api/users
VITE_SEARCH_API_URL=https://pokegonexus.com/api/search
VITE_LOCATION_SERVICE_URL=https://pokegonexus.com/api/location
VITE_EVENTS_API_URL=https://pokegonexus.com/api/events

VITE_FORCED_REFRESH_TIMESTAMP=1741290124604
```

`VITE_FORCED_REFRESH_TIMESTAMP` overrides the standard Pokémon data cache window. Update it when a major Pokémon data change should force clients to refetch fresh variant data even if their local cache is still considered valid.

Make sure to restart your dev server after changing `.env` values.

---

## 🧱 Project Structure

```plaintext
frontend/
├── apps/
│   ├── web/                 # Vite host, Playwright config, env files, CI scripts
│   └── mobile/              # Expo shell
├── docs/                    # Frontend workflow and UX docs
├── packages/
│   ├── app-core/
│   │   ├── src/
│   │   │   ├── components/  # Reusable UI, overlays, dev tools, Pokemon display pieces
│   │   │   ├── contexts/    # Auth, loading, modal, theme, event stream providers
│   │   │   ├── db/          # IndexedDB helpers
│   │   │   ├── features/    # Domain-owned state/actions/storage/display logic
│   │   │   ├── hooks/       # Shared viewport, sorting, filtering hooks
│   │   │   ├── pages/       # Route-level pages and feature-specific UI
│   │   │   ├── services/    # API clients and service wrappers
│   │   │   ├── stores/      # Cross-feature stores and batched-update helpers
│   │   │   ├── styles/      # Token imports and global CSS layers
│   │   │   ├── types/       # App-local type models
│   │   │   └── utils/       # Storage, routes, logging, asset URLs, shared helpers
│   │   ├── public/          # App-shell assets copied by Vite
│   │   └── tests/           # Unit, integration, contract, and workflow tests
│   ├── shared-contracts/    # API contracts and transport DTOs
│   └── shared-ui-tokens/    # Design token package
└── package.json             # npm workspace root
```

---

## 🧠 Core Page: `Pokemon.tsx`

This is the **main UI** for managing a user's collection or another player's Pokémon list.

### 🧩 Key features:

- **Horizontal 3-panel layout**:
  - **Left:** Pokédex filters & saved lists
  - **Center:** Main Pokémon grid with ownership status
  - **Right:** Tag/Trade list manager
- **Swipe/drag gesture support** (touch + mouse in dev)
- **Dynamic filtering, sorting, searching**
- **Fusion, Mega, Lucky, Max, IV, CP, Gender, Shadow, etc.**
- **Trade mode integration**

### 🧠 Key logic includes:

- `usePokemonPageController` - owns route-derived page state, view switching, filters, selection, and overlay orchestration.
- `usePokemonProcessing` - filters, searches, sorts, and resolves display-ready Pokémon rows.
- `PokemonViewSlider` + `useSwipeHandler` - manage the Pokédex/Pokémon/Tags sliding panel experience.
- `PokemonMenu` + `PokemonGrid` - render searchable/sortable cards and protect initial grid layout from visible overlap.
- `InstanceOverlay` - branches into caught, trade, and wanted detail flows.
- `useHandleChangeTags` - applies bulk caught/trade/wanted tag changes and coordinates Mega/Fusion selection prompts.
- `useMegaPokemonHandler` and `useFusionPokemonHandler` - manage dynamic variant selection modals.
- `buildSliderTransform()` - calculates panel slide position.

### 🔄 View modes:

```plaintext
[pokedex] <--> [pokemon] <--> [tags]
```

---

## 📍 Routes

Currently implemented:

- `/` - home/landing page with navigation, auth entry points, and feature overview.
- `/pokedex` - standalone variant catalog and registration workspace.
- `/pokemon` - the current trainer's collection and Pokédex workspace.
- `/pokemon/:username` - public view of another trainer's collection.
- `/search` - Pokémon/trainer discovery with list and map result modes.
- `/trades` - trade status dashboard for offers, proposed, pending, completed, and cancelled trades.
- `/login`, `/register`, `/account` - authentication and account management screens.

---

## 🗂 State And Data Ownership

The app uses a mix of React contexts for cross-cutting providers and Zustand stores for feature/domain state.

### Context Providers

- `AuthContext` - login/logout/update/delete account API, token refresh behavior, and service-worker auth state.
- `AppLoadingContext` - route/page loading overlay and shared loading fallback.
- `ModalContext` - global alert/confirm modal API.
- `ThemeContext` - root `data-theme` and dark/light preference.
- `EventsContext` - SSE connection, missed-update fetches, and reconnection behavior.

### Zustand Stores

- `useAuthStore` - current user, login state, and persisted auth data.
- `useVariantsStore` - Pokémon API payload, generated variants, Pokédex lists, and variant cache hydration.
- `useInstancesStore` - current trainer instances, viewed trainer instances, IndexedDB persistence, receiver batching, and instance status/detail updates.
- `useTagsStore` - generated tag buckets for local and public-profile views.
- `useTradeStore` - trade records, related instances, proposal actions, and trade hydration.
- `useUserSearchStore` - trainer autocomplete and public profile loading.
- `useLocationStore` - current coordinates/location availability.

### Storage And Sync

- Variant, instance, tag, trade, and batched-update data are stored in IndexedDB for fast boot and Safari-safe persistence.
- Receiver updates are queued locally and sent through the service worker when a logged-in user has pending changes.
- SSE and missed-update polling keep logged-in user data current after the initial login/user overview load.

---

## ⚒ Development Tips

- Prefer domain-owned helpers under `src/features/*` for shared business rules before adding logic to route components.
- Keep route pages focused on orchestration; move repeated UI state, display derivation, and storage behavior into hooks/helpers.
- Shared media and Pokémon image assets live under repo-root `assets/` and are served at `/media/...` by the frontend nginx image.
- App-shell public files live under `frontend/packages/app-core/public/`.
- Add or update tests with behavior changes. This is especially important for overlays, touch gestures, Safari/WebKit layout, IndexedDB, search behavior, and trade flows.
- UX messaging standards are documented in `../../docs/UX_MESSAGING_POLICY.md`.
- Performance baseline capture workflow is documented in `../../docs/PERF_BASELINE_WORKFLOW.md`.

---

## 🧪 Testing

### Browser proofing

Safari-family issues can be reproduced locally with Playwright WebKit:

```bash
cd frontend
npm --workspace apps/web run install:browsers
npm --workspace apps/web run test:browsers:safari
```

Full browser matrix:

```bash
cd frontend
npm --workspace apps/web run test:browsers
```

Reports, traces, videos, screenshots, and browser console/network logs are saved under `.artifacts/browser/`. See `../../docs/BROWSER_PROOFING_WORKFLOW.md` for the full workflow.

### Recommended local commands

```bash
cd frontend
npm --workspace apps/web run test:unit
```

- Default local unit path (batched) to avoid Node heap OOM on Windows.
- Uses `frontend/apps/web/scripts/run-unit-tests-batched.mjs`.

### Additional test modes

```bash
cd frontend
npm --workspace apps/web run test:unit:single-process
npm --workspace apps/web run test:unit:parallel
npm --workspace apps/web run test:integration
npm --workspace apps/web run test:e2e
npm --workspace apps/web run test
```

- `test:unit:single-process`: one-process unit run (lowest memory mode).
- `test:unit:parallel`: standard Vitest parallel unit run.
- `test`: full Vitest suite used by CI quality gates.

### Notes

- If you hit memory pressure locally, prefer `npm --workspace apps/web run test:unit` from `frontend/` (batched).
- CI runs the full suite and is not constrained to local Windows batching behavior.

---

## 🎨 Theming

Dark/light mode is controlled by `ThemeContext`, persisted through storage helpers, and applied to `document.documentElement` as `data-theme`.

- Shared CSS variables come from `frontend/packages/shared-ui-tokens/src/web.css`.
- Web imports those variables through `frontend/packages/app-core/src/styles/tokens.css`.
- Component CSS should consume tokens rather than hard-coding a parallel theme system.
- `public/Light-Mode.css` has been removed; do not reintroduce theme compatibility stylesheets.
- `ThemeSwitch.tsx` is the user-facing theme toggle.

---

## 🧭 Future Plans

- Continue refining Wanted and Trade instance UI while preserving existing behavior with tests.
- Keep moving scattered Pokémon display rules into `src/features/pokemonDisplay`.
- Expand user-facing regression coverage for Search, Trades, overlays, and public trainer views.
- Improve profile/friend-management flows when backend support is ready.
- Add more bulk-edit affordances for collection management without making single-instance editing heavier.
- Keep Safari/WebKit browser proofing as a required part of UI-sensitive changes.

---

## 🧠 Author Notes

This frontend was designed to be modular, touch-friendly, and able to scale as Pokémon variant, ownership, and trade rules get more complex. The current direction is to keep user flows stable while moving domain rules into feature-owned helpers and backing important behavior with tests.

The codebase is large because the product surface is large: collection management, variant rendering, trade negotiation, search, map views, public profiles, offline-ish cache behavior, and browser-specific layout all meet in the frontend. The goal is not to make every file tiny; it is to keep ownership clear and avoid duplicating rules in components.

> If you're working on a section or need help tracking data flow, start with `packages/app-core/README.md`, then follow the route page, its domain store under `src/features/*`, and the tests that cover that behavior.
