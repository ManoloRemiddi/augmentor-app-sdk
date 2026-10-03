// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
import {readFileSync, realpathSync, statSync} from 'node:fs';
import {resolve, relative, isAbsolute, sep} from 'node:path';
import Ajv from 'ajv';
import {check, SDK_PROTOCOL} from './errors.mjs';
const schema = JSON.parse(readFileSync(new URL('../schema/manifest.schema.json', import.meta.url)));
const validate = new Ajv({allErrors: true, strict: true}).compile(schema);
export function validateManifest(value) {
  check(validate(value), 'INVALID_MANIFEST', 'Application manifest does not match schema v1', {errors: validate.errors});
  const ids = value.tools.map(t => t.id), names = value.tools.flatMap(t => t.names);
  check(new Set(ids).size === ids.length && new Set(names).size === names.length, 'INVALID_MANIFEST', 'Tool IDs and names must be unique');
  check(new Set([...value.permissions.tools,...names]).size<=200,'INVALID_MANIFEST','An application workspace can grant at most 200 distinct tools');
  return structuredClone(value);
}
export function applicationPath(root, path) {
  check(typeof path === 'string' && !isAbsolute(path), 'INVALID_MANIFEST', 'Manifest files must use relative application paths');
  let base, file;
  try {base = realpathSync(root); file = realpathSync(resolve(base, path));}
  catch {check(false, 'INVALID_MANIFEST', `Manifest file does not exist: ${path}`);}
  const rel = relative(base, file);
  check(rel && rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel), 'INVALID_MANIFEST', 'Manifest file escapes the application directory');
  check(statSync(file).isFile(), 'INVALID_MANIFEST', `Manifest entry is not a file: ${path}`);
  return file;
}
// Read-only preflight: resolve files without executing application modules.
export function validateApplication(manifest, {root}) {
  const m = validateManifest(manifest);
  for (const path of [...m.instructions, ...m.tools.map(tool => tool.module)]) applicationPath(root, path);
  return m;
}
export function workspaceProfile(manifest, options) {
  const m = validateManifest(manifest), {root, origin, tokenFile, toolConfig = {}, id = m.id, preset = 'augmentor-' + id, memory, legacyPresets = [], connection} = options;
  check(m.harness!=='codex'||typeof connection==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(connection),'INVALID_INSTALL','Codex workspaces require an explicit existing connection profile ID (at most 128 letters, digits, underscores or hyphens)');
  const u = new URL(origin);
  check(u.origin === origin && (u.protocol === 'https:' || (u.protocol === 'http:' && ['127.0.0.1','[::1]','localhost'].includes(u.hostname))), 'INVALID_ORIGIN', 'Use an exact HTTPS origin or a local loopback origin');
  check(/^[a-z][a-z0-9-]{0,63}$/.test(id) && /^augmentor-[a-z0-9-]+$/.test(preset), 'INVALID_MANIFEST', 'Invalid workspace or preset ID');
  check(isAbsolute(tokenFile), 'INVALID_MANIFEST', 'Proxy token path must be absolute');
  const cwd = realpathSync(root);
  return {schemaVersion: 1, sdkProtocol: SDK_PROTOCOL, id, name: m.name, description: m.description || '', preset, cwd,harness:m.harness,...(m.harness==='codex'?{connection}:{}),
    memory: memory || {person: 'app-' + id + '-owner', project: cwd}, legacyPresets,
    parentOrigin: origin, publicPath: '/augmentor/', accessTokenFile: tokenFile,
    instructions: m.instructions.map(p => applicationPath(root, p)),
    tools: m.tools.map(t => ({id: t.id, module: applicationPath(root, t.module),names:t.names, config: toolConfig[t.id] || {}})),
    policy: {tools: [...new Set([...m.permissions.tools, ...m.tools.flatMap(t => t.names)])], voice: m.voice.enabled, sharedSettings: false}};
}
