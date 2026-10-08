// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
// Headless agent runs: send a prompt (new or existing session), follow the session's
// events, settle interactions by policy, and await the end of the turn. The native host
// already forwards `session.event`; a history poll covers sessions it stops following.
import {randomUUID} from 'node:crypto';
import {check, AugmentorError, isId} from './errors.mjs';

const TERMINAL = new Set(['completed', 'aborted', 'blocked', 'error', 'max-tokens']);

export function textOf(event) {
  const content = event?.data?.message?.content;
  return Array.isArray(content) ? content.filter(p => p?.type === 'text' && typeof p.text === 'string').map(p => p.text).join('') : '';
}

/** Default interaction policy: refuse approvals and tell the agent nobody is available. */
export function refuseInteractions(interaction) {
  if (interaction.kind === 'approval') return {outcome: 'rejected'};
  const questions = Array.isArray(interaction.params?.questions) ? interaction.params.questions : [];
  return {answer: {answers: questions.map(q => ({id: q.id, selected: [], custom: 'No one is available to answer during this background run. Use the safest option or stop and report what you need.'}))}};
}

export class AgentRunner {
  /**
   * @param client        AugmentorClient (connected lazily)
   * @param interactions  'reject' | 'approve-reads' | async (interaction) => answer | undefined (leave for a human)
   * @param events        optional EventHub for agent.run.* events
   * @param activity      optional ActivityLog
   */
  constructor({client, interactions = 'reject', events, activity, pollMs = 5000, timeoutMs = 15 * 60 * 1000, now = () => Date.now()} = {}) {
    check(client && typeof client.prompt === 'function', 'INVALID_REQUEST', 'An AugmentorClient is required');
    Object.assign(this, {client, interactions, events, activity, pollMs, timeoutMs, now});
  }

  async policyAnswer(interaction) {
    if (typeof this.interactions === 'function') return this.interactions(interaction);
    if (this.interactions === 'reject') return refuseInteractions(interaction);
    return undefined;
  }

  /** Create a session, optionally titled and with a model selection. */
  async createSession({sessionId = randomUUID(), title, model} = {}) {
    await this.client.connect();
    await this.client.createSession(sessionId);
    if (title) await this.client.rename(sessionId, String(title).slice(0, 200)).catch(() => {});
    if (model) await this.client.selectModel(sessionId, model);
    return sessionId;
  }

  /**
   * Run one prompt and wait for the turn to end.
   * @returns {sessionId, operationId, status, reason, text, toolCalls, interactions, durationMs}
   */
  async run({text, context, sessionId, title, model, operationId = randomUUID(), mode = 'queue', attachments, timeoutMs = this.timeoutMs, signal, onEvent, subject} = {}) {
    check(typeof text === 'string' && text.trim(), 'INVALID_REQUEST', 'Prompt text is required');
    check(isId(operationId), 'INVALID_ID', 'Invalid operation ID');
    await this.client.connect();
    const started = this.now();
    if (!sessionId) sessionId = await this.createSession({title, model});
    else if (model) await this.client.selectModel(sessionId, model);
    const state = {matched: false, started: false, text: '', toolCalls: [], interactions: [], reason: null, seen: 0};
    const publish = (type, data) => {try {this.events?.publish(type, {sessionId, operationId, ...data}, {subject, source: 'agent'});} catch {}};
    publish('agent.run.started', {});
    let settle; const done = new Promise(resolve => {settle = resolve;});
    const finish = (status, reason) => settle({status, reason});
    const onSessionEvent = params => {
      if (params?.sessionId !== sessionId || !params.event) return;
      const event = params.event; state.seen++;
      try {onEvent?.(event);} catch {}
      if (event.type === 'user/message' && (event.data?.source?.rpcId === operationId || event.data?.requestId === operationId)) state.matched = true;
      if (event.type === 'turn/start') state.started = true;
      if (!state.matched && !state.started) return;
      if (event.type === 'assistant/message') {const t = textOf(event); if (t) state.text = t;}
      if (event.type === 'tool/call') state.toolCalls.push({name: event.data?.name, id: event.data?.toolCallId});
      if (event.type === 'tool/result') {const call = state.toolCalls.find(c => c.id === event.data?.toolCallId); if (call) call.ok = !event.data?.isError;}
      if (event.type === 'turn/end') {
        const kind = event.data?.reason?.kind || 'completed';
        finish(kind === 'completed' ? 'completed' : TERMINAL.has(kind) ? kind : 'error', kind);
      }
    };
    const onInteraction = kind => async (params, message) => {
      if (params?.sessionId !== sessionId) return;
      const interaction = {id: message?.id ?? params.approvalId, kind, params};
      let answer;
      try {answer = await this.policyAnswer(interaction);} catch {answer = refuseInteractions(interaction);}
      state.interactions.push({id: interaction.id, kind, answered: answer !== undefined, outcome: answer?.outcome});
      if (answer !== undefined && interaction.id) await this.client.answerInteraction(interaction.id, answer).catch(() => {});
      else publish('agent.run.waiting', {interaction: {id: interaction.id, kind}});
    };
    const onApproval = onInteraction('approval'), onQuestion = onInteraction('question');
    const onError = params => {if (params?.sessionId === sessionId) state.lastError = params.message;};
    this.client.on('session.event', onSessionEvent);
    this.client.on('approval.requested', onApproval);
    this.client.on('question.requested', onQuestion);
    this.client.on('session.error', onError);
    let poll, timer;
    const abort = () => finish('cancelled', 'aborted');
    try {
      const accepted = await this.client.prompt({sessionId, operationId, text, context, mode, attachments});
      if (accepted?.command && !accepted?.turn) finish('completed', 'command');
      timer = setTimeout(() => finish('timeout', 'timeout'), timeoutMs); timer.unref?.();
      signal?.addEventListener('abort', abort, {once: true});
      // Fallback for sessions the host stopped following: the history header says when it is idle.
      const check = async () => {
        try {
          const page = await this.client.history(sessionId, {maxMessages: 30});
          const events = Array.isArray(page.events) ? page.events : [];
          const mine = events.findIndex(e => (e.type === 'user/message' || e.event?.type === 'user/message') && ((e.data ?? e.event?.data)?.source?.rpcId === operationId));
          if (mine >= 0) state.matched = true;
          if (page.running === false && (state.matched || this.now() - started > this.pollMs * 3)) {
            const after = mine >= 0 ? events.slice(mine + 1) : events;
            const end = [...after].reverse().find(e => (e.type ?? e.event?.type) === 'turn/end');
            const last = [...after].reverse().find(e => (e.type ?? e.event?.type) === 'assistant/message');
            if (last) state.text = textOf(last.event ?? last) || state.text;
            const kind = (end?.data ?? end?.event?.data)?.reason?.kind || 'completed';
            finish(kind === 'completed' ? 'completed' : TERMINAL.has(kind) ? kind : 'error', kind);
            return;
          }
        } catch {}
        poll = setTimeout(check, this.pollMs); poll.unref?.();
      };
      poll = setTimeout(check, this.pollMs); poll.unref?.();
      const {status, reason} = await done;
      if (status === 'timeout' || status === 'cancelled') await this.client.cancel(sessionId).catch(() => {});
      const result = {sessionId, operationId, status, reason, text: state.text, toolCalls: state.toolCalls, interactions: state.interactions,
        ...(state.lastError ? {error: state.lastError} : {}), durationMs: this.now() - started};
      publish('agent.run.finished', {status, reason, toolCalls: state.toolCalls.length});
      try {this.activity?.record({kind: 'agent.run', actor: 'app', session: sessionId, subject, summary: text.slice(0, 200), status: status === 'completed' ? 'ok' : status, operationId, durationMs: result.durationMs, data: {reason, toolCalls: state.toolCalls.length}});} catch {}
      return result;
    } catch (error) {
      publish('agent.run.finished', {status: 'failed', code: error.code});
      if (error instanceof AugmentorError) throw error;
      throw new AugmentorError('UNKNOWN_OUTCOME', 'The prompt was not confirmed; it was not resent', {operationId, sessionId});
    } finally {
      clearTimeout(timer); clearTimeout(poll); signal?.removeEventListener('abort', abort);
      this.client.off('session.event', onSessionEvent); this.client.off('approval.requested', onApproval);
      this.client.off('question.requested', onQuestion); this.client.off('session.error', onError);
    }
  }
}
