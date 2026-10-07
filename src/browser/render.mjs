// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
// Render agent UI specs (src/ui-spec.mjs) with DOM APIs only: text is always textContent,
// links are limited to #, / and https:, and custom components come from the host's registry.

const STYLE_ID = 'augmentor-ui-styles';
const CSS = `
.augmentor-ui{font:inherit;color:var(--augmentor-ui-text,inherit);display:grid;gap:.6rem}
.augmentor-ui-card{border:1px solid var(--augmentor-ui-border,#d0d4da);border-radius:var(--augmentor-ui-radius,10px);padding:.8rem 1rem;background:var(--augmentor-ui-surface,transparent)}
.augmentor-ui-card[data-tone=info]{border-color:var(--augmentor-ui-info,#3b82f6)}.augmentor-ui-card[data-tone=success]{border-color:var(--augmentor-ui-success,#16a34a)}
.augmentor-ui-card[data-tone=warning]{border-color:var(--augmentor-ui-warning,#d97706)}.augmentor-ui-card[data-tone=danger]{border-color:var(--augmentor-ui-danger,#dc2626)}
.augmentor-ui-title{font-weight:600;margin:0}.augmentor-ui-sub{opacity:.75;margin:0}.augmentor-ui-body{white-space:pre-wrap;margin:0}
.augmentor-ui-fields{display:grid;grid-template-columns:max-content 1fr;gap:.2rem .8rem;margin:0}.augmentor-ui-fields dt{opacity:.7}.augmentor-ui-fields dd{margin:0}
.augmentor-ui-badges{display:flex;flex-wrap:wrap;gap:.3rem}.augmentor-ui-badge{font-size:.75em;padding:.1rem .45rem;border-radius:999px;background:var(--augmentor-ui-badge,#eef0f3)}
.augmentor-ui-actions{display:flex;flex-wrap:wrap;gap:.4rem}.augmentor-ui-actions button,.augmentor-ui-actions a,.augmentor-ui form button{font:inherit;padding:.3rem .7rem;border-radius:6px;border:1px solid var(--augmentor-ui-accent,#2563eb);background:transparent;color:var(--augmentor-ui-accent,#2563eb);cursor:pointer;text-decoration:none}
.augmentor-ui-actions button.primary,.augmentor-ui form button[type=submit]{background:var(--augmentor-ui-accent,#2563eb);color:var(--augmentor-ui-on-accent,#fff)}
.augmentor-ui table{border-collapse:collapse;width:100%}.augmentor-ui th,.augmentor-ui td{padding:.3rem .5rem;border-bottom:1px solid var(--augmentor-ui-border,#d0d4da);text-align:left}
.augmentor-ui-diff{font-family:ui-monospace,monospace;font-size:.85em;white-space:pre-wrap;margin:0}.augmentor-ui-diff .add{background:var(--augmentor-ui-add,#dcfce7)}.augmentor-ui-diff .del{background:var(--augmentor-ui-del,#fee2e2);text-decoration:line-through}
.augmentor-ui form{display:grid;gap:.5rem}.augmentor-ui label{display:grid;gap:.2rem}.augmentor-ui input,.augmentor-ui select,.augmentor-ui textarea{font:inherit;padding:.3rem;border:1px solid var(--augmentor-ui-border,#d0d4da);border-radius:6px}
.augmentor-ui-receipt[data-status=done]{border-left:4px solid var(--augmentor-ui-success,#16a34a)}.augmentor-ui-receipt[data-status=failed]{border-left:4px solid var(--augmentor-ui-danger,#dc2626)}.augmentor-ui-receipt[data-status=pending]{border-left:4px solid var(--augmentor-ui-warning,#d97706)}
.augmentor-ui-chart svg{width:100%;height:auto;max-height:240px}.augmentor-ui-chart text{font-size:10px;fill:currentColor}
.augmentor-highlight{outline:3px solid var(--augmentor-ui-accent,#2563eb);outline-offset:3px;transition:outline-color .6s}
.augmentor-toasts{position:fixed;right:1rem;bottom:1rem;display:grid;gap:.5rem;z-index:2147483000;max-width:min(380px,90vw)}
.augmentor-toast{padding:.6rem .9rem;border-radius:8px;background:var(--augmentor-ui-toast,#111827);color:var(--augmentor-ui-on-toast,#fff);box-shadow:0 4px 18px rgba(0,0,0,.2)}
.augmentor-toast a{color:inherit;margin-left:.5rem}
.augmentor-overlay{position:fixed;inset:auto 1rem 1rem auto;width:min(520px,94vw);max-height:80vh;overflow:auto;background:var(--augmentor-ui-overlay,#fff);color:var(--augmentor-ui-text,#111);border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,.25);padding:1rem;z-index:2147482999}
.augmentor-overlay>.augmentor-close{display:block;margin-left:auto;border:0;background:transparent;font-size:1.2rem;cursor:pointer;color:inherit}
`;

export function ensureStyles(doc = document) {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style'); style.id = STYLE_ID; style.textContent = CSS; doc.head.append(style);
}

export const safeHref = value => typeof value === 'string' && /^(#|\/(?!\/)|https:\/\/)/.test(value) ? value : null;

function el(doc, tag, className, text) {
  const node = doc.createElement(tag); if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

/** Line diff (longest common subsequence) for short texts. */
export function lineDiff(before, after) {
  const a = String(before).split('\n'), b = String(after).split('\n');
  if (a.length * b.length > 250000) return [...a.map(t => ({op: 'del', text: t})), ...b.map(t => ({op: 'add', text: t}))];
  const dp = Array.from({length: a.length + 1}, () => new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = []; let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {out.push({op: 'same', text: a[i]}); i++; j++;}
    else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({op: 'del', text: a[i++]});
    else out.push({op: 'add', text: b[j++]});
  }
  while (i < a.length) out.push({op: 'del', text: a[i++]});
  while (j < b.length) out.push({op: 'add', text: b[j++]});
  return out;
}

function chart(doc, spec) {
  const NS = 'http://www.w3.org/2000/svg', W = 320, H = 160, pad = 24;
  const svg = doc.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('role', 'img');
  if (spec.title) svg.setAttribute('aria-label', spec.title);
  const points = spec.series.flatMap(s => s.points);
  const xs = [...new Set(points.map(p => String(p.x)))];
  const max = Math.max(0, ...points.map(p => p.y)), min = Math.min(0, ...points.map(p => p.y)), span = max - min || 1;
  const y = v => H - pad - ((v - min) / span) * (H - pad * 2);
  const x = i => pad + (xs.length <= 1 ? (W - pad * 2) / 2 : (i * (W - pad * 2)) / (xs.length - 1));
  const colours = ['var(--augmentor-ui-accent,#2563eb)', '#16a34a', '#d97706', '#9333ea', '#dc2626', '#0891b2'];
  spec.series.forEach((series, si) => {
    if (spec.kind === 'bar') {
      const width = Math.max(2, (W - pad * 2) / Math.max(1, xs.length) / spec.series.length - 2);
      for (const p of series.points) {
        const i = xs.indexOf(String(p.x)), rect = doc.createElementNS(NS, 'rect');
        const left = pad + (i * (W - pad * 2)) / Math.max(1, xs.length) + si * width;
        rect.setAttribute('x', left); rect.setAttribute('width', width); rect.setAttribute('y', Math.min(y(p.y), y(0))); rect.setAttribute('height', Math.abs(y(p.y) - y(0)));
        rect.setAttribute('fill', colours[si % colours.length]); const t = doc.createElementNS(NS, 'title'); t.textContent = `${series.label}: ${p.x} = ${p.y}${spec.unit ? ' ' + spec.unit : ''}`; rect.append(t); svg.append(rect);
      }
    } else {
      const line = doc.createElementNS(NS, 'polyline');
      line.setAttribute('points', series.points.map(p => `${x(xs.indexOf(String(p.x)))},${y(p.y)}`).join(' '));
      line.setAttribute('fill', 'none'); line.setAttribute('stroke', colours[si % colours.length]); line.setAttribute('stroke-width', '2'); svg.append(line);
    }
  });
  [xs[0], xs.at(-1)].forEach((label, k) => {if (label === undefined) return; const t = doc.createElementNS(NS, 'text'); t.setAttribute('x', k ? W - pad : pad); t.setAttribute('y', H - 6); t.setAttribute('text-anchor', k ? 'end' : 'start'); t.textContent = label; svg.append(t);});
  const top = doc.createElementNS(NS, 'text'); top.setAttribute('x', 2); top.setAttribute('y', 12); top.textContent = `${max}${spec.unit ? ' ' + spec.unit : ''}`; svg.append(top);
  return svg;
}

/**
 * Render a spec. Options: `onAction(action, spec)` for card buttons, `onSubmit(values)` for
 * forms and choices, `components` = {name: (props, {document}) => Element} for custom specs.
 */
export function renderAgentUi(spec, {onAction = () => {}, onSubmit = () => {}, components = {}, document: doc = globalThis.document} = {}) {
  ensureStyles(doc);
  const root = el(doc, 'div', 'augmentor-ui'); root.dataset.type = spec?.type ?? 'unknown';
  const heading = text => {if (text) root.append(el(doc, 'p', 'augmentor-ui-title', text));};
  switch (spec?.type) {
    case 'text': root.append(el(doc, 'p', 'augmentor-ui-body', spec.text)); break;
    case 'stack': heading(spec.title); for (const child of spec.children || []) root.append(renderAgentUi(child, {onAction, onSubmit, components, document: doc})); break;
    case 'card': {
      const card = el(doc, 'section', 'augmentor-ui-card'); if (spec.tone) card.dataset.tone = spec.tone;
      card.append(el(doc, 'p', 'augmentor-ui-title', spec.title));
      if (spec.subtitle) card.append(el(doc, 'p', 'augmentor-ui-sub', spec.subtitle));
      if (spec.badges?.length) {const b = el(doc, 'div', 'augmentor-ui-badges'); for (const t of spec.badges) b.append(el(doc, 'span', 'augmentor-ui-badge', t)); card.append(b);}
      if (spec.body) card.append(el(doc, 'p', 'augmentor-ui-body', spec.body));
      if (spec.fields?.length) {const dl = el(doc, 'dl', 'augmentor-ui-fields'); for (const f of spec.fields) dl.append(el(doc, 'dt', '', f.label), el(doc, 'dd', '', f.value ?? '—')); card.append(dl);}
      if (spec.actions?.length) {
        const row = el(doc, 'div', 'augmentor-ui-actions');
        spec.actions.forEach((action, i) => {
          const href = safeHref(action.href);
          if (href && !action.prompt && !action.action) {const a = el(doc, 'a', '', action.label); a.href = href; if (href.startsWith('https://')) {a.target = '_blank'; a.rel = 'noopener noreferrer';} row.append(a);}
          else {const button = el(doc, 'button', i === 0 ? 'primary' : '', action.label); button.type = 'button'; button.addEventListener('click', () => onAction(action, spec)); row.append(button);}
        });
        card.append(row);
      }
      root.append(card); break;
    }
    case 'table': {
      heading(spec.title);
      const table = el(doc, 'table'), head = el(doc, 'thead'), hr = el(doc, 'tr');
      for (const c of spec.columns) {const th = el(doc, 'th', '', c.label); if (c.align) th.style.textAlign = c.align; hr.append(th);}
      head.append(hr); table.append(head);
      const body = el(doc, 'tbody');
      for (const row of spec.rows) {const tr = el(doc, 'tr'); for (const c of spec.columns) {const td = el(doc, 'td', '', row[c.key] ?? ''); if (c.align) td.style.textAlign = c.align; tr.append(td);} body.append(tr);}
      table.append(body); if (spec.caption) table.append(el(doc, 'caption', '', spec.caption)); root.append(table); break;
    }
    case 'list': {
      heading(spec.title); const list = el(doc, spec.ordered ? 'ol' : 'ul');
      for (const item of spec.items) {
        const li = el(doc, 'li'); const href = safeHref(item.href);
        const title = href ? Object.assign(el(doc, 'a', '', item.title), {href}) : el(doc, 'strong', '', item.title); li.append(title);
        if (item.badge) li.append(' ', el(doc, 'span', 'augmentor-ui-badge', item.badge));
        if (item.detail) li.append(el(doc, 'div', 'augmentor-ui-sub', item.detail));
        list.append(li);
      }
      root.append(list); break;
    }
    case 'checklist': {
      heading(spec.title); const list = el(doc, 'ul'); list.style.listStyle = 'none'; list.style.padding = '0';
      for (const item of spec.items) {
        const label = el(doc, 'label'), box = el(doc, 'input'); box.type = 'checkbox'; box.checked = !!item.checked; box.dataset.id = item.id;
        box.addEventListener('change', () => onSubmit({[item.id]: box.checked}));
        label.style.display = 'flex'; label.style.gap = '.5rem'; label.append(box, el(doc, 'span', '', item.label)); const li = el(doc, 'li'); li.append(label); list.append(li);
      }
      root.append(list); break;
    }
    case 'diff': {
      heading(spec.title); const pre = el(doc, 'pre', 'augmentor-ui-diff');
      for (const part of lineDiff(spec.before, spec.after)) {const line = el(doc, 'div', part.op === 'same' ? '' : part.op, (part.op === 'add' ? '+ ' : part.op === 'del' ? '- ' : '  ') + part.text); pre.append(line);}
      root.append(pre); break;
    }
    case 'chart': {const box = el(doc, 'figure', 'augmentor-ui-chart'); if (spec.title) box.append(el(doc, 'figcaption', 'augmentor-ui-title', spec.title)); box.append(chart(doc, spec)); root.append(box); break;}
    case 'form': {
      heading(spec.title); if (spec.description) root.append(el(doc, 'p', 'augmentor-ui-sub', spec.description));
      const form = el(doc, 'form');
      for (const f of spec.fields) {
        const label = el(doc, 'label'); label.append(el(doc, 'span', '', f.label + (f.required ? ' *' : '')));
        let input;
        if (f.input === 'textarea') input = el(doc, 'textarea');
        else if (f.input === 'select') {input = el(doc, 'select'); for (const o of f.options || []) {const opt = el(doc, 'option', '', o.label); opt.value = o.value; input.append(opt);}}
        else {input = el(doc, 'input'); input.type = {number: 'number', checkbox: 'checkbox', date: 'date'}[f.input] || 'text';}
        input.name = f.name; if (f.required) input.required = true; if (f.placeholder) input.placeholder = f.placeholder;
        if (f.value !== undefined && f.value !== null) {if (input.type === 'checkbox') input.checked = !!f.value; else input.value = String(f.value);}
        label.append(input); form.append(label);
      }
      const submit = el(doc, 'button', '', spec.submitLabel || 'Submit'); submit.type = 'submit'; form.append(submit);
      form.addEventListener('submit', event => {
        event.preventDefault(); const values = {};
        for (const f of spec.fields) {const input = form.elements.namedItem(f.name); values[f.name] = f.input === 'checkbox' ? input.checked : f.input === 'number' ? (input.value === '' ? null : Number(input.value)) : input.value;}
        onSubmit(values);
      });
      root.append(form); break;
    }
    case 'choice': {
      heading(spec.title); root.append(el(doc, 'p', 'augmentor-ui-body', spec.question));
      const row = el(doc, 'div', 'augmentor-ui-actions'), chosen = new Set();
      for (const option of spec.options) {
        const button = el(doc, 'button', '', option.label); button.type = 'button'; if (option.description) button.title = option.description;
        button.addEventListener('click', () => {
          if (!spec.multiple) return onSubmit({selected: [option.id]});
          chosen.has(option.id) ? chosen.delete(option.id) : chosen.add(option.id); button.classList.toggle('primary', chosen.has(option.id));
        });
        row.append(button);
      }
      if (spec.multiple) {const done = el(doc, 'button', 'primary', 'Done'); done.type = 'button'; done.addEventListener('click', () => onSubmit({selected: [...chosen]})); row.append(done);}
      root.append(row); break;
    }
    case 'receipt': {
      const card = el(doc, 'section', 'augmentor-ui-card augmentor-ui-receipt'); card.dataset.status = spec.status;
      card.append(el(doc, 'p', 'augmentor-ui-title', spec.title)); if (spec.summary) card.append(el(doc, 'p', 'augmentor-ui-body', spec.summary));
      const href = safeHref(spec.href); if (href) {const a = el(doc, 'a', '', 'Open'); a.href = href; card.append(a);}
      root.append(card); break;
    }
    case 'custom': {
      const factory = Object.hasOwn(components, spec.component) ? components[spec.component] : null;
      if (typeof factory === 'function') root.append(factory(spec.props || {}, {document: doc}));
      else root.append(el(doc, 'p', 'augmentor-ui-sub', `Unsupported component: ${spec.component}`));
      break;
    }
    default: root.append(el(doc, 'p', 'augmentor-ui-sub', 'Unsupported content'));
  }
  return root;
}
