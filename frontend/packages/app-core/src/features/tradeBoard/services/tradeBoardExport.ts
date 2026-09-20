import html2canvas from 'html2canvas';

const MAX_EXPORT_PIXELS = 20_000_000;
const MAX_EXPORT_SCALE = 2;

const waitForImage = async (image: HTMLImageElement): Promise<void> => {
  if (image.complete) {
    try {
      await image.decode?.();
    } catch {
      // A broken decorative image must not prevent the rest of the board exporting.
    }
    return;
  }

  await new Promise<void>((resolve) => {
    image.addEventListener('load', () => resolve(), { once: true });
    image.addEventListener('error', () => resolve(), { once: true });
  });
};

export const waitForTradeBoardAssets = async (element: HTMLElement): Promise<void> => {
  if (document.fonts?.ready) await document.fonts.ready;
  await Promise.all([...element.querySelectorAll('img')].map(waitForImage));
};

const canvasToBlob = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('The Trade Board image could not be created.'));
    }, 'image/png');
  });

export const renderTradeBoardBlob = async (element: HTMLElement): Promise<Blob> => {
  await waitForTradeBoardAssets(element);
  const width = element.offsetWidth;
  const height = element.offsetHeight;
  const pixelSafeScale = Math.sqrt(MAX_EXPORT_PIXELS / Math.max(1, width * height));
  const scale = Math.max(1, Math.min(MAX_EXPORT_SCALE, pixelSafeScale));
  const canvas = await html2canvas(element, {
    backgroundColor: null,
    height,
    logging: false,
    scale,
    scrollX: 0,
    scrollY: 0,
    useCORS: true,
    width,
    windowHeight: height,
    windowWidth: width,
  });
  return canvasToBlob(canvas);
};

export const downloadTradeBoardBlob = (blob: Blob, filename: string): void => {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename;
  link.href = objectUrl;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
};

export const canShareTradeBoardFile = (filename = 'trade-board.png'): boolean => {
  if (typeof navigator.share !== 'function' || typeof File === 'undefined') return false;
  const file = new File([new Blob()], filename, { type: 'image/png' });
  return typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] });
};

export const shareTradeBoardBlob = async (
  blob: Blob,
  filename: string,
  boardUrl: string,
): Promise<void> => {
  const file = new File([blob], filename, { type: 'image/png' });
  await navigator.share({
    files: [file],
    text: `See my current Pokémon GO Trade Board: ${boardUrl}`,
    title: 'My Pokémon Go Nexus Trade Board',
  });
};
