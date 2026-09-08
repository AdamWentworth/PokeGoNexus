import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { Page } from '@playwright/test';

// Playwright routing disables the browser HTTP cache. Retain only tiles actually
// requested by the visible demo map, honoring the provider's cache lifetime.
export async function installCaptureTileCache(page: Page) {
  const cacheDir = path.resolve('.artifacts/map-tile-cache');
  fs.mkdirSync(cacheDir, { recursive: true });
  await page.route('https://tile.openstreetmap.org/**', async (route) => {
    const key = createHash('sha256').update(route.request().url()).digest('hex');
    const file = path.join(cacheDir, `${key}.json`);
    if (fs.existsSync(file)) {
      const cached = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (cached.expiresAt > Date.now()) {
        await route.fulfill({
          status: 200,
          contentType: 'image/png',
          body: Buffer.from(cached.body, 'base64'),
        });
        return;
      }
    }
    const headers: Record<string, string> = {
      ...route.request().headers(),
      'user-agent': 'PokeGoNexusMediaCapture/1.0 (+https://pokegonexus.com)',
    };
    delete headers['cache-control'];
    delete headers['pragma'];
    const response = await route.fetch({ headers });
    const body = await response.body();
    if (response.ok()) {
      const maxAge = /max-age=(\d+)/.exec(response.headers()['cache-control'] ?? '');
      const expiresAt = Date.now() + Number(maxAge?.[1] ?? 604800) * 1000;
      const temp = `${file}.${process.pid}.tmp`;
      fs.writeFileSync(temp, JSON.stringify({ expiresAt, body: body.toString('base64') }));
      fs.renameSync(temp, file);
    }
    await route.fulfill({ response, body });
  });
}
