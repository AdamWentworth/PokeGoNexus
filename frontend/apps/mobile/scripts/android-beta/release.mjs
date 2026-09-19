import assert from 'node:assert/strict';

export const repository = 'AdamWentworth/PokeGoNexus';
export const projectId = '2cfa50a9-11e0-454b-8147-45963ff70432';

export function validateCandidate(build, config, badging, certificate, previous) {
  assert.equal(build.status, 'FINISHED', 'EAS build must be finished');
  assert.equal(build.platform, 'ANDROID', 'Only Android builds can be distributed');
  assert.equal(build.distribution, 'INTERNAL');
  assert.equal(build.buildProfile, 'android-beta', 'Use the android-beta profile, not a development or smoke build');
  assert.equal(config.extra?.eas?.projectId, projectId);
  assert.equal(build.app?.id, projectId);
  assert.match(build.gitCommitHash, /^[a-f0-9]{40}$/, 'Build must identify its source commit');
  assert.equal(config.extra?.mobile?.experienceMode, 'native-preview');
  assert.equal(config.extra?.mobile?.deviceSmokeMode, false, 'Smoke fixtures must be disabled');
  assert.equal(config.extra?.observability?.appEnv, 'beta');
  for (const [name, value] of Object.entries(config.extra.api)) {
    assert.equal(new URL(value).origin, 'https://pokegonexus.com', `${name} must use the live service described on the download page`);
  }
  assert.match(badging, /package: name='com\.pokegonexus\.app'/);
  assert.doesNotMatch(badging, /application-debuggable/, 'APK must not be debuggable');
  const version = badging.match(/versionName='([^']+)'/)?.[1];
  const versionCode = Number(badging.match(/versionCode='(\d+)'/)?.[1]);
  assert.ok(Number.isSafeInteger(versionCode) && versionCode > 0);
  assert.equal(version, build.appVersion);
  assert.equal(String(versionCode), build.appBuildVersion);
  assert.equal(versionCode, config.android.versionCode);
  assert.equal(version, config.version);
  assert.doesNotMatch(certificate, /CN=Android Debug/i, 'Never distribute an APK signed with the debug key');
  const signingCertificateSha256 = certificate.match(/Signer #1 certificate SHA-256 digest: ([a-f0-9]{64})/i)?.[1]?.toLowerCase();
  assert.ok(signingCertificateSha256, 'APK signing certificate could not be verified');
  assert.match(badging, /native-code:.*'arm64-v8a'/, 'APK must support physical ARM64 phones');
  const highestVersionCode = previous.highestVersionCode ?? previous.release?.versionCode;
  if (highestVersionCode) {
    assert.ok(versionCode > highestVersionCode, 'Android update versionCode must increase');
    assert.equal(signingCertificateSha256, previous.signingCertificateSha256, 'Keep the same signing key for install-over updates');
  }
  return { version, versionCode, signingCertificateSha256 };
}

export function validatePublishedRelease(manifest, release, digest) {
  const tag = `android-beta-${manifest.release.versionCode}`;
  const filename = `PokeGoNexus-Android-${manifest.release.versionCode}.apk`;
  assert.equal(release.tag_name, tag);
  assert.equal(release.draft, false, 'Publish the tested draft before promoting its download');
  assert.equal(release.prerelease, true, 'Android testing builds must remain prereleases');
  assert.equal(release.target_commitish, manifest.sourceCommit);
  const asset = release.assets.find((item) => item.name === filename);
  assert.ok(asset, 'Published APK is missing');
  const url = `https://github.com/${repository}/releases/download/${tag}/${filename}`;
  assert.equal(asset.browser_download_url, url);
  assert.equal(manifest.release.downloadUrl, url);
  assert.equal(manifest.release.releaseNotesUrl, `https://github.com/${repository}/releases/tag/${tag}`);
  assert.equal(asset.size, manifest.release.sizeBytes);
  assert.equal(digest, manifest.release.sha256, 'Published APK differs from the tested candidate');
}
