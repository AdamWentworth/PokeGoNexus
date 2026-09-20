import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const frontendDirectory = path.resolve(import.meta.dirname, '../..');
const read = (file) => readFileSync(path.resolve(frontendDirectory, file), 'utf8');
const contract = JSON.parse(read('performance-parity/contract.json'));
const browserCollector = read('apps/web/tests/browser/performance-parity-report.spec.ts');
const androidReporter = read('apps/mobile/scripts/build-android-performance-report.mjs');
const nativeAuthSources = [
  read('apps/mobile/src/screens/NativeLoginScreen.tsx'),
  read('apps/mobile/src/components/NativePasswordResetOverlay.tsx'),
  read('apps/mobile/src/screens/NativePasswordResetScreen.tsx'),
  read('apps/mobile/src/screens/NativeRegisterScreen.tsx'),
].join('\n');

const requiredAuthInteractions = [
  ['interaction.auth.login.password-visibility', 'auth_login_password_visibility_painted'],
  ['interaction.auth.recovery.open', 'auth_recovery_open_painted'],
  ['interaction.auth.recovery.request-result', 'auth_recovery_request_result_painted'],
  ['interaction.auth.registration.method-result', 'auth_registration_method_painted'],
  ['interaction.auth.registration.step-result', 'auth_registration_step_painted'],
  ['interaction.auth.registration.same-name-result', 'auth_registration_same_name_painted'],
  ['interaction.auth.password-reset.result', 'auth_password_reset_result_painted'],
];

test('every bounded authentication interaction has Vite and native performance evidence', () => {
  const interactions = new Map(contract.interactions.map((entry) => [entry.id, entry]));
  for (const [scenarioId, nativeEvent] of requiredAuthInteractions) {
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
    assert.ok(nativeAuthSources.includes(nativeEvent), `${nativeEvent} native paint trace`);
  }
});
