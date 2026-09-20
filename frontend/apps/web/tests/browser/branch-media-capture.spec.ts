import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { expect, test, type Page } from '@playwright/test';
import ffmpegPath from 'ffmpeg-static';
import { attachBrowserDiagnostics } from './support/diagnostics';
import { installCaptureTileCache } from './support/captureTileCache';
import {
  chooseCapturePokemon,
  installDemoRoutes,
  installPublicCaptureTheme,
  seedDemoBrowserState,
} from './support/demoFixtures';

// This suite captures the production web renderer with synthetic accounts. It is
// intentionally separate from the live-account and native-device capture paths.
const output = path.resolve(process.env.BRANCH_MEDIA_OUTPUT ?? '.artifacts/branch-media');
const viewports = { desktop: { width: 1440, height: 900 }, mobile: { width: 412, height: 915 } };
type Shot = { key: string; route: string; file: string };
type Capture = (key: string) => Promise<void>;
type Flow = {
  key: string;
  route: string;
  ready: string;
  guest?: boolean;
  run: (page: Page, shot: Capture) => Promise<void>;
};

async function open(page: Page, route: string, heading: string) {
  await page.goto(route, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
  await expect(page.locator('.app-loading-overlay')).toHaveCount(0);
}

async function settle(page: Page) {
  await expect(page.locator('.app-loading-overlay')).toHaveCount(0);
  await page.evaluate(async () => {
    await document.fonts.ready;
    // Debug telemetry is not part of the shipped product presentation.
    for (const button of document.querySelectorAll('button')) {
      if (button.textContent?.includes('Perf telemetry') && button.parentElement) {
        button.parentElement.style.display = 'none';
      }
    }
  });
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          Array.from(document.images)
            .filter((img) => {
              const r = img.getBoundingClientRect();
              return (
                r.width > 0 &&
                r.height > 0 &&
                r.bottom > 0 &&
                r.top < innerHeight &&
                r.right > 0 &&
                r.left < innerWidth &&
                getComputedStyle(img).visibility !== 'hidden' &&
                (!img.complete || img.naturalWidth === 0)
              );
            })
            .map((img) => img.getAttribute('src')),
        ),
      { message: 'Visible capture artwork must load', timeout: 15000 },
    )
    .toEqual([]);
  await page.mouse.move(4, 4);
  await page.waitForTimeout(850);
}

const flows: Flow[] = [
  {
    key: 'home',
    route: '/',
    ready: 'Welcome back, NexusDemo',
    run: async (page, shot) => {
      await shot('home');
      await page.getByRole('button', { name: 'Action Menu', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Quick navigation' })).toBeVisible();
      await shot('quick-navigation');
      await page.getByRole('button', { name: 'Close', exact: true }).click();
      await page.mouse.wheel(0, 520);
      await shot('home-dashboard');
    },
  },
  {
    key: 'collection',
    route: '/pokemon',
    ready: '',
    run: async (page, shot) => {
      await shot('catalog');
      await page.getByText('TAGS', { exact: true }).click();
      await page.locator('.tag-item[data-tag="Caught"]').click();
      await shot('collection');
      await page.getByRole('button', { name: 'View Charizard' }).click();
      await expect(page.locator('.instance-overlay')).toBeVisible();
      await shot('instance-overlay');
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      await expect(page.locator('.caught-instance .name-editable-content.editable')).toBeVisible();
      await shot('instance-edit');
    },
  },
  {
    key: 'search',
    route: '/search',
    ready: '',
    run: async (page, shot) => {
      await page.getByRole('tab', { name: 'Trainers', exact: true }).click();
      await shot('search');
      await page.getByRole('searchbox', { name: 'Trainer name' }).fill('Harbour');
      await expect(page.getByRole('heading', { name: 'Nexus · @HarbourMew' })).toBeVisible();
      await shot('trainer-search-results');
      await page.getByRole('tab', { name: 'Pokémon', exact: true }).click();
      await chooseCapturePokemon(page, 'Pikachu');
      await page.getByRole('button', { name: 'For Trade', exact: true }).click();
      await page.getByRole('button', { name: /Location/ }).click();
      await page.getByPlaceholder('Search for a city').fill('Vancouver');
      await page.getByText('Vancouver, British Columbia, Canada').click();
      await shot('search-filters');
      await page.getByRole('button', { name: 'Apply and search' }).click();
      await expect(page.locator('.list-view-container')).toBeVisible();
      await expect(page.getByText('HarbourMew').first()).toBeVisible();
      await shot('search-results-list');
      await page.getByRole('button', { name: 'Map view' }).click();
      await expect(page.locator('.ol-viewport')).toBeVisible();
      await page.waitForTimeout(1500);
      await page.locator('.ol-viewport').scrollIntoViewIfNeeded();
      await expect(page.locator('.ol-attribution')).toBeInViewport();
      await shot('search-results-map');
    },
  },
  {
    key: 'pokedex',
    route: '/pokedex',
    ready: 'Pokédex',
    run: async (page, shot) => {
      await expect(page.locator('.pokedex-region-card').first()).toBeVisible();
      await shot('pokedex');
      await page.locator('.pokedex-region-card').filter({ hasText: 'Kanto' }).first().click();
      await expect(page.getByPlaceholder('Pokemon or number')).toBeVisible();
      await shot('pokedex-region');
      await page.getByPlaceholder('Pokemon or number').fill('Charizard');
      await shot('pokedex-search');
    },
  },
  {
    key: 'raid',
    route: '/raid',
    ready: 'Raid Planner',
    run: async (page, shot) => {
      await expect(page.getByRole('heading', { name: 'Top raid attackers' })).toBeVisible();
      await shot('raid');
      await page.getByRole('button', { name: 'Boss counters', exact: true }).click();
      await expect(page.getByText('Modeling raid timelines…')).toBeHidden({ timeout: 30000 });
      await expect(page.getByLabel('Raid counters').locator('article').first()).toBeVisible();
      await shot('raid-counters');
      await page.getByLabel('Raid counters').scrollIntoViewIfNeeded();
      await shot('raid-counter-results');
    },
  },
  {
    key: 'max',
    route: '/max',
    ready: 'Max Battles',
    run: async (page, shot) => {
      await expect(page.locator('.max-ranking-row').first()).toBeVisible();
      await shot('max');
      await page.getByRole('button', { name: 'Boss teams', exact: true }).click();
      await expect(
        page.getByRole('heading', { name: 'Can this group beat Dynamax Bulbasaur?' }),
      ).toBeVisible();
      await shot('max-boss-teams');
      await page.getByRole('button', { name: 'Add one Trainer' }).click();
      await expect(page.getByLabel('Trainer count')).toHaveValue('2');
      await page.getByLabel('Recommended three-Pokémon party').scrollIntoViewIfNeeded();
      await shot('max-party');
    },
  },
  {
    key: 'pvp',
    route: '/pvp',
    ready: 'PvP Rankings',
    run: async (page, shot) => {
      await expect(page.getByText('Clodsire', { exact: true }).first()).toBeVisible();
      await shot('pvp');
      await page.getByRole('button', { name: 'Team Builder', exact: true }).click();
      await page.getByRole('button', { name: 'Select Lead with Clodsire' }).click();
      await page.getByRole('button', { name: 'Select Safe Swap with Azumarill' }).click();
      await expect(page.getByText('2 / 3')).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, 0));
      await shot('pvp-team-builder');
      await page.getByRole('button', { name: 'IV Rank', exact: true }).click();
      await page.getByRole('searchbox', { name: 'Search IV Rank Pokémon' }).fill('Bulbasaur');
      await page.getByRole('button', { name: 'Select #0001 Bulbasaur' }).click();
      await expect(page.getByText('of 4,096')).toBeVisible();
      await shot('pvp-iv-rank');
    },
  },
  {
    key: 'rankings',
    route: '/rankings',
    ready: 'Community Rankings',
    run: async (page, shot) => {
      await expect(page.getByText('12 trainers want this')).toBeVisible();
      await shot('rankings');
      await page.getByRole('tab', { name: 'Rarest owned' }).click();
      await expect(page.getByText('Owned by 2 trainers')).toBeVisible();
      await shot('rankings-rarest');
      await page.getByRole('searchbox', { name: 'Search rankings' }).fill('Charmander');
      await shot('rankings-search');
    },
  },
  {
    key: 'trades',
    route: '/trades',
    ready: 'Trade preferences',
    run: async (page, shot) => {
      await expect(
        page.getByText('Festival spare').filter({ visible: true }).first(),
      ).toBeVisible();
      await shot('trade-preferences');
      await page.getByRole('tab', { name: 'Trade Activity' }).click();
      await expect(page.locator('.trade-activity-workspace')).toBeVisible();
      await shot('trade-activity');
      await page.getByRole('button', { name: 'Active, 1' }).click();
      await expect(
        page.locator('.trade-activity-workspace').getByText('Mewtwo').first(),
      ).toBeVisible();
      await shot('trade-pending');
    },
  },
  {
    key: 'trade-board',
    route: '/trade-board',
    ready: 'Trade Board',
    run: async (page, shot) => {
      await expect(page.getByText('Include on board', { exact: true })).toBeVisible();
      await shot('trade-board');
      await page.mouse.wheel(0, 480);
      await shot('trade-board-preview');
      await open(page, '/trade-board/NexusDemo', '@NexusDemo’s Trade Board');
      await shot('public-trade-board');
    },
  },
  {
    key: 'social',
    route: '/profile',
    ready: '',
    run: async (page, shot) => {
      await shot('trainer-profile');
      await open(page, '/profile/friends', 'Friends');
      await expect(page.getByText('HarbourMew').first()).toBeVisible();
      await shot('friends');
      await page.goto('/profile/NexusDemo', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.trainer-profile-card')).toBeVisible();
      await shot('public-profile');
      await page.goto('/pokemon/NexusDemo', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.pokemon-card').first()).toBeVisible();
      await shot('public-collection');
    },
  },
  {
    key: 'account',
    route: '/settings',
    ready: 'Settings',
    run: async (page, shot) => {
      await shot('settings');
      await page.mouse.wheel(0, 500);
      await shot('settings-preferences');
      await open(page, '/settings/account', 'Account details');
      await expect(page.getByText('2 active sessions')).toBeVisible();
      await shot('account');
      await page.getByText('2 active sessions').scrollIntoViewIfNeeded();
      await shot('account-security');
    },
  },
  {
    key: 'guide',
    route: '/',
    ready: 'Build your collection.',
    guest: true,
    run: async (page, shot) => {
      await shot('home-guest');
      await open(page, '/getting-started', 'Your first useful trade, step by step.');
      await shot('getting-started');
      await open(page, '/faq', 'Frequently asked questions');
      await shot('faq');
    },
  },
];

const referenceRoutes = [
  ['/help', 'Help & information', 'help'],
  ['/about', 'About Pokémon Go Nexus', 'about'],
  ['/safety', 'Trade Safety & Community Guidelines', 'safety'],
  ['/privacy', 'Privacy Policy', 'privacy'],
  ['/terms', 'Terms of Service', 'terms'],
  ['/data-deletion', 'User Data Deletion', 'data-deletion'],
  ['/raid/methodology', 'How raid rankings work', 'raid-methodology'],
  ['/pvp/methodology', 'How PvP rankings work', 'pvp-methodology'],
  ['/login', '', 'login'],
  ['/register', 'Create your account', 'register'],
  ['/reset-password?token=demo-reset-token', 'Choose a new password', 'reset-password'],
  ['/verify-email-change', 'Email not updated', 'verify-email-change'],
  ['/missing-reference-route', 'That route wandered off.', 'not-found'],
] as const;

test.describe('migration branch media', () => {
  test.skip(process.env.BRANCH_MEDIA_CAPTURE !== '1', 'Run with capture:demo:branch');
  test.describe.configure({ timeout: 120000, mode: 'parallel' });

  for (const theme of ['dark', 'light'] as const) {
    for (const [viewport, size] of Object.entries(viewports)) {
      for (const flow of [
        ...flows,
        {
          key: 'references',
          route: '',
          ready: '',
          guest: true,
          run: async (page: Page, shot: Capture) => {
            for (const [route, heading, key] of referenceRoutes) {
              if (heading) await open(page, route, heading);
              else {
                await page.goto(route, { waitUntil: 'domcontentloaded' });
                await expect(
                  page.getByRole('button', { name: 'Login', exact: true }),
                ).toBeVisible();
              }
              await shot(key);
            }
          },
        },
      ]) {
        test(`${theme} ${viewport} ${flow.key}`, async ({ browser, baseURL }, testInfo) => {
          expect(new URL(baseURL!).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/);
          const stem = `${theme}-${flow.key}-${viewport}`;
          for (const dir of ['screenshots', 'posters', 'videos', 'evidence', 'raw'])
            fs.mkdirSync(path.join(output, dir), { recursive: true });
          const context = await browser.newContext({
            baseURL,
            viewport: size,
            deviceScaleFactor: 1,
            isMobile: viewport === 'mobile',
            hasTouch: viewport === 'mobile',
            serviceWorkers: 'block',
            colorScheme: theme,
            recordVideo: { dir: path.join(output, 'raw'), size },
          });
          const recordingStartedAt = Date.now();
          const page = await context.newPage();
          const diagnostics = attachBrowserDiagnostics(page, testInfo);
          const unhandledApis: string[] = [];
          const shots: Shot[] = [];
          const segments: Array<{ start: number; end: number }> = [];
          let recordingActive = false;
          let segmentStart: number | null = null;
          const videoTime = () => (Date.now() - recordingStartedAt) / 1000;
          const endSegment = () => {
            if (segmentStart !== null) segments.push({ start: segmentStart, end: videoTime() });
            segmentStart = null;
          };
          page.on('request', (request) => {
            if (
              recordingActive &&
              request.isNavigationRequest() &&
              request.frame() === page.mainFrame()
            )
              endSegment();
          });
          const shot: Capture = async (key) => {
            await settle(page);
            if (recordingActive && segmentStart === null) segmentStart = videoTime();
            const file = `screenshots/${theme}-${key}-${viewport}.png`;
            await page.screenshot({ path: path.join(output, file), animations: 'disabled' });
            shots.push({ key, route: new URL(page.url()).pathname, file });
            await page.waitForTimeout(1000);
          };
          let clipSeconds = 0;
          try {
            await page.route('**/__e2e/**', async (route) => {
              unhandledApis.push(
                `${route.request().method()} ${new URL(route.request().url()).pathname}`,
              );
              await route.fulfill({ status: 501, json: { error: 'Missing capture API fixture' } });
            });
            await installDemoRoutes(page);
            await installCaptureTileCache(page);
            await installPublicCaptureTheme(page, theme === 'light');
            if (!flow.guest) await seedDemoBrowserState(page, theme === 'light');
            if (flow.route) {
              if (flow.ready) await open(page, flow.route, flow.ready);
              else {
                await page.goto(flow.route, { waitUntil: 'domcontentloaded' });
                if (flow.key === 'collection')
                  await expect(page.locator('.pokemon-card').first()).toBeVisible();
                if (flow.key === 'social')
                  await expect(page.locator('.trainer-profile-card')).toBeVisible();
                if (flow.key === 'search')
                  await expect(
                    page.getByRole('tab', { name: 'Pokémon', exact: true }),
                  ).toBeVisible();
              }
              if (['raid', 'max', 'pvp'].includes(flow.key))
                await page.getByRole('button', { name: 'All Pokémon', exact: true }).click();
              await settle(page);
            }
            recordingActive = true;
            await flow.run(page, shot);
            await page.waitForTimeout(1500);
            endSegment();
            recordingActive = false;
            clipSeconds = segments.reduce((sum, segment) => sum + segment.end - segment.start, 0);
            if (flow.key === 'account') {
              await page.goto('/account');
              await expect(page).toHaveURL(/\/settings\/account$/);
              await page.goto('/friends');
              await expect(page).toHaveURL(/\/profile\/friends$/);
            }
            expect(diagnostics.blockingErrors()).toEqual([]);
            expect(unhandledApis).toEqual([]);
          } finally {
            await diagnostics.flush();
            await context.close();
          }
          const rawVideo = await page.video()!.path();
          if (flow.key !== 'references') {
            expect(ffmpegPath).toBeTruthy();
            expect(clipSeconds).toBeGreaterThan(3);
            const cuts = segments.map(
              (segment, index) =>
                `[0:v]trim=start=${segment.start}:end=${segment.end},setpts=PTS-STARTPTS[v${index}]`,
            );
            const joined = segments.map((_, index) => `[v${index}]`).join('');
            execFileSync(
              ffmpegPath!,
              [
                '-y',
                '-loglevel',
                'error',
                '-i',
                rawVideo,
                '-filter_complex',
                `${cuts.join(';')};${joined}concat=n=${segments.length}:v=1:a=0[out]`,
                '-map',
                '[out]',
                '-an',
                '-c:v',
                'libvpx-vp9',
                '-crf',
                '36',
                '-b:v',
                '0',
                '-r',
                '24',
                '-threads',
                '2',
                path.join(output, 'videos', `${stem}.webm`),
              ],
              { timeout: 60000 },
            );
            fs.copyFileSync(
              path.join(output, shots[0].file),
              path.join(output, 'posters', `${stem}.png`),
            );
          }
          fs.rmSync(rawVideo);
          fs.writeFileSync(
            path.join(output, 'evidence', `${stem}.json`),
            JSON.stringify(
              {
                theme,
                viewport,
                size,
                flow: flow.key,
                shots,
                video: flow.key === 'references' ? null : `videos/${stem}.webm`,
                durationSeconds: clipSeconds,
                segments,
                runtimeErrors: diagnostics.blockingErrors(),
              },
              null,
              2,
            ),
          );
        });
      }
    }
  }
});
