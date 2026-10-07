// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
// End-to-end with synthetic data: scripted model → runtime tool module (tools.json) → HTTP tool
// endpoint → toolkit → stores/events → owner review, UI bridge, prompts, automation and MCP.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {defineApp, defineResource, createAugmentorServer, GRANTS} from '../src/app.mjs';
import {defineTool} from '../src/toolkit.mjs';
import {definePrompt} from '../src/prompts.mjs';
import {defineUiAction} from '../src/ui.mjs';
import {createToolModule} from '../src/dsh.mjs';
import {createMockRuntime} from '../src/testing.mjs';
import {validateManifest} from '../src/manifest.mjs';

function dealDesk(db) {
  return defineApp({
    id: 'deal-desk', name: 'Deal desk', description: 'Synthetic CRM used by SDK tests.', instructions: ['augmentor/role.md'], grants: ['memory', 'web', 'ask'],
    routes: {'/deals': 'All deals', '/deals/:id': 'One deal'},
    tools: [
      defineTool({name: 'deal_desk_list_deals', description: 'List deals with their stage and version', effect: 'read', handler: () => ({deals: [...db.values()]})}),
      defineTool({name: 'deal_desk_update_deal', description: 'Change a deal stage (optimistic version check)', effect: 'write', subject: ({id}) => 'deal:' + id,
        input: {type: 'object', properties: {id: {type: 'string'}, stage: {enum: ['new', 'negotiating', 'won', 'lost']}, expectedVersion: {type: 'integer', minimum: 1}}, required: ['id', 'stage', 'expectedVersion']},
        handler: ({id, stage, expectedVersion}) => {const d = db.get(id); if (!d || d.version !== expectedVersion) throw Object.assign(new Error('conflict'), {code: 'VERSION_CONFLICT'}); Object.assign(d, {stage, version: d.version + 1}); return {id, version: d.version};}}),
      defineTool({name: 'deal_desk_send_reply', description: 'Send an email reply to a sponsor', effect: 'external', summary: ({to}) => `Reply to ${to}`,
        preview: ({body}) => ({type: 'text', text: body}), input: {type: 'object', properties: {to: {type: 'string'}, body: {type: 'string', minLength: 1}}, required: ['to', 'body']},
        handler: ({to}) => ({sent: true, to})}),
    ],
    prompts: [
      definePrompt({id: 'triage_mail', title: 'Triage this email', template: 'Triage mail {{mailId}} and move the related deal forward.', variables: {type: 'object', properties: {mailId: {type: 'string'}}, required: ['mailId']}, context: ({mailId}) => ({mailId}), run: 'background'}),
      definePrompt({id: 'morning_brief', title: 'Morning brief', template: 'Write the morning brief.'}),
    ],
    resources: [defineResource({uri: 'app://deal/{id}', name: 'deal', description: 'One deal', read: ({id}) => db.get(id) ?? null})],
    uiActions: [defineUiAction({name: 'open_calculator', description: 'Open the price calculator with inputs', input: {type: 'object', properties: {fee: {type: 'number'}}}, effect: 'draft'})],
  });
}

async function setup(t, {script} = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'sdk-app-')); t.after(() => rmSync(dir, {recursive: true, force: true}));
  const runtimeTokenFile = join(dir, 'runtime.token'), mcpTokenFile = join(dir, 'mcp.token');
  writeFileSync(runtimeTokenFile, 'synthetic-runtime-token-'.repeat(3)); writeFileSync(mcpTokenFile, 'synthetic-mcp-token-'.repeat(3));
  const db = new Map([['d1', {id: 'd1', stage: 'new', version: 1}]]);
  const app = dealDesk(db);
  let server;
  const httpServer = http.createServer(async (req, res) => {if (!(await server.node(req, res))) {res.writeHead(404); res.end();}});
  httpServer.listen(0, '127.0.0.1'); await once(httpServer, 'listening');
  const sockets = new Set(); httpServer.on('connection', s => {sockets.add(s); s.on('close', () => sockets.delete(s));});
  const origin = 'http://127.0.0.1:' + httpServer.address().port;
  // The runtime loads the generated descriptors, exactly like augmentor/tools.mjs would.
  const module = createToolModule({pluginId: 'deal-desk-tools', descriptors: app.descriptors()});
  const appTools = module.applicationTools({url: origin + '/api/augmentor/tool', tokenFile: runtimeTokenFile});
  const runtime = createMockRuntime({profile: 'deal-desk', tools: (name, args, ctx) => appTools.execute(name, args, ctx), script});
  const client = runtime.client();
  server = createAugmentorServer(app, {origin, authorizeOwner: r => r.headers.cookie === 'owner=1' ? 'owner@fixture' : false, runtimeTokenFile, dataDir: join(dir, 'state'), client, mcp: {tokenFile: mcpTokenFile},
    automation: a => a.on('mail.received', {name: 'triage', prompt: 'triage_mail', vars: e => ({mailId: e.data.mailId}), key: e => 'mail:' + e.data.mailId})});
  t.after(async () => {server.close(); runtime.close(); for (const s of sockets) s.destroy(); await new Promise(r => httpServer.close(r));});
  const owner = (path, init = {}) => fetch(origin + path, {...init, headers: {Cookie: 'owner=1', ...(init.body ? {'Content-Type': 'application/json', Origin: origin} : {}), ...(init.headers || {})}});
  const waitFor = async (fn, ms = 4000) => {const end = Date.now() + ms; for (;;) {const v = await fn(); if (v) return v; if (Date.now() > end) throw Error('timed out'); await new Promise(r => setTimeout(r, 20));}};
  return {app, db, server, origin, owner, runtime, waitFor, mcpTokenFile, runtimeTokenFile};
}

test('one declaration generates a valid manifest, descriptors and reference', () => {
  const app = dealDesk(new Map());
  const manifest = app.manifest();
  assert.deepEqual(validateManifest(manifest), manifest);
  const names = manifest.tools[0].names;
  for (const n of ['deal_desk_list_deals', 'deal_desk_send_reply', 'deal_desk_ui_navigate', 'deal_desk_ui_open_calculator', 'deal_desk_reference', 'deal_desk_proposal_status', 'deal_desk_read_resource']) assert.ok(names.includes(n), n);
  assert.deepEqual(manifest.permissions.tools, [...GRANTS.memory, ...GRANTS.web, ...GRANTS.ask]);
  assert.match(app.descriptors().fingerprint, /^[a-f0-9]{64}$/);
  assert.match(app.reference(), /Premade prompts[\s\S]*triage_mail[\s\S]*app:\/\/deal\/\{id\}[\s\S]*\/deals/);
  assert.throws(() => defineApp({id: 'x', name: 'X', tools: [defineTool({name: 'other_tool', description: 'Not prefixed', handler: () => null})]}), e => e.code === 'INVALID_TOOL');
});

test('a background prompt runs the agent through the real tool path and the owner approves its reply', async t => {
  const h = await setup(t, {script: async ({call, context}) => {
    const list = await call('deal_desk_list_deals', {});
    await call('deal_desk_update_deal', {id: list.deals[0].id, stage: 'negotiating', expectedVersion: list.deals[0].version});
    const reply = await call('deal_desk_send_reply', {to: 'brand@example.invalid', body: `About ${context?.mailId}`});
    const ui = await call('deal_desk_ui_notify', {message: 'Deal moved'});
    return `Proposal ${reply.proposalId}; UI ${ui.error?.code ?? 'ok'}`;
  }});
  const started = await (await h.owner('/api/augmentor/prompts/triage_mail/run', {method: 'POST', body: JSON.stringify({vars: {mailId: 'm-7'}})})).json();
  const run = await h.waitFor(async () => {const r = await (await h.owner('/api/augmentor/runs/' + started.runId)).json(); return r.status !== 'running' && r;});
  assert.equal(run.status, 'completed'); assert.match(run.text, /UI UI_UNAVAILABLE/);
  assert.deepEqual(h.db.get('d1'), {id: 'd1', stage: 'negotiating', version: 2});
  const pending = (await (await h.owner('/api/augmentor/review')).json()).items;
  assert.equal(pending.length, 1); assert.equal(pending[0].summary, 'Reply to brand@example.invalid'); assert.equal(pending[0].preview.text, 'About m-7');
  const decided = await (await h.owner(`/api/augmentor/review/${pending[0].id}/decision`, {method: 'POST', body: JSON.stringify({decision: 'approve'})})).json();
  assert.equal(decided.state, 'executed'); assert.deepEqual(decided.result, {sent: true, to: 'brand@example.invalid'});
  const activity = (await (await h.owner('/api/augmentor/activity')).json()).items.map(e => e.kind);
  for (const kind of ['tool.completed', 'tool.proposed', 'proposal.decided', 'agent.run']) assert.ok(activity.includes(kind), kind);
  const status = await h.server.toolkit.call('deal_desk_proposal_status', {proposalId: pending[0].id}, {sessionId: 's'});
  assert.equal(status.state, 'executed');
});

test('the agent steers a connected page through the UI bridge', async t => {
  const commands = [];
  const h = await setup(t, {script: async ({call}) => {const r = await call('deal_desk_ui_open', {kind: 'deal', id: 'd1', field: 'stage'}); return JSON.stringify(r);}});
  const controller = new AbortController(); t.after(() => controller.abort());
  const stream = await fetch(h.origin + '/api/augmentor/ui/stream?page=page-12345678', {headers: {Cookie: 'owner=1'}, signal: controller.signal});
  assert.equal(stream.status, 200);
  (async () => {const reader = stream.body.getReader(); let buffer = ''; try {for (;;) {const {value, done} = await reader.read(); if (done) return; buffer += new TextDecoder().decode(value);
    let i; while ((i = buffer.indexOf('\n\n')) >= 0) {const block = buffer.slice(0, i); buffer = buffer.slice(i + 2); if (/^event: command/m.test(block)) {const cmd = JSON.parse(/^data: (.+)$/m.exec(block)[1]); commands.push(cmd); await h.owner('/api/augmentor/ui/result', {method: 'POST', body: JSON.stringify({id: cmd.id, ok: true, result: {opened: cmd.args.id}})});}}}} catch {}})();
  await new Promise(r => setTimeout(r, 50));
  const runner = h.server.runner;
  const result = await runner.run({text: 'Open the deal'});
  assert.equal(result.status, 'completed'); assert.equal(JSON.parse(result.text).opened, 'd1');
  assert.deepEqual(commands.map(c => [c.action, c.args.field]), [['open', 'stage']]);
});

test('automation triggers, MCP access and the security boundaries', async t => {
  const h = await setup(t, {script: async ({call}) => {await call('deal_desk_list_deals', {}); return 'Triaged';}});
  h.server.start();
  const finished = h.server.events.next('job.finished', {timeoutMs: 4000});
  h.server.events.publish('mail.received', {mailId: 'm-1'});
  assert.equal((await finished).data.status, 'completed');
  assert.equal(h.server.jobs.find('mail:m-1').state, 'completed');
  assert.equal((await (await h.owner('/api/augmentor/automation')).json()).rules[0].name, 'triage');
  const mcp = body => fetch(h.origin + '/api/augmentor/mcp', {method: 'POST', headers: {'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Authorization: 'Bearer ' + 'synthetic-mcp-token-'.repeat(3)}, body: JSON.stringify({jsonrpc: '2.0', ...body})}).then(r => r.json());
  assert.equal((await mcp({id: 1, method: 'initialize', params: {protocolVersion: '2025-06-18', capabilities: {}, clientInfo: {name: 'test', version: '1'}}})).result.protocolVersion, '2025-06-18');
  const listed = (await mcp({id: 2, method: 'tools/list'})).result.tools;
  assert.equal(listed.find(x => x.name === 'deal_desk_send_reply').annotations.openWorldHint, true);
  const call = (await mcp({id: 3, method: 'tools/call', params: {name: 'deal_desk_list_deals', arguments: {}}})).result;
  assert.equal(call.isError, false); assert.equal(call.structuredContent.deals[0].id, 'd1');
  assert.equal((await mcp({id: 4, method: 'tools/call', params: {name: 'deal_desk_update_deal', arguments: {id: 'd1'}}})).result.isError, true);
  assert.equal((await mcp({id: 5, method: 'resources/read', params: {uri: 'app://deal/d1'}})).result.contents[0].mimeType, 'application/json');
  assert.match((await mcp({id: 6, method: 'prompts/get', params: {name: 'triage_mail', arguments: {mailId: 'm-2'}}})).result.messages[0].content.text, /m-2/);
  // Boundaries: runtime token, owner session, same origin, browsers kept off agent routes.
  assert.equal((await fetch(h.origin + '/api/augmentor/tool', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}'})).status, 401);
  assert.equal((await fetch(h.origin + '/api/augmentor/review')).status, 403);
  assert.equal((await fetch(h.origin + '/api/augmentor/prompts', {headers: {Cookie: 'owner=1', Origin: 'https://evil.invalid'}})).status, 403);
  assert.equal((await fetch(h.origin + '/api/augmentor/mcp', {method: 'POST', headers: {'Content-Type': 'application/json', Origin: h.origin, Authorization: 'Bearer ' + 'synthetic-mcp-token-'.repeat(3)}, body: '{}'})).status, 403);
  const viaFetch = await h.server.fetch(new Request(h.origin + '/api/augmentor/prompts', {headers: {Cookie: 'owner=1', Host: new URL(h.origin).host}}));
  assert.equal((await viaFetch.json()).items.length, 2);
  assert.equal(await h.server.fetch(new Request(h.origin + '/not-ours')), null);
});
