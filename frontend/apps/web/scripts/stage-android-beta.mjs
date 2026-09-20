import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

export async function stageAndroidBeta({ manifest, directory, fetchAsset = fetch }) {
  const release = manifest.release;
  if (!release) return null;
  assert.ok(Number.isSafeInteger(release.versionCode) && release.versionCode > 0);
  assert.ok(Number.isSafeInteger(release.sizeBytes) && release.sizeBytes > 0);
  assert.match(release.sha256, /^[a-f0-9]{64}$/);
  const filename = `PokeGoNexus-Android-${release.versionCode}.apk`;
  const expectedUrl = `https://github.com/AdamWentworth/PokeGoNexus/releases/download/android-beta-${release.versionCode}/${filename}`;
  assert.equal(release.downloadUrl, expectedUrl, 'Stage only the pinned public release asset');

  const destination = path.join(directory, 'downloads', 'android', filename);
  const partial = `${destination}.partial`;
  await mkdir(path.dirname(destination), { recursive: true });
  try {
    const response = await fetchAsset(expectedUrl, { signal: AbortSignal.timeout(300_000) });
    assert.ok(response.ok && response.body, `APK download failed: HTTP ${response.status}`);
    await pipeline(Readable.fromWeb(response.body), createWriteStream(partial));
    assert.equal((await stat(partial)).size, release.sizeBytes, 'APK size differs from the tested release');
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(partial)) hash.update(chunk);
    assert.equal(hash.digest('hex'), release.sha256, 'APK checksum differs from the tested release');
    await rename(partial, destination);
    return destination;
  } finally {
    await rm(partial, { force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = JSON.parse(await readFile(new URL('../../../packages/app-core/src/pages/Download/android-beta.json', import.meta.url), 'utf8'));
  const destination = await stageAndroidBeta({
    manifest,
    directory: fileURLToPath(new URL('../dist/', import.meta.url)),
  });
  console.log(destination ? `Verified Android APK staged: ${destination}` : 'No active Android beta to stage.');
}
