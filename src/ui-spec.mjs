// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
// Trusted generative-UI catalogue shared by the server (validation) and the browser
// (rendering with DOM text APIs only). The agent picks components; it never sends HTML.
// No Node imports: this module is part of the browser bundle.

const text = (max = 2000) => ({type: 'string', maxLength: max});
const action = {type: 'object', additionalProperties: false, properties: {
  label: text(60),
  prompt: {type: 'object', additionalProperties: false, required: ['id'], properties: {id: text(80), vars: {type: 'object'}}},
  href: {type: 'string', maxLength: 2000, pattern: '^(#|/|https://)'},
  action: {type: 'object', additionalProperties: false, required: ['name'], properties: {name: text(128), args: {type: 'object'}}},
}, required: ['label']};
const scalar = {type: ['string', 'number', 'boolean', 'null']};

export const UI_COMPONENTS = {
  text: {properties: {text: text(8000)}, required: ['text']},
  card: {properties: {title: text(200), subtitle: text(300), body: text(4000), fields: {type: 'array', maxItems: 30, items: {type: 'object', additionalProperties: false, required: ['label'], properties: {label: text(80), value: scalar}}},
    badges: {type: 'array', maxItems: 10, items: text(40)}, tone: {enum: ['neutral', 'info', 'success', 'warning', 'danger']}, actions: {type: 'array', maxItems: 6, items: action}}, required: ['title']},
  table: {properties: {title: text(200), caption: text(500), columns: {type: 'array', minItems: 1, maxItems: 12, items: {type: 'object', additionalProperties: false, required: ['key', 'label'], properties: {key: text(60), label: text(80), align: {enum: ['left', 'right', 'center']}}}},
    rows: {type: 'array', maxItems: 200, items: {type: 'object', additionalProperties: scalar}}}, required: ['columns', 'rows']},
  list: {properties: {title: text(200), ordered: {type: 'boolean'}, items: {type: 'array', maxItems: 100, items: {type: 'object', additionalProperties: false, required: ['title'], properties: {title: text(300), detail: text(1000), badge: text(40), href: action.properties.href}}}}, required: ['items']},
  checklist: {properties: {title: text(200), items: {type: 'array', maxItems: 50, items: {type: 'object', additionalProperties: false, required: ['id', 'label'], properties: {id: text(80), label: text(300), checked: {type: 'boolean'}}}}}, required: ['items']},
  diff: {properties: {title: text(200), before: text(20000), after: text(20000), beforeLabel: text(60), afterLabel: text(60)}, required: ['before', 'after']},
  chart: {properties: {title: text(200), kind: {enum: ['bar', 'line']}, unit: text(20), series: {type: 'array', minItems: 1, maxItems: 6, items: {type: 'object', additionalProperties: false, required: ['label', 'points'],
    properties: {label: text(60), points: {type: 'array', maxItems: 120, items: {type: 'object', additionalProperties: false, required: ['x', 'y'], properties: {x: {type: ['string', 'number']}, y: {type: 'number'}}}}}}}}, required: ['kind', 'series']},
  form: {properties: {title: text(200), description: text(1000), submitLabel: text(40), fields: {type: 'array', minItems: 1, maxItems: 20, items: {type: 'object', additionalProperties: false, required: ['name', 'label', 'input'],
    properties: {name: {type: 'string', pattern: '^[A-Za-z][A-Za-z0-9_]{0,63}$'}, label: text(120), input: {enum: ['text', 'textarea', 'number', 'select', 'checkbox', 'date']}, required: {type: 'boolean'},
      options: {type: 'array', maxItems: 50, items: {type: 'object', additionalProperties: false, required: ['value', 'label'], properties: {value: text(200), label: text(200)}}}, value: scalar, placeholder: text(200)}}}}, required: ['fields']},
  choice: {properties: {title: text(200), question: text(1000), multiple: {type: 'boolean'}, options: {type: 'array', minItems: 1, maxItems: 20, items: {type: 'object', additionalProperties: false, required: ['id', 'label'], properties: {id: text(80), label: text(300), description: text(1000)}}}}, required: ['question', 'options']},
  receipt: {properties: {title: text(200), summary: text(1000), status: {enum: ['done', 'pending', 'failed']}, href: action.properties.href}, required: ['title', 'status']},
  custom: {properties: {component: {type: 'string', pattern: '^[a-z][a-z0-9-]{0,63}$'}, props: {type: 'object'}}, required: ['component']},
};

/** JSON Schema (2020-12) for one UI spec; `stack` nests other components one level deep. */
export function uiSpecSchema() {
  const branch = (type, def) => ({type: 'object', additionalProperties: false, required: ['type', ...def.required], properties: {type: {const: type}, ...def.properties}});
  const leaves = Object.entries(UI_COMPONENTS).map(([type, def]) => branch(type, def));
  return {oneOf: [...leaves, {type: 'object', additionalProperties: false, required: ['type', 'children'], properties: {type: {const: 'stack'}, title: text(200), children: {type: 'array', minItems: 1, maxItems: 12, items: {oneOf: leaves}}}}]};
}

export const UI_TYPES = [...Object.keys(UI_COMPONENTS), 'stack'];
