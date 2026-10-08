// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
// Hosting the maintained Augmentor panel. Augmentor serves and owns the complete interface;
// this module only mounts it, passes bounded context and relays negotiated messages.
import {snapshotContext} from '../context.mjs';
import {applyPanelTheme} from './theme.mjs';

const randomId = () => (globalThis.crypto?.randomUUID?.() ?? Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join(''));

/**
 * Mount the panel in `container`. Returns synchronously (compatible with 0.1).
 * New options: `allow` (iframe permissions, set before load), `theme` (applied to the
 * workspace before load), `onEvent` (panel events when the panel supports them),
 * `onReady({profile, capabilities})`.
 */
export function mountAugmentor({container, path = '/augmentor/', title = 'Augmentor', allow, theme, onStatus = () => {}, onNavigate = () => {}, onSettings = url => window.open(url, '_blank', 'noopener'), onHide = () => {}, onEvent = () => {}, onReady = () => {}}) {
  if (!(container instanceof Element)) throw Error('A container element is required');
  const base = new URL(path, location.href);
  if (base.origin !== location.origin || !/^\/[a-zA-Z0-9/_-]+\/$/.test(base.pathname) || base.search || base.hash) throw Error('Use the authenticated application proxy on the same origin');
  const frame = document.createElement('iframe'); frame.title = title;
  // Permissions must be declared before the document loads to take effect.
  if (allow) frame.allow = Array.isArray(allow) ? allow.join('; ') : String(allow);
  frame.style.cssText = 'width:100%;height:100%;border:0'; container.append(frame);
  let context = null, ready = false, capabilities = [], profile = null, destroyed = false;
  const waiting = new Map();
  let resolveReady; const readyPromise = new Promise(resolve => {resolveReady = resolve;});
  const post = message => frame.contentWindow?.postMessage(message, base.origin);
  const sendContext = () => {if (ready && context) post({type: 'augmentor-context', context});};
  const listener = event => {
    if (event.origin !== base.origin || event.source !== frame.contentWindow) return;
    const value = event.data;
    if (value?.type === 'augmentor-ready') {
      ready = true; profile = value.profile ?? null;
      capabilities = Array.isArray(value.capabilities) ? value.capabilities.filter(c => typeof c === 'string').slice(0, 50) : [];
      sendContext(); resolveReady({profile, capabilities}); try {onReady({profile, capabilities});} catch {}
    }
    if (value?.type === 'augmentor-status') onStatus({online: value.online === true, busy: value.busy === true, ...(typeof value.sessionId === 'string' ? {sessionId: value.sessionId} : {})});
    if (value?.type === 'augmentor-hide') onHide();
    if (value?.type === 'augmentor-link' && typeof value.hash === 'string' && value.hash.startsWith('#') && value.hash.length <= 2000) onNavigate(value.hash);
    if (value?.type === 'augmentor-settings') {
      try {const u = new URL(value.url); if (u.origin === base.origin && u.pathname === base.pathname + 'settings.html') onSettings(u.href);} catch {}
    }
    // Panel protocol v2 (docs/PANEL-PROTOCOL.md): events and command results.
    if (value?.type === 'augmentor-event' && typeof value.event === 'string') {try {onEvent({event: value.event, data: value.data ?? null});} catch {}}
    if (value?.type === 'augmentor-result' && waiting.has(value.requestId)) {
      const {resolve, reject, timer} = waiting.get(value.requestId); waiting.delete(value.requestId); clearTimeout(timer);
      value.ok === true ? resolve(value.result ?? {}) : reject(Object.assign(new Error(String(value.error || 'The panel refused the request')), {code: value.code || 'PANEL_REFUSED'}));
    }
  };
  window.addEventListener('message', listener);
  const start = () => {if (!destroyed) frame.src = new URL('sidepanel.html', base).href;};
  if (theme) applyPanelTheme(base.pathname, theme).catch(() => {}).finally(start); else start();
  const command = (type, payload, timeoutMs = 15000) => new Promise((resolve, reject) => {
    const requestId = randomId();
    const timer = setTimeout(() => {waiting.delete(requestId); reject(Object.assign(new Error('The panel did not answer'), {code: 'PANEL_TIMEOUT'}));}, timeoutMs);
    waiting.set(requestId, {resolve, reject, timer}); post({type, requestId, ...payload});
  });
  const unsupported = name => Promise.reject(Object.assign(new Error(`This Augmentor panel does not support ${name}; use createAgent().ask() for a background run`), {code: 'UNSUPPORTED'}));
  return {
    frame,
    ready: readyPromise,
    get capabilities() {return [...capabilities];},
    supports: name => capabilities.includes(name),
    setContext(value) {context = snapshotContext(value); sendContext();},
    /** Send (or prefill with send:false) a prompt into the panel conversation. Panel protocol v2. */
    prompt(text, {send = true, fresh = false, context: promptContext} = {}) {
      if (typeof text !== 'string' || !text.trim() || text.length > 16000) return Promise.reject(Object.assign(new Error('Prompt text must be 1 to 16000 characters'), {code: 'INVALID_REQUEST'}));
      if (!capabilities.includes('prompt')) return unsupported('prompt');
      return command('augmentor-prompt', {text, send: send === true, fresh: fresh === true, ...(promptContext ? {context: snapshotContext(promptContext)} : {})});
    },
    newChat() {return capabilities.includes('new-chat') ? command('augmentor-new-chat', {}) : unsupported('new-chat');},
    focus() {frame.focus(); if (capabilities.includes('focus')) post({type: 'augmentor-focus'});},
    destroy() {
      destroyed = true; window.removeEventListener('message', listener); frame.remove(); ready = false;
      for (const {reject, timer} of waiting.values()) {clearTimeout(timer); reject(Object.assign(new Error('Panel closed'), {code: 'PANEL_CLOSED'}));}
      waiting.clear();
    },
  };
}
