// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
// Copied into a temporary consumer by consumer.test.mjs. Synthetic data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {apply} from './augmentor/tools.mjs';
import {createAppIntegration} from './augmentor/server.mjs';
import {mountAppAgent} from './augmentor/browser.mjs';
import {validateApplication} from '@augmentor/app-sdk';

test('generated modules use the installed package and HTTP/socket/tool boundaries',{timeout:15000},async t=>{
  assert.equal(typeof mountAppAgent,'function');assert.equal(typeof validateApplication,'function');
  const proxyToken='proxy-fixture-'.repeat(5),appToken='app-fixture-'.repeat(5);
  const proxyTokenFile=resolve('proxy.token'),appAgentTokenFile=resolve('app-agent.token');
  writeFileSync(proxyTokenFile,proxyToken,{mode:0o600});writeFileSync(appAgentTokenFile,appToken,{mode:0o600});
  let upstreamCalls=0,upstreamHeaders,upstreamPath,reads=0;
  const upstream=http.createServer((req,res)=>{upstreamCalls++;upstreamHeaders=req.headers;upstreamPath=req.url;res.end('synthetic maintained panel');});
  upstream.on('upgrade',(req,socket)=>{
    upstreamCalls++;upstreamHeaders=req.headers;
    socket.write('HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n');
    socket.on('data',chunk=>socket.write(chunk));
  });
  let integration;
  const server=http.createServer(async(req,res)=>{
    if(await integration.http(req,res))return;
    res.writeHead(404);res.end('existing app fallback');
  });
  server.on('upgrade',(req,socket,head)=>{if(!integration.upgrade(req,socket,head))socket.destroy();});
  server.requestTimeout=5000;server.headersTimeout=5000;
  const sockets=new Set();for(const s of [server,upstream])s.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});
  t.after(async()=>{for(const socket of sockets)socket.destroy();await Promise.all([server,upstream].map(s=>new Promise(resolve=>s.close(resolve))));});
  upstream.listen(0,'127.0.0.1');await once(upstream,'listening');server.listen(0,'127.0.0.1');await once(server,'listening');
  const origin='http://127.0.0.1:'+server.address().port;
  integration=createAppIntegration({origin,profile:'fixture-instance',proxyTokenFile,appAgentTokenFile,port:upstream.address().port,
    authorizeOwner:async req=>req.headers.cookie==='synthetic-owner=yes',
    readRecord:async id=>{reads++;if(id==='fault')throw Error('private backend failure');if(id==='invalid')return {id,version:-1,title:'bad'};
      return id==='record-1'?{id,version:7,title:'Synthetic record',privateField:'must not escape'}:null;}});
  const endpoint=origin+'/api/augmentor/tool',envelope={name:'fixture_records_read_record',args:{id:'record-1'},sessionId:'fixture-session',eventId:'fixture-op',operationId:'fixture-op'};
  const post=(value,headers={})=>fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+appToken,...headers},body:JSON.stringify(value)});
  assert.equal((await fetch(origin+'/existing-route')).status,404);
  assert.equal((await fetch(origin+'/augmentor/sidepanel.html')).status,403);
  assert.equal((await fetch(origin+'/augmentor/sidepanel.html',{headers:{Cookie:'synthetic-owner=yes',Origin:'https://other.invalid'}})).status,403);
  const panel=await fetch(origin+'/augmentor/sidepanel.html',{headers:{Cookie:'synthetic-owner=yes',Origin:origin,Authorization:'Bearer browser-injection'}});
  assert.equal(await panel.text(),'synthetic maintained panel');assert.equal(upstreamPath,'/embed/fixture-instance/sidepanel.html');
  assert.equal(upstreamHeaders.authorization,'Bearer '+proxyToken);assert.equal(upstreamHeaders.cookie,undefined);assert.equal(upstreamCalls,1);
  assert.equal((await post(envelope,{Authorization:''})).status,401);
  assert.equal((await post(envelope,{Authorization:'Bearer '+proxyToken})).status,401);
  assert.equal((await post(envelope,{Origin:'https://other.invalid'})).status,403);
  assert.equal((await post({...envelope,name:'shell'})).status,403);
  assert.equal((await post({...envelope,args:{id:'record-1',other:true}})).status,400);
  assert.equal((await post({...envelope,eventId:'different'})).status,400);
  assert.equal((await post({...envelope,args:{id:'a'.repeat(17000)}})).status,413);
  assert.equal((await post(envelope,{'Content-Type':'text/plain'})).status,415);
  assert.equal(reads,0);
  const tools=[];await apply({tools:{register:tool=>tools.push(tool),presentAs:()=>{throw Error('Do not redeclare native presentation');}}},
    {url:endpoint,tokenFile:appAgentTokenFile});
  assert.equal(tools.length,1);assert.equal(tools[0].name,envelope.name);
  const execution={agent:{id:'fixture-session'},callId:'fixture-call',signal:new AbortController().signal};
  await assert.rejects(tools[0].execute({id:42},execution),error=>error.code==='INVALID_ARGUMENTS');assert.equal(reads,0);
  assert.deepEqual(JSON.parse(await tools[0].execute({id:'record-1'},execution)),{id:'record-1',version:7,title:'Synthetic record'});assert.equal(reads,1);
  await assert.rejects(tools[0].execute({id:'missing'},execution),error=>error.code==='NOT_FOUND');
  await assert.rejects(tools[0].execute({id:'invalid'},execution),error=>error.code==='INVALID_OUTPUT');
  await assert.rejects(tools[0].execute({id:'fault'},execution),error=>error.code==='APPLICATION_UNAVAILABLE'&&!error.message.includes('private backend'));
  const upgrade=headers=>new Promise((resolve,reject)=>{
    const req=http.request(origin+'/augmentor/native',{headers:{Connection:'Upgrade',Upgrade:'websocket',...headers}});
    req.on('error',reject);req.on('response',res=>{res.resume();resolve({status:res.statusCode});});
    req.on('upgrade',(res,socket)=>resolve({status:res.statusCode,socket}));req.end();
  });
  assert.equal((await upgrade({Origin:origin})).status,403);
  assert.equal((await upgrade({Origin:'https://other.invalid',Cookie:'synthetic-owner=yes'})).status,403);
  const socketResult=await upgrade({Origin:origin,Cookie:'synthetic-owner=yes'});assert.equal(socketResult.status,101);
  assert.equal(upstreamHeaders.authorization,'Bearer '+proxyToken);assert.equal(upstreamHeaders.cookie,undefined);
  const echoed=once(socketResult.socket,'data');socketResult.socket.write('synthetic socket data');assert.equal((await echoed)[0].toString(),'synthetic socket data');socketResult.socket.destroy();
});
