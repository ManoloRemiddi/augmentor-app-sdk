// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {chmodSync} from 'node:fs';
import {check, canonicalJSON, isId, AugmentorError} from './errors.mjs';
// Side-effect receipts are durable before invocation. Unknown is never automatic retry permission.
export class OperationStore {
  constructor(file) {
    this.db = new DatabaseSync(file); if (file !== ':memory:') chmodSync(file, 0o600);
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS operations(scope TEXT,id TEXT,digest TEXT,state TEXT,result TEXT,updated_at TEXT,PRIMARY KEY(scope,id));');
  }
  get(scope, id) {const r = this.db.prepare('SELECT * FROM operations WHERE scope=? AND id=?').get(scope,id); return r ? {...r, result:r.result ? JSON.parse(r.result) : null} : null;}
  reserve(scope, id, input) {
    check(isId(scope) && isId(id), 'INVALID_ID', 'Stable scope and operation ID required');
    const digest = createHash('sha256').update(canonicalJSON(input)).digest('hex');
    const inserted = this.db.prepare('INSERT OR IGNORE INTO operations VALUES(?,?,?,?,?,?)').run(scope,id,digest,'unknown',null,new Date().toISOString()).changes;
    const row = this.get(scope,id);
    check(row.digest === digest, 'OPERATION_CONFLICT', 'Operation ID already belongs to a different request');
    return {...row, fresh: inserted === 1};
  }
  settle(scope, id, state, result) {
    check(['completed','rejected'].includes(state), 'INVALID_STATE', 'Only confirmed outcomes may settle an operation');
    result = result === undefined ? null : result;
    check(this.db.prepare('UPDATE operations SET state=?,result=?,updated_at=? WHERE scope=? AND id=? AND state=?').run(state,JSON.stringify(result),new Date().toISOString(),scope,id,'unknown').changes === 1, 'OPERATION_CONFLICT', 'Operation is missing or already settled');
    return this.get(scope,id);
  }
  async execute(scope, id, input, action) {
    const row = this.reserve(scope,id,input);
    if (!row.fresh) {
      if (row.state === 'completed') return row.result;
      throw new AugmentorError(row.state === 'rejected' ? 'OPERATION_REJECTED' : 'UNKNOWN_OUTCOME', 'Operation was not repeated. Inspect or reconcile its receipt.', {scope, operationId:id});
    }
    // Errors leave unknown: a thrown timeout does not prove a remote write failed.
    const result = (await action()) ?? null; this.settle(scope,id,'completed',result); return result;
  }
  close() {this.db.close();}
}
