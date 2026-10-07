// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
// Browser proof: real Chromium (Playwright) against the single-file bundle and a real SDK
// server. The panel here is a synthetic stand-in that speaks panel protocol v2; it is not the
// maintained Augmentor panel and proves only the SDK's host side. Synthetic data only.
// Usage: npm run test:browser   (PLAYWRIGHT_MODULE=/path/to/playwright if not resolvable)
import http from 'node:http';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {readFileSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {defineApp, createAugmentorServer, defineTool, definePrompt} from '../src/index.mjs';

const require = createRequire(import.meta.url);
const playwrightPath = process.env.PLAYWRIGHT_MODULE || (() => {try {return require.resolve('playwright');} catch {return '/opt/node-tools/node_modules/playwright/index.js';}})();
const playwright = await import(pathToFileURL(playwrightPath).href);
const chromium = playwright.chromium ?? playwright.default.chromium;
const bundle = readFileSync(new URL('../dist/augmentor-browser.mjs', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'sdk-browser-proof-')), tokenFile = join(dir, 'runtime.token');
writeFileSync(tokenFile, 'synthetic-runtime-token-'.repeat(3));

const app = defineApp({id: 'proof', name: 'Browser proof', tools: [
  defineTool({name: 'proof_publish', description: 'Publish the synthetic note', effect: 'external', summary: () => 'Publish note', preview: () => ({type: 'card', title: 'Note preview', body: 'Synthetic body'}), handler: () => ({published: true})}),
], prompts: [definePrompt({id: 'explain', title: 'Explain', template: 'Explain record {{id}}.', variables: {type: 'object', properties: {id: {type: 'string'}}, required: ['id']}})]});

const preferences = [];
const PAGE = `<!doctype html><meta charset="utf-8"><title>Proof</title>
<div id="row" data-augmentor-key="deal:42">Deal 42 — renewal terms here</div><div id="panel" style="height:200px"></div><div id="review"></div><div id="ui"></div>
<button id="ask" data-augmentor-prompt="explain" data-augmentor-vars='{"id":"r1"}'>Ask</button>
<script type="module">
import * as sdk from '/sdk.mjs';
window.sdk = sdk; window.log = [];
const panel = sdk.mountAugmentor({container: document.getElementById('panel'), allow: ['microphone', 'clipboard-write'], theme: {mode: 'light', accent: '#2563eb'}, onEvent: e => log.push(['event', e.event])});
window.panel = panel;
const agent = sdk.createAgent({panel});
sdk.bindPromptButtons(document.body, agent, {onResult: r => log.push(['ask', r.delivered]), onError: e => log.push(['ask-error', e.code])});
window.page = sdk.connectPage({actions: {navigate: ({route}) => {history.pushState({}, '', route); return {at: location.pathname};}}, describeView: () => ({route: location.pathname, selection: ['deal:42']})});
window.review = sdk.mountReviewQueue(document.getElementById('review'), {eventsUrl: '/api/augmentor/events'});
window.ready = true;
</script>`;
// Stand-in panel: advertises v2 capabilities and acknowledges prompts.
const PANEL = `<!doctype html><meta charset="utf-8"><script>
parent.postMessage({type: 'augmentor-ready', profile: 'proof', capabilities: ['prompt', 'new-chat']}, location.origin);
addEventListener('message', e => {
  if (e.source !== parent) return;
  if (e.data.type === 'augmentor-prompt') {window.received = e.data; parent.postMessage({type: 'augmentor-result', requestId: e.data.requestId, ok: true, result: {accepted: true}}, location.origin);
    parent.postMessage({type: 'augmentor-event', event: 'turn.finished', data: {}}, location.origin);}
});
</script>stand-in panel`;

let server;
const httpServer = http.createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  if (path === '/') {res.writeHead(200, {'Content-Type': 'text/html', 'Set-Cookie': 'owner=1; Path=/; SameSite=Strict'}); return res.end(PAGE);}
  if (path === '/sdk.mjs') {res.writeHead(200, {'Content-Type': 'text/javascript'}); return res.end(bundle);}
  if (path === '/augmentor/sidepanel.html') {res.writeHead(200, {'Content-Type': 'text/html'}); return res.end(PANEL);}
  if (path === '/augmentor/preferences' && req.method === 'POST') {let body = ''; for await (const c of req) body += c; preferences.push({origin: req.headers.origin, body: JSON.parse(body)}); res.writeHead(200, {'Content-Type': 'application/json'}); return res.end('{}');}
  if (!(await server.node(req, res))) {res.writeHead(404); res.end();}
});
httpServer.listen(0, '127.0.0.1'); await once(httpServer, 'listening');
const origin = 'http://127.0.0.1:' + httpServer.address().port;
server = createAugmentorServer(app, {origin, authorizeOwner: r => /(^|; )owner=1/.test(r.headers.cookie || ''), runtimeTokenFile: tokenFile});
const browser = await chromium.launch();
const results = [];
const check = async (label, fn) => {await fn(); results.push(label); console.log('✓', label);};
try {
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(origin + '/'); await page.waitForFunction(() => window.ready);
  await check('bundle loads without imports and exposes the browser API', async () => assert.equal(await page.evaluate(() => typeof sdk.renderAgentUi), 'function'));
  await check('iframe permissions are declared before load and the theme is stored first', async () => {
    await page.waitForFunction(() => panel.capabilities.length > 0);
    assert.equal(await page.evaluate(() => panel.frame.allow), 'microphone; clipboard-write');
    assert.deepEqual(preferences[0].body.set, {'augmentor-theme': 'light', 'augmentor-accent-hue': '221'}); assert.equal(preferences[0].origin, origin);
  });
  await check('premade prompt buttons render on the server and deliver into a v2 panel', async () => {
    await page.click('#ask'); await page.waitForFunction(() => log.some(l => l[0] === 'ask'));
    const received = await page.frames()[1].evaluate(() => window.received);
    assert.equal(received.text, 'Explain record r1.'); assert.equal(received.send, true);
    assert.ok(await page.evaluate(() => log.some(l => l[0] === 'event' && l[1] === 'turn.finished')));
  });
  await check('agent commands reach the focused page: toast, highlight, navigate and view', async () => {
    await page.waitForFunction(() => true); await new Promise(r => setTimeout(r, 300));
    assert.deepEqual(await server.bridge.command('notify', {message: 'Saved <b>draft</b>', href: '/deals/42'}), {shown: true});
    assert.equal(await page.textContent('.augmentor-toast'), 'Saved <b>draft</b>Open');
    assert.equal(await page.locator('.augmentor-toast b').count(), 0);
    assert.deepEqual(await server.bridge.command('highlight', {target: 'deal:42', text: 'renewal'}), {found: true, textFound: true});
    assert.equal(await page.evaluate(() => document.getElementById('row').classList.contains('augmentor-highlight')), true);
    assert.deepEqual(await server.bridge.command('navigate', {route: '/deals/42'}), {at: '/deals/42'});
    await new Promise(r => setTimeout(r, 400));
    assert.deepEqual((await server.bridge.command('view')).view, {route: '/deals/42', selection: ['deal:42']});
  });
  await check('ask shows a choice and returns the human answer to the agent', async () => {
    const answer = server.bridge.command('ask', {spec: {type: 'choice', question: 'Which tone?', options: [{id: 'warm', label: 'Warm'}, {id: 'firm', label: 'Firm'}]}});
    await page.click('.augmentor-overlay button:has-text("Firm")');
    assert.deepEqual(await answer, {answered: true, values: {selected: ['firm']}});
  });
  await check('generative UI uses text only and refuses unsafe links', async () => {
    const html = await page.evaluate(() => {
      const spec = {type: 'stack', children: [
        {type: 'card', title: '<img src=x onerror=alert(1)>', body: 'Body', fields: [{label: 'Fee', value: 1200}], actions: [{label: 'Bad', href: 'javascript:alert(1)'}, {label: 'Ok', href: '/deals/1'}]},
        {type: 'table', columns: [{key: 'a', label: 'A'}], rows: [{a: '<script>x</script>'}]},
        {type: 'diff', before: 'a\nb', after: 'a\nc'}, {type: 'chart', kind: 'bar', series: [{label: 'S', points: [{x: 'Mon', y: 2}, {x: 'Tue', y: 5}]}]},
        {type: 'list', items: [{title: 'L', href: '//evil.invalid'}]}, {type: 'checklist', items: [{id: 'c', label: 'Check'}]},
        {type: 'receipt', title: 'Done', status: 'done', href: 'https://example.invalid/r'}]};
      const node = sdk.renderAgentUi(spec); document.getElementById('ui').append(node);
      return {imgs: node.querySelectorAll('img,script').length, links: [...node.querySelectorAll('a')].map(a => a.getAttribute('href')), bars: node.querySelectorAll('svg rect').length, diff: node.querySelector('.augmentor-ui-diff').textContent};
    });
    assert.equal(html.imgs, 0); assert.deepEqual(html.links, ['/deals/1', 'https://example.invalid/r']); assert.equal(html.bars, 2); assert.match(html.diff, /- b\+ c/);
  });
  await check('the review queue shows a proposal and the owner approves it', async () => {
    const receipt = await server.toolkit.call('proof_publish', {}, {sessionId: 'proof-session', operationId: 'proof-op-1'});
    assert.equal(receipt.status, 'approval_required');
    await page.waitForSelector('[data-proposal] .augmentor-ui-title');
    assert.equal(await page.textContent('[data-proposal] > .augmentor-ui-title'), 'Publish note');
    await page.click('[data-proposal] button:has-text("Approve")');
    await page.waitForFunction(() => !document.querySelector('[data-proposal]'));
    assert.equal(server.proposals.get(receipt.proposalId).state, 'executed');
  });
  assert.deepEqual(errors, []);
  console.log(`Browser proof passed: ${results.length} checks (synthetic stand-in panel; not product qualification)`);
} finally {
  await browser.close(); server.close(); httpServer.closeAllConnections(); httpServer.close(); rmSync(dir, {recursive: true, force: true});
}
