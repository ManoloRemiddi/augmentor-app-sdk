// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
// The application's whole agent surface, declared once. Regenerate augmentor.app.json and
// augmentor/tools.json after every change: ./node_modules/.bin/augmentor-app manifest augmentor/app.mjs
// Handlers run in YOUR server process and must use your own data layer (passed as `services`).
import {defineApp, defineTool, definePrompt} from '@augmentor/app-sdk';

const record = {type: 'object', properties: {id: {type: 'string'}, version: {type: 'integer'}, title: {type: 'string'}, status: {type: 'string'}}, required: ['id', 'version', 'title']};

export const app = defineApp({
  id: __APP_ID_JSON__,
  name: __APP_NAME_JSON__,
  harness: __HARNESS_JSON__,
  description: 'Replace with one paragraph: what this application is for and what the agent may help with.',
  instructions: ['augmentor/agent-role.md'],
  grants: ['ask'],
  routes: {'/': 'Home', '/records/:id': 'One record'},
  tools: [
    defineTool({name: '__PREFIX___read_record', title: 'Read record', effect: 'read', description: 'Read one current record by its stable ID.',
      input: {type: 'object', properties: {id: {type: 'string', minLength: 1, maxLength: 160}}, required: ['id']}, output: record,
      handler: ({id}, {services}) => services.records.read(id)}),
    defineTool({name: '__PREFIX___update_record', title: 'Update record', effect: 'write', description: 'Change the title or status of a record. Read it first and pass its version.',
      input: {type: 'object', properties: {id: {type: 'string'}, expectedVersion: {type: 'integer', minimum: 0}, title: {type: 'string', maxLength: 200}, status: {enum: ['open', 'done']}}, required: ['id', 'expectedVersion']},
      subject: ({id}) => 'record:' + id,
      handler: (args, {services}) => services.records.update(args)}),
    defineTool({name: '__PREFIX___share_record', title: 'Share record', effect: 'external', description: 'Share a record with an outside contact. The owner approves before anything is sent.',
      input: {type: 'object', properties: {id: {type: 'string'}, to: {type: 'string', maxLength: 200}, message: {type: 'string', maxLength: 2000}}, required: ['id', 'to', 'message']},
      summary: ({id, to}) => `Share record ${id} with ${to}`, preview: ({message}) => ({type: 'text', text: message}), subject: ({id}) => 'record:' + id,
      handler: (args, {services}) => services.records.share(args)}),
  ],
  prompts: [
    definePrompt({id: 'summarize_record', title: 'Summarise this record', template: 'Summarise record {{id}} and suggest the next step. Open it on screen while you explain.',
      variables: {type: 'object', properties: {id: {type: 'string'}}, required: ['id']}, context: ({id}) => ({recordId: id}), placement: ['record.header']}),
    definePrompt({id: 'daily_review', title: 'Daily review', template: 'Review open records and list what needs attention today.', run: 'background', session: 'new'}),
  ],
});
export default app;
