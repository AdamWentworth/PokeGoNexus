#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { chromium, expect, request } from '@playwright/test';
import sharp from 'sharp';
import { flows } from './account-media/flows.mjs';
import { installAccountCaptureRoutes, installPresentation, origin, SceneRecorder, settle } from './account-media/runtime.mjs';

const webRoot = path.resolve(import.meta.dirname, '..');
const repoRoot = path.resolve(webRoot, '../../..');
const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const viewports = { desktop: { width: 1440, height: 900 }, mobile: { width: 412, height: 915 } };
const select = (values, allowed, kind) => {
  const result = values.split(',');
  if (result.some(value => !allowed.includes(value))) throw new Error(`Unknown ${kind}. Choose from ${allowed.join(', ')}.`);
  return [...new Set(result)];
};
if (args.includes('--help')) {
  console.log(`Capture the migration checkout using your signed-in account.\nRun capture:demo:account:login first.\nOptions: --flows ${flows.map(flow=>flow.key).join(',')} --themes dark,light --viewports desktop,mobile --skip-build --login --resume /absolute/run-directory`);
  process.exit(0);
}
const themes = select(option('--themes', 'dark,light'), ['dark', 'light'], 'theme');
const viewportNames = select(option('--viewports', 'desktop,mobile'), Object.keys(viewports), 'viewport');
const selectedKeys = select(option('--flows', flows.map(flow => flow.key).join(',')), flows.map(flow => flow.key), 'flow');
const authPath = path.join(webRoot, '.artifacts/account-media/auth-state.json');
if (!fs.existsSync(authPath) || args.includes('--login')) {
  const signIn = spawnSync(process.execPath, ['scripts/sign-in-account-media.mjs'], {cwd:webRoot,stdio:'inherit'});
  if (signIn.status !== 0) throw new Error('Capture sign-in did not complete.');
}
const git = (...parameters) => execFileSync('git', parameters, { cwd: repoRoot, encoding: 'utf8' }).trim();
const sha = data => createHash('sha256').update(data).digest('hex');
const sourceFiles = git('ls-files', '--cached', '--others', '--exclude-standard', '--', 'frontend/apps/web', 'frontend/packages', 'frontend/package.json', 'frontend/package-lock.json', 'assets').split('\n').filter(Boolean).sort();
const identityFor = files => sha(files.map(file => `${file}\0${fs.existsSync(path.join(repoRoot,file)) ? sha(fs.readFileSync(path.join(repoRoot,file))) : 'deleted'}`).join('\n'));
const sourceIdentity = () => identityFor(sourceFiles);
const appSourceFiles = sourceFiles.filter(file => !file.startsWith('frontend/apps/web/scripts/') && !file.endsWith('.md') && !file.includes('/tests/'));
const source = { appSourceSha256:identityFor(appSourceFiles), branch: git('branch', '--show-current'), commit: git('rev-parse', 'HEAD'), dirty: Boolean(git('status','--porcelain')), sourceSha256: sourceIdentity() };
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const resume = option('--resume', null);
const output = resume ? path.resolve(resume) : path.join(webRoot, '.artifacts/account-media', stamp);
const statePath = path.join(output, 'run-state.json');
const priorState = resume ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : null;
if (priorState && priorState.source.appSourceSha256 !== source.appSourceSha256) throw new Error('App source changed since this capture. Start a fresh run.');
const packageRoot = path.join(output, 'package');
for (const dir of ['screenshots', 'posters', 'videos']) fs.mkdirSync(path.join(packageRoot, dir), { recursive: true });
console.log(`Account media output: ${output}`);
if (!args.includes('--skip-build') && !resume) {
  const env = { ...process.env, VITE_ASSET_ORIGIN: origin, VITE_DISABLE_SERVICE_WORKER: 'true', VITE_FORCED_REFRESH_TIMESTAMP: '0', VITE_LOG_LEVEL: 'error' };
  for (const [key, suffix] of Object.entries({ POKEMON_API_URL:'pokemon',AUTH_API_URL:'auth',RECEIVER_API_URL:'receiver',USERS_API_URL:'users',SEARCH_API_URL:'search',LOCATION_SERVICE_URL:'location',EVENTS_API_URL:'events' })) env[`VITE_${key}`] = `${origin}/api/${suffix}`;
  const build = spawnSync('npm', ['run','build','--','--mode','production'], { cwd: webRoot, env, stdio: 'inherit' });
  if (build.status !== 0) throw new Error('Capture build failed.');
}
const builtFiles = fs.readdirSync(path.join(webRoot, 'dist'), {recursive:true}).filter(file => fs.statSync(path.join(webRoot, 'dist', file)).isFile()).sort();
const buildSha256 = sha(builtFiles.map(file => `${file}\0${sha(fs.readFileSync(path.join(webRoot, 'dist', file)))}`).join('\n'));
if (priorState && priorState.buildSha256 !== buildSha256) throw new Error('Production build changed since this capture. Start a fresh run.');
const runState = priorState ?? {source,buildSha256,startedAt:new Date().toISOString(),attempts:[]};
for (const attempt of runState.attempts) {
  attempt.appSourceSha256 ??= runState.source.appSourceSha256;
  attempt.buildSha256 ??= runState.buildSha256;
}
runState.attempts.push({startedAt:new Date().toISOString(),sourceSha256:source.sourceSha256,appSourceSha256:source.appSourceSha256,buildSha256,reason:resume ? 'Resumed with unchanged app source and production build.' : 'Initial capture.'});
fs.writeFileSync(statePath,JSON.stringify(runState,null,2)+'\n');
const evidence = priorState ? JSON.parse(fs.readFileSync(path.join(output,'progress.json'),'utf8')) : [];
const filesFor = flow => [...flow.shots.map(shot=>shot.file), ...(flow.video ? [flow.video,flow.video.replace(/^videos\//,'posters/').replace(/\.webm$/,'.webp')] : [])];
const checksumsFor = flow => Object.fromEntries(filesFor(flow).map(file=>[file,sha(fs.readFileSync(path.join(packageRoot,file)))]));
for (const flow of evidence) {
  const checksums = checksumsFor(flow);
  if (flow.assetChecksums && JSON.stringify(flow.assetChecksums) !== JSON.stringify(checksums)) throw new Error(`Completed media changed: ${flow.theme}/${flow.viewport}/${flow.flow}`);
  flow.assetChecksums = checksums;
  flow.sourceSha256 ??= priorState.source.sourceSha256;
}
fs.writeFileSync(path.join(output,'progress.json'),JSON.stringify(evidence,null,2));

// Refresh through the normal authenticated endpoint before creating the browser
// when the saved access token is close to expiry. Never store passwords.
const saved = JSON.parse(fs.readFileSync(authPath,'utf8'));
const savedOrigin = saved.origins.find(entry=>entry.origin===origin);
const savedUser = JSON.parse(savedOrigin?.localStorage.find(entry=>entry.name==='user')?.value ?? 'null');
if (!savedUser || Date.parse(savedUser.accessTokenExpiry) < Date.now()+120000) {
  const api = await request.newContext({storageState:saved,extraHTTPHeaders:{Origin:origin,Referer:origin+'/login'}});
  try {
    const response = await api.post(origin+'/api/auth/refresh',{data:{}});
    if (!response.ok()) throw new Error(`Session refresh rejected (HTTP ${response.status()}). Run capture:demo:account:login, then resume.`);
    const refreshed = await response.json();
    if (!refreshed.username || !refreshed.user_id || !refreshed.accessTokenExpiry) throw new Error('Unexpected session refresh response.');
    saved.cookies = (await api.storageState()).cookies;
    const entry = savedOrigin ?? {origin,localStorage:[]};
    if (!savedOrigin) saved.origins.push(entry);
    entry.localStorage = entry.localStorage.filter(item=>item.name!=='user');
    entry.localStorage.push({name:'user',value:JSON.stringify(refreshed)});
    fs.writeFileSync(authPath,JSON.stringify(saved),{mode:0o600});
    console.log('Refreshed the saved capture session.');
  } finally {await api.dispose();}
}
const browserEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== 'SNAP' && !['GIO_','GTK_','SNAP_'].some(prefix => key.startsWith(prefix))));
const browser = await chromium.launch({ headless: true, env: browserEnv });
let captureAccount = priorState?.captureAccount;
try {
  for (const theme of themes) for (const viewport of viewportNames) {
    const pending = flows.filter(flow => selectedKeys.includes(flow.key) && !evidence.some(entry=>entry.theme===theme && entry.viewport===viewport && entry.flow===flow.key));
    if (!pending.length) continue;
    const context = await browser.newContext({ baseURL: origin, storageState: authPath, viewport: viewports[viewport], isMobile: viewport === 'mobile', hasTouch: viewport === 'mobile', serviceWorkers: 'block' });
    const blocked = await installAccountCaptureRoutes(context, webRoot);
    await installPresentation(context, theme);
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    const errors = [];
    page.on('response', response => {
      const url = new URL(response.url());
      if (url.origin === origin && url.pathname.startsWith('/api/') && response.status() >= 400) errors.push(`HTTP ${response.status()} ${url.pathname}`);
    });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/pokemon', { waitUntil:'domcontentloaded', timeout:60000 });
    await expect(page.locator('.pokemon-card').first()).toBeVisible({ timeout:120000 });
    await settle(page);
    const currentAccount = await page.evaluate(() => {
      const user = JSON.parse(localStorage.getItem('user') || 'null');
      return user?.username ?? null;
    });
    if (!currentAccount) throw new Error('Capture session expired. Run the local sign-in command again, then resume.');
    if (captureAccount && currentAccount !== captureAccount) throw new Error('The signed-in account changed. Start a fresh capture for another account.');
    captureAccount = currentAccount;
    runState.captureAccount = captureAccount;
    fs.writeFileSync(statePath,JSON.stringify(runState,null,2)+'\n');
    console.log(`Authenticated collection ready: ${theme}/${viewport}`);
    for (const flow of pending) {
      const stem = `${theme}-${flow.key}-${viewport}`;
      let guestContext;
      let guestBlocked = [];
      let flowPage = page;
      if (flow.guest) {
        guestContext = await browser.newContext({ baseURL: origin, viewport:viewports[viewport], isMobile:viewport === 'mobile', hasTouch:viewport === 'mobile', serviceWorkers:'block' });
        guestBlocked = await installAccountCaptureRoutes(guestContext, webRoot);
        await installPresentation(guestContext, theme);
        flowPage = await guestContext.newPage();
        flowPage.on('pageerror', error => errors.push(error.message));
      }
      let pageForFlow = flowPage;
      const recorder = new SceneRecorder(pageForFlow, path.join(output, 'frames', stem));
      await recorder.init();
      const shots = [];
      const errorOffset = errors.length;
      const capture = {
        get page() { return pageForFlow; }, username: captureAccount,
        pause() { recorder.pause(); },
        async open(route, heading) {
          recorder.pause();
          await pageForFlow.goto(route, { waitUntil:'domcontentloaded', timeout:60000 });
          if (heading) await expect(pageForFlow.getByRole('heading', { name:heading, exact:true }).first()).toBeVisible({ timeout:120000 });
          await settle(pageForFlow);
        },
        async openPublic(route, heading) {
          if (!guestContext) {
            recorder.pause();
            guestContext = await browser.newContext({ baseURL:origin, viewport:viewports[viewport], isMobile:viewport === 'mobile', hasTouch:viewport === 'mobile', serviceWorkers:'block' });
            guestBlocked = await installAccountCaptureRoutes(guestContext, webRoot);
            await installPresentation(guestContext, theme);
            pageForFlow = await guestContext.newPage();
            pageForFlow.setDefaultTimeout(30000);
            pageForFlow.on('pageerror', error => errors.push(error.message));
            await recorder.switchPage(pageForFlow);
          }
          await capture.open(route, heading);
        },
        async click(locator) {
          await locator.click();
          await pageForFlow.waitForTimeout(800);
        },
        async shot(key, label, scope = 'account') {
          await settle(pageForFlow);
          if (['catalog','owned'].includes(scope)) {
            const groups = pageForFlow.locator('.raid-roster-segments:visible, .max-roster-segments:visible, .pvp-roster-scope > div:visible, .pvp-iv-scope:visible');
            if (await groups.count()) await expect(groups.first().getByRole('button', {name:scope === 'owned' ? /^My Pokémon/ : 'All Pokémon'})).toHaveClass(/active/);
          }
          const filename = `screenshots/${theme}-${key}-${viewport}.webp`;
          await sharp(await pageForFlow.screenshot({ animations:'disabled' })).webp({quality:92}).toFile(path.join(packageRoot,filename));
          shots.push({ key, label, scope, audience:guestContext ? 'visitor' : 'signed-in', route:new URL(pageForFlow.url()).pathname, file:filename });
          if (!flow.screenshotsOnly) {
            await recorder.resume();
            await pageForFlow.waitForTimeout(2400);
          }
        },
      };
      console.log(`Recording ${stem}`);
      let durationSeconds = 0;
      try {
        await flow.run(capture);
        if (flow.screenshotsOnly) await recorder.stop();
        else {
          await pageForFlow.waitForTimeout(1600);
          durationSeconds = await recorder.finish(path.join(packageRoot,'videos',`${stem}.webm`), path.join(packageRoot,'posters',`${stem}.webp`));
        }
      } catch (error) {
        await pageForFlow.screenshot({path:path.join(output, `${stem}-failure.png`)}).catch(() => {});
        throw error;
      } finally {
        fs.writeFileSync(authPath, JSON.stringify(await context.storageState({indexedDB:true})), {mode:0o600});
        await guestContext?.close();
      }
      const runtimeErrors = errors.slice(errorOffset);
      if (runtimeErrors.length) throw new Error(`Runtime errors in ${stem}: ${runtimeErrors.join('; ')}`);
      if (blocked.length || guestBlocked.length) throw new Error(`Capture attempted account writes: ${JSON.stringify([...blocked, ...guestBlocked])}`);
      const entry = { sourceSha256:source.sourceSha256, theme, viewport, size:viewports[viewport], flow:flow.key, label:flow.label, shots, ...(flow.screenshotsOnly ? {} : {video:`videos/${stem}.webm`}), durationSeconds, runtimeErrors };
      entry.assetChecksums = checksumsFor(entry);
      evidence.push(entry);
      fs.writeFileSync(path.join(output,'progress.json'),JSON.stringify(evidence,null,2));
      console.log(`Captured ${stem}: ${shots.length} screens, ${durationSeconds.toFixed(1)} seconds`);
    }
    fs.writeFileSync(authPath, JSON.stringify(await context.storageState({ indexedDB:true })), { mode:0o600 });
    await context.close();
  }
} finally {
  await browser.close();
}
if (source.sourceSha256 !== sourceIdentity()) throw new Error('Capture source changed while recording. Retry for a consistent package.');
const assets = [];
for (const relative of [...new Set(evidence.flatMap(filesFor))].sort()) {
  const data = fs.readFileSync(path.join(packageRoot,relative));
  assets.push({file:relative,bytes:data.length,sha256:sha(data)});
}
const routes = [...fs.readFileSync(path.join(repoRoot,'frontend/packages/app-core/src/App.tsx'),'utf8').matchAll(/<Route\s+path="([^"]+)"/g)].map(match=>match[1]);
const aliases = {'/account':'/settings/account','/friends':'/profile/friends'};
const fullCoverage = selectedKeys.length === flows.length && themes.length === 2 && viewportNames.length === 2;
const routeFor = (route) => route === '/missing-reference-route' ? '*' : route.endsWith('/'+encodeURIComponent(captureAccount)) ? route.slice(0,route.lastIndexOf('/'))+'/:username' : route;
if (fullCoverage) for (const theme of themes) for (const viewport of viewportNames) {
  const covered = new Set(evidence.filter(flow=>flow.theme===theme && flow.viewport===viewport).flatMap(flow=>flow.shots.map(shot=>routeFor(shot.route))));
  const missing = routes.filter(route=>!covered.has(aliases[route]??route));
  if (missing.length) throw new Error(`Missing routes for ${theme}/${viewport}: ${missing.join(', ')}`);
}
const manifest = { schemaVersion:1,capturedAt:new Date().toISOString(),source,captureAttempts:runState.attempts,renderer:'responsive-web',buildMode:'production-local-interface-live-account',buildSha256,dataMode:'live-account',maskedFields:['Email addresses on account/security screens','Trainer code and location on the signed-in trainer card'],data:'Signed-in account and live API reads; current migration-branch interface and product artwork.',captureAccount,fullCoverage,routes,aliases,limitations:['Browser footage does not certify native Android/iOS behavior.','Account, collection and trade mutations are blocked during recording; auth refresh is allowed.'],themes,viewports:Object.fromEntries(viewportNames.map(name=>[name,viewports[name]])),flows:evidence,assets };
fs.writeFileSync(path.join(packageRoot,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
fs.writeFileSync(path.join(webRoot,'.artifacts/account-media/latest-package.txt'),packageRoot+'\n');
console.log(`Verified account package: ${packageRoot}`);
