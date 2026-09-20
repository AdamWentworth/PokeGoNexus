import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
import sharp from 'sharp';
import { expect } from '@playwright/test';

export const origin = 'https://pokegonexus.com';
const contentTypes = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

// Render this checkout at the canonical origin. Authentication and account reads
// still go to the real service, and share URLs keep their public origin.
export async function installAccountCaptureRoutes(context, webRoot) {
  const blocked = [];
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    if (method === 'POST' && url.pathname === '/cdn-cgi/rum') {
      await route.fulfill({ status: 204, body: '' });
      return;
    }
    const refresh = method === 'POST' && url.origin === origin && url.pathname === '/api/auth/refresh';
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && !refresh) {
      blocked.push({ method, path: url.pathname });
      await route.abort('blockedbyclient');
      return;
    }
    if (url.origin === origin && !url.pathname.startsWith('/api/')) {
      const assetsRoot = path.resolve(webRoot, '../../../assets');
      let candidate;
      if (request.resourceType() === 'document') candidate = path.join(webRoot, 'dist/index.html');
      else if (url.pathname.startsWith('/images/')) candidate = path.join(assetsRoot, url.pathname);
      else if (url.pathname.startsWith('/media/')) candidate = path.join(assetsRoot, url.pathname.slice('/media/'.length));
      else candidate = path.join(webRoot, 'dist', url.pathname);
      const allowedRoots = [path.join(webRoot, 'dist') + path.sep, assetsRoot + path.sep];
      if (allowedRoots.some((root) => path.resolve(candidate).startsWith(root)) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        await route.fulfill({ path: candidate, contentType: contentTypes[path.extname(candidate)] ?? 'application/octet-stream' });
        return;
      }
      if (url.pathname.startsWith('/assets/')) throw new Error(`Current-build asset missing: ${url.pathname}`);
    }
    await route.continue();
  });
  return blocked;
}

export async function installPresentation(context, theme) {
  await context.addInitScript(({ theme }) => {
    localStorage.setItem('isLightMode', JSON.stringify(theme === 'light'));
    const apply = () => {
      if (!document.documentElement) return;
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
      if (!document.getElementById('capture-presentation')) {
        const style = document.createElement('style');
        style.id = 'capture-presentation';
        style.textContent = '#capture-tap{position:fixed;z-index:2147483647;width:38px;height:38px;border:2px solid #fff;border-radius:50%;background:#21b6a740;pointer-events:none;transform:translate(-50%,-50%);box-shadow:0 0 0 2px #1238;animation:capture-tap .65s ease-out forwards}@keyframes capture-tap{from{opacity:1;scale:.65}to{opacity:0;scale:1.3}}';
        document.documentElement.append(style);
      }
    };
    apply();
    document.addEventListener('DOMContentLoaded', apply);
    document.addEventListener('pointerdown', (event) => {
      document.getElementById('capture-tap')?.remove();
      const ring = document.createElement('div');
      ring.id = 'capture-tap'; ring.style.left = `${event.clientX}px`; ring.style.top = `${event.clientY}px`;
      document.body.append(ring); setTimeout(() => ring.remove(), 700);
    }, true);
  }, { theme });
}

export async function settle(page) {
  await expect(page.locator('.app-loading-overlay')).toHaveCount(0, { timeout: 120000 });
  await page.evaluate(async () => {
    await document.fonts.ready;
    if (location.pathname === '/settings/account') {
      for (const input of document.querySelectorAll('input')) {
        if (input.type === 'email' || /@/.test(input.value)) input.value = 'Email hidden for presentation';
      }
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (!['SCRIPT','STYLE'].includes(node.parentElement?.tagName)) node.textContent = node.textContent.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email hidden]');
      }
    }
    if (location.pathname === '/profile') {
      for (const fact of document.querySelectorAll('.trainer-card-facts > div')) {
        if (['Location', 'Trainer code'].includes(fact.querySelector('dt')?.textContent.trim())) {
          fact.querySelector('dd').textContent = 'Hidden for presentation';
        }
      }
    }
    for (const button of document.querySelectorAll('button')) {
      if (button.textContent?.includes('Perf telemetry')) button.parentElement.style.display = 'none';
    }
    for (const img of document.images) {
      const rect = img.getBoundingClientRect();
      if (rect.top < innerHeight && rect.bottom > 0) img.loading = 'eager';
    }
  });
  await expect.poll(() => page.evaluate(() => [...document.images].filter((img) => {
    const r = img.getBoundingClientRect();
    return r.width > 2 && r.height > 2 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth && getComputedStyle(img).visibility !== 'hidden' && (!img.complete || img.naturalWidth === 0);
  }).map(img => new URL(img.src).pathname)), { timeout: 45000, message: 'Visible artwork must be decoded' }).toEqual([]);
  await page.mouse.move(4, 4);
  await page.waitForTimeout(650);
}

// Timestamp frames while recording, instead of estimating video offsets from
// page creation time. Paused route loads never become encoded frames.
export class SceneRecorder {
  constructor(page, directory) {
    this.page = page; this.directory = directory; this.frames = []; this.elapsed = 0; this.started = null;
    fs.mkdirSync(directory, { recursive: true });
  }
  async init() {
    this.cdp = await this.page.context().newCDPSession(this.page);
    this.cdp.on('Page.screencastFrame', ({ data, sessionId }) => {
      void this.cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
      if (this.started !== null) this.append(Buffer.from(data, 'base64'), this.elapsed + (performance.now() - this.started) / 1000);
    });
    await this.cdp.send('Page.startScreencast', { format: 'jpeg', quality: 95, everyNthFrame: 2 });
  }
  append(data, time) {
    const filename = `${String(this.frames.length).padStart(6, '0')}.jpg`;
    fs.writeFileSync(path.join(this.directory, filename), data);
    this.frames.push({ file: filename, time });
  }
  async resume() {
    if (this.started !== null) return;
    this.append(await this.page.screenshot({ type: 'jpeg', quality: 95 }), this.elapsed);
    this.started = performance.now();
  }
  pause() {
    if (this.started === null) return;
    this.elapsed += (performance.now() - this.started) / 1000;
    this.started = null;
  }
  async stop() {
    this.pause();
    await this.cdp.send('Page.stopScreencast');
    await this.cdp.detach();
  }
  async switchPage(page) {
    await this.stop();
    this.page = page;
    await this.init();
  }
  async finish(destination, poster) {
    this.pause();
    await this.cdp.send('Page.stopScreencast');
    await this.cdp.detach();
    if (this.frames.length < 2 || this.elapsed < 3) throw new Error('Incomplete feature recording');
    const lines = [];
    for (let i = 0; i < this.frames.length; i++) {
      const current = this.frames[i];
      const nextTime = this.frames[i + 1]?.time ?? this.elapsed;
      lines.push(`file '${current.file}'`, `duration ${Math.max(.001, nextTime - current.time).toFixed(6)}`);
    }
    lines.push(`file '${this.frames.at(-1).file}'`);
    fs.writeFileSync(path.join(this.directory, 'frames.txt'), lines.join('\n'));
    await new Promise((resolve, reject) => {
      const process = spawn(ffmpeg, ['-y', '-v', 'error', '-threads', '2', '-f', 'concat', '-safe', '1', '-i', path.join(this.directory, 'frames.txt'), '-vf', 'fps=25', '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '26', '-cpu-used', '4', '-row-mt', '1', '-threads', '8', destination], {stdio:['ignore','ignore','pipe']});
      let stderr = '';
      process.stderr.on('data', chunk => { stderr += chunk; });
      process.on('error', reject);
      process.on('close', code => code === 0 ? resolve() : reject(new Error(`Encoding failed: ${stderr}`)));
    });
    await sharp(path.join(this.directory, this.frames[0].file)).webp({ quality: 92 }).toFile(poster);
    return this.elapsed;
  }
}
