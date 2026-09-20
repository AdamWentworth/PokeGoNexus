import crypto from 'node:crypto';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
  type TestInfo,
} from '@playwright/test';
import ffmpegStaticPath from 'ffmpeg-static';
import { PNG } from 'pngjs';

import { attachBrowserDiagnostics } from './support/diagnostics';

const liveDemoMediaDir = path.resolve(process.cwd(), '.artifacts/demo-media-live');
const liveDemoVideoDir = path.resolve(process.cwd(), '.artifacts/demo-video-live');
const demoUsername = process.env.POKEGONEXUS_DEMO_USERNAME ?? '';
const demoPassword = process.env.POKEGONEXUS_DEMO_PASSWORD ?? '';
const keepRawPlaywrightVideos = process.env.DEMO_CAPTURE_KEEP_RAW === '1';

type ThemeMode = 'dark' | 'light';
type ViewportMode = 'desktop' | 'mobile';
type VideoFlow = 'collection-overlay' | 'search-results';
type WorkflowVideoFlow =
  | 'caught-instance'
  | 'catalog-search'
  | 'wanted-instance'
  | 'trade-instance'
  | 'instance-edit';

type DisposableAuthAccount = {
  username: string;
  updatedUsername: string;
  email: string;
  password: string;
  pokemonGoName: string;
  location: string;
  trainerCode: string;
  userId?: string;
  deleted?: boolean;
};

type BlockedMutation = {
  method: string;
  url: string;
};

const readOnlyMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
const captureThemes: ThemeMode[] = ['dark', 'light'];
const captureViewports: Record<ViewportMode, { width: number; height: number }> = {
  desktop: { width: 1760, height: 1100 },
  mobile: { width: 390, height: 844 },
};
const runLiveVideoCapture = process.env.DEMO_VIDEO_CAPTURE_LIVE === '1';
const runLiveAuthCapture = process.env.DEMO_AUTH_CAPTURE_LIVE === '1';
const runLiveWorkflowCapture = process.env.DEMO_WORKFLOW_CAPTURE_LIVE === '1';
const videoFlows = runLiveVideoCapture
  ? parseModes<VideoFlow>(
      process.env.DEMO_VIDEO_FLOWS,
      ['collection-overlay', 'search-results'],
      ['collection-overlay', 'search-results'],
    )
  : [];
const videoThemes = runLiveVideoCapture
  ? parseModes<ThemeMode>(process.env.DEMO_VIDEO_THEMES, captureThemes, captureThemes)
  : [];
const videoViewports = runLiveVideoCapture
  ? parseModes<ViewportMode>(
      process.env.DEMO_VIDEO_VIEWPORTS,
      Object.keys(captureViewports) as ViewportMode[],
      ['desktop', 'mobile'],
    )
  : [];
const authVideoThemes = runLiveAuthCapture
  ? parseModes<ThemeMode>(process.env.DEMO_AUTH_THEMES, captureThemes, captureThemes)
  : [];
const authVideoViewports = runLiveAuthCapture
  ? parseModes<ViewportMode>(
      process.env.DEMO_AUTH_VIEWPORTS,
      Object.keys(captureViewports) as ViewportMode[],
      Object.keys(captureViewports) as ViewportMode[],
    )
  : [];
const workflowVideoFlows = runLiveWorkflowCapture
  ? parseModes<WorkflowVideoFlow>(
      process.env.DEMO_WORKFLOW_FLOWS,
      ['caught-instance', 'catalog-search', 'wanted-instance', 'trade-instance', 'instance-edit'],
      ['caught-instance', 'catalog-search', 'wanted-instance', 'trade-instance', 'instance-edit'],
    )
  : [];
const workflowVideoThemes = runLiveWorkflowCapture
  ? parseModes<ThemeMode>(process.env.DEMO_WORKFLOW_THEMES, captureThemes, captureThemes)
  : [];
const workflowVideoViewports = runLiveWorkflowCapture
  ? parseModes<ViewportMode>(
      process.env.DEMO_WORKFLOW_VIEWPORTS,
      Object.keys(captureViewports) as ViewportMode[],
      Object.keys(captureViewports) as ViewportMode[],
    )
  : [];
const videoPauseMs = parsePositiveInteger(process.env.DEMO_VIDEO_PAUSE_MS, 2_500);
const videoFinalPauseMs = parsePositiveInteger(process.env.DEMO_VIDEO_FINAL_PAUSE_MS, 4_500);
const videoMaxDurationSeconds = parsePositiveNumber(process.env.DEMO_VIDEO_MAX_SECONDS, 14.8);
const videoTrimPrerollMs = parsePositiveInteger(process.env.DEMO_VIDEO_TRIM_PREROLL_MS, 150);
const videoCrf = parsePositiveInteger(process.env.DEMO_VIDEO_CRF, 20);
const collectionVideoActionPauseMs = parsePositiveInteger(
  process.env.DEMO_VIDEO_COLLECTION_ACTION_PAUSE_MS,
  350,
);
const collectionVideoAllPauseMs = parsePositiveInteger(
  process.env.DEMO_VIDEO_COLLECTION_ALL_PAUSE_MS,
  700,
);
const collectionVideoFavoritesPauseMs = parsePositiveInteger(
  process.env.DEMO_VIDEO_COLLECTION_FAVORITES_PAUSE_MS,
  700,
);
const collectionVideoOverlayPauseMs = parsePositiveInteger(
  process.env.DEMO_VIDEO_COLLECTION_OVERLAY_PAUSE_MS,
  3_500,
);
const collectionVideoRaikouTypingDelayMs = parsePositiveInteger(
  process.env.DEMO_VIDEO_COLLECTION_RAIKOU_TYPING_DELAY_MS,
  70,
);
const searchVideoActionPauseMs = parsePositiveInteger(
  process.env.DEMO_VIDEO_SEARCH_ACTION_PAUSE_MS,
  250,
);
const searchVideoTypingDelayMs = parsePositiveInteger(
  process.env.DEMO_VIDEO_SEARCH_TYPING_DELAY_MS,
  45,
);
const searchVideoInitialPauseMs = parsePositiveInteger(
  process.env.DEMO_VIDEO_SEARCH_INITIAL_PAUSE_MS,
  400,
);
const searchVideoCostumeMenuPauseMs = parsePositiveInteger(
  process.env.DEMO_VIDEO_SEARCH_COSTUME_MENU_PAUSE_MS,
  900,
);
const searchVideoListPauseMs = parsePositiveInteger(
  process.env.DEMO_VIDEO_SEARCH_LIST_PAUSE_MS,
  450,
);
const searchVideoMapReadyPauseMs = parsePositiveInteger(
  process.env.DEMO_VIDEO_SEARCH_MAP_READY_PAUSE_MS,
  350,
);
const searchVideoMapPopupPauseMs = parsePositiveInteger(
  process.env.DEMO_VIDEO_SEARCH_MAP_POPUP_PAUSE_MS,
  3_200,
);
const authVideoMaxDurationSeconds = parsePositiveNumber(
  process.env.DEMO_AUTH_VIDEO_MAX_SECONDS,
  29.8,
);
const authVideoPauseMs = parsePositiveInteger(process.env.DEMO_AUTH_VIDEO_PAUSE_MS, 350);
const authVideoActionPauseMs = parsePositiveInteger(
  process.env.DEMO_AUTH_VIDEO_ACTION_PAUSE_MS,
  100,
);
const authIncludeExplicitLogin = process.env.DEMO_AUTH_INCLUDE_EXPLICIT_LOGIN === '1';
const workflowVideoMaxDurationSeconds = parsePositiveNumber(
  process.env.DEMO_WORKFLOW_VIDEO_MAX_SECONDS,
  19.8,
);
const workflowTargetVideoMaxDurationSeconds = parsePositiveNumber(
  process.env.DEMO_WORKFLOW_TARGET_VIDEO_MAX_SECONDS,
  27.8,
);
const workflowEditVideoMaxDurationSeconds = parsePositiveNumber(
  process.env.DEMO_WORKFLOW_EDIT_VIDEO_MAX_SECONDS,
  24.8,
);
const workflowVideoPauseMs = parsePositiveInteger(process.env.DEMO_WORKFLOW_VIDEO_PAUSE_MS, 900);
const workflowVideoActionPauseMs = parsePositiveInteger(
  process.env.DEMO_WORKFLOW_VIDEO_ACTION_PAUSE_MS,
  350,
);
const workflowVideoFinalPauseMs = parsePositiveInteger(
  process.env.DEMO_WORKFLOW_VIDEO_FINAL_PAUSE_MS,
  2_600,
);
const workflowVideoTypingDelayMs = parsePositiveInteger(
  process.env.DEMO_WORKFLOW_VIDEO_TYPING_DELAY_MS,
  55,
);

test.use({
  screenshot: 'off',
  trace: 'off',
  video: 'off',
});

function formatUrlForReport(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    return `${url.origin}${url.pathname}`;
  } catch {
    return rawUrl;
  }
}

function mediaName(theme: ThemeMode, surface: string, viewport: ViewportMode) {
  return `${theme}-${surface}-${viewport}`;
}

function videoName(theme: ThemeMode, flow: VideoFlow, viewport: ViewportMode) {
  return `${theme}-${flow}-${viewport}`;
}

function workflowVideoName(theme: ThemeMode, flow: WorkflowVideoFlow, viewport: ViewportMode) {
  return `${theme}-workflow-${flow}-${viewport}`;
}

function parseModes<T extends string>(
  rawValue: string | undefined,
  allowedValues: readonly T[],
  defaultValues: readonly T[],
) {
  if (!rawValue) return [...defaultValues];

  const allowed = new Set<string>(allowedValues);
  const values = rawValue
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const invalidValues = values.filter((value) => !allowed.has(value));

  if (invalidValues.length > 0) {
    throw new Error(
      `Invalid live demo video option(s): ${invalidValues.join(', ')}. ` +
        `Allowed values are: ${allowedValues.join(', ')}.`,
    );
  }

  return Array.from(new Set(values)) as T[];
}

function parsePositiveInteger(rawValue: string | undefined, fallback: number) {
  if (!rawValue) return fallback;

  const value = Number(rawValue);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
}

function parsePositiveNumber(rawValue: string | undefined, fallback: number) {
  if (!rawValue) return fallback;

  const value = Number(rawValue);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function generateTrainerCode() {
  return Number.parseInt(crypto.randomBytes(6).toString('hex'), 16)
    .toString()
    .padStart(12, '0')
    .slice(0, 12);
}

function removeRawPlaywrightVideos() {
  if (keepRawPlaywrightVideos || !fs.existsSync(liveDemoVideoDir)) return;

  for (const entry of fs.readdirSync(liveDemoVideoDir)) {
    if (/^page@.+\.webm$/.test(entry)) {
      fs.rmSync(path.join(liveDemoVideoDir, entry), { force: true });
    }
  }
}

function resolveFfmpegPath() {
  if (process.env.FFMPEG_PATH) {
    return process.env.FFMPEG_PATH;
  }

  if (ffmpegStaticPath) {
    return ffmpegStaticPath;
  }

  return 'ffmpeg';
}

function formatSeconds(durationMs: number) {
  return (Math.max(0, durationMs) / 1_000).toFixed(3);
}

function videoTrimStart(recordingStartedAt: number) {
  return Math.max(0, Date.now() - recordingStartedAt - videoTrimPrerollMs);
}

function trimVideoClip(
  rawVideoPath: string,
  outputVideoPath: string,
  trimStartMs: number,
  maxDurationSeconds = videoMaxDurationSeconds,
) {
  const ffmpegPath = resolveFfmpegPath();
  const result = spawnSync(
    ffmpegPath,
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-i',
      rawVideoPath,
      '-ss',
      formatSeconds(trimStartMs),
      '-t',
      String(maxDurationSeconds),
      '-an',
      '-vf',
      'fps=30',
      '-c:v',
      'libvpx-vp9',
      '-deadline',
      'good',
      '-cpu-used',
      '2',
      '-crf',
      String(videoCrf),
      '-b:v',
      '0',
      '-row-mt',
      '1',
      outputVideoPath,
    ],
    { encoding: 'utf8' },
  );

  if (result.status !== 0) {
    throw new Error(
      [
        `Could not trim live demo video with ffmpeg at ${ffmpegPath}.`,
        `Raw video kept at: ${rawVideoPath}`,
        result.error ? `Error: ${result.error.message}` : '',
        result.stderr ? `stderr:\n${result.stderr}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }
}

async function setThemeMode(page: Page, theme: ThemeMode) {
  await page.evaluate((mode) => {
    const isLightMode = mode === 'light';
    window.localStorage.setItem('isLightMode', JSON.stringify(isLightMode));
    document.documentElement.setAttribute('data-theme', isLightMode ? 'light' : 'dark');
    document.documentElement.style.colorScheme = isLightMode ? 'light' : 'dark';
  }, theme);
}

async function prepareCaptureContext(page: Page, theme: ThemeMode, viewport: ViewportMode) {
  await page.setViewportSize(captureViewports[viewport]);
  await setThemeMode(page, theme);
}

function isAllowedCredentialRequest(method: string, rawUrl: string) {
  if (method !== 'POST') return false;

  try {
    const { pathname } = new URL(rawUrl);
    return /\/api\/auth\/(?:login|refresh)\/?$/.test(pathname);
  } catch {
    return false;
  }
}

function isTelemetryRequest(method: string, rawUrl: string) {
  if (method !== 'POST') return false;

  try {
    const { pathname } = new URL(rawUrl);
    return pathname === '/cdn-cgi/rum';
  } catch {
    return false;
  }
}

function liveApiUrl(pathname: string) {
  const origin =
    process.env.E2E_REAL_API_ORIGIN ??
    process.env.E2E_BASE_URL ??
    'https://pokegonexus.com';

  return new URL(pathname, origin).toString();
}

function authApiUrl(pathname: string) {
  return liveApiUrl(`/api/auth${pathname}`);
}

function isAllowedAuthCaptureMutation(method: string, rawUrl: string) {
  try {
    const { pathname } = new URL(rawUrl);

    if (
      method === 'POST' &&
      /\/api\/auth\/(?:register|login|logout|refresh)\/?$/.test(pathname)
    ) {
      return true;
    }

    if (method === 'DELETE' && /\/api\/auth\/delete\/[^/]+\/?$/.test(pathname)) {
      return true;
    }

    if (method === 'DELETE' && /\/api\/users\/[^/]+\/?$/.test(pathname)) {
      return true;
    }

    if (method === 'PUT' && /\/api\/auth\/update\/[^/]+\/?$/.test(pathname)) {
      return true;
    }

    if (method === 'PUT' && /\/api\/users\/update-user\/[^/]+\/?$/.test(pathname)) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

function isUserOverviewRequest(rawUrl: string) {
  try {
    const { pathname } = new URL(rawUrl);
    return /\/api\/users\/(?:users\/)?[^/]+\/overview\/?$/.test(pathname);
  } catch {
    return false;
  }
}

async function installReadOnlyNetworkGuard(page: Page) {
  const blockedMutations: BlockedMutation[] = [];

  await page.route('**/*', async (route) => {
    const request = route.request();
    const method = request.method().toUpperCase();
    const url = request.url();

    if (isTelemetryRequest(method, url)) {
      await route.fulfill({ status: 204, body: '' });
      return;
    }

    if (readOnlyMethods.has(method) || isAllowedCredentialRequest(method, url)) {
      await route.continue();
      return;
    }

    blockedMutations.push({
      method,
      url: formatUrlForReport(url),
    });
    await route.abort('blockedbyclient');
  });

  return blockedMutations;
}

async function installAuthCaptureNetworkGuard(page: Page) {
  const blockedMutations: BlockedMutation[] = [];

  await page.route('**/*', async (route) => {
    const request = route.request();
    const method = request.method().toUpperCase();
    const url = request.url();

    if (isTelemetryRequest(method, url)) {
      await route.fulfill({ status: 204, body: '' });
      return;
    }

    if (readOnlyMethods.has(method) || isAllowedAuthCaptureMutation(method, url)) {
      await route.continue();
      return;
    }

    blockedMutations.push({
      method,
      url: formatUrlForReport(url),
    });
    await route.abort('blockedbyclient');
  });

  return blockedMutations;
}

async function clickIfVisible(locator: Locator, timeout = 2_000) {
  if (await locator.isVisible({ timeout }).catch(() => false)) {
    await hideToastNotifications(locator.page());
    await locator.click({ timeout: Math.max(timeout, 5_000) });
    return true;
  }
  return false;
}

async function installVideoPresentationHelpers(context: BrowserContext, showCursor: boolean) {
  await context.addInitScript((options: { showCursor: boolean }) => {
    const styleId = 'live-demo-video-presentation-style';
    const cursorId = 'live-demo-video-cursor';
    const tapClassName = 'live-demo-mobile-tap';
    let lastCursorX = 24;
    let lastCursorY = 24;

    const updateCursor = () => {
      const cursor = document.getElementById(cursorId) as HTMLElement | null;
      if (!cursor) return;
      cursor.style.transform = `translate3d(${lastCursorX}px, ${lastCursorY}px, 0)`;
    };

    const ensurePresentation = () => {
      const root = document.documentElement;
      if (!root) return;

      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
          .Toastify,
          .Toastify__toast-container,
          .Toastify__toast {
            display: none !important;
            opacity: 0 !important;
            pointer-events: none !important;
            visibility: hidden !important;
          }
          .app-loading-overlay {
            display: none !important;
            opacity: 0 !important;
            pointer-events: none !important;
            visibility: hidden !important;
          }
          .instance-overlay:is(.caught-mode, .trade-mode) .instance-motion-shell {
            transform: translateX(0) !important;
            transition: none !important;
          }
          body.live-demo-location-suggestions-dismissed
            :is(.location-caught-container .suggestions, .suggestions-dropdown) {
            display: none !important;
            opacity: 0 !important;
            pointer-events: none !important;
            visibility: hidden !important;
          }
          #${cursorId} {
            background: #ffffff;
            clip-path: polygon(0 0, 0 21px, 6px 15px, 10px 24px, 14px 22px, 10px 13px, 18px 13px);
            filter: drop-shadow(0 1px 2px rgb(0 0 0 / 0.75));
            height: 24px;
            left: 0;
            pointer-events: none;
            position: fixed;
            top: 0;
            transition: transform 180ms ease, scale 120ms ease;
            width: 18px;
            z-index: 2147483647;
          }
          #${cursorId}.is-pressing {
            scale: 0.88;
          }
          .${tapClassName} {
            --tap-x: 0px;
            --tap-y: 0px;
            animation: live-demo-tap-ripple 720ms ease-out forwards;
            background: rgb(255 255 255 / 0.22);
            border: 2px solid rgb(255 255 255 / 0.92);
            border-radius: 999px;
            box-shadow:
              0 0 0 1px rgb(0 0 0 / 0.25),
              0 6px 18px rgb(0 0 0 / 0.28);
            height: 54px;
            left: 0;
            pointer-events: none;
            position: fixed;
            top: 0;
            transform: translate3d(calc(var(--tap-x) - 27px), calc(var(--tap-y) - 27px), 0) scale(0.58);
            width: 54px;
            z-index: 2147483647;
          }
          .${tapClassName}::after {
            background: rgb(255 255 255 / 0.92);
            border-radius: inherit;
            content: '';
            height: 10px;
            left: 50%;
            position: absolute;
            top: 50%;
            transform: translate(-50%, -50%);
            width: 10px;
          }
          @keyframes live-demo-tap-ripple {
            0% {
              opacity: 0;
              transform: translate3d(calc(var(--tap-x) - 27px), calc(var(--tap-y) - 27px), 0) scale(0.48);
            }
            16% {
              opacity: 1;
            }
            100% {
              opacity: 0;
              transform: translate3d(calc(var(--tap-x) - 27px), calc(var(--tap-y) - 27px), 0) scale(1.12);
            }
          }
        `;
        (document.head ?? root).appendChild(style);
      }

      if (!options.showCursor) {
        document.getElementById(cursorId)?.remove();
        return;
      }

      if (!document.getElementById(cursorId)) {
        const cursor = document.createElement('div');
        cursor.id = cursorId;
        cursor.setAttribute('aria-hidden', 'true');
        (document.body ?? root).appendChild(cursor);
        updateCursor();
      }
    };

    const markCursorPressing = (isPressing: boolean) => {
      const cursor = document.getElementById(cursorId);
      cursor?.classList.toggle('is-pressing', isPressing);
    };

    window.addEventListener(
      'mousemove',
      (event) => {
        lastCursorX = event.clientX;
        lastCursorY = event.clientY;
        updateCursor();
      },
      true,
    );
    window.addEventListener('mousedown', () => markCursorPressing(true), true);
    window.addEventListener('mouseup', () => markCursorPressing(false), true);

    type DemoVideoWindow = Window & {
      __setLiveDemoCursor?: (x: number, y: number) => void;
      __showLiveDemoTap?: (x: number, y: number) => void;
    };
    (window as DemoVideoWindow).__setLiveDemoCursor = (x: number, y: number) => {
      lastCursorX = x;
      lastCursorY = y;
      ensurePresentation();
      updateCursor();
    };
    (window as DemoVideoWindow).__showLiveDemoTap = (x: number, y: number) => {
      if (options.showCursor) return;

      ensurePresentation();
      const tap = document.createElement('div');
      tap.className = tapClassName;
      tap.setAttribute('aria-hidden', 'true');
      tap.style.setProperty('--tap-x', `${x}px`);
      tap.style.setProperty('--tap-y', `${y}px`);
      (document.body ?? document.documentElement).appendChild(tap);

      const removeTap = () => tap.remove();
      tap.addEventListener('animationend', removeTap, { once: true });
      window.setTimeout(removeTap, 900);
    };

    ensurePresentation();
    document.addEventListener('DOMContentLoaded', ensurePresentation);
    new MutationObserver(ensurePresentation).observe(document, {
      childList: true,
      subtree: true,
    });
  }, { showCursor });
}

async function moveVideoCursorToLocator(locator: Locator, settleMs = 220) {
  const page = locator.page();
  const box = await locator.boundingBox();
  if (!box) return;

  const x = Math.round(box.x + box.width / 2);
  const y = Math.round(box.y + box.height / 2);
  await page.evaluate(
    ({ nextX, nextY }) => {
      type DemoVideoWindow = Window & {
        __setLiveDemoCursor?: (x: number, y: number) => void;
      };
      (window as DemoVideoWindow).__setLiveDemoCursor?.(nextX, nextY);
    },
    { nextX: x, nextY: y },
  );
  await page.mouse.move(x, y, { steps: 16 });
  await page.waitForTimeout(settleMs);
}

async function showVideoTapAtLocator(locator: Locator) {
  const page = locator.page();
  const box = await locator.boundingBox();
  if (!box) return;

  const x = Math.round(box.x + box.width / 2);
  const y = Math.round(box.y + box.height / 2);
  await showVideoTapAtPoint(page, x, y);
}

async function showVideoTapAtPoint(page: Page, x: number, y: number) {
  await page.evaluate(
    ({ tapX, tapY }) => {
      type DemoVideoWindow = Window & {
        __showLiveDemoTap?: (x: number, y: number) => void;
      };
      (window as DemoVideoWindow).__showLiveDemoTap?.(tapX, tapY);
    },
    { tapX: x, tapY: y },
  );
  await page.waitForTimeout(80);
}

async function clickForVideo(locator: Locator, timeout = 10_000) {
  await expect(locator).toBeVisible({ timeout });
  await hideToastNotifications(locator.page());
  await moveVideoCursorToLocator(locator);
  await showVideoTapAtLocator(locator);
  await locator.click({ timeout });
  await hideToastNotifications(locator.page());
  await stabilizeInstanceOverlayForVideo(locator.page());
}

async function forceClickForVideo(locator: Locator, timeout = 10_000) {
  await expect(locator).toBeVisible({ timeout });
  await hideToastNotifications(locator.page());
  await moveVideoCursorToLocator(locator);
  await showVideoTapAtLocator(locator);
  await locator.click({ force: true, timeout });
  await hideToastNotifications(locator.page());
  await stabilizeInstanceOverlayForVideo(locator.page());
}

async function clickIfVisibleForVideo(locator: Locator, timeout = 2_000) {
  if (await locator.isVisible({ timeout }).catch(() => false)) {
    await clickForVideo(locator, Math.max(timeout, 5_000));
    return true;
  }
  return false;
}

async function stabilizeInstanceOverlayForVideo(page: Page) {
  await page.evaluate(() => {
    const overlay = document.querySelector<HTMLElement>('.instance-overlay');
    overlay?.classList.remove('is-swiping', 'is-horizontal-swiping');

    const scrollContainers = [
      document.scrollingElement,
      document.documentElement,
      document.body,
      ...Array.from(
        document.querySelectorAll<HTMLElement>(
          '.instance-overlay, .caught-fullscreen, .caught-scroll, .caught-column, .instance-motion-shell',
        ),
      ),
    ].filter((element): element is Element => Boolean(element));

    for (const element of scrollContainers) {
      element.scrollLeft = 0;
    }

    for (const shell of Array.from(
      document.querySelectorAll<HTMLElement>('.instance-motion-shell'),
    )) {
      shell.style.setProperty('transform', 'translateX(0)', 'important');
      shell.style.setProperty('transition', 'none', 'important');
    }
  }).catch(() => {});
}

async function dismissLocationSuggestionsForVideo(page: Page, timeout = 5_000) {
  const suggestions = page.locator(
    '.location-caught-container .suggestions, .suggestions-dropdown',
  );
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    if (!(await suggestions.first().isVisible({ timeout: 250 }).catch(() => false))) {
      return;
    }

    await page
      .evaluate(() => {
        const outsideTarget = document.querySelector('.instance-overlay') ?? document.body;
        outsideTarget.dispatchEvent(
          new MouseEvent('mousedown', {
            bubbles: true,
            button: 0,
            buttons: 1,
            cancelable: true,
            view: window,
          }),
        );

        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLElement) {
          activeElement.blur();
        }

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      })
      .catch(() => {});

    await page.waitForTimeout(150);
    await page.evaluate(() => {
      document.body.classList.add('live-demo-location-suggestions-dismissed');
    });
  }

  await page.evaluate(() => {
    document.body.classList.add('live-demo-location-suggestions-dismissed');
  });
  await expect(suggestions.first()).toBeHidden({ timeout: 1_000 });
}

async function expandNativeSelectForVideo(selectLocator: Locator, optionValue: string) {
  return await selectLocator.evaluate((select, selectedOptionValue) => {
    const htmlSelect = select as HTMLSelectElement;
    const optionIndex = Array.from(htmlSelect.options).findIndex(
      (option) => option.value === selectedOptionValue,
    );
    const visibleOptionCount = Math.min(Math.max(htmlSelect.options.length, 2), 7);
    const firstVisibleIndex = Math.max(
      0,
      Math.min(optionIndex - 2, Math.max(htmlSelect.options.length - visibleOptionCount, 0)),
    );
    const visibleOptionIndex = Math.max(0, optionIndex - firstVisibleIndex);

    htmlSelect.dataset.liveDemoOriginalSize = htmlSelect.getAttribute('size') ?? '';
    htmlSelect.dataset.liveDemoOriginalPosition = htmlSelect.style.position;
    htmlSelect.dataset.liveDemoOriginalZIndex = htmlSelect.style.zIndex;
    htmlSelect.dataset.liveDemoOriginalMinWidth = htmlSelect.style.minWidth;
    htmlSelect.dataset.liveDemoOriginalBoxShadow = htmlSelect.style.boxShadow;
    htmlSelect.dataset.liveDemoVisibleOptionCount = String(visibleOptionCount);
    htmlSelect.dataset.liveDemoVisibleOptionIndex = String(visibleOptionIndex);

    htmlSelect.setAttribute('size', String(visibleOptionCount));
    htmlSelect.style.position = 'relative';
    htmlSelect.style.zIndex = '2147483646';
    htmlSelect.style.minWidth = `${Math.max(htmlSelect.offsetWidth, 190)}px`;
    htmlSelect.style.boxShadow = '0 8px 20px rgb(0 0 0 / 0.35)';

    if (optionIndex >= 0) {
      const optionHeight = htmlSelect.scrollHeight / Math.max(htmlSelect.options.length, 1);
      htmlSelect.scrollTop = Math.max(0, optionHeight * firstVisibleIndex);
    }

    return { visibleOptionCount, visibleOptionIndex };
  }, optionValue);
}

async function collapseNativeSelectForVideo(selectLocator: Locator) {
  await selectLocator.evaluate((select) => {
    const htmlSelect = select as HTMLSelectElement;
    const originalSize = htmlSelect.dataset.liveDemoOriginalSize;

    if (originalSize) {
      htmlSelect.setAttribute('size', originalSize);
    } else {
      htmlSelect.removeAttribute('size');
    }

    htmlSelect.style.position = htmlSelect.dataset.liveDemoOriginalPosition ?? '';
    htmlSelect.style.zIndex = htmlSelect.dataset.liveDemoOriginalZIndex ?? '';
    htmlSelect.style.minWidth = htmlSelect.dataset.liveDemoOriginalMinWidth ?? '';
    htmlSelect.style.boxShadow = htmlSelect.dataset.liveDemoOriginalBoxShadow ?? '';

    delete htmlSelect.dataset.liveDemoOriginalSize;
    delete htmlSelect.dataset.liveDemoOriginalPosition;
    delete htmlSelect.dataset.liveDemoOriginalZIndex;
    delete htmlSelect.dataset.liveDemoOriginalMinWidth;
    delete htmlSelect.dataset.liveDemoOriginalBoxShadow;
    delete htmlSelect.dataset.liveDemoVisibleOptionCount;
    delete htmlSelect.dataset.liveDemoVisibleOptionIndex;
  });
}

async function clickExpandedNativeSelectOptionForVideo(
  selectLocator: Locator,
  optionValue: string,
  visibleOptionCount: number,
  visibleOptionIndex: number,
  timeout = 10_000,
) {
  const page = selectLocator.page();
  await expect(selectLocator).toBeVisible({ timeout });

  const box = await selectLocator.boundingBox();
  if (!box) {
    await selectLocator.selectOption(optionValue);
    return;
  }

  const rowHeight = box.height / Math.max(visibleOptionCount, 1);
  const optionX = Math.round(box.x + box.width / 2);
  const optionY = Math.round(
    box.y + rowHeight * Math.min(Math.max(visibleOptionIndex, 0), visibleOptionCount - 1) +
      rowHeight / 2,
  );

  await page.evaluate(
    ({ nextX, nextY }) => {
      type DemoVideoWindow = Window & {
        __setLiveDemoCursor?: (x: number, y: number) => void;
      };
      (window as DemoVideoWindow).__setLiveDemoCursor?.(nextX, nextY);
    },
    { nextX: optionX, nextY: optionY },
  );
  await page.mouse.move(optionX, optionY, { steps: 12 });
  await showVideoTapAtPoint(page, optionX, optionY);
  await page.mouse.click(optionX, optionY);
  await page.waitForTimeout(120);

  const selectedValue = await selectLocator.evaluate((select) => (select as HTMLSelectElement).value);
  if (selectedValue !== optionValue) {
    await selectLocator.selectOption(optionValue);
  }
}

async function selectCostumeOption(
  page: Page,
  pattern: RegExp,
  description: string,
  showVideoCue = false,
) {
  const costumeSelect = page.locator('.costume-dropdown select').first();
  await expect(costumeSelect).toBeVisible({ timeout: 30_000 });

  const optionValue = await costumeSelect.evaluate((select, patternSource) => {
    const matcher = new RegExp(patternSource, 'i');
    const options = Array.from((select as HTMLSelectElement).options);
    const option = options.find(
      (candidate) =>
        matcher.test(candidate.value) ||
        matcher.test(candidate.textContent ?? ''),
    );

    return option?.value ?? '';
  }, pattern.source);

  expect(optionValue, `Expected ${description} costume option`).not.toBe('');

  if (showVideoCue) {
    await moveVideoCursorToLocator(costumeSelect);
    await showVideoTapAtLocator(costumeSelect);
    const { visibleOptionCount, visibleOptionIndex } = await expandNativeSelectForVideo(
      costumeSelect,
      optionValue,
    );
    await page.waitForTimeout(searchVideoCostumeMenuPauseMs);
    await clickExpandedNativeSelectOptionForVideo(
      costumeSelect,
      optionValue,
      visibleOptionCount,
      visibleOptionIndex,
    );
    await page.waitForTimeout(searchVideoActionPauseMs);
    await collapseNativeSelectForVideo(costumeSelect);
  } else {
    await costumeSelect.selectOption(optionValue);
  }
  await hideToastNotifications(page);
}

async function chooseShinyDetectivePikachu(page: Page) {
  const pokemonInput = page.getByPlaceholder('Enter Pokemon name');
  await pokemonInput.fill('Pikachu');
  await clickIfVisible(page.getByRole('button', { name: 'Pikachu', exact: true }), 2_000);
  await page.getByRole('button', { name: /toggle shiny/i }).click({ timeout: 10_000 });
  await page.getByRole('button', { name: /toggle costume/i }).click({ timeout: 10_000 });
  await selectCostumeOption(page, /detective/, 'Detective Pikachu');
  await waitForVisibleImagesReady(page, 30_000);
}

async function chooseShinyDetectivePikachuForVideo(page: Page) {
  const pokemonInput = page.getByPlaceholder('Enter Pokemon name');
  await clickForVideo(pokemonInput, 10_000);
  await pokemonInput.fill('');
  await pokemonInput.pressSequentially('Pikachu', { delay: searchVideoTypingDelayMs });
  await page.waitForTimeout(150);
  await clickIfVisibleForVideo(page.getByRole('button', { name: 'Pikachu', exact: true }), 4_000);
  await page.waitForTimeout(150);

  await clickForVideo(page.getByRole('button', { name: /toggle shiny/i }), 10_000);
  await page.waitForTimeout(150);
  await clickForVideo(page.getByRole('button', { name: /toggle costume/i }), 10_000);
  await page.waitForTimeout(150);
  await selectCostumeOption(page, /detective/, 'Detective Pikachu', true);
  await waitForVisibleImagesReady(page, 12_000);
}

function getMapPopupLocator(page: Page) {
  return page
    .locator(
      '.ol-popup .caught-popup-container, .ol-popup .trade-popup-container, .ol-popup .wanted-popup-container',
    )
    .first();
}

type MapClickCandidate = {
  x: number;
  y: number;
  pixelCount: number;
};

function isCaughtMapMarkerPixel(data: Buffer, index: number) {
  const red = data[index];
  const green = data[index + 1];
  const blue = data[index + 2];
  const alpha = data[index + 3];

  return (
    alpha > 220 &&
    red < 90 &&
    green > 110 &&
    green < 230 &&
    blue > 180 &&
    blue - red > 120 &&
    blue - green > 10
  );
}

function findCaughtMapMarkerCandidates(
  screenshotBuffer: Buffer,
  box: NonNullable<Awaited<ReturnType<Locator['boundingBox']>>>,
) {
  const image = PNG.sync.read(screenshotBuffer);
  const { width, height, data } = image;
  const scaleX = width / box.width;
  const scaleY = height / box.height;
  const visited = new Uint8Array(width * height);
  const candidates: MapClickCandidate[] = [];

  for (let startY = 0; startY < height; startY += 1) {
    for (let startX = 0; startX < width; startX += 1) {
      const startPosition = startY * width + startX;
      const startIndex = startPosition * 4;
      if (visited[startPosition] || !isCaughtMapMarkerPixel(data, startIndex)) {
        continue;
      }

      const stack: Array<[number, number]> = [[startX, startY]];
      let pixelCount = 0;
      let sumX = 0;
      let sumY = 0;
      let minX = startX;
      let maxX = startX;
      let minY = startY;
      let maxY = startY;
      visited[startPosition] = 1;

      while (stack.length > 0) {
        const [x, y] = stack.pop() ?? [0, 0];
        pixelCount += 1;
        sumX += x;
        sumY += y;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);

        for (const [nextX, nextY] of [
          [x + 1, y],
          [x - 1, y],
          [x, y + 1],
          [x, y - 1],
        ]) {
          if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) {
            continue;
          }

          const nextPosition = nextY * width + nextX;
          const nextIndex = nextPosition * 4;
          if (visited[nextPosition] || !isCaughtMapMarkerPixel(data, nextIndex)) {
            continue;
          }

          visited[nextPosition] = 1;
          stack.push([nextX, nextY]);
        }
      }

      const markerWidth = maxX - minX + 1;
      const markerHeight = maxY - minY + 1;
      const touchesEdge =
        minX <= 1 ||
        minY <= 1 ||
        maxX >= width - 2 ||
        maxY >= height - 2;

      if (
        pixelCount >= 20 &&
        markerWidth >= 4 &&
        markerHeight >= 4 &&
        markerWidth <= 32 &&
        markerHeight <= 32 &&
        !touchesEdge
      ) {
        candidates.push({
          x: Math.round((sumX / pixelCount) / scaleX),
          y: Math.round((sumY / pixelCount) / scaleY),
          pixelCount,
        });
      }
    }
  }

  const viewportCenterX = box.width / 2;
  const viewportCenterY = box.height / 2;
  return candidates.sort((left, right) => {
    const leftDistance = Math.hypot(left.x - viewportCenterX, left.y - viewportCenterY);
    const rightDistance = Math.hypot(right.x - viewportCenterX, right.y - viewportCenterY);
    return leftDistance - rightDistance || right.pixelCount - left.pixelCount;
  });
}

async function getMapMarkerClickCandidates(
  mapViewport: Locator,
  box: NonNullable<Awaited<ReturnType<Locator['boundingBox']>>>,
) {
  const screenshotBuffer = await mapViewport.screenshot({ animations: 'disabled' });
  return findCaughtMapMarkerCandidates(screenshotBuffer, box);
}

async function openMapResultPopup(page: Page, showVideoCue = false) {
  const mapViewport = page.locator('.ol-viewport').first();
  await expect(mapViewport).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(searchVideoMapReadyPauseMs);

  const box = await mapViewport.boundingBox();
  if (!box) {
    throw new Error('Map viewport did not have a bounding box for demo capture.');
  }

  const popup = getMapPopupLocator(page);
  let markerCandidates: MapClickCandidate[] = [];
  const markerDeadline = Date.now() + 3_000;
  while (Date.now() < markerDeadline) {
    markerCandidates = await getMapMarkerClickCandidates(mapViewport, box);
    if (markerCandidates.length > 0) {
      break;
    }
    await page.waitForTimeout(250);
  }
  const fallbackCandidateFractions: Array<[number, number]> = [
    [0.5, 0.5],
    [0.45, 0.5],
    [0.55, 0.5],
    [0.5, 0.45],
    [0.5, 0.55],
    [0.38, 0.5],
    [0.62, 0.5],
    [0.5, 0.38],
    [0.5, 0.62],
    [0.35, 0.35],
    [0.65, 0.35],
    [0.35, 0.65],
    [0.65, 0.65],
  ];
  const fallbackCandidates = fallbackCandidateFractions.map(([xFraction, yFraction]) => ({
    x: Math.round(box.width * xFraction),
    y: Math.round(box.height * yFraction),
    pixelCount: 0,
  }));
  const clickCandidates = [...markerCandidates, ...fallbackCandidates].flatMap((candidate) => {
    const offsets: Array<[number, number]> =
      candidate.pixelCount > 0
        ? [
            [0, 0],
            [0, -8],
            [8, 0],
            [0, 8],
            [-8, 0],
          ]
        : [[0, 0]];

    return offsets.map(([offsetX, offsetY]) => ({
      ...candidate,
      x: Math.max(1, Math.min(Math.round(box.width - 2), candidate.x + offsetX)),
      y: Math.max(1, Math.min(Math.round(box.height - 2), candidate.y + offsetY)),
    }));
  });
  const attemptedCandidates: MapClickCandidate[] = [];

  for (let attempt = 0; attempt < clickCandidates.length; attempt += 1) {
    const { x, y } = clickCandidates[attempt];
    attemptedCandidates.push(clickCandidates[attempt]);
    const absoluteX = Math.round(box.x + x);
    const absoluteY = Math.round(box.y + y);
    if (showVideoCue && attempt === 0) {
      await page.evaluate(
        ({ nextX, nextY }) => {
          type DemoVideoWindow = Window & {
            __setLiveDemoCursor?: (x: number, y: number) => void;
          };
          (window as DemoVideoWindow).__setLiveDemoCursor?.(nextX, nextY);
        },
        { nextX: absoluteX, nextY: absoluteY },
      );
      await page.mouse.move(absoluteX, absoluteY, { steps: 16 });
      await showVideoTapAtPoint(page, absoluteX, absoluteY);
    } else {
      await page.mouse.move(absoluteX, absoluteY, { steps: 1 });
    }
    await mapViewport.click({ position: { x, y }, force: true });
    await hideToastNotifications(page);

    if (await popup.isVisible({ timeout: attempt === 0 ? 1_500 : 650 }).catch(() => false)) {
      await waitForVisibleImagesReady(page, 30_000);
      await page.waitForTimeout(250);
      return;
    }
  }

  const diagnosticsPath = path.join(liveDemoVideoDir, `map-popup-failure-${Date.now()}`);
  const diagnosticDetails = {
    mapViewportBox: {
      x: Math.round(box.x),
      y: Math.round(box.y),
      width: Math.round(box.width),
      height: Math.round(box.height),
    },
    markerCandidates: markerCandidates.slice(0, 12),
    attemptedCandidates: attemptedCandidates.slice(0, 24),
  };

  fs.writeFileSync(`${diagnosticsPath}.json`, JSON.stringify(diagnosticDetails, null, 2));
  await mapViewport
    .screenshot({
      path: `${diagnosticsPath}.png`,
      animations: 'disabled',
    })
    .catch(() => {});

  throw new Error(
    [
      'Could not open a search map result popup for demo capture.',
      `Diagnostics written to ${diagnosticsPath}.json and ${diagnosticsPath}.png`,
      JSON.stringify(diagnosticDetails, null, 2),
    ].join('\n'),
  );
}

async function hideToastNotifications(page: Page) {
  await page.evaluate(() => {
    for (const element of Array.from(
      document.querySelectorAll<HTMLElement>(
        '.Toastify, .Toastify__toast-container, .Toastify__toast',
      ),
    )) {
      element.style.display = 'none';
      element.style.pointerEvents = 'none';
      element.style.visibility = 'hidden';
    }
  });
}

async function waitForAppSettled(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 12_000 }).catch(() => {});
  await expect(page.locator('.app-loading-overlay')).toHaveCount(0, { timeout: 30_000 });
}

async function waitForPokemonCatalogReady(page: Page, timeout = 60_000) {
  try {
    await page.waitForFunction(
      () => {
        const timestamp = Number(window.localStorage.getItem('variantsTimestamp') ?? '0');
        return Number.isFinite(timestamp) && timestamp > 0;
      },
      undefined,
      { timeout },
    );
    return true;
  } catch {
    return false;
  }
}

async function waitForAnyVisible(page: Page, locators: Locator[], timeout = 30_000) {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    for (const locator of locators) {
      if (await locator.first().isVisible({ timeout: 250 }).catch(() => false)) {
        return locator.first();
      }
    }
    await page.waitForTimeout(250);
  }

  throw new Error('Timed out waiting for expected live-capture UI state.');
}

async function waitForVisibleImagesReady(page: Page, timeout = 30_000) {
  await page
    .waitForFunction(
      () => {
        const visibleImages = Array.from(document.images).filter((image) => {
          const rect = image.getBoundingClientRect();
          const style = window.getComputedStyle(image);

          return (
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            rect.width > 2 &&
            rect.height > 2 &&
            rect.bottom >= 0 &&
            rect.right >= 0 &&
            rect.top <= window.innerHeight &&
            rect.left <= window.innerWidth
          );
        });

        return visibleImages.every((image) => image.complete);
      },
      undefined,
      { timeout },
    )
    .catch(() => {});
  await page.waitForTimeout(500);
}

async function waitForCollectionMediaReady(page: Page, timeout = 90_000) {
  await page.evaluate(() => {
    for (const image of Array.from(document.querySelectorAll<HTMLImageElement>('.pokemon-card img'))) {
      image.loading = 'eager';
      image.decoding = 'sync';
    }
  });

  await page.waitForFunction(
    () => {
      const isInViewport = (element: Element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);

        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          rect.width > 2 &&
          rect.height > 2 &&
          rect.bottom >= 0 &&
          rect.right >= 0 &&
          rect.top <= window.innerHeight &&
          rect.left <= window.innerWidth
        );
      };

      const visibleCards = Array.from(document.querySelectorAll<HTMLElement>('.pokemon-card'))
        .filter(isInViewport);
      const visibleCardImages = visibleCards.flatMap((card) =>
        Array.from(card.querySelectorAll<HTMLImageElement>('img')).filter(isInViewport),
      );

      return (
        visibleCards.length > 0 &&
        visibleCardImages.length > 0 &&
        visibleCardImages.every(
          (image) =>
            Boolean(image.currentSrc || image.src) &&
            image.complete &&
            image.naturalWidth > 0 &&
            image.naturalHeight > 0,
        )
      );
    },
    undefined,
    { timeout },
  );

  await page.evaluate(async () => {
    const cssUrlPattern = /url\((['"]?)(.*?)\1\)/g;
    const isInViewport = (element: Element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);

      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        rect.width > 2 &&
        rect.height > 2 &&
        rect.bottom >= 0 &&
        rect.right >= 0 &&
        rect.top <= window.innerHeight &&
        rect.left <= window.innerWidth
      );
    };
    const decodeImage = async (image: HTMLImageElement) => {
      if (image.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
        await image.decode().catch(() => {});
      }
    };
    const preloadUrl = async (url: string) => {
      const image = new Image();
      image.src = url;
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error(`Could not preload ${url}`));
      });
      await image.decode().catch(() => {});
    };

    const visibleCards = Array.from(document.querySelectorAll<HTMLElement>('.pokemon-card'))
      .filter(isInViewport);
    const visibleImages = visibleCards.flatMap((card) =>
      Array.from(card.querySelectorAll<HTMLImageElement>('img')).filter(isInViewport),
    );
    const cssBackgroundUrls = visibleCards.flatMap((card) =>
      Array.from(card.querySelectorAll<HTMLElement>('*')).flatMap((element) => {
        const urls: string[] = [];
        const backgroundImage = window.getComputedStyle(element).backgroundImage;
        let match: RegExpExecArray | null;
        while ((match = cssUrlPattern.exec(backgroundImage)) !== null) {
          if (match[2]) urls.push(match[2]);
        }
        return urls;
      }),
    );

    await Promise.all([
      ...visibleImages.map(decodeImage),
      ...Array.from(new Set(cssBackgroundUrls)).map(preloadUrl),
    ]);
  });
  await page.waitForTimeout(750);
}

async function isPokemonPanelCentered(page: Page) {
  return await page
    .evaluate(() => {
      const pokemonPanel = document.querySelectorAll<HTMLElement>('.slider-panel')[1];
      if (!pokemonPanel) return false;

      const panelRect = pokemonPanel.getBoundingClientRect();
      return Math.abs(panelRect.left) <= 8;
    })
    .catch(() => false);
}

async function forcePokemonPanelCentered(page: Page) {
  await page.evaluate(() => {
    const slider = document.querySelector<HTMLElement>('.view-slider');
    const pokemonPanel = document.querySelectorAll<HTMLElement>('.slider-panel')[1];
    if (!slider || !pokemonPanel) return;

    const transform = window.getComputedStyle(slider).transform;
    const currentX = transform && transform !== 'none'
      ? new DOMMatrixReadOnly(transform).m41
      : 0;
    const panelLeft = pokemonPanel.getBoundingClientRect().left;
    const nextX = Math.round(currentX - panelLeft);

    slider.style.setProperty('transition', 'none', 'important');
    slider.style.setProperty('transform', `translate3d(${nextX}px, 0, 0)`, 'important');
  });
}

async function centerPokemonPanel(page: Page) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (await isPokemonPanelCentered(page)) {
      await page.waitForTimeout(250);
      return;
    }

    await hideToastNotifications(page);
    await page.getByText('Pokémon', { exact: true }).first().click({ timeout: 5_000 }).catch(
      async () => {
        await page.locator('.controls-row .toggle-col').nth(1).click({ timeout: 5_000 });
      },
    );
    await page.waitForTimeout(650);
  }

  await forcePokemonPanelCentered(page);
  await page.waitForTimeout(350);
}

async function capture(page: Page, name: string, options: Parameters<Page['screenshot']>[0] = {}) {
  await page.mouse.move(4, 4);
  await page.waitForTimeout(100);
  await prepareMediaFrame(page);
  await waitForVisibleImagesReady(page);

  await page.screenshot({
    path: path.join(liveDemoMediaDir, `${name}.png`),
    fullPage: false,
    animations: 'disabled',
    ...options,
  });
}

async function prepareMediaFrame(page: Page) {
  await hideToastNotifications(page);
  await page.evaluate(() => {
    for (const button of Array.from(document.querySelectorAll('button'))) {
      if (button.textContent?.includes('Perf telemetry')) {
        const panel = button.parentElement;
        if (panel) {
          panel.style.display = 'none';
        }
      }
    }
  });
}

function generateDisposableAuthAccount(): DisposableAuthAccount {
  const suffix = crypto.randomBytes(4).toString('hex');
  const trainerCode = generateTrainerCode();

  return {
    username: `demo_${suffix}`,
    updatedUsername: `demo_${suffix}_updated`,
    email: `pokegonexus-demo-${Date.now().toString(36)}-${suffix}@example.com`,
    password: `DemoAuth1!${suffix}`,
    pokemonGoName: `pg_${suffix}`,
    location: 'Vancouver, British Columbia, Canada',
    trainerCode,
  };
}

async function createDisposableAuthAccount(
  context: BrowserContext,
  account: DisposableAuthAccount,
) {
  const response = await context.request.post(authApiUrl('/register'), {
    data: {
      username: account.username,
      email: account.email,
      password: account.password,
      trainerCode: account.trainerCode,
      pokemonGoName: account.pokemonGoName,
      pokemonGoNameDisabled: false,
      locationInput: account.location,
      location: account.location,
      coordinates: {
        latitude: 49.2827,
        longitude: -123.1207,
      },
      allowLocation: true,
      device_id: 'live-demo-workflow-capture-setup',
    },
  });

  const body = await response.text().catch(() => '');
  expect(
    response.ok(),
    `disposable workflow account registration failed with ${response.status()}: ${body}`,
  ).toBe(true);
}

async function readStoredAuthUserId(page: Page) {
  return await page
    .evaluate(() => {
      const rawUser = window.localStorage.getItem('user');
      if (!rawUser) return '';

      try {
        const user = JSON.parse(rawUser) as { user_id?: unknown };
        return typeof user.user_id === 'string' ? user.user_id : '';
      } catch {
        return '';
      }
    })
    .catch(() => '');
}

async function cleanupDisposableAuthAccount(
  context: BrowserContext,
  account: DisposableAuthAccount,
) {
  if (account.deleted) return;

  const deleteById = async (userId: string) =>
    await context.request.delete(authApiUrl(`/delete/${encodeURIComponent(userId)}`), {
      data: { currentPassword: account.password },
    });

  if (account.userId) {
    const deleteResponse = await deleteById(account.userId);
    if (deleteResponse.ok() || deleteResponse.status() === 404) {
      account.deleted = true;
      return;
    }

    if (![401, 403].includes(deleteResponse.status())) {
      throw new Error(
        `Could not delete disposable auth account during cleanup: ${deleteResponse.status()}`,
      );
    }
  }

  const loginResponse = await context.request.post(authApiUrl('/login'), {
    data: {
      username: account.username,
      password: account.password,
      device_id: 'live-demo-auth-capture-cleanup',
    },
  });

  if (!loginResponse.ok()) {
    if (loginResponse.status() === 404) {
      account.deleted = true;
      return;
    }

    throw new Error(
      `Could not log in disposable auth account for cleanup: ${loginResponse.status()}`,
    );
  }

  const loginBody = (await loginResponse.json().catch(() => ({}))) as { user_id?: unknown };
  const userId = typeof loginBody.user_id === 'string' ? loginBody.user_id : account.userId;

  if (!userId) {
    throw new Error('Could not resolve disposable auth account user_id for cleanup.');
  }

  const deleteResponse = await deleteById(userId);

  if (!deleteResponse.ok() && deleteResponse.status() !== 404) {
    throw new Error(
      `Could not delete disposable auth account during cleanup: ${deleteResponse.status()}`,
    );
  }

  account.deleted = true;
}

async function cleanupDisposableAuthAccountFromPage(
  page: Page,
  account: DisposableAuthAccount,
) {
  if (account.deleted) return true;

  account.userId = account.userId || (await readStoredAuthUserId(page));
  if (!account.userId) return false;

  const result = await page.evaluate(async ({ deleteUrl, currentPassword }) => {
    const response = await fetch(deleteUrl, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword }),
    });

    return {
      ok: response.ok,
      status: response.status,
      body: await response.text().catch(() => ''),
    };
  }, {
    deleteUrl: authApiUrl(`/delete/${encodeURIComponent(account.userId)}`),
    currentPassword: account.password,
  });

  if (result.ok || result.status === 404) {
    account.deleted = true;
    return true;
  }

  if ([401, 403].includes(result.status)) {
    return false;
  }

  throw new Error(
    `Could not delete disposable auth account from page session: ${result.status} ${result.body}`,
  );
}

async function fillRegisterFormForVideo(page: Page, account: DisposableAuthAccount) {
  const usernameInput = page.getByPlaceholder('Choose a unique username');
  await clickForVideo(usernameInput, 10_000);
  await usernameInput.fill(account.username);
  await page.waitForTimeout(authVideoActionPauseMs);

  const emailInput = page.getByPlaceholder('you@example.com');
  await clickForVideo(emailInput, 10_000);
  await emailInput.fill(account.email);
  await page.waitForTimeout(authVideoActionPauseMs);

  await clickForVideo(page.getByTestId('register-button'), 10_000);

  const passwordInput = page.getByPlaceholder('Create a password');
  await clickForVideo(passwordInput, 10_000);
  await passwordInput.fill(account.password);
  await page.waitForTimeout(authVideoActionPauseMs);

  const confirmPasswordInput = page.getByPlaceholder('Enter it again');
  await clickForVideo(confirmPasswordInput, 10_000);
  await confirmPasswordInput.fill(account.password);
  await page.waitForTimeout(authVideoActionPauseMs);
  await clickForVideo(page.getByTestId('register-button'), 10_000);

  const pokemonGoNameInput = page.getByRole('textbox', {
    name: 'Pokémon GO name',
    exact: true,
  });
  await clickForVideo(pokemonGoNameInput, 10_000);
  await pokemonGoNameInput.fill(account.pokemonGoName);
  await page.waitForTimeout(authVideoActionPauseMs);

  const trainerCodeInput = page.getByTestId('trainer-code-input');
  await clickForVideo(trainerCodeInput, 10_000);
  await trainerCodeInput.fill(account.trainerCode);
  await page.waitForTimeout(authVideoActionPauseMs);
  await clickForVideo(page.getByTestId('register-button'), 10_000);

  const locationInput = page.getByPlaceholder('City, region, country');
  await clickForVideo(locationInput, 10_000);
  await locationInput.fill(account.location);
  const firstLocationSuggestion = page.locator('.register-location-field .suggestion-item').first();
  const hasSuggestion = await firstLocationSuggestion
    .waitFor({ state: 'visible', timeout: 10_000 })
    .then(() => true)
    .catch(() => false);

  if (hasSuggestion) {
    await clickForVideo(firstLocationSuggestion, 10_000);
    await expect(page.locator('.register-location-field .suggestions-dropdown')).toHaveCount(0, {
      timeout: 10_000,
    });
  } else {
    await page.keyboard.press('Tab');
    await expect(page.locator('.register-location-field .suggestions-dropdown')).toHaveCount(0, {
      timeout: 10_000,
    });
  }

  await page.waitForTimeout(authVideoActionPauseMs);
  await clickForVideo(page.getByTestId('register-button'), 10_000);
  await expect(page.getByRole('heading', { name: 'Ready to join' })).toBeVisible();
}

async function fillLoginFormForVideo(page: Page, account: DisposableAuthAccount) {
  const usernameInput = page.getByPlaceholder('Username or Email');
  await clickForVideo(usernameInput, 10_000);
  await usernameInput.fill(account.username);
  await page.waitForTimeout(authVideoActionPauseMs);

  const passwordInput = page.getByPlaceholder('Password');
  await clickForVideo(passwordInput, 10_000);
  await passwordInput.fill(account.password);
  await page.waitForTimeout(authVideoActionPauseMs);
}

async function navigateFromActionMenuForVideo(
  page: Page,
  label: string,
  targetPath: string,
  requiresStoredUser = false,
) {
  if (requiresStoredUser) {
    await page.waitForFunction(() => Boolean(window.localStorage.getItem('user')), null, {
      timeout: 15_000,
    });
  }

  await clickForVideo(page.getByRole('button', { name: /Action Menu/i }), 10_000);
  await expect(page.locator('.action-menu-overlay.active')).toBeVisible({ timeout: 10_000 });
  await pauseForVideo(page, 250);

  const accountControls = page.locator('.action-menu-overlay.active .auth-button-container');
  await expect(accountControls).toContainText(label, { timeout: 10_000 });
  const authButton = accountControls.locator('.auth-button').filter({ hasText: label }).first();
  await hideToastNotifications(page);
  await moveVideoCursorToLocator(authButton);
  await page.mouse.down();
  await page.waitForTimeout(100);
  await page.goto(targetPath, { waitUntil: 'domcontentloaded' });
  await page.mouse.up().catch(() => {});
}

async function openRegisterFromHomeForVideo(page: Page, recordingStartedAt: number) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: /Action Menu/i })).toBeVisible({
    timeout: 30_000,
  });
  await waitForAppSettled(page);
  const trimStartMs = videoTrimStart(recordingStartedAt);
  await pauseForVideo(page, 600);
  await navigateFromActionMenuForVideo(page, 'Register', '/register');
  const emailMethodButton = page.getByRole('button', { name: 'Continue with email' });
  await expect(emailMethodButton).toBeVisible({ timeout: 30_000 });
  await clickForVideo(emailMethodButton, 10_000);
  await expect(page.getByPlaceholder('Choose a unique username')).toBeVisible({
    timeout: 30_000,
  });

  return { trimStartMs };
}

async function openAccountDetailsFromActionMenuForVideo(page: Page) {
  await page.waitForFunction(() => Boolean(window.localStorage.getItem('user')), null, {
    timeout: 15_000,
  });
  await clickForVideo(page.getByRole('button', { name: /Action Menu/i }), 10_000);
  const actionMenu = page.locator('.action-menu-overlay.active');
  await expect(actionMenu).toBeVisible({ timeout: 10_000 });
  await clickForVideo(actionMenu.locator('.settings-button'), 10_000);
  await expect(page.getByRole('navigation', { name: 'Settings pages' })).toBeVisible({
    timeout: 30_000,
  });
  await clickForVideo(page.getByRole('link', { name: 'Account', exact: true }), 10_000);
  await expect(page.getByRole('heading', { name: 'Account details' })).toBeVisible({
    timeout: 45_000,
  });
}

async function editDisposableAccountDetailsForVideo(
  page: Page,
  account: DisposableAuthAccount,
) {
  const usernameInput = page.getByRole('textbox', { name: 'Username', exact: true });
  await expect(usernameInput).toBeEnabled({ timeout: 10_000 });
  await page.waitForTimeout(200);

  await clickForVideo(usernameInput, 10_000);
  await usernameInput.fill(account.updatedUsername);
  await page.waitForTimeout(250);

  const updateResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'PUT' &&
      /\/api\/auth\/update\/[^/]+\/?$/.test(new URL(response.url()).pathname),
    { timeout: 30_000 },
  );
  await clickForVideo(page.getByRole('button', { name: 'Update account' }), 10_000);
  const update = await updateResponse;
  expect(update.ok(), `disposable account update failed with ${update.status()}`).toBe(true);
  account.username = account.updatedUsername;
  await expect(page.getByRole('button', { name: 'Update account' })).toBeVisible({
    timeout: 30_000,
  });
  await pauseForVideo(page, 550);
}

async function performAuthLifecycleVideoFlow(
  page: Page,
  account: DisposableAuthAccount,
  recordingStartedAt: number,
) {
  const { trimStartMs } = await openRegisterFromHomeForVideo(page, recordingStartedAt);
  await pauseForVideo(page, 250);

  await fillRegisterFormForVideo(page, account);

  const registerResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      /\/api\/auth\/register\/?$/.test(new URL(response.url()).pathname),
    { timeout: 30_000 },
  );

  await clickForVideo(page.getByTestId('register-button'), 10_000);
  const registration = await registerResponse;
  const registrationBody = await registration.text().catch(() => '');
  expect(
    registration.ok(),
    `disposable account registration failed with ${registration.status()}: ${registrationBody}`,
  ).toBe(true);
  const autoLoginResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      /\/api\/auth\/login\/?$/.test(new URL(response.url()).pathname),
    { timeout: 45_000 },
  );
  const autoLogin = await autoLoginResponse;
  expect(autoLogin.ok(), `post-registration login failed with ${autoLogin.status()}`).toBe(true);
  const autoLoginBody = (await autoLogin.json().catch(() => ({}))) as { user_id?: unknown };
  if (typeof autoLoginBody.user_id === 'string') {
    account.userId = autoLoginBody.user_id;
  }

  await expect(
    page.getByRole('heading', { name: /Successfully Registered and Logged in/i }),
  ).toBeVisible({ timeout: 45_000 });
  await pauseForVideo(page, 450);

  await openAccountDetailsFromActionMenuForVideo(page);
  account.userId = account.userId || (await readStoredAuthUserId(page));
  await pauseForVideo(page, 450);
  await editDisposableAccountDetailsForVideo(page, account);

  if (authIncludeExplicitLogin) {
    await clickForVideo(page.getByRole('button', { name: 'Sign out', exact: true }), 10_000);
    await expect(page.getByPlaceholder('Username or Email')).toBeVisible({ timeout: 30_000 });
    await pauseForVideo(page, 350);

    await fillLoginFormForVideo(page, account);

    const loginResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        /\/api\/auth\/login\/?$/.test(new URL(response.url()).pathname),
      { timeout: 30_000 },
    );
    const overviewResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' && isUserOverviewRequest(response.url()),
      { timeout: 60_000 },
    );

    await clickForVideo(page.getByRole('button', { name: 'Login', exact: true }), 10_000);
    const login = await loginResponse;
    expect(login.ok(), `disposable account login failed with ${login.status()}`).toBe(true);
    const overview = await overviewResponse;
    expect(overview.ok(), `disposable account overview failed with ${overview.status()}`).toBe(true);
    const loginBody = (await login.json().catch(() => ({}))) as { user_id?: unknown };
    if (typeof loginBody.user_id === 'string') {
      account.userId = loginBody.user_id;
    }

    await expect(page.getByRole('heading', { name: /Successfully Logged in/i })).toBeVisible({
      timeout: 30_000,
    });
    await pauseForVideo(page, 450);

    await openAccountDetailsFromActionMenuForVideo(page);
    account.userId = account.userId || (await readStoredAuthUserId(page));
    await pauseForVideo(page, 500);
  }

  const currentPasswordInput = page.getByPlaceholder('Required for security changes');
  if (await currentPasswordInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await clickForVideo(currentPasswordInput, 10_000);
    await currentPasswordInput.fill(account.password);
    await pauseForVideo(page, 250);
  }

  const userDataDeleteResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'DELETE' &&
      /\/api\/users\/[^/]+\/?$/.test(new URL(response.url()).pathname),
    { timeout: 30_000 },
  );
  const authDeleteResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'DELETE' &&
      /\/api\/auth\/delete\/[^/]+\/?$/.test(new URL(response.url()).pathname),
    { timeout: 30_000 },
  );
  await clickForVideo(page.getByRole('button', { name: 'Delete account', exact: true }), 10_000);
  await expect(page.getByText(/Permanently delete your account/i)).toBeVisible({
    timeout: 10_000,
  });
  await pauseForVideo(page, 300);
  await clickForVideo(page.getByRole('button', { name: 'OK' }), 10_000);
  const userDataDeletion = await userDataDeleteResponse;
  expect(
    userDataDeletion.ok(),
    `disposable user-data deletion failed with ${userDataDeletion.status()}`,
  ).toBe(true);
  const authDeletion = await authDeleteResponse;
  expect(
    authDeletion.ok(),
    `disposable authentication deletion failed with ${authDeletion.status()}`,
  ).toBe(true);
  account.deleted = true;

  await expect(page.getByPlaceholder('Username or Email')).toBeVisible({ timeout: 30_000 });
  await pauseForVideo(page, 450);

  return { trimStartMs };
}

async function loginWithAccountCredentials(page: Page, username: string, password: string) {
  const usernameInput = page.getByPlaceholder('Username or Email');
  await gotoLoginPageWithRetry(page, usernameInput);

  await usernameInput.fill(username);
  await page.getByPlaceholder('Password').fill(password);

  const loginResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      /\/api\/auth\/login\/?$/.test(new URL(response.url()).pathname),
    { timeout: 30_000 },
  );
  const overviewResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' && isUserOverviewRequest(response.url()),
    { timeout: 60_000 },
  );

  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await page.getByPlaceholder('Password').fill('').catch(() => {});
  const response = await loginResponse;
  expect(response.ok(), `login request failed with ${response.status()}`).toBe(true);
  const loginBody = (await response.json().catch(() => ({}))) as { user_id?: unknown };
  const overview = await overviewResponse;
  expect(overview.ok(), `overview request failed with ${overview.status()}`).toBe(true);

  await Promise.race([
    page.getByText(/successfully logged in/i).waitFor({ state: 'visible', timeout: 45_000 }),
    page.getByRole('link', { name: 'Account' }).waitFor({ state: 'visible', timeout: 45_000 }),
    page.waitForFunction(
      () => {
        const rawUser = window.localStorage.getItem('user');
        if (!rawUser) return false;

        try {
          const user = JSON.parse(rawUser) as { username?: unknown };
          return typeof user.username === 'string' && user.username.length > 0;
        } catch {
          return false;
        }
      },
      undefined,
      { timeout: 45_000 },
    ),
  ]);

  return loginBody;
}

async function gotoLoginPageWithRetry(page: Page, usernameInput: Locator) {
  const maxAttempts = parsePositiveInteger(process.env.DEMO_LOGIN_PAGE_ATTEMPTS, 3);
  const loginFormTimeout = parsePositiveInteger(process.env.DEMO_LOGIN_FORM_TIMEOUT_MS, 30_000);
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    if (await usernameInput.waitFor({ state: 'visible', timeout: loginFormTimeout }).then(() => true).catch(() => false)) {
      return;
    }

    lastError = await loginPageFailureMessage(page);
    if (attempt < maxAttempts) {
      await page.waitForTimeout(attempt * 2_500);
    }
  }

  throw new Error(`Login page did not load after ${maxAttempts} attempt(s). Last page: ${lastError ?? 'unknown'}`);
}

async function loginPageFailureMessage(page: Page) {
  const title = await page.title().catch(() => '');
  const bodyText = await page.locator('body').innerText({ timeout: 1_000 }).catch(() => '');
  const cloudflareMatch = bodyText.match(/Error code\s+\d{3}/i)?.[0];
  const headingMatch = bodyText.match(/Connection timed out|Bad gateway|Gateway timeout|Service unavailable/i)?.[0];
  const bodySnippet = bodyText.replace(/\s+/g, ' ').trim().slice(0, 160);
  return [title, headingMatch, cloudflareMatch, bodySnippet].filter(Boolean).join(' | ') || formatUrlForReport(page.url());
}

async function loginWithDemoAccount(page: Page) {
  await loginWithAccountCredentials(page, demoUsername, demoPassword);
}

async function loginWithDisposableAccount(page: Page, account: DisposableAuthAccount) {
  const loginBody = await loginWithAccountCredentials(page, account.username, account.password);
  if (typeof loginBody.user_id === 'string') {
    account.userId = loginBody.user_id;
  }
  account.userId = account.userId || (await readStoredAuthUserId(page));
}

async function seedStoredLocationFromAccount(page: Page) {
  return await page.evaluate(() => {
    const rawUser = window.localStorage.getItem('user');
    if (!rawUser) return false;

    try {
      const user = JSON.parse(rawUser) as {
        coordinates?: { latitude?: unknown; longitude?: unknown };
        location?: { latitude?: unknown; longitude?: unknown };
      };
      const coordinates = user.coordinates ?? user.location;
      const latitude = Number(coordinates?.latitude);
      const longitude = Number(coordinates?.longitude);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return false;
      }

      window.localStorage.setItem('location', JSON.stringify({ latitude, longitude }));
      return true;
    } catch {
      return false;
    }
  });
}

async function chooseCaughtTag(page: Page) {
  await clickIfVisible(page.getByText('TAGS', { exact: true }), 5_000);
  await clickIfVisible(page.locator('.tag-item[data-tag="Caught"]'), 10_000);
  await waitForAppSettled(page);
}

async function chooseFavoritesTag(page: Page) {
  await clickIfVisible(page.getByText('TAGS', { exact: true }), 5_000);
  await clickIfVisible(page.locator('.tag-item[data-tag="Favorites"]'), 10_000);
  await waitForAppSettled(page);
}

async function selectAllPokedexFilter(page: Page) {
  const pokedexActive = await page
    .locator('.toggle-text.active')
    .filter({ hasText: 'POKÉDEX' })
    .first()
    .isVisible({ timeout: 500 })
    .catch(() => false);

  if (!pokedexActive) {
    await clickIfVisible(page.getByText('POKÉDEX', { exact: true }), 5_000);
  }

  const allPokedexList = page
    .locator('.pokedex-fullwidth-list .pokedex-list-item, .pokedex-lists-menu.one-column .pokedex-list-item')
    .first();
  await expect(allPokedexList).toBeVisible({ timeout: 30_000 });
  await hideToastNotifications(page);
  await allPokedexList.click({ timeout: 10_000 });
  await waitForAppSettled(page);
  await centerPokemonPanel(page);
  await waitForCollectionCardsOrEmpty(page);
  await ensureCollectionContentInViewport(page);
  await forcePokemonPanelCentered(page);
  await waitForCollectionMediaReady(page);
}

async function sortCollectionByFavorites(page: Page) {
  const readSortState = () =>
    page.locator('.sort-button').first().evaluate((button) => {
      const sortType = button.querySelector<HTMLImageElement>('.sort-button-img')?.alt ?? '';
      const sortArrow = button.querySelector<HTMLImageElement>('.sort-arrow-img');
      const arrowStyle = sortArrow?.getAttribute('style') ?? '';
      const arrowTransform = sortArrow ? window.getComputedStyle(sortArrow).transform : '';

      return {
        sortType,
        isDescending:
          arrowStyle.includes('180deg') ||
          arrowTransform.startsWith('matrix(-1') ||
          arrowTransform.startsWith('matrix3d(-1'),
      };
    });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const state = await readSortState().catch(() => ({ sortType: '', isDescending: false }));
    if (state.sortType === 'FAVORITE' && state.isDescending) {
      return;
    }

    const sortButton = page.locator('.sort-button').first();
    await expect(sortButton).toBeVisible({ timeout: 15_000 });
    await hideToastNotifications(page);
    await sortButton.click({ timeout: 10_000 });

    await expect(page.locator('.sort-menu-overlay')).toBeVisible({ timeout: 10_000 });
    await page
      .locator('.sort-menu-overlay .sort-type-button')
      .filter({ hasText: 'FAVORITE' })
      .click({ timeout: 10_000 });
    await expect(page.locator('.sort-menu-overlay')).toHaveCount(0, { timeout: 15_000 });
    await waitForAppSettled(page);
  }

  throw new Error('Could not set collection sort to FAVORITE descending.');
}

async function waitForCollectionCardsOrEmpty(page: Page) {
  await waitForAnyVisible(page, [
    page.locator('.pokemon-card').first(),
    page.getByText(/No Pok[eé]mon in this (?:list|tag)/i).first(),
    page.getByRole('button', { name: /Inventory 0/i }),
  ], 45_000);
}

async function ensureCollectionContentInViewport(page: Page) {
  const cardInViewport = await page
    .locator('.pokemon-card')
    .first()
    .evaluate((card) => {
      const rect = card.getBoundingClientRect();
      return rect.right > 0 && rect.left < window.innerWidth && rect.bottom > 0;
    })
    .catch(() => false);

  if (!cardInViewport) {
    await forcePokemonPanelCentered(page);
    await page.waitForTimeout(350);
  }
}

async function getPreferredRaikouCard(page: Page) {
  const cards = page.locator('.pokemon-card');
  await expect(
    cards.first(),
    'Expected AdamZilla to have a caught Raikou for the live demo overlay',
  ).toBeVisible({ timeout: 45_000 });

  const preferredIndex = await cards.evaluateAll((elements) => {
    const hasShinyShadowImage = (element: Element) =>
      Array.from(element.querySelectorAll<HTMLImageElement>('img')).some((image) => {
        const src = image.currentSrc || image.src || '';
        return /shiny[_-]shadow/i.test(src);
      });
    const looksLikeRaikou = (element: Element) => {
      const text = element.textContent ?? '';
      const imageText = Array.from(element.querySelectorAll<HTMLImageElement>('img'))
        .map((image) => `${image.alt} ${image.currentSrc || image.src}`)
        .join(' ');

      return /raikou|pokemon_243|shiny_shadow_pokemon_243/i.test(`${text} ${imageText}`);
    };

    return elements.findIndex(
      (element) => looksLikeRaikou(element) && hasShinyShadowImage(element),
    );
  });

  return preferredIndex >= 0 ? cards.nth(preferredIndex) : cards.first();
}

async function openShinyShadowRaikouOverlay(page: Page) {
  const searchInput = page.locator('.search-input').first();
  await expect(searchInput).toBeVisible({ timeout: 15_000 });
  await searchInput.fill('raikou');
  await waitForAppSettled(page);

  await getPreferredRaikouCard(page);
  await waitForVisibleImagesReady(page, 45_000);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const raikouCard = await getPreferredRaikouCard(page);
    try {
      await raikouCard.click({ timeout: 10_000 });
      break;
    } catch (error) {
      if (attempt === 4) throw error;
      await page.waitForTimeout(500);
    }
  }

  await expect(page.locator('.instance-overlay')).toBeVisible({ timeout: 15_000 });
  await waitForVisibleImagesReady(page, 45_000);
}

async function captureCollection(page: Page, theme: ThemeMode, viewport: ViewportMode) {
  await page.goto('/pokemon', { waitUntil: 'domcontentloaded' });
  await waitForAppSettled(page);

  await chooseCaughtTag(page);
  await centerPokemonPanel(page);
  await sortCollectionByFavorites(page);
  await centerPokemonPanel(page);
  await waitForCollectionCardsOrEmpty(page);
  await ensureCollectionContentInViewport(page);
  await forcePokemonPanelCentered(page);
  await page.waitForTimeout(100);
  await waitForCollectionMediaReady(page);
  await capture(page, mediaName(theme, 'collection', viewport));

  await centerPokemonPanel(page);
  await ensureCollectionContentInViewport(page);
  await forcePokemonPanelCentered(page);
  await page.waitForTimeout(100);
  await openShinyShadowRaikouOverlay(page);
  await capture(page, mediaName(theme, 'instance-overlay', viewport));
  await clickIfVisible(page.getByRole('button', { name: 'Close' }), 5_000);
  await expect(page.locator('.instance-overlay')).toHaveCount(0, { timeout: 15_000 });
}

async function captureSearch(page: Page, theme: ThemeMode, viewport: ViewportMode) {
  await page.goto('/search', { waitUntil: 'domcontentloaded' });
  await waitForAppSettled(page);
  await page.getByRole('button', { name: 'Pokemon' }).click();
  await expect(page.getByPlaceholder('Enter Pokemon name')).toBeVisible({ timeout: 30_000 });
  const catalogReady = await waitForPokemonCatalogReady(page);
  const listName = mediaName(theme, 'search-results-list', viewport);
  const mapName = mediaName(theme, 'search-results-map', viewport);

  if (catalogReady) {
    await chooseShinyDetectivePikachu(page);
  } else {
    await page.getByPlaceholder('Enter Pokemon name').fill('Pikachu');
    await clickIfVisible(page.getByRole('button', { name: 'Pikachu', exact: true }), 2_000);
  }

  if (await seedStoredLocationFromAccount(page)) {
    await page.getByRole('button', { name: 'Use Current Location' }).click();
  } else {
    await page.getByPlaceholder('Enter location').fill('Vancouver');
    await clickIfVisible(page.getByText(/Vancouver/i).first(), 10_000);
  }

  await page.getByRole('button', { name: 'Search', exact: true }).click();
  if (!catalogReady) {
    await waitForAnyVisible(page, [
      page.getByText(/No Pokemon data found in the default store/i),
      page.getByText(/Use the Toolbar above/i),
    ], 10_000);
    await capture(page, listName);
    await capture(page, mapName);
    return;
  }

  await waitForAnyVisible(page, [
    page.locator('.list-view-container'),
    page.getByText('No Pokemon found matching your criteria.'),
    page.getByText(/No Pokemon data found in the default store/i),
    page.getByText(/Use the Toolbar above/i),
  ]);
  const hasSearchResults = await page.locator('.list-view-container').isVisible().catch(() => false);
  await capture(page, listName);

  if (hasSearchResults) {
    await page.getByRole('button', { name: 'Map view' }).click();
    await waitForAnyVisible(page, [page.locator('.ol-viewport')]);
    await openMapResultPopup(page);
  }
  await capture(page, mapName);
}

async function pauseForVideo(page: Page, duration = videoPauseMs) {
  await prepareMediaFrame(page);
  await waitForVisibleImagesReady(page);
  await page.waitForTimeout(duration);
}

async function chooseFavoritesTagForVideo(page: Page) {
  await clickIfVisibleForVideo(page.getByText('TAGS', { exact: true }), 5_000);
  await page.waitForTimeout(collectionVideoActionPauseMs);
  await clickIfVisibleForVideo(page.locator('.tag-item[data-tag="Favorites"]'), 10_000);
  await waitForAppSettled(page);
}

async function sortCollectionByFavoritesForVideo(page: Page) {
  const sortButton = page.locator('.sort-button').first();
  await expect(sortButton).toBeVisible({ timeout: 15_000 });
  await hideToastNotifications(page);
  await clickForVideo(sortButton, 10_000);
  await page.waitForTimeout(collectionVideoActionPauseMs);

  await expect(page.locator('.sort-menu-overlay')).toBeVisible({ timeout: 10_000 });
  await clickForVideo(
    page.locator('.sort-menu-overlay .sort-type-button').filter({ hasText: 'FAVORITE' }),
    10_000,
  );
  await expect(page.locator('.sort-menu-overlay')).toHaveCount(0, { timeout: 15_000 });
  await waitForAppSettled(page);
}

async function warmCollectionVideoContext(page: Page) {
  await page.goto('/pokemon', { waitUntil: 'domcontentloaded' });
  await waitForAppSettled(page);

  await selectAllPokedexFilter(page);
  await chooseFavoritesTag(page);
  await centerPokemonPanel(page);
  await sortCollectionByFavorites(page);
  await centerPokemonPanel(page);
  await waitForCollectionCardsOrEmpty(page);
  await ensureCollectionContentInViewport(page);
  await forcePokemonPanelCentered(page);
  await page.waitForTimeout(100);
  await waitForCollectionMediaReady(page);
}

async function openShinyShadowRaikouOverlayForVideo(page: Page) {
  const searchInput = page.locator('.search-input').first();
  await expect(searchInput).toBeVisible({ timeout: 15_000 });
  await clickForVideo(searchInput, 15_000);
  await page.waitForTimeout(collectionVideoActionPauseMs);
  await searchInput.fill('');
  await searchInput.pressSequentially('raikou', { delay: collectionVideoRaikouTypingDelayMs });
  await waitForAppSettled(page);
  await waitForVisibleImagesReady(page, 45_000);
  await page.waitForTimeout(collectionVideoActionPauseMs);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const raikouCard = await getPreferredRaikouCard(page);
    try {
      await clickForVideo(raikouCard, 10_000);
      break;
    } catch (error) {
      if (attempt === 4) throw error;
      await page.waitForTimeout(500);
    }
  }

  await expect(page.locator('.instance-overlay')).toBeVisible({ timeout: 15_000 });
  await waitForVisibleImagesReady(page, 45_000);
}

async function performCollectionOverlayVideoFlow(page: Page, recordingStartedAt: number) {
  await page.goto('/pokemon', { waitUntil: 'domcontentloaded' });
  await waitForAppSettled(page);

  await selectAllPokedexFilter(page);
  const trimStartMs = videoTrimStart(recordingStartedAt);
  await pauseForVideo(page, collectionVideoAllPauseMs);

  await chooseFavoritesTagForVideo(page);
  await centerPokemonPanel(page);
  await sortCollectionByFavoritesForVideo(page);
  await centerPokemonPanel(page);
  await waitForCollectionCardsOrEmpty(page);
  await ensureCollectionContentInViewport(page);
  await forcePokemonPanelCentered(page);
  await waitForCollectionMediaReady(page);
  await pauseForVideo(page, collectionVideoFavoritesPauseMs);

  await openShinyShadowRaikouOverlayForVideo(page);
  await pauseForVideo(page, collectionVideoOverlayPauseMs);

  return { trimStartMs };
}

async function warmSearchVideoContext(page: Page) {
  await page.goto('/search', { waitUntil: 'domcontentloaded' });
  await waitForAppSettled(page);
  await page.getByRole('button', { name: 'Pokemon' }).click();
  await expect(page.getByPlaceholder('Enter Pokemon name')).toBeVisible({ timeout: 30_000 });
  return await waitForPokemonCatalogReady(page);
}

async function performSearchResultsVideoFlow(page: Page, recordingStartedAt: number) {
  await page.goto('/search', { waitUntil: 'domcontentloaded' });
  await waitForAppSettled(page);

  await page.getByRole('button', { name: 'Pokemon' }).click();
  await expect(page.getByPlaceholder('Enter Pokemon name')).toBeVisible({ timeout: 30_000 });
  const catalogReady = await waitForPokemonCatalogReady(page);
  const trimStartMs = videoTrimStart(recordingStartedAt);
  await pauseForVideo(page, searchVideoInitialPauseMs);

  if (catalogReady) {
    await chooseShinyDetectivePikachuForVideo(page);
  } else {
    const pokemonInput = page.getByPlaceholder('Enter Pokemon name');
    await clickForVideo(pokemonInput, 10_000);
    await pokemonInput.fill('');
    await pokemonInput.pressSequentially('Pikachu', { delay: searchVideoTypingDelayMs });
    await page.waitForTimeout(150);
    await clickIfVisibleForVideo(page.getByRole('button', { name: 'Pikachu', exact: true }), 2_000);
    await page.waitForTimeout(150);
  }

  if (await seedStoredLocationFromAccount(page)) {
    await page.waitForTimeout(150);
    await clickForVideo(page.getByRole('button', { name: 'Use Current Location' }), 10_000);
  } else {
    const locationInput = page.getByPlaceholder('Enter location');
    await clickForVideo(locationInput, 10_000);
    await locationInput.fill('');
    await locationInput.pressSequentially('Vancouver', { delay: 70 });
    await page.waitForTimeout(150);
    await clickIfVisibleForVideo(page.getByText(/Vancouver/i).first(), 10_000);
  }

  await page.waitForTimeout(150);
  await clickForVideo(page.getByRole('button', { name: 'Search', exact: true }), 10_000);
  if (!catalogReady) {
    await waitForAnyVisible(page, [
      page.getByText(/No Pokemon data found in the default store/i),
      page.getByText(/Use the Toolbar above/i),
    ], 10_000);
    await pauseForVideo(page, videoFinalPauseMs);
    return { trimStartMs };
  }

  await waitForAnyVisible(page, [
    page.locator('.list-view-container'),
    page.getByText('No Pokemon found matching your criteria.'),
    page.getByText(/No Pokemon data found in the default store/i),
    page.getByText(/Use the Toolbar above/i),
  ]);
  const hasSearchResults = await page.locator('.list-view-container').isVisible().catch(() => false);
  await pauseForVideo(page, searchVideoListPauseMs);

  if (hasSearchResults) {
    await clickForVideo(page.getByRole('button', { name: 'Map view' }), 10_000);
    await waitForAnyVisible(page, [page.locator('.ol-viewport')]);
    await openMapResultPopup(page, true);
    await pauseForVideo(page, searchVideoMapPopupPauseMs);
  }

  return { trimStartMs };
}

async function prepareWorkflowPokemonPage(page: Page) {
  await page.goto('/pokemon', { waitUntil: 'domcontentloaded' });
  await waitForAppSettled(page);
  await selectAllPokedexFilter(page);
  await centerPokemonPanel(page);
  await waitForCollectionCardsOrEmpty(page);
  await ensureCollectionContentInViewport(page);
  await forcePokemonPanelCentered(page);
  await waitForCollectionMediaReady(page);
}

async function openWorkflowPokemonPage(page: Page, recordingStartedAt: number) {
  await prepareWorkflowPokemonPage(page);

  const trimStartMs = videoTrimStart(recordingStartedAt);
  await pauseForVideo(page, workflowVideoPauseMs);

  return { trimStartMs };
}

async function searchCollectionForWorkflowVideo(page: Page, searchTerm: string) {
  const searchInput = page.locator('.search-input').first();
  await expect(searchInput).toBeVisible({ timeout: 15_000 });
  await clickForVideo(searchInput, 10_000);
  await searchInput.fill('');
  await searchInput.pressSequentially(searchTerm, { delay: workflowVideoTypingDelayMs });
  await waitForAppSettled(page);
  await waitForCollectionCardsOrEmpty(page);
  await ensureCollectionContentInViewport(page);
  await waitForCollectionMediaReady(page, 45_000);
  await pauseForVideo(page, workflowVideoActionPauseMs);
}

async function selectFirstPokemonCardForTagVideo(page: Page) {
  const card = page.locator('.pokemon-card:not(.disabled-card)').first();
  await expect(card).toBeVisible({ timeout: 30_000 });
  await moveVideoCursorToLocator(card);
  await card.hover({ timeout: 10_000 });
  await page.waitForTimeout(800);

  const selectChip = card.locator('.select-chip').first();
  if (await selectChip.isVisible({ timeout: 1_500 }).catch(() => false)) {
    await clickForVideo(selectChip, 10_000);
  } else {
    await showVideoTapAtLocator(card);
    await card.click({ modifiers: ['Control'], timeout: 10_000 });
  }

  await expect(card).toHaveClass(/highlighted/, { timeout: 10_000 });
  await hideToastNotifications(page);
  await page.waitForTimeout(workflowVideoActionPauseMs);
}

function workflowTagClass(tag: 'Caught' | 'Trade' | 'Wanted') {
  return tag === 'Caught' ? 'caught' : tag === 'Trade' ? 'trade' : 'wanted';
}

async function tagSelectedPokemonForWorkflowVideo(page: Page, tag: 'Caught' | 'Trade' | 'Wanted') {
  await clickForVideo(page.locator('.highlight-action-container .main-button'), 10_000);
  await page.waitForTimeout(workflowVideoActionPauseMs);
  await clickForVideo(page.locator(`.filter-button.${tag}`), 10_000);

  const confirmModal = page.locator('.modal-overlay .modal').first();
  if (await confirmModal.isVisible({ timeout: 10_000 }).catch(() => false)) {
    await pauseForVideo(page, Math.min(650, workflowVideoPauseMs));
    await clickForVideo(confirmModal.getByRole('button', { name: 'OK' }), 10_000);
  }

  await waitForAppSettled(page);
  await expect(page.locator(`.pokemon-card.${workflowTagClass(tag)}`).first()).toBeVisible({
    timeout: 30_000,
  });
  await waitForCollectionMediaReady(page, 45_000);
  await pauseForVideo(page, workflowVideoActionPauseMs);
}

async function createTaggedInstanceForWorkflowVideo(
  page: Page,
  searchTerm: string,
  tag: 'Caught' | 'Trade' | 'Wanted',
) {
  await searchCollectionForWorkflowVideo(page, searchTerm);
  await selectFirstPokemonCardForTagVideo(page);
  await tagSelectedPokemonForWorkflowVideo(page, tag);
}

async function seedLatestCaughtEeveeForEditWorkflowVideo(page: Page) {
  const updated = await page.evaluate(
    () =>
      new Promise<boolean>((resolve, reject) => {
        const request = indexedDB.open('instancesDB');

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('instances')) {
            db.close();
            resolve(false);
            return;
          }

          const tx = db.transaction('instances', 'readwrite');
          const store = tx.objectStore('instances');
          const getAllRequest = store.getAll();
          let didUpdate = false;

          getAllRequest.onerror = () => {
            db.close();
            reject(getAllRequest.error);
          };

          getAllRequest.onsuccess = () => {
            const candidates = getAllRequest.result
              .filter(
                (entry): entry is Record<string, unknown> =>
                  Boolean(
                    entry &&
                      typeof entry === 'object' &&
                      typeof entry.instance_id === 'string' &&
                      entry.pokemon_id === 133 &&
                      entry.is_caught === true &&
                      entry.is_for_trade !== true &&
                      entry.is_wanted !== true,
                  ),
              )
              .sort((a, b) => Number(b.last_update ?? 0) - Number(a.last_update ?? 0));

            const target = candidates[0];
            if (!target) {
              return;
            }

            didUpdate = true;
            store.put({
              ...target,
              cp: 686,
              level: 31,
              attack_iv: 10,
              defense_iv: 12,
              stamina_iv: 13,
              weight: 6.5,
              height: 0.3,
              gender: 'Male',
              nickname: 'Eevee',
              favorite: false,
              pokeball: 'great_ball',
              location_caught: 'Burnaby, British Columbia, Canada',
              date_caught: '2026-06-18',
              is_caught: true,
              registered: true,
              status: 'caught',
              last_update: Date.now(),
            });
          };

          tx.oncomplete = () => {
            db.close();
            if (didUpdate) {
              window.localStorage.setItem('ownershipTimestamp', String(Date.now()));
              window.localStorage.removeItem('tagsTimestamp');
            }
            resolve(didUpdate);
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error);
          };
        };
      }),
  );

  expect(updated, 'Expected the workflow-created caught Eevee to be available for video seeding').toBe(
    true,
  );
}

async function seedTaggedInstancesForWorkflowVideo(
  page: Page,
  seeds: Array<{ searchTerm: string; tag: 'Caught' | 'Trade' | 'Wanted' }>,
) {
  for (const seed of seeds) {
    await selectAllPokedexFilter(page);
    await createTaggedInstanceForWorkflowVideo(page, seed.searchTerm, seed.tag);
  }
  await selectAllPokedexFilter(page);
}

async function openFirstInstanceOverlayForWorkflowVideo(page: Page) {
  const taggedCard = page.locator('.pokemon-card:is(.caught, .trade, .wanted):not(.disabled-card)').first();
  const card = (await taggedCard.isVisible({ timeout: 3_000 }).catch(() => false))
    ? taggedCard
    : page.locator('.pokemon-card:not(.disabled-card)').first();
  await expect(card).toBeVisible({ timeout: 30_000 });
  await clickForVideo(card, 10_000);
  await expect(page.locator('.instance-overlay')).toBeVisible({ timeout: 20_000 });
  await waitForVisibleImagesReady(page, 45_000);
}

async function scrollPokemonGridForVideo(page: Page, steps = 3) {
  const grid = page.locator('.grid-container').first();
  await expect(grid).toBeVisible({ timeout: 15_000 });
  await moveVideoCursorToLocator(grid);

  for (let step = 0; step < steps; step += 1) {
    await page.mouse.wheel(0, 520);
    await page.waitForTimeout(550);
    await waitForVisibleImagesReady(page, 12_000);
  }
}

async function clickFilterImageForVideo(locator: Locator, timeout = 10_000) {
  await locator.scrollIntoViewIfNeeded({ timeout }).catch(() => {});
  await clickForVideo(locator, timeout);
  await pageWaitAfterFilterClick(locator.page());
}

async function pageWaitAfterFilterClick(page: Page) {
  await hideToastNotifications(page);
  await page.waitForTimeout(workflowVideoActionPauseMs);
}

async function scrollLocatorIntoViewForVideo(locator: Locator, timeout = 10_000) {
  await locator.waitFor({ state: 'attached', timeout });
  await locator
    .evaluate((element) => {
      const target = element as HTMLElement;
      const scrollContainer =
        (target.closest('.instance-overlay') as HTMLElement | null) ??
        document.scrollingElement ??
        document.documentElement;
      const rect = target.getBoundingClientRect();
      const topLimit = 72;
      const bottomLimit = window.innerHeight - 120;
      let deltaY = 0;

      if (rect.top < topLimit) {
        deltaY = rect.top - topLimit;
      } else if (rect.bottom > bottomLimit) {
        deltaY = rect.bottom - bottomLimit;
      }

      if (deltaY !== 0) {
        scrollContainer.scrollTop += deltaY;
      }

      scrollContainer.scrollLeft = 0;
    })
    .catch(() => {});
  await stabilizeInstanceOverlayForVideo(locator.page());
}

async function scrollThenClickForVideo(locator: Locator, timeout = 10_000) {
  await scrollLocatorIntoViewForVideo(locator, timeout);
  await locator.page().waitForTimeout(30);
  await clickForVideo(locator, timeout);
}

async function scrollThenActivateForVideo(locator: Locator, timeout = 10_000) {
  await scrollLocatorIntoViewForVideo(locator, timeout);
  await locator.page().waitForTimeout(30);
  await expect(locator).toBeVisible({ timeout });
  await hideToastNotifications(locator.page());
  await moveVideoCursorToLocator(locator);
  await showVideoTapAtLocator(locator);
  await locator
    .evaluate((element) => {
      if (element instanceof HTMLElement) {
        element.click();
      }
    })
    .catch(() => {});
  await hideToastNotifications(locator.page());
  await stabilizeInstanceOverlayForVideo(locator.page());
}

async function fillFieldForVideo(locator: Locator, value: string, timeout = 10_000) {
  await scrollLocatorIntoViewForVideo(locator, timeout);
  await moveVideoCursorToLocator(locator, 60);
  await locator.page().waitForTimeout(25);
  await locator.fill(value, { timeout });
  await stabilizeInstanceOverlayForVideo(locator.page());
  await locator.page().waitForTimeout(35);
}

async function fillFieldIfVisibleForVideo(locator: Locator, value: string, timeout = 1_500) {
  if (!(await locator.isVisible({ timeout }).catch(() => false))) {
    return false;
  }

  await fillFieldForVideo(locator, value, Math.max(timeout, 5_000));
  return true;
}

async function fillEditableTextForVideo(locator: Locator, value: string, timeout = 10_000) {
  await scrollLocatorIntoViewForVideo(locator, timeout);
  await moveVideoCursorToLocator(locator, 60);
  await locator.page().waitForTimeout(25);
  await locator.fill(value, { timeout });
  await locator.page().keyboard.press('Enter').catch(() => {});
  await stabilizeInstanceOverlayForVideo(locator.page());
  await locator.page().waitForTimeout(35);
}

async function chooseNextSelectOptionForVideo(locator: Locator, timeout = 10_000) {
  await locator.scrollIntoViewIfNeeded({ timeout }).catch(() => {});
  const optionValue = await locator.evaluate((select) => {
    const htmlSelect = select as HTMLSelectElement;
    const options = Array.from(htmlSelect.options).filter((option) => option.value);
    const currentIndex = options.findIndex((option) => option.value === htmlSelect.value);
    const next = options[(currentIndex + 1 + options.length) % options.length] ?? options[0];
    return next?.value ?? '';
  });

  if (optionValue) {
    await moveVideoCursorToLocator(locator);
    await showVideoTapAtLocator(locator);
    const { visibleOptionCount, visibleOptionIndex } = await expandNativeSelectForVideo(
      locator,
      optionValue,
    );
    await locator.page().waitForTimeout(160);
    await clickExpandedNativeSelectOptionForVideo(
      locator,
      optionValue,
      visibleOptionCount,
      visibleOptionIndex,
      timeout,
    );
    await locator.page().waitForTimeout(80);
    await collapseNativeSelectForVideo(locator);
  }
  await locator.page().waitForTimeout(45);
}

async function selectLocationSuggestionForVideo(
  input: Locator,
  query = 'Vancouver',
  timeout = 12_000,
) {
  const page = input.page();
  await page.evaluate(() => {
    document.body.classList.remove('live-demo-location-suggestions-dismissed');
  });
  await scrollThenClickForVideo(input, timeout);
  await input.fill('', { timeout });
  await input.pressSequentially(query, { delay: workflowVideoTypingDelayMs });

  const suggestions = page.locator(
    '.location-caught-container .suggestion-item, .suggestions-dropdown .suggestion-item',
  );
  await expect(suggestions.first()).toBeVisible({ timeout });
  let suggestion = suggestions.filter({ hasText: /British Columbia|Canada/i }).first();
  if (!(await suggestion.isVisible({ timeout: 1_500 }).catch(() => false))) {
    await input.fill('Vancouver, British Columbia', { timeout });
    suggestion = suggestions.filter({ hasText: /British Columbia|Canada/i }).first();
  }

  await expect(suggestion).toBeVisible({ timeout });
  const selectedSuggestionText =
    (await suggestion.textContent({ timeout }).catch(() => null))?.trim() ||
    'Vancouver, British Columbia, Canada';
  const locationSelectionPattern = /British Columbia|Canada|,/i;
  await page.waitForTimeout(140);
  await moveVideoCursorToLocator(suggestion, 80);
  const suggestionBox = await suggestion.boundingBox();
  if (!suggestionBox) {
    throw new Error('Location autocomplete suggestion did not have a clickable bounding box.');
  }
  const suggestionX = Math.round(suggestionBox.x + suggestionBox.width / 2);
  const suggestionY = Math.round(suggestionBox.y + suggestionBox.height / 2);
  await showVideoTapAtPoint(page, suggestionX, suggestionY);
  await page.mouse.move(suggestionX, suggestionY, { steps: 8 });
  await suggestion
    .evaluate((element) => {
      element.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          button: 0,
          buttons: 1,
          cancelable: true,
          view: window,
        }),
      );
    })
    .catch(() => {});
  await page.waitForTimeout(180);

  const readLocationValue = async () => {
    const freshInput = page.locator('#location-caught-input').first();
    const inputValue = await freshInput.inputValue({ timeout: 500 }).catch(() => '');
    if (inputValue) return inputValue;

    return (
      (await page.locator('.location-caught-container .location-display').first().textContent({
        timeout: 500,
      }).catch(() => '')) ?? ''
    );
  };

  if (!locationSelectionPattern.test(await readLocationValue())) {
    const freshInput = page.locator('#location-caught-input').first();
    await expect(freshInput).toBeVisible({ timeout });
    await freshInput.fill(selectedSuggestionText, { timeout });
  }

  await expect
    .poll(readLocationValue, { timeout: 2_000 })
    .toMatch(locationSelectionPattern);
  await dismissLocationSuggestionsForVideo(page);
  await stabilizeInstanceOverlayForVideo(page);
  await page.waitForTimeout(workflowVideoActionPauseMs);
}

async function editCaughtInstanceFieldsForVideo(page: Page, alreadyEditing = false) {
  if (!alreadyEditing) {
    await clickForVideo(page.getByRole('button', { name: 'Edit' }), 10_000);
    await page.waitForTimeout(Math.min(workflowVideoActionPauseMs, 200));
  }
  await fillEditableTextForVideo(page.locator('.cp-editable-content').first(), '742');
  await clickForVideo(page.locator('.favorite-component').first(), 10_000);
  await fillEditableTextForVideo(page.locator('.name-editable-content.editable').first(), 'Demo Eevee');
  await fillFieldIfVisibleForVideo(page.locator('.level-input').first(), '35');
  await clickIfVisibleForVideo(page.locator('.gender-container[role="button"]').first(), 2_000);
  await fillFieldIfVisibleForVideo(page.getByLabel('Weight in kilograms').first(), '6.9');
  await fillFieldIfVisibleForVideo(page.getByLabel('Height in meters').first(), '0.4');

  const moveSelects = page.locator('.move-select');
  const moveSelectCount = await moveSelects.count();
  for (let index = 0; index < Math.min(moveSelectCount, 2); index += 1) {
    await chooseNextSelectOptionForVideo(moveSelects.nth(index));
  }

  const addSecondMoveButton = page.getByRole('button', { name: 'Add second charged move' });
  await clickIfVisibleForVideo(addSecondMoveButton, 1_000);

  const ivInputs = page.locator('.iv-input');
  const ivValues = ['12', '14', '15'];
  for (let index = 0; index < Math.min(await ivInputs.count(), ivValues.length); index += 1) {
    await fillFieldForVideo(ivInputs.nth(index), ivValues[index]);
  }

  await selectLocationSuggestionForVideo(page.locator('#location-caught-input').first());
  const dateCaughtInput = page.locator('#date-caught-input').first();
  if (await fillFieldIfVisibleForVideo(dateCaughtInput, '2026-07-04')) {
    await dateCaughtInput.evaluate((element) => {
      if (element instanceof HTMLElement) {
        element.blur();
      }
    });
    await stabilizeInstanceOverlayForVideo(page);
  }
  const pokeBallButton = page.getByRole('button', { name: 'POKE BALL' });
  if (await pokeBallButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await scrollThenActivateForVideo(pokeBallButton, 5_000);
    await expect(pokeBallButton).toHaveAttribute('aria-pressed', 'true', { timeout: 2_000 });
    await page.waitForTimeout(workflowVideoActionPauseMs);
  }

  await clickForVideo(page.getByRole('button', { name: 'Save' }), 10_000);
  await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible({ timeout: 20_000 });
  await waitForVisibleImagesReady(page, 45_000);
  await pauseForVideo(page, workflowVideoFinalPauseMs);
}

async function performTaggedInstanceWorkflowVideoFlow(
  page: Page,
  recordingStartedAt: number,
  options: {
    searchTerm: string;
    tag: 'Caught' | 'Trade' | 'Wanted';
  },
) {
  const { trimStartMs } = await openWorkflowPokemonPage(page, recordingStartedAt);

  await createTaggedInstanceForWorkflowVideo(page, options.searchTerm, options.tag);
  await openFirstInstanceOverlayForWorkflowVideo(page);
  await pauseForVideo(page, workflowVideoFinalPauseMs);

  return { trimStartMs };
}

async function performCatalogSearchWorkflowVideoFlow(page: Page, recordingStartedAt: number) {
  const { trimStartMs } = await openWorkflowPokemonPage(page, recordingStartedAt);

  await searchCollectionForWorkflowVideo(page, 'Pikachu');
  await scrollPokemonGridForVideo(page, 4);
  await pauseForVideo(page, workflowVideoPauseMs);

  const catalogCard = page.locator('.pokemon-card').first();
  await clickForVideo(catalogCard, 10_000);
  await expect(catalogCard).toHaveClass(/highlighted/, { timeout: 10_000 });
  await expect(page.locator('.pokemon-overlay')).toHaveCount(0);
  await pauseForVideo(page, workflowVideoFinalPauseMs);

  return { trimStartMs };
}

async function performInstanceEditWorkflowVideoFlow(page: Page, recordingStartedAt: number) {
  await page.goto('/pokemon', { waitUntil: 'domcontentloaded' });
  await waitForAppSettled(page);
  await selectAllPokedexFilter(page);
  await centerPokemonPanel(page);

  await createTaggedInstanceForWorkflowVideo(page, 'Eevee', 'Caught');
  await seedLatestCaughtEeveeForEditWorkflowVideo(page);
  await page.goto('/pokemon', { waitUntil: 'domcontentloaded' });
  await waitForAppSettled(page);
  await selectAllPokedexFilter(page);
  await chooseCaughtTag(page);
  await centerPokemonPanel(page);
  await searchCollectionForWorkflowVideo(page, 'Eevee');
  await openFirstInstanceOverlayForWorkflowVideo(page);

  const trimStartMs = videoTrimStart(recordingStartedAt);
  await page.waitForTimeout(80);
  await editCaughtInstanceFieldsForVideo(page);
  await page.waitForTimeout(80);

  return { trimStartMs };
}

async function editTradeTargetsForVideo(page: Page) {
  const panel = page.locator('.trade-pane-shell--targets').first();
  await expect(panel).toBeVisible({ timeout: 20_000 });
  await clickForVideo(panel.getByRole('button', { name: 'Edit' }).first(), 10_000);
  await page.waitForTimeout(workflowVideoActionPauseMs);

  await clickIfVisibleForVideo(panel.locator('.toggle-not-wanted').first(), 3_000);
  await clickForVideo(panel.getByRole('button', { name: 'Exclude' }).first(), 10_000);
  await clickFilterImageForVideo(
    panel.locator('.trade-filter-dropdowns__panel .toggleable-image').first(),
  );
  await clickForVideo(panel.getByRole('button', { name: 'Include' }).first(), 10_000);
  await clickFilterImageForVideo(
    panel.locator('.trade-filter-dropdowns__panel .toggleable-image').first(),
  );

  await clickForVideo(panel.getByRole('button', { name: 'Save' }).first(), 10_000);
  await expect(panel.getByRole('button', { name: 'Edit' }).first()).toBeVisible({
    timeout: 20_000,
  });
}

async function performTradeInstanceWorkflowVideoFlow(page: Page, recordingStartedAt: number) {
  await prepareWorkflowPokemonPage(page);
  await seedTaggedInstancesForWorkflowVideo(page, [
    { searchTerm: 'Squirtle', tag: 'Wanted' },
    { searchTerm: 'Pidgey', tag: 'Wanted' },
    { searchTerm: 'Pikachu', tag: 'Wanted' },
  ]);

  const trimStartMs = videoTrimStart(recordingStartedAt);
  await pauseForVideo(page, workflowVideoPauseMs);

  await createTaggedInstanceForWorkflowVideo(page, 'Charmander', 'Trade');
  await openFirstInstanceOverlayForWorkflowVideo(page);
  await pauseForVideo(page, 650);
  await editTradeTargetsForVideo(page);
  await pauseForVideo(page, workflowVideoFinalPauseMs);

  return { trimStartMs };
}

async function editWantedTradeFiltersForVideo(page: Page) {
  const panel = page.locator('.wanted-details-window').first();
  await expect(panel).toBeVisible({ timeout: 20_000 });
  await clickForVideo(panel.getByRole('button', { name: 'Edit' }).first(), 10_000);
  await page.waitForTimeout(workflowVideoActionPauseMs);

  await clickFilterImageForVideo(panel.locator('.exclude-images .toggleable-image').first());
  await clickFilterImageForVideo(panel.locator('.include-images .toggleable-image').first());
  await clickIfVisibleForVideo(panel.locator('.toggle-not-trade').first(), 3_000);

  await clickForVideo(panel.getByRole('button', { name: 'Save' }).first(), 10_000);
  await expect(panel.getByRole('button', { name: 'Edit' }).first()).toBeVisible({
    timeout: 20_000,
  });
}

async function performWantedInstanceWorkflowVideoFlow(page: Page, recordingStartedAt: number) {
  await prepareWorkflowPokemonPage(page);
  await seedTaggedInstancesForWorkflowVideo(page, [
    { searchTerm: 'Bulbasaur', tag: 'Trade' },
    { searchTerm: 'Pidgey', tag: 'Trade' },
    { searchTerm: 'Pikachu', tag: 'Trade' },
  ]);

  const trimStartMs = videoTrimStart(recordingStartedAt);
  await pauseForVideo(page, workflowVideoPauseMs);

  await createTaggedInstanceForWorkflowVideo(page, 'Squirtle', 'Wanted');
  await openFirstInstanceOverlayForWorkflowVideo(page);
  await pauseForVideo(page, 650);
  await editWantedTradeFiltersForVideo(page);
  await pauseForVideo(page, workflowVideoFinalPauseMs);

  return { trimStartMs };
}

async function performWorkflowVideoFlow(
  page: Page,
  flow: WorkflowVideoFlow,
  recordingStartedAt: number,
) {
  if (flow === 'caught-instance') {
    return await performTaggedInstanceWorkflowVideoFlow(page, recordingStartedAt, {
      searchTerm: 'Bulbasaur',
      tag: 'Caught',
    });
  }

  if (flow === 'catalog-search') {
    return await performCatalogSearchWorkflowVideoFlow(page, recordingStartedAt);
  }

  if (flow === 'wanted-instance') {
    return await performWantedInstanceWorkflowVideoFlow(page, recordingStartedAt);
  }

  if (flow === 'trade-instance') {
    return await performTradeInstanceWorkflowVideoFlow(page, recordingStartedAt);
  }

  return await performInstanceEditWorkflowVideoFlow(page, recordingStartedAt);
}

function workflowVideoMaxDurationForFlow(flow: WorkflowVideoFlow) {
  if (flow === 'instance-edit') {
    return workflowEditVideoMaxDurationSeconds;
  }

  return flow === 'trade-instance' || flow === 'wanted-instance'
    ? workflowTargetVideoMaxDurationSeconds
    : workflowVideoMaxDurationSeconds;
}

async function recordVideoClip(
  browser: Browser,
  theme: ThemeMode,
  viewport: ViewportMode,
  flow: VideoFlow,
  testInfo: TestInfo,
) {
  const viewportSize = captureViewports[viewport];
  const isMobileViewport = viewport === 'mobile';
  const context = await browser.newContext({
    baseURL: process.env.E2E_BASE_URL ?? 'https://pokegonexus.com',
    viewport: viewportSize,
    hasTouch: isMobileViewport,
    isMobile: isMobileViewport,
    serviceWorkers: 'block',
    recordVideo: {
      dir: liveDemoVideoDir,
      size: viewportSize,
    },
  });
  await installVideoPresentationHelpers(context, viewport === 'desktop');
  await context.addInitScript((mode: ThemeMode) => {
    const isLightMode = mode === 'light';
    window.localStorage.setItem('isLightMode', JSON.stringify(isLightMode));
    const applyTheme = () => {
      const root = document.documentElement;
      if (!root) return;

      root.setAttribute('data-theme', isLightMode ? 'light' : 'dark');
      root.style.colorScheme = isLightMode ? 'light' : 'dark';
    };

    applyTheme();
    document.addEventListener('DOMContentLoaded', applyTheme);
    new MutationObserver(applyTheme).observe(document, {
      childList: true,
      subtree: true,
    });
  }, theme);

  const setupPage = await context.newPage();
  const setupVideo = setupPage.video();
  const setupDiagnostics = attachBrowserDiagnostics(setupPage, testInfo);
  const setupBlockedMutations = await installReadOnlyNetworkGuard(setupPage);

  await loginWithDemoAccount(setupPage);
  await prepareCaptureContext(setupPage, theme, viewport);
  if (flow === 'collection-overlay') {
    await warmCollectionVideoContext(setupPage);
  } else {
    await warmSearchVideoContext(setupPage);
  }
  await setupDiagnostics.flush();
  const setupBlockingErrors = setupDiagnostics.blockingErrors();
  await setupPage.close();
  await setupVideo?.delete().catch(() => {});

  const recordingStartedAt = Date.now();
  const page = await context.newPage();
  const diagnostics = attachBrowserDiagnostics(page, testInfo);
  const blockedMutations = [
    ...setupBlockedMutations,
    ...(await installReadOnlyNetworkGuard(page)),
  ];
  let blockingErrors: unknown[] = [];
  let video = page.video();
  let trimStartMs = 0;

  try {
    if (flow === 'collection-overlay') {
      const result = await performCollectionOverlayVideoFlow(page, recordingStartedAt);
      trimStartMs = result.trimStartMs;
    } else {
      const result = await performSearchResultsVideoFlow(page, recordingStartedAt);
      trimStartMs = result.trimStartMs;
    }
  } finally {
    await diagnostics.flush();
    blockingErrors = [
      ...setupBlockingErrors,
      ...diagnostics.blockingErrors(),
    ];
    video = page.video();
    await page.close().catch(() => {});
    await context.close();
  }

  if (video) {
    const finalVideoPath = path.join(liveDemoVideoDir, `${videoName(theme, flow, viewport)}.webm`);
    const rawVideoPath = path.join(liveDemoVideoDir, `${videoName(theme, flow, viewport)}.raw.webm`);
    await video.saveAs(rawVideoPath);
    await video.delete().catch(() => {});
    trimVideoClip(rawVideoPath, finalVideoPath, trimStartMs);
    fs.rmSync(rawVideoPath, { force: true });
  }

  return { blockedMutations, blockingErrors };
}

async function recordAuthLifecycleVideoClip(
  browser: Browser,
  theme: ThemeMode,
  viewport: ViewportMode,
  testInfo: TestInfo,
) {
  const viewportSize = captureViewports[viewport];
  const isMobileViewport = viewport === 'mobile';
  const context = await browser.newContext({
    baseURL: process.env.E2E_BASE_URL ?? 'https://pokegonexus.com',
    viewport: viewportSize,
    hasTouch: isMobileViewport,
    isMobile: isMobileViewport,
    serviceWorkers: 'block',
    recordVideo: {
      dir: liveDemoVideoDir,
      size: viewportSize,
    },
  });
  await installVideoPresentationHelpers(context, viewport === 'desktop');
  await context.addInitScript((mode: ThemeMode) => {
    const isLightMode = mode === 'light';
    window.localStorage.setItem('isLightMode', JSON.stringify(isLightMode));
    const applyTheme = () => {
      const root = document.documentElement;
      if (!root) return;

      root.setAttribute('data-theme', isLightMode ? 'light' : 'dark');
      root.style.colorScheme = isLightMode ? 'light' : 'dark';
    };

    applyTheme();
    document.addEventListener('DOMContentLoaded', applyTheme);
    new MutationObserver(applyTheme).observe(document, {
      childList: true,
      subtree: true,
    });
  }, theme);

  const recordingStartedAt = Date.now();
  const page = await context.newPage();
  const diagnostics = attachBrowserDiagnostics(page, testInfo);
  const blockedMutations = await installAuthCaptureNetworkGuard(page);
  const account = generateDisposableAuthAccount();
  let video = page.video();
  let trimStartMs = 0;
  let cleanupError: unknown = null;
  let blockingErrors: unknown[] = [];

  try {
    const result = await performAuthLifecycleVideoFlow(page, account, recordingStartedAt);
    trimStartMs = result.trimStartMs;
  } finally {
    await diagnostics.flush();
    blockingErrors = diagnostics.blockingErrors();
    video = page.video();

    if (!account.deleted) {
      try {
        account.userId = account.userId || (await readStoredAuthUserId(page));
        const deletedFromPage = await cleanupDisposableAuthAccountFromPage(page, account);
        if (!deletedFromPage) {
          await cleanupDisposableAuthAccount(context, account);
        }
      } catch (error) {
        cleanupError = error;
      }
    }

    await page.close().catch(() => {});
    await context.close();
  }

  if (video) {
    const finalVideoPath = path.join(
      liveDemoVideoDir,
      `${mediaName(theme, 'auth-lifecycle', viewport)}.webm`,
    );
    const rawVideoPath = path.join(
      liveDemoVideoDir,
      `${mediaName(theme, 'auth-lifecycle', viewport)}.raw.webm`,
    );
    await video.saveAs(rawVideoPath);
    await video.delete().catch(() => {});
    trimVideoClip(rawVideoPath, finalVideoPath, trimStartMs, authVideoMaxDurationSeconds);
    fs.rmSync(rawVideoPath, { force: true });
  }

  return { blockedMutations, blockingErrors, cleanupError };
}

async function recordWorkflowVideoClip(
  browser: Browser,
  theme: ThemeMode,
  viewport: ViewportMode,
  flow: WorkflowVideoFlow,
  testInfo: TestInfo,
) {
  const viewportSize = captureViewports[viewport];
  const isMobileViewport = viewport === 'mobile';
  const context = await browser.newContext({
    baseURL: process.env.E2E_BASE_URL ?? 'https://pokegonexus.com',
    viewport: viewportSize,
    hasTouch: isMobileViewport,
    isMobile: isMobileViewport,
    serviceWorkers: 'block',
    recordVideo: {
      dir: liveDemoVideoDir,
      size: viewportSize,
    },
  });
  await installVideoPresentationHelpers(context, viewport === 'desktop');
  await context.addInitScript((mode: ThemeMode) => {
    const isLightMode = mode === 'light';
    window.localStorage.setItem('isLightMode', JSON.stringify(isLightMode));
    const applyTheme = () => {
      const root = document.documentElement;
      if (!root) return;

      root.setAttribute('data-theme', isLightMode ? 'light' : 'dark');
      root.style.colorScheme = isLightMode ? 'light' : 'dark';
    };

    applyTheme();
    document.addEventListener('DOMContentLoaded', applyTheme);
    new MutationObserver(applyTheme).observe(document, {
      childList: true,
      subtree: true,
    });
  }, theme);

  const account = generateDisposableAuthAccount();
  let setupBlockingErrors: unknown[] = [];
  const setupBlockedMutations: BlockedMutation[] = [];
  let cleanupError: unknown = null;
  let accountCreated = false;

  try {
    await createDisposableAuthAccount(context, account);
    accountCreated = true;

    const setupPage = await context.newPage();
    const setupVideo = setupPage.video();
    const setupDiagnostics = attachBrowserDiagnostics(setupPage, testInfo);
    setupBlockedMutations.push(...(await installAuthCaptureNetworkGuard(setupPage)));

    try {
      await setupPage.setViewportSize(viewportSize);
      await loginWithDisposableAccount(setupPage, account);
      await seedStoredLocationFromAccount(setupPage);
    } finally {
      await setupDiagnostics.flush();
      setupBlockingErrors = setupDiagnostics.blockingErrors();
      await setupPage.close().catch(() => {});
      await setupVideo?.delete().catch(() => {});
    }
  } catch (error) {
    if (accountCreated && !account.deleted) {
      await cleanupDisposableAuthAccount(context, account).catch(() => {});
    }
    await context.close().catch(() => {});
    throw error;
  }

  const recordingStartedAt = Date.now();
  const page = await context.newPage();
  const diagnostics = attachBrowserDiagnostics(page, testInfo);
  const blockedMutations = [
    ...setupBlockedMutations,
    ...(await installAuthCaptureNetworkGuard(page)),
  ];
  let video = page.video();
  let trimStartMs = 0;
  let blockingErrors: unknown[] = [];

  try {
    const result = await performWorkflowVideoFlow(page, flow, recordingStartedAt);
    trimStartMs = result.trimStartMs;
  } finally {
    await diagnostics.flush();
    blockingErrors = [
      ...setupBlockingErrors,
      ...diagnostics.blockingErrors(),
    ];
    video = page.video();

    if (!account.deleted) {
      try {
        account.userId = account.userId || (await readStoredAuthUserId(page));
        const deletedFromPage = await cleanupDisposableAuthAccountFromPage(page, account);
        if (!deletedFromPage) {
          await cleanupDisposableAuthAccount(context, account);
        }
      } catch (error) {
        cleanupError = error;
      }
    }

    await page.close().catch(() => {});
    await context.close();
  }

  if (video) {
    const finalVideoPath = path.join(
      liveDemoVideoDir,
      `${workflowVideoName(theme, flow, viewport)}.webm`,
    );
    const rawVideoPath = path.join(
      liveDemoVideoDir,
      `${workflowVideoName(theme, flow, viewport)}.raw.webm`,
    );
    await video.saveAs(rawVideoPath);
    await video.delete().catch(() => {});
    trimVideoClip(rawVideoPath, finalVideoPath, trimStartMs, workflowVideoMaxDurationForFlow(flow));
    fs.rmSync(rawVideoPath, { force: true });
  }

  return { blockedMutations, blockingErrors, cleanupError };
}

test.describe('live demo media capture', () => {
  test.setTimeout(600_000);

  test.skip(process.env.DEMO_CAPTURE_LIVE !== '1', 'Only run through npm run capture:demo:live');
  test.skip(
    !demoUsername || !demoPassword,
    'Set POKEGONEXUS_DEMO_USERNAME and POKEGONEXUS_DEMO_PASSWORD to capture live media',
  );

  test('captures Pokémon Go Nexus surfaces with a real read-only demo account', async ({ page }, testInfo) => {
    fs.rmSync(liveDemoMediaDir, { recursive: true, force: true });
    fs.mkdirSync(liveDemoMediaDir, { recursive: true });
    const diagnostics = attachBrowserDiagnostics(page, testInfo);
    const blockedMutations = await installReadOnlyNetworkGuard(page);

    try {
      await loginWithDemoAccount(page);

      for (const theme of captureThemes) {
        for (const viewport of Object.keys(captureViewports) as ViewportMode[]) {
          await prepareCaptureContext(page, theme, viewport);
          await captureCollection(page, theme, viewport);
          await captureSearch(page, theme, viewport);
        }
      }
    } finally {
      await diagnostics.flush();
    }

    expect(
      blockedMutations,
      `live capture blocked unexpected account-mutating requests:\n${JSON.stringify(blockedMutations, null, 2)}`,
    ).toEqual([]);

    const blockingErrors = diagnostics.blockingErrors();
    expect(
      blockingErrors,
      `browser diagnostics should not include runtime errors:\n${JSON.stringify(blockingErrors, null, 2)}`,
    ).toEqual([]);
  });
});

test.describe('live demo video capture', () => {
  test.setTimeout(1_800_000);

  test.skip(
    !runLiveVideoCapture,
    'Only run through npm run capture:demo:video:live',
  );
  test.skip(
    !demoUsername || !demoPassword,
    'Set POKEGONEXUS_DEMO_USERNAME and POKEGONEXUS_DEMO_PASSWORD to capture live video',
  );

  test(
    'records Pokémon Go Nexus demo flows with a real read-only demo account',
    async ({ browser }, testInfo) => {
      fs.mkdirSync(liveDemoVideoDir, { recursive: true });
      removeRawPlaywrightVideos();
      const blockedMutations: BlockedMutation[] = [];
      const blockingErrors: unknown[] = [];

      for (const theme of videoThemes) {
        for (const viewport of videoViewports) {
          for (const flow of videoFlows) {
            const result = await recordVideoClip(
              browser,
              theme,
              viewport,
              flow,
              testInfo,
            );
            blockedMutations.push(...result.blockedMutations);
            blockingErrors.push(...result.blockingErrors);
          }
        }
      }

      expect(
        blockedMutations,
        `live video capture blocked unexpected account-mutating requests:\n${JSON.stringify(blockedMutations, null, 2)}`,
      ).toEqual([]);

      expect(
        blockingErrors,
        `browser diagnostics should not include runtime errors:\n${JSON.stringify(blockingErrors, null, 2)}`,
      ).toEqual([]);

      removeRawPlaywrightVideos();
    },
  );
});

test.describe('live demo auth lifecycle capture', () => {
  test.setTimeout(1_200_000);

  test.skip(
    !runLiveAuthCapture,
    'Only run through npm run capture:demo:auth:live',
  );

  test(
    'records disposable account registration login and deletion',
    async ({ browser }, testInfo) => {
      fs.mkdirSync(liveDemoVideoDir, { recursive: true });
      removeRawPlaywrightVideos();
      const blockedMutations: BlockedMutation[] = [];
      const blockingErrors: unknown[] = [];
      const cleanupErrors: unknown[] = [];

      for (const theme of authVideoThemes) {
        for (const viewport of authVideoViewports) {
          const result = await recordAuthLifecycleVideoClip(
            browser,
            theme,
            viewport,
            testInfo,
          );
          blockedMutations.push(...result.blockedMutations);
          blockingErrors.push(...result.blockingErrors);
          if (result.cleanupError) cleanupErrors.push(result.cleanupError);
        }
      }

      expect(
        blockedMutations,
        `auth lifecycle capture blocked unexpected mutations:\n${JSON.stringify(blockedMutations, null, 2)}`,
      ).toEqual([]);

      expect(
        cleanupErrors,
        `disposable auth account cleanup failed:\n${JSON.stringify(cleanupErrors, null, 2)}`,
      ).toEqual([]);

      expect(
        blockingErrors,
        `browser diagnostics should not include runtime errors:\n${JSON.stringify(blockingErrors, null, 2)}`,
      ).toEqual([]);

      removeRawPlaywrightVideos();
    },
  );
});

test.describe('live demo workflow capture', () => {
  test.setTimeout(4_800_000);

  test.skip(
    !runLiveWorkflowCapture,
    'Only run through npm run capture:demo:workflows:live',
  );

  test(
    'records disposable account Pokemon workflows',
    async ({ browser }, testInfo) => {
      fs.mkdirSync(liveDemoVideoDir, { recursive: true });
      removeRawPlaywrightVideos();
      const blockedMutations: BlockedMutation[] = [];
      const blockingErrors: unknown[] = [];
      const cleanupErrors: unknown[] = [];

      for (const theme of workflowVideoThemes) {
        for (const viewport of workflowVideoViewports) {
          for (const flow of workflowVideoFlows) {
            const result = await recordWorkflowVideoClip(
              browser,
              theme,
              viewport,
              flow,
              testInfo,
            );
            blockedMutations.push(...result.blockedMutations);
            blockingErrors.push(...result.blockingErrors);
            if (result.cleanupError) cleanupErrors.push(result.cleanupError);
          }
        }
      }

      expect(
        blockedMutations,
        `workflow capture blocked unexpected mutations:\n${JSON.stringify(blockedMutations, null, 2)}`,
      ).toEqual([]);

      expect(
        cleanupErrors,
        `disposable workflow account cleanup failed:\n${JSON.stringify(cleanupErrors, null, 2)}`,
      ).toEqual([]);

      expect(
        blockingErrors,
        `browser diagnostics should not include runtime errors:\n${JSON.stringify(blockingErrors, null, 2)}`,
      ).toEqual([]);

      removeRawPlaywrightVideos();
    },
  );
});
