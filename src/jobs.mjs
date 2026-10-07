// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {chmodSync} from 'node:fs';
import {check, isId, canonicalJSON} from './errors.mjs';
// Optional durable queue. The application owns scheduling and result validation.
export class JobStore {
  constructor(file) {
    this.db = new DatabaseSync(file); if (file !== ':memory:') chmodSync(file,0o600);
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,job_key TEXT UNIQUE,input TEXT,state TEXT,attempt TEXT,session TEXT,lease_until INTEGER,result TEXT);');
  }
  get(id) {const r=this.db.prepare('SELECT * FROM jobs WHERE id=?').get(id);return r ? {...r,input:JSON.parse(r.input),result:r.result ? JSON.parse(r.result):null}:null;}
  enqueue(key,input) {
    check(isId(key),'INVALID_ID','Stable job key required');check(input!==undefined,'INVALID_REQUEST','Job input is required; use null for none');const body=canonicalJSON(input), id=randomUUID();
    this.db.prepare('INSERT OR IGNORE INTO jobs VALUES(?,?,?,?,?,?,?,?)').run(id,key,body,'queued',null,null,0,null);
    const row=this.db.prepare('SELECT * FROM jobs WHERE job_key=?').get(key);
    check(row.input===body,'JOB_CONFLICT','Job key belongs to different input');return this.get(row.id);
  }
  claim(id,session,{now=Date.now(),leaseMs=60000}={}) {
    check(isId(session)&&Number.isFinite(leaseMs)&&leaseMs>=1000&&leaseMs<=3600000,'INVALID_REQUEST','Valid session and bounded lease required');
    const attempt=randomUUID();
    check(this.db.prepare('UPDATE jobs SET state=?,attempt=?,session=?,lease_until=? WHERE id=? AND state=?').run('running',attempt,session,now+leaseMs,id,'queued').changes===1,'JOB_CONFLICT','Job is not queued');
    return this.get(id);
  }
  heartbeat(id,attempt,{now=Date.now(),leaseMs=60000}={}) {
    check(Number.isFinite(leaseMs)&&leaseMs>=1000&&leaseMs<=3600000,'INVALID_REQUEST','Invalid lease');
    check(this.db.prepare('UPDATE jobs SET lease_until=? WHERE id=? AND attempt=? AND state=? AND lease_until>=?').run(now+leaseMs,id,attempt,'running',now).changes===1,'STALE_ATTEMPT','Job lease is no longer owned');
  }
  interruptExpired(now=Date.now()) {return this.db.prepare('UPDATE jobs SET state=? WHERE state=? AND lease_until<?').run('interrupted','running',now).changes;}
  cancel(id) {check(this.db.prepare("UPDATE jobs SET state='cancelled' WHERE id=? AND state IN ('queued','running','interrupted')").run(id).changes===1,'JOB_CONFLICT','Job is already terminal');return this.get(id);}
  async finish(id,attempt,result,validate) {
    check(typeof validate==='function'&&['completed','partial','failed'].includes(result?.status),'INVALID_RESULT','A result validator and explicit status are required');
    const job=this.get(id);check(job?.attempt===attempt&&['running','interrupted'].includes(job.state),'STALE_ATTEMPT','Job attempt is obsolete');
    check(await validate(result,job)===true,'INVALID_RESULT','Application did not confirm the saved outputs');
    check(this.db.prepare("UPDATE jobs SET state=?,result=? WHERE id=? AND attempt=? AND state IN ('running','interrupted')").run(result.status,JSON.stringify(result),id,attempt).changes===1,'STALE_ATTEMPT','Job changed during validation');return this.get(id);
  }
  retry(id,{previousStopped=false}={}) {
    check(previousStopped===true,'RECONCILIATION_REQUIRED','Confirm the previous execution stopped before retrying');
    check(this.db.prepare("UPDATE jobs SET state='queued',attempt=NULL,session=NULL,lease_until=0,result=NULL WHERE id=? AND state IN ('interrupted','failed','partial','cancelled')").run(id).changes===1,'JOB_CONFLICT','Job cannot be retried');return this.get(id);
  }
  /** Find a job by its stable key (for catch-up and deduplication). */
  find(key){const r=this.db.prepare('SELECT id FROM jobs WHERE job_key=?').get(key);return r?this.get(r.id):null;}
  /** List jobs, newest first, optionally by state and key prefix (e.g. after a restart). */
  list({state,keyPrefix,limit=50,offset=0}={}){
    const where=[],values=[];
    if(state){const states=Array.isArray(state)?state:[state];where.push(`state IN (${states.map(()=>'?').join(',')})`);values.push(...states);}
    if(keyPrefix){where.push('job_key LIKE ? ESCAPE ?');values.push(keyPrefix.replace(/[\\%_]/g,c=>'\\'+c)+'%','\\');}
    const lim=Math.max(1,Math.min(500,Number(limit)||50)),off=Math.max(0,Number(offset)||0);
    return this.db.prepare(`SELECT id FROM jobs ${where.length?'WHERE '+where.join(' AND '):''} ORDER BY rowid DESC LIMIT ? OFFSET ?`).all(...values,lim,off).map(r=>this.get(r.id));
  }
  close(){this.db.close();}
}
