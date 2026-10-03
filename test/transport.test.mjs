// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter,once} from 'node:events';
import {PassThrough} from 'node:stream';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import http from 'node:http';
import {AugmentorClient,createProxy,discoverRuntime} from '../src/index.mjs';
function fixture(t){const root=mkdtempSync(join(tmpdir(),'sdk-client-'));t.after(()=>rmSync(root,{recursive:true,force:true}));mkdirSync(join(root,'services/workspaces'),{recursive:true});writeFileSync(join(root,'services/workspaces/sdk.json'),JSON.stringify({protocol:'augmentor-app/1',harnesses:['dsh']}));if(process.platform!=='linux'){mkdirSync(join(root,'scripts'));writeFileSync(join(root,'scripts/app-sdk-launch.py'),'# synthetic adapter; only inspected by mocked transport');}const descriptor=join(root,'desktop.json');writeFileSync(descriptor,JSON.stringify({root,node:process.execPath,python:process.execPath}));return {root,descriptor};}
function host(description={}){const child=new EventEmitter();child.stdin=new PassThrough();child.stdout=new PassThrough();child.kill=()=>child.emit('exit');let buffer=Buffer.alloc(0),calls=[];
 child.stdin.on('data',chunk=>{buffer=Buffer.concat([buffer,chunk]);while(buffer.length>=4&&buffer.length>=buffer.readUInt32LE()+4){const n=buffer.readUInt32LE(),m=JSON.parse(buffer.subarray(4,n+4));buffer=buffer.subarray(n+4);calls.push(m);if(m.method==='session.prompt')continue;const result=m.method==='workspace.describe'?{protocol:'augmentor-app/1',profile:'fixture',harness:'dsh',productProtocol:'product/1',productVersion:'1',...description}:{};const body=Buffer.from(JSON.stringify({id:m.id,result})),header=Buffer.alloc(4);header.writeUInt32LE(body.length);queueMicrotask(()=>{child.stdout.write(header.subarray(0,2));child.stdout.write(Buffer.concat([header.subarray(2),body]));});}});return {child,calls};}
test('required feature denial stops negotiation before harness initialization',async t=>{
 const {descriptor}=fixture(t),h=host({features:{'dictation-settings':{state:'denied'}}});
 const c=new AugmentorClient({profile:'fixture',descriptor,requiredCapabilities:['dictation-settings'],start:()=>h.child});t.after(()=>c.close());
 await assert.rejects(c.connect(),error=>error.code==='CAPABILITY_UNAVAILABLE');
 assert.deepEqual(h.calls.map(call=>call.method),['workspace.describe']);assert.equal(c.ready,false);
});
test('capabilities can refresh after owner opt-out without replaying a prompt',async t=>{
 const {descriptor}=fixture(t),description={features:{voice:{state:'supported'}}},h=host(description);
 const c=new AugmentorClient({profile:'fixture',descriptor,requiredCapabilities:['voice'],start:()=>h.child});t.after(()=>c.close());await c.connect();
 description.features.voice.state='disabled';
 await assert.rejects(c.refreshCapabilities(),error=>error.code==='CAPABILITY_UNAVAILABLE'&&error.details.state==='disabled');
 await assert.rejects(c.connect(),error=>error.code==='CAPABILITY_UNAVAILABLE');
 assert.equal(h.calls.some(call=>call.method==='session.prompt'),false);
});
test('Codex negotiation requires explicit advertised support and never falls back to DSH',async t=>{
 const {root,descriptor}=fixture(t),h=host({harness:'codex'});let starts=0;
 const c=new AugmentorClient({profile:'fixture',descriptor,harness:'codex',start:()=>{starts++;return h.child;}});t.after(()=>c.close());
 await assert.rejects(c.connect(),error=>error.code==='INCOMPATIBLE_RUNTIME');assert.equal(starts,0);
 writeFileSync(join(root,'services/workspaces/sdk.json'),JSON.stringify({protocol:'augmentor-app/1',harnesses:['dsh','codex']}));
 await c.connect();assert.equal(starts,1);assert.deepEqual(h.calls.find(call=>call.method==='harness.select').params,{harness:'codex'});
});
test('concurrent connect uses one host, parses fragmented frames and never replays unknown prompts',async t=>{
 const {descriptor}=fixture(t),h=host();let starts=0;const c=new AugmentorClient({profile:'fixture',descriptor,start:()=>{starts++;return h.child;},timeoutMs:30});t.after(()=>c.close());
 await Promise.all([c.connect(),c.connect()]);assert.equal(starts,1);
 await assert.rejects(c.prompt({sessionId:'s',operationId:'op',text:'Write'}),e=>e.code==='UNKNOWN_OUTCOME'&&e.details.operationId==='op');
 assert.equal(h.calls.filter(m=>m.method==='session.prompt').length,1);
 c.close();await assert.rejects(c.connect(),e=>e.code==='CLIENT_CLOSED');
});
test('host death rejects pending work with uncertainty and no leaked promises',async t=>{
 const {descriptor}=fixture(t),h=host(),c=new AugmentorClient({profile:'fixture',descriptor,start:()=>h.child});t.after(()=>c.close());await c.connect();
 const pending=c.prompt({sessionId:'s',operationId:'op',text:'Write'});h.child.emit('exit');await assert.rejects(pending,e=>e.code==='UNKNOWN_OUTCOME');assert.equal(c.pending.size,0);
});
test('runtime discovery rejects legacy or unsupported installations',async t=>{
 const {root,descriptor}=fixture(t);writeFileSync(join(root,'services/workspaces/sdk.json'),JSON.stringify({protocol:'augmentor-app/2',harnesses:['dsh']}));
 await assert.rejects(discoverRuntime({descriptor}),e=>e.code==='INCOMPATIBLE_RUNTIME');
});
test('proxy requires owner authorization and exact Host/Origin, strips browser credentials',async t=>{
 const {root}=fixture(t),tokenFile=join(root,'token');writeFileSync(tokenFile,'x'.repeat(48));let observed,upstreamCalls=0;
 const upstream=http.createServer((req,res)=>{observed=req.headers;upstreamCalls++;res.writeHead(200,{'Set-Cookie':'upstream=secret'});res.end('maintained UI');});upstream.listen(0,'127.0.0.1');await once(upstream,'listening');
 let proxy;const server=http.createServer((req,res)=>proxy.http(req,res));server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(async()=>{await Promise.all([new Promise(r=>server.close(r)),new Promise(r=>upstream.close(r))]);});
 const origin='http://127.0.0.1:'+server.address().port;proxy=createProxy({profile:'fixture',origin,tokenFile,port:upstream.address().port,authorize:req=>req.headers.cookie==='owner=yes'});
 assert.equal((await fetch(origin+'/augmentor/sidepanel.html')).status,403);
 assert.equal((await fetch(origin+'/augmentor/sidepanel.html',{headers:{Cookie:'owner=yes',Origin:'https://evil.invalid'}})).status,403);
 const res=await fetch(origin+'/augmentor/sidepanel.html',{headers:{Cookie:'owner=yes',Origin:origin,Authorization:'Bearer injected'}});assert.equal(await res.text(),'maintained UI');assert.equal(res.headers.get('set-cookie'),null);
 assert.equal(observed.authorization,'Bearer '+'x'.repeat(48));assert.equal(observed.cookie,undefined);assert.equal(upstreamCalls,1);
});
test('WebSocket proxy checks owner and origin before opening the private tunnel',{timeout:5000},async t=>{
 const {root}=fixture(t),tokenFile=join(root,'token');writeFileSync(tokenFile,'z'.repeat(48));let calls=0,observed;
 const upstream=http.createServer();upstream.on('upgrade',(req,socket)=>{calls++;observed=req.headers;socket.write('HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n');socket.on('data',data=>socket.write(data));});
 upstream.listen(0,'127.0.0.1');await once(upstream,'listening');
 let proxy;const server=http.createServer();server.on('upgrade',(req,socket,head)=>proxy.upgrade(req,socket,head));server.listen(0,'127.0.0.1');await once(server,'listening');
 const origin='http://127.0.0.1:'+server.address().port;proxy=createProxy({profile:'fixture',origin,tokenFile,port:upstream.address().port,authorize:req=>req.headers.cookie==='owner=yes'});
 const sockets=new Set();for(const host of [server,upstream])host.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});
 t.after(async()=>{for(const socket of sockets)socket.destroy();await Promise.all([new Promise(r=>server.close(r)),new Promise(r=>upstream.close(r))]);});
 const request=(headers)=>new Promise((resolve,reject)=>{const req=http.request(origin+'/augmentor/native',{headers:{Connection:'Upgrade',Upgrade:'websocket',...headers}});req.on('error',reject);req.on('response',r=>{r.resume();resolve({status:r.statusCode});});req.on('upgrade',(r,socket)=>resolve({status:r.statusCode,socket}));req.end();});
 assert.equal((await request({Origin:origin})).status,403);
 assert.equal((await request({Origin:'https://evil.invalid',Cookie:'owner=yes'})).status,403);
 const {socket,status}=await request({Origin:origin,Cookie:'owner=yes',Authorization:'Bearer browser-secret'});assert.equal(status,101);assert.equal(calls,1);assert.equal(observed.cookie,undefined);assert.equal(observed.authorization,'Bearer '+'z'.repeat(48));
 const data=once(socket,'data');socket.write('fixture-frame');assert.equal((await data)[0].toString(),'fixture-frame');socket.destroy();
});
