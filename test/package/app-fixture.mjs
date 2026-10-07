// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
// Copied into a temporary consumer by consumer.test.mjs after `init --template app`.
// Synthetic records and a mock runtime: this proves the generated wiring, not real DSH.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createAgentServer} from './augmentor/server.mjs';
import {applicationTools} from './augmentor/tools.mjs';
import {AgentRunner} from '@augmentor/app-sdk';
import {createMockRuntime} from '@augmentor/app-sdk/testing';

test('generated app kit runs agent work through the installed package', {timeout: 30000}, async t => {
  const runtimeTokenFile = resolve('runtime.token'); writeFileSync(runtimeTokenFile, 'synthetic-runtime-'.repeat(4), {mode: 0o600});
  const db = new Map([['42', {id: '42', version: 1, title: 'Synthetic record', status: 'open'}]]), shared = [];
  const records = {
    read: id => db.get(id) ?? null,
    update: ({id, expectedVersion, ...change}) => {const r = db.get(id); if (r.version !== expectedVersion) throw Object.assign(Error('conflict'), {code: 'VERSION_CONFLICT'}); Object.assign(r, change, {version: r.version + 1}); return r;},
    share: args => {shared.push(args); return {shared: true};},
  };
  let agent;
  const server = http.createServer(async (req, res) => {if (!(await agent.node(req, res))) {res.writeHead(404); res.end();}});
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const origin = 'http://127.0.0.1:' + server.address().port;
  agent = createAgentServer({origin, authorizeOwner: r => r.headers.cookie === 'owner=1' && 'owner', records, runtimeTokenFile});
  const tools = applicationTools({url: origin + '/api/augmentor/tool', tokenFile: runtimeTokenFile});
  const runtime = createMockRuntime({profile: 'fixture-records', tools: (name, args, ctx) => tools.execute(name, args, ctx), script: async ({call}) => {
    const r = await call('fixture_records_read_record', {id: '42'});
    await call('fixture_records_update_record', {id: '42', expectedVersion: r.version, status: 'done'});
    const share = await call('fixture_records_share_record', {id: '42', to: 'partner@example.invalid', message: 'Done'});
    return share.status;
  }});
  const client = runtime.client();
  t.after(async () => {client.close(); runtime.close(); agent.close(); server.closeAllConnections(); await new Promise(r => server.close(r));});
  const result = await new AgentRunner({client, pollMs: 50}).run({text: 'Finish record 42'});
  assert.equal(result.status, 'completed'); assert.equal(result.text, 'approval_required');
  assert.equal(db.get('42').status, 'done'); assert.equal(shared.length, 0);
  const owner = {Cookie: 'owner=1'};
  const pending = (await (await fetch(origin + '/api/augmentor/review', {headers: owner})).json()).items;
  assert.equal(pending[0].summary, 'Share record 42 with partner@example.invalid');
  const decided = await fetch(`${origin}/api/augmentor/review/${pending[0].id}/decision`, {method: 'POST', headers: {...owner, Origin: origin, 'Content-Type': 'application/json'}, body: JSON.stringify({decision: 'approve'})});
  assert.equal((await decided.json()).state, 'executed'); assert.equal(shared.length, 1);
  assert.equal((await fetch(origin + '/api/augmentor/prompts', {headers: owner}).then(r => r.json())).items.length, 2);
  const bundle = await import('@augmentor/app-sdk/browser.bundle');
  assert.equal(typeof bundle.mountAugmentor, 'function'); assert.equal(typeof bundle.connectPage, 'function');
});
