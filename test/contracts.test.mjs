// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {OperationStore,JobStore,validateManifest,workspaceProfile} from '../src/index.mjs';
const manifest={schemaVersion:1,id:'fixture',name:'Fixture',harness:'dsh',instructions:['role.md'],tools:[],permissions:{tools:[]},voice:{experimental:true,enabled:false}};
const directory=(t,beforeRemove=()=>{})=>{const d=mkdtempSync(join(tmpdir(),'app-sdk-'));t.after(()=>{beforeRemove();rmSync(d,{recursive:true,force:true});});return d;};
test('manifest rejects unsupported harnesses and undeclared authority',()=>{
  for(const patch of [{harness:'pi'},{harness:'unknown'},{permissions:{tools:['*']}},{voice:{experimental:false,enabled:true}},{secret:'accidental'}])assert.throws(()=>validateManifest({...manifest,...patch}));
  assert.equal(validateManifest(manifest).voice.enabled,false);
  assert.equal(validateManifest({...manifest,harness:'codex'}).harness,'codex');
});
test('workspace keeps private install options out of manifest and rejects file escapes',t=>{
 const root=directory(t);writeFileSync(join(root,'role.md'),'Role');
 const p=workspaceProfile(manifest,{root,origin:'http://127.0.0.1:3456',tokenFile:join(root,'token')});
 assert.equal(p.policy.sharedSettings,false);assert.deepEqual(p.policy.tools,[]);
 const outside=directory(t);writeFileSync(join(outside,'secret'),'No access');symlinkSync(join(outside,'secret'),join(root,'link'));
 assert.throws(()=>workspaceProfile({...manifest,instructions:['link']},{root,origin:'http://127.0.0.1:3456',tokenFile:join(root,'token')}),/escapes/);
});
test('unknown side effects survive restart and identical IDs never execute twice',async t=>{
 let s;const file=join(directory(t,()=>s?.close()),'ops.sqlite');s=new OperationStore(file);let calls=0;
 await assert.rejects(s.execute('workspace','operation',{a:1},async()=>{calls++;throw Error('Lost response after external write');}));s.close();s=undefined;s=new OperationStore(file);
 await assert.rejects(s.execute('workspace','operation',{a:1},async()=>++calls),e=>e.code==='UNKNOWN_OUTCOME');assert.equal(calls,1);
 assert.throws(()=>s.reserve('workspace','operation',{a:2}),e=>e.code==='OPERATION_CONFLICT');
 s.settle('workspace','operation','completed',{receipt:'provider-id'});
 assert.deepEqual(await s.execute('workspace','operation',{a:1},()=>++calls),{receipt:'provider-id'});assert.equal(calls,1);
});
test('independent database connections atomically reserve only one external operation',t=>{
 let a,b;const file=join(directory(t,()=>{a?.close();b?.close();}),'ops.sqlite');a=new OperationStore(file);b=new OperationStore(file);
 assert.equal(a.reserve('app','same',{b:2,a:1}).fresh,true);assert.equal(b.reserve('app','same',{a:1,b:2}).fresh,false);
 assert.equal(b.reserve('other-app','same',{a:1}).fresh,true);
});
test('job leases interrupt without replay, enforce output validation and fence old attempts',async t=>{
 let s;s=new JobStore(join(directory(t,()=>s?.close()),'jobs.sqlite'));const j=s.enqueue('daily:2026-09-30',{task:'research'});
 assert.equal(s.enqueue('daily:2026-09-30',{task:'research'}).id,j.id);assert.throws(()=>s.enqueue('daily:2026-09-30',{task:'other'}));
 const first=s.claim(j.id,'session-a',{now:0,leaseMs:1000});s.interruptExpired(1001);
 assert.throws(()=>s.retry(j.id),e=>e.code==='RECONCILIATION_REQUIRED');
 s.retry(j.id,{previousStopped:true});const next=s.claim(j.id,'session-b');
 await assert.rejects(s.finish(j.id,first.attempt,{status:'completed'},()=>true),e=>e.code==='STALE_ATTEMPT');
 await assert.rejects(s.finish(j.id,next.attempt,{status:'completed'},()=>false),e=>e.code==='INVALID_RESULT');
 await s.finish(j.id,next.attempt,{status:'partial',outputs:['saved-record'],missing:['source unavailable']},r=>r.outputs[0]==='saved-record');
 assert.equal(s.get(j.id).state,'partial');
});
test('cancel during asynchronous result validation rejects a late result',async t=>{
 let s;s=new JobStore(join(directory(t,()=>s?.close()),'jobs.sqlite'));const j=s.claim(s.enqueue('job',{task:'draft'}).id,'s');
 let done;const pending=s.finish(j.id,j.attempt,{status:'completed'},()=>new Promise(r=>{done=r;}));s.cancel(j.id);done(true);
 await assert.rejects(pending,e=>e.code==='STALE_ATTEMPT');assert.equal(s.get(j.id).state,'cancelled');
});
