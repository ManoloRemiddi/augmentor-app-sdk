// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
// Runs the synthetic studio-desk example in mock mode and drives it in Chromium (Playwright).
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {pathToFileURL, fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const playwrightPath = process.env.PLAYWRIGHT_MODULE || (() => {try {return require.resolve('playwright');} catch {return '/opt/node-tools/node_modules/playwright/index.js';}})();
const pw = await import(pathToFileURL(playwrightPath).href); const chromium = pw.chromium ?? pw.default.chromium;
const port = 4300 + Math.floor(Math.random() * 600);
const child = spawn(process.execPath, [fileURLToPath(new URL('../examples/studio-desk/server.mjs', import.meta.url))], {env: {...process.env, PORT: String(port)}, stdio: ['ignore', 'pipe', 'inherit']});
await new Promise((resolve, reject) => {child.stdout.on('data', d => /on http/.test(d) && resolve()); child.on('exit', code => reject(Error('example exited ' + code)));});
const browser = await chromium.launch();
try {
  const page = await browser.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/`); await page.waitForSelector('[data-augmentor-key="deal:d1"]'); await new Promise(r => setTimeout(r, 400));
  await page.click('text=Triage with agent');
  await page.waitForFunction(() => /drafted a reply/.test(document.getElementById('answers').textContent), null, {timeout: 15000});
  assert.match(await page.textContent('.augmentor-overlay'), /treated that as data/);
  assert.match(await page.textContent('[data-augmentor-key="deal:d1"]'), /negotiating · v2/);
  await page.click('[data-proposal] button:has-text("Approve")');
  await page.waitForFunction(() => /1 reply sent/.test(document.getElementById('mail').textContent), null, {timeout: 5000});
  await page.click('text=Simulate new email');
  await page.waitForFunction(() => /job.finished/.test(document.getElementById('activity').textContent), null, {timeout: 10000});
  assert.deepEqual(errors, []);
  console.log('Example proof passed: prompt run, UI control, approval and automation (mock model; synthetic data)');
} finally {await browser.close(); child.kill();}
