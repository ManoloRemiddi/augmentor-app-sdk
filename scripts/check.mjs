// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
for(const dir of ['src','bin','scripts','test'])for(const name of readdirSync(dir).filter(n=>n.endsWith('.mjs'))){const r=spawnSync(process.execPath,['--check',dir+'/'+name],{stdio:'inherit'});if(r.status)process.exit(r.status);}
