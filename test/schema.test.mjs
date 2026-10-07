// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {parameterSchema, compileSchema} from '../src/schema.mjs';
import {toDshParameters} from '../src/dsh-schema.mjs';
import {createApplicationTools} from '../src/tools.mjs';
import {registerDshTools} from '../src/dsh.mjs';

const legacyCards = {cards: {type: 'array', required: true, items: {type: 'object', properties: {front: {type: 'string', required: true}, back: {type: 'string', required: true}}}}};
const jsonCards = {type: 'object', properties: {cards: {type: 'array', items: {type: 'object', properties: {front: {type: 'string'}, back: {type: 'string'}}, required: ['front', 'back']}}}, required: ['cards']};
const union = {type: 'object', required: ['cmd'], properties: {cmd: {oneOf: [
  {type: 'object', properties: {kind: {const: 'a'}, x: {type: 'number', minimum: 0}}, required: ['kind', 'x']},
  {type: 'object', properties: {kind: {const: 'b'}}, required: ['kind']}]}}};

// Mirrors the DSH value-schema DSL rules (dsh-tools lib/types/schema.js) so CI catches drift
// without installing DSH. scripts/proof-dsh.mjs runs the real compiler.
function assertDshDsl(node, path = 'parameters', property = false) {
  const annotations = ['description', 'title', 'default', 'examples', ...(property ? ['required'] : [])];
  const allowed = keys => Object.keys(node).forEach(k => assert.ok([...annotations, ...keys].includes(k), `${path}.${k} not allowed`));
  if (node.oneOf) {allowed(['oneOf']); assert.ok(node.oneOf.length >= 2); node.oneOf.forEach((b, i) => assertDshDsl(b, `${path}.oneOf[${i}]`)); return;}
  switch (node.type) {
    case 'json': allowed(['type']); break;
    case 'object': allowed(['type', 'properties', 'additionalProperties']); assert.equal(typeof node.additionalProperties, 'boolean');
      for (const [k, v] of Object.entries(node.properties || {})) assertDshDsl(v, `${path}.${k}`, true); break;
    case 'array': allowed(['type', 'items']); if (node.items) assertDshDsl(node.items, `${path}.items`); break;
    case 'string': case 'number': case 'integer': case 'boolean': case 'null': allowed(['type', 'enum', 'const']); break;
    default: assert.fail(`${path}.type ${node.type} is not in the DSL`);
  }
}
const assertRootDsl = map => {for (const [k, v] of Object.entries(map)) assertDshDsl(v, `parameters.${k}`, true);};

test('nested required fields are enforced in legacy and JSON Schema styles (B1)', () => {
  for (const params of [legacyCards, jsonCards]) {
    const validate = compileSchema(parameterSchema(params));
    assert.equal(validate({cards: [{}]}), false);
    assert.equal(validate({cards: [{front: 'f', back: 'b'}]}), true);
  }
  const validate = compileSchema(parameterSchema(union));
  assert.equal(validate({cmd: {kind: 'a', x: 1}}), true);
  assert.equal(validate({cmd: {kind: 'a'}}), false);
  assert.equal(validate({cmd: {kind: 'a', x: -1}}), false);
});

test('application tools reject nested omissions before application code runs', async () => {
  let calls = 0;
  const tools = createApplicationTools({definitions: [['flash', 'Save cards', legacyCards]], execute: async () => {calls++; return {saved: true};}});
  await assert.rejects(tools.execute('flash', {cards: [{}]}, {sessionId: 's'}), e => e.code === 'INVALID_ARGUMENTS' && e.details.errors.some(x => x.missing === 'front'));
  assert.equal(calls, 0);
  assert.deepEqual(await tools.execute('flash', {cards: [{front: 'a', back: 'b'}]}, {sessionId: 's'}), {saved: true});
});

test('JSON Schema compiles to the DSH descriptor DSL, keeping required flags and hints (B8)', () => {
  const template = toDshParameters(parameterSchema({id: {type: 'string', required: true, minLength: 1, maxLength: 160}}));
  assert.deepEqual(template, {id: {type: 'string', description: '(1–160 characters)', required: true}});
  for (const params of [legacyCards, jsonCards, union]) assertRootDsl(toDshParameters(parameterSchema(params)));
  const nullable = toDshParameters(parameterSchema({type: 'object', properties: {note: {type: ['string', 'null'], maxLength: 10}, any: {}, data: {type: 'json'}}}));
  assertRootDsl(nullable);
  assert.deepEqual(nullable.note.oneOf.map(b => b.type), ['string', 'null']);
  assert.equal(nullable.any.type, 'json');
  const refs = toDshParameters(parameterSchema({type: 'object', $defs: {money: {type: 'object', properties: {amount: {type: 'number'}}, required: ['amount']}},
    properties: {price: {$ref: '#/$defs/money'}}, required: ['price']}));
  assert.equal(refs.price.required, true); assert.equal(refs.price.properties.amount.required, true);
  assert.throws(() => toDshParameters(parameterSchema({type: 'object', properties: {x: {$ref: 'https://example.invalid/s.json'}}})), e => e.code === 'INVALID_TOOL');
});

test('registerDshTools hands DSH descriptors, not raw JSON Schema', async () => {
  const registered = [];
  await registerDshTools({tools: {register: t => registered.push(t)}}, {defineTool: x => x,
    definitions: [['read', 'Read', {id: {type: 'string', required: true, minLength: 1, maxLength: 160}}], ['flash', 'Save', jsonCards]], execute: async () => ({ok: true})});
  for (const tool of registered) assertRootDsl(tool.parameters);
  assert.equal(registered[1].parameters.cards.items.properties.front.required, true);
});

test('real DSH compiler accepts SDK output when AUGMENTOR_DSH_TOOLS_SCHEMA is set', {skip: !process.env.AUGMENTOR_DSH_TOOLS_SCHEMA}, async () => {
  const {parameterSchemaSpecToJsonSchema} = await import(pathToFileURL(process.env.AUGMENTOR_DSH_TOOLS_SCHEMA).href);
  for (const params of [legacyCards, jsonCards, union, {id: {type: 'string', required: true, minLength: 1}}]) parameterSchemaSpecToJsonSchema(toDshParameters(parameterSchema(params)));
});
