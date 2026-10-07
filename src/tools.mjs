// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {check,AugmentorError,canonicalJSON} from './errors.mjs';
import {parameterSchema,compileSchema,schemaErrors} from './schema.mjs';

/** One application tool contract for harness adapters. Framework ownership stays in Augmentor. */
export function createApplicationTools({definitions,execute}) {
  check(Array.isArray(definitions) && typeof execute==='function','INVALID_TOOL','Tool definitions and an executor are required');
  const validators=new Map(),tools=[];
  for(const [name,description,parameters,outputSchema] of definitions){
    check(/^[A-Za-z][A-Za-z0-9_]{0,127}$/.test(name)&&!validators.has(name),'INVALID_TOOL','Invalid or duplicate tool name');
    // Nested objects, arrays and unions keep their required fields (legacy or JSON Schema style).
    const inputSchema=parameterSchema(parameters);
    validators.set(name,{input:compileSchema(inputSchema,name+' parameters'),output:outputSchema?compileSchema(outputSchema,name+' output'):null});
    tools.push({name,description,inputSchema,...(outputSchema?{outputSchema}:{})});
  }
  return {tools,async execute(name,args,execution){
    const validator=validators.get(name);
    check(validator,'PERMISSION_DENIED','Application tool is not declared');
    const sessionId=execution?.sessionId??execution?.agent?.id;
    check(typeof sessionId==='string'&&sessionId.length>0,'INVALID_CALLER','An owning Augmentor session is required');
    execution.signal?.throwIfAborted();
    check(validator.input(args),'INVALID_ARGUMENTS','Tool arguments do not match their declared schema',{errors:schemaErrors(validator.input.errors)});
    const value=await execute(name,args,execution);
    check(!validator.output||validator.output(value),'INVALID_OUTPUT','Application returned an invalid tool result');
    return value;
  }};
}

export function createToolClient({url,tokenFile,timeoutMs=25000,maxBytes=4*1024*1024,fetchImpl=fetch}){
  const target=new URL(url);
  check(!target.username&&!target.password&&!target.hash&&(target.protocol==='https:'||(target.protocol==='http:'&&['127.0.0.1','[::1]','localhost'].includes(target.hostname))),'INVALID_ENDPOINT','Use HTTPS or a private loopback tool endpoint');
  return async(name,args,execution)=>{
    const sessionId=execution?.sessionId??execution?.agent?.id;
    check(typeof sessionId==='string'&&sessionId.length>0&&typeof execution?.callId==='string'&&execution.callId.length>0,'INVALID_CALLER','A session and tool call ID are required');
    const operationId=createHash('sha256').update(canonicalJSON([sessionId,execution.callId,name])).digest('hex');
    const signal=AbortSignal.any([AbortSignal.timeout(timeoutMs),...execution.signal?[execution.signal]:[]]);
    let token,response;
    // Nothing has been sent yet, so a missing credential is a definite failure, not an unknown outcome.
    try{token=readFileSync(tokenFile,'utf8').trim();}catch{throw new AugmentorError('CONFIGURATION_UNAVAILABLE','The application tool credential is unavailable; nothing was sent',{operationId});}
    try{response=await fetchImpl(target,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({name,args,sessionId,eventId:operationId,operationId}),signal,redirect:'error'});}catch{throw new AugmentorError('UNKNOWN_OUTCOME','Tool response was not confirmed; the SDK did not retry',{operationId});}
    const chunks=[];let bytes=0;
    try{for await(const chunk of response.body){bytes+=chunk.length;check(bytes<=maxBytes,'RESPONSE_TOO_LARGE','Paginate application tool results',{operationId});chunks.push(chunk);}}
    catch(error){if(error instanceof AugmentorError)throw error;throw new AugmentorError('UNKNOWN_OUTCOME','Tool response was interrupted; the SDK did not retry',{operationId});}
    const raw=Buffer.concat(chunks).toString();let value=null;
    if(raw.trim()){try{value=JSON.parse(raw);}catch{
      if(!response.ok)throw new AugmentorError('APPLICATION_ERROR','Application request failed',{operationId,status:response.status});
      throw new AugmentorError('INVALID_RESPONSE','Application response was not valid JSON',{operationId,status:response.status});}}
    if(!response.ok)throw new AugmentorError(typeof value?.code==='string'?value.code:'APPLICATION_ERROR',typeof value?.error==='string'?value.error:'Application request failed',{operationId,status:response.status,...(value?.details&&typeof value.details==='object'?{details:value.details}:{})});
    return value;
  };
}
