// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,mkdirSync,existsSync,rmSync,symlinkSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const cli=fileURLToPath(new URL('../bin/augmentor-app.mjs',import.meta.url));
function fixture(t){
  const root=mkdtempSync(join(tmpdir(),'sdk-cli-'));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  const run=(...args)=>spawnSync(process.execPath,[cli,...args],{cwd:root,encoding:'utf8',env:{...process.env,
    XDG_CONFIG_HOME:join(root,'config'),XDG_DATA_HOME:join(root,'data'),AUGMENTOR_WORKSPACE_PROFILES:join(root,'profiles')}});
  return {root,run};
}
test('help describes limits and reports bad arguments without writing state',t=>{
  const {root,run}=fixture(t);assert.match(run('--help').stdout,/not running services/);
  assert.match(run('--version').stdout,/^0\.1\.0-preview\.\d+\n$/);
  assert.equal(run('init','.','--bogus','x').status,1);assert.deepEqual(readdirSync(root),[]);
});
test('init creates coherent files for a maximum-length ID, avoids extra grants and leaves private state absent',t=>{
  const {root,run}=fixture(t),id='a'.repeat(64);
  const result=run('init','.','--id',id,'--name','A "quoted" app');assert.equal(result.status,0,result.stderr);
  const manifest=JSON.parse(readFileSync(join(root,'augmentor.app.json')));
  assert.equal(manifest.id,id);assert.deepEqual(manifest.permissions.tools,[]);assert.equal(manifest.voice.enabled,false);
  assert.equal(manifest.tools[0].id.length,64);assert.equal(run('validate','augmentor.app.json').status,0);
  assert.equal(existsSync(join(root,'augmentor/private')),false);assert.equal(existsSync(join(root,'profiles')),false);
});
test('init refuses a late file collision before writing a manifest and refuses symlink output directories',t=>{
  const {root,run}=fixture(t);mkdirSync(join(root,'augmentor'));writeFileSync(join(root,'augmentor/tools.mjs'),'owner work');
  let result=run('init','.');assert.equal(result.status,1);assert.match(result.stderr,/SCAFFOLD_CONFLICT/);
  assert.equal(existsSync(join(root,'augmentor.app.json')),false);assert.equal(readFileSync(join(root,'augmentor/tools.mjs'),'utf8'),'owner work');
  mkdirSync(join(root,'other'));mkdirSync(join(root,'destination'));symlinkSync(join(root,'destination'),join(root,'other/augmentor'));
  result=run('init','other');assert.equal(result.status,1);assert.deepEqual(readdirSync(join(root,'destination')),[]);
});
test('validate checks missing, directory and escaping files without executing tools; schema errors are actionable',t=>{
  const {root,run}=fixture(t);assert.equal(run('init','.').status,0);
  const manifest=JSON.parse(readFileSync(join(root,'augmentor.app.json')));
  writeFileSync(join(root,'augmentor/tools.mjs'),"throw Error('validation must not execute me')");
  assert.equal(run('validate','augmentor.app.json').status,0);
  for(const path of ['missing.md','augmentor']){
    writeFileSync(join(root,'augmentor.app.json'),JSON.stringify({...manifest,instructions:[path]}));
    assert.equal(run('validate','augmentor.app.json').status,1);
    assert.equal(run('validate','augmentor.app.json','--schema-only').status,0);
  }
  symlinkSync(cli,join(root,'escape.mjs'));
  writeFileSync(join(root,'augmentor.app.json'),JSON.stringify({...manifest,instructions:['escape.mjs']}));
  assert.match(run('validate','augmentor.app.json').stderr,/escapes/);
  writeFileSync(join(root,'augmentor.app.json'),JSON.stringify({...manifest,harness:'unsupported'}));
  assert.match(run('validate','augmentor.app.json').stderr,/\/harness:/);
});
test('plan reveals intended grants while keeping secrets private and creates no installation state',t=>{
  const {root,run}=fixture(t);assert.equal(run('init','.','--id','record-desk').status,0);
  const options={origin:'http://127.0.0.1:8000',tokenFile:join(root,'secret-proxy.token'),
    toolConfig:{'record-desk-tools':{token:'do-not-print-fixture-secret',url:'http://127.0.0.1:8000/api/augmentor/tool'}}};
  writeFileSync(join(root,'install.json'),JSON.stringify(options));
  const result=run('plan','augmentor.app.json','install.json');assert.equal(result.status,0,result.stderr);
  const plan=JSON.parse(result.stdout);assert.deepEqual(plan.grants,['record_desk_read_record']);assert.equal(plan.readOnly,true);
  assert.equal(plan.preset,'augmentor-record-desk');assert.equal(plan.runtimeVerified,false);
  assert.doesNotMatch(result.stdout,/do-not-print-fixture-secret|secret-proxy/);
  assert.equal(existsSync(options.tokenFile),false);assert.equal(existsSync(join(root,'profiles')),false);
  writeFileSync(join(root,'install.json'),JSON.stringify({...options,toolConfig:{typo:{token:'do-not-print-fixture-secret'}}}));
  assert.match(run('plan','augmentor.app.json','install.json').stderr,/declared plugin IDs/);
  writeFileSync(join(root,'install.json'),JSON.stringify({...options,orgin:options.origin}));
  assert.match(run('plan','augmentor.app.json','install.json').stderr,/Unknown installation option/);
  writeFileSync(join(root,'install.json'),'do-not-print-fixture-secret');
  const invalid=run('plan','augmentor.app.json','install.json');
  assert.match(invalid.stderr,/INVALID_JSON/);assert.doesNotMatch(invalid.stderr,/do-not-print-fixture-secret/);
});
test('doctor only establishes the selected contract and register fails before token creation without runtime',t=>{
  const {root,run}=fixture(t);assert.equal(run('init','.').status,0);
  const token=join(root,'not-created.token');writeFileSync(join(root,'install.json'),JSON.stringify({origin:'http://127.0.0.1:8000',tokenFile:token}));
  assert.equal(run('register','augmentor.app.json','install.json').status,1);assert.equal(existsSync(token),false);
  mkdirSync(join(root,'runtime/services/workspaces'),{recursive:true});
  writeFileSync(join(root,'runtime/services/workspaces/sdk.json'),JSON.stringify({protocol:'augmentor-app/1',harnesses:['dsh']}));
  writeFileSync(join(root,'descriptor.json'),JSON.stringify({root:join(root,'runtime'),node:process.execPath,python:'/usr/bin/python3'}));
  const result=run('doctor','descriptor.json');assert.equal(result.status,0,result.stderr);
  assert.equal(JSON.parse(result.stdout).runningServicesVerified,false);
});

test('Codex scaffold and plan require a private explicit connection and preserve harness identity',t=>{
 const {root,run}=fixture(t);assert.equal(run('init','.','--id','codex-desk','--harness','codex').status,0);
 const manifest=JSON.parse(readFileSync(join(root,'augmentor.app.json')));assert.equal(manifest.harness,'codex');
 const example=JSON.parse(readFileSync(join(root,'augmentor/install.example.json')));assert.equal(example.connection,'existing-codex-connection-id');
 writeFileSync(join(root,'private.json'),JSON.stringify({origin:'http://127.0.0.1:8000'}));
 assert.match(run('plan','augmentor.app.json','private.json').stderr,/explicit existing connection/);
 writeFileSync(join(root,'private.json'),JSON.stringify({origin:'http://127.0.0.1:8000',connection:'fixture-connection'}));
 const result=run('plan','augmentor.app.json','private.json');assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout).harness,'codex');
 assert.equal(existsSync(join(root,'profiles')),false);
});
