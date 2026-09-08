#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const webRoot = path.resolve(import.meta.dirname, '..');
const repoRoot = path.resolve(webRoot, '../../..');
const git = (...args) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
const sha = (data) => createHash('sha256').update(data).digest('hex');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const output = path.join(webRoot, '.artifacts/branch-media', stamp);
const packageDir = path.join(output, 'package');
const port = process.env.BRANCH_MEDIA_PORT ?? '3014';
if (!/^\d+$/.test(port) || Number(port) < 1024 || Number(port) > 65535)
  throw new Error('Invalid BRANCH_MEDIA_PORT');

function sourceIdentity() {
  const files = git(
    'ls-files',
    '--cached',
    '--others',
    '--exclude-standard',
    '--',
    'frontend/apps/web',
    'frontend/packages',
    'frontend/package.json',
    'frontend/package-lock.json',
    'assets',
  )
    .split('\n')
    .filter(Boolean)
    .sort();
  return sha(
    files
      .map(
        (file) =>
          `${file}\0${fs.existsSync(path.join(repoRoot, file)) ? sha(fs.readFileSync(path.join(repoRoot, file))) : 'deleted'}`,
      )
      .join('\n'),
  );
}

function treeFiles(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory() ? treeFiles(path.join(dir, entry.name)) : [path.join(dir, entry.name)],
    )
    .sort();
}

fs.mkdirSync(output, { recursive: true });
const source = {
  branch: git('branch', '--show-current'),
  commit: git('rev-parse', 'HEAD'),
  dirty: Boolean(git('status', '--porcelain')),
  sourceSha256: sourceIdentity(),
};
// Force a fresh production web build on loopback; never inherit live API/base URL
// or dev-server settings from a caller's environment.
const env = { ...process.env };
for (const key of Object.keys(env))
  if (key.startsWith('E2E_') || key.startsWith('BRANCH_MEDIA_')) delete env[key];
Object.assign(env, {
  BRANCH_MEDIA_CAPTURE: '1',
  BRANCH_MEDIA_OUTPUT: output,
  E2E_PORT: port,
  E2E_FAIL_ON_CONSOLE: '1',
  E2E_ASSET_ORIGIN: `http://127.0.0.1:${port}`,
  CI: '1',
});
const result = spawnSync(
  process.execPath,
  [
    'scripts/run-playwright-clean-env.mjs',
    'test',
    'tests/browser/branch-media-capture.spec.ts',
    '--project=chromium-desktop',
    '--workers=2',
    '--reporter=list',
  ],
  { cwd: webRoot, env, stdio: 'inherit' },
);
if (result.error) throw result.error;
if (result.status !== 0)
  throw new Error(`Capture failed. Incomplete evidence retained at ${output}`);
if (source.sourceSha256 !== sourceIdentity())
  throw new Error('Source changed during capture; rerun for a consistent package.');

const evidence = fs
  .readdirSync(path.join(output, 'evidence'))
  .sort()
  .map((file) => JSON.parse(fs.readFileSync(path.join(output, 'evidence', file), 'utf8')));
const appSource = fs.readFileSync(
  path.join(repoRoot, 'frontend/packages/app-core/src/App.tsx'),
  'utf8',
);
const routes = [...appSource.matchAll(/<Route\s+path="([^"]+)"/g)].map((match) => match[1]);
const aliases = { '/account': '/settings/account', '/friends': '/profile/friends' };
const routeFor = (route) =>
  route === '/missing-reference-route' ? '*' : route.replace('/NexusDemo', '/:username');
for (const theme of ['dark', 'light'])
  for (const viewport of ['desktop', 'mobile']) {
    const entries = evidence.filter(
      (entry) => entry.theme === theme && entry.viewport === viewport,
    );
    if (entries.length !== 14 || entries.some((entry) => entry.runtimeErrors.length))
      throw new Error(`Incomplete ${theme}/${viewport} flow coverage`);
    const covered = new Set(
      entries.flatMap((entry) => entry.shots.map((shot) => routeFor(shot.route))),
    );
    const missing = routes.filter((route) => !covered.has(aliases[route] ?? route));
    if (missing.length)
      throw new Error(`Missing ${theme}/${viewport} routes: ${missing.join(', ')}`);
  }

const assets = [];
for (const dir of ['screenshots', 'posters', 'videos']) {
  fs.mkdirSync(path.join(packageDir, dir), { recursive: true });
  for (const file of fs.readdirSync(path.join(output, dir)).sort()) {
    const relative = `${dir}/${file.replace(/\.png$/, '.webp')}`;
    const destination = path.join(packageDir, relative);
    if (file.endsWith('.png'))
      await sharp(path.join(output, dir, file))
        .webp({ quality: 88, effort: 5 })
        .toFile(destination);
    else fs.copyFileSync(path.join(output, dir, file), destination);
    const bytes = fs.readFileSync(destination);
    assets.push({ file: relative, bytes: bytes.length, sha256: sha(bytes) });
  }
}
const manifest = {
  schemaVersion: 1,
  capturedAt: new Date().toISOString(),
  source,
  renderer: 'responsive-web',
  buildMode: 'e2e-production',
  buildSha256: sha(
    treeFiles(path.join(webRoot, 'dist'))
      .map((file) => `${path.relative(webRoot, file)}\0${sha(fs.readFileSync(file))}`)
      .join('\n'),
  ),
  data: 'Synthetic demo accounts and fixture APIs; real product UI and artwork; externally served map tiles.',
  limitations: [
    'Browser captures do not certify native Android/iOS behavior or backend integration.',
    'Native preview remains subject to physical-device release gates.',
    'Email verification shows an incomplete-link state. Account media reviews settings without registering or deleting accounts.',
  ],
  routes,
  aliases,
  themes: ['dark', 'light'],
  viewports: { desktop: { width: 1440, height: 900 }, mobile: { width: 412, height: 915 } },
  flows: evidence.map((entry) => ({
    ...entry,
    shots: entry.shots.map((shot) => ({ ...shot, file: shot.file.replace(/\.png$/, '.webp') })),
  })),
  assets,
};
fs.writeFileSync(path.join(packageDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
fs.writeFileSync(
  path.join(webRoot, '.artifacts/branch-media/latest-package.txt'),
  `${packageDir}\n`,
);
console.log(
  `Verified ${routes.length} routes, ${evidence.length} theme/viewport scenarios, ${assets.length} assets.\nPackage: ${packageDir}`,
);
