#!/usr/bin/env node
// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
import {readFileSync,writeFileSync,mkdirSync,existsSync,mkdtempSync,rmSync,chmodSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {resolve,dirname,join,isAbsolute} from 'node:path';
import {homedir,tmpdir} from 'node:os';
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {validateManifest,validateApplication,workspaceProfile} from '../src/manifest.mjs';
import {discoverRuntime,runtimeLaunch} from '../src/runtime.mjs';
import {runtimePaths} from '../src/platform.mjs';
import {scaffold,scaffoldApp} from '../src/scaffold.mjs';
import {check} from '../src/errors.mjs';
import {createToolkit} from '../src/toolkit.mjs';
import {checkToolkit} from '../src/testing.mjs';
import {GRANTS} from '../src/app.mjs';
const usage = `Augmentor App SDK (DSH or experimental Codex / augmentor-app/1)
  --help | --version
  init [directory] [--id app-id] [--name "App name"] [--harness dsh|codex] [--template minimal|app]
  validate manifest.json [--schema-only]
  doctor [runtime-descriptor] [--harness dsh|codex] [--runtime-root installed-root]
  plan manifest.json private-install.json
  register manifest.json private-install.json
  manifest app-definition.mjs [--out app-root]
  check app-definition.mjs
  describe app-definition.mjs [--format markdown|llms]
  bundle destination.mjs | bundle --verify vendored.mjs

init writes an integration scaffold; it never registers or starts a runtime.
validate checks the schema and referenced files without importing tool modules.
doctor checks the selected descriptor, not running services or model readiness.
plan previews identity and grants without writing credentials or profiles.
register changes private workspace/preset configuration; it does not restart services.
manifest imports your defineApp() module (it must not start servers) and writes
augmentor.app.json plus the runtime tool descriptors (tools.json) beside the tool module.
check reports drift between the definition, manifest and descriptors, and instruction
files that mention tools the workspace does not declare or grant.
describe prints a generated reference (markdown) or llms.txt.
bundle copies the single-file browser module with a version stamp, or verifies a copy.
Use the local CLI from your installed package. Read docs/AGENT-INTEGRATION.md.`;
const [command,...args]=process.argv.slice(2);
const readJSON = file => {
  const source=readFileSync(resolve(file),'utf8');
  try {return JSON.parse(source);}
  catch {check(false,'INVALID_JSON',`Invalid JSON in ${file}; file contents withheld`);}
};
function installation(manifestPath, optionsPath) {
  check(manifestPath && optionsPath, 'INVALID_REQUEST', 'Provide manifest.json and private-install.json');
  const manifestFile=resolve(manifestPath),options=readJSON(optionsPath);
  const keys=['origin','toolConfig','root','descriptor','runtimeRoot','id','preset','memory','legacyPresets','tokenFile','connection'];
  check(options && typeof options === 'object' && !Array.isArray(options) && Object.keys(options).every(key=>keys.includes(key)),
    'INVALID_INSTALL', 'Unknown installation option; see docs/QUICKSTART.md');
  check(!options.root || isAbsolute(options.root), 'INVALID_INSTALL', 'Installation root must be absolute');
  check(!options.descriptor || isAbsolute(options.descriptor), 'INVALID_INSTALL', 'Runtime descriptor must be absolute');
  check(!options.runtimeRoot || isAbsolute(options.runtimeRoot), 'INVALID_INSTALL', 'Installed runtime root must be absolute');
  check(!(options.descriptor&&options.runtimeRoot),'INVALID_INSTALL','Choose a runtime descriptor or installed runtime root');
  const root=options.root||dirname(manifestFile),manifest=validateApplication(readJSON(manifestFile),{root});
  const config=options.toolConfig;
  check(config === undefined || (config && typeof config === 'object' && !Array.isArray(config) &&
    Object.entries(config).every(([id,value])=>manifest.tools.some(tool=>tool.id===id) &&
      value && typeof value==='object' && !Array.isArray(value))),
    'INVALID_INSTALL','toolConfig must map declared plugin IDs to configuration objects');
  const profiles=runtimePaths().profiles;
  const tokenFile=options.tokenFile||join(profiles,(options.id||manifest.id)+'.token');
  return {manifest,options,tokenFile,profile:workspaceProfile(manifest,{...options,root,tokenFile})};
}
async function main(){
  if(!command || ['--help','-h','help'].includes(command)){console.log(usage);return;}
  if(command==='--version'){console.log(JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).version);return;}
  if(command==='doctor'){
    const options={};let index=0;
    if(args[0]&&!args[0].startsWith('--'))options.descriptor=args[index++];
    while(index<args.length){const flag=args[index++],value=args[index++];
      check(['--harness','--runtime-root'].includes(flag)&&value&&!value.startsWith('--'),'INVALID_REQUEST','Usage: augmentor-app doctor [runtime-descriptor] [--harness dsh|codex] [--runtime-root installed-root]');
      const key=flag==='--harness'?'harness':'runtimeRoot';check(!Object.hasOwn(options,key),'INVALID_REQUEST','Repeated doctor option');options[key]=value;
    }
    check(!(options.descriptor&&options.runtimeRoot),'INVALID_REQUEST','Choose a runtime descriptor or installed runtime root');
    const runtime=await discoverRuntime(options);
    console.log(JSON.stringify({compatible:true,checkLevel:'selected-runtime-descriptor',
      runningServicesVerified:false,protocol:runtime.contract.protocol,harnesses:runtime.contract.harnesses,
      voice:runtime.contract.voice},null,2));return;
  }
  if(command==='validate'){
    check(args.length>=1 && args.length<=2 && (!args[1] || args[1]==='--schema-only'),
      'INVALID_REQUEST','Usage: augmentor-app validate manifest.json [--schema-only]');
    const manifest=readJSON(args[0]);
    if(args[1])validateManifest(manifest);else validateApplication(manifest,{root:dirname(resolve(args[0]))});
    console.log(args[1]?'Manifest schema is valid; referenced files were not checked':
      'Manifest and referenced files are valid for '+manifest.harness+' / augmentor-app/1; tool modules were not executed');return;
  }
  if(command==='plan' || command==='register'){
    check(args.length===2,'INVALID_REQUEST',`Usage: augmentor-app ${command} manifest.json private-install.json`);
    const {manifest,options,tokenFile:plannedTokenFile,profile}=installation(...args);
    let tokenFile=plannedTokenFile;
    if(command==='plan'){
      // Intentionally omit token paths and toolConfig, which may contain secrets.
      console.log(JSON.stringify({action:'register',readOnly:true,protocol:profile.sdkProtocol,
        id:profile.id,preset:profile.preset,harness:profile.harness,cwd:profile.cwd,memory:profile.memory,origin:profile.parentOrigin,
        instructions:manifest.instructions,tools:manifest.tools,grants:profile.policy.tools,
        voiceEnabled:profile.policy.voice,sharedSettings:false,
        runtimeVerified:false,credentialsVerified:false},null,2));return;
    }
    const runtime=await discoverRuntime({descriptor:options.descriptor,runtimeRoot:options.runtimeRoot,harness:manifest.harness});
    if(!options.tokenFile&&runtime.environment){
      tokenFile=join(runtimePaths({env:{...process.env,...runtime.environment}}).profiles,profile.id+'.token');
      profile.accessTokenFile=tokenFile;
    }
    const launch=runtimeLaunch(runtime,'register');
    const protect=(action,path)=>{
      const script=join(runtime.root,'scripts/app-sdk-private.py');
      check(existsSync(script),'INCOMPATIBLE_RUNTIME','SDK registration on this platform requires the product private-files adapter');
      const child=spawnSync(runtime.python,['-I','-B',script,action,path],{env:launch.env,windowsHide:true,encoding:'utf8',timeout:15000});
      check(!child.error&&child.status===0,'PRIVATE_PATH_UNAVAILABLE','The product could not verify owner-only SDK state');
    };
    if(process.platform==='win32'||existsSync(join(runtime.root,'scripts/app-sdk-private.py')))protect('token',tokenFile);
    else {
      mkdirSync(dirname(tokenFile),{recursive:true,mode:0o700});
      if(!existsSync(tokenFile))writeFileSync(tokenFile,randomBytes(32).toString('hex')+'\n',{mode:0o600,flag:'wx'});chmodSync(tokenFile,0o600);
    }
    const temp=process.platform==='win32'?join(runtime.environment?.XDG_STATE_HOME||dirname(tokenFile),'sdk-register-'+randomBytes(16).toString('hex')):
      mkdtempSync(join(tmpdir(),'augmentor-app-register-'));
    try{
      if(process.platform==='win32')protect('directory',temp);
      const input=join(temp,'profile.json');writeFileSync(input,JSON.stringify(profile),{mode:0o600});
      const child=spawnSync(launch.command,[...launch.args,input],{stdio:'inherit',env:launch.env,windowsHide:true});
      if(child.error)throw child.error;if(child.status!==0)throw Error('Profile installation failed; services were not restarted');
    }finally{rmSync(temp,{recursive:true,force:true});}
    return;
  }
  if(['manifest','check','describe'].includes(command)){
    check(args[0]&&!args[0].startsWith('--'),'INVALID_REQUEST',`Usage: augmentor-app ${command} app-definition.mjs`);
    const definitionFile=resolve(args[0]);
    const mod=await import(pathToFileURL(definitionFile).href);
    const app=mod.default??mod.app;
    check(app?.kind==='app','INVALID_REQUEST','The module must export defineApp() as default or as `app`');
    const option=name=>{const i=args.indexOf(name);return i>0?args[i+1]:undefined;};
    if(command==='describe'){
      const format=option('--format')||'markdown';
      check(['markdown','llms'].includes(format),'INVALID_REQUEST','Format is markdown or llms');
      if(format==='markdown'){console.log(app.reference());return;}
      const d=app.descriptors();
      console.log([`# ${app.name}`,'',`> ${app.description||app.name+' exposes its features to the Augmentor agent.'}`,'','## Tools','',...d.tools.map(t=>`- ${t.name}: ${t.description.split('\n')[0]} (${t.effect}${t.approval!=='never'?', needs approval':''})`),'','## Prompts','',...app.prompts.list().map(p=>`- ${p.id}: ${p.title}`)].join('\n'));return;
    }
    // Manifest paths are relative to the application root: run from there or pass --out.
    const root=resolve(option('--out')||'.');
    const manifest=app.manifest(),descriptors=app.descriptors();
    const toolsJson=join(root,dirname(manifest.tools[0].module),'tools.json'),manifestFile=join(root,'augmentor.app.json');
    if(command==='manifest'){
      mkdirSync(dirname(toolsJson),{recursive:true});
      writeFileSync(manifestFile,JSON.stringify(manifest,null,2)+'\n');writeFileSync(toolsJson,JSON.stringify(descriptors,null,2)+'\n');
      console.log(`Wrote augmentor.app.json (${manifest.tools[0].names.length} tools, ${manifest.permissions.tools.length} product grants) and ${relativePath(root,toolsJson)} (fingerprint ${descriptors.fingerprint.slice(0,12)}). Re-register and restart Augmentor to load changed tools.`);return;
    }
    const problems=[],warnings=[];
    const read=file=>{try{return JSON.parse(readFileSync(file,'utf8'));}catch{return null;}};
    const current=read(manifestFile),currentTools=read(toolsJson);
    if(!current)problems.push('augmentor.app.json is missing; run augmentor-app manifest');
    else if(JSON.stringify(current)!==JSON.stringify(manifest))problems.push('augmentor.app.json differs from the definition; run augmentor-app manifest');
    if(!currentTools)problems.push(`${relativePath(root,toolsJson)} is missing; run augmentor-app manifest`);
    else if(currentTools.fingerprint!==descriptors.fingerprint)problems.push(`${relativePath(root,toolsJson)} is stale (tool definitions changed); run augmentor-app manifest, then re-register`);
    for(const p of checkToolkit(createToolkit({tools:app.allTools(),proposals:{}})))warnings.push(p);
    const declared=new Set([...descriptors.tools.map(t=>t.name),...manifest.permissions.tools]);
    const productTools=new Set([...Object.values(GRANTS).flat(),'bash','fs_read','fs_write','fs_search','str_replace_editor','job_output','job_list','job_kill']);
    for(const file of manifest.instructions){
      let text='';try{text=readFileSync(join(root,file),'utf8');}catch{problems.push(`Instruction file ${file} is missing`);continue;}
      for(const name of new Set(text.match(/\b[a-z][a-z0-9]*_[a-z0-9_]+\b/g)||[])){
        if(declared.has(name))continue;
        if(name.startsWith(app.prefix+'_'))problems.push(`${file} mentions ${name}, which the app does not declare`);
        else if(productTools.has(name))warnings.push(`${file} mentions ${name}, which this workspace does not grant`);
      }
    }
    for(const w of warnings)console.log('warning: '+w);
    for(const p of problems)console.error('error: '+p);
    if(problems.length){process.exitCode=1;return;}
    console.log(`${app.id}: definition, manifest and descriptors agree (${descriptors.tools.length} tools, fingerprint ${descriptors.fingerprint.slice(0,12)})`);return;
  }
  if(command==='bundle'){
    const source=readFileSync(new URL('../dist/augmentor-browser.mjs',import.meta.url),'utf8');
    const digest=createHash('sha256').update(source).digest('hex');
    if(args[0]==='--verify'){
      check(args[1],'INVALID_REQUEST','Usage: augmentor-app bundle --verify vendored.mjs');
      const copy=readFileSync(resolve(args[1]),'utf8');
      const stamp=/^\/\/ augmentor-app-sdk-bundle sha256=([a-f0-9]{64}) version=(\S+)\n/.exec(copy);
      check(stamp,'BUNDLE_UNSTAMPED','This file was not produced by augmentor-app bundle');
      const body=copy.slice(stamp[0].length);
      check(createHash('sha256').update(body).digest('hex')===stamp[1],'BUNDLE_MODIFIED',`The vendored bundle was edited after it was stamped (version ${stamp[2]})`);
      check(stamp[1]===digest,'BUNDLE_STALE',`The vendored bundle is ${stamp[2]}; this SDK ships a different build`);
      console.log(`Vendored bundle matches this SDK (${stamp[2]})`);return;
    }
    check(args.length===1&&!args[0].startsWith('--'),'INVALID_REQUEST','Usage: augmentor-app bundle destination.mjs');
    const version=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).version;
    mkdirSync(dirname(resolve(args[0])),{recursive:true});
    writeFileSync(resolve(args[0]),`// augmentor-app-sdk-bundle sha256=${digest} version=${version}\n`+source);
    console.log(`Wrote ${args[0]} (${version}). Serve it to the owner's pages; verify later with augmentor-app bundle --verify.`);return;
  }
  if(command==='init'){
    let directory='.',index=0;const options={};
    if(args[0] && !args[0].startsWith('--'))directory=args[index++];
    while(index<args.length){
      const flag=args[index++],value=args[index++];
      check(['--id','--name','--harness','--template'].includes(flag) && value && !value.startsWith('--') && !Object.hasOwn(options,flag.slice(2)),
        'INVALID_REQUEST','Usage: augmentor-app init [directory] [--id app-id] [--name "App name"] [--harness dsh|codex] [--template minimal|app]');
      options[flag.slice(2)]=value;
    }
    const {template='minimal',...rest}=options;
    check(['minimal','app'].includes(template),'INVALID_REQUEST','Template is minimal or app');
    const result=template==='app'?await scaffoldApp(directory,rest):scaffold(directory,rest);
    console.log(`Created ${result.files.length} integration files for ${result.id}. Read augmentor/INTEGRATION.md. No runtime or credentials changed.`);return;
  }
  throw Error(usage);
}
const relativePath=(from,to)=>to.startsWith(from+'/')?to.slice(from.length+1):to;
main().catch(error=>{
  console.error(error.code?error.code+': '+error.message:error.message);
  for(const detail of error.details?.errors||[])console.error(`  ${detail.instancePath||'/'}: ${detail.message}`);
  process.exitCode=1;
});
