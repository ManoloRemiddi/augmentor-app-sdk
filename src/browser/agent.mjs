// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
// The software hands work to the agent: premade prompts rendered on the server, delivered
// into the panel conversation when the panel supports it, otherwise run in the background.

/**
 * @param endpoint  the app's Augmentor API base (createAugmentorServer), default /api/augmentor
 * @param panel     optional mountAugmentor() handle for in-panel delivery
 */
export function createAgent({endpoint = '/api/augmentor', panel, fetchImpl = globalThis.fetch?.bind(globalThis)} = {}) {
  const base = endpoint.replace(/\/$/, '');
  const call = async (path, body) => {
    const response = await fetchImpl(base + path, body === undefined ? {credentials: 'same-origin'} : {method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
    const value = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(value.error || 'Augmentor request failed'), {code: value.code || 'APPLICATION_ERROR', details: value.details});
    return value;
  };
  return {
    /** The app's premade prompt catalogue. */
    prompts: () => call('/prompts').then(v => v.items),
    /**
     * Ask the agent with a premade prompt. `run`: 'auto' (panel when possible), 'panel' or
     * 'background'. Returns {delivered: 'panel'|'background', runId?}.
     */
    async ask(id, vars = {}, {run = 'auto', mode, context, send = true} = {}) {
      const rendered = await call(`/prompts/${encodeURIComponent(id)}/render`, {vars, mode, context});
      const wantsPanel = run === 'panel' || (run === 'auto' && rendered.run !== 'background');
      if (wantsPanel && panel?.supports?.('prompt')) {
        await panel.prompt(rendered.text, {send, fresh: rendered.session === 'new', context: rendered.context});
        return {delivered: 'panel'};
      }
      if (run === 'panel') throw Object.assign(new Error('The Augmentor panel cannot receive prompts from this page yet'), {code: 'UNSUPPORTED'});
      const started = await call(`/prompts/${encodeURIComponent(id)}/run`, {vars, mode, context});
      return {delivered: 'background', runId: started.runId};
    },
    /** Status of a background run: {status, text?, sessionId?}. */
    run: runId => call(`/runs/${encodeURIComponent(runId)}`),
  };
}

/**
 * Wire buttons such as <button data-augmentor-prompt="triage_email" data-augmentor-vars='{"sourceId":"m1"}'>.
 * Returns a function that removes the listener.
 */
export function bindPromptButtons(root, agent, {onResult = () => {}, onError = () => {}} = {}) {
  const listener = async event => {
    const button = event.target?.closest?.('[data-augmentor-prompt]');
    if (!button || !root.contains(button)) return;
    event.preventDefault();
    let vars = {};
    try {vars = button.dataset.augmentorVars ? JSON.parse(button.dataset.augmentorVars) : {};} catch {return onError(Object.assign(new Error('Invalid data-augmentor-vars JSON'), {code: 'INVALID_REQUEST'}), button);}
    button.disabled = true; button.setAttribute('aria-busy', 'true');
    try {onResult(await agent.ask(button.dataset.augmentorPrompt, vars, {run: button.dataset.augmentorRun || 'auto', mode: button.dataset.augmentorMode}), button);}
    catch (error) {onError(error, button);}
    finally {button.disabled = false; button.removeAttribute('aria-busy');}
  };
  root.addEventListener('click', listener);
  return () => root.removeEventListener('click', listener);
}
