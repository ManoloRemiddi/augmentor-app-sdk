// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
import {check} from './errors.mjs';
const STATES = new Set(['supported', 'disabled', 'denied', 'unsupported', 'unknown']);

/** Negotiated API support is not proof that a model, microphone or OS grant is ready. */
export function capabilityState(description, name) {
  const feature = description?.features?.[name];
  return feature && STATES.has(feature.state) ? feature.state : 'unknown';
}

export function requireCapabilities(description, names = []) {
  check(Array.isArray(names) && names.every(name => typeof name === 'string'),
    'INVALID_REQUEST', 'Required capabilities must be an array of names');
  for (const name of names) {
    const state = capabilityState(description, name);
    check(state === 'supported', 'CAPABILITY_UNAVAILABLE',
      `Workspace capability ${name} is ${state}`, {capability: name, state});
  }
  return description;
}
