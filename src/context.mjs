// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
import {check} from './errors.mjs';
export function snapshotContext(value) {
  check(value&&typeof value==='object'&&!Array.isArray(value),'INVALID_CONTEXT','Context must be an object of at most 16 KB');
  let encoded;try{encoded=JSON.stringify(value);}catch{check(false,'INVALID_CONTEXT','Context must be JSON serializable');}
  check(typeof encoded==='string'&&new TextEncoder().encode(encoded).length<=16000,'INVALID_CONTEXT','Context exceeds 16 KB');
  const snapshot=JSON.parse(encoded);
  check(snapshot&&typeof snapshot==='object'&&!Array.isArray(snapshot),'INVALID_CONTEXT','Context must serialize to an object');
  function depth(item,level=0){check(level<=64,'INVALID_CONTEXT','Context exceeds 64 nested levels');if(item&&typeof item==='object')for(const value of Object.values(item))depth(value,level+1);}
  depth(snapshot);return snapshot;
}
