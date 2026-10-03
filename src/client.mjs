// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
import {spawn} from 'node:child_process';
import {EventEmitter} from 'node:events';
import {randomUUID} from 'node:crypto';
import {discoverRuntime,runtimeLaunch} from './runtime.mjs';
import {requireCapabilities} from './capabilities.mjs';
import {AugmentorError, check, SDK_PROTOCOL, isId} from './errors.mjs';
const READS = new Set(['workspace.describe','initialize','augmentor/handshake','session.list','session.history','session.models','augmentor/models']);
export class AugmentorClient extends EventEmitter {
  constructor({profile, descriptor,runtimeRoot,harness='dsh', requiredCapabilities = [], timeoutMs = 40000, start = spawn} = {}) {
    super(); check(/^[a-z][a-z0-9-]{0,63}$/.test(profile), 'INVALID_PROFILE', 'A registered profile ID is required');
    check(Array.isArray(requiredCapabilities) && requiredCapabilities.every(name => typeof name === 'string'), 'INVALID_REQUEST', 'Required capabilities must be an array of names');
    this.profile = profile; this.descriptor = descriptor; this.runtimeRoot=runtimeRoot;this.timeoutMs = timeoutMs; this.start = start;
    this.requiredCapabilities = [...requiredCapabilities];
    check(['dsh','codex'].includes(harness),'INVALID_REQUEST','Choose DSH or Codex');this.harness=harness;
    this.pending = new Map(); this.child = null; this.connecting = null; this.closed = false;
  }
  async connect() {
    check(!this.closed, 'CLIENT_CLOSED', 'Create a new client after close');
    if (this.connecting) return this.connecting;
    if (this.ready && this.child) {requireCapabilities(this.capabilities,this.requiredCapabilities);return this;}
    this.connecting = this.open().finally(() => {this.connecting = null;});
    return this.connecting;
  }
  async open() {
    const runtime = await discoverRuntime({descriptor: this.descriptor,runtimeRoot:this.runtimeRoot,harness:this.harness});
    check(!this.closed, 'CLIENT_CLOSED', 'Client closed during discovery');
    const launch=runtimeLaunch(runtime,'native');
    const child = this.start(launch.command,launch.args,{stdio: ['pipe','pipe','ignore'],windowsHide:true,
      env: {...launch.env, AUGMENTOR_WORKSPACE_PROFILE: this.profile}});
    this.child = child; let buffer = Buffer.alloc(0), ended = false;
    const fail = () => {
      if (ended) return; ended = true;
      if (this.child !== child) return;
      this.child = null; this.ready = false;
      for (const [id, p] of this.pending) {clearTimeout(p.timer); p.reject(this.failure(p.method, p.operationId, id));}
      this.pending.clear(); this.emit('disconnected');
    };
    child.on('error', fail); child.on('exit', fail); child.stdin.on('error', fail); child.stdout.on('error', fail); child.stdout.on('end', fail);
    child.stdout.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length >= 4) {
        const size = buffer.readUInt32LE(0);
        if (!size || size > 20 * 1024 * 1024) {fail(); child.kill(); return;}
        if (buffer.length < size + 4) return;
        let message; try {message = JSON.parse(buffer.subarray(4, size + 4));} catch {fail(); child.kill(); return;}
        buffer = buffer.subarray(size + 4);
        const p = this.pending.get(message.id);
        if (p) {
          this.pending.delete(message.id); clearTimeout(p.timer);
          message.error ? p.reject(new AugmentorError(message.error.code || (READS.has(p.method) ? 'REMOTE_ERROR' : 'UNKNOWN_OUTCOME'), message.error.message, {operationId: p.operationId})) : p.resolve(message.result);
        } else if (message.method) this.emit('event', message);
      }
    });
    try {
      const description = await this.call('workspace.describe', {protocol: SDK_PROTOCOL});
      check(description.protocol === SDK_PROTOCOL && description.profile === this.profile && description.harness === this.harness, 'INCOMPATIBLE_RUNTIME', 'Workspace negotiation failed');
      this.capabilities = description;
      requireCapabilities(description, this.requiredCapabilities);
      await this.call('augmentor/handshake', {protocol: description.productProtocol, version: description.productVersion});
      await this.call('harness.select', {harness: this.harness});
      await this.call('initialize'); this.ready = true;
      return this;
    } catch (error) {fail(); child.kill(); throw error;}
  }
  failure(method, operationId, requestId) {
    return new AugmentorError(READS.has(method) ? 'DISCONNECTED' : 'UNKNOWN_OUTCOME', 'Augmentor response was not confirmed; no request was replayed', {method, operationId, requestId});
  }
  call(method, params = {}) {
    if (!this.child?.stdin.writable) return Promise.reject(new AugmentorError('NOT_CONNECTED', 'Connect to Augmentor before making a request'));
    const child = this.child, id = randomUUID(), operationId = params.requestId;
    const body = Buffer.from(JSON.stringify({id, method, params}));
    check(body.length <= 1024 * 1024, 'REQUEST_TOO_LARGE', 'Native request exceeds 1 MiB');
    check(this.pending.size < 64 && child.stdin.writableLength < 2 * 1024 * 1024, 'BACKPRESSURE', 'Too many pending Augmentor requests');
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {this.pending.delete(id); reject(this.failure(method, operationId, id));}, this.timeoutMs);
      this.pending.set(id, {resolve, reject, timer, method, operationId});
      const header = Buffer.alloc(4); header.writeUInt32LE(body.length);
      child.stdin.write(Buffer.concat([header, body]));
    });
  }
  createSession(sessionId = randomUUID()) {check(isId(sessionId), 'INVALID_ID', 'Invalid session ID'); return this.call('session.create', {sessionId});}
  async refreshCapabilities() {
    check(this.ready, 'NOT_CONNECTED', 'Connect before refreshing workspace capabilities');
    const description = await this.call('workspace.describe', {protocol: SDK_PROTOCOL});
    check(description.protocol === SDK_PROTOCOL && description.profile === this.profile && description.harness === this.harness, 'INCOMPATIBLE_RUNTIME', 'Workspace negotiation changed');
    this.capabilities = description;
    return requireCapabilities(description, this.requiredCapabilities);
  }
  listSessions() {return this.call('session.list');}
  prompt({sessionId, operationId, text, context}) {
    check(isId(sessionId) && isId(operationId) && typeof text === 'string' && text.trim(), 'INVALID_REQUEST', 'Session, stable operation ID and non-empty text are required');
    return this.call('session.prompt', {sessionId, requestId: operationId, mode: 'queue', content: [{type:'text', text}], ...(context ? {workspaceContext: context} : {})});
  }
  cancel(sessionId) {check(isId(sessionId), 'INVALID_ID', 'Invalid session ID'); return this.call('session.cancel', {sessionId});}
  close() {
    this.closed = true; this.ready = false; const child = this.child; this.child = null;
    for (const [id, p] of this.pending) {clearTimeout(p.timer); p.reject(this.failure(p.method, p.operationId, id));}
    this.pending.clear(); child?.stdin.end(); child?.kill();
  }
}
