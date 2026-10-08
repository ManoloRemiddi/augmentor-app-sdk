// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
// Panel appearance through the workspace preferences the maintained panel already reads
// (augmentor-theme, augmentor-accent-*, augmentor-neut-*). Applied before the panel loads.

/** Hue (0–360) of a #rgb or #rrggbb colour. */
export function hexToHue(hex) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) throw Error('Use a #rgb or #rrggbb colour');
  const h = m[1].length === 3 ? m[1].split('').map(c => c + c).join('') : m[1];
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (!d) return 0;
  const hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return Math.round((hue * 60 + 360) % 360);
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v))));

/** Map a host theme to panel preference keys. */
export function themePreferences({mode, accent, accentBrightness, neutral, neutralBrightness} = {}) {
  const set = {};
  if (mode !== undefined) {if (!['light', 'dark'].includes(mode)) throw Error('Theme mode is light or dark'); set['augmentor-theme'] = mode;}
  if (accent !== undefined) set['augmentor-accent-hue'] = String(typeof accent === 'number' ? clamp(accent, 0, 360) : hexToHue(accent));
  if (accentBrightness !== undefined) set['augmentor-accent-bright'] = String(clamp(accentBrightness, -15, 15));
  if (neutral !== undefined) set['augmentor-neut-hue'] = String(typeof neutral === 'number' ? clamp(neutral, 0, 360) : hexToHue(neutral));
  if (neutralBrightness !== undefined) set['augmentor-neut-bright'] = String(clamp(neutralBrightness, -15, 15));
  return set;
}

/** Store the theme in the workspace's panel preferences (same-origin, through the proxy). */
export async function applyPanelTheme(basePath, theme, {fetchImpl = globalThis.fetch} = {}) {
  const set = themePreferences(theme);
  if (!Object.keys(set).length) return {};
  const url = new URL('preferences', new URL(basePath, location.href));
  const response = await fetchImpl(url, {method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({set})});
  if (!response.ok) throw Error('The panel preferences could not be updated');
  return set;
}
