// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
import {homedir} from 'node:os';
import {posix,win32} from 'node:path';
import {check} from './errors.mjs';

/** Path defaults only. The product verifies Windows identity and private ACLs. */
export function runtimePaths({platform=process.platform,home=homedir(),env=process.env}={}) {
  check(['linux','darwin','win32'].includes(platform),'UNSUPPORTED_PLATFORM','No Augmentor application adapter exists for this operating system');
  const path=platform==='win32'?win32:posix;
  const base=platform==='darwin'?path.join(home,'Library','Application Support','Augmentor'):
    platform==='win32'?path.join(env.LOCALAPPDATA||path.join(home,'AppData','Local'),'Augmentor'):null;
  const config=env.XDG_CONFIG_HOME||(base?path.join(base,'config'):path.join(home,'.config'));
  const data=env.XDG_DATA_HOME||(base?path.join(base,'data'):path.join(home,'.local','share'));
  const state=env.XDG_STATE_HOME||(base?path.join(base,'state'):path.join(home,'.local','state'));
  return {config,data,state,profiles:env.AUGMENTOR_WORKSPACE_PROFILES||path.join(config,'augmentor','workspaces'),
    descriptor:path.join(data,'augmentor','desktop.json'),
    runtimeRoot:platform==='darwin'?'/Applications/Augmentor Agent Desktop.app/Contents/Resources/app':
      platform==='win32'?path.join(env.LOCALAPPDATA||path.join(home,'AppData','Local'),'Programs','Augmentor Agent','current'):null};
}
