// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
// One schema dialect for every boundary: JSON Schema 2020-12. Legacy SDK descriptors
// ({name: {type, required: true}}) are converted, including nested objects and arrays.
import Ajv2020 from 'ajv/dist/2020.js';
import {check, AugmentorError} from './errors.mjs';

const NESTED_MAPS = ['properties', 'patternProperties', '$defs', 'definitions', 'dependentSchemas'];
const NESTED_ONE = ['items', 'additionalProperties', 'unevaluatedProperties', 'unevaluatedItems', 'contains',
  'propertyNames', 'not', 'if', 'then', 'else', 'additionalItems'];
const NESTED_LIST = ['prefixItems', 'oneOf', 'anyOf', 'allOf'];
const MAX_DEPTH = 32;

/** True when a top-level parameter declaration is already a JSON Schema object. */
export function isJsonSchemaObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    (value.type === 'object' || typeof value.$schema === 'string') &&
    (value.properties === undefined || (typeof value.properties === 'object' && !Array.isArray(value.properties)));
}

/** Convert one schema node. Boolean `required` on a property moves to its parent's list. */
export function toJsonSchema(node, depth = 0) {
  check(depth <= MAX_DEPTH, 'INVALID_TOOL', 'Tool schema is nested too deeply');
  if (typeof node === 'boolean') return node;
  check(node && typeof node === 'object' && !Array.isArray(node), 'INVALID_TOOL', 'Each schema node must be an object');
  const {required, ...rest} = node;
  if (rest.type === 'json') {const {type: _t, ...other} = rest; return other;}
  const out = {...rest};
  for (const key of NESTED_MAPS) if (rest[key] !== undefined) {
    check(rest[key] && typeof rest[key] === 'object' && !Array.isArray(rest[key]), 'INVALID_TOOL', `${key} must be an object`);
    out[key] = Object.fromEntries(Object.entries(rest[key]).map(([k, v]) => [k, toJsonSchema(v, depth + 1)]));
  }
  for (const key of NESTED_ONE) if (rest[key] !== undefined && typeof rest[key] === 'object') out[key] = toJsonSchema(rest[key], depth + 1);
  for (const key of NESTED_LIST) if (rest[key] !== undefined) {
    check(Array.isArray(rest[key]), 'INVALID_TOOL', `${key} must be an array`);
    out[key] = rest[key].map(v => toJsonSchema(v, depth + 1));
  }
  // JSON Schema style: an array of required property names on this object.
  const names = new Set(Array.isArray(required) ? required : []);
  // Legacy style: `required: true` declared on each child property.
  if (rest.properties) for (const [k, v] of Object.entries(rest.properties)) if (v && typeof v === 'object' && v.required === true) names.add(k);
  if (names.size) out.required = [...names];
  return out;
}

/** Normalise tool parameters to one closed JSON Schema object. */
export function parameterSchema(parameters = {}) {
  check(parameters && typeof parameters === 'object' && !Array.isArray(parameters), 'INVALID_TOOL', 'Tool parameters must be an object');
  if (isJsonSchemaObject(parameters)) {
    const schema = toJsonSchema(parameters);
    check(schema.type === 'object', 'INVALID_TOOL', 'Tool parameters must describe an object');
    return {properties: {}, ...schema};
  }
  // Legacy map of property descriptors; the top level stays closed as before.
  return toJsonSchema({type: 'object', properties: parameters, additionalProperties: false});
}

let shared;
/** One AJV instance per process. Non-strict so existing apps' extra keywords keep compiling. */
export function schemaValidator() {
  shared ||= new Ajv2020({allErrors: true, strict: false, allowUnionTypes: true, validateFormats: false});
  return shared;
}

export function compileSchema(schema, label = 'schema') {
  try {return schemaValidator().compile(schema);}
  catch (error) {throw new AugmentorError('INVALID_TOOL', `Invalid ${label}: ${error.message}`);}
}

/** Compact, model-readable validation errors (no values echoed). */
export function schemaErrors(errors = []) {
  return (errors || []).slice(0, 20).map(e => ({path: e.instancePath || '/', message: e.message, ...(e.params?.missingProperty ? {missing: e.params.missingProperty} : {}),
    ...(e.params?.additionalProperty ? {unexpected: e.params.additionalProperty} : {}), ...(e.params?.allowedValues ? {allowed: e.params.allowedValues} : {})}));
}
