// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
// UI bridge: the agent steers the application's own pages. Pages connect over Server-Sent
// Events and report presence and a "semantic screen"; agent tool calls are routed to the
// principal's most recently focused page, which runs a declared handler and posts the
// result back. Works with today's runtime: the tools are ordinary application tools.
import {randomUUID} from 'node:crypto';
import {check, AugmentorError} from './errors.mjs';
import {adapt, json, failure, errorResponse, readJson, sameOrigin, fromNode, fromFetch} from './http.mjs';
import {defineTool} from './toolkit.mjs';
import {uiSpecSchema} from './ui-spec.mjs';
import {compileSchema, schemaErrors} from './schema.mjs';

const PAGE = /^[A-Za-z0-9-]{8,64}$/;
const ACTION = /^[a-z][a-z0-9_.-]{0,63}$/;

/** Declare an application-specific page action the agent may invoke (WebMCP-shaped). */
export function defineUiAction({name, description, input = {type: 'object', properties: {}}, effect = 'read', timeoutMs}) {
  check(ACTION.test(name || ''), 'INVALID_TOOL', `Invalid UI action name ${JSON.stringify(name)}`);
  check(typeof description === 'string' && description.trim(), 'INVALID_TOOL', `UI action ${name} needs a description`);
  check(['read', 'draft'].includes(effect), 'INVALID_TOOL', 'UI actions change what the user sees or prefill drafts; data writes belong in tools');
  return Object.freeze({kind: 'ui-action', name, description, input, effect, timeoutMs});
}

export const STANDARD_UI_ACTIONS = [
  defineUiAction({name: 'navigate', description: 'Show a view of the application. Use the routes listed in the instructions.',
    input: {type: 'object', properties: {route: {type: 'string', maxLength: 500, description: 'Application route, e.g. /deals?stage=new'}}, required: ['route']}}),
  defineUiAction({name: 'open', description: 'Open one record (and optionally a tab or field) in the application.',
    input: {type: 'object', properties: {kind: {type: 'string', maxLength: 60}, id: {type: 'string', maxLength: 160}, tab: {type: 'string', maxLength: 60}, field: {type: 'string', maxLength: 60}}, required: ['kind', 'id']}}),
  defineUiAction({name: 'highlight', description: 'Draw the user\'s attention to a record, field or text on the current view.',
    input: {type: 'object', properties: {target: {type: 'string', maxLength: 200, description: 'Element key the page understands, e.g. deal:42 or field:price'}, text: {type: 'string', maxLength: 500, description: 'Optional text to find and mark'}, note: {type: 'string', maxLength: 300}}, required: ['target']}}),
  defineUiAction({name: 'fill', description: 'Prefill a form for the user to review. Never submits.', effect: 'draft',
    input: {type: 'object', properties: {form: {type: 'string', maxLength: 100}, values: {type: 'object'}}, required: ['form', 'values']}}),
  defineUiAction({name: 'notify', description: 'Show a short notice to the user, optionally with a link.',
    input: {type: 'object', properties: {message: {type: 'string', maxLength: 500}, tone: {enum: ['info', 'success', 'warning', 'danger']}, href: {type: 'string', maxLength: 2000, pattern: '^(#|/)'}}, required: ['message']}}),
  defineUiAction({name: 'show', description: 'Show rich content in the application: card, table, list, checklist, diff, chart, receipt or text.',
    input: {type: 'object', properties: {spec: uiSpecSchema(), placement: {enum: ['panel', 'modal', 'inline', 'toast']}}, required: ['spec']}}),
  defineUiAction({name: 'ask', description: 'Ask the user a question in the application (choice or form) and wait for the answer.', timeoutMs: 5 * 60 * 1000,
    input: {type: 'object', properties: {spec: {oneOf: uiSpecSchema().oneOf.filter(b => ['choice', 'form'].includes(b.properties.type.const))}}, required: ['spec']}}),
  defineUiAction({name: 'view', description: 'Describe what the user currently sees: route, selection and visible records.'}),
];

/**
 * @param authorize  async (request) => principal ID (string) or true for the single owner; false to refuse
 * @param origin     exact application origin
 * @param actions    extra defineUiAction() declarations
 * @param singleOwner  true: all admitted pages belong to the owner; false: route by principal ID
 */
export function createUiBridge({authorize, origin, path = '/api/augmentor/ui', actions = [], timeoutMs = 15000, heartbeatMs = 25000, events, singleOwner = true} = {}) {
  check(typeof authorize === 'function' && new URL(origin).origin === origin, 'INVALID_REQUEST', 'authorize and an exact origin are required');
  const declared = new Map([...STANDARD_UI_ACTIONS, ...actions].map(a => [a.name, {...a, validate: compileSchema(a.input, 'UI action ' + a.name)}]));
  const pages = new Map(), waiting = new Map();
  const base = path.replace(/\/$/, '');
  // Single-owner apps: every page the owner check admits belongs to the one owner. Multi-user
  // apps (singleOwner: false) route by the identity the check returns.
  const principalOf = value => singleOwner || value === true ? 'owner' : String(value);

  function target(principal, pageId) {
    if (pageId) {const page = pages.get(pageId); return page?.principal === principal ? page : null;}
    return [...pages.values()].filter(p => p.principal === principal && p.connected).sort((a, b) => (b.focused - a.focused) || (b.seen - a.seen))[0] || null;
  }

  /** Send one command to a page and await its result. */
  async function command(name, args = {}, {principal = 'owner', pageId, timeout} = {}) {
    const action = declared.get(name);
    check(action, 'UNSUPPORTED_ACTION', `UI action ${name} is not declared`);
    check(action.validate(args), 'INVALID_ARGUMENTS', `Arguments for UI action ${name} are invalid`, {errors: schemaErrors(action.validate.errors)});
    if (name === 'view' && !pageId) {
      const page = target(principal);
      if (page?.view && Date.now() - page.viewAt < 2000) return {page: page.id, view: page.view, focused: !!page.focused};
    }
    const page = target(principal, pageId);
    if (!page) throw new AugmentorError('UI_UNAVAILABLE', 'The application is not open for this user right now. Continue without the screen or ask the user to open it.');
    const id = randomUUID();
    const result = new Promise((resolve, reject) => {
      const limit = timeout ?? action.timeoutMs ?? timeoutMs;
      const timer = setTimeout(() => {waiting.delete(id); reject(new AugmentorError('UI_TIMEOUT', `The page did not complete ${name} within ${Math.round(limit / 1000)} seconds`));}, limit);
      waiting.set(id, {resolve, reject, timer, page: page.id});
    });
    page.write('command', {id, action: name, args});
    try {events?.publish('ui.command', {action: name, page: page.id}, {source: 'ui'});} catch {}
    return result;
  }

  const handle = async request => {
    try {
      if (!sameOrigin(request, origin)) return failure(403, 'PERMISSION_DENIED', 'Same-origin request required');
      const who = await Promise.resolve().then(() => authorize(request)).catch(() => false);
      if (!who) return failure(403, 'PERMISSION_DENIED', 'Owner session required');
      const principal = principalOf(who), url = new URL(request.url, origin), route = url.pathname.slice(base.length);
      if (request.method === 'POST' && route === '/result') {
        const body = await readJson(request, 512 * 1024);
        const pending = waiting.get(body?.id);
        if (!pending || pages.get(pending.page)?.principal !== principal) return failure(404, 'NOT_FOUND', 'No pending command with that ID');
        waiting.delete(body.id); clearTimeout(pending.timer);
        if (body.ok === true) pending.resolve(body.result ?? null);
        else pending.reject(new AugmentorError(typeof body.code === 'string' ? body.code.slice(0, 60) : 'UI_FAILED', typeof body.error === 'string' ? body.error.slice(0, 500) : 'The page could not complete the action'));
        return json(200, {ok: true});
      }
      if (request.method === 'POST' && route === '/presence') {
        const body = await readJson(request, 64 * 1024);
        const page = pages.get(body?.page);
        if (!page || page.principal !== principal) return failure(404, 'NOT_FOUND', 'Unknown page');
        if (typeof body.focused === 'boolean') {page.focused = body.focused ? Date.now() : 0;}
        if (body.view && typeof body.view === 'object') {page.view = body.view; page.viewAt = Date.now();}
        if (Array.isArray(body.actions)) page.actions = body.actions.filter(a => typeof a === 'string').slice(0, 100);
        page.seen = Date.now();
        return json(200, {ok: true});
      }
      if (request.method === 'GET' && route === '/actions') return json(200, {actions: [...declared.values()].map(({name, description, input, effect}) => ({name, description, input, effect}))});
      return failure(404, 'NOT_FOUND', 'Unknown UI bridge route');
    } catch (error) {return errorResponse(error);}
  };

  /** Node handler for GET {path}/stream?page=ID (Server-Sent Events). */
  async function stream(req, res) {
    const request = fromNode(req);
    const who = sameOrigin(request, origin) ? await Promise.resolve().then(() => authorize(request)).catch(() => false) : false;
    const pageId = new URL(req.url, origin).searchParams.get('page');
    if (!who || !PAGE.test(pageId || '')) {res.writeHead(403, {'Cache-Control': 'no-store'}); res.end(); return;}
    res.writeHead(200, {'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no'});
    res.write('retry: 2000\n\n');
    const page = attach(principalOf(who), pageId, (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
    const beat = setInterval(() => res.write(': keep-alive\n\n'), heartbeatMs); beat.unref?.();
    req.on('close', () => {clearInterval(beat); detach(page);});
  }

  /** Fetch handler for the same stream route (Next.js route handlers, etc.). */
  async function streamFetch(request) {
    const normalised = fromFetch(request);
    const who = sameOrigin(normalised, origin) ? await Promise.resolve().then(() => authorize(normalised)).catch(() => false) : false;
    const pageId = new URL(request.url).searchParams.get('page');
    if (!who || !PAGE.test(pageId || '')) return new Response(null, {status: 403});
    const encoder = new TextEncoder(); let page, beat;
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('retry: 2000\n\n'));
        page = attach(principalOf(who), pageId, (event, data) => {try {controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));} catch {}});
        beat = setInterval(() => {try {controller.enqueue(encoder.encode(': keep-alive\n\n'));} catch {}}, heartbeatMs); beat.unref?.();
        request.signal?.addEventListener('abort', () => {clearInterval(beat); detach(page);});
      },
      cancel() {clearInterval(beat); detach(page);},
    });
    return new Response(body, {headers: {'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store'}});
  }

  function attach(principal, pageId, write) {
    const existing = pages.get(pageId);
    if (existing && existing.principal !== principal) throw new AugmentorError('PERMISSION_DENIED', 'Page belongs to another user');
    const page = {id: pageId, principal, write, connected: true, focused: existing?.focused ?? Date.now(), seen: Date.now(), view: existing?.view, viewAt: existing?.viewAt ?? 0, actions: existing?.actions ?? []};
    pages.set(pageId, page); write('ready', {page: pageId, actions: [...declared.keys()]});
    return page;
  }
  function detach(page) {
    if (pages.get(page.id) !== page) return;
    page.connected = false; pages.delete(page.id);
    for (const [id, w] of waiting) if (w.page === page.id) {waiting.delete(id); clearTimeout(w.timer); w.reject(new AugmentorError('UI_UNAVAILABLE', 'The page closed before completing the action'));}
  }

  /** Agent tools for every declared action, named `<prefix>_ui_<action>`. */
  function tools({prefix}) {
    check(/^[a-z][a-z0-9_]{0,40}$/.test(prefix || ''), 'INVALID_TOOL', 'A lower-case tool prefix (the app ID) is required');
    return [...declared.values()].map(action => defineTool({name: `${prefix}_ui_${action.name.replace(/[.-]/g, '_')}`, title: `UI: ${action.name}`,
      description: `${action.description} (Acts on the user's open application window; fails with UI_UNAVAILABLE when it is closed.)`,
      input: action.input, effect: action.effect, timeoutMs: (action.timeoutMs ?? timeoutMs) + 1000,
      handler: (args, ctx) => command(action.name, args, {principal: singleOwner || ctx.principal?.kind === 'owner' ? 'owner' : String(ctx.principal?.id)})}));
  }

  const endpoint = adapt(handle);
  return {
    command, tools, stream, streamFetch,
    node: async (req, res) => {if (req.method === 'GET' && new URL(req.url, origin).pathname === base + '/stream') return stream(req, res); return endpoint.node(req, res);},
    fetch: async request => {if (request.method === 'GET' && new URL(request.url).pathname === base + '/stream') return streamFetch(request); return endpoint.fetch(request);},
    pages: (principal = 'owner') => [...pages.values()].filter(p => p.principal === principal).map(p => ({id: p.id, focused: !!p.focused, view: p.view ?? null})),
    actions: () => [...declared.keys()],
  };
}
