// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
import {readFileSync, writeFileSync, mkdirSync, lstatSync, unlinkSync} from 'node:fs';
import {resolve, dirname, join} from 'node:path';
import {validateManifest} from './manifest.mjs';
import {check} from './errors.mjs';

export function scaffold(directory, {id = 'my-app', name = 'My app'} = {}) {
  const root = resolve(directory), toolName = id.replaceAll('-', '_') + '_read_record';
  const pluginId = id.slice(0, 58) + '-tools';
  const manifest = validateManifest({schemaVersion: 1, id, name, harness: 'dsh',
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
