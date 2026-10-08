// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
// Compile-only usage sample for the published declarations (npm run check:types).
import {defineApp, defineTool, definePrompt, createAugmentorServer, GRANTS, type RunResult} from '../../types/index.js';
import {mountAugmentor, connectPage, createAgent} from '../../types/browser.js';
import {createMockRuntime, scriptedModel} from '../../types/testing.js';
import {createToolModule} from '../../types/dsh.js';
const app = defineApp({id: 'x', name: 'X', grants: ['memory', 'web'], tools: [defineTool<{id: string}, {ok: boolean}>({name: 'x_read', description: 'Read', effect: 'read', handler: ({id}) => ({ok: id.length > 0})})],
  prompts: [definePrompt({id: 'p', title: 'P', template: 'Hi'})]});
const server = createAugmentorServer(app, {origin: 'http://127.0.0.1:1', authorizeOwner: r => r.headers.cookie === 'a'});
const g: string[] = GRANTS.memory; void g; void server.toolkit.fingerprint();
const panel = mountAugmentor({container: document.body, allow: ['microphone'], theme: {mode: 'light', accent: '#123456'}});
void connectPage({actions: {navigate: ({route}) => route}}); void createAgent({panel}).ask('p', {});
const rt = createMockRuntime({script: scriptedModel([{say: 'x'}])}); void rt.client();
const mod = createToolModule({pluginId: 'x-tools', descriptors: new URL('file:///x')}); void mod.name;
const r: RunResult | undefined = undefined; void r;
