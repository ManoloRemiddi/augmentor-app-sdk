// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
import {readFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join, isAbsolute} from 'node:path';
import {check, SDK_PROTOCOL, AugmentorError} from './errors.mjs';
export async function discoverRuntime({descriptor = join(process.env.XDG_DATA_HOME || join(homedir(), '.local/share'), 'augmentor/desktop.json')} = {}) {
  let selected, contract;
  try {
    selected = JSON.parse(await readFile(descriptor, 'utf8'));
    check(['root','node','python'].every(k => typeof selected[k] === 'string' && isAbsolute(selected[k])), 'INVALID_RUNTIME', 'Invalid managed runtime descriptor');
    contract = JSON.parse(await readFile(join(selected.root, 'services/workspaces/sdk.json'), 'utf8'));
  } catch (error) {
    if (error instanceof AugmentorError) throw error;
    throw new AugmentorError('RUNTIME_UNAVAILABLE', 'A compatible managed Augmentor runtime is required. Run augmentor-app doctor.', {cause: error.code});
  }
  check(contract.protocol === SDK_PROTOCOL && contract.harnesses?.includes('dsh'), 'INCOMPATIBLE_RUNTIME', 'This runtime does not support Augmentor App SDK v1 and DSH');
  return {...selected, contract};
}
