import { act, render } from '@testing-library/react-native';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createRef } from 'react';
import { Image as ExpoImage } from 'expo-image';
import { PNG } from 'pngjs';
import sharp from 'sharp';
import { StyleSheet } from 'react-native';
import {
  NativeLoadingSpinner,
  type NativeLoadingSpinnerHandle,
  NATIVE_LOADING_SPINNER_DURATION_MS,
  NATIVE_LOADING_SPINNER_SOURCES,
} from '../../../src/components/NativeLoadingSpinner';

const SOURCE_FRAME_COUNT = 36;
const OUTPUT_FRAME_COUNT = SOURCE_FRAME_COUNT * 2;
const FRAME_SIZE = 85;
const FRAME_DELAYS_MS = Array.from(
  { length: OUTPUT_FRAME_COUNT },
  (_, frame) => (frame % 3 === 2 ? 16 : 17),
);

const readCanonicalFrames = (fileName: string): Buffer[] => {
  const sheet = PNG.sync.read(readFileSync(path.resolve(__dirname, `../../../assets/${fileName}`)));
  expect(sheet.width).toBe(SOURCE_FRAME_COUNT * FRAME_SIZE);
  expect(sheet.height).toBe(FRAME_SIZE);
  return Array.from({ length: SOURCE_FRAME_COUNT }, (_, frame) => {
    const pixels = Buffer.alloc(FRAME_SIZE * FRAME_SIZE * 4);
    for (let y = 0; y < FRAME_SIZE; y += 1) {
      const sourceStart = ((y * sheet.width) + (frame * FRAME_SIZE)) * 4;
      sheet.data.copy(
        pixels,
        y * FRAME_SIZE * 4,
        sourceStart,
        sourceStart + (FRAME_SIZE * 4),
      );
    }
    return pixels;
  });
};

const blendFrames = (current: Buffer, next: Buffer): Buffer => {
  const blended = Buffer.alloc(FRAME_SIZE * FRAME_SIZE * 4);
  for (let offset = 0; offset < blended.length; offset += 4) {
    const currentAlpha = current[offset + 3] / 255;
    const nextAlpha = next[offset + 3] / 255;
    const alphaWeight = currentAlpha + nextAlpha;
    if (alphaWeight === 0) continue;
    blended[offset] = Math.round(
      ((current[offset] * currentAlpha) + (next[offset] * nextAlpha)) / alphaWeight,
    );
    blended[offset + 1] = Math.round(
      ((current[offset + 1] * currentAlpha) + (next[offset + 1] * nextAlpha))
      / alphaWeight,
    );
    blended[offset + 2] = Math.round(
      ((current[offset + 2] * currentAlpha) + (next[offset + 2] * nextAlpha))
      / alphaWeight,
    );
    blended[offset + 3] = Math.round((alphaWeight / 2) * 255);
  }
  return blended;
};

const interpolateFrames = (frames: Buffer[]): Buffer[] => frames.flatMap((frame, index) => [
  frame,
  blendFrames(frame, frames[(index + 1) % SOURCE_FRAME_COUNT]),
]);

const collapseDuplicateFrames = (frames: Buffer[]) => {
  const compactFrames: Buffer[] = [];
  const compactDelays: number[] = [];
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

describe('NativeLoadingSpinner', () => {
  beforeEach(() => {
    jest.spyOn(ExpoImage.prototype, 'startAnimating').mockResolvedValue();
    jest.spyOn(ExpoImage.prototype, 'stopAnimating').mockResolvedValue();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the compact native-decoded WebP at canonical geometry', () => {
    const view = render(<NativeLoadingSpinner light={false} />);

    const image = view.getByTestId('native-loading-spinner-dark', { includeHiddenElements: true });
    expect(StyleSheet.flatten(image.props.style)).toMatchObject({
      height: 50,
      width: 50,
    });
    expect(image.props.source).toEqual([NATIVE_LOADING_SPINNER_SOURCES[0]]);

    view.unmount();
  });

  it('preloads both themes and switches the visible native image without remounting', () => {
    const view = render(<NativeLoadingSpinner light={false} />);
    expect(view.UNSAFE_getAllByType(ExpoImage)).toHaveLength(2);
    const darkImages = view.UNSAFE_getAllByType(ExpoImage);

    view.rerender(<NativeLoadingSpinner light />);
    const light = view.getByTestId('native-loading-spinner-light', { includeHiddenElements: true });
    expect(light.props.source).toEqual([NATIVE_LOADING_SPINNER_SOURCES[1]]);
    expect(view.UNSAFE_getAllByType(ExpoImage)).toEqual(darkImages);

    view.unmount();
  });

  it('retains decoded images while its imperative handle controls native playback', () => {
    const ref = createRef<NativeLoadingSpinnerHandle>();
    const startAnimating = jest.spyOn(ExpoImage.prototype, 'startAnimating');
    const stopAnimating = jest.spyOn(ExpoImage.prototype, 'stopAnimating');
    const view = render(<NativeLoadingSpinner autoStart={false} light={false} ref={ref} />);
    const retainedImage = view.getByTestId('native-loading-spinner-dark', {
      includeHiddenElements: true,
    });
    expect(stopAnimating).toHaveBeenCalled();

    act(() => ref.current?.start());
    expect(startAnimating).toHaveBeenCalled();
    expect(view.getByTestId('native-loading-spinner-dark', {
      includeHiddenElements: true,
    })).toBe(retainedImage);

    act(() => ref.current?.stop());
    expect(stopAnimating.mock.calls.length).toBeGreaterThanOrEqual(4);
    expect(view.getByTestId('native-loading-spinner-dark', {
      includeHiddenElements: true,
    })).toBe(retainedImage);
    view.unmount();
  });

  it('ships every Vite frame plus native 60 Hz interpolation on the exact timeline', async () => {
    const variants = [
      ['loading-spinner-dark-strip.png', 'loading-spinner-dark.webp'],
      ['loading-spinner-light-strip.png', 'loading-spinner-light.webp'],
    ] as const;

    for (const [stripFileName, webpFileName] of variants) {
      const sourceFrames = readCanonicalFrames(stripFileName);
      expect(new Set(sourceFrames.map((frame) => frame.toString('base64'))).size)
        .toBeGreaterThanOrEqual(35);
      const expected = collapseDuplicateFrames(interpolateFrames(sourceFrames));
      const webpPath = path.resolve(__dirname, `../../../assets/${webpFileName}`);
      const metadata = await sharp(webpPath, { animated: true }).metadata();
      expect(metadata.width).toBe(FRAME_SIZE);
      expect(metadata.pageHeight).toBe(FRAME_SIZE);
      expect(metadata.pages).toBe(expected.compactFrames.length);
      expect(metadata.delay).toEqual(expected.compactDelays);
      expect(metadata.delay?.reduce((total, delay) => total + delay, 0))
        .toBe(NATIVE_LOADING_SPINNER_DURATION_MS);
      expect(Math.min(...(metadata.delay ?? []))).toBeGreaterThanOrEqual(16);

      const decoded = await sharp(webpPath, { animated: true })
        .ensureAlpha()
        .raw()
        .toBuffer();
      expect(decoded).toEqual(Buffer.concat(expected.compactFrames));
    }
  }, 30_000);
});
