// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
// Compile JSON Schema 2020-12 into DSH's tool descriptor DSL (dsh-tools 0.1.5-rc.1 and
// 0.2.0-rc.2): a root property map with `required: true` flags; objects state
// `additionalProperties`; `oneOf`; annotations limited to description/title/default/examples.
// Constraints the DSL cannot express are described in text and enforced by the SDK's own
// AJV validation of the original schema before any application code runs.
import {check} from './errors.mjs';

const SCALARS = new Set(['string', 'number', 'integer', 'boolean', 'null']);
const MAX_DEPTH = 32;

function hints(node) {
  const out = [], n = node;
  if (n.minLength !== undefined || n.maxLength !== undefined) out.push(n.minLength !== undefined && n.maxLength !== undefined ? `${n.minLength}–${n.maxLength} characters` : n.minLength !== undefined ? `at least ${n.minLength} characters` : `at most ${n.maxLength} characters`);
  if (n.minimum !== undefined) out.push(`minimum ${n.minimum}`);
  if (n.exclusiveMinimum !== undefined) out.push(`greater than ${n.exclusiveMinimum}`);
  if (n.maximum !== undefined) out.push(`maximum ${n.maximum}`);
  if (n.exclusiveMaximum !== undefined) out.push(`less than ${n.exclusiveMaximum}`);
  if (n.multipleOf !== undefined) out.push(`multiple of ${n.multipleOf}`);
  if (n.pattern !== undefined) out.push(`pattern ${n.pattern}`);
  if (n.format !== undefined) out.push(`format ${n.format}`);
  if (n.minItems !== undefined || n.maxItems !== undefined) out.push(n.minItems !== undefined && n.maxItems !== undefined ? `${n.minItems}–${n.maxItems} items` : n.minItems !== undefined ? `at least ${n.minItems} item${n.minItems === 1 ? '' : 's'}` : `at most ${n.maxItems} item${n.maxItems === 1 ? '' : 's'}`);
  if (n.uniqueItems) out.push('unique items');
  if (n.minProperties !== undefined) out.push(`at least ${n.minProperties} properties`);
  if (n.maxProperties !== undefined) out.push(`at most ${n.maxProperties} properties`);
  return out;
}

function annotate(source, target) {
  const extra = hints(source);
  const description = [source.description, extra.length ? `(${extra.join('; ')})` : ''].filter(Boolean).join(' ');
  if (description) target.description = description;
  if (typeof source.title === 'string') target.title = source.title;
  if (source.default !== undefined) target.default = source.default;
  if (Array.isArray(source.examples) && source.examples.length) target.examples = source.examples;
  return target;
}

function typeOfValue(value) {
  if (value === null) return 'null';
  if (Number.isInteger(value)) return 'integer';
  if (typeof value === 'number') return 'number';
  return ['string', 'boolean'].includes(typeof value) ? typeof value : null;
}

function resolveRef(ref, root, seen) {
  check(typeof ref === 'string' && /^#\/(\$defs|definitions)\/[^/]+$/.test(ref), 'INVALID_TOOL', `Only local $defs references are supported (${ref})`);
  check(!seen.has(ref), 'INVALID_TOOL', `Recursive schema reference ${ref} cannot be expressed for DSH`);
  const [, bag, name] = ref.split('/');
  const target = root?.[bag]?.[name];
  check(target !== undefined, 'INVALID_TOOL', `Unresolved schema reference ${ref}`);
  return target;
}

function convert(node, ctx, depth) {
  check(depth <= MAX_DEPTH, 'INVALID_TOOL', 'Tool schema is nested too deeply for DSH');
  if (node === true || node === undefined) return {type: 'json'};
  check(node !== false, 'INVALID_TOOL', 'A schema that rejects every value cannot be a tool parameter');
  check(node && typeof node === 'object' && !Array.isArray(node), 'INVALID_TOOL', 'Each schema node must be an object');
  if (node.$ref !== undefined) {
    const seen = new Set(ctx.seen); const target = resolveRef(node.$ref, ctx.root, seen); seen.add(node.$ref);
    const {$ref: _r, ...siblings} = node;
    return convert({...target, ...siblings}, {...ctx, seen}, depth + 1);
  }
  if (node.type === 'json') return annotate(node, {type: 'json'});
  const union = node.oneOf ?? node.anyOf;
  if (Array.isArray(union) && !node.type) {
    const branches = union.map(b => convert(b, ctx, depth + 1));
    return branches.length === 1 ? annotate(node, branches[0]) : annotate(node, {oneOf: branches});
  }
  if (Array.isArray(node.type)) {
    const types = [...new Set(node.type)];
    if (types.length === 1) return convert({...node, type: types[0]}, ctx, depth + 1);
    const {type: _t, description: _d, title: _ti, default: _de, examples: _e, ...rest} = node;
    // Constraints stay on the non-null branches; the union keeps only the annotations.
    return annotate({description: node.description, title: node.title, default: node.default, examples: node.examples}, {oneOf: types.map(t => convert(t === 'null' ? {type: 'null'} : {...rest, type: t}, ctx, depth + 1))});
  }
  let type = node.type;
  if (!type && node.const !== undefined) type = typeOfValue(node.const);
  if (!type && Array.isArray(node.enum) && node.enum.length) {
    const types = new Set(node.enum.map(typeOfValue));
    type = types.size === 1 && !types.has(null) ? [...types][0] : undefined;
  }
  if (!type && (node.properties || node.additionalProperties !== undefined)) type = 'object';
  if (!type && node.items) type = 'array';
  if (!type) return annotate(node, {type: 'json'});
  if (SCALARS.has(type)) {
    const out = {type};
    // DSH only accepts scalar enums; mixed enums are enforced by AJV instead.
    if (Array.isArray(node.enum) && node.enum.length && node.enum.every(v => v === null || typeof v !== 'object')) out.enum = [...node.enum];
    if (node.const !== undefined && (node.const === null || typeof node.const !== 'object')) out.const = node.const;
    return annotate(node, out);
  }
  if (type === 'array') {
    const out = {type: 'array'};
    if (node.items && typeof node.items === 'object') out.items = convert(node.items, ctx, depth + 1);
    return annotate(node, out);
  }
  if (type === 'object') {
    const out = {type: 'object', additionalProperties: node.additionalProperties === false ? false : true};
    if (node.properties && typeof node.properties === 'object') out.properties = propertyMap(node, ctx, depth + 1);
    return annotate(node, out);
  }
  return annotate(node, {type: 'json'});
}

function propertyMap(objectNode, ctx, depth) {
  const required = new Set(Array.isArray(objectNode.required) ? objectNode.required : []);
  const map = {};
  for (const [key, value] of Object.entries(objectNode.properties || {})) {
    const converted = convert(value, ctx, depth);
    map[key] = required.has(key) ? {...converted, required: true} : converted;
  }
  return map;
}

/** Root DSH parameter map for a JSON Schema object (as produced by `parameterSchema`). */
export function toDshParameters(schema) {
  check(schema && typeof schema === 'object' && (schema.type === 'object' || schema.properties), 'INVALID_TOOL', 'DSH tool parameters must be an object schema');
  return propertyMap(schema, {root: schema, seen: new Set()}, 0);
}

/** DSH value schema (used for tool output declarations). */
export function toDshValue(schema) {
  return convert(schema, {root: schema, seen: new Set()}, 0);
}
