// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
// Real-runtime proof: the pinned DSH agent loop (agent, loop, LLM provider, tools, system
// prompt, session persistence) drives a generated SDK tool module under the product's own
// workspace policy guard, against a real SDK application server and a connected page.
// The model is a deterministic OpenAI-compatible fixture: this proves the integration path,
// not model quality. Synthetic data only.
// Usage: node scripts/proof-agent-loop.mjs <DSH install root> <augmentor-agent checkout>
//   (npm run test:agent-loop -- <DSH install root> <augmentor-agent checkout>)
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {createRequire} from 'node:module';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {defineApp, defineTool, definePrompt, createAugmentorServer, workspaceProfile} from '../src/index.mjs';

const [installRoot, productRoot] = process.argv.slice(2).map(p => p && resolve(p));
if (!installRoot || !productRoot) throw Error('Usage: node scripts/proof-agent-loop.mjs <DSH install root> <augmentor-agent checkout>');
const require = createRequire(join(installRoot, 'package.json'));
// In the product, DSH runs as `node <install>/lib/bin.js`; plugins resolve DSH packages from there.
process.argv[1] = join(installRoot, 'lib/bin.js');
const load = async name => import(pathToFileURL(require.resolve('@deepseek-ai/' + name)).href);
const work = realpathSync(mkdtempSync(join(tmpdir(), 'sdk-agent-loop-')));
const appRoot = join(work, 'app'), profiles = join(work, 'profiles');
mkdirSync(join(appRoot, 'augmentor'), {recursive: true}); mkdirSync(profiles);
process.env.AUGMENTOR_WORKSPACE_PROFILES = profiles;

// ---- The application (synthetic) ----
const deals = new Map([['d1', {id: 'd1', brand: 'Synthetic Audio', stage: 'lead', version: 1}]]), sent = [];
const app = defineApp({id: 'deal-desk', name: 'Deal desk', instructions: ['augmentor/role.md'], grants: [],
  tools: [
    defineTool({name: 'deal_desk_list_deals', description: 'List deals', effect: 'read', handler: () => ({deals: [...deals.values()]})}),
    defineTool({name: 'deal_desk_update_deal', description: 'Move a deal to a stage (pass the version you read)', effect: 'write', subject: ({id}) => 'deal:' + id,
      input: {type: 'object', properties: {id: {type: 'string', minLength: 1}, stage: {enum: ['lead', 'negotiating', 'won']}, expectedVersion: {type: 'integer', minimum: 1}}, required: ['id', 'stage', 'expectedVersion']},
      handler: ({id, stage, expectedVersion}) => {const d = deals.get(id); assert.equal(d.version, expectedVersion); Object.assign(d, {stage, version: d.version + 1}); return {...d};}}),
    defineTool({name: 'deal_desk_send_reply', description: 'Send a reply email', effect: 'external', summary: ({dealId}) => `Reply on ${dealId}`,
      input: {type: 'object', properties: {dealId: {type: 'string'}, body: {type: 'string', minLength: 1}}, required: ['dealId', 'body']},
      handler: args => {sent.push(args); return {sent: true};}}),
  ],
  prompts: [definePrompt({id: 'triage', title: 'Triage', template: 'Triage deal {{id}}.', variables: {type: 'object', properties: {id: {type: 'string'}}, required: ['id']}})]});
writeFileSync(join(appRoot, 'augmentor/role.md'), 'Synthetic role.');
writeFileSync(join(appRoot, 'augmentor/tools.json'), JSON.stringify(app.descriptors()));
const sdkDsh = pathToFileURL(resolve('src/dsh.mjs')).href;
writeFileSync(join(appRoot, 'augmentor/tools.mjs'), `import {createToolModule} from ${JSON.stringify(sdkDsh)};\nexport const {name, inject, apply, applicationTools} = createToolModule({pluginId: 'deal-desk-tools', descriptors: new URL('./tools.json', import.meta.url)});\n`);
const runtimeTokenFile = join(work, 'runtime.token'); writeFileSync(runtimeTokenFile, 'synthetic-runtime-token-'.repeat(3), {mode: 0o600});

let server;
const appHttp = http.createServer(async (req, res) => {if (!(await server.node(req, res))) {res.writeHead(404); res.end();}});
appHttp.listen(0, '127.0.0.1'); await once(appHttp, 'listening');
const origin = 'http://127.0.0.1:' + appHttp.address().port;
server = createAugmentorServer(app, {origin, authorizeOwner: r => r.headers.cookie === 'owner=1' && 'owner', runtimeTokenFile});

// The workspace profile exactly as `augmentor-app register` would produce it.
const toolUrl = origin + '/api/augmentor/tool';
const profile = workspaceProfile(app.manifest(), {root: appRoot, origin, tokenFile: join(work, 'proxy.token'), toolConfig: {'deal-desk-tools': {url: toolUrl, tokenFile: runtimeTokenFile}}});
writeFileSync(join(profiles, 'deal-desk.json'), JSON.stringify(profile));

// ---- A page connected to the UI bridge (stands in for the browser's EventSource) ----
const commands = [], page = new AbortController();
const stream = await fetch(`${origin}/api/augmentor/ui/stream?page=page-agentloop`, {headers: {Cookie: 'owner=1'}, signal: page.signal});
(async () => {const reader = stream.body.getReader(); let buffer = ''; try {for (;;) {const {value, done} = await reader.read(); if (done) return; buffer += new TextDecoder().decode(value);
  let i; while ((i = buffer.indexOf('\n\n')) >= 0) {const block = buffer.slice(0, i); buffer = buffer.slice(i + 2);
    if (/^event: command/m.test(block)) {const cmd = JSON.parse(/^data: (.+)$/m.exec(block)[1]); commands.push(cmd);
      await fetch(origin + '/api/augmentor/ui/result', {method: 'POST', headers: {Cookie: 'owner=1', Origin: origin, 'Content-Type': 'application/json'}, body: JSON.stringify({id: cmd.id, ok: true, result: {opened: cmd.args.id}})});}}}} catch {}})();

// ---- Deterministic OpenAI-compatible model ----
const requests = [];
const call = (name, args) => ({delta: {role: 'assistant', tool_calls: [{index: 0, id: 'call-' + requests.length, type: 'function', function: {name, arguments: JSON.stringify(args)}}]}, finish: 'tool_calls'});
const script = [
  () => call('deal_desk_list_deals', {}),
  () => call('deal_desk_update_deal', {id: 'd1', stage: 'negotiating', expectedVersion: 1}),
  () => call('deal_desk_update_deal', {id: 'd1', stage: 'maybe', expectedVersion: 2}), // invalid enum: must never reach the app
  () => call('deal_desk_ui_open', {kind: 'deal', id: 'd1'}),
  () => call('deal_desk_send_reply', {dealId: 'd1', body: 'Thanks, happy to discuss.'}),
  () => call('shell_exec', {cmd: 'id'}), // not granted: the product guard must refuse it
  () => ({delta: {role: 'assistant', content: 'Moved the deal and queued a reply for approval.'}}),
];
const model = http.createServer(async (req, res) => {
  let raw = ''; for await (const chunk of req) raw += chunk; const body = JSON.parse(raw); requests.push(body);
  const answer = (script[requests.length - 1] || script.at(-1))();
  res.writeHead(200, {'content-type': 'text/event-stream'});
  for (const [delta, finish] of [[answer.delta, null], [{}, answer.finish || 'stop']]) res.write('data: ' + JSON.stringify({id: 'fixture-' + requests.length, object: 'chat.completion.chunk', model: 'fixture', choices: [{index: 0, delta, finish_reason: finish}]}) + '\n\n');
  res.end('data: [DONE]\n\n');
});
model.listen(0, '127.0.0.1'); await once(model, 'listening');

// ---- Real DSH composition ----
// The product's own installer writes the workspace preset (base persona + workspace context +
// workspace policy guard + the SDK tool module), and DSH's preset roster mounts it per agent.
const home = join(work, 'dsh-home');
mkdirSync(join(home, '.agent-presets/augmentor-browser-product'), {recursive: true});
writeFileSync(join(home, '.agent-presets/augmentor-browser-product/agent.cordis.yml'), JSON.stringify([{id: 'persona', name: '@deepseek-ai/dsh-persona', config: {prefix: 'Synthetic base persona.'}}]));
const {installProfile} = await import(pathToFileURL(join(productRoot, 'services/workspaces/install.mjs')).href);
installProfile(profile, {root: productRoot, home, profilesDir: profiles});
const {Context} = await load('cordis'), {default: Loader} = await load('cordis-plugin-loader'), {createUserMessage} = await load('dsh-llm'), {installModelSelection} = await load('dsh-agent');
const ctx = new Context(), store = join(work, 'sessions'), errors = [];
ctx.on('agent/error', ({error}) => errors.push(String(error)));
try {
  ctx.baseUrl = pathToFileURL(join(installRoot, 'lib/bin.js')).href; // as the dsh binary sets it
  await ctx.plugin(Loader, {baseUrl: ctx.baseUrl}).await();
  for (const name of ['dsh-session-projection', 'dsh-session', 'dsh-session-persistence-jsonl', 'dsh-session-query', 'dsh-llm', 'dsh-system-prompt', 'dsh-tools', 'dsh-agent', 'dsh-agent-loop']) {
    const m = await load(name); await ctx.plugin(m.default ?? m, name === 'dsh-agent-loop' ? {agents: []} : name.endsWith('-jsonl') ? {root: store} : {}).await();
  }
  await ctx.plugin((await load('dsh-agent-presets')).default, {default: profile.preset, roots: [{path: join(home, '.agent-presets'), trust: 'user'}], includeShippedRoot: false, includeUserRoot: false}).await();
  process.env.SDK_AGENT_LOOP_KEY = 'fixture';
  await ctx.plugin(await load('dsh-llm-pi-ai'), {providers: {local: {api: 'openai-completions', baseURL: `http://127.0.0.1:${model.address().port}/v1`, apiKeyEnv: 'SDK_AGENT_LOOP_KEY',
    models: [{id: 'fixture', contextWindow: 262144, maxTokens: 32768, reasoningEfforts: {low: 'low'}}]}}}).await();
  // A tool outside the grant, registered process-wide: the policy row must hide and refuse it.
  ctx.tools.register((await load('dsh-tools')).defineTool({name: 'shell_exec', description: 'Run a shell command', parameters: {cmd: {type: 'string', required: true}},
    output: {schema: {type: 'string'}, render: (_a, v) => [{type: 'text', text: v}]}, execute: async () => {throw Error('shell must never run');}}));
  const handle = await ctx.agents.create({sessionId: 'sdk-agent-loop', meta: {cwd: profile.cwd, agentPreset: profile.preset},
    agentOptions: {provider: 'local', model: 'fixture', reasoningEffort: 'low'},
    async setup(c) {installModelSelection(c, {current: {provider: 'local', model: 'fixture', reasoningEffort: 'low'}}); await ctx.agentPresets.mount(c, profile.preset);}});
  handle.agent.followup(createUserMessage({content: [{type: 'text', text: 'Triage deal d1.'}], source: {kind: 'user'}}));
  await handle.agent.whenIdle();
  const events = handle.agent.session.snapshotEvents();
  const names = new Map(events.filter(e => e.type === 'tool/call').map(e => [e.data.callId, e.data.name]));
  const results = events.filter(e => e.type === 'tool/result').map(e => e.data.message.content[0]).map(r => ({name: names.get(r.toolCallId), isError: r.isError, text: r.content.map(c => c.text).join('')}));
  const offered = requests[0].tools?.map(t => t.function?.name).sort();
  assert.deepEqual(errors, []);
  assert.match(requests[0].messages[0].content, /# Assigned workspace role\nSynthetic role\./); // role installed by the product installer
  assert.ok(offered.includes('deal_desk_update_deal') && offered.includes('deal_desk_ui_open') && !offered.includes('shell_exec'), 'model sees granted SDK tools only: ' + offered);
  const updateSchema = requests[0].tools.find(t => t.function.name === 'deal_desk_update_deal').function.parameters;
  assert.deepEqual(updateSchema.required.sort(), ['expectedVersion', 'id', 'stage']);
  assert.deepEqual(deals.get('d1'), {id: 'd1', brand: 'Synthetic Audio', stage: 'negotiating', version: 2});
  assert.equal(commands.length, 1); assert.equal(commands[0].action, 'open');
  const pending = server.proposals.list({state: 'pending'}); assert.equal(pending.length, 1); assert.equal(pending[0].summary, 'Reply on d1'); assert.equal(sent.length, 0);
  assert.equal(results.length, 6, JSON.stringify(results));
  assert.deepEqual(results.map(r => r.isError), [false, false, true, false, false, true], JSON.stringify(results));
  assert.match(results[2].text, /stage/); // refused by the compiled descriptor before any HTTP call
  assert.match(results[4].text, /pending|proposal/i); assert.match(results[5].text, /not granted to the application workspace/); // the product guard, not a missing tool
  assert.equal(events.filter(e => e.type === 'turn/end').at(-1).data.reason.kind, 'completed');
  // The owner approves in the app; the server executes exactly once.
  const decided = await (await fetch(`${origin}/api/augmentor/review/${pending[0].id}/decision`, {method: 'POST', headers: {Cookie: 'owner=1', Origin: origin, 'Content-Type': 'application/json'}, body: JSON.stringify({decision: 'approve'})})).json();
  assert.equal(decided.state, 'executed'); assert.equal(sent.length, 1);
  const kinds = server.activity.list().map(e => e.kind);
  // The invalid call was refused inside DSH, so the application never saw it.
  assert.ok(kinds.includes('tool.completed') && kinds.includes('tool.proposed') && !kinds.includes('tool.failed'), kinds.join());
  await handle.dispose();
  console.log(JSON.stringify({realDshAgentLoop: true, productInstallerPreset: true, presetRosterMount: true, productWorkspaceGuard: true, roleInSystemPrompt: true, generatedRuntimeModule: true, modelSawGrantedToolsOnly: true, nestedSchemaToModel: true,
    versionedWrite: true, invalidArgumentsRefused: true, uiCommandReachedPage: true, externalEffectBecameProposal: true, ungrantedToolRefused: true, ownerApprovalExecutedOnce: true, modelRequests: requests.length}));
} finally {
  await ctx.fiber.dispose(); page.abort(); server.close(); appHttp.closeAllConnections(); appHttp.close(); model.closeAllConnections(); model.close(); rmSync(work, {recursive: true, force: true});
}
