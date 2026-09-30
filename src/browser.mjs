// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
// Hosting only. Augmentor serves and owns the complete maintained interface.
export function mountAugmentor({container, path = '/augmentor/', title = 'Augmentor', onStatus = () => {}, onNavigate = () => {}, onSettings = url => window.open(url, '_blank', 'noopener'), onHide = () => {}}) {
  if (!(container instanceof Element)) throw Error('A container element is required');
  const base = new URL(path, location.href);
  if (base.origin !== location.origin || !/^\/[a-zA-Z0-9/_-]+\/$/.test(base.pathname) || base.search || base.hash) throw Error('Use the authenticated application proxy on the same origin');
  const frame = document.createElement('iframe'); frame.src = new URL('sidepanel.html', base).href; frame.title = title;
  frame.style.cssText = 'width:100%;height:100%;border:0'; container.append(frame);
  let context = null, ready = false;
  const sendContext = () => {if (ready && context) frame.contentWindow.postMessage({type:'augmentor-context', context}, base.origin);};
  const listener = event => {
    if (event.origin !== base.origin || event.source !== frame.contentWindow) return;
    const value = event.data;
    if (value?.type === 'augmentor-ready') {ready = true; sendContext();}
    if (value?.type === 'augmentor-status') onStatus({online: value.online === true, busy: value.busy === true});
    if (value?.type === 'augmentor-hide') onHide();
    if (value?.type === 'augmentor-link' && typeof value.hash === 'string' && value.hash.startsWith('#') && value.hash.length <= 2000) onNavigate(value.hash);
    if (value?.type === 'augmentor-settings') {
      try {const u = new URL(value.url); if (u.origin === base.origin && u.pathname === base.pathname + 'settings.html') onSettings(u.href);} catch {}
    }
  };
  window.addEventListener('message', listener);
  return {
    frame,
    setContext(value) {
      if (!value || typeof value !== 'object' || Array.isArray(value) || new TextEncoder().encode(JSON.stringify(value)).length > 16000) throw Error('Context must be an object of at most 16 KB');
      context = JSON.parse(JSON.stringify(value)); sendContext();
    },
    destroy() {window.removeEventListener('message', listener); frame.remove(); ready = false;},
  };
}
