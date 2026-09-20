import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pngjs from 'pngjs';

const { PNG } = pngjs;
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const mobileDirectory = resolve(scriptDirectory, '..');
const workspaceDirectory = resolve(mobileDirectory, '../..');
const canonicalDirectory = resolve(workspaceDirectory, 'apps/web/.artifacts/demo-media');
const nativeDirectory = resolve(mobileDirectory, '.artifacts/native-web-parity');
const outputDirectory = resolve(mobileDirectory, '.artifacts/native-parity-contact-sheets');

const references = [
  ['home-authenticated-mobile', 'home-authenticated-mobile', 'home-initial'],
  ['home-guest-mobile', 'home-guest-mobile', 'home-guest-1-initial'],
  ['action-menu-mobile', 'action-menu-mobile', 'action-menu'],
  ['collection-catalog-mobile', 'collection-catalog-mobile', 'collection-catalog'],
  ['collection-tags-mobile', 'collection-tags-mobile', 'collection-tags'],
  ['collection-wishlist-tags-mobile', 'collection-wishlist-tags-mobile', 'collection-wishlist-tags'],
  ['collection-desktop', 'collection-desktop', 'desktop-collection'],
  ['collection-instance-overlay', 'collection-instance-overlay', 'desktop-collection-instance-0006-default_demo-charizard'],
  ['collection-trade-overlay-mobile', 'collection-trade-overlay-mobile', 'collection-instance-0025-party_hat_default_demo-trade-initial'],
  ['collection-wanted-overlay-mobile', 'collection-wanted-overlay-mobile', 'collection-instance-0094-default_demo-wanted-initial'],
  ['search-results-mobile', 'search-results-mobile', 'search-initial'],
  ['search-filters-mobile', 'search-filters-mobile', 'search-filters'],
  ['search-filters-location-mobile', 'search-filters-location-mobile', 'search-filters-location'],
  ['search-results-list', 'search-results-list', 'desktop-search'],
  ['search-results-map', 'search-results-map', 'desktop-search-results-map'],
  ['trade-preferences-mobile', 'trade-preferences-mobile', 'trade-preferences-initial'],
  ['trade-activity-mobile', 'trade-activity-mobile', 'trade-activity-canonical-1-initial'],
  ['trainer-profile-mobile', 'trainer-profile-mobile', 'profile-initial'],
  ['friends-mobile', 'friends-mobile', 'friends-initial'],
  ['trainer-settings-mobile', 'trainer-settings-mobile', 'settings-initial'],
  ['account-security-mobile', 'account-security-mobile', 'account-initial'],
  ['login-mobile', 'login-mobile', 'login-initial'],
  ['registration-mobile', 'registration-mobile', 'public-page-register-initial'],
  ['password-reset-mobile', 'password-reset-mobile', 'public-page-reset-confirm-initial'],
  ['getting-started-mobile', 'getting-started-mobile', 'public-initial'],
  ['help-mobile', 'help-mobile', 'public-page-help-initial'],
  ['faq-mobile', 'faq-mobile', 'public-page-faq-initial'],
  ['about-mobile', 'about-mobile', 'public-page-about-initial'],
  ['safety-mobile', 'safety-mobile', 'public-page-safety-initial'],
  ['privacy-mobile', 'privacy-mobile', 'public-page-privacy-initial'],
  ['terms-mobile', 'terms-mobile', 'public-page-terms-initial'],
  ['data-deletion-mobile', 'data-deletion-mobile', 'public-page-data-deletion-initial'],
  ['not-found-mobile', 'not-found-mobile', 'not-found-path-%2Fnative%2Fmissing-route-initial'],
  ['trade-board-mobile', 'trade-board-mobile', 'public-page-trade-board-initial'],
  ['pokedex-mobile', 'pokedex-mobile', 'tools-tool-pokedex-initial'],
  ['raid-mobile', 'raid-mobile', 'tools-tool-raid-initial'],
  ['max-mobile', 'max-mobile', 'tools-tool-max-initial'],
  ['pvp-mobile', 'pvp-mobile', 'tools-tool-pvp-initial'],
  ['rankings-mobile', 'rankings-mobile', 'tools-tool-rankings-initial'],
  ['raid-methodology-mobile', 'raid-methodology-mobile', 'public-page-raid-methodology-initial'],
  ['pvp-methodology-mobile', 'pvp-methodology-mobile', 'public-page-pvp-methodology-initial'],
];

const readPng = (path) => PNG.sync.read(readFileSync(path));

const compositePair = (canonical, native) => {
  const gutter = 8;
  const height = Math.min(canonical.height, native.height);
  const output = new PNG({
    width: canonical.width + native.width + gutter,
    height,
  });
  PNG.bitblt(canonical, output, 0, 0, canonical.width, height, 0, 0);
  PNG.bitblt(
    native,
    output,
    0,
    0,
    native.width,
    height,
    canonical.width + gutter,
    0,
  );
  return output;
};

mkdirSync(outputDirectory, { recursive: true });
for (const filename of readdirSync(outputDirectory)) {
  if (filename.endsWith('.png')) unlinkSync(join(outputDirectory, filename));
}

let created = 0;
const skipped = [];
for (const colorScheme of ['dark', 'light']) {
  for (const [label, canonicalStem, nativeStem] of references) {
    const canonicalSuffix = colorScheme === 'light' ? '-light' : '';
    const canonicalPath = join(canonicalDirectory, `${canonicalStem}${canonicalSuffix}.png`);
    const nativePath = join(nativeDirectory, `${colorScheme}-${nativeStem}.png`);
    if (!existsSync(canonicalPath) || !existsSync(nativePath)) continue;

    const canonical = readPng(canonicalPath);
    const native = readPng(nativePath);
    if (canonical.width !== native.width) {
      skipped.push(
        `${colorScheme}-${label}: canonical ${canonical.width}x${canonical.height}, `
        + `native ${native.width}x${native.height}`,
      );
      continue;
    }
    const outputPath = join(outputDirectory, `${colorScheme}-${label}.png`);
    const pair = compositePair(canonical, native);
    writeFileSync(outputPath, PNG.sync.write(pair));
    created += 1;
  }
}

if (created === 0) {
  throw new Error('No canonical/native screenshot pairs were available. Run both capture suites first.');
}

process.stdout.write(
  `Created ${created} canonical-left/native-right parity sheets in ${outputDirectory}.\n`,
);
if (skipped.length > 0) {
  process.stdout.write(`Skipped dimension-mismatched references:\n- ${skipped.join('\n- ')}\n`);
}
