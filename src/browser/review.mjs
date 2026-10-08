// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
// Owner review queue ("agent inbox"): pending proposals with Approve, Edit and Reject.
// The server records and executes decisions; this widget only presents them.
import {renderAgentUi, ensureStyles} from './render.mjs';
import {UI_TYPES} from '../ui-spec.mjs';
import {subscribe} from './page.mjs';

export function mountReviewQueue(container, {endpoint = '/api/augmentor/review', eventsUrl, state = 'pending', fetchImpl = globalThis.fetch?.bind(globalThis),
  renderPreview, labels = {}, onDecision = () => {}, EventSourceImpl = globalThis.EventSource, document: doc = globalThis.document} = {}) {
  if (!(container instanceof Element)) throw Error('A container element is required');
  ensureStyles(doc);
  const text = {empty: 'Nothing waiting for review.', approve: 'Approve', edit: 'Edit', reject: 'Reject', save: 'Approve edited', cancel: 'Cancel', note: 'Reason (optional)', error: 'Could not record the decision.', ...labels};
  const base = endpoint.replace(/\/$/, '');
  const root = doc.createElement('div'); root.className = 'augmentor-ui augmentor-review'; container.append(root);
  const el = (tag, cls, t) => {const n = doc.createElement(tag); if (cls) n.className = cls; if (t !== undefined) n.textContent = t; return n;};
  async function decide(item, decision, extra = {}) {
    const response = await fetchImpl(`${base}/${item.id}/decision`, {method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({decision, ...extra})});
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(body.error || text.error), {code: body.code});
    onDecision(body); return body;
  }
  function card(item) {
    const box = el('section', 'augmentor-ui-card'); box.dataset.tone = ['external', 'destructive'].includes(item.risk) ? 'warning' : 'info'; box.dataset.proposal = item.id;
    box.append(el('p', 'augmentor-ui-title', item.summary || item.tool));
    const badges = el('div', 'augmentor-ui-badges'); badges.append(el('span', 'augmentor-ui-badge', item.tool), el('span', 'augmentor-ui-badge', item.risk)); box.append(badges);
    const preview = renderPreview?.(item);
    if (preview instanceof Element) box.append(preview);
    else if (item.preview && UI_TYPES.includes(item.preview.type)) box.append(renderAgentUi(item.preview, {document: doc}));
    const args = el('details'); args.append(el('summary', '', 'Details'), el('pre', 'augmentor-ui-diff', JSON.stringify(item.finalArgs || item.args, null, 2))); box.append(args);
    const status = el('p', 'augmentor-ui-sub'); status.setAttribute('role', 'status');
    const row = el('div', 'augmentor-ui-actions');
    const button = (label, cls, fn) => {const b = el('button', cls, label); b.type = 'button'; b.addEventListener('click', async () => {row.querySelectorAll('button').forEach(x => x.disabled = true); try {await fn();} catch (e) {status.textContent = e.message || text.error; row.querySelectorAll('button').forEach(x => x.disabled = false); return;} await refresh();}); return b;};
    const note = el('input'); note.placeholder = text.note; note.maxLength = 2000;
    row.append(button(text.approve, 'primary', () => decide(item, 'approve')),
      button(text.edit, '', async () => {
        const editor = el('textarea'); editor.value = JSON.stringify(item.args, null, 2); editor.rows = 8; editor.style.width = '100%';
        const save = el('button', 'primary', text.save); save.type = 'button';
        const cancel = el('button', '', text.cancel); cancel.type = 'button';
        const editRow = el('div', 'augmentor-ui-actions'); editRow.append(save, cancel);
        box.replaceChild(editor, row); box.insertBefore(editRow, status);
        await new Promise((resolve, reject) => {
          cancel.addEventListener('click', () => {editor.replaceWith(row); editRow.remove(); row.querySelectorAll('button').forEach(x => x.disabled = false); resolve();});
          save.addEventListener('click', async () => {let args; try {args = JSON.parse(editor.value);} catch {status.textContent = 'Arguments must be valid JSON.'; return;} try {await decide(item, 'edit', {args, note: note.value || undefined}); resolve();} catch (e) {status.textContent = e.message; }});
        });
      }),
      button(text.reject, '', () => decide(item, 'reject', {note: note.value || undefined})));
    box.append(note, row, status);
    return box;
  }
  async function refresh() {
    let items = [];
    try {const response = await fetchImpl(`${base}?state=${encodeURIComponent(state)}`, {credentials: 'same-origin'}); items = response.ok ? (await response.json()).items : [];} catch {}
    root.replaceChildren(...(items.length ? items.map(card) : [el('p', 'augmentor-ui-sub', text.empty)]));
    return items;
  }
  const stop = eventsUrl ? subscribe(eventsUrl, event => {if (String(event.type).startsWith('proposal.')) refresh();}, {types: ['proposal.created', 'proposal.decided', 'proposal.executed', 'proposal.failed'], EventSourceImpl}) : () => {};
  const ready = refresh();
  return {ready, refresh, destroy() {stop(); root.remove();}};
}
