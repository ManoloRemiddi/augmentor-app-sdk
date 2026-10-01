#!/usr/bin/env node
// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
import {readFileSync,writeFileSync,mkdirSync,existsSync,mkdtempSync,rmSync,chmodSync} from 'node:fs';
import {resolve,dirname,join,isAbsolute} from 'node:path';
import {homedir,tmpdir} from 'node:os';
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {validateManifest,validateApplication,workspaceProfile} from '../src/manifest.mjs';
import {discoverRuntime} from '../src/runtime.mjs';
import {scaffold} from '../src/scaffold.mjs';
import {check} from '../src/errors.mjs';
const usage = `Augmentor App SDK (DSH / augmentor-app/1)
  --help | --version
  init [directory] [--id app-id] [--name "App name"]
  validate manifest.json [--schema-only]
  doctor [runtime-descriptor]
  plan manifest.json private-install.json
  register manifest.json private-install.json

init writes an integration scaffold; it never registers or starts a runtime.
validate checks the schema and referenced files without importing tool modules.
doctor checks the selected descriptor, not running services or model readiness.
plan previews identity and grants without writing credentials or profiles.
register changes private workspace/preset configuration; it does not restart services.
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
  const keys=['origin','toolConfig','root','descriptor','id','preset','memory','legacyPresets','tokenFile'];
  check(options && typeof options === 'object' && !Array.isArray(options) && Object.keys(options).every(key=>keys.includes(key)),
    'INVALID_INSTALL', 'Unknown installation option; see docs/QUICKSTART.md');
  check(!options.root || isAbsolute(options.root), 'INVALID_INSTALL', 'Installation root must be absolute');
  check(!options.descriptor || isAbsolute(options.descriptor), 'INVALID_INSTALL', 'Runtime descriptor must be absolute');
  const root=options.root||dirname(manifestFile),manifest=validateApplication(readJSON(manifestFile),{root});
  const config=options.toolConfig;
  check(config === undefined || (config && typeof config === 'object' && !Array.isArray(config) &&
    Object.entries(config).every(([id,value])=>manifest.tools.some(tool=>tool.id===id) &&
      value && typeof value==='object' && !Array.isArray(value))),
    'INVALID_INSTALL','toolConfig must map declared plugin IDs to configuration objects');
  const profiles=process.env.AUGMENTOR_WORKSPACE_PROFILES||join(process.env.XDG_CONFIG_HOME||join(homedir(),'.config'),'augmentor/workspaces');
  const tokenFile=options.tokenFile||join(profiles,(options.id||manifest.id)+'.token');
  return {manifest,options,tokenFile,profile:workspaceProfile(manifest,{...options,root,tokenFile})};
}
async function main(){
  if(!command || ['--help','-h','help'].includes(command)){console.log(usage);return;}
  if(command==='--version'){console.log(JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).version);return;}
  if(command==='doctor'){
    check(args.length<=1,'INVALID_REQUEST','Usage: augmentor-app doctor [runtime-descriptor]');
    const runtime=await discoverRuntime({descriptor:args[0]});
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
      'Manifest and referenced files are valid for DSH / augmentor-app/1; tool modules were not executed');return;
  }
  if(command==='plan' || command==='register'){
    check(args.length===2,'INVALID_REQUEST',`Usage: augmentor-app ${command} manifest.json private-install.json`);
    const {manifest,options,tokenFile,profile}=installation(...args);
    if(command==='plan'){
      // Intentionally omit token paths and toolConfig, which may contain secrets.
      console.log(JSON.stringify({action:'register',readOnly:true,protocol:profile.sdkProtocol,
        id:profile.id,preset:profile.preset,cwd:profile.cwd,memory:profile.memory,origin:profile.parentOrigin,
        instructions:manifest.instructions,tools:manifest.tools,grants:profile.policy.tools,
        voiceEnabled:profile.policy.voice,sharedSettings:false,
        runtimeVerified:false,credentialsVerified:false},null,2));return;
    }
    const runtime=await discoverRuntime({descriptor:options.descriptor});
    mkdirSync(dirname(tokenFile),{recursive:true,mode:0o700});
    if(!existsSync(tokenFile))writeFileSync(tokenFile,randomBytes(32).toString('hex')+'\n',{mode:0o600,flag:'wx'});chmodSync(tokenFile,0o600);
    const temp=mkdtempSync(join(tmpdir(),'augmentor-app-register-'));
    try{
      const input=join(temp,'profile.json');writeFileSync(input,JSON.stringify(profile),{mode:0o600});
      const child=spawnSync(runtime.node,[join(runtime.root,'scripts/install-workspace-profile.mjs'),input],{stdio:'inherit'});
      if(child.error)throw child.error;if(child.status!==0)throw Error('Profile installation failed; services were not restarted');
    }finally{rmSync(temp,{recursive:true,force:true});}
    return;
  }
  if(command==='init'){
    let directory='.',index=0;const options={};
    if(args[0] && !args[0].startsWith('--'))directory=args[index++];
    while(index<args.length){
      const flag=args[index++],value=args[index++];
      check(['--id','--name'].includes(flag) && value && !value.startsWith('--') && !Object.hasOwn(options,flag.slice(2)),
        'INVALID_REQUEST','Usage: augmentor-app init [directory] [--id app-id] [--name "App name"]');
      options[flag.slice(2)]=value;
    }
    const result=scaffold(directory,options);
    console.log(`Created ${result.files.length} integration files for ${result.id}. Read augmentor/INTEGRATION.md. No runtime or credentials changed.`);return;
  }
  throw Error(usage);
}
main().catch(error=>{
  console.error(error.code?error.code+': '+error.message:error.message);
  for(const detail of error.details?.errors||[])console.error(`  ${detail.instancePath||'/'}: ${detail.message}`);
  process.exitCode=1;
});
