// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
// Durable proposals: the agent proposes, the owner decides in the app, the server
// executes. A decision recorded here is the server-side approval proof; a browser
// click alone never authorises a write.
import {randomUUID, createHash} from 'node:crypto';
import {check, canonicalJSON, isId} from './errors.mjs';
import {openDatabase, parseJson, toJson, page} from './store.mjs';

export const PROPOSAL_STATES = ['pending', 'approved', 'rejected', 'expired', 'executing', 'executed', 'failed', 'withdrawn'];
const DECISIONS = new Set(['approve', 'reject', 'edit']);

export class ProposalStore {
  constructor(file = ':memory:', {now = () => Date.now()} = {}) {
    this.now = now;
    this.db = openDatabase(file, `CREATE TABLE IF NOT EXISTS proposals(
      id TEXT PRIMARY KEY, operation_id TEXT UNIQUE, tool TEXT NOT NULL, args TEXT NOT NULL, digest TEXT NOT NULL,
      session TEXT, summary TEXT, preview TEXT, risk TEXT, subject TEXT, state TEXT NOT NULL, created_at INTEGER,
      expires_at INTEGER, decided_at INTEGER, decided_by TEXT, note TEXT, final_args TEXT, result TEXT, error TEXT);
      CREATE INDEX IF NOT EXISTS proposals_state ON proposals(state, created_at);`);
  }
  row(r) {
    if (!r) return null;
    return {id: r.id, operationId: r.operation_id, tool: r.tool, args: parseJson(r.args), session: r.session, summary: r.summary,
      preview: parseJson(r.preview), risk: r.risk, subject: r.subject, state: r.state, createdAt: r.created_at, expiresAt: r.expires_at,
      decidedAt: r.decided_at, decidedBy: r.decided_by, note: r.note, finalArgs: parseJson(r.final_args), result: parseJson(r.result), error: parseJson(r.error)};
  }
  get(id) {return this.row(this.db.prepare('SELECT * FROM proposals WHERE id=?').get(id));}
  byOperation(operationId) {return this.row(this.db.prepare('SELECT * FROM proposals WHERE operation_id=?').get(operationId));}

  /** Idempotent by operation ID: a repeated tool call returns the same proposal. */
  create({tool, args, operationId, session, summary = '', preview = null, risk = 'write', subject, ttlMs = 7 * 24 * 3600 * 1000}) {
    check(/^[A-Za-z][A-Za-z0-9_]{0,127}$/.test(tool), 'INVALID_REQUEST', 'Proposal requires a tool name');
    check(isId(operationId), 'INVALID_ID', 'Proposal requires a stable operation ID');
    const digest = createHash('sha256').update(canonicalJSON([tool, args])).digest('hex');
    const existing = this.byOperation(operationId);
    if (existing) {check(this.db.prepare('SELECT digest FROM proposals WHERE id=?').get(existing.id).digest === digest, 'OPERATION_CONFLICT', 'Operation ID already belongs to a different proposal'); return existing;}
    const id = randomUUID(), now = this.now();
    this.db.prepare('INSERT INTO proposals(id,operation_id,tool,args,digest,session,summary,preview,risk,subject,state,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(id, operationId, tool, JSON.stringify(args ?? {}), digest, session ?? null, String(summary).slice(0, 2000), toJson(preview), risk, subject ?? null, 'pending', now, now + ttlMs);
    return this.get(id);
  }
  list({state, session, tool, subject, ...rest} = {}) {
    this.expire();
    const where = [], values = [];
    if (state) {const states = Array.isArray(state) ? state : [state]; where.push(`state IN (${states.map(() => '?').join(',')})`); values.push(...states);}
    for (const [column, value] of [['session', session], ['tool', tool], ['subject', subject]]) if (value) {where.push(column + '=?'); values.push(value);}
    const {limit, offset} = page(rest);
    return this.db.prepare(`SELECT * FROM proposals ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...values, limit, offset).map(r => this.row(r));
  }
  expire() {return this.db.prepare("UPDATE proposals SET state='expired' WHERE state='pending' AND expires_at<?").run(this.now()).changes;}

  /** Record the owner's decision. `edit` approves with replacement arguments (validated by the caller). */
  decide(id, {decision, args, note, actor = 'owner'}) {
    check(DECISIONS.has(decision), 'INVALID_REQUEST', 'Decision must be approve, edit or reject');
    this.expire();
    const state = decision === 'reject' ? 'rejected' : 'approved';
    const finalArgs = decision === 'edit' ? args : null;
    check(decision !== 'edit' || (args && typeof args === 'object' && !Array.isArray(args)), 'INVALID_REQUEST', 'Edited proposals need replacement arguments');
    const changed = this.db.prepare("UPDATE proposals SET state=?,decided_at=?,decided_by=?,note=?,final_args=? WHERE id=? AND state='pending'")
      .run(state, this.now(), String(actor).slice(0, 200), note ? String(note).slice(0, 2000) : null, toJson(finalArgs), id).changes;
    check(changed === 1, 'CONFLICT', 'Proposal is not pending (already decided, withdrawn or expired)');
    return this.get(id);
  }
  /** Claim an approved proposal for execution exactly once. */
  claim(id) {
    check(this.db.prepare("UPDATE proposals SET state='executing' WHERE id=? AND state='approved'").run(id).changes === 1, 'CONFLICT', 'Proposal is not approved or is already executing');
    return this.get(id);
  }
  settle(id, {result, error}) {
    const state = error ? 'failed' : 'executed';
    check(this.db.prepare("UPDATE proposals SET state=?,result=?,error=? WHERE id=? AND state='executing'").run(state, toJson(result ?? null), toJson(error ?? null), id).changes === 1, 'CONFLICT', 'Proposal is not executing');
    return this.get(id);
  }
  withdraw(id) {
    check(this.db.prepare("UPDATE proposals SET state='withdrawn' WHERE id=? AND state='pending'").run(id).changes === 1, 'CONFLICT', 'Only pending proposals can be withdrawn');
    return this.get(id);
  }
  close() {this.db.close();}
}
