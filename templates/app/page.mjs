// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
// Browser wiring through your bundler, or serve the SDK's dist/augmentor-browser.mjs as one file.
import {mountAugmentor, connectPage, mountReviewQueue, createAgent, bindPromptButtons, subscribe} from '@augmentor/app-sdk/browser';

/**
 * @param panel        element for the maintained Augmentor panel
 * @param review       optional element for the owner's review queue
 * @param actions      your page handlers: navigate({route}), open({kind, id}), fill({form, values})…
 * @param describeView () => ({route, selection, visible}) — what the user is looking at
 * @param onChange     (event) => refresh your data after agent writes
 */
export function startAgent({panel, review, actions = {}, describeView, onChange = () => {}, theme}) {
  const handle = mountAugmentor({container: panel, allow: ['microphone', 'clipboard-write'], theme});
  const page = connectPage({actions, describeView});
  const agent = createAgent({panel: handle});
  const unbind = bindPromptButtons(document.body, agent);
  const queue = review ? mountReviewQueue(review, {eventsUrl: '/api/augmentor/events'}) : null;
  const stop = subscribe('/api/augmentor/events', onChange);
  return {panel: handle, page, agent, queue, stop() {unbind(); stop(); page.disconnect(); queue?.destroy(); handle.destroy();}};
}
