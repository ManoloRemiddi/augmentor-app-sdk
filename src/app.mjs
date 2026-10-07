// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
// One declaration for the whole agent surface of an application, and one call to serve it.
import {randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {mkdirSync} from 'node:fs';
import {check, AugmentorError} from './errors.mjs';
import {defineTool, createToolkit} from './toolkit.mjs';
import {createPromptLibrary} from './prompts.mjs';
import {createToolEndpoint} from './endpoint.mjs';
import {createReviewEndpoint} from './review.mjs';
import {createUiBridge, STANDARD_UI_ACTIONS} from './ui.mjs';
import {EventHub, createEventStream} from './events.mjs';
import {ProposalStore} from './approvals.mjs';
import {ActivityLog} from './activity.mjs';
import {OperationStore} from './operations.mjs';
import {JobStore} from './jobs.mjs';
import {AgentRunner} from './agent.mjs';
import {createAutomation} from './automation.mjs';
import {createMcpServer} from './mcp.mjs';
import {createProxy} from './proxy.mjs';
import {validateManifest} from './manifest.mjs';
import {adapt, json, failure, errorResponse, readJson, sameOrigin, fromNode, fromFetch, send, toResponse} from './http.mjs';

/** Product tools an app can grant, by purpose (names as the runtime exposes them). */
export const GRANTS = Object.freeze({
  memory: ['memory_recall', 'memory_source'],
  web: ['web_search', 'web_fetch'],
  ask: ['ask_user_question'],
  browserObserve: ['browser_navigate', 'browser_screenshot', 'browser_snapshot', 'browser_tabs_list'],
  todo: ['todo_write'],
  goals: ['create_goal', 'get_goal', 'update_goal'],
  plan: ['exit_plan_mode'],
  subagents: ['subagent', 'subagent_fork', 'send_message', 'interrupt_agent'],
  workflow: ['workflow'],
  skills: ['skill'],
});

/** Addressable read-only data, e.g. `app://deal/{id}` (MCP resources; also a model tool). */
export function defineResource({uri, name, title, description = '', mimeType = 'application/json', read}) {
  check(typeof uri === 'string' && /^[a-z][a-z0-9+.-]*:\/\/\S+$/.test(uri), 'INVALID_RESOURCE', `Resource URIs look like app://kind/{id} (${uri})`);
  check(typeof name === 'string' && /^[a-z][a-z0-9_-]{0,63}$/.test(name), 'INVALID_RESOURCE', 'Resource names are lower-case identifiers');
  check(typeof read === 'function', 'INVALID_RESOURCE', `Resource ${name} needs a read function`);
  const names = [...uri.matchAll(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g)].map(m => m[1]);
  const pattern = new RegExp('^' + uri.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{([A-Za-z_][A-Za-z0-9_]*)\\\}/g, '([^/?#]+)') + '$');
  return Object.freeze({kind: 'resource', uri, name, title: title || name, description, mimeType, read, template: names.length > 0, names, pattern});
}

function resourceRegistry(resources) {
  const list = [...resources];
  return {
    list: () => list.filter(r => !r.template).map(r => ({uri: r.uri, name: r.name, title: r.title, description: r.description, mimeType: r.mimeType})),
    templates: () => list.filter(r => r.template).map(r => ({uriTemplate: r.uri, name: r.name, title: r.title, description: r.description, mimeType: r.mimeType})),
    async read(uri, context = {}) {
      for (const r of list) {
        const m = r.pattern.exec(uri); if (!m) continue;
        const params = Object.fromEntries(r.names.map((n, i) => [n, decodeURIComponent(m[i + 1])]));
        const value = await r.read(params, context);
        check(value !== undefined && value !== null, 'NOT_FOUND', `Nothing at ${uri}`);
        return [{uri, mimeType: r.mimeType, text: typeof value === 'string' ? value : JSON.stringify(value)}];
      }
      throw new AugmentorError('NOT_FOUND', `No resource matches ${uri}`);
    },
  };
}

/**
 * Declare the application's agent surface once. Everything else (manifest names, tool
 * descriptors for DSH/Codex, MCP listings, help text, UI and review routes) derives from it.
 */
export function defineApp({id, name, description = '', harness = 'dsh', instructions = [], tools = [], prompts = [], modes = [], uiActions = [], resources = [],
  grants = [], voice = false, ui = true, builtins = true, routes = {}}) {
  check(/^[a-z][a-z0-9-]{0,63}$/.test(id || ''), 'INVALID_MANIFEST', 'App IDs are lower-case letters, digits and dashes');
  check(typeof name === 'string' && name.trim(), 'INVALID_MANIFEST', 'App name required');
  const prefix = id.replace(/-/g, '_');
  for (const tool of tools) check(tool?.kind === 'tool', 'INVALID_TOOL', 'Use defineTool() for every tool');
  for (const tool of tools) check(tool.name.startsWith(prefix + '_'), 'INVALID_TOOL', `Prefix tool names with "${prefix}_" so they stay unique across apps (${tool.name})`);
  const grantNames = [...new Set(grants.flatMap(g => typeof g === 'string' && Object.hasOwn(GRANTS, g) ? GRANTS[g] : [g]))];
  const library = createPromptLibrary({prompts, modes});
  const registry = resourceRegistry(resources);
  const app = {
    kind: 'app', id, name, description, harness, prefix, instructions: [...instructions], tools: [...tools], prompts: library, resources: registry, uiActions: [...uiActions],
    grants: grantNames, voice: !!voice, ui: !!ui, routes,
    /** Built-in tools: proposal status for follow-through, resource reading, and a generated reference. */
    builtinTools({proposals} = {}) {
      if (!builtins) return [];
      const extra = [defineTool({name: `${prefix}_reference`, title: 'Application reference', effect: 'read',
        description: `How ${name} works for the agent: its tools, premade prompts, resources and routes. Read this instead of guessing.`, handler: () => app.reference()})];
      if (proposals) extra.push(defineTool({name: `${prefix}_proposal_status`, title: 'Proposal status', effect: 'read',
        description: 'Check the owner\'s decision on a proposal you created (approved, rejected, executed, expired).',
        input: {type: 'object', properties: {proposalId: {type: 'string', maxLength: 64}}, required: ['proposalId']},
        handler: ({proposalId}) => {const p = proposals.get(proposalId); if (!p) throw new AugmentorError('NOT_FOUND', 'Unknown proposal'); return {state: p.state, note: p.note, decidedAt: p.decidedAt, result: p.state === 'executed' ? p.result : undefined, error: p.error || undefined};}}));
      if (resources.length) extra.push(defineTool({name: `${prefix}_read_resource`, title: 'Read resource', effect: 'read',
        description: `Read application data by URI. Available: ${resources.map(r => r.uri).join(', ')}`,
        input: {type: 'object', properties: {uri: {type: 'string', maxLength: 500}}, required: ['uri']}, handler: ({uri}, ctx) => registry.read(uri, ctx).then(c => JSON.parse(c[0].mimeType === 'application/json' ? c[0].text : JSON.stringify(c[0].text)))}));
      return extra;
    },
    /** Tool declarations including UI and built-in tools (no handlers executed). */
    allTools({proposals, bridge} = {}) {
      const uiTools = ui ? (bridge || createUiBridge({origin: 'http://127.0.0.1:1', authorize: () => false, actions: uiActions})).tools({prefix}) : [];
      return [...tools, ...uiTools, ...app.builtinTools({proposals: proposals ?? {get: () => null}})];
    },
    /** Static descriptors for the in-runtime tool module (augmentor/tools.json). */
    descriptors() {
      const toolkit = createToolkit({tools: app.allTools(), proposals: {}});
      return {schemaVersion: 1, app: id, fingerprint: toolkit.fingerprint(), tools: toolkit.list().map(t => ({name: t.name, description: t.description, inputSchema: t.inputSchema, ...(t.outputSchema ? {outputSchema: t.outputSchema} : {}), effect: t.effect, approval: t.approval}))};
    },
    /** The registration manifest (augmentor.app.json), generated from the declaration. */
    manifest({toolModule = 'augmentor/tools.mjs', pluginId = id.slice(0, 58) + '-tools'} = {}) {
      return validateManifest({schemaVersion: 1, id, name, ...(description ? {description} : {}), harness, instructions: app.instructions,
        tools: [{id: pluginId, module: toolModule, names: app.descriptors().tools.map(t => t.name)}], permissions: {tools: grantNames}, voice: {experimental: true, enabled: !!voice}});
    },
    /** Markdown reference generated from the declaration (also served to the agent). */
    reference() {
      const toolkit = createToolkit({tools: app.allTools(), proposals: {}});
      const lines = [`# ${name}`, '', description, '', toolkit.describe({heading: 'Tools'}), '## Premade prompts', ''];
      for (const p of library.list()) lines.push(`- \`${p.id}\` — ${p.title}${p.description ? ': ' + p.description : ''}`);
      if (resources.length) {lines.push('', '## Resources', ''); for (const r of resources) lines.push(`- \`${r.uri}\` — ${r.title}${r.description ? ': ' + r.description : ''}`);}
      if (Object.keys(routes).length) {lines.push('', '## Routes for navigation', ''); for (const [route, label] of Object.entries(routes)) lines.push(`- \`${route}\` — ${label}`);}
      if (grantNames.length) lines.push('', '## Product tools granted', '', grantNames.map(n => `\`${n}\``).join(', '));
      return lines.join('\n');
    },
  };
  return Object.freeze(app);
}

/**
 * Serve the application's whole agent surface from one router (Node or fetch).
 * @param origin          exact application origin
 * @param authorizeOwner  async (request) => owner/user ID | true | false (the app's own session check)
 * @param runtimeTokenFile  bearer token the Augmentor tool module presents (or `authenticateRuntime`)
 * @param dataDir         directory for the SDK's SQLite stores (or pass `stores`)
 * @param client          AugmentorClient for background runs and automation (optional)
 * @param proxy           {profile, tokenFile, socketPath?, port?} to mount the maintained panel at /augmentor/
 * @param mcp             {tokenFile} to expose the MCP server at {basePath}/mcp
 */
export function createAugmentorServer(app, {origin, authorizeOwner, runtimeTokenFile, authenticateRuntime, dataDir, stores = {}, client, interactions, proxy, mcp,
  basePath = '/api/augmentor', services = {}, policy = {}, automation: configureAutomation, eventTypes = ['*'], allowedHosts} = {}) {
  check(app?.kind === 'app', 'INVALID_REQUEST', 'Pass the result of defineApp()');
  check(new URL(origin).origin === origin, 'INVALID_ORIGIN', 'Exact application origin required');
  check(typeof authorizeOwner === 'function', 'INVALID_REQUEST', 'authorizeOwner is required: the application\'s own owner/session check');
  if (dataDir) mkdirSync(dataDir, {recursive: true, mode: 0o700});
  const file = name => dataDir ? join(dataDir, name) : ':memory:';
  const events = stores.events || new EventHub();
  const proposals = stores.proposals || new ProposalStore(file('proposals.sqlite'));
  const activity = stores.activity || new ActivityLog(file('activity.sqlite'));
  const operations = stores.operations || new OperationStore(file('operations.sqlite'));
  const jobs = stores.jobs || new JobStore(file('jobs.sqlite'));
  const bridge = app.ui ? createUiBridge({origin, authorize: authorizeOwner, path: basePath + '/ui', actions: app.uiActions, events, singleOwner: !authenticateRuntime}) : null;
  const toolkit = createToolkit({tools: app.allTools({proposals, bridge}), proposals, activity, events, operations, services, policy, appName: app.name});
  const runner = client ? new AgentRunner({client, events, activity, interactions}) : null;
  const automation = runner ? createAutomation({runner, jobs, events, prompts: app.prompts, activity}) : null;
  if (automation && configureAutomation) configureAutomation(automation, {app, toolkit, events});
  const tool = createToolEndpoint({toolkit, tokenFile: runtimeTokenFile, authenticate: authenticateRuntime, allowedHosts});
  const review = createReviewEndpoint({toolkit, proposals, origin, authorize: authorizeOwner, path: basePath + '/review'});
  const stream = createEventStream(events, {authorize: authorizeOwner, types: eventTypes});
  const mcpServer = mcp ? createMcpServer({toolkit, prompts: app.prompts, resources: app.resources, name: app.id, title: app.name, tokenFile: mcp.tokenFile, authenticate: mcp.authenticate, instructions: app.description || undefined}) : null;
  const panel = proxy ? createProxy({profile: proxy.profile || app.id, origin, tokenFile: proxy.tokenFile, authorize: proxy.authorize || authorizeOwner, socketPath: proxy.socketPath, port: proxy.port, path: proxy.path || '/augmentor/'}) : null;
  const runs = new Map();

  async function owner(request) {
    if (!sameOrigin(request, origin)) return null;
    const who = await Promise.resolve().then(() => authorizeOwner(request)).catch(() => false);
    return who ? (who === true ? 'owner' : String(who)) : null;
  }
  // Owner-facing routes that are not delegated to a sub-endpoint.
  const ownerRoutes = adapt(async request => {
    try {
      const who = await owner(request);
      if (!who) return failure(403, 'PERMISSION_DENIED', 'Owner session required');
      const url = new URL(request.url, origin), path = url.pathname.slice(basePath.length);
      let m;
      if (request.method === 'GET' && path === '/prompts') return json(200, {items: app.prompts.list()});
      if (request.method === 'POST' && (m = /^\/prompts\/([a-z][a-z0-9_.-]{0,79})\/(render|run)$/.exec(path))) {
        const body = await readJson(request, 64 * 1024);
        const rendered = app.prompts.render(m[1], body?.vars || {}, {mode: body?.mode, extraContext: body?.context && typeof body.context === 'object' ? body.context : undefined});
        if (m[2] === 'render') return json(200, rendered);
        if (!runner) return failure(503, 'RUNTIME_UNAVAILABLE', 'Background runs need an Augmentor client on the server');
        const runId = randomUUID(); runs.set(runId, {status: 'running', prompt: m[1], startedAt: new Date().toISOString()});
        if (runs.size > 200) runs.delete(runs.keys().next().value);
        runner.run({text: rendered.text, context: rendered.context, title: rendered.title, model: rendered.model, subject: 'prompt:' + m[1]})
          .then(result => runs.set(runId, {...runs.get(runId), status: result.status, text: result.text, sessionId: result.sessionId, toolCalls: result.toolCalls.length}))
          .catch(error => runs.set(runId, {...runs.get(runId), status: 'failed', code: error.code}));
        return json(202, {runId});
      }
      if (request.method === 'GET' && (m = /^\/runs\/([0-9a-f-]{36})$/.exec(path))) {const run = runs.get(m[1]); return run ? json(200, run) : failure(404, 'NOT_FOUND', 'Unknown run');}
      if (request.method === 'GET' && path === '/activity') return json(200, {items: activity.list({kind: url.searchParams.get('kind') || undefined, subject: url.searchParams.get('subject') || undefined, limit: url.searchParams.get('limit') || 50})});
      if (request.method === 'GET' && path === '/automation') return json(200, automation ? automation.status() : {started: false, rules: []});
      if (request.method === 'POST' && /^\/automation\/(pause|resume)$/.test(path)) {
        if (!automation) return failure(503, 'RUNTIME_UNAVAILABLE', 'No automation configured');
        path.endsWith('pause') ? automation.pause(`paused by ${who}`) : automation.resume(); return json(200, automation.status());
      }
      if (request.method === 'GET' && path === '/reference') return {status: 200, headers: {'Content-Type': 'text/markdown; charset=utf-8'}, body: app.reference()};
      return failure(404, 'NOT_FOUND', 'Unknown Augmentor route');
    } catch (error) {return errorResponse(error);}
  });

  const route = pathname => {
    if (panel && pathname.startsWith(proxy.path || '/augmentor/')) return 'panel';
    if (!pathname.startsWith(basePath + '/') && pathname !== basePath) return null;
    const rest = pathname.slice(basePath.length);
    if (rest === '/tool') return 'tool';
    if (rest === '/review' || rest.startsWith('/review/')) return 'review';
    if (bridge && (rest === '/ui' || rest.startsWith('/ui/'))) return 'ui';
    if (rest === '/events') return 'events';
    if (rest === '/mcp') return mcpServer ? 'mcp' : null;
    return 'owner';
  };

  const server = {
    app, toolkit, events, proposals, activity, operations, jobs, runner, automation, bridge, mcp: mcpServer,
    /** Node handler. Resolves true when the request was handled; false lets the app route it. */
    async node(req, res) {
      const kind = route(new URL(req.url || '/', origin).pathname);
      if (!kind) return false;
      if (kind === 'panel') {await panel.http(req, res); return true;}
      if (kind === 'events') {if (req.method !== 'GET') {send(res, {status: 405, headers: {Allow: 'GET'}}); return true;} await stream.node(req, res); return true;}
      const handler = {tool, review, ui: bridge, mcp: mcpServer, owner: ownerRoutes}[kind];
      await handler.node(req, res); return true;
    },
    /** WebSocket upgrades for the maintained panel. Returns true when handled. */
    upgrade(req, socket, head) {
      if (!panel || !new URL(req.url || '/', origin).pathname.startsWith(proxy.path || '/augmentor/')) return false;
      void panel.upgrade(req, socket, head); return true;
    },
    /** Fetch handler (Next.js route handlers, etc.). Resolves null when not handled. */
    async fetch(request) {
      const kind = route(new URL(request.url).pathname);
      if (!kind) return null;
      if (kind === 'panel') return toResponse(failure(501, 'UNSUPPORTED', 'Serve the panel proxy from a Node server; fetch handlers cannot proxy WebSockets'));
      if (kind === 'events') return stream.fetch(request);
      return {tool, review, ui: bridge, mcp: mcpServer, owner: ownerRoutes}[kind].fetch(request);
    },
    start() {automation?.start(); return server;},
    close() {automation?.stop(); client?.close?.(); for (const s of [proposals, activity, operations, jobs]) {try {s.close();} catch {}}},
  };
  return server;
}

/** Normalise either kind of request for app code that wants one shape. */
export const normalizeRequest = request => typeof request?.headers?.get === 'function' ? fromFetch(request) : fromNode(request);
