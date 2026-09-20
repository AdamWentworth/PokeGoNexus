import { Buffer } from 'node:buffer';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { PNG } = require('pngjs');
const sharp = require('sharp');

const SOURCE_FRAME_COUNT = 36;
const OUTPUT_FRAME_COUNT = SOURCE_FRAME_COUNT * 2;
const FRAME_SIZE = 85;
const FRAME_DELAYS_MS = Array.from(
  { length: OUTPUT_FRAME_COUNT },
  (_, frame) => (frame % 3 === 2 ? 16 : 17),
);
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const assetsDirectory = path.resolve(scriptDirectory, '../assets');
const sharedMediaDirectory = path.resolve(scriptDirectory, '../../../../assets/media');
const webRequire = createRequire(path.resolve(scriptDirectory, '../../web/package.json'));
const { chromium } = webRequire('playwright');

const variants = [
  {
    stripFileName: 'loading-spinner-dark-strip.png',
    videoFileName: 'loading_spinner.webm',
    webpFileName: 'loading-spinner-dark.webp',
  },
  {
    stripFileName: 'loading-spinner-light-strip.png',
    videoFileName: 'loading_spinner_light.webm',
    webpFileName: 'loading-spinner-light.webp',
  },
];

const frameByteLength = FRAME_SIZE * FRAME_SIZE * 4;

const extractViteFrames = async (page, videoPath) => {
  const source = fs.readFileSync(videoPath);
  const dataUrl = `data:video/webm;base64,${source.toString('base64')}`;
  const decoded = await page.evaluate(async ({ frameCount, frameRate, sourceUrl }) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = sourceUrl;
    await new Promise((resolve, reject) => {
      video.onloadeddata = resolve;
      video.onerror = () => reject(new Error('Could not decode the Vite spinner video'));
      video.load();
    });
    video.pause();

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Could not create a spinner extraction canvas');

    const frames = [];
    for (let frame = 0; frame < frameCount; frame += 1) {
      // Sample the middle of each WebM presentation interval. Sampling frame
      // boundaries produced 12 accidental duplicates in the former native asset.
      const targetTime = (frame + 0.5) / frameRate;
      await new Promise((resolve) => {
        video.onseeked = resolve;
        video.currentTime = targetTime;
      });
      // Chromium reports `seeked` when the primary VP9 plane is ready. Give
      // its alpha plane two compositor ticks to settle before sampling it.
      await new Promise((resolve) => {
        window.requestAnimationFrame(() => window.requestAnimationFrame(resolve));
      });
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(video, 0, 0);
      frames.push(Array.from(
        context.getImageData(0, 0, canvas.width, canvas.height).data,
      ));
    }

    return {
      duration: video.duration,
      frames,
      height: video.videoHeight,
      width: video.videoWidth,
    };
  }, {
    frameCount: SOURCE_FRAME_COUNT,
    frameRate: 30,
    sourceUrl: dataUrl,
  });

  if (
    decoded.width !== FRAME_SIZE
    || decoded.height !== FRAME_SIZE
    || Math.abs(decoded.duration - 1.2) > 0.001
    || decoded.frames.length !== SOURCE_FRAME_COUNT
  ) {
    throw new Error(
      `Unexpected Vite spinner video geometry or duration for ${path.basename(videoPath)}`,
    );
  }

  return decoded.frames.map((frame) => Buffer.from(frame));
};

const writeCanonicalStrip = (frames, stripPath) => {
  const strip = new PNG({
    height: FRAME_SIZE,
    width: SOURCE_FRAME_COUNT * FRAME_SIZE,
  });
  frames.forEach((frame, frameIndex) => {
    for (let y = 0; y < FRAME_SIZE; y += 1) {
      const sourceStart = y * FRAME_SIZE * 4;
      const targetStart = ((y * strip.width) + (frameIndex * FRAME_SIZE)) * 4;
      frame.copy(strip.data, targetStart, sourceStart, sourceStart + (FRAME_SIZE * 4));
    }
  });
  fs.writeFileSync(stripPath, PNG.sync.write(strip));
};

const blendFrames = (current, next) => {
  const blended = Buffer.alloc(frameByteLength);
  for (let offset = 0; offset < frameByteLength; offset += 4) {
    const currentAlpha = current[offset + 3] / 255;
    const nextAlpha = next[offset + 3] / 255;
    const alphaWeight = currentAlpha + nextAlpha;
    if (alphaWeight === 0) continue;
    blended[offset] = Math.round(
      ((current[offset] * currentAlpha) + (next[offset] * nextAlpha)) / alphaWeight,
    );
    blended[offset + 1] = Math.round(
      ((current[offset + 1] * currentAlpha) + (next[offset + 1] * nextAlpha)) / alphaWeight,
    );
    blended[offset + 2] = Math.round(
      ((current[offset + 2] * currentAlpha) + (next[offset + 2] * nextAlpha)) / alphaWeight,
    );
    blended[offset + 3] = Math.round((alphaWeight / 2) * 255);
  }
  return blended;
};

const interpolateFrames = (sourceFrames) => sourceFrames.flatMap((frame, index) => [
  frame,
  blendFrames(frame, sourceFrames[(index + 1) % SOURCE_FRAME_COUNT]),
]);

const collapseAdjacentDuplicates = (frames) => {
  const compactFrames = [];
  const compactDelays = [];
  frames.forEach((frame, index) => {
    if (compactFrames.at(-1)?.equals(frame)) {
      compactDelays[compactDelays.length - 1] += FRAME_DELAYS_MS[index];
    } else {
      compactFrames.push(frame);
      compactDelays.push(FRAME_DELAYS_MS[index]);
    }
  });
  return { compactDelays, compactFrames };
};

const assertAnimatedWebp = async (filePath, expectedFrames) => {
  const expected = collapseAdjacentDuplicates(expectedFrames);
  const metadata = await sharp(filePath, { animated: true }).metadata();
  const duration = metadata.delay?.reduce((total, delay) => total + delay, 0);
  if (
    metadata.pages !== expected.compactFrames.length
    || metadata.pageHeight !== FRAME_SIZE
    || duration !== 1200
    || metadata.delay?.some((delay, frame) => delay !== expected.compactDelays[frame])
  ) {
    throw new Error(`Invalid animated WebP metadata for ${path.basename(filePath)}`);
  }

  const decoded = await sharp(filePath, { animated: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (
    decoded.info.width !== FRAME_SIZE
    || decoded.info.height !== expected.compactFrames.length * FRAME_SIZE
    || !decoded.data.equals(Buffer.concat(expected.compactFrames))
  ) {
    throw new Error(`Animated WebP pixels diverged for ${path.basename(filePath)}`);
  }
};

const buildAnimatedWebp = async (frames, filePath) => {
  await sharp(Buffer.concat(frames), {
    raw: {
      channels: 4,
      height: frames.length * FRAME_SIZE,
      pageHeight: FRAME_SIZE,
      width: FRAME_SIZE,
    },
  })
    .webp({
      delay: FRAME_DELAYS_MS,
      effort: 6,
      exact: true,
      lossless: true,
      loop: 0,
      minSize: true,
    })
    .toFile(filePath);
  await assertAnimatedWebp(filePath, frames);
};

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  for (const variant of variants) {
    const sourceFrames = await extractViteFrames(
      page,
      path.join(sharedMediaDirectory, variant.videoFileName),
    );
    writeCanonicalStrip(
      sourceFrames,
      path.join(assetsDirectory, variant.stripFileName),
    );
    await buildAnimatedWebp(
      interpolateFrames(sourceFrames),
      path.join(assetsDirectory, variant.webpFileName),
    );
  }
} finally {
  await browser.close();
}
