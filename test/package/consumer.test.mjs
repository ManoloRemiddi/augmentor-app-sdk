// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
// Package contract test; creates no real application, profile or model session.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const repository=fileURLToPath(new URL('../../',import.meta.url));
test('shipped archive installs in a clean consumer and its generated adapter passes isolated acceptance',{timeout:120000},t=>{
  const root=mkdtempSync(join(tmpdir(),'sdk-packed-')),consumer=join(root,'consumer with spaces');
  t.after(()=>rmSync(root,{recursive:true,force:true}));mkdirSync(consumer);
  const run=(cmd,args,cwd=consumer)=>{
    const env={...process.env,XDG_CONFIG_HOME:join(root,'config'),XDG_DATA_HOME:join(root,'data'),AUGMENTOR_WORKSPACE_PROFILES:join(root,'profiles')};
    delete env.NODE_TEST_CONTEXT;
    if(cmd==='npm'&&process.platform==='win32'){
      assert.ok(process.env.npm_execpath,'Run Windows package acceptance through npm run test:package');
      cmd=process.execPath;args=[process.env.npm_execpath,...args];
    }
    const result=spawnSync(cmd,args,{cwd,encoding:'utf8',timeout:60000,env,windowsHide:true});
    assert.equal(result.status,0,result.stderr+'\n'+result.stdout);return result.stdout;
  };
  const [packed]=JSON.parse(run('npm',['pack','--ignore-scripts','--json','--pack-destination',root],repository));
  const names=packed.files.map(file=>file.path);
  for(const name of ['AGENTS.md','docs/AGENT-INTEGRATION.md','docs/API.md','docs/ACCEPTANCE.md','templates/integration/server.mjs','templates/app/app.mjs','src/scaffold.mjs','dist/augmentor-browser.mjs'])assert.ok(names.includes(name),name);
  assert.ok(!names.some(name=>name.startsWith('analysis/')||name.startsWith('examples/')));
  assert.ok(!names.some(name=>name.startsWith('test/')||name.endsWith('.token')||name.includes('/private/')));
  writeFileSync(join(consumer,'package.json'),JSON.stringify({name:'sdk-consumer-fixture',version:'0.0.0',private:true,type:'module'}));
  run('npm',['install','--ignore-scripts','--no-audit','--no-fund',join(root,packed.filename)]);
  // Repeat from the generated consumer lock to catch nonportable dependency paths.
  run('npm',['ci','--ignore-scripts','--no-audit','--no-fund']);
  const cli=join(consumer,'node_modules/@augmentor/app-sdk/bin/augmentor-app.mjs');
  assert.match(run(process.execPath,[cli,'--help']),/read-only|previews identity/);
  run(process.execPath,[cli,'init','.','--id','fixture-records','--name','Fixture records']);
  run(process.execPath,[cli,'validate','augmentor.app.json']);
  const manifest=JSON.parse(readFileSync(join(consumer,'augmentor.app.json')));
  assert.deepEqual(manifest.tools[0].names,['fixture_records_read_record']);
  // Only defineTool is synthetic. Actual installed SDK validation, HTTP client,
  // generated adapter and backend are exercised below. This is not real DSH proof.
  const fake=join(consumer,'node_modules/@deepseek-ai/dsh-tools');mkdirSync(fake,{recursive:true});
  writeFileSync(join(fake,'package.json'),JSON.stringify({name:'@deepseek-ai/dsh-tools',type:'module',exports:'./index.mjs'}));
  writeFileSync(join(fake,'index.mjs'),'export const defineTool = value => value;\n');
  writeFileSync(join(consumer,'fixture.test.mjs'),readFileSync(new URL('./fixture.mjs',import.meta.url)));
  const output=run(process.execPath,['--test','--test-reporter=tap','fixture.test.mjs']);
  assert.match(output,/# fail 0/);console.log(output);
  // Agent-native kit: generate, check drift, then run the generated wiring end to end.
  const kit=join(consumer,'kit');mkdirSync(kit);
  run(process.execPath,[cli,'init','.','--id','fixture-records','--name','Fixture records','--template','app'],kit);
  run(process.execPath,[cli,'validate','augmentor.app.json'],kit);
  assert.match(run(process.execPath,[cli,'check','augmentor/app.mjs'],kit),/agree/);
  writeFileSync(join(kit,'kit.test.mjs'),readFileSync(new URL('./app-fixture.mjs',import.meta.url)));
  const kitOutput=run(process.execPath,['--test','--test-reporter=tap','kit.test.mjs'],kit);
  assert.match(kitOutput,/# fail 0/);console.log(kitOutput);
});
