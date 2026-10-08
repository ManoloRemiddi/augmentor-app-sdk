// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
// Mock runtime and scripted model only: no installed Augmentor and no model requests.
import test from 'node:test';
import assert from 'node:assert/strict';
import {defineTool, createToolkit} from '../src/toolkit.mjs';
import {ProposalStore} from '../src/approvals.mjs';
import {EventHub} from '../src/events.mjs';
import {AgentRunner} from '../src/agent.mjs';
import {createMockRuntime, scriptedModel, checkToolkit} from '../src/testing.mjs';

const notes = [];
const toolkit = createToolkit({proposals: new ProposalStore(), tools: [
  defineTool({name: 'demo_list_notes', description: 'List the saved notes', effect: 'read', handler: () => ({notes: [...notes]})}),
  defineTool({name: 'demo_add_note', description: 'Add a note to the notebook', effect: 'write', input: {type: 'object', properties: {text: {type: 'string', minLength: 1}}, required: ['text']},
    handler: ({text}) => {notes.push(text); return {count: notes.length};}}),
  defineTool({name: 'demo_publish', description: 'Publish the notebook publicly', effect: 'external', handler: () => ({published: true})}),
]});

test('AgentRunner awaits the turn, collects tool calls and the final answer', async t => {
  const runtime = createMockRuntime({tools: toolkit, script: scriptedModel([{call: ['demo_add_note', {text: 'first'}]}, {call: ['demo_list_notes', {}]}, {say: 'Added one note.'}])});
  t.after(() => runtime.close());
  const client = runtime.client(); t.after(() => client.close());
  const events = new EventHub(), seen = []; events.subscribe('agent.run.*', e => seen.push(e.type));
  const runner = new AgentRunner({client, events, pollMs: 50});
  const result = await runner.run({text: 'Add a note', title: 'Synthetic run', context: {view: 'notes'}});
  assert.equal(result.status, 'completed'); assert.equal(result.text, 'Added one note.');
  assert.deepEqual(result.toolCalls.map(c => [c.name, c.ok]), [['demo_add_note', true], ['demo_list_notes', true]]);
  assert.deepEqual(notes, ['first']);
  assert.equal(runtime.sessions.get(result.sessionId).title, 'Synthetic run');
  assert.deepEqual(runtime.sessions.get(result.sessionId).contexts.at(-1), {view: 'notes'});
  assert.deepEqual(seen, ['agent.run.started', 'agent.run.finished']);
  const followUp = await runner.run({text: 'And again', sessionId: result.sessionId});
  assert.equal(followUp.sessionId, result.sessionId); assert.equal(followUp.status, 'completed');
});

test('approval-gated tools return a proposal to the model instead of acting', async t => {
  let receipt;
  const runtime = createMockRuntime({tools: toolkit, script: async ({call}) => {receipt = await call('demo_publish', {}); return 'Asked the owner.';}});
  t.after(() => runtime.close()); const client = runtime.client(); t.after(() => client.close());
  const result = await new AgentRunner({client, pollMs: 50}).run({text: 'Publish it'});
  assert.equal(result.status, 'completed'); assert.equal(receipt.status, 'approval_required'); assert.ok(receipt.proposalId);
});

test('interactions are settled by policy; default refuses approvals', async t => {
  const answers = [];
  const runtime = createMockRuntime({script: async ({ask, approve}) => {answers.push(await approve('shell', {cmd: 'ls'})); answers.push(await ask([{id: 'q', question: 'Which?'}])); return 'ok';}});
  t.after(() => runtime.close()); const client = runtime.client(); t.after(() => client.close());
  const result = await new AgentRunner({client, pollMs: 50}).run({text: 'Do it'});
  assert.equal(result.status, 'completed');
  assert.deepEqual(answers[0], {outcome: 'rejected'}); assert.match(answers[1].answer.answers[0].custom, /No one is available/);
  assert.deepEqual(result.interactions.map(i => i.kind), ['approval', 'question']);
  const custom = await new AgentRunner({client, pollMs: 50, interactions: i => i.kind === 'approval' ? {outcome: 'allowed-once'} : {answer: {answers: [{id: 'q', selected: ['A']}]}}}).run({text: 'Again'});
  assert.equal(custom.status, 'completed'); assert.deepEqual(answers[2], {outcome: 'allowed-once'});
});

test('timeouts cancel the session; prompts are idempotent per operation ID', async t => {
  const runtime = createMockRuntime({script: ({signal}) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))))});
  t.after(() => runtime.close()); const client = runtime.client(); t.after(() => client.close());
  const cancelled = []; runtime.on('call', m => {if (m.method === 'session.cancel') cancelled.push(m.params.sessionId);});
  const result = await new AgentRunner({client, pollMs: 50}).run({text: 'Wait forever', timeoutMs: 100});
  assert.equal(result.status, 'timeout'); assert.deepEqual(cancelled, [result.sessionId]);
  await client.prompt({sessionId: result.sessionId, operationId: 'same-op', text: 'once'});
  const dup = await client.prompt({sessionId: result.sessionId, operationId: 'same-op', text: 'once'});
  assert.equal(dup.duplicate, true);
});

test('history fallback completes a run when live events are not delivered', async t => {
  const runtime = createMockRuntime({script: scriptedModel([{say: 'Quiet answer'}])});
  t.after(() => runtime.close()); const client = runtime.client(); t.after(() => client.close());
  await client.connect();
  // Simulate the host no longer following the session: drop session.event notifications.
  const emit = client.emit.bind(client); client.emit = (name, ...args) => name === 'session.event' ? false : emit(name, ...args);
  const result = await new AgentRunner({client, pollMs: 30}).run({text: 'Answer quietly'});
  assert.equal(result.status, 'completed'); assert.equal(result.text, 'Quiet answer');
});

test('toolkit contract checks flag unsafe or unclear declarations', () => {
  assert.deepEqual(checkToolkit(toolkit), []);
  const risky = createToolkit({tools: [defineTool({name: 'demo_wipe', description: 'Delete everything now', effect: 'destructive', approval: 'never', handler: () => null})]});
  assert.deepEqual(checkToolkit(risky), ['demo_wipe: destructive effects should not run without approval']);
});
