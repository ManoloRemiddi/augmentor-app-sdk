// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {registerDshTools} from '../src/dsh.mjs';
test('declared array inputs and outputs are validated before use',async()=>{
 const tools=[];let calls=0;await registerDshTools({tools:{register:t=>tools.push(t),presentAs:()=>{throw Error('The preset already owns tool presentation');}}},{defineTool:x=>x,definitions:[['save','Save',{ids:{type:'array',items:{type:'string'},required:true}},{type:'object',required:['saved']}]],execute:async()=>{calls++;return {saved:true};}});
 const execution={agent:{id:'s'},signal:new AbortController().signal};
 await assert.rejects(tools[0].execute({ids:{}},execution),e=>e.code==='INVALID_ARGUMENTS');assert.equal(calls,0);
 assert.equal(await tools[0].execute({ids:['record']},execution),'{"saved":true}');
 await assert.rejects(tools[0].execute({ids:[]},{}),e=>e.code==='INVALID_CALLER');
});
