// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
import {readdirSync} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
function run(args){const result=spawnSync(process.execPath,args,{stdio:'inherit'});if(result.error)throw result.error;if(result.status)process.exit(result.status);}
function checkDirectory(dir) {
  for (const entry of readdirSync(dir,{withFileTypes:true})) {
    const file=join(dir,entry.name);
    if(entry.isDirectory())checkDirectory(file);
    else if(entry.name.endsWith('.mjs'))run(['--check',file]);
  }
}
for(const dir of ['src','bin','scripts','test','templates','dist','examples'])checkDirectory(dir);
// The committed single-file browser bundle must match the sources it is built from.
run(['scripts/build-browser.mjs','--check']);
