// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
// Installed-runtime proof: a real DSH web host with the Augmentor integration installed by the
// product's own setup code, a workspace registered with `augmentor-app register`, the product's
// embedding service and native host, the maintained panel in Chromium inside an SDK host page,
// and an SDK application server. The model is a deterministic OpenAI-compatible fixture, so this
// proves the wiring end to end, not model quality. Isolated synthetic state; nothing outside the
// temporary directory is read or written, and no external service is contacted.
// Usage: node scripts/proof-installed.mjs <built product checkout> <python with websocket-client>
//   (npm run test:installed -- <product> <python>)
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import {once} from 'node:events';
import {spawn, spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {pathToFileURL, fileURLToPath} from 'node:url';

const [product, python] = process.argv.slice(2).map(p => p && resolve(p));
if (!product || !python) throw Error('Usage: node scripts/proof-installed.mjs <built product checkout> <python with websocket-client>');
const sdk = fileURLToPath(new URL('../', import.meta.url));
const dshCli = join(product, 'release/dsh/node_modules/@deepseek-ai/dsh/lib/bin.js');
const work = realpathSync(mkdtempSync(join(tmpdir(), 'sdk-installed-')));
const step = text => console.error('· ' + text);

// ---- Isolated environment (inherited by every child) ----
const xdg = name => join(work, 'xdg', name);
Object.assign(process.env, {HOME: join(work, 'home'), XDG_CONFIG_HOME: xdg('config'), XDG_DATA_HOME: xdg('data'), XDG_STATE_HOME: xdg('state'),
  DSH_HOME: join(work, 'dsh'), AUGMENTOR_DSH_CLI: dshCli, AUGMENTOR_DSH_WORKSPACE_ROOT: join(work, 'chats'), SDK_FIXTURE_KEY: 'fixture-key'});
for (const name of ['AUGMENTOR_SHARED_CONFIG', 'AUGMENTOR_WORKSPACE_PROFILES', 'AUGMENTOR_WORKSPACE_PROFILE']) delete process.env[name];
for (const dir of [process.env.HOME, xdg('config'), xdg('data'), xdg('state'), process.env.DSH_HOME, process.env.AUGMENTOR_DSH_WORKSPACE_ROOT]) mkdirSync(dir, {recursive: true});
const freePort = async () => {const s = net.createServer().listen(0, '127.0.0.1'); await once(s, 'listening'); const {port} = s.address(); s.close(); await once(s, 'close'); return port;};
const listen = async server => {server.listen(0, '127.0.0.1'); await once(server, 'listening'); return server.address().port;};
const children = new Set(), servers = [];
let browser;

// ---- Deterministic model: a script per premade prompt, keyed by the owner's request ----
const requests = [];
const scripts = {
  'Triage deal': [['deal_desk_list_deals', {}], ['deal_desk_update_deal', {id: 'd1', stage: 'negotiating', expectedVersion: 1}],
    ['deal_desk_ui_open', {kind: 'deal', id: 'd1'}], ['deal_desk_send_reply', {dealId: 'd1', body: 'Thanks, happy to discuss terms.'}],
    'Moved d1 to negotiating and queued a reply for your approval.'],
  'Summarise deal': [['deal_desk_list_deals', {}], 'Deal d1: Synthetic Audio, negotiating.'],
};
const text = content => typeof content === 'string' ? content : Array.isArray(content) ? content.map(p => p.text ?? '').join('') : '';
function answer(body) {
  const messages = body.messages || [];
  let index = -1, script;
  for (let i = messages.length - 1; i >= 0 && index < 0; i--) if (messages[i].role === 'user') for (const key of Object.keys(scripts)) if (text(messages[i].content).includes(key)) {index = i; script = scripts[key]; break;}
  if (!script || !body.tools?.length) return {content: 'Fixture reply.'}; // titles and other auxiliary calls
  const done = messages.slice(index + 1).filter(m => m.role === 'tool').length, next = script[Math.min(done, script.length - 1)];
  return typeof next === 'string' ? {content: next} : {tool: next};
}
const model = http.createServer(async (req, res) => {
  let raw = ''; for await (const chunk of req) raw += chunk;
  if (req.method === 'GET') {res.writeHead(200, {'content-type': 'application/json'}); res.end(JSON.stringify({data: [{id: 'fixture'}]})); return;}
  const body = JSON.parse(raw); requests.push(body); const reply = answer(body);
  const delta = reply.tool ? {role: 'assistant', tool_calls: [{index: 0, id: 'call-' + requests.length, type: 'function', function: {name: reply.tool[0], arguments: JSON.stringify(reply.tool[1])}}]} : {role: 'assistant', content: reply.content};
  res.writeHead(200, {'content-type': 'text/event-stream'});
  for (const [d, finish] of [[delta, null], [{}, reply.tool ? 'tool_calls' : 'stop']]) res.write('data: ' + JSON.stringify({id: 'fixture-' + requests.length, object: 'chat.completion.chunk', model: 'fixture', choices: [{index: 0, delta: d, finish_reason: finish}]}) + '\n\n');
  res.end('data: [DONE]\n\n');
});
servers.push(model);
const modelPort = await listen(model);
const patch = join(work, 'model.patch.yml');
writeFileSync(patch, JSON.stringify([
  {id: 'llm-pi-ai', config: {providers: {local: {displayName: 'Fixture', api: 'openai-completions', baseURL: `http://127.0.0.1:${modelPort}/v1`, apiKeyEnv: 'SDK_FIXTURE_KEY',
    models: [{id: 'fixture', name: 'Fixture', contextWindow: 262144, maxTokens: 32768}]}}}},
  {id: 'agent-default-model', config: {provider: 'local', model: 'fixture'}}]));

// ---- Real DSH web host ----
const dshPort = await freePort();
async function startDsh() {
  const child = spawn(process.execPath, [dshCli, '--profile', 'web', '--patch', patch, '--no-open', '--host', '127.0.0.1', '--port', String(dshPort)], {stdio: ['ignore', 'pipe', 'pipe'], cwd: work});
  children.add(child); let output = '';
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('DSH did not start:\n' + output)), 90000);
    const read = chunk => {output += chunk; const m = /dsh web: (http:\/\/127\.0\.0\.1:\d+\/\?token=[A-Za-z0-9_-]+)/.exec(output); if (m) {clearTimeout(timer); resolve(m[1]);}};
    child.stdout.on('data', read); child.stderr.on('data', read); child.on('exit', code => reject(Error(`DSH exited ${code}:\n` + output)));
  });
  return {child, url};
}
const stopDsh = async ({child}) => {child.kill('SIGTERM'); await once(child, 'exit'); children.delete(child);};

// ---- The product's own DSH integration setup (services/dsh/setup.py) ----
const setupScript = join(work, 'setup-dsh.py');
writeFileSync(setupScript, `import json, os, sys
sys.path.insert(0, os.path.join(sys.argv[1], 'services', 'dsh'))
import setup
s = setup.Setup(); checked = s.check({'endpoint': sys.argv[2], 'home': os.environ['DSH_HOME']})
result = {'check': checked}
if sys.argv[3] == 'install' and not checked['installed']: result['install'] = s.install(checked['token'])
if sys.argv[3] == 'save': result['save'] = s.save(checked['token'])
print(json.dumps(result))
`);
const setup = (url, action) => {
  const run = spawnSync(python, ['-I', '-B', setupScript, product, url, action], {encoding: 'utf8', timeout: 120000});
  if (run.status !== 0) throw Error('Product DSH setup failed:\n' + run.stderr + run.stdout);
  return JSON.parse(run.stdout.trim().split('\n').at(-1));
};

let dsh;
try {
  step('booting DSH web and installing the Augmentor integration with the product installer');
  dsh = await startDsh();
  const installed = setup(dsh.url, 'install');
  assert.equal(installed.install?.installed, true, JSON.stringify(installed));
  await stopDsh(dsh); dsh = await startDsh();
  const saved = setup(dsh.url, 'save');
  assert.equal(saved.check.installed, true); assert.equal(saved.save.saved, true);

  // ---- The application (synthetic) ----
  step('registering the SDK application workspace');
  const {defineApp, defineTool, definePrompt, createAugmentorServer, AugmentorClient} = await import(pathToFileURL(join(sdk, 'src/index.mjs')).href);
  const deals = new Map([['d1', {id: 'd1', brand: 'Synthetic Audio', stage: 'lead', version: 1}]]), sent = [];
  const app = defineApp({id: 'deal-desk', name: 'Deal desk', instructions: ['augmentor/role.md'],
    tools: [
      defineTool({name: 'deal_desk_list_deals', description: 'List deals', effect: 'read', handler: () => ({deals: [...deals.values()]})}),
      defineTool({name: 'deal_desk_update_deal', description: 'Move a deal to a stage (pass the version you read)', effect: 'write', subject: ({id}) => 'deal:' + id,
        input: {type: 'object', properties: {id: {type: 'string', minLength: 1}, stage: {enum: ['lead', 'negotiating', 'won']}, expectedVersion: {type: 'integer', minimum: 1}}, required: ['id', 'stage', 'expectedVersion']},
        handler: ({id, stage, expectedVersion}) => {const d = deals.get(id); assert.equal(d.version, expectedVersion); Object.assign(d, {stage, version: d.version + 1}); return {...d};}}),
      defineTool({name: 'deal_desk_send_reply', description: 'Send a reply email', effect: 'external', summary: ({dealId}) => `Reply on ${dealId}`,
        input: {type: 'object', properties: {dealId: {type: 'string'}, body: {type: 'string', minLength: 1}}, required: ['dealId', 'body']},
        handler: args => {sent.push(args); return {sent: true};}}),
    ],
    prompts: [
      definePrompt({id: 'triage', title: 'Triage', template: 'Triage deal {{id}}.', variables: {type: 'object', properties: {id: {type: 'string'}}, required: ['id']}}),
      definePrompt({id: 'summary', title: 'Summary', run: 'background', template: 'Summarise deal {{id}} in one line.', variables: {type: 'object', properties: {id: {type: 'string'}}, required: ['id']}}),
    ]});
  const appRoot = join(work, 'app'); mkdirSync(join(appRoot, 'augmentor'), {recursive: true});
  writeFileSync(join(appRoot, 'augmentor/role.md'), 'You operate the synthetic deal desk.');
  writeFileSync(join(appRoot, 'augmentor/tools.json'), JSON.stringify(app.descriptors()));
  writeFileSync(join(appRoot, 'augmentor/tools.mjs'), `import {createToolModule} from ${JSON.stringify(pathToFileURL(join(sdk, 'src/dsh.mjs')).href)};\nexport const {name, inject, apply, applicationTools} = createToolModule({pluginId: 'deal-desk-tools', descriptors: new URL('./tools.json', import.meta.url)});\n`);
  writeFileSync(join(appRoot, 'augmentor.app.json'), JSON.stringify(app.manifest(), null, 2));
  const runtimeTokenFile = join(work, 'runtime.token'); writeFileSync(runtimeTokenFile, 'synthetic-runtime-token-'.repeat(3), {mode: 0o600});

  const pageHtml = `<!doctype html><meta charset="utf-8"><title>Deal desk</title><div id="deal">d1</div><div id="panel" style="width:420px;height:700px"></div>
<script type="module">
import {mountAugmentor, connectPage, createAgent} from '/sdk.mjs';
window.log = [];
const panel = mountAugmentor({container: document.getElementById('panel'), onEvent: e => log.push({kind: 'event', ...e}), onStatus: s => log.push({kind: 'status', ...s})});
connectPage({actions: {open: args => {log.push({kind: 'open', args}); document.getElementById('deal').dataset.open = args.id; return {opened: args.id};}}});
window.panel = panel; window.agent = createAgent({panel});
</script>`;
  let server;
  const appHttp = http.createServer(async (req, res) => {
    if (req.url === '/') {res.writeHead(200, {'content-type': 'text/html'}); res.end(pageHtml); return;}
    if (req.url === '/sdk.mjs') {res.writeHead(200, {'content-type': 'text/javascript'}); res.end(readFileSync(join(sdk, 'dist/augmentor-browser.mjs'))); return;}
    if (!(await server.node(req, res))) {res.writeHead(404); res.end();}
  });
  appHttp.on('upgrade', (req, socket, head) => {if (!server.upgrade(req, socket, head)) socket.destroy();});
  servers.push(appHttp);
  const origin = 'http://127.0.0.1:' + await listen(appHttp);

  // Runtime descriptor for the SDK client and CLI (the product's documented contract).
  const descriptor = join(xdg('data'), 'augmentor/desktop.json'); mkdirSync(join(xdg('data'), 'augmentor'), {recursive: true});
  writeFileSync(descriptor, JSON.stringify({root: product, node: process.execPath, python, platform: process.platform}));
  const install = join(work, 'private-install.json');
  writeFileSync(install, JSON.stringify({origin, descriptor, toolConfig: {'deal-desk-tools': {url: origin + '/api/augmentor/tool', tokenFile: runtimeTokenFile}}}));
  const registered = spawnSync(process.execPath, [join(sdk, 'bin/augmentor-app.mjs'), 'register', join(appRoot, 'augmentor.app.json'), install], {encoding: 'utf8', cwd: appRoot, timeout: 60000});
  assert.equal(registered.status, 0, registered.stderr + registered.stdout);
  const profile = JSON.parse(readFileSync(join(xdg('config'), 'augmentor/workspaces/deal-desk.json'), 'utf8'));

  // The product's embedding service (panel assets + native host per connection).
  const {createEmbedServer} = await import(pathToFileURL(join(product, 'apps/browser/embed/server.mjs')).href);
  const embed = createEmbedServer(); servers.push(embed);
  const embedPort = await listen(embed);
  const owner = req => /(?:^|;\s*)owner=1(?:;|$)/.test(req.headers.cookie || '');
  const client = new AugmentorClient({profile: 'deal-desk', descriptor});
  server = createAugmentorServer(app, {origin, runtimeTokenFile, client, authorizeOwner: req => owner(req) && 'owner',
    proxy: {tokenFile: profile.accessTokenFile, port: embedPort, authorize: owner}});

  // ---- The owner's browser ----
  step('opening the application page with the maintained panel in Chromium');
  const require = createRequire(import.meta.url);
  let playwright; try {playwright = require('playwright');} catch {playwright = require(process.env.PLAYWRIGHT_MODULE || '/opt/node-tools/node_modules/playwright');}
  const chromium = playwright.chromium ?? playwright.default.chromium;
  browser = await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {});
  const context = await browser.newContext();
  await context.addCookies([{name: 'owner', value: '1', url: origin}]);
  const page = await context.newPage();
  const consoleErrors = []; page.on('pageerror', e => consoleErrors.push(String(e)));
  page.on('dialog', dialog => dialog.accept()); // product approval prompts are window.confirm today
  await page.goto(origin + '/');
  const ready = await page.evaluate(() => panel.ready);
  assert.deepEqual(ready.capabilities.sort(), ['events', 'focus', 'new-chat', 'prompt', 'status-session'], 'panel advertises protocol v2');
  await page.waitForFunction(() => log.some(e => e.kind === 'status' && e.online), null, {timeout: 60000});

  // 1. Prefill without sending: the owner's composer receives the text, nothing runs.
  const composer = page.frameLocator('iframe').locator('#input');
  assert.deepEqual(await page.evaluate(() => panel.prompt('Draft for the owner to edit', {send: false})), {sent: false});
  assert.equal(await composer.inputValue(), 'Draft for the owner to edit');
  // The owner's draft is never replaced by a host prompt.
  assert.equal(await page.evaluate(() => panel.prompt('Overwrite?', {send: true}).then(() => 'sent', e => e.code)), 'BUSY');
  await composer.fill('');

  // 2. A premade prompt delivered into the panel conversation (agent.ask → panel.prompt).
  step('sending a premade prompt into the panel; the agent operates the application');
  assert.deepEqual(await page.evaluate(() => agent.ask('triage', {id: 'd1'})), {delivered: 'panel'});
  await page.waitForFunction(() => log.some(e => e.kind === 'event' && e.event === 'turn.finished'), null, {timeout: 120000});
  const events = await page.evaluate(() => log.filter(e => e.kind === 'event'));
  const finished = events.find(e => e.event === 'turn.finished');
  assert.equal(finished.data.reason, 'completed', JSON.stringify(events));
  assert.ok(events.some(e => e.event === 'turn.started'));
  const tools = events.filter(e => e.event === 'tool.completed').map(e => e.data.tool);
  assert.deepEqual(tools, ['deal_desk_list_deals', 'deal_desk_update_deal', 'deal_desk_ui_open', 'deal_desk_send_reply'], JSON.stringify(events));
  assert.deepEqual(deals.get('d1'), {id: 'd1', brand: 'Synthetic Audio', stage: 'negotiating', version: 2});
  assert.equal(await page.locator('#deal').getAttribute('data-open'), 'd1', 'the agent opened the record on the page');
  await page.frameLocator('iframe').locator('#log').getByText('queued a reply for your approval').waitFor({timeout: 10000});
  const offered = requests.find(r => text(r.messages?.findLast?.(m => m.role === 'user')?.content).includes('Triage deal'))?.tools.map(t => t.function.name).sort();
  assert.ok(offered.includes('deal_desk_update_deal') && !offered.some(n => /bash|shell|fs_/.test(n)), 'only granted tools: ' + offered);

  // 3. The external effect waits for the owner; approving in the app executes it once.
  const pending = server.proposals.list({state: 'pending'}); assert.equal(pending.length, 1); assert.equal(sent.length, 0);
  const decided = await page.evaluate(id => fetch(`/api/augmentor/review/${id}/decision`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({decision: 'approve'})}).then(r => r.json()), pending[0].id);
  assert.equal(decided.state, 'executed'); assert.equal(sent.length, 1);

  // 4. New chat from the host page.
  assert.deepEqual(await page.evaluate(() => panel.newChat()), {});

  // 5. A background premade prompt: server AgentRunner → SDK client → product native host → DSH.
  step('running a background premade prompt through the SDK client and the product native host');
  const started = await page.evaluate(() => agent.ask('summary', {id: 'd1'}));
  assert.equal(started.delivered, 'background');
  let run; const end = Date.now() + 120000;
  do {await new Promise(r => setTimeout(r, 500)); run = await page.evaluate(id => agent.run(id), started.runId);} while (run.status === 'running' && Date.now() < end);
  assert.equal(run.status, 'completed', JSON.stringify(run)); assert.match(run.text, /Deal d1: Synthetic Audio, negotiating/);

  const kinds = server.activity.list().map(e => e.kind);
  assert.ok(kinds.includes('tool.completed') && kinds.includes('tool.proposed') && kinds.includes('proposal.decided'), kinds.join());
  assert.deepEqual(consoleErrors, []);
  await client.close?.();
  console.log(JSON.stringify({installedDshWebHost: true, productInstallerIntegration: true, sdkRegisterWorkspace: true, productEmbedServiceAndNativeHost: true,
    maintainedPanelInChromium: true, panelProtocolV2: ready.capabilities, prefillKeepsOwnerDraft: true, premadePromptInPanel: true, agentOperatedApp: tools,
    uiCommandReachedPage: true, externalEffectApprovedOnce: true, newChat: true, backgroundRunCompleted: true, modelRequests: requests.length}));
} finally {
  await browser?.close().catch(() => {});
  for (const child of children) child.kill('SIGKILL');
  for (const s of servers) {s.closeAllConnections?.(); s.close();}
  rmSync(work, {recursive: true, force: true});
}
