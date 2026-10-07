// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
import {readFileSync, writeFileSync, mkdirSync, lstatSync, unlinkSync, mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {resolve, dirname, join} from 'node:path';
import {validateManifest} from './manifest.mjs';
import {check} from './errors.mjs';

export function scaffold(directory, {id = 'my-app', name = 'My app',harness='dsh'} = {}) {
  const root = resolve(directory), toolName = id.replaceAll('-', '_') + '_read_record';
  const pluginId = id.slice(0, 58) + '-tools';
  const manifest = validateManifest({schemaVersion: 1, id, name, harness,
    instructions: ['augmentor/agent-role.md'],
    tools: [{id: pluginId, module: 'augmentor/tools.mjs', names: [toolName]}],
    permissions: {tools: []}, voice: {experimental: true, enabled: false}});
  const replacements = {'__APP_ID_JSON__': JSON.stringify(id), '__APP_NAME_JSON__': JSON.stringify(name),
    '__PLUGIN_ID_JSON__': JSON.stringify(pluginId), '__TOOL_NAME_JSON__': JSON.stringify(toolName),
    '__TOOL_NAME__': toolName, '__APP_ID__': id};
  const files = new Map([['augmentor.app.json', JSON.stringify(manifest, null, 2) + '\n']]);
  for (const file of ['agent-role.md', 'tools.mjs', 'server.mjs', 'browser.mjs', 'install.example.json', 'INTEGRATION.md']) {
    const template = readFileSync(new URL('../templates/integration/' + file, import.meta.url), 'utf8');
    files.set('augmentor/' + file, template.replace(/__[A-Z_]+__/g, key => replacements[key] ?? key));
  }
  files.set('augmentor/.gitignore', 'private/\n');
  if(harness==='codex'){
    const options=JSON.parse(files.get('augmentor/install.example.json'));
    options.connection='existing-codex-connection-id';
    files.set('augmentor/install.example.json',JSON.stringify(options,null,2)+'\n');
  }
  try {
    const entry = lstatSync(join(root, 'augmentor'));
    check(entry.isDirectory() && !entry.isSymbolicLink(), 'SCAFFOLD_CONFLICT', 'augmentor must be a real directory, not a file or symlink');
  } catch (error) {if (error.code !== 'ENOENT') throw error;}
  // Preflight every target, including broken symlinks, before writing any file.
  for (const file of files.keys()) {
    try {lstatSync(join(root, file));}
    catch (error) {if (error.code === 'ENOENT') continue; throw error;}
    check(false, 'SCAFFOLD_CONFLICT', `Refusing to overwrite ${file}; no starter files were written`);
  }
  const created = [];
  try {
    for (const [file, content] of files) {
      const target = join(root, file);
      mkdirSync(dirname(target), {recursive: true});
      writeFileSync(target, content, {flag: 'wx'});
      created.push({target, inode: lstatSync(target).ino});
    }
  } catch (error) {
    for (const {target, inode} of created.reverse()) {
      try {if (lstatSync(target).ino === inode) unlinkSync(target);} catch {}
    }
    throw error;
  }
  return {root, id, files: [...files.keys()]};
}

/**
 * Agent-native starter (init --template app): a defineApp() module, runtime tool module,
 * server and page wiring. The manifest and runtime descriptors are generated from the
 * written definition itself, so they cannot drift from it.
 */
export async function scaffoldApp(directory, {id = 'my-app', name = 'My app', harness = 'dsh'} = {}) {
  check(/^[a-z][a-z0-9-]{0,63}$/.test(id), 'INVALID_MANIFEST', 'App IDs are lower-case letters, digits and dashes');
  check(['dsh', 'codex'].includes(harness), 'INVALID_MANIFEST', 'Choose DSH or Codex');
  const root = resolve(directory), prefix = id.replaceAll('-', '_'), pluginId = id.slice(0, 58) + '-tools';
  const replacements = {'__APP_ID_JSON__': JSON.stringify(id), '__APP_NAME_JSON__': JSON.stringify(name), '__HARNESS_JSON__': JSON.stringify(harness),
    '__PLUGIN_ID_JSON__': JSON.stringify(pluginId), '__PLUGIN_ID__': pluginId, '__APP_NAME__': name.replace(/[\r\n]/g, ' '), '__PREFIX__': prefix};
  const files = new Map();
  for (const file of ['app.mjs', 'agent-role.md', 'tools.mjs', 'server.mjs', 'page.mjs', 'install.example.json', 'INTEGRATION.md']) {
    const template = readFileSync(new URL('../templates/app/' + file, import.meta.url), 'utf8');
    // Known tokens only, longest first (__PREFIX__ is followed directly by _name in tool IDs).
    files.set('augmentor/' + file, Object.keys(replacements).sort((a, b) => b.length - a.length).reduce((text, key) => text.split(key).join(replacements[key]), template));
  }
  if (harness === 'codex') {const options = JSON.parse(files.get('augmentor/install.example.json')); options.connection = 'existing-codex-connection-id'; files.set('augmentor/install.example.json', JSON.stringify(options, null, 2) + '\n');}
  files.set('augmentor/.gitignore', 'private/\n');
  // Generate manifest and descriptors from the definition as written (SDK resolved to this copy).
  const temp = mkdtempSync(join(tmpdir(), 'augmentor-scaffold-'));
  let definition;
  try {
    const source = files.get('augmentor/app.mjs').replace(/from '@augmentor\/app-sdk'/g, `from ${JSON.stringify(pathToFileURL(fileURLToPath(new URL('./index.mjs', import.meta.url))).href)}`);
    writeFileSync(join(temp, 'app.mjs'), source);
    definition = (await import(pathToFileURL(join(temp, 'app.mjs')).href)).default;
  } finally {rmSync(temp, {recursive: true, force: true});}
  files.set('augmentor.app.json', JSON.stringify(definition.manifest(), null, 2) + '\n');
  files.set('augmentor/tools.json', JSON.stringify(definition.descriptors(), null, 2) + '\n');
  try {
    const entry = lstatSync(join(root, 'augmentor'));
    check(entry.isDirectory() && !entry.isSymbolicLink(), 'SCAFFOLD_CONFLICT', 'augmentor must be a real directory, not a file or symlink');
  } catch (error) {if (error.code !== 'ENOENT') throw error;}
  for (const file of files.keys()) {
    try {lstatSync(join(root, file));} catch (error) {if (error.code === 'ENOENT') continue; throw error;}
    check(false, 'SCAFFOLD_CONFLICT', `Refusing to overwrite ${file}; no starter files were written`);
  }
  const created = [];
  try {
    for (const [file, content] of files) {
      const target = join(root, file); mkdirSync(dirname(target), {recursive: true});
      writeFileSync(target, content, {flag: 'wx'}); created.push({target, inode: lstatSync(target).ino});
    }
  } catch (error) {
    for (const {target, inode} of created.reverse()) {try {if (lstatSync(target).ino === inode) unlinkSync(target);} catch {}}
    throw error;
  }
  return {root, id, files: [...files.keys()]};
}
