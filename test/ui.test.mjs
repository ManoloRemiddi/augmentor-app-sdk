// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
// Loopback server and a simulated page; synthetic data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {createUiBridge, defineUiAction} from '../src/ui.mjs';
import {createToolkit} from '../src/toolkit.mjs';
import {toDshParameters} from '../src/dsh-schema.mjs';
import {EventHub, createEventStream} from '../src/events.mjs';

async function serve(t, handler) {
  const server = http.createServer(handler); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const sockets = new Set(); server.on('connection', s => {sockets.add(s); s.on('close', () => sockets.delete(s));});
  t.after(() => {for (const s of sockets) s.destroy(); return new Promise(r => server.close(r));});
  return 'http://127.0.0.1:' + server.address().port;
}

/** Minimal SSE reader over fetch, standing in for the browser's EventSource. */
async function openPage(origin, path, {page, cookie = 'owner=1', onCommand}) {
  const controller = new AbortController();
  const response = await fetch(`${origin}${path}/stream?page=${page}`, {headers: {Cookie: cookie}, signal: controller.signal});
  const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = '';
  const post = (route, body) => fetch(origin + path + route, {method: 'POST', headers: {'Content-Type': 'application/json', Cookie: cookie, Origin: origin}, body: JSON.stringify(body)});
  (async () => {
    try {
      for (;;) {
        const {done, value} = await reader.read(); if (done) return; buffer += decoder.decode(value, {stream: true});
        let index; while ((index = buffer.indexOf('\n\n')) >= 0) {
          const block = buffer.slice(0, index); buffer = buffer.slice(index + 2);
          const event = /^event: (.+)$/m.exec(block)?.[1], data = /^data: (.+)$/m.exec(block)?.[1];
          if (event === 'command') {const cmd = JSON.parse(data); const out = await onCommand(cmd); await post('/result', {id: cmd.id, ...out});}
        }
      }
    } catch {}
  })();
  return {status: response.status, post, close: () => controller.abort()};
}

test('agent UI commands reach the focused page and return its result', async t => {
  let bridge;
  const origin = await serve(t, (req, res) => bridge.node(req, res));
  bridge = createUiBridge({origin, authorize: r => r.headers.cookie === 'owner=1', actions: [defineUiAction({name: 'play_at', description: 'Play the recording at a timestamp', input: {type: 'object', properties: {seconds: {type: 'number'}}, required: ['seconds']}})]});
  const seen = [];
  const a = await openPage(origin, '/api/augmentor/ui', {page: 'page-aaaaaaaa', onCommand: c => {seen.push(['a', c.action]); return {ok: true, result: {shown: c.action}};}});
  const b = await openPage(origin, '/api/augmentor/ui', {page: 'page-bbbbbbbb', onCommand: c => {seen.push(['b', c.action]); return c.action === 'fill' ? {ok: false, code: 'UNKNOWN_FORM', error: 'No such form'} : {ok: true, result: {done: true}}; }});
  t.after(() => {a.close(); b.close();});
  assert.equal(a.status, 200);
  await new Promise(r => setTimeout(r, 50));
  await a.post('/presence', {page: 'page-aaaaaaaa', focused: false});
  await b.post('/presence', {page: 'page-bbbbbbbb', focused: true, view: {route: '/deals/42', selection: ['deal:42']}});
  assert.deepEqual(await bridge.command('navigate', {route: '/deals'}), {done: true});
  assert.deepEqual(seen, [['b', 'navigate']]);
  assert.deepEqual((await bridge.command('view')).view, {route: '/deals/42', selection: ['deal:42']}, 'recent view answered from presence');
  await assert.rejects(bridge.command('fill', {form: 'quote', values: {}}), e => e.code === 'UNKNOWN_FORM');
  await assert.rejects(bridge.command('navigate', {}), e => e.code === 'INVALID_ARGUMENTS');
  await assert.rejects(bridge.command('teleport', {}), e => e.code === 'UNSUPPORTED_ACTION');
  assert.deepEqual(await bridge.command('play_at', {seconds: 12}, {pageId: 'page-aaaaaaaa'}), {shown: 'play_at'});
  await assert.rejects(bridge.command('notify', {message: 'x'}, {principal: 'someone-else'}), e => e.code === 'UI_UNAVAILABLE');
  const intruder = await openPage(origin, '/api/augmentor/ui', {page: 'page-cccccccc', cookie: 'nope', onCommand: () => ({ok: true})});
  assert.equal(intruder.status, 403);
  const forged = await fetch(origin + '/api/augmentor/ui/result', {method: 'POST', headers: {'Content-Type': 'application/json', Cookie: 'owner=1', Origin: 'https://evil.invalid'}, body: '{}'});
  assert.equal(forged.status, 403);
});

test('commands time out and closed pages fail pending work', async t => {
  let bridge;
  const origin = await serve(t, (req, res) => bridge.node(req, res));
  bridge = createUiBridge({origin, authorize: () => true, timeoutMs: 100});
  const page = await openPage(origin, '/api/augmentor/ui', {page: 'page-dddddddd', onCommand: () => new Promise(() => {})});
  await new Promise(r => setTimeout(r, 30));
  await assert.rejects(bridge.command('notify', {message: 'Hello'}), e => e.code === 'UI_TIMEOUT');
  const pending = bridge.command('highlight', {target: 'deal:1'}, {timeout: 5000});
  await new Promise(r => setTimeout(r, 30)); page.close();
  await assert.rejects(pending, e => e.code === 'UI_UNAVAILABLE');
});

test('UI tools are prefixed, validated and compile for DSH', async () => {
  const bridge = createUiBridge({origin: 'http://127.0.0.1:1', authorize: () => true});
  const tools = bridge.tools({prefix: 'demo'});
  assert.ok(tools.some(t => t.name === 'demo_ui_navigate'));
  const toolkit = createToolkit({tools});
  for (const tool of toolkit.list()) toDshParameters(tool.inputSchema);
  const show = toolkit.list().find(t => t.name === 'demo_ui_show');
  assert.equal(show.effect, 'read');
  await assert.rejects(toolkit.call('demo_ui_show', {spec: {type: 'card'}}, {sessionId: 's'}), e => e.code === 'INVALID_ARGUMENTS', 'cards need a title');
  await assert.rejects(toolkit.call('demo_ui_show', {spec: {type: 'card', title: 'x', html: '<b>'}}, {sessionId: 's'}), e => e.code === 'INVALID_ARGUMENTS', 'no HTML');
  await assert.rejects(toolkit.call('demo_ui_show', {spec: {type: 'card', title: 'Deal'}}, {sessionId: 's'}), e => e.code === 'UI_UNAVAILABLE');
});

test('event stream delivers owner-visible change events with replay', async t => {
  const hub = new EventHub();
  const stream = createEventStream(hub, {authorize: r => r.headers.cookie === 'owner=1', types: ['tool.*', 'proposal.*']});
  const origin = await serve(t, (req, res) => stream.node(req, res));
  const controller = new AbortController(); t.after(() => controller.abort());
  hub.publish('tool.completed', {tool: 'a'});
  const response = await fetch(origin, {headers: {Cookie: 'owner=1', 'Last-Event-ID': '0'}, signal: controller.signal});
  assert.equal((await fetch(origin)).status, 403);
  hub.publish('mail.received', {}); hub.publish('proposal.created', {id: 'p'});
  const reader = response.body.getReader(); let text = '';
  while (!text.includes('proposal.created')) text += new TextDecoder().decode((await reader.read()).value);
  assert.doesNotMatch(text, /mail.received/);
  assert.match(text, /event: proposal.created/);
});
