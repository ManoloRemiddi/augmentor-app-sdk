// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
import {createRequire} from 'node:module';
import {realpathSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import Ajv from 'ajv';
import {check,AugmentorError,canonicalJSON} from './errors.mjs';
function jsonSchema(spec) {
  const {required,description,...rest}=spec;
  if(spec.type==='json')return description?{description}:{};
  if(spec.type==='array')return {...rest,...description?{description}:{},items:spec.items?jsonSchema(spec.items):{}};
  return {...rest,...description?{description}:{}};
}
export async function registerDshTools(ctx,{definitions,execute,defineTool:factory}) {
  if(!factory){const require=createRequire(realpathSync(process.argv[1]));factory=(await import(require.resolve('@deepseek-ai/dsh-tools'))).defineTool;}
  const ajv=new Ajv({allErrors:true,strict:false}),names=new Set();
  for(const [name,description,parameters,outputSchema] of definitions){
    check(/^[A-Za-z][A-Za-z0-9_]{0,127}$/.test(name)&&!names.has(name),'INVALID_TOOL','Invalid or duplicate tool name');names.add(name);
    const validate=ajv.compile({type:'object',properties:Object.fromEntries(Object.entries(parameters).map(([k,v])=>[k,jsonSchema(v)])),required:Object.entries(parameters).filter(([,v])=>v.required).map(([k])=>k),additionalProperties:false});
    const validateOutput=outputSchema?ajv.compile(outputSchema):null;
    ctx.tools.register(factory({name,description,parameters,output:{schema:{type:'string'},render:(_args,value)=>[{type:'text',text:value}]},
      async execute(args,execution){
        check(execution.agent?.id,'INVALID_CALLER','An owning DSH session is required');execution.signal?.throwIfAborted();
        check(validate(args),'INVALID_ARGUMENTS','Tool arguments do not match their declared schema',{errors:validate.errors});
        const value=await execute(name,args,execution);
        check(!validateOutput||validateOutput(value),'INVALID_OUTPUT','Application returned an invalid tool result');
        return JSON.stringify(value);
      }}));
  }
  // The Augmentor preset owns presentation. DSH rejects a second declaration,
  // including an identical mode, in the same composition.
}
export function createToolClient({url,tokenFile,timeoutMs=25000,maxBytes=4*1024*1024,fetchImpl=fetch}){
  const target=new URL(url);
  check(!target.username&&!target.password&&!target.hash&&(target.protocol==='https:'||(target.protocol==='http:'&&['127.0.0.1','[::1]','localhost'].includes(target.hostname))),'INVALID_ENDPOINT','Use HTTPS or a private loopback tool endpoint');
  return async(name,args,execution)=>{
    check(execution.agent?.id&&typeof execution.callId==='string','INVALID_CALLER','A DSH session and tool call ID are required');
    const operationId=createHash('sha256').update(canonicalJSON([execution.agent.id,execution.callId,name])).digest('hex');
    const signal=AbortSignal.any([AbortSignal.timeout(timeoutMs),...execution.signal?[execution.signal]:[]]);
    let response;
    try{response=await fetchImpl(target,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+readFileSync(tokenFile,'utf8').trim()},body:JSON.stringify({name,args,sessionId:execution.agent.id,eventId:operationId,operationId}),signal,redirect:'error'});}catch{throw new AugmentorError('UNKNOWN_OUTCOME','Tool response was not confirmed; the SDK did not retry',{operationId});}
    const chunks=[];let bytes=0;for await(const chunk of response.body){bytes+=chunk.length;check(bytes<=maxBytes,'RESPONSE_TOO_LARGE','Paginate application tool results');chunks.push(chunk);}
    let value;try{value=JSON.parse(Buffer.concat(chunks).toString());}catch{throw new AugmentorError('INVALID_RESPONSE','Application response was not valid JSON',{operationId});}
    if(!response.ok)throw new AugmentorError(value.code||'APPLICATION_ERROR',value.error||'Application request failed',{operationId,status:response.status});
    return value;
  };
}
