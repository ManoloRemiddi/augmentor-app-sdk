// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
import {connectPage, mountReviewQueue, createAgent, bindPromptButtons, subscribe} from '/sdk.mjs';

const $ = id => document.getElementById(id);
async function render() {
  const state = await (await fetch('/api/state')).json();
  $('mode').textContent = state.mode === 'mock' ? 'mock model (no Augmentor needed)' : 'Augmentor runtime';
  $('deals').replaceChildren(...state.deals.map(d => {
    const card = document.createElement('article'); card.className = 'deal'; card.dataset.augmentorKey = 'deal:' + d.id;
    card.innerHTML = '<h2></h2><small></small><p></p>';
    card.querySelector('h2').textContent = d.brand; card.querySelector('small').textContent = `${d.stage} · v${d.version}`; card.querySelector('p').textContent = d.fee ? `${d.fee} EUR` : 'No fee yet';
    const ask = document.createElement('button'); ask.textContent = 'Explain'; ask.dataset.augmentorPrompt = 'explain_deal'; ask.dataset.augmentorVars = JSON.stringify({dealId: d.id});
    card.append(ask); return card;
  }));
  $('mail').textContent = state.mail.map(m => `${m.from}: ${m.subject}`).join('\n') + (state.sent.length ? ` — ${state.sent.length} reply sent` : '');
}
const log = text => {const line = document.createElement('div'); line.textContent = `${new Date().toLocaleTimeString()} ${text}`; $('activity').prepend(line);};

const agent = createAgent();
bindPromptButtons(document.body, agent, {
  onResult: async ({runId}) => {
    if (!runId) return;
    $('answers').textContent = 'Working…';
    for (;;) {const run = await agent.run(runId); if (run.status !== 'running') {$('answers').textContent = run.text || run.status; break;} await new Promise(r => setTimeout(r, 400));}
  },
  onError: error => {$('answers').textContent = error.message;},
});
connectPage({
  actions: {
    navigate: ({route}) => {history.pushState({}, '', route); return {at: location.pathname};},
    open: ({kind, id}) => {history.pushState({}, '', `/${kind}s/${id}`); document.querySelector(`[data-augmentor-key="${kind}:${id}"]`)?.scrollIntoView({block: 'center'}); return {opened: `${kind}:${id}`};},
    open_calculator: ({deliverable, fee}) => {const f = $('calculator'); f.deliverable.value = deliverable; f.fee.value = fee; f.scrollIntoView({block: 'center'}); return {prefilled: true};},
  },
  describeView: () => ({route: location.pathname, visibleDeals: [...document.querySelectorAll('[data-augmentor-key^="deal:"]')].map(e => e.dataset.augmentorKey)}),
});
mountReviewQueue($('review'), {eventsUrl: '/api/augmentor/events'});
subscribe('/api/augmentor/events', event => {log(`${event.type}${event.subject ? ' ' + event.subject : ''}`); if (['tool.completed', 'proposal.executed'].includes(event.type)) render();});
$('simulate').addEventListener('click', () => fetch('/api/simulate-mail', {method: 'POST'}));
$('calculator').addEventListener('submit', e => {e.preventDefault(); log('Quote saved by the owner');});
render();
