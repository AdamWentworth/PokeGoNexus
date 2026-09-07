import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const frontendDirectory = path.resolve(import.meta.dirname, '../..');
const contract = JSON.parse(readFileSync(
  path.resolve(frontendDirectory, 'performance-parity/contract.json'),
  'utf8',
));
const browserCollector = readFileSync(
  path.resolve(frontendDirectory, 'apps/web/tests/browser/performance-parity-report.spec.ts'),
  'utf8',
);
const androidReporter = readFileSync(
  path.resolve(frontendDirectory, 'apps/mobile/scripts/build-android-performance-report.mjs'),
  'utf8',
);
const viteImageStageStyles = readFileSync(
  path.resolve(frontendDirectory, 'packages/app-core/src/pages/Pokemon/features/instances/sections/ImageStage.css'),
  'utf8',
);
const viteWantedInstanceStyles = readFileSync(
  path.resolve(frontendDirectory, 'packages/app-core/src/pages/Pokemon/features/instances/WantedInstance.css'),
  'utf8',
);
const sharedExperienceContract = readFileSync(
  path.resolve(frontendDirectory, 'packages/shared-ui-tokens/src/experienceParity.ts'),
  'utf8',
);
const nativeLocationBackdrop = readFileSync(
  path.resolve(frontendDirectory, 'apps/mobile/src/features/collection/parity/NativePokemonLocationBackdrop.tsx'),
  'utf8',
);
const nativeCollectionSources = [
  'apps/mobile/src/features/collection/parity/NativeCollectionParityFixture.tsx',
  'apps/mobile/src/features/collection/parity/useNativeOverlaySwipeNavigation.ts',
  'apps/mobile/src/screens/NativeCollectionHubScreen.tsx',
  'apps/mobile/src/screens/NativeCollectionParityScreen.tsx',
  'apps/mobile/src/screens/NativeInstanceDetailScreen.tsx',
].map((file) => readFileSync(path.resolve(frontendDirectory, file), 'utf8')).join('\n');

const requiredCollectionInteractions = [
  ['interaction.collection.search-open', 'collection_search_menu_painted'],
  ['interaction.collection.sort-open', 'collection_sort_menu_painted'],
  ['interaction.collection.filter', 'collection_filter_result_revealed'],
  ['interaction.collection.tag-slide', 'collection_tag_touch_to_slide_started'],
  ['interaction.collection.tag-result', 'collection_tag_result_painted'],
  ['interaction.collection.query-result', 'collection_query_result_painted'],
  ['interaction.collection.typed-query', 'collection_typed_query_result_painted'],
  ['interaction.collection.sort-result', 'collection_sort_result_painted'],
  ['interaction.collection.evolution-result', 'collection_evolution_result_painted'],
  ['interaction.collection.clear-tag-dialog', 'collection_clear_tag_dialog_painted'],
  ['interaction.collection.selection', 'collection_selection_painted'],
  ['interaction.collection.organizer', 'collection_organizer_painted'],
  ['interaction.instance.navigate', 'instance_overlay_target_committed'],
  ['interaction.instance.edit-result', 'instance_edit_result_painted'],
  ['interaction.instance.save-result', 'instance_save_result_painted'],
];

test('every bounded Pokémon interaction has Vite and physical-native performance evidence', () => {
  const interactions = new Map(contract.interactions.map((entry) => [entry.id, entry]));
  for (const [scenarioId, nativeEvent] of requiredCollectionInteractions) {
    assert.equal(interactions.get(scenarioId)?.nativeEvent, nativeEvent, `${scenarioId} contract mapping`);
    assert.match(browserCollector, new RegExp(`['"]${scenarioId.replaceAll('.', '\\.')}['"]`), `${scenarioId} Vite measurement`);
    assert.match(androidReporter, new RegExp(`${nativeEvent}: ['"]${scenarioId.replaceAll('.', '\\.')}['"]`), `${scenarioId} Android report mapping`);
    assert.ok(nativeCollectionSources.includes(nativeEvent), `${nativeEvent} native paint trace`);
  }
});

test('native instance location backdrops stay pinned to Vite geometry and masking', () => {
  assert.match(viteImageStageStyles, /top:\s*-20px;/, 'Vite backdrop top crop');
  assert.match(viteImageStageStyles, /width:\s*min\(86vw,\s*447px\);/, 'Vite backdrop width');
  assert.match(
    viteImageStageStyles,
    /ellipse 57% 94% at 50% 56%,[\s\S]*?0\.98\) 52%,[\s\S]*?0\.9\) 64%,[\s\S]*?0\.6\) 76%,[\s\S]*?0\) 88%/,
    'Vite instance backdrop fade',
  );
  assert.match(viteImageStageStyles, /background-position:\s*center top;/, 'Vite top-aligned crop');
  assert.match(viteImageStageStyles, /rgba\(255, 255, 255, 0\.1\)[\s\S]*?70%/, 'Vite brightness layer');
  assert.match(viteWantedInstanceStyles, /--caught-image-stage-size:\s*238px;/, 'Vite wide wanted stage');
  assert.match(viteWantedInstanceStyles, /max-width:\s*600px[\s\S]*?--caught-image-stage-size:\s*185px;/, 'Vite phone wanted stage');
  assert.match(viteWantedInstanceStyles, /max-width:\s*370px[\s\S]*?--caught-image-stage-size:\s*168px;/, 'Vite narrow wanted stage');

  assert.match(sharedExperienceContract, /viewportWidthRatio:\s*0\.86/);
  assert.match(sharedExperienceContract, /maxWidth:\s*447/);
  assert.match(sharedExperienceContract, /cy:\s*'56%'[\s\S]*?rx:\s*'57%'[\s\S]*?ry:\s*'94%'/);
  assert.match(nativeLocationBackdrop, /variant === 'instance' \? contract\.instanceMask/);
  assert.match(nativeLocationBackdrop, /'xMidYMin slice'/);
  assert.match(nativeLocationBackdrop, /location-backdrop-brightness/);
});
