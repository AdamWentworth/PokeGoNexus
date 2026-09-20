import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const frontendDirectory = path.resolve(import.meta.dirname, '../..');
const read = (file) => readFileSync(path.resolve(frontendDirectory, file), 'utf8');
const contract = JSON.parse(read('performance-parity/contract.json'));
const browserCollector = read('apps/web/tests/browser/performance-parity-report.spec.ts');
const androidReporter = read('apps/mobile/scripts/build-android-performance-report.mjs');
const nativeTradeBoardScreen = read('apps/mobile/src/screens/NativeTradeBoardScreen.tsx');
const nativePerformanceFlow = read('apps/mobile/.maestro/native-trade-board-performance-smoke.yaml');

const requiredTradeBoardInteractions = [
  ['interaction.trade-board.section-result', 'trade_board_section_result_painted'],
  ['interaction.trade-board.theme-result', 'trade_board_theme_result_painted'],
  ['interaction.trade-board.identity-result', 'trade_board_identity_result_painted'],
  ['interaction.trade-board.copy-result', 'trade_board_copy_result_painted'],
];

test('every bounded Trade Board interaction has Vite and physical-native evidence', () => {
  const interactions = new Map(contract.interactions.map((entry) => [entry.id, entry]));
  for (const [scenarioId, nativeEvent] of requiredTradeBoardInteractions) {
    assert.equal(interactions.get(scenarioId)?.nativeEvent, nativeEvent, `${scenarioId} contract mapping`);
    assert.match(
      browserCollector,
      new RegExp(`['"]${scenarioId.replaceAll('.', '\\.')}['"]`),
      `${scenarioId} Vite measurement`,
    );
    assert.match(
      androidReporter,
      new RegExp(`${nativeEvent}: ['"]${scenarioId.replaceAll('.', '\\.')}['"]`),
      `${scenarioId} Android report mapping`,
    );
    assert.ok(nativeTradeBoardScreen.includes(nativeEvent), `${nativeEvent} native paint trace`);
  }
  assert.match(nativePerformanceFlow, /performance=1/);
  assert.match(nativePerformanceFlow, /native-trade-board-section-wanted/);
  assert.match(nativePerformanceFlow, /native-trade-board-theme-brand-light/);
  assert.match(nativePerformanceFlow, /native-trade-board-show-pokemon-go-name/);
  assert.match(nativePerformanceFlow, /Copy live link/);
});

test('public profile, public collection, and public Trade Board are guest route contracts', () => {
  const routes = new Map(contract.routes.map((route) => [route.id, route]));
  assert.deepEqual(routes.get('route.profile.public'), {
    id: 'route.profile.public',
    auth: 'guest',
    vite: '/profile/NexusFriend',
    native: '/native/profile/NexusFriend',
  });
  assert.deepEqual(routes.get('route.collection.public'), {
    id: 'route.collection.public',
    auth: 'guest',
    vite: '/pokemon/NexusFriend?filter=trade',
    native: '/native/collection/trainer/NexusFriend?filter=trade',
  });
  assert.deepEqual(routes.get('route.trade-board.public'), {
    id: 'route.trade-board.public',
    auth: 'guest',
    vite: '/trade-board/NexusFriend',
    native: '/native/trade-board/NexusFriend',
  });
});
