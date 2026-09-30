// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
import {readFileSync, realpathSync} from 'node:fs';
import {resolve, relative, isAbsolute} from 'node:path';
import Ajv from 'ajv';
import {check, SDK_PROTOCOL} from './errors.mjs';
const schema = JSON.parse(readFileSync(new URL('../schema/manifest.schema.json', import.meta.url)));
const validate = new Ajv({allErrors: true, strict: true}).compile(schema);
export function validateManifest(value) {
  check(validate(value), 'INVALID_MANIFEST', 'Application manifest does not match schema v1', {errors: validate.errors});
  const ids = value.tools.map(t => t.id), names = value.tools.flatMap(t => t.names);
  check(new Set(ids).size === ids.length && new Set(names).size === names.length, 'INVALID_MANIFEST', 'Tool IDs and names must be unique');
  return structuredClone(value);
}
export function applicationPath(root, path) {
  check(typeof path === 'string' && !isAbsolute(path), 'INVALID_MANIFEST', 'Manifest files must use relative application paths');
  const base = realpathSync(root), file = realpathSync(resolve(base, path)), rel = relative(base, file);
  check(rel && rel !== '..' && !rel.startsWith('../') && !isAbsolute(rel), 'INVALID_MANIFEST', 'Manifest file escapes the application directory');
  return file;
}
export function workspaceProfile(manifest, options) {
  const m = validateManifest(manifest), {root, origin, tokenFile, toolConfig = {}, id = m.id, preset = 'augmentor-' + id, memory, legacyPresets = []} = options;
  const u = new URL(origin);
  check(u.origin === origin && (u.protocol === 'https:' || (u.protocol === 'http:' && ['127.0.0.1','[::1]','localhost'].includes(u.hostname))), 'INVALID_ORIGIN', 'Use an exact HTTPS origin or a local loopback origin');
  check(/^[a-z][a-z0-9-]{0,63}$/.test(id) && /^augmentor-[a-z0-9-]+$/.test(preset), 'INVALID_MANIFEST', 'Invalid workspace or preset ID');
  check(isAbsolute(tokenFile), 'INVALID_MANIFEST', 'Proxy token path must be absolute');
  const cwd = realpathSync(root);
  return {schemaVersion: 1, sdkProtocol: SDK_PROTOCOL, id, name: m.name, description: m.description || '', preset, cwd,
    memory: memory || {person: 'app-' + id + '-owner', project: cwd}, legacyPresets,
    parentOrigin: origin, publicPath: '/augmentor/', accessTokenFile: tokenFile,
    instructions: m.instructions.map(p => applicationPath(root, p)),
    tools: m.tools.map(t => ({id: t.id, module: applicationPath(root, t.module), config: toolConfig[t.id] || {}})),
    policy: {tools: [...new Set([...m.permissions.tools, ...m.tools.flatMap(t => t.names)])], voice: m.voice.enabled, sharedSettings: false}};
}
