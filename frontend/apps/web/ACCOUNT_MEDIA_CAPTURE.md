# Account media captures

This workflow records the current migration checkout’s **responsive web UI** with
a real signed-in account and live API reads. It does not certify the native app.

From `frontend/`, run:

```sh
npm run capture:demo:account:login --workspace apps/web
npm run capture:demo:account --workspace apps/web
```

The login command prompts in the terminal and hides the password. It uses the
normal app sign-in and saves browser state, including IndexedDB, to the ignored
`apps/web/.artifacts/account-media/auth-state.json` with owner-only permissions.
The password is not saved. The capture command also starts sign-in if that file
is missing; append `-- --login` to sign in again or use a different account.

The full run builds the checkout, then captures 14 flows in desktop/mobile and
dark/light variants. Thirteen flows create videos; the reference flow creates
screenshots for the remaining help, legal, authentication, and recovery routes.
Raid, Max, and PvP explicitly switch between All Pokémon and My Pokémon. PvP
records complete three-member Master League teams, matchup analysis, Battle Lab,
and IV Rank. Collection, registration progress, trades, the dashboard, and trainer
screens use the account’s actual data. Visitor profile and collection views use a
separate signed-out context. Account emails and the signed-in trainer card’s private code and location are
hidden in the presentation.

The browser serves the local production build at `https://pokegonexus.com`, keeping
public links correct while authenticated reads reach the real services. The
capture blocks collection, account, and trade mutations, permits auth refresh,
and saves the refreshed session locally. Edit controls may be inspected without
saving. Do not copy credentials or browser state into a public package.

The recorder keeps browser request handling active during video encoding so
authentication can refresh normally. It waits for visible artwork and content, omits route-loading gaps,
and encodes WebM videos plus WebP screenshots and posters. Each package includes
checksums, source provenance, actual data mode, and route coverage. The script
rejects runtime errors and missing main routes in a full capture.

For a focused local check:

```sh
npm run capture:demo:account --workspace apps/web -- --flows raid,max,pvp --themes dark --viewports mobile
```

`--skip-build` reuses the existing production build and is intended for capture
script development. Partial runs are diagnostic packages, not complete showcase
replacements. Freeze app and capture source during a full recording run.

If a run is interrupted, resume it without recapturing completed scenarios:

```sh
npm run capture:demo:account --workspace apps/web -- --resume /absolute/path/to/.artifacts/account-media/run-directory
```

The recorder verifies the app source, production build, account, and completed
asset checksums before resuming. Capture-script changes are recorded as separate
attempts; an app or build change requires a fresh run. If the server rejects an
expired session, run the sign-in command again, then resume. The app’s source and
build fingerprint remain constant across attempts, and each flow records its
capture-script source fingerprint.

The complete package path is written to
`apps/web/.artifacts/account-media/latest-package.txt`. In Phlosion:

```sh
npm run import:nexus:media -- /absolute/path/to/package
npm run verify
npm run test:e2e -- tests/e2e/nexus-media.spec.ts tests/e2e/product-showcase.spec.ts
```

Inspect both layouts and themes before publishing, especially All/My scope,
complete team results, public artwork, public share URLs, and account masking.
Keep the distinction between browser footage and native release evidence visible.
