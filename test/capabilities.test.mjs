// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {capabilityState, requireCapabilities, AugmentorClient} from '../src/index.mjs';

test('absent, disabled and denied capabilities never become an implicit permission grant', () => {
  const description = {features: {embed: {state:'supported'}, voice: {state:'disabled'},
    'dictation-settings': {state:'denied'}, 'computer-use': {state:'unsupported'}, bogus: {state:'ready'}}};
  assert.equal(requireCapabilities(description, ['embed']), description);
  for (const [name,state] of [['voice','disabled'], ['dictation-settings','denied'], ['computer-use','unsupported'], ['missing','unknown'], ['bogus','unknown']]) {
    assert.equal(capabilityState(description,name),state);
    assert.throws(() => requireCapabilities(description,[name]), error => error.code === 'CAPABILITY_UNAVAILABLE' && error.details.state === state);
  }
  assert.equal(capabilityState({voice:{enabled:true}},'voice'),'unknown');
  assert.throws(() => new AugmentorClient({profile:'fixture',requiredCapabilities:'voice'}), error => error.code === 'INVALID_REQUEST');
});
