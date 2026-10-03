// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {join, isAbsolute} from 'node:path';
import {check, SDK_PROTOCOL, AugmentorError} from './errors.mjs';
import {runtimePaths} from './platform.mjs';
const execute=promisify(execFile);
async function bootstrap(root) {
  check(typeof root==='string'&&isAbsolute(root),'INVALID_RUNTIME','Choose an absolute installed Augmentor runtime root');
  const python=join(root,process.platform==='win32'?'python/python.exe':'python/bin/python3');
  const script=join(root,'scripts/app-sdk-runtime.py');
  try {
    const {stdout}=await execute(python,['-I','-B',script,'--describe'],{timeout:15000,maxBuffer:64*1024,windowsHide:true});
    return JSON.parse(stdout);
  } catch {throw new AugmentorError('RUNTIME_UNAVAILABLE','The installed Augmentor SDK bootstrap is unavailable or failed verification');}
}
export async function discoverRuntime({descriptor,runtimeRoot,harness='dsh'} = {}) {
  check(!(descriptor&&runtimeRoot),'INVALID_REQUEST','Choose a runtime descriptor or installed runtime root');
  let selected, contract;
  try {
    if(runtimeRoot)selected=await bootstrap(runtimeRoot);
    else {
      const file=descriptor||runtimePaths().descriptor;
      try {selected = JSON.parse(await readFile(file, 'utf8'));}
      catch(error) {
        if(descriptor||error.code!=='ENOENT'||!runtimePaths().runtimeRoot)throw error;
        selected=await bootstrap(runtimePaths().runtimeRoot);
      }
    }
    check(['root','node','python'].every(k => typeof selected[k] === 'string' && isAbsolute(selected[k])), 'INVALID_RUNTIME', 'Invalid managed runtime descriptor');
    check(!selected.platform||selected.platform===process.platform,'INVALID_RUNTIME','The selected runtime belongs to a different operating system');
    check(!selected.environment||typeof selected.environment==='object'&&!Array.isArray(selected.environment)&&
      Object.entries(selected.environment).every(([key,value])=>['XDG_CONFIG_HOME','XDG_DATA_HOME','XDG_STATE_HOME'].includes(key)&&typeof value==='string'&&isAbsolute(value)),
      'INVALID_RUNTIME','Invalid product environment contract');
    contract = JSON.parse(await readFile(join(selected.root, 'services/workspaces/sdk.json'), 'utf8'));
  } catch (error) {
    if (error instanceof AugmentorError) throw error;
    throw new AugmentorError('RUNTIME_UNAVAILABLE', 'A compatible managed Augmentor runtime is required. Run augmentor-app doctor.', {cause: error.code});
  }
  check(['dsh','codex'].includes(harness)&&contract.protocol === SDK_PROTOCOL && contract.harnesses?.includes(harness), 'INCOMPATIBLE_RUNTIME', `This runtime does not support Augmentor App SDK v1 and ${harness}`);
  check(!contract.platforms||contract.platforms[process.platform]?.includes(harness),'INCOMPATIBLE_RUNTIME',`This runtime has no ${harness} application adapter for ${process.platform}`);
  return {...selected, contract};
}

/** New runtimes own their platform startup; older qualified Linux builds retain direct launch. */
export function runtimeLaunch(runtime,component,args=[]) {
  const scripts={native:'apps/browser/native-host.mjs',register:'scripts/install-workspace-profile.mjs'};
  check(Object.hasOwn(scripts,component),'INVALID_REQUEST','Unknown SDK runtime component');
  const adapter=join(runtime.root,'scripts/app-sdk-launch.py'),hasAdapter=existsSync(adapter);
  check(hasAdapter||process.platform==='linux','INCOMPATIBLE_RUNTIME','This platform needs the product SDK launch adapter');
  const env={...process.env,...runtime.environment,AUGMENTOR_PYTHON:runtime.python,AUGMENTOR_PI_NODE:runtime.node};
  return {command:hasAdapter?runtime.python:runtime.node,
    args:hasAdapter?['-I','-B',adapter,component,...args]:[join(runtime.root,scripts[component]),...args],env};
}
