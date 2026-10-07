// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
// Inspectable, scoped preferences with provenance. The owner's own settings are confirmed;
// agent suggestions stay unconfirmed until the owner confirms them (memory-poisoning
// defence); approve/edit/reject decisions are recorded as feedback the agent can read.
import {randomUUID} from 'node:crypto';
import {check} from './errors.mjs';
import {openDatabase, parseJson, toJson, page} from './store.mjs';
import {defineTool} from './toolkit.mjs';

const SCOPE = /^(app|owner|record:[A-Za-z0-9_.:-]{1,160}|kind:[a-z][a-z0-9_-]{0,63})$/;
const KEY = /^[a-z][a-z0-9_.-]{0,79}$/;

export class PreferenceStore {
  constructor(file = ':memory:', {now = () => new Date()} = {}) {
    this.now = now;
    this.db = openDatabase(file, `CREATE TABLE IF NOT EXISTS preferences(scope TEXT, key TEXT, value TEXT, source TEXT, confirmed INTEGER, evidence TEXT, updated_at TEXT, PRIMARY KEY(scope, key));
      CREATE TABLE IF NOT EXISTS feedback(id TEXT PRIMARY KEY, time TEXT, tool TEXT, decision TEXT, note TEXT, subject TEXT, changed TEXT);
      CREATE INDEX IF NOT EXISTS feedback_tool ON feedback(tool, time);`);
  }
  /** Owner or app sets a preference (confirmed), or the agent suggests one (unconfirmed). */
  set(scope, key, value, {source = 'owner', evidence} = {}) {
    check(SCOPE.test(scope) && KEY.test(key), 'INVALID_REQUEST', 'Scopes are app, owner, record:<id> or kind:<name>; keys are lower-case dotted names');
    check(['owner', 'app', 'agent'].includes(source), 'INVALID_REQUEST', 'Source must be owner, app or agent');
    const text = JSON.stringify(value); check(text !== undefined && text.length <= 4000, 'INVALID_REQUEST', 'Preference values are JSON of at most 4000 characters');
    const existing = this.get(scope, key);
    // An agent suggestion never overwrites a confirmed owner choice.
    if (source === 'agent' && existing?.confirmed) return {...existing, ignored: true};
    this.db.prepare('INSERT INTO preferences VALUES(?,?,?,?,?,?,?) ON CONFLICT(scope,key) DO UPDATE SET value=excluded.value,source=excluded.source,confirmed=excluded.confirmed,evidence=excluded.evidence,updated_at=excluded.updated_at')
      .run(scope, key, text, source, source === 'agent' ? 0 : 1, toJson(evidence ?? null), this.now().toISOString());
    return this.get(scope, key);
  }
  get(scope, key) {
    const r = this.db.prepare('SELECT * FROM preferences WHERE scope=? AND key=?').get(scope, key);
    return r ? {scope: r.scope, key: r.key, value: JSON.parse(r.value), source: r.source, confirmed: !!r.confirmed, evidence: parseJson(r.evidence), updatedAt: r.updated_at} : null;
  }
  confirm(scope, key) {check(this.db.prepare('UPDATE preferences SET confirmed=1 WHERE scope=? AND key=?').run(scope, key).changes === 1, 'NOT_FOUND', 'No such preference'); return this.get(scope, key);}
  remove(scope, key) {return this.db.prepare('DELETE FROM preferences WHERE scope=? AND key=?').run(scope, key).changes === 1;}
  list({scope, confirmed} = {}) {
    const where = [], values = [];
    if (scope) {where.push('scope=?'); values.push(scope);}
    if (confirmed !== undefined) {where.push('confirmed=?'); values.push(confirmed ? 1 : 0);}
    return this.db.prepare(`SELECT scope,key FROM preferences ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY scope,key`).all(...values).map(r => this.get(r.scope, r.key));
  }
  /** Record the owner's decision on a proposal as feedback (which fields they changed, why). */
  observe({tool, decision, note, subject, args, finalArgs}) {
    const changed = decision === 'edit' && args && finalArgs ? Object.keys({...args, ...finalArgs}).filter(k => JSON.stringify(args[k]) !== JSON.stringify(finalArgs[k])) : [];
    this.db.prepare('INSERT INTO feedback VALUES(?,?,?,?,?,?,?)').run(randomUUID(), this.now().toISOString(), tool, decision, note ? String(note).slice(0, 2000) : null, subject ?? null, JSON.stringify(changed));
  }
  feedback({tool, ...rest} = {}) {
    const {limit, offset} = page(rest);
    return this.db.prepare(`SELECT * FROM feedback ${tool ? 'WHERE tool=?' : ''} ORDER BY time DESC LIMIT ? OFFSET ?`).all(...(tool ? [tool] : []), limit, offset)
      .map(r => ({time: r.time, tool: r.tool, decision: r.decision, note: r.note, subject: r.subject, changed: JSON.parse(r.changed)}));
  }
  close() {this.db.close();}
}

/** Agent tools: read preferences and recent owner feedback; suggest a preference (unconfirmed). */
export function preferenceTools(store, {prefix}) {
  return [
    defineTool({name: `${prefix}_preferences`, title: 'Owner preferences', effect: 'read',
      description: 'Read the owner\'s preferences (confirmed ones are binding; unconfirmed ones are your earlier suggestions) and recent feedback on your proposals. Read before drafting.',
      input: {type: 'object', properties: {scope: {type: 'string', maxLength: 200, description: 'app, owner, record:<id> or kind:<name>'}, tool: {type: 'string', maxLength: 128, description: 'Feedback for one tool'}}},
      handler: ({scope, tool}) => ({preferences: store.list(scope ? {scope} : {}), feedback: store.feedback({tool, limit: 20})})}),
    defineTool({name: `${prefix}_suggest_preference`, title: 'Suggest a preference', effect: 'draft',
      description: 'Record a preference you inferred (for example a tone the owner keeps choosing). It stays unconfirmed until the owner confirms it and never overrides a confirmed preference.',
      input: {type: 'object', properties: {scope: {type: 'string', maxLength: 200}, key: {type: 'string', maxLength: 80}, value: {}, reason: {type: 'string', maxLength: 500}}, required: ['scope', 'key', 'value', 'reason']},
      handler: ({scope, key, value, reason}, ctx) => store.set(scope, key, value, {source: 'agent', evidence: {reason, session: ctx.sessionId}})}),
  ];
}
