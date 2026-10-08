// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
// Append-only activity log: what the agent did, why, and with what outcome. It records
// digests and summaries, not raw arguments, so it can be shown to the owner safely.
import {randomUUID, createHash} from 'node:crypto';
import {check, canonicalJSON} from './errors.mjs';
import {openDatabase, parseJson, toJson, page} from './store.mjs';

const KIND = /^[a-z][a-z0-9_.-]{0,63}$/;

export class ActivityLog {
  constructor(file = ':memory:', {now = () => new Date()} = {}) {
    this.now = now;
    this.db = openDatabase(file, `CREATE TABLE IF NOT EXISTS activity(
      id TEXT PRIMARY KEY, time TEXT NOT NULL, kind TEXT NOT NULL, actor TEXT, session TEXT, subject TEXT,
      summary TEXT, status TEXT, operation_id TEXT, digest TEXT, data TEXT, duration_ms INTEGER);
      CREATE INDEX IF NOT EXISTS activity_time ON activity(time); CREATE INDEX IF NOT EXISTS activity_subject ON activity(subject, time);`);
  }
  /** Record one entry. `data` should be a small projection; `input` is only hashed. */
  record({kind, actor = 'system', session, subject, summary = '', status = 'ok', operationId, input, data, durationMs}) {
    check(KIND.test(kind), 'INVALID_REQUEST', 'Activity kind must be a lower-case dotted name');
    const entry = {id: randomUUID(), time: this.now().toISOString(), kind, actor: String(actor).slice(0, 200), session: session ?? null,
      subject: subject ? String(subject).slice(0, 200) : null, summary: String(summary).slice(0, 2000), status,
      operationId: operationId ?? null, digest: input === undefined ? null : createHash('sha256').update(canonicalJSON(input)).digest('hex'),
      data: data ?? null, durationMs: Number.isFinite(durationMs) ? Math.round(durationMs) : null};
    this.db.prepare('INSERT INTO activity VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(entry.id, entry.time, entry.kind, entry.actor, entry.session,
      entry.subject, entry.summary, entry.status, entry.operationId, entry.digest, toJson(entry.data), entry.durationMs);
    return entry;
  }
  list({kind, session, subject, since, status, ...rest} = {}) {
    const where = [], values = [];
    if (kind) {if (kind.endsWith('.*')) {where.push('kind LIKE ?'); values.push(kind.slice(0, -1) + '%');} else {where.push('kind=?'); values.push(kind);}}
    for (const [column, value] of [['session', session], ['subject', subject], ['status', status]]) if (value) {where.push(column + '=?'); values.push(value);}
    if (since) {where.push('time>?'); values.push(new Date(since).toISOString());}
    const {limit, offset} = page(rest);
    return this.db.prepare(`SELECT * FROM activity ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY time DESC LIMIT ? OFFSET ?`).all(...values, limit, offset)
      .map(r => ({id: r.id, time: r.time, kind: r.kind, actor: r.actor, session: r.session, subject: r.subject, summary: r.summary, status: r.status,
        operationId: r.operation_id, digest: r.digest, data: parseJson(r.data), durationMs: r.duration_ms}));
  }
  /** OpenTelemetry GenAI-shaped span view of tool activity (content is never included). */
  spans(options) {
    return this.list({kind: 'tool.*', ...options}).map(e => ({name: 'execute_tool ' + (e.data?.tool || e.subject || ''), startTime: e.time,
      durationMs: e.durationMs, status: e.status === 'ok' ? 'OK' : 'ERROR',
      attributes: {'gen_ai.operation.name': 'execute_tool', 'gen_ai.tool.name': e.data?.tool, 'gen_ai.conversation.id': e.session, 'augmentor.operation_id': e.operationId}}));
  }
  close() {this.db.close();}
}
