// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
export class AugmentorError extends Error {
  constructor(code, message, details = {}) {
    super(message); this.name = 'AugmentorError'; this.code = code; this.details = details;
  }
}
export function check(condition, code, message, details) {
  if (!condition) throw new AugmentorError(code, message, details);
}
export const SDK_PROTOCOL = 'augmentor-app/1';
export const isId = value => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,160}$/.test(value);
// Same value space as JSON.stringify: undefined/function members are omitted (null in arrays).
const skip = v => v === undefined || typeof v === 'function' || typeof v === 'symbol';
export function canonicalJSON(value) {
  if (value === null || typeof value !== 'object') return skip(value) ? 'null' : JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(item => skip(item) ? 'null' : canonicalJSON(item)).join(',') + ']';
  return '{' + Object.keys(value).filter(key => !skip(value[key])).sort().map(key => JSON.stringify(key) + ':' + canonicalJSON(value[key])).join(',') + '}';
}
