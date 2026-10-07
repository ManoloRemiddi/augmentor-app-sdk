// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
// Premade prompts the software hands to the agent: declared once with typed variables,
// rendered on the server, run in the panel (when supported) or headlessly.
import {check} from './errors.mjs';
import {parameterSchema, compileSchema, schemaErrors} from './schema.mjs';
import {snapshotContext} from './context.mjs';

const ID = /^[a-z][a-z0-9_.-]{0,79}$/;

/**
 * @param id           stable identifier, e.g. 'triage_email'
 * @param template     text with {{variable}} placeholders
 * @param variables    JSON Schema object (or legacy map) for the placeholders
 * @param context      optional (vars) => object sent as the bounded workspace context
 * @param run          'panel' | 'background' | 'either' — where the app prefers to run it
 * @param session      'new' | 'current' — fresh conversation or the open one
 * @param placement    free-form UI hints, e.g. ['thread.header']
 */
export function definePrompt({id, title, description = '', template, variables = {}, context, run = 'either', session = 'current', mode, model, placement = [], tags = []}) {
  check(ID.test(id || ''), 'INVALID_PROMPT', `Invalid prompt ID ${JSON.stringify(id)}`);
  check(typeof title === 'string' && title.trim() && title.length <= 120, 'INVALID_PROMPT', `Prompt ${id} needs a short title`);
  check(typeof template === 'string' && template.trim() && template.length <= 8000, 'INVALID_PROMPT', `Prompt ${id} needs a template of at most 8000 characters`);
  check(['panel', 'background', 'either'].includes(run) && ['new', 'current'].includes(session), 'INVALID_PROMPT', `Prompt ${id} run/session values are invalid`);
  check(context === undefined || typeof context === 'function', 'INVALID_PROMPT', `Prompt ${id} context must be a function`);
  const schema = parameterSchema(variables);
  const names = [...template.matchAll(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g)].map(m => m[1]);
  for (const name of names) check(schema.properties?.[name], 'INVALID_PROMPT', `Prompt ${id} uses {{${name}}} but does not declare it`);
  return Object.freeze({kind: 'prompt', id, title: title.trim(), description, template, variables: schema, context, run, session, mode, model, placement: [...placement], tags: [...tags], validate: compileSchema(schema, `prompt ${id} variables`)});
}

/** Modes are instruction overlays ("Tutor", "Explain simply") the page can select. */
export function defineMode({id, title, instructions}) {
  check(ID.test(id || '') && typeof title === 'string' && typeof instructions === 'string' && instructions.length <= 4000, 'INVALID_PROMPT', 'Modes need an ID, a title and instructions of at most 4000 characters');
  return Object.freeze({kind: 'mode', id, title, instructions});
}

/** Format one variable value as quoted data so it cannot read as an instruction. */
export function formatValue(value, schema = {}) {
  if (value === undefined || value === null) return '(none)';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'string') {
    // Identifiers and enum values are inserted bare; free text is quoted and bounded.
    if (schema.enum || /^[A-Za-z0-9_.:/#-]{1,160}$/.test(value)) return value;
    const max = Math.min(schema.maxLength ?? 2000, 4000);
    return JSON.stringify(value.length > max ? value.slice(0, max) + '…' : value);
  }
  const text = JSON.stringify(value);
  return text.length > 4000 ? text.slice(0, 4000) + '…' : text;
}

export function createPromptLibrary({prompts = [], modes = []} = {}) {
  const byId = new Map(), modeById = new Map();
  for (const p of prompts) {check(p?.kind === 'prompt', 'INVALID_PROMPT', 'Use definePrompt()'); check(!byId.has(p.id), 'INVALID_PROMPT', `Duplicate prompt ${p.id}`); byId.set(p.id, p);}
  for (const m of modes) {check(m?.kind === 'mode', 'INVALID_PROMPT', 'Use defineMode()'); modeById.set(m.id, m);}
  const library = {
    get prompts() {return [...byId.values()];},
    get modes() {return [...modeById.values()];},
    get: id => byId.get(id),
    /** Public catalogue for the page (no templates' internals beyond what the owner sees). */
    list() {return library.prompts.map(p => ({id: p.id, title: p.title, description: p.description, variables: p.variables, run: p.run, session: p.session, placement: p.placement, tags: p.tags}));},
    /**
     * Render a prompt. Returns {text, context, title, run, session, model}. Throws
     * INVALID_ARGUMENTS for missing or invalid variables. `extraContext` is merged in.
     */
    render(id, vars = {}, {mode, extraContext} = {}) {
      const prompt = byId.get(id);
      check(prompt, 'NOT_FOUND', `Unknown prompt ${id}`);
      check(prompt.validate(vars), 'INVALID_ARGUMENTS', `Variables for prompt ${id} are invalid`, {errors: schemaErrors(prompt.validate.errors)});
      let text = prompt.template.replace(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g, (_, name) => formatValue(vars[name], prompt.variables.properties?.[name]));
      const overlay = modeById.get(mode ?? prompt.mode);
      if (mode !== undefined) check(overlay, 'NOT_FOUND', `Unknown mode ${mode}`);
      if (overlay) text = `[${overlay.title} mode] ${overlay.instructions}\n\n${text}`;
      const base = prompt.context ? prompt.context(vars) : undefined;
      const merged = base || extraContext ? {...(base || {}), ...(extraContext || {}), prompt: id} : undefined;
      return {id, text, title: prompt.title, run: prompt.run, session: prompt.session, model: prompt.model, ...(merged ? {context: snapshotContext(merged)} : {})};
    },
  };
  return library;
}
