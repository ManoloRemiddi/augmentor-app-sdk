// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
// Studio desk: a synthetic example (not a reference deployment) showing every capability
// class of the SDK on one small creator CRM. Data lives in memory and resets on restart.
import {defineApp, defineTool, definePrompt, defineMode, defineResource, defineUiAction} from '../../src/index.mjs';

const deal = {type: 'object', properties: {id: {type: 'string'}, brand: {type: 'string'}, stage: {type: 'string'}, fee: {type: 'number'}, version: {type: 'integer'}}, required: ['id', 'brand', 'stage', 'version']};

export const app = defineApp({
  id: 'studio-desk', name: 'Studio desk', description: 'A creator\'s sponsorship desk: inbound mail, deals, quotes and replies (synthetic example).',
  instructions: ['examples/studio-desk/role.md'], grants: ['ask'], memory: true,
  routes: {'/': 'Deals board', '/deals/:id': 'One deal', '/inbox': 'Inbound mail'},
  tools: [
    defineTool({name: 'studio_desk_list_deals', title: 'List deals', effect: 'read', description: 'List deals with brand, stage, fee and version.', handler: (_a, {services}) => ({deals: services.db.deals()})}),
    defineTool({name: 'studio_desk_read_mail', title: 'Read mail', effect: 'read', untrustedOutput: true, description: 'Read one inbound email by ID.',
      input: {type: 'object', properties: {id: {type: 'string'}}, required: ['id']}, handler: ({id}, {services}) => services.db.mail(id)}),
    defineTool({name: 'studio_desk_update_deal', title: 'Update deal', effect: 'write', description: 'Move a deal to another stage or set its fee. Pass the version you read.',
      input: {type: 'object', properties: {id: {type: 'string'}, expectedVersion: {type: 'integer'}, stage: {enum: ['lead', 'negotiating', 'won', 'lost']}, fee: {type: 'number', minimum: 0}}, required: ['id', 'expectedVersion']},
      output: deal, subject: ({id}) => 'deal:' + id, handler: (args, {services}) => services.db.update(args)}),
    defineTool({name: 'studio_desk_quote', title: 'Quote a fee', effect: 'read', description: 'Compute a fee for a deliverable from the rate card (deterministic).',
      input: {type: 'object', properties: {deliverable: {enum: ['integration', 'dedicated', 'short']}, rush: {type: 'boolean'}}, required: ['deliverable']},
      handler: ({deliverable, rush}) => {const base = {integration: 2400, dedicated: 6000, short: 900}[deliverable]; return {fee: Math.round(base * (rush ? 1.25 : 1)), currency: 'EUR'};}}),
    defineTool({name: 'studio_desk_send_reply', title: 'Send reply', effect: 'external', description: 'Send an email reply to a brand. The owner approves first.',
      input: {type: 'object', properties: {dealId: {type: 'string'}, body: {type: 'string', minLength: 1, maxLength: 4000}}, required: ['dealId', 'body']},
      summary: ({dealId}, {services}) => `Reply to ${services.db.deal(dealId)?.brand ?? dealId}`, preview: ({body}) => ({type: 'text', text: body}), subject: ({dealId}) => 'deal:' + dealId,
      handler: (args, {services}) => services.db.send(args)}),
  ],
  prompts: [
    definePrompt({id: 'triage_mail', title: 'Triage this email', template: 'Triage inbound email {{mailId}}: link it to a deal, update the deal, quote a fee and draft a reply for my approval.',
      variables: {type: 'object', properties: {mailId: {type: 'string'}}, required: ['mailId']}, context: ({mailId}) => ({view: 'inbox', mailId}), placement: ['mail.header']}),
    definePrompt({id: 'explain_deal', title: 'Explain this deal', template: 'Explain where deal {{dealId}} stands and what I should do next. Show it on screen.',
      variables: {type: 'object', properties: {dealId: {type: 'string'}}, required: ['dealId']}, placement: ['deal.card']}),
    definePrompt({id: 'morning_brief', title: 'Morning brief', template: 'Write a short morning brief of open deals and waiting replies.', run: 'background', session: 'new'}),
  ],
  modes: [defineMode({id: 'concise', title: 'Concise', instructions: 'Answer in three short bullet points.'})],
  resources: [defineResource({uri: 'app://deal/{id}', name: 'deal', description: 'One deal record', read: ({id}, {services}) => services?.db.deal(id) ?? null})],
  uiActions: [defineUiAction({name: 'open_calculator', description: 'Open the fee calculator prefilled (the owner saves it)', effect: 'draft',
    input: {type: 'object', properties: {deliverable: {type: 'string'}, fee: {type: 'number'}}, required: ['deliverable', 'fee']}})],
});
export default app;
