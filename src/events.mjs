// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
// In-process event hub: one place where tool writes, jobs, approvals and app domain
// events are published. Pages subscribe over Server-Sent Events instead of polling;
// triggers subscribe to start agent work. Events are notifications, never commands.
import {randomUUID} from 'node:crypto';
import {check} from './errors.mjs';
import {fromNode, fromFetch} from './http.mjs';

export const EVENT_TYPE = /^[a-z][a-z0-9_.-]{0,95}$/;
const MAX_EVENT_BYTES = 64 * 1024;

/** Match `deal.updated`, `deal.*`, `*` (all) or `**` style prefixes. */
export function matchesType(pattern, type) {
  if (pattern === '*' || pattern === type) return true;
  if (pattern.endsWith('.*')) return type.startsWith(pattern.slice(0, -1));
  return false;
}

export class EventHub {
  constructor({history = 200, now = () => new Date()} = {}) {
    this.listeners = new Set(); this.history = []; this.limit = history; this.now = now; this.sequence = 0;
  }
  /** Publish an event. `data` must be JSON and small; put large payloads behind a record ID. */
  publish(type, data = {}, {source = 'app', subject, actor} = {}) {
    check(EVENT_TYPE.test(type), 'INVALID_EVENT', 'Event types use lower-case dotted names');
    const event = {id: randomUUID(), seq: ++this.sequence, type, time: this.now().toISOString(), source,
      ...(subject ? {subject: String(subject).slice(0, 200)} : {}), ...(actor ? {actor} : {}), data};
    const size = Buffer.byteLength(JSON.stringify(event));
    check(size <= MAX_EVENT_BYTES, 'INVALID_EVENT', 'Event payload exceeds 64 KiB; reference the record instead');
    this.history.push(event); if (this.history.length > this.limit) this.history.shift();
    for (const listener of [...this.listeners]) {
      if (!listener.types.some(p => matchesType(p, type))) continue;
      try {const r = listener.fn(event); if (r && typeof r.catch === 'function') r.catch(listener.onError);} catch (error) {listener.onError(error);}
    }
    return event;
  }
  /** Subscribe to one or more type patterns. Returns an unsubscribe function. */
  subscribe(types, fn, {onError = () => {}} = {}) {
    const list = Array.isArray(types) ? types : [types];
    check(list.length && list.every(t => t === '*' || EVENT_TYPE.test(t.replace(/\.\*$/, ''))), 'INVALID_EVENT', 'Invalid event pattern');
    check(typeof fn === 'function', 'INVALID_EVENT', 'A listener function is required');
    const listener = {types: list, fn, onError}; this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  /** Events after a sequence number (for reconnecting clients). */
  since(seq = 0, types = ['*']) {return this.history.filter(e => e.seq > seq && types.some(p => matchesType(p, e.type)));}
  /** Resolve with the next matching event, or reject on timeout/abort. */
  next(types, {timeoutMs = 30000, signal, filter = () => true} = {}) {
    return new Promise((resolve, reject) => {
      let stop;
      const timer = setTimeout(() => {stop(); reject(Object.assign(new Error('Timed out waiting for event'), {code: 'TIMEOUT'}));}, timeoutMs);
      const abort = () => {clearTimeout(timer); stop(); reject(signal.reason);};
      stop = this.subscribe(types, event => {if (!filter(event)) return; clearTimeout(timer); stop(); signal?.removeEventListener('abort', abort); resolve(event);});
      signal?.addEventListener('abort', abort, {once: true});
    });
  }
}

/**
 * Server-Sent Events endpoint for the app's own pages. The caller authorises the owner
 * and chooses which event types a page may see (`filter`). Node `(req,res)` handler.
 */
export function createEventStream(hub, {authorize, types = ['*'], filter = () => true, heartbeatMs = 25000, project = e => e} = {}) {
  check(hub instanceof EventHub, 'INVALID_REQUEST', 'An EventHub is required');
  check(typeof authorize === 'function', 'INVALID_REQUEST', 'An owner authorisation callback is required');
  const open = (write, close, lastId) => {
    const deliver = event => {if (filter(event)) write(`id: ${event.seq}\nevent: ${event.type}\ndata: ${JSON.stringify(project(event))}\n\n`);};
    const replay = Number.parseInt(lastId || '0', 10);
    if (replay > 0) for (const event of hub.since(replay, types)) deliver(event);
    const unsubscribe = hub.subscribe(types, deliver);
    const beat = setInterval(() => write(': keep-alive\n\n'), heartbeatMs); beat.unref?.();
    return () => {clearInterval(beat); unsubscribe(); close();};
  };
  return {
    async node(req, res) {
      let ok = false; try {ok = !!(await authorize(fromNode(req)));} catch {}
      if (!ok) {res.writeHead(403, {'Cache-Control': 'no-store'}); res.end(); return;}
      res.writeHead(200, {'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no'});
      res.write('retry: 3000\n\n');
      const stop = open(text => res.write(text), () => res.end(), req.headers['last-event-id']);
      req.on('close', stop);
    },
    async fetch(request) {
      let ok = false; try {ok = !!(await authorize(fromFetch(request)));} catch {}
      if (!ok) return new Response(null, {status: 403, headers: {'Cache-Control': 'no-store'}});
      const encoder = new TextEncoder(); let stop;
      const body = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('retry: 3000\n\n'));
          stop = open(text => {try {controller.enqueue(encoder.encode(text));} catch {}}, () => {try {controller.close();} catch {}}, request.headers.get('last-event-id'));
          request.signal?.addEventListener('abort', () => stop());
        },
        cancel() {stop?.();},
      });
      return new Response(body, {headers: {'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no'}});
    },
  };
}
