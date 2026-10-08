// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
// Test kit: a mock Augmentor runtime that speaks the native frame protocol, with a
// scripted model that calls the application's tools. Synthetic fixtures only; this is
// not evidence that a real runtime or model behaves the same way.
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID, createHash} from 'node:crypto';
import {AugmentorClient} from './client.mjs';
import {SDK_PROTOCOL, canonicalJSON} from './errors.mjs';

/**
 * A scripted model: each prompt runs `script({text, context, sessionId, call, ask, say})`.
 * `call(name, args)` executes an application tool and records tool events; `ask(question)`
 * raises a question interaction and resolves with the answer; the returned string (or the
 * last `say`) becomes the assistant message.
 */
export function createMockRuntime({profile = 'fixture', harness = 'dsh', script = async () => 'Done.', tools, features = {}, models = {default: {provider: 'mock', model: 'scripted'}}} = {}) {
  const root = mkdtempSync(join(tmpdir(), 'augmentor-mock-runtime-'));
  mkdirSync(join(root, 'services/workspaces'), {recursive: true});
  writeFileSync(join(root, 'services/workspaces/sdk.json'), JSON.stringify({protocol: SDK_PROTOCOL, harnesses: [harness],
    ...(process.platform === 'linux' ? {} : {platforms: {[process.platform]: [harness]}})}));
  if (process.platform !== 'linux') {mkdirSync(join(root, 'scripts')); writeFileSync(join(root, 'scripts/app-sdk-launch.py'), '# mock adapter; never executed by the mock transport\n');}
  const descriptor = join(root, 'desktop.json');
  writeFileSync(descriptor, JSON.stringify({root, node: process.execPath, python: process.execPath}));
  const sessions = new Map(), hosts = new Set(), pendingInteractions = new Map();
  const runtime = new EventEmitter();
  const execute = async (name, args, {sessionId, callId}) => {
    if (!tools) throw new Error('The mock runtime has no application tools');
    const operationId = createHash('sha256').update(canonicalJSON([sessionId, callId, name])).digest('hex');
    // A plain function is an executor; anything else must be a toolkit (functions also have .call).
    if (typeof tools === 'function') return tools(name, args, {sessionId, callId, operationId});
    return tools.call(name, args, {sessionId, callId, operationId, principal: {id: 'owner', kind: 'owner'}});
  };

  function host() {
    const child = new EventEmitter(); child.stdin = new PassThrough(); child.stdout = new PassThrough();
    child.kill = () => {if (!child.killed) {child.killed = true; hosts.delete(child); child.emit('exit', 0);}};
    hosts.add(child);
    let buffer = Buffer.alloc(0);
    const send = message => {const body = Buffer.from(JSON.stringify(message)), header = Buffer.alloc(4); header.writeUInt32LE(body.length); if (!child.killed) child.stdout.write(Buffer.concat([header, body]));};
    const notify = (method, params) => send({method, params});
    const emitEvent = (sessionId, type, data = {}) => {
      const session = sessions.get(sessionId); const event = {type, data, seq: ++session.seq};
      session.events.push(event); notify('session.event', {sessionId, event}); runtime.emit('event', {sessionId, event});
    };
    const runTurn = async (session, params) => {
      const text = params.content?.find(p => p.type === 'text')?.text ?? '';
      session.running = true; notify('session.status', {sessionId: session.id, status: 'running'});
      emitEvent(session.id, 'user/message', {source: {kind: 'user', rpcId: params.requestId}, content: params.content});
      emitEvent(session.id, 'turn/start', {});
      let said = '', reason = 'completed';
      const say = value => {said = String(value);};
      const call = async (name, args = {}) => {
        const callId = randomUUID();
        emitEvent(session.id, 'tool/call', {name, toolCallId: callId, args});
        try {const result = await execute(name, args, {sessionId: session.id, callId}); emitEvent(session.id, 'tool/result', {name, toolCallId: callId, isError: false, result}); return result;}
        catch (error) {emitEvent(session.id, 'tool/result', {name, toolCallId: callId, isError: true, result: {code: error.code, message: error.message}}); return {error: {code: error.code, message: error.message}};}
      };
      const interaction = (kind, payload) => new Promise(resolve => {
        const id = randomUUID(); pendingInteractions.set(id, {resolve, sessionId: session.id});
        send({id, method: kind + '.requested', params: {...payload, sessionId: session.id, approvalId: id}});
      });
      const ask = questions => interaction('question', {questions: Array.isArray(questions) ? questions : [{id: 'q1', question: String(questions)}]});
      const approve = (toolName, args) => interaction('approval', {toolName, args});
      try {
        const out = await script({text, context: session.contexts.at(-1) ?? params.workspaceContext ?? null, sessionId: session.id, call, ask, approve, say, signal: session.abort.signal});
        if (typeof out === 'string') said = out;
      } catch (error) {reason = session.abort.signal.aborted ? 'aborted' : 'error'; if (reason === 'error') emitEvent(session.id, 'error', {message: error.message});}
      if (session.abort.signal.aborted) reason = 'aborted';
      if (said) emitEvent(session.id, 'assistant/message', {message: {content: [{type: 'text', text: said}], stopReason: 'stop'}});
      emitEvent(session.id, 'turn/end', {reason: {kind: reason}});
      session.running = false; session.abort = new AbortController(); notify('session.status', {sessionId: session.id, status: 'idle'});
      runtime.emit('turn', {sessionId: session.id, reason, text: said});
    };
    const methods = {
      'workspace.describe': () => ({protocol: SDK_PROTOCOL, profile, harness, productProtocol: 'mock/1', productVersion: '0.0.0-mock', features}),
      'augmentor/handshake': () => ({ok: true}), 'harness.select': () => ({harness}), initialize: () => ({}),
      'session.create': ({sessionId}) => {if (!sessions.has(sessionId)) sessions.set(sessionId, {id: sessionId, title: '', model: models.default, events: [], seq: 0, running: false, requests: new Set(), contexts: [], abort: new AbortController()}); return {sessionId};},
      'session.list': () => ({items: [...sessions.values()].map(s => ({sessionId: s.id, title: s.title, running: s.running, agentPreset: 'augmentor-' + profile}))}),
      'session.rename': ({sessionId, title}) => {sessions.get(sessionId).title = title; return {};},
      'session.models': ({sessionId}) => ({...models, current: sessions.get(sessionId).model}),
      'session.selectModel': ({sessionId, ...selection}) => {sessions.get(sessionId).model = selection; return {};},
      'session.history': ({sessionId, maxMessages = 50}) => {const s = sessions.get(sessionId); if (!s) throw Object.assign(new Error('Unknown session'), {code: 'NOT_FOUND'}); return {sessionId, header: {title: s.title}, events: s.events.slice(-maxMessages), hasMore: s.events.length > maxMessages, running: s.running};},
      'session.cancel': ({sessionId}) => {sessions.get(sessionId)?.abort.abort(); return {};},
      'session.prompt': params => {
        const session = sessions.get(params.sessionId); if (!session) throw Object.assign(new Error('Unknown session'), {code: 'NOT_FOUND'});
        if (session.requests.has(params.requestId)) return {accepted: true, duplicate: true};
        session.requests.add(params.requestId); if (params.workspaceContext) session.contexts.push(params.workspaceContext);
        queueMicrotask(() => void runTurn(session, params)); return {accepted: true};
      },
      'augmentor/interaction': ({id, value}) => {const p = pendingInteractions.get(id); if (!p) throw new Error('This interaction is no longer pending'); pendingInteractions.delete(id); p.resolve(value); notify('interaction.resolved', {rpcId: id, sessionId: p.sessionId}); return {};},
    };
    child.stdin.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length >= 4 && buffer.length >= buffer.readUInt32LE(0) + 4) {
        const size = buffer.readUInt32LE(0), message = JSON.parse(buffer.subarray(4, size + 4)); buffer = buffer.subarray(size + 4);
        runtime.emit('call', message);
        Promise.resolve().then(() => {
          const fn = methods[message.method]; if (!fn) throw Object.assign(new Error('Unsupported method ' + message.method), {code: 'UNSUPPORTED'});
          return fn(message.params || {});
        }).then(result => send({id: message.id, result: result ?? {}}), error => send({id: message.id, error: {code: error.code || 'REMOTE_ERROR', message: error.message}}));
      }
    });
    return child;
  }

  Object.assign(runtime, {
    root, descriptor, sessions,
    /** AugmentorClient wired to this mock runtime. */
    client(options = {}) {return new AugmentorClient({profile, harness, descriptor, start: () => host(), ...options});},
    start: () => host(),
    /** Number of live hosts (each AugmentorClient connection opens one). */
    get connections() {return hosts.size;},
    close() {for (const h of [...hosts]) h.kill(); rmSync(root, {recursive: true, force: true});},
  });
  return runtime;
}

/** Turn a list of steps into a script: {call: [name, args]}, {say: text}, {ask: question}. */
export function scriptedModel(steps) {
  return async ({call, ask, say}) => {
    let last = '';
    for (const step of typeof steps === 'function' ? await steps() : steps) {
      if (step.call) await call(...step.call);
      if (step.ask) await ask(step.ask);
      if (step.say !== undefined) {last = step.say; say(step.say);}
    }
    return last;
  };
}

/** Contract checks for a toolkit: every tool compiles, has an effect and a usable description. */
export function checkToolkit(toolkit) {
  const problems = [];
  for (const tool of toolkit.list({includeHidden: true})) {
    if (tool.description.length < 12) problems.push(`${tool.name}: description is too short for a model to use well`);
    if (!/^[a-z][a-z0-9_]*$/.test(tool.name)) problems.push(`${tool.name}: use lower_snake_case names prefixed by the app`);
    if (['external', 'destructive'].includes(tool.effect) && tool.approval === 'never') problems.push(`${tool.name}: ${tool.effect} effects should not run without approval`);
  }
  return problems;
}
