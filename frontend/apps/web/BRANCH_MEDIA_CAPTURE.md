# Migration branch media

Run from `frontend`:

```sh
npm run capture:demo:branch --workspace apps/web
```

This builds the current checkout in production mode with fixture APIs on loopback,
then captures the real responsive web interface. It never signs into production.
Install workspace dependencies and Playwright Chromium first. The runner uses the
existing `ffmpeg-static` and `sharp` dependencies. Set `BRANCH_MEDIA_PORT` to change
the default port, 3014. No pre-existing server is reused.

The complete run covers 13 feature clips plus public/reference screenshots in
each of four combinations: dark/light and desktop (1440 × 900)/mobile (412 × 915).
Screenshots wait for visible artwork, fonts, and route readiness. Clips omit setup
and loading gaps between routes, with source segment timestamps in the manifest.
Runtime/console errors and unhandled fixture API calls fail
the run. Actual map tiles are cached according to their HTTP cache lifetime.

| Area | Routes and captured states |
| --- | --- |
| Home | Guest landing, signed-in dashboard, quick navigation |
| Collection | `/pokemon`, tags/caught instances, instance overlay and edit form, `/pokemon/:username` |
| Discovery | `/search`, trainer results, Pokemon/location filters, list and map |
| Pokédex | `/pokedex`, regional registration view and species search |
| Battles | `/raid`, boss counters, `/max`, boss teams and party, `/pvp`, team builder and IV rank |
| Community | `/rankings`, most wanted, rarest owned, filtered results |
| Trades | `/trades`, preferences, activity and pending exchange; `/trade-board`, `/trade-board/:username` |
| Trainers | `/profile`, `/profile/:username`, `/profile/friends` |
| Account | `/settings`, `/settings/account`; `/account` and `/friends` redirect assertions |
| Onboarding | `/getting-started`, `/faq`, `/help`, `/about`, `/login`, `/register`, `/reset-password` |
| Reference | Raid/PvP methodology, safety, privacy, terms, data deletion, incomplete email verification link, missing route |

The runner reads route declarations from `App.tsx` and refuses to package a matrix
with an uncovered route. Adding a route therefore requires adding a capture.
Aliases share their destination screenshots. Public trainer routes use NexusDemo.
An incomplete email verification link is deliberately captured; the footage does
not claim a successful email delivery, registration, account deletion, or live
backend transaction. Battle and community data are fixtures, not live rankings.

## Package and provenance

Each run gets a separate directory under `.artifacts/branch-media/`. A successful
run writes `latest-package.txt` with the absolute package path. Only `package/`
is intended for copying into a presentation repository. It contains WebM clips,
WebP posters/screenshots, and `manifest.json` with:

- branch, commit, dirty status, and a SHA-256 fingerprint of checkout source/assets;
- production build fingerprint and capture timestamp;
- routes, renderer, theme/viewport dimensions, and successful flow evidence;
- filenames, sizes, and checksums for every media asset.

Source changes during a run invalidate the package. Failed runs retain diagnostic
artifacts and never update `latest-package.txt`. Original PNGs and incomplete raw
videos stay in ignored artifact directories for inspection. Phlosion consumes a
copy at `public/products/pokemon-go-nexus/demo/migration-preview/`; its media test
checks every declared file against this manifest.

## Map configuration

CARTO's raster basemaps now require a project key:
<https://carto.com/basemaps/apikey/>. Set `VITE_CARTO_BASEMAP_API_KEY` at build time
to retain the themed CARTO maps. This is a browser-visible tile key. Without one,
both Search and the coordinate picker use the standard OpenStreetMap map with
non-collapsible attribution. Its service policy applies:
<https://operations.osmfoundation.org/policies/tiles/>.

The capture build serves repository artwork from its own origin; it does not
depend on production image CORS headers. This does not change production asset
hosting. `E2E_ASSET_ORIGIN` is also available to other browser runs.

## Native status

These are **responsive web preview** recordings from the native migration branch,
not Android/iOS recordings. They do not replace the physical-device, standalone
build, trade workflow, or iOS gates in
[`CURRENT_NATIVE_TESTING_STATUS.md`](../mobile/CURRENT_NATIVE_TESTING_STATUS.md).
The production mobile default remains the WebView shell. Capture physical native
footage after those gates pass and give it separate renderer/build provenance.
