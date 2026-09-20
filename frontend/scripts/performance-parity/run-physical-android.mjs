#!/usr/bin/env node

import { existsSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const frontendDirectory = resolve(import.meta.dirname, '../..');
const artifactDirectory = resolve(frontendDirectory, '.artifacts/performance-parity');
const viteReport = resolve(artifactDirectory, 'vite-physical-android.json');
const nativeArtifactDirectory = resolve(
  frontendDirectory,
  'apps/mobile/.artifacts/performance-parity/native-android',
);
const nativeReport = resolve(nativeArtifactDirectory, 'native-android-performance.json');
const resultReport = resolve(artifactDirectory, 'physical-android-result.json');
const adb = process.env.ADB_BIN?.trim() || resolve(
  process.env.ANDROID_SDK_ROOT?.trim()
    || process.env.ANDROID_HOME?.trim()
    || resolve(os.homedir(), 'Android/Sdk'),
  'platform-tools/adb',
);

const parseArgs = (values) => {
  const parsed = new Map();
  for (let index = 0; index < values.length; index += 1) {
    const name = values[index];
    const value = values[index + 1];
    if (!name?.startsWith('--') || !value || value.startsWith('--')) {
      throw new Error(`Expected --name value, received ${name ?? 'nothing'}.`);
    }
    parsed.set(name, value);
    index += 1;
  }
  return parsed;
};

const run = (command, args, environment = process.env, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: frontendDirectory,
    env: environment,
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: options.capture ? 'utf8' : undefined,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = options.capture
      ? `${result.stdout ?? ''}${result.stderr ?? ''}`.trim()
      : '';
    throw new Error(detail || `${command} exited with status ${result.status}.`);
  }
  return options.capture ? String(result.stdout ?? '') : '';
};

const args = parseArgs(process.argv.slice(2));
const apk = resolve(
  args.get('--apk')
    || process.env.POKEGONEXUS_ANDROID_APK?.trim()
    || '',
);
if (!existsSync(adb)) throw new Error(`ADB was not found at ${adb}.`);
if (!args.get('--apk') && !process.env.POKEGONEXUS_ANDROID_APK?.trim()) {
  throw new Error(
    'A standalone performance APK is required. Pass --apk <file> or set POKEGONEXUS_ANDROID_APK.',
  );
}
if (!existsSync(apk)) throw new Error(`Performance APK does not exist: ${apk}`);

const devices = run(adb, ['devices'], process.env, { capture: true })
  .split(/\r?\n/)
  .map((line) => line.trim().split(/\s+/))
  .filter((parts) => parts.length >= 2 && parts[1] === 'device')
  .map(([id]) => id)
  .filter((id) => !id.startsWith('emulator-'));
const requestedDevice = args.get('--device')
  || process.env.POKEGONEXUS_ANDROID_DEVICE_ID?.trim();
const device = requestedDevice || (devices.length === 1 ? devices[0] : null);
if (!device || !devices.includes(device)) {
  throw new Error(
    devices.length === 0
      ? 'Connect and authorize one physical Android phone before running the parity suite.'
      : `Choose one physical phone with --device <id>. Connected: ${devices.join(', ')}`,
  );
}
const qemu = run(adb, ['-s', device, 'shell', 'getprop', 'ro.kernel.qemu'], process.env, {
  capture: true,
}).trim();
if (qemu === '1') throw new Error(`Emulator ${device} cannot produce release parity evidence.`);

mkdirSync(dirname(viteReport), { recursive: true });
mkdirSync(nativeArtifactDirectory, { recursive: true });
const commonEnvironment = {
  ...process.env,
  ADB_BIN: adb,
  POKEGONEXUS_ANDROID_DEVICE_ID: device,
  POKEGONEXUS_PERFORMANCE_SAMPLES: process.env.POKEGONEXUS_PERFORMANCE_SAMPLES || '5',
};
const originalStayAwake = run(adb, [
  '-s', device, 'shell', 'settings', 'get', 'global', 'stay_on_while_plugged_in',
], process.env, { capture: true }).trim();

try {
  run(adb, [
    '-s', device, 'shell', 'settings', 'put', 'global', 'stay_on_while_plugged_in', '2',
  ]);
  run(adb, ['-s', device, 'shell', 'input', 'keyevent', 'KEYCODE_WAKEUP']);
  run(adb, ['-s', device, 'shell', 'wm', 'dismiss-keyguard']);
  const windowState = run(adb, [
    '-s', device, 'shell', 'dumpsys', 'window',
  ], process.env, { capture: true });
  if (/isKeyguardShowing=true|mDreamingLockscreen=true/.test(windowState)) {
    throw new Error(
      'Unlock the physical phone before running parity; its secure keyguard cannot be dismissed through ADB.',
    );
  }
  run('npm', ['--workspace', 'apps/web', 'run', 'performance:parity:report:android'], {
    ...commonEnvironment,
    POKEGONEXUS_PERFORMANCE_REPORT: viteReport,
    POKEGONEXUS_PERFORMANCE_WORKFLOWS_ONLY: 'true',
  });
  run('npm', ['--workspace', 'apps/mobile', 'run', 'performance:parity:android:release'], {
    ...commonEnvironment,
    POKEGONEXUS_ANDROID_APK: apk,
    POKEGONEXUS_SMOKE_ARTIFACT_DIR: nativeArtifactDirectory,
  });
  run(process.execPath, [
    'scripts/performance-parity/compare.mjs',
    '--reference', viteReport,
    '--candidate', nativeReport,
    '--profile', 'physical-android',
    '--output', resultReport,
  ], commonEnvironment);
} finally {
  spawnSync(adb, ['-s', device, 'forward', '--remove', 'tcp:9222'], {
    cwd: frontendDirectory,
    stdio: 'ignore',
  });
  spawnSync(adb, ['-s', device, 'reverse', '--remove', 'tcp:3100'], {
    cwd: frontendDirectory,
    stdio: 'ignore',
  });
  const restoreStayAwakeArgs = originalStayAwake === 'null' || originalStayAwake === ''
    ? ['-s', device, 'shell', 'settings', 'delete', 'global', 'stay_on_while_plugged_in']
    : ['-s', device, 'shell', 'settings', 'put', 'global', 'stay_on_while_plugged_in', originalStayAwake];
  spawnSync(adb, restoreStayAwakeArgs, {
    cwd: frontendDirectory,
    stdio: 'ignore',
  });
}
