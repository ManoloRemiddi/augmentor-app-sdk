// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
// Paired public-source qualification, synthetic records/provider, no app deployment.
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const repository=fileURLToPath(new URL('../',import.meta.url));
const product=process.argv[2]&&resolve(process.argv[2]);
if(!product||!existsSync(join(product,'tests/codex-workspaces.test.mjs')))throw Error('Provide the built paired public Augmentor source checkout');
const root=mkdtempSync(join(tmpdir(),'sdk-product-proof-'));
try {
 const consumer=join(root,'consumer');mkdirSync(consumer);
 const run=(command,args,cwd=consumer,env=process.env)=>{
  if(command==='npm'&&process.platform==='win32'){if(!env.npm_execpath)throw Error('Use npm run test:runtime');command=process.execPath;args=[env.npm_execpath,...args];}
  const result=spawnSync(command,args,{cwd,encoding:'utf8',env,timeout:120000,windowsHide:true});
  if(result.status!==0)throw Error(result.stderr+'\n'+result.stdout);return result.stdout;
 };
 const [packed]=JSON.parse(run('npm',['pack','--ignore-scripts','--json','--pack-destination',root],repository));
 writeFileSync(join(consumer,'package.json'),JSON.stringify({name:'sdk-product-fixture',private:true,type:'module'}));
 run('npm',['install','--ignore-scripts','--no-audit','--no-fund',join(root,packed.filename)]);
 const python=process.env.AUGMENTOR_PYTHON||run(process.platform==='win32'?'python':'python3',['-I','-B','-c','import sys; print(sys.executable)']).trim();
 const sdk=join(consumer,'node_modules/@augmentor/app-sdk/src');
 const common=['tests/workspace-capabilities.test.mjs','apps/browser/test/workspace-context.test.mjs'];
 const tests=process.platform==='win32'?common:['tests/codex-operations.test.mjs','tests/codex-session.test.mjs','tests/codex-workspaces.test.mjs',...common];
 const output=run(process.execPath,['--test',...tests],product,{...process.env,AUGMENTOR_PYTHON:python,
   AUGMENTOR_SDK_CLIENT_ENTRY:join(sdk,'client.mjs'),AUGMENTOR_SDK_TOOLS_ENTRY:join(sdk,'tools.mjs')});
 process.stdout.write(output);
 if(process.platform==='win32')process.stdout.write('Windows Codex remains unsupported; platform private-file proof is a separate required gate.\n');
} finally {rmSync(root,{recursive:true,force:true});}
