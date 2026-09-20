#!/usr/bin/env node

import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const frontendDirectory = resolve(import.meta.dirname, '../..');
const artifactDirectory = resolve(frontendDirectory, '.artifacts/performance-parity');
const referenceReport = resolve(artifactDirectory, 'vite-browser-proxy.json');
const candidateReport = resolve(artifactDirectory, 'native-web-browser-proxy.json');
const resultReport = resolve(artifactDirectory, 'browser-proxy-result.json');
mkdirSync(artifactDirectory, { recursive: true });

const environment = {
  ...process.env,
  POKEGONEXUS_PERFORMANCE_REPORT: referenceReport,
};
if (!environment.E2E_CHROMIUM_EXECUTABLE_PATH && existsSync('/usr/bin/google-chrome')) {
  environment.E2E_CHROMIUM_EXECUTABLE_PATH = '/usr/bin/google-chrome';
}

const run = (command, args, env = environment) => {
  const result = spawnSync(command, args, {
    cwd: frontendDirectory,
    env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
};

run('npm', ['--workspace', 'apps/web', 'run', 'performance:parity:report']);
run('npm', ['--workspace', 'apps/mobile', 'run', 'parity:routes:web:performance'], {
  ...environment,
  POKEGONEXUS_PERFORMANCE_REPORT: candidateReport,
});
run('node', [
  'scripts/performance-parity/compare.mjs',
  '--reference', referenceReport,
  '--candidate', candidateReport,
  '--profile', 'browser-proxy',
  '--output', resultReport,
]);
