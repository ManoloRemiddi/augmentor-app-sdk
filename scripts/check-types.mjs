// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
// Type-check the published declarations against a usage sample. Needs TypeScript and
// @types/node (TYPESCRIPT_TSC=/path/to/tsc, or a resolvable `typescript` package).
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {readdirSync} from 'node:fs';
import {dirname, join} from 'node:path';
const require = createRequire(import.meta.url);
let tsc = process.env.TYPESCRIPT_TSC;
if (!tsc) {try {tsc = require.resolve('typescript/bin/tsc');} catch {tsc = '/opt/node-tools/node_modules/typescript/bin/tsc';}}
const typeRoots = process.env.TYPESCRIPT_TYPE_ROOTS || join(dirname(dirname(dirname(tsc))), '@types');
const files = ['test/types/usage.ts', ...readdirSync('types').map(f => 'types/' + f)];
const result = spawnSync(process.execPath, [tsc, '--noEmit', '--strict', '--target', 'es2022', '--module', 'nodenext', '--moduleResolution', 'nodenext', '--lib', 'es2023,dom', '--types', 'node', '--typeRoots', typeRoots, ...files], {stdio: 'inherit'});
if (result.error) {console.error('TypeScript is unavailable; set TYPESCRIPT_TSC'); process.exit(1);}
if (result.status) process.exit(result.status);
console.log('Type declarations compile against the usage sample');
