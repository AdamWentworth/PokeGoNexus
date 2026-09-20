# Progressive Native Mobile Migration

## Restore point

The progressive native migration starts from commit
`8b686d3f7421e723f82beed632fdb772e9deef13`, tagged as
`mobile-webview-stable-2026-08-23`.

The tag identifies the last WebView-only baseline. Migration work belongs on
the `mobile/native-migration` branch until an increment is ready to merge.

## Stability invariants

Every migration commit must preserve these guarantees:

1. The default mobile experience remains the working WebView until a native
   replacement has passed its complete workflow gates.
2. Native screens are additive and independently switchable. An unfinished
   screen must never silently replace its WebView route.
3. Backend authentication changes accept both existing web cookies and the new
   mobile bearer-session protocol during the compatibility window.
4. Database and API changes follow expand, migrate, contract. Contract/removal
   work happens only after every deployed client has moved to the new path.
5. Web IndexedDB and mobile persistence are caches. Backend services remain the
   authority for accounts, social data, trades, and synchronized Pokémon data.
6. A mobile mutation uses one authoritative command path. The native and web
   clients must not dual-write the same action.
7. A native route keeps an explicit recovery path to the WebView while it is
   being proven in preview builds.

## Experience modes

`EXPO_PUBLIC_MOBILE_EXPERIENCE` controls the top-level mobile experience:

- `webview` is the production-safe default and renders the existing app.
- `native-preview` exposes migration scaffolding only in a deliberate preview
  build. It must always provide a direct return to the WebView experience.

Unknown or missing values resolve to `webview`. A future `native` production
mode will not be added until authentication, navigation, recovery, and the
first complete vertical slice are ready.

Device development uses the Pokémon Go Nexus `expo-dev-client` APK on Expo SDK 57.
Expo Go is not a supported runtime for this migration. The development build
connects to Metro for fast iteration, while the internal `device-preview` APK
bundles the preview for offline and cold-start validation.

The current `native-preview` supports email/password sessions through explicit
mobile login, refresh, and logout endpoints. Only the refresh token is persisted
in SecureStore; access tokens remain in memory. Transient restoration failures
preserve the saved session and offer retry, while rejected refresh tokens clear
the local session. Native provider linking now uses a system-browser,
device-bound, one-time-code callback exchange; access and refresh tokens never
enter deep links. The current-app handoff remains only as a rollout fallback
until the authentication service containing those endpoints is deployed
everywhere.

## Increment sequence

1. Establish the experience boundary and migration documentation.
2. Harden WebView navigation without changing supported login flows.
3. Extract browser-free contracts, API transport, and domain rules.
4. Add bearer-token support alongside cookie authentication in every protected
   backend service.
5. Add Expo Router and secure token storage while keeping WebView as the
   default route.
6. Add native login, session refresh, logout, and OAuth callbacks behind
   `native-preview`.
7. Add native Home/collection read-only screens.
8. Add collection mutations and offline synchronization through Receiver.
9. Port Search, social/profile, Trades, and the remaining routes by workflow.
10. Make native mode the default only after device and production validation.
11. Remove the WebView core path in a later contract phase.

## Commit gate

Before each migration commit:

```bash
cd frontend
npm --workspace apps/mobile run typecheck
npm --workspace apps/mobile run lint
npm --workspace apps/mobile run test -- --runInBand
```

Changes to shared packages or backend services must also run their affected
workspace/service CI-equivalent checks. Native workflow replacements require
React Native component tests and a device-level smoke flow before activation.

## Recovery

- Switch `EXPO_PUBLIC_MOBILE_EXPERIENCE` back to `webview` to bypass preview
  native work without reverting a deployment.
- Switch back to `master` to leave the migration branch.
- Use the restore tag for comparison or a new recovery branch. Do not reset or
  rewrite shared history to return to the restore point.
