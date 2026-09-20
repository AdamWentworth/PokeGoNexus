import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { stageAndroidBeta } from './stage-android-beta.mjs';

const bytes = Buffer.from('verified release fixture');
const filename = 'PokeGoNexus-Android-26092001.apk';
const release = {
  versionCode: 26092001,
  downloadUrl: `https://github.com/AdamWentworth/PokeGoNexus/releases/download/android-beta-26092001/${filename}`,
  sizeBytes: bytes.length,
  sha256: createHash('sha256').update(bytes).digest('hex'),
};

test('stages the exact release bytes at the website download path', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'pgn-apk-stage-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const destination = await stageAndroidBeta({
    manifest: { release }, directory,
    fetchAsset: async (url) => {
      assert.equal(url, release.downloadUrl);
      return new Response(bytes);
    },
  });
  assert.equal(destination, path.join(directory, 'downloads/android', filename));
  assert.deepEqual(await readFile(destination), bytes);
  assert.deepEqual(await readdir(path.dirname(destination)), [filename]);
});

test('never publishes partial, substituted, or unavailable APK downloads', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'pgn-apk-reject-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  for (const response of [new Response(bytes.subarray(0, 5)), new Response(Buffer.alloc(bytes.length)), new Response('missing', { status: 404 })]) {
    await assert.rejects(stageAndroidBeta({ manifest: { release }, directory, fetchAsset: async () => response }));
    assert.deepEqual(await readdir(path.join(directory, 'downloads/android')), []);
  }
});

test('an inactive release performs no download, and an unpinned source is rejected', async () => {
  const fetchAsset = async () => { throw new Error('unexpected network request'); };
  assert.equal(await stageAndroidBeta({ manifest: { release: null }, directory: '', fetchAsset }), null);
  await assert.rejects(stageAndroidBeta({ manifest: { release: { ...release, downloadUrl: 'https://example.com/app.apk' } }, directory: '', fetchAsset }), /pinned public release/);
});
