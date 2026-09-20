# Mobile App (Expo)

Expo mobile application for Pokémon Go Nexus.

Android website beta builds and the master integration/release process are
documented in [Android beta distribution](./ANDROID_BETA.md).

Native workflow replacements are governed by the
[Native Collection Parity Contract](./COLLECTION_PARITY_CONTRACT.md). The
canonical web application remains the default until a complete workflow passes
its automated and manual parity gates.

## Current architecture

1. Expo Router and React Native screens cover the canonical home, collection,
   search, trade, social, profile, settings, account, information, legal, and
   trainer-tool routes.
2. Shared contracts, API clients, domain rules, and UI tokens keep the native
   and web applications aligned without importing DOM components into native UI.
3. Native authentication supports email plus Google, Discord, and Facebook,
   with SecureStore-backed refresh rotation and session recovery.
4. The collection uses a SQLite snapshot and mutation outbox for offline display
   and receiver-backed reconciliation; trade commands remain online and
   server-authoritative.
5. Native deep links, external-browser handoff, realtime trade reconciliation,
   platform share sheets, loading/error recovery, accessibility semantics, and
   light/dark/reduced-motion preferences are covered by automated tests.
6. The hardened WebView remains the production restore point until the native
   release candidate completes its device rollout gate. It is not used by the
   native-preview route tree.

## Commands

```bash
cd frontend
nvm use
npm ci
npm --workspace apps/mobile run start
npm --workspace apps/mobile run start:native-preview
npm --workspace apps/mobile run android
npm --workspace apps/mobile run ios
npm --workspace apps/mobile run web
npm --workspace apps/mobile run typecheck
npm --workspace apps/mobile run lint
npm --workspace apps/mobile run test
npm --workspace apps/mobile run device:smoke:android
npm --workspace apps/mobile run device:smoke:android:release-lifecycle
```

Keep Reanimated and Worklets aligned with the installed Expo SDK. They are
declared in the mobile package and pinned in the root workspace so optional
router dependencies cannot install another native copy. The root
`expo-modules-core` dependency also lets the hoisted Jest preset resolve Expo's
runtime. Update these constraints together during SDK upgrades, then run
`npx expo-doctor` from this directory and the mobile test suite.

`device:smoke:android` boots or reuses the dedicated Pixel emulator, starts an
isolated fixture API and Metro server with the full checked-in Pokémon catalog,
builds and installs the `com.pokegonexus.app` development client, then drives
that project-owned React Native runtime with Maestro. It does not use Expo Go.
The checked-in matrix covers public/auth routes, dashboard and action-menu
navigation, collection and editing variants, tags and wishlist, search, profiles and
friends, settings and account security, trade preferences/activity/proposals,
Trade Board sharing, and every trainer tool. Set `POKEGONEXUS_SMOKE_FLOW` to a
single YAML file for a focused run or `.maestro` for the complete matrix. The
fixture route is disabled unless `EXPO_PUBLIC_DEVICE_SMOKE_MODE=true` and is
unavailable in ordinary production bundles. Explicit standalone smoke builds
also opt into host-emulator cleartext access; normal Android builds write
`usesCleartextTraffic=false`.

`device:smoke:android:release-lifecycle` builds a standalone native-preview APK,
enables airplane mode, and validates the real account-scoped SQLite collection
cache and mutation outbox across force-stop/relaunch, account switching,
Receiver acknowledgement, and canonical cleanup. The runner restores the
device's prior network, density, font-scale, and animation settings on exit.

## Environment

Copy `.env.example` values into your environment (or EAS secrets) using `EXPO_PUBLIC_*` keys.

`EXPO_PUBLIC_FRONTEND_APP_URL` controls which deployed web app the mobile shell loads.

`EXPO_PUBLIC_MOBILE_EXPERIENCE` defaults to `webview`. Set it to
`native-preview` in development and internal preview builds to use the complete
native route tree. Production remains on the WebView restore point until the
native release candidate is explicitly promoted after device verification.

## Android development build

Expo Go is no longer the device runtime for this project. The app targets Expo
SDK 57 and uses `expo-dev-client`, which gives Pixel testing a Pokémon Go Nexus
native runtime instead of depending on whichever SDK the Play Store Expo Go app
currently embeds.

Create the installable development APK from this directory with:

```bash
npx eas-cli build --platform android --profile development
```

Install the resulting APK on the Pixel once. For normal TypeScript/JavaScript
iteration after that, keep the phone and computer on the same network and run:

```bash
cd frontend
npm --workspace apps/mobile run start:native-preview
```

Open **Pokémon Go Nexus** on the phone and select the local development server.
Rebuild the APK only after changing native dependencies, native configuration,
or the Expo SDK. The `device-preview` EAS profile produces a standalone internal
APK with the native preview bundled for force-stop/relaunch and offline checks.

Native social sign-in uses system-browser authorization and a one-time callback
exchange; session tokens are never placed in redirect URLs. OAuth provider
configuration remains environment-specific and is exercised against fixtures in
the automated device matrix before real-provider rollout checks.

## Note on Node version

Use the repo `.nvmrc` Node version (`24`) for normal development and CI parity.
Expo/React Native dependencies in this scaffold require at least Node `>= 20.19.4`, so Node 24 is the intended path here.

## Monorepo Resolution Note

This app consumes local workspace packages from `../../packages/*`.
If Metro cannot resolve `@pokemongonexus/*` imports, restart with cache clear:

```bash
npx expo start -c
```
