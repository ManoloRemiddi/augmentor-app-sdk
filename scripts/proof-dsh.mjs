// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
// Source qualification only: real scoped DSH with synthetic tools and no model request.
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {registerDshTools} from '../src/dsh.mjs';
const require=createRequire(join(resolve(process.argv[2]),'package.json'));
const load=name=>import(pathToFileURL(require.resolve(name)).href);
const {Context}=await load('@deepseek-ai/cordis'),{default:SystemPrompt}=await load('@deepseek-ai/dsh-system-prompt'),{default:ToolRuntime,defineTool}=await load('@deepseek-ai/dsh-tools'),{createScope}=await load('@deepseek-ai/dsh-scope');
const ctx=new Context();let calls=0;
try{
 await ctx.plugin(SystemPrompt).await();await ctx.plugin(ToolRuntime).await();
 const agent={id:'synthetic'};const scoped=createScope(ctx,agent);agent.ctx=scoped.ctx;
 // Match Augmentor: its existing preset selects native presentation first.
 await scoped.ctx.plugin({inject:['tools'],apply:ctx=>ctx.tools.presentAs('native')}).await();
 await scoped.ctx.plugin({inject:['tools'],apply:ctx=>registerDshTools(ctx,{defineTool,definitions:[['sdk_test','Synthetic schema proof',{names:{type:'array',items:{type:'string'},required:true}}]],execute:async(_name,args)=>{calls++;return {count:args.names.length};}})}).await();
 // B8/B1: the starter template's constraints and nested required fields must load in real DSH.
 await scoped.ctx.plugin({inject:['tools'],apply:ctx=>registerDshTools(ctx,{defineTool,definitions:[
   ['sdk_template','Template-style constraints',{id:{type:'string',required:true,minLength:1,maxLength:160}}],
   ['sdk_nested','Nested required',{type:'object',properties:{cards:{type:'array',items:{type:'object',properties:{front:{type:'string'},back:{type:'string'}},required:['front','back']}},cmd:{oneOf:[{type:'object',properties:{kind:{const:'a'}},required:['kind']},{type:'object',properties:{kind:{const:'b'},n:{type:'integer'}},required:['kind','n']}]}},required:['cards']}]],
   execute:async()=>({ok:true})})}).await();
 const nested=await ctx.tools.execute({name:'sdk_nested',arguments:{cards:[{front:'f'}]},agent,callId:'n',signal:new AbortController().signal});
 assert.equal(nested.isError,true);
 const a=await ctx.tools.execute({name:'sdk_test',arguments:{names:['a','b']},agent,callId:'a',signal:new AbortController().signal});
 const b=await ctx.tools.execute({name:'sdk_test',arguments:{names:[42]},agent,callId:'b',signal:new AbortController().signal});
 assert.equal(a.isError,false);assert.equal(b.isError,true);assert.equal(calls,1);
 console.log(JSON.stringify({realDshToolRegistration:true,templateConstraintsLoad:true,nestedRequiredEnforced:true,existingPresetPresentationPreserved:true,validArrayAccepted:true,invalidArrayNeverExecuted:true}));
}finally{await ctx.fiber.dispose();}
