#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { Writable } from 'node:stream';
import { chromium, expect } from '@playwright/test';

const webRoot = path.resolve(import.meta.dirname, '..');
const output = path.join(webRoot, '.artifacts/account-media/auth-state.json');

async function prompt(question, hidden = false) {
  if (!process.stdin.isTTY) throw new Error('Run this sign-in command in your terminal so you can enter credentials.');
  if (hidden) process.stdout.write(question);
  const muted = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
  const rl = readline.createInterface({ input: process.stdin, output: hidden ? muted : process.stdout, terminal: true });
  try {
    return await new Promise((resolve) => rl.question(hidden ? '' : question, resolve));
  } finally {
    rl.close();
    if (hidden) process.stdout.write('\n');
  }
}

if (process.argv.includes('--help')) {
  console.log('Sign in for account-based media capture. Prompts locally for username/email and a hidden password. Saves an ignored, owner-readable browser session; does not save the password or record the login.');
  process.exit(0);
}

let browser;
try {
  console.log('Sign in to the PokeGoNexus account to feature in videos and screenshots.');
  const username = process.env.POKEGONEXUS_DEMO_USERNAME ?? String(await prompt('PokeGoNexus username/email: ')).trim();
  let password = process.env.POKEGONEXUS_DEMO_PASSWORD ?? String(await prompt('PokeGoNexus password: ', true));
  if (!username || !password) throw new Error('Username/email and password are required.');
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== 'SNAP' && !['GIO_', 'GTK_', 'SNAP_'].some(prefix => key.startsWith(prefix))));
  browser = await chromium.launch({ headless: true, env });
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const allowedAuth = request.method() === 'POST' && url.origin === 'https://pokegonexus.com' && /^\/api\/auth\/(login|refresh)\/?$/.test(url.pathname);
    if (request.method() === 'POST' && url.pathname === '/cdn-cgi/rum') await route.fulfill({ status: 204, body: '' });
    else if (['GET', 'HEAD', 'OPTIONS'].includes(request.method()) || allowedAuth) await route.continue();
    else await route.abort('blockedbyclient');
  });
  const page = await context.newPage();
  await page.goto('https://pokegonexus.com/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.getByPlaceholder('Username or Email').fill(username);
  await page.getByPlaceholder('Password', { exact: true }).fill(password);
  password = '';
  const responsePromise = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/auth/login', { timeout: 45000 });
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  const response = await responsePromise;
  if (!response.ok()) throw new Error(`Sign-in failed (HTTP ${response.status()}). Check your credentials and retry.`);
  await page.waitForFunction(() => {
    try { return Boolean(JSON.parse(localStorage.getItem('user') || 'null')?.username); } catch { return false; }
  }, undefined, { timeout: 60000 });
  await page.goto('https://pokegonexus.com/pokemon', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.pokemon-card').first()).toBeVisible({ timeout: 120000 });
  await expect(page.locator('.app-loading-overlay')).toHaveCount(0, { timeout: 120000 });
  fs.mkdirSync(path.dirname(output), { recursive: true, mode: 0o700 });
  const state = await context.storageState({ indexedDB: true });
  fs.writeFileSync(output, JSON.stringify(state), { mode: 0o600 });
  fs.chmodSync(output, 0o600);
  console.log('Signed in. Your capture session is ready; your password was not saved.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Could not prepare capture sign-in.');
  process.exitCode = 1;
} finally {
  await browser?.close();
}
