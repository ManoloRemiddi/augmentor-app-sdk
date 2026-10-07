// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
// Browser entry. Hosting only: Augmentor serves and owns the complete maintained panel.
// For apps without a bundler, serve dist/augmentor-browser.mjs (one self-contained file).
export {mountAugmentor} from './browser/panel.mjs';
export {applyPanelTheme, themePreferences, hexToHue} from './browser/theme.mjs';
export {connectPage, subscribe, showToast, showOverlay, highlight} from './browser/page.mjs';
export {renderAgentUi, ensureStyles, lineDiff} from './browser/render.mjs';
export {mountReviewQueue} from './browser/review.mjs';
export {createAgent, bindPromptButtons} from './browser/agent.mjs';
export {snapshotContext} from './context.mjs';
export {UI_TYPES} from './ui-spec.mjs';
