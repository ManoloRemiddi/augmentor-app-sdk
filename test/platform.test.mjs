// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runtimePaths,discoverRuntime} from '../src/index.mjs';
import {runtimeLaunch} from '../src/runtime.mjs';

test('platform discovery follows product defaults and explicit XDG installation paths',()=>{
  const linux=runtimePaths({platform:'linux',home:'/fixture',env:{}});
  assert.equal(linux.descriptor,'/fixture/.local/share/augmentor/desktop.json');
  const mac=runtimePaths({platform:'darwin',home:'/fixture',env:{}});
  assert.equal(mac.profiles,'/fixture/Library/Application Support/Augmentor/config/augmentor/workspaces');
  assert.equal(mac.runtimeRoot,'/Applications/Augmentor Agent Desktop.app/Contents/Resources/app');
  const windows=runtimePaths({platform:'win32',home:'C:\\Users\\Fixture',env:{}});
  assert.equal(windows.descriptor,'C:\\Users\\Fixture\\AppData\\Local\\Augmentor\\data\\augmentor\\desktop.json');
  assert.equal(windows.runtimeRoot,'C:\\Users\\Fixture\\AppData\\Local\\Programs\\Augmentor Agent\\current');
  assert.equal(runtimePaths({platform:'darwin',home:'/fixture',env:{XDG_DATA_HOME:'/chosen'}}).descriptor,'/chosen/augmentor/desktop.json');
  assert.throws(()=>runtimePaths({platform:'unsupported'}),error=>error.code==='UNSUPPORTED_PLATFORM');
});
test('product launch adapter preserves managed binaries and rejects unexpected descriptor environment',async t=>{
  const root=mkdtempSync(join(tmpdir(),'sdk-platform-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  mkdirSync(join(root,'scripts'));mkdirSync(join(root,'services/workspaces'),{recursive:true});
  writeFileSync(join(root,'scripts/app-sdk-launch.py'),'# fixture');
  writeFileSync(join(root,'services/workspaces/sdk.json'),JSON.stringify({protocol:'augmentor-app/1',harnesses:['dsh'],platforms:{[process.platform]:['dsh']}}));
  const descriptor=join(root,'selected.json'),selected={root,node:process.execPath,python:process.execPath,platform:process.platform,environment:{XDG_CONFIG_HOME:join(root,'config')}};
  writeFileSync(descriptor,JSON.stringify(selected));
  const runtime=await discoverRuntime({descriptor}),launch=runtimeLaunch(runtime,'native');
  assert.equal(launch.command,selected.python);assert.equal(launch.args[3],'native');
  assert.equal(launch.env.XDG_CONFIG_HOME,selected.environment.XDG_CONFIG_HOME);assert.equal(launch.env.AUGMENTOR_PI_NODE,selected.node);
  for(const patch of [{environment:{PATH:'injected'}},{platform:'other'}]){
    writeFileSync(descriptor,JSON.stringify({...selected,...patch}));await assert.rejects(discoverRuntime({descriptor}),error=>error.code==='INVALID_RUNTIME');
  }
});
