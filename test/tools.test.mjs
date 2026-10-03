// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {registerDshTools} from '../src/dsh.mjs';
import {createApplicationTools,createToolClient} from '../src/tools.mjs';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:http';
test('declared array inputs and outputs are validated before use',async()=>{
 const tools=[];let calls=0;await registerDshTools({tools:{register:t=>tools.push(t),presentAs:()=>{throw Error('The preset already owns tool presentation');}}},{defineTool:x=>x,definitions:[['save','Save',{ids:{type:'array',items:{type:'string'},required:true}},{type:'object',required:['saved']}]],execute:async()=>{calls++;return {saved:true};}});
 const execution={agent:{id:'s'},signal:new AbortController().signal};
 await assert.rejects(tools[0].execute({ids:{}},execution),e=>e.code==='INVALID_ARGUMENTS');assert.equal(calls,0);
 assert.equal(await tools[0].execute({ids:['record']},execution),'{"saved":true}');
 await assert.rejects(tools[0].execute({ids:[]},{}),e=>e.code==='INVALID_CALLER');
});
test('harness-neutral tools enforce declaration, session, argument, output and cancellation boundaries',async()=>{
 let executions=0;
 const application=createApplicationTools({definitions:[['read','Read',{id:{type:'string',required:true}},{type:'object',required:['version'],properties:{version:{type:'integer'}}}]],
   execute:async(_name,args)=>{executions++;return args.id==='invalid'?{version:'wrong'}:{version:1};}});
 const execution={sessionId:'codex-session',callId:'native-call',signal:new AbortController().signal};
 for(const [name,args,caller,code] of [['foreign',{id:'x'},execution,'PERMISSION_DENIED'],['read',{id:2},execution,'INVALID_ARGUMENTS'],['read',{id:'x'},{sessionId:42},'INVALID_CALLER']])
   await assert.rejects(application.execute(name,args,caller),error=>error.code===code);
 const abort=new AbortController();abort.abort();await assert.rejects(application.execute('read',{id:'x'},{...execution,signal:abort.signal}),error=>error.name==='AbortError');assert.equal(executions,0);
 assert.deepEqual(await application.execute('read',{id:'x'},execution),{version:1});
 await assert.rejects(application.execute('read',{id:'invalid'},execution),error=>error.code==='INVALID_OUTPUT');
});
test('DSH and Codex tool clients retain the same durable identity and never retry an uncertain send',async t=>{
 const root=mkdtempSync(join(tmpdir(),'sdk-tool-identity-'));t.after(()=>rmSync(root,{recursive:true,force:true}));const tokenFile=join(root,'private.token');writeFileSync(tokenFile,'synthetic-private-token');
 const received=[];
 const execute=createToolClient({url:'http://127.0.0.1:8000/tool',tokenFile,fetchImpl:async(_url,options)=>{received.push(JSON.parse(options.body));return new Response('{}');}});
 await execute('read',{}, {agent:{id:'s'},callId:'call'});await execute('read',{}, {sessionId:'s',callId:'call'});
 assert.equal(received[0].operationId,received[1].operationId);assert.equal(received[0].sessionId,'s');
 let sends=0;const uncertain=createToolClient({url:'http://127.0.0.1:8000/tool',tokenFile,fetchImpl:async()=>{sends++;throw Error('connection lost');}});
 await assert.rejects(uncertain('read',{}, {sessionId:'s',callId:'call'}),error=>error.code==='UNKNOWN_OUTCOME');assert.equal(sends,1);
});
test('a response lost after dispatch retains its durable operation identity without replay',async t=>{
 const root=mkdtempSync(join(tmpdir(),'sdk-tool-interrupted-')),tokenFile=join(root,'private.token');writeFileSync(tokenFile,'synthetic-private-token');
 let received,sends=0,headersReceived=false;const server=createServer(async(req,res)=>{
  let raw='';for await(const chunk of req)raw+=chunk;received=JSON.parse(raw);sends++;
  res.writeHead(200,{'Content-Type':'application/json','Content-Length':'100'});res.write('{"saved":');setTimeout(()=>res.destroy(),50);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));rmSync(root,{recursive:true,force:true});});
 const execute=createToolClient({url:`http://127.0.0.1:${server.address().port}/tool`,tokenFile,fetchImpl:async(...args)=>{const response=await fetch(...args);headersReceived=true;return response;}});
 await assert.rejects(execute('save',{}, {sessionId:'owned',callId:'native-call'}),error=>error.code==='UNKNOWN_OUTCOME'&&error.details.operationId===received.operationId);
 assert.equal(headersReceived,true);assert.equal(sends,1);
});
