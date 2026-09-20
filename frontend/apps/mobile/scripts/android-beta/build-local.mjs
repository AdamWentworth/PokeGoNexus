// EAS local builds reuse the managed release key without cloud build quota.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const mobile = fileURLToPath(new URL('../../', import.meta.url));
const git = (...args) => execFileSync('git', args, { cwd: mobile, encoding: 'utf8' }).trim();
assert.equal(git('status', '--porcelain'), '', 'Commit changes before building a beta');
const sourceCommit = git('rev-parse', 'HEAD');
const app = JSON.parse(await readFile(path.join(mobile, 'app.json'), 'utf8')).expo;
const directory = path.join(mobile, '.artifacts/android-beta-local', sourceCommit);
await mkdir(directory, { recursive: true });
const apkPath = path.join(directory, 'candidate.apk');
const args = ['build', '--platform', 'android', '--profile', 'android-beta', '--local', '--non-interactive', '--output', apkPath];
execFileSync(process.env.POKEGONEXUS_EAS_CLI || 'npx', process.env.POKEGONEXUS_EAS_CLI ? args : ['--yes', 'eas-cli@24.7.0', ...args], {
  cwd: mobile, stdio: 'inherit', env: process.env,
});
assert.equal(git('rev-parse', 'HEAD'), sourceCommit, 'Source changed during the build');
assert.equal(git('status', '--porcelain'), '', 'Source changed during the build');
const hash = createHash('sha256');
for await (const chunk of createReadStream(apkPath)) hash.update(chunk);
const receipt = {
  provider: 'local-eas', status: 'FINISHED', platform: 'ANDROID', distribution: 'INTERNAL', buildProfile: 'android-beta',
  app: { id: app.extra.eas.projectId }, gitCommitHash: sourceCommit,
  appVersion: app.version, appBuildVersion: String(app.android.versionCode),
  apkPath, sha256: hash.digest('hex'),
};
const receiptPath = path.join(directory, 'receipt.json');
await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
console.log(`Local signed candidate ready. Prepare a draft with:\nnode scripts/android-beta/prepare.mjs prepare-local ${receiptPath} /path/to/notes.md`);
