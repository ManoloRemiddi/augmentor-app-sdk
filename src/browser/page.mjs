// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
// The page side of the UI bridge: receive agent commands, run the application's handlers,
// report presence and a semantic description of the current view.
import {renderAgentUi, ensureStyles, safeHref} from './render.mjs';

const randomId = () => (globalThis.crypto?.randomUUID?.() ?? Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join(''));

/** Show a toast (used by the default `notify` handler). */
export function showToast(message, {tone = 'info', href, timeoutMs = 6000, document: doc = document} = {}) {
  ensureStyles(doc);
  let host = doc.querySelector('.augmentor-toasts');
  if (!host) {host = doc.createElement('div'); host.className = 'augmentor-toasts'; host.setAttribute('role', 'status'); host.setAttribute('aria-live', 'polite'); doc.body.append(host);}
  const toast = doc.createElement('div'); toast.className = 'augmentor-toast'; toast.dataset.tone = tone; toast.textContent = message;
  const link = safeHref(href); if (link) {const a = doc.createElement('a'); a.href = link; a.textContent = 'Open'; toast.append(a);}
  host.append(toast); setTimeout(() => toast.remove(), timeoutMs);
  return toast;
}

/** Show content in a dismissible overlay (used by the default `show` and `ask` handlers). */
export function showOverlay(content, {document: doc = document, label = 'Augmentor', onClose} = {}) {
  ensureStyles(doc);
  doc.querySelector('.augmentor-overlay')?.remove();
  const box = doc.createElement('aside'); box.className = 'augmentor-overlay'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', label);
  const close = doc.createElement('button'); close.className = 'augmentor-close'; close.type = 'button'; close.textContent = '×'; close.setAttribute('aria-label', 'Close');
  close.addEventListener('click', () => {box.remove(); onClose?.();});
  box.append(close, content); doc.body.append(box);
  return box;
}

/** Highlight an element marked with data-augmentor-key="<target>" and optionally a text match. */
export function highlight({target, text, note}, {document: doc = document, durationMs = 4000} = {}) {
  ensureStyles(doc);
  const escaped = globalThis.CSS?.escape ? CSS.escape(target) : String(target).replace(/["\\]/g, '\\$&');
  const element = doc.querySelector(`[data-augmentor-key="${escaped}"]`);
  if (!element) return {found: false};
  element.classList.add('augmentor-highlight'); element.scrollIntoView?.({block: 'center', behavior: 'smooth'});
  if (note) element.setAttribute('data-augmentor-note', note);
  setTimeout(() => {element.classList.remove('augmentor-highlight'); element.removeAttribute('data-augmentor-note');}, durationMs);
  let textFound = false;
  if (text && globalThis.getSelection && doc.createTreeWalker) {
    const walker = doc.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const index = node.nodeValue.indexOf(text);
      if (index >= 0) {const range = doc.createRange(); range.setStart(node, index); range.setEnd(node, index + text.length); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range); textFound = true; break;}
    }
  }
  return {found: true, ...(text ? {textFound} : {})};
}

/**
 * Connect this page to the server UI bridge.
 * @param actions       {name: async (args, {pageId}) => result} — app handlers (navigate, open, fill, custom…)
 * @param describeView  () => object — the current route, selection and visible records
 * @param components    custom components for `show` specs
 * @param webmcp        also register custom actions as WebMCP page tools when available
 */
export function connectPage({endpoint = '/api/augmentor/ui', actions = {}, describeView = () => ({route: location.pathname + location.search, title: document.title}),
  components = {}, onAction, webmcp = true, EventSourceImpl = globalThis.EventSource, fetchImpl = globalThis.fetch?.bind(globalThis), document: doc = globalThis.document} = {}) {
  const pageId = randomId();
  const base = endpoint.replace(/\/$/, '');
  const post = (route, body) => fetchImpl(base + route, {method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)}).catch(() => null);
  const defaults = {
    view: () => describeView(),
    notify: ({message, tone, href}) => {showToast(message, {tone, href, document: doc}); return {shown: true};},
    highlight: args => highlight(args, {document: doc}),
    show: ({spec}) => {showOverlay(renderAgentUi(spec, {components, document: doc, onAction: action => onAction?.(action, spec)}), {document: doc}); return {shown: true};},
    ask: ({spec}) => new Promise(resolve => {
      const overlay = showOverlay(renderAgentUi(spec, {components, document: doc, onSubmit: values => {overlay.remove(); resolve({answered: true, values});}}), {document: doc, onClose: () => resolve({answered: false})});
    }),
  };
  const handlers = {...defaults, ...actions};
  let source, viewTimer, closed = false;
  const reportView = () => {clearTimeout(viewTimer); viewTimer = setTimeout(() => {let view; try {view = describeView();} catch {view = null;} if (view) post('/presence', {page: pageId, view});}, 250);};
  const focus = () => post('/presence', {page: pageId, focused: doc.visibilityState !== 'hidden' && doc.hasFocus?.() !== false});
  const open = () => {
    source = new EventSourceImpl(`${base}/stream?page=${encodeURIComponent(pageId)}`, {withCredentials: true});
    source.addEventListener('ready', () => {focus(); reportView(); post('/presence', {page: pageId, actions: Object.keys(handlers)});});
    source.addEventListener('command', async event => {
      let command; try {command = JSON.parse(event.data);} catch {return;}
      const handler = Object.hasOwn(handlers, command.action) ? handlers[command.action] : null;
      if (!handler) return post('/result', {id: command.id, ok: false, code: 'UNSUPPORTED_ACTION', error: `This page cannot ${command.action}`});
      try {const result = await handler(command.args || {}, {pageId}); await post('/result', {id: command.id, ok: true, result: result ?? null}); if (command.action !== 'view') reportView();}
      catch (error) {await post('/result', {id: command.id, ok: false, code: error?.code || 'UI_FAILED', error: String(error?.message || 'The page could not complete the action').slice(0, 500)});}
    });
  };
  open();
  const listeners = [['focus', focus], ['blur', focus], ['popstate', reportView], ['hashchange', reportView]];
  for (const [name, fn] of listeners) globalThis.addEventListener?.(name, fn);
  doc.addEventListener?.('visibilitychange', focus);
  // WebMCP (W3C CG draft): expose the app's own page actions to in-browser agents too.
  const registrations = [];
  const modelContext = doc.modelContext || globalThis.navigator?.modelContext;
  if (webmcp && modelContext?.registerTool) {
    for (const [name, handler] of Object.entries(actions)) {
      try {registrations.push(modelContext.registerTool({name: 'augmentor_' + name.replace(/[^A-Za-z0-9_]/g, '_'), description: `Application page action: ${name}`, inputSchema: {type: 'object'}, execute: args => handler(args || {}, {pageId, source: 'webmcp'})}));} catch {}
    }
  }
  return {
    pageId,
    /** Call after the app's own navigation or selection changes. */
    updateView: reportView,
    disconnect() {
      if (closed) return; closed = true; source?.close(); clearTimeout(viewTimer);
      for (const [name, fn] of listeners) globalThis.removeEventListener?.(name, fn);
      doc.removeEventListener?.('visibilitychange', focus);
      for (const r of registrations) try {r?.unregister?.();} catch {}
    },
  };
}

/** Subscribe to the server's change feed (Server-Sent Events). Returns a close function. */
export function subscribe(url, handler, {types, EventSourceImpl = globalThis.EventSource} = {}) {
  const source = new EventSourceImpl(url, {withCredentials: true});
  const deliver = event => {try {handler(JSON.parse(event.data));} catch {}};
  if (types?.length) for (const type of types) source.addEventListener(type, deliver);
  else source.onmessage = deliver;
  // Named events are not delivered to onmessage; listen to the common SDK families as well.
  if (!types?.length) for (const type of ['tool.completed', 'tool.progress', 'proposal.created', 'proposal.decided', 'proposal.executed', 'proposal.failed', 'agent.run.started', 'agent.run.finished', 'job.queued', 'job.started', 'job.finished']) source.addEventListener(type, deliver);
  return () => source.close();
}
