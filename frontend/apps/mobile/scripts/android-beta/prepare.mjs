// Prepare a draft only. Publishing and enabling the website download are separate steps.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { repository, validateCandidate, validatePublishedRelease } from './release.mjs';

const mobile = fileURLToPath(new URL('../../', import.meta.url));
const root = path.resolve(mobile, '../../..');
const websiteManifest = path.resolve(mobile, '../../packages/app-core/src/pages/Download/android-beta.json');
const run = (command, args, cwd = mobile) => execFileSync(command, args, {
  cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
}).trim();
const gh = (...args) => run('gh', args);
const eas = (...args) => process.env.POKEGONEXUS_EAS_CLI
  ? run(process.env.POKEGONEXUS_EAS_CLI, args)
  : run('npx', ['--yes', 'eas-cli@24.7.0', ...args]);

async function download(url, destination) {
  assert.equal(new URL(url).protocol, 'https:');
  const response = await fetch(url, { signal: AbortSignal.timeout(300_000) });
  assert.ok(response.ok && response.body, `Download failed: HTTP ${response.status}`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(destination));
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(destination)) hash.update(chunk);
  return hash.digest('hex');
}

const [mode, input, notesPath] = process.argv.slice(2);
assert.ok(mode === 'prepare' || mode === 'activate', 'Usage: prepare.mjs prepare <EAS build ID> <notes.md> | activate <candidate manifest.json>');

if (mode === 'activate') {
  const manifest = JSON.parse(await readFile(path.resolve(input), 'utf8'));
  assert.ok(Number.isSafeInteger(manifest.release.versionCode));
  assert.match(manifest.sourceCommit, /^[a-f0-9]{40}$/);
  const tag = `android-beta-${manifest.release.versionCode}`;
  const published = JSON.parse(gh('api', `repos/${repository}/releases/tags/${tag}`));
  assert.equal(published.draft, false, 'The beta must be published before the website can link to it');
  // An unmerged native branch may produce candidates, but the public website
  // only advertises APKs whose source has joined the shared master history.
  run('git', ['fetch', 'origin', 'master'], root);
  run('git', ['merge-base', '--is-ancestor', manifest.sourceCommit, 'origin/master'], root);
  const directory = path.join(mobile, '.artifacts/android-beta', String(manifest.release.versionCode));
  await mkdir(directory, { recursive: true });
  const url = `https://github.com/${repository}/releases/download/${tag}/PokeGoNexus-Android-${manifest.release.versionCode}.apk`;
  const digest = await download(url, path.join(directory, 'published-verification.apk'));
  validatePublishedRelease(manifest, published, digest);
  const previous = JSON.parse(await readFile(websiteManifest, 'utf8'));
  const highestVersionCode = previous.highestVersionCode ?? previous.release?.versionCode;
  if (highestVersionCode) {
    assert.ok(manifest.release.versionCode >= highestVersionCode, 'Do not advertise an Android downgrade');
    assert.equal(manifest.signingCertificateSha256, previous.signingCertificateSha256);
  }
  manifest.release.publishedAt = published.published_at.slice(0, 10);
  await writeFile(websiteManifest, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log('Verified published APK. Website manifest updated; review, commit, and deploy the web change separately.');
} else {
  assert.match(input ?? '', /^[a-f0-9-]{36}$/i, 'Provide an EAS build ID');
  const notes = await readFile(path.resolve(notesPath), 'utf8');
  assert.ok(notes.trim(), 'Provide release notes, including known limitations and device checks');
  const build = JSON.parse(eas('build:view', input, '--json'));
  assert.equal(build.buildProfile, 'android-beta', 'Select an android-beta build');
  assert.equal(build.status, 'FINISHED');
  assert.match(build.gitCommitHash, /^[a-f0-9]{40}$/);
  run('git', ['cat-file', '-e', `${build.gitCommitHash}^{commit}`], root);
  const versionCode = Number(build.appBuildVersion);
  assert.ok(Number.isSafeInteger(versionCode) && versionCode > 0);
  const directory = path.join(mobile, '.artifacts/android-beta', String(versionCode));
  await mkdir(directory, { recursive: true });
  const filename = `PokeGoNexus-Android-${versionCode}.apk`;
  const apk = path.join(directory, filename);
  const sha256 = await download(build.artifacts.applicationArchiveUrl, apk);
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  assert.ok(sdk, 'Set ANDROID_HOME to an Android SDK with build-tools');
  const versions = (await readdir(path.join(sdk, 'build-tools'))).filter((v) => /^\d+\.\d+\.\d+$/.test(v));
  const version = versions.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).at(-1);
  assert.ok(version, 'Android SDK build-tools are required to verify the APK');
  const tool = (name) => path.join(sdk, 'build-tools', version, name);
  const badging = run(tool('aapt'), ['dump', 'badging', apk]);
  const certificate = run(tool('apksigner'), ['verify', '--print-certs', apk]);
  const config = JSON.parse(run('unzip', ['-p', apk, 'assets/app.config']));
  const previous = JSON.parse(await readFile(websiteManifest, 'utf8'));
  const verified = validateCandidate(build, config, badging, certificate, previous);
  const tag = `android-beta-${versionCode}`;
  const manifest = {
    release: {
      version: verified.version, versionCode, publishedAt: null,
      downloadUrl: `https://github.com/${repository}/releases/download/${tag}/${filename}`,
      releaseNotesUrl: `https://github.com/${repository}/releases/tag/${tag}`,
      sha256, sizeBytes: (await stat(apk)).size,
    },
    sourceCommit: build.gitCommitHash,
    highestVersionCode: versionCode,
    easBuildId: build.id,
    signingCertificateSha256: verified.signingCertificateSha256,
  };
  const manifestPath = path.join(directory, 'android-beta.json');
  const checksumPath = path.join(directory, 'SHA256SUMS');
  const releaseNotesPath = path.join(directory, 'release-notes.md');
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(checksumPath, `${sha256}  ${filename}\n`);
  await writeFile(releaseNotesPath, `${notes.trim()}\n\nSource: ${build.gitCommitHash}\nEAS build: ${build.id}\n`);
  // gh refuses a duplicate tag; never overwrite a previously distributed APK.
  const url = gh('release', 'create', tag, apk, checksumPath, manifestPath,
    '--repo', repository, '--target', build.gitCommitHash, '--draft', '--prerelease', '--latest=false',
    '--title', `Android beta ${verified.version} (${versionCode})`, '--notes-file', releaseNotesPath);
  console.log(`Draft prepared: ${url}\nCandidate manifest: ${manifestPath}\nTest this exact APK before publishing the draft.`);
}
