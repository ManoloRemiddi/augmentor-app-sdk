// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
// Wake the agent: event triggers, cron schedules and watchers become durable jobs that run
// headless agent turns, are validated, recorded and published. Nothing is replayed blindly:
// an interrupted job waits for reconciliation (JobStore.retry with previousStopped).
import {check, isId} from './errors.mjs';
import {nextRun, previousRun, inQuietHours, parseCron} from './cron.mjs';

const NAME = /^[a-z][a-z0-9_.-]{0,63}$/;
const MAX_TIMER = 2 ** 31 - 1;

/**
 * @param runner    AgentRunner
 * @param jobs      JobStore (durable queue, deduplication by key)
 * @param events    EventHub (trigger source and job.* notifications)
 * @param prompts   optional prompt library for rules that name a prompt ID
 */
export function createAutomation({runner, jobs, events, prompts, activity, maxConcurrent = 1, leaseMs = 120000, now = () => new Date(), onError = () => {}} = {}) {
  check(runner && jobs && events, 'INVALID_REQUEST', 'runner, jobs and events are required');
  const rules = new Map(), schedules = new Map(), watchers = new Map(), batches = new Map(), deferred = new Map(), budgets = new Map();
  const timers = new Set(), inflight = new Set(); let started = false, paused = null, unsubscribe = [];
  const publish = (type, data, subject) => {try {events.publish(type, data, {source: 'automation', subject});} catch (e) {onError(e);}};
  const timer = (fn, ms) => {const t = setTimeout(() => {timers.delete(t); fn();}, Math.min(Math.max(0, ms), MAX_TIMER)); t.unref?.(); timers.add(t); return t;};

  function validateRule(name, rule) {
    check(NAME.test(name), 'INVALID_REQUEST', `Rule names use lower-case letters, digits, dots, dashes and underscores (${name})`);
    check(!rules.has(name), 'INVALID_REQUEST', `Duplicate automation rule ${name}`);
    check(typeof rule.prompt === 'string' || typeof rule.prompt === 'function', 'INVALID_REQUEST', `Rule ${name} needs a prompt ID or a prompt function`);
    if (typeof rule.prompt === 'string') check(prompts?.get(rule.prompt), 'INVALID_REQUEST', `Rule ${name} names unknown prompt ${rule.prompt}`);
    return {name, ...rule};
  }

  function overBudget(rule) {
    if (!rule.budget) return false;
    const list = (budgets.get(rule.name) || []).filter(t => t > now().getTime() - 86400000); budgets.set(rule.name, list);
    const hour = list.filter(t => t > now().getTime() - 3600000).length;
    return (rule.budget.perHour && hour >= rule.budget.perHour) || (rule.budget.perDay && list.length >= rule.budget.perDay);
  }

  function render(rule, event) {
    if (typeof rule.prompt === 'function') {
      const out = rule.prompt(event);
      check(out && typeof out.text === 'string' && out.text.trim(), 'INVALID_REQUEST', `Rule ${rule.name} prompt function must return {text}`);
      return out;
    }
    const vars = rule.vars ? rule.vars(event) : (event.data ?? {});
    return prompts.render(rule.prompt, vars, {extraContext: rule.context?.(event)});
  }

  /** Queue one firing as a durable job (deduplicated by key). */
  function fire(rule, event, key) {
    if (paused) {publish('automation.skipped', {rule: rule.name, reason: 'paused'}); return null;}
    if (overBudget(rule)) {publish('automation.skipped', {rule: rule.name, reason: 'budget'}); return null;}
    check(isId(key), 'INVALID_ID', `Job key for ${rule.name} must be a stable ID`);
    const existing = jobs.find(key); if (existing) return existing;
    const job = jobs.enqueue(key, {rule: rule.name, event: {id: event.id, type: event.type, subject: event.subject ?? null, data: event.data ?? null, time: event.time ?? now().toISOString()}});
    (budgets.get(rule.name) || budgets.set(rule.name, []).get(rule.name)).push(now().getTime());
    publish('job.queued', {job: job.id, rule: rule.name, key}, event.subject);
    queueMicrotask(pump);
    return job;
  }

  function accept(rule, event) {
    try {if (rule.filter && !rule.filter(event)) return;} catch (e) {onError(e); return;}
    if (rule.quiet && inQuietHours(now(), rule.quiet)) {
      const list = deferred.get(rule.name) || []; list.push(event); deferred.set(rule.name, list);
      publish('automation.deferred', {rule: rule.name, reason: 'quiet-hours'}); return;
    }
    if (rule.batch) {
      const pending = batches.get(rule.name);
      if (pending) {pending.events.push(event); if (pending.events.length >= (rule.batch.max || 50)) flushBatch(rule); return;}
      batches.set(rule.name, {events: [event], timer: timer(() => flushBatch(rule), rule.batch.windowMs || 60000)});
      return;
    }
    fire(rule, event, rule.key ? String(rule.key(event)) : `${rule.name}:${event.id}`);
  }

  function flushBatch(rule) {
    const pending = batches.get(rule.name); if (!pending) return; batches.delete(rule.name); clearTimeout(pending.timer); timers.delete(pending.timer);
    const first = pending.events[0];
    fire(rule, {id: first.id, type: 'batch', subject: first.subject, time: first.time, data: {count: pending.events.length, events: pending.events.map(e => ({id: e.id, type: e.type, subject: e.subject, data: e.data}))}}, `${rule.name}:batch:${first.id}`);
  }

  function flushDeferred() {
    for (const [name, list] of deferred) {
      const rule = rules.get(name); if (!rule || inQuietHours(now(), rule.quiet)) continue;
      deferred.delete(name);
      if (list.length === 1) fire(rule, list[0], rule.key ? String(rule.key(list[0])) : `${name}:${list[0].id}`);
      else fire(rule, {id: list[0].id, type: 'batch', subject: list[0].subject, data: {count: list.length, events: list.map(e => ({id: e.id, type: e.type, subject: e.subject, data: e.data}))}}, `${name}:deferred:${list[0].id}`);
    }
    if (started) timer(flushDeferred, 60000);
  }

  async function execute(job) {
    const rule = rules.get(job.input.rule);
    const claimed = jobs.claim(job.id, 'automation', {now: Date.now(), leaseMs});
    const beat = setInterval(() => {try {jobs.heartbeat(claimed.id, claimed.attempt, {leaseMs});} catch {}}, Math.max(1000, leaseMs / 3)); beat.unref?.();
    const event = job.input.event;
    publish('job.started', {job: job.id, rule: rule.name}, event.subject);
    let status = 'failed', detail = {};
    try {
      const prompt = render(rule, event);
      const sessionId = typeof rule.session === 'function' ? rule.session(event) : undefined;
      const result = await runner.run({text: prompt.text, context: prompt.context, title: rule.title || prompt.title || rule.name, model: rule.model ?? prompt.model,
        sessionId: sessionId || undefined, operationId: 'job-' + claimed.attempt, timeoutMs: rule.timeoutMs, subject: event.subject ?? undefined});
      detail = {session: result.sessionId, runStatus: result.status, text: result.text?.slice(0, 4000), toolCalls: result.toolCalls?.length ?? 0};
      if (result.status !== 'completed') status = 'failed';
      else if (rule.expect) {
        const verdict = await rule.expect(result, {job: claimed, event});
        status = verdict === true ? 'completed' : verdict === 'partial' ? 'partial' : 'failed';
        if (status !== 'completed') detail.expectation = 'not met';
      } else status = 'completed';
    } catch (error) {
      detail = {...detail, code: error.code || 'ERROR', message: String(error.message || '').slice(0, 500)}; onError(error);
    } finally {clearInterval(beat);}
    try {jobs.finish(claimed.id, claimed.attempt, {status, ...detail}, () => true);} catch (error) {onError(error);}
    publish('job.finished', {job: job.id, rule: rule.name, status, session: detail.session}, event.subject);
    try {activity?.record({kind: 'automation.job', actor: 'automation', session: detail.session, subject: event.subject, summary: `${rule.name}: ${status}`, status: status === 'completed' ? 'ok' : status, data: {job: job.id, rule: rule.name}});} catch {}
  }

  function pump() {
    if (!started || paused) return;
    while (inflight.size < maxConcurrent) {
      const next = jobs.list({state: 'queued', limit: 50}).reverse().find(j => rules.has(j.input?.rule) && !inflight.has(j.id));
      if (!next) return;
      inflight.add(next.id);
      execute(next).catch(onError).finally(() => {inflight.delete(next.id); queueMicrotask(pump);});
    }
  }

  function arm(name) {
    const s = schedules.get(name); if (!s || !started) return;
    const at = nextRun(s.cron, {after: now(), timeZone: s.timeZone}); s.next = at;
    const delay = at.getTime() - now().getTime();
    s.timer = timer(() => {
      if (delay > MAX_TIMER) return arm(name);
      fire(rules.get(name), {id: `${name}@${at.toISOString()}`, type: 'schedule', time: at.toISOString(), data: {scheduledFor: at.toISOString()}}, `schedule:${name}:${at.toISOString().slice(0, 16).replace(/[-:]/g, '')}`);
      arm(name);
    }, delay);
  }

  const automation = {
    /** Run a prompt when matching events are published. */
    on(types, rule) {
      check(rule && typeof rule === 'object', 'INVALID_REQUEST', 'A rule object is required');
      const name = rule.name || (Array.isArray(types) ? types.join('+') : types).replace(/[^a-z0-9_.-]/g, '_').toLowerCase();
      const r = validateRule(name, rule); rules.set(name, r);
      const list = Array.isArray(types) ? types : [types];
      if (started) unsubscribe.push(events.subscribe(list, e => accept(r, e)));
      r.types = list; return automation;
    },
    /** Run a prompt on a cron schedule in a time zone; missed runs within catchUpMs run once on start. */
    schedule(name, cron, rule) {
      parseCron(cron);
      const r = validateRule(name, rule); rules.set(name, r);
      schedules.set(name, {cron, timeZone: rule.timeZone || 'UTC', catchUpMs: rule.catchUpMs ?? 24 * 3600 * 1000});
      if (started) arm(name);
      return automation;
    },
    /** Poll a condition; when its value changes, run the rule with {previous, value}. */
    watch(name, {check: probe, everyMs = 60000, changed = (a, b) => JSON.stringify(a) !== JSON.stringify(b), ...rule}) {
      check(typeof probe === 'function', 'INVALID_REQUEST', 'A watcher needs a check function');
      const r = validateRule(name, rule); rules.set(name, r); watchers.set(name, {probe, everyMs, changed, value: undefined, primed: false});
      if (started) loopWatch(name);
      return automation;
    },
    /** Fire a rule directly (e.g. from an "Assign to agent" button). */
    trigger(name, data = {}, {key, subject} = {}) {
      const rule = rules.get(name); check(rule, 'NOT_FOUND', `Unknown automation rule ${name}`);
      const id = key || `${name}:${now().getTime()}`;
      return fire(rule, {id, type: 'manual', subject, data, time: now().toISOString()}, id);
    },
    start() {
      if (started) return automation; started = true;
      const interrupted = jobs.interruptExpired(Date.now());
      if (interrupted) publish('automation.interrupted', {count: interrupted});
      for (const rule of rules.values()) if (rule.types) unsubscribe.push(events.subscribe(rule.types, e => accept(rule, e)));
      for (const [name, s] of schedules) {
        const previous = previousRun(s.cron, {before: now(), timeZone: s.timeZone, lookbackMs: s.catchUpMs});
        if (previous) {
          const key = `schedule:${name}:${previous.toISOString().slice(0, 16).replace(/[-:]/g, '')}`;
          if (!jobs.find(key)) fire(rules.get(name), {id: `${name}@${previous.toISOString()}`, type: 'schedule', time: previous.toISOString(), data: {scheduledFor: previous.toISOString(), catchUp: true}}, key);
        }
        arm(name);
      }
      for (const name of watchers.keys()) loopWatch(name);
      timer(flushDeferred, 60000);
      queueMicrotask(pump);
      return automation;
    },
    stop() {started = false; for (const t of timers) clearTimeout(t); timers.clear(); unsubscribe.forEach(u => u()); unsubscribe = [];},
    /** Kill switch: no new jobs start; queued jobs wait; triggers are recorded as skipped. */
    pause(reason = 'paused by owner') {paused = {reason, at: now().toISOString()}; publish('automation.paused', {reason});},
    resume() {paused = null; publish('automation.resumed', {}); queueMicrotask(pump);},
    status() {
      return {started, paused, running: inflight.size, rules: [...rules.values()].map(r => ({name: r.name, events: r.types || null, prompt: typeof r.prompt === 'string' ? r.prompt : 'custom',
        schedule: schedules.get(r.name) ? {cron: schedules.get(r.name).cron, timeZone: schedules.get(r.name).timeZone, next: schedules.get(r.name).next?.toISOString() ?? null} : null,
        watch: watchers.has(r.name) ? {everyMs: watchers.get(r.name).everyMs} : null})),
        queued: jobs.list({state: 'queued', limit: 100}).length, interrupted: jobs.list({state: 'interrupted', limit: 100}).map(j => ({id: j.id, key: j.job_key}))};
    },
  };

  function loopWatch(name) {
    const w = watchers.get(name); if (!w || !started) return;
    const tick = async () => {
      try {
        const value = await w.probe();
        if (w.primed && w.changed(w.value, value)) fire(rules.get(name), {id: `${name}@${now().toISOString()}`, type: 'watch', data: {previous: w.value, value}}, `watch:${name}:${now().getTime()}`);
        w.value = value; w.primed = true;
      } catch (error) {onError(error);}
      if (started) timer(tick, w.everyMs);
    };
    void tick();
  }
  return automation;
}
