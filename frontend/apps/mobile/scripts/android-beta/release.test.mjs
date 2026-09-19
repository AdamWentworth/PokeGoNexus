import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { projectId, repository, validateCandidate, validatePublishedRelease } from './release.mjs';

const signature = 'a'.repeat(64);
const source = 'b'.repeat(40);
const build = {
  status: 'FINISHED', platform: 'ANDROID', distribution: 'INTERNAL', buildProfile: 'android-beta',
  app: { id: projectId }, gitCommitHash: source, appVersion: '1.0.3', appBuildVersion: '26091901',
};
const config = {
  version: '1.0.3', android: { versionCode: 26091901 },
  extra: {
    eas: { projectId }, mobile: { experienceMode: 'native-preview', deviceSmokeMode: false },
    observability: { appEnv: 'beta' }, api: { authApiUrl: 'https://pokegonexus.com/api/auth' },
  },
};
const badging = "package: name='com.pokegonexus.app' versionCode='26091901' versionName='1.0.3'\nnative-code: 'arm64-v8a'";
const certificate = `Signer #1 certificate DN: CN=PokeGoNexus\nSigner #1 certificate SHA-256 digest: ${signature}`;
const check = (b = build, c = config, apk = badging, cert = certificate, previous = { release: null }) =>
  validateCandidate(b, c, apk, cert, previous);

test('accepts a finished native beta and rejects development, smoke, iOS, and unsigned candidates', () => {
  assert.equal(check().versionCode, 26091901);
  for (const profile of ['development', 'device-preview', 'performance-android', 'production']) {
    assert.throws(() => check({ ...build, buildProfile: profile }));
  }
  assert.throws(() => check({ ...build, status: 'IN_PROGRESS' }));
  assert.throws(() => check({ ...build, platform: 'IOS' }));
  assert.throws(() => check(build, config, `${badging}\napplication-debuggable`));
  assert.throws(() => check(build, config, badging, certificate.replace('CN=PokeGoNexus', 'CN=Android Debug')));
  assert.throws(() => check(build, config, badging, ''));
  assert.throws(() => check(build, { ...config, extra: { ...config.extra, mobile: { ...config.extra.mobile, deviceSmokeMode: true } } }));
});

test('rejects a different package, backend, source, or version than the release claims', () => {
  assert.throws(() => check(build, config, badging.replace('com.pokegonexus.app', 'com.example.app')));
  assert.throws(() => check({ ...build, appBuildVersion: '26091902' }));
  assert.throws(() => check({ ...build, gitCommitHash: 'master' }));
  assert.throws(() => check({ ...build, app: { id: 'another-project' } }));
  assert.throws(() => check(build, { ...config, extra: { ...config.extra, api: { authApiUrl: 'http://localhost/auth' } } }));
});

test('protects install-over upgrades from reused versions and changed signing keys', () => {
  const previous = { release: { versionCode: 26091900 }, signingCertificateSha256: signature };
  assert.equal(check(build, config, badging, certificate, previous).versionCode, 26091901);
  assert.throws(() => check(build, config, badging, certificate, { ...previous, release: { versionCode: 26091901 } }));
  assert.throws(() => check(build, config, badging, certificate, { ...previous, signingCertificateSha256: 'c'.repeat(64) }));
  assert.throws(() => check(build, config, badging, certificate, { release: null, highestVersionCode: 26091901, signingCertificateSha256: signature }));
});

test('website activation requires the exact published beta artifact', () => {
  const tag = 'android-beta-26091901';
  const filename = 'PokeGoNexus-Android-26091901.apk';
  const url = `https://github.com/${repository}/releases/download/${tag}/${filename}`;
  const manifest = {
    sourceCommit: source,
    release: { versionCode: 26091901, downloadUrl: url, releaseNotesUrl: `https://github.com/${repository}/releases/tag/${tag}`, sha256: signature, sizeBytes: 1234 },
  };
  const release = { tag_name: tag, target_commitish: source, draft: false, prerelease: true, assets: [{ name: filename, browser_download_url: url, size: 1234 }] };
  assert.doesNotThrow(() => validatePublishedRelease(manifest, release, signature));
  assert.throws(() => validatePublishedRelease(manifest, { ...release, draft: true }, signature));
  assert.throws(() => validatePublishedRelease(manifest, { ...release, prerelease: false }, signature));
  assert.throws(() => validatePublishedRelease(manifest, { ...release, assets: [] }, signature));
  assert.throws(() => validatePublishedRelease(manifest, release, 'd'.repeat(64)));
  assert.throws(() => validatePublishedRelease(manifest, { ...release, target_commitish: 'master' }, signature));
});

test('Android beta uses managed signing and a standalone native APK with fixtures disabled', () => {
  const profiles = JSON.parse(readFileSync(new URL('../../eas.json', import.meta.url), 'utf8')).build;
  const beta = profiles['android-beta'];
  assert.equal(beta.extends, 'device-preview');
  assert.equal(profiles[beta.extends].distribution, 'internal');
  assert.equal(profiles[beta.extends].android.buildType, 'apk');
  assert.equal(beta.credentialsSource, 'remote');
  assert.equal(beta.developmentClient, false);
  assert.equal(beta.env.EXPO_PUBLIC_DEVICE_SMOKE_MODE, 'false');
  assert.equal(beta.env.EXPO_PUBLIC_MOBILE_EXPERIENCE, 'native-preview');
  assert.equal(profiles.production.env.EXPO_PUBLIC_MOBILE_EXPERIENCE, 'webview');
});
