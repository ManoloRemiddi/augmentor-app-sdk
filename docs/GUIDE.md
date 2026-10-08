<!-- Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0 -->
# Make an application agent-native (SDK 0.2)

**Status: 0.2.0-preview.1 source.** Unpublished. Verified with synthetic fixtures, a mock
runtime, real Chromium and the real DSH 0.1.5-rc.1 descriptor compiler; not yet qualified
against an installed Augmentor runtime. Live applications are not changed by it. The 0.1
API remains available and unchanged ([MIGRATION-0.2.md](MIGRATION-0.2.md)).

The SDK connects three actors: the **human** (the owner), the **software** (your app: its
data, UI and rules) and the **agent** (Augmentor on the owner's runtime). With 0.2 the agent
can operate the whole app — data, screen and background work — and the app can hand the
agent work, while the human stays in control through proposals, review and an audit trail.
The full catalogue of what this enables is [analysis/CAPABILITIES.md](../analysis/CAPABILITIES.md)
in the repository.

## 1. Declare the agent surface once

```js
// augmentor/app.mjs — create it with: augmentor-app init --template app --id my-app
import {defineApp, defineTool, definePrompt} from '@augmentor/app-sdk';

export default defineApp({
  id: 'deal-desk', name: 'Deal desk', description: 'Sponsorship CRM for one creator.',
  instructions: ['augmentor/agent-role.md'],
  grants: ['ask', 'memory'],                 // product tools by purpose (GRANTS)
  routes: {'/deals/:id': 'One deal'},       // listed in the agent's reference
  memory: true,                              // preferences + decision feedback
  tools: [
    defineTool({name: 'deal_desk_update_deal', effect: 'write', description: 'Move a deal to a stage.',
      input: {type: 'object', properties: {id: {type: 'string'}, stage: {enum: ['lead', 'won']}, expectedVersion: {type: 'integer'}},
              required: ['id', 'stage', 'expectedVersion']},
      subject: ({id}) => 'deal:' + id,
      handler: (args, {services}) => services.deals.update(args)}),
    defineTool({name: 'deal_desk_send_reply', effect: 'external', description: 'Send a reply email.',
      input: {type: 'object', properties: {dealId: {type: 'string'}, body: {type: 'string'}}, required: ['dealId', 'body']},
      summary: ({dealId}) => `Reply on deal ${dealId}`, preview: ({body}) => ({type: 'text', text: body}),
      handler: (args, {services}) => services.mail.send(args)}),
  ],
  prompts: [definePrompt({id: 'triage_mail', title: 'Triage this email', template: 'Triage email {{mailId}}.',
    variables: {type: 'object', properties: {mailId: {type: 'string'}}, required: ['mailId']}})],
});
```

Everything else is generated from this declaration:

| Output | Command / API | Used by |
| --- | --- | --- |
| `augmentor.app.json` (registration manifest) | `augmentor-app manifest augmentor/app.mjs` | `plan`, `register` |
| `augmentor/tools.json` (runtime descriptors + fingerprint) | same command | the runtime tool module |
| DSH descriptors (strict DSL), Codex JSON Schema | automatic | Augmentor runtime |
| MCP tools/resources/prompts | `createMcpServer` | other MCP hosts |
| Agent reference, `llms.txt` | `app.reference()`, `augmentor-app describe` | the agent, docs |

`augmentor-app check augmentor/app.mjs` fails when the manifest or descriptors are stale,
or when instruction files mention tools the workspace does not declare or grant.

Tool names must start with the app prefix (`deal_desk_`). Schemas are JSON Schema 2020-12
(nested objects, arrays, unions and `$defs` references); legacy `{name: {type, required: true}}`
maps still work. Constraints DSH's descriptor DSL cannot express are enforced by the SDK and
described to the model.

## 2. Serve it with one call

```js
import http from 'node:http';
import {createAugmentorServer, AugmentorClient} from '@augmentor/app-sdk';
import app from './augmentor/app.mjs';

const agent = createAugmentorServer(app, {
  origin: 'https://desk.example',                       // exact origin
  authorizeOwner: req => mySession(req.headers.cookie), // your owner check → ID or false
  runtimeTokenFile: '/private/runtime.token',           // presented by the runtime tool module
  dataDir: '/private/augmentor-state',                  // SQLite stores (owner-only files)
  services: {deals, mail},                              // your data layer, passed to handlers
  proxy: {tokenFile: '/private/proxy.token'},           // maintained panel at /augmentor/
  client: new AugmentorClient({profile: 'deal-desk'}),  // optional: background runs/automation
}).start();

http.createServer(async (req, res) => {
  if (await agent.node(req, res)) return;               // Augmentor routes handled
  myApp(req, res);
}).on('upgrade', (req, socket, head) => agent.upgrade(req, socket, head) || socket.destroy());
```

Fetch-style servers (Next.js route handlers) use `await agent.fetch(request)` (returns `null`
when the route is not the SDK's). The panel proxy needs WebSockets, so serve it from Node.

Routes under `/api/augmentor`: `tool` (runtime → app, bearer token), `review`, `ui`, `events`,
`prompts`, `runs`, `activity`, `automation`, `preferences`, `reference` (owner session,
same-origin) and `mcp` (bearer token, optional).

The runtime tool module (`augmentor/tools.mjs`) is three lines generated by the template:
it reads `tools.json` and forwards calls to `/api/augmentor/tool`. No application code runs
inside the agent runtime.

## 3. Capability classes and how to use them

### Act in the app (tools)

`effect` drives defaults: `read` and `draft` run directly; `write` runs directly for
single-owner apps (set `approval` to change); `external` and `destructive` need approval.
Writes are idempotent per operation ID (`OperationStore`), validated against the output
schema, recorded in the `ActivityLog` and published as `tool.completed` with the `subject`
you return. Use `untrustedOutput: true` for tools that return email, comments or web text.
Add `limits: {perMinute}` for costly tools and `timeoutMs` for slow ones.

### Human in the loop (proposals and review)

An approval-gated call returns `{status: 'approval_required', proposalId, summary}` to the
model; nothing runs. The owner decides in your app:

```js
import {mountReviewQueue} from '@augmentor/app-sdk/browser';
mountReviewQueue(document.querySelector('#review'), {eventsUrl: '/api/augmentor/events'});
```

Approve executes once on the server with the stored arguments; Edit validates replacement
arguments first; Reject records the reason. The agent learns the outcome with
`<prefix>_proposal_status`, and with `memory: true` every decision becomes feedback it reads
before its next draft. `approval` accepts `'never' | 'always' | (input, ctx) => boolean`;
`policy.trust` auto-approves a tool after N unedited approvals. The recommended first pattern
remains **agent drafts, owner commits**: keep irreversible actions in your own UI.

### Steer the interface (UI bridge)

Your page connects once; the agent then has `<prefix>_ui_navigate`, `_open`, `_highlight`,
`_fill` (prefill, never submit), `_notify`, `_show` (rich content), `_ask` (question, waits
for the answer) and `_view` (what the user sees), plus your own `defineUiAction`s.

```js
import {connectPage} from '@augmentor/app-sdk/browser';
connectPage({
  actions: {navigate: ({route}) => router.push(route), open: ({kind, id}) => router.push(`/${kind}s/${id}`)},
  describeView: () => ({route: location.pathname, selection: store.selectedIds}),
});
```

Mark elements with `data-augmentor-key="deal:42"` so `highlight` can find them. Commands go to
the owner's focused page; when no page is open the tool fails with `UI_UNAVAILABLE` and the
agent continues without the screen.

### Show rich results (generative UI)

The agent chooses from a trusted catalogue — `card`, `table`, `list`, `checklist`, `diff`,
`chart`, `form`, `choice`, `receipt`, `text`, `stack` and your registered `custom`
components. Specs are validated on the server and rendered with DOM text APIs only; links are
limited to `#`, `/` and `https:`. Render them yourself with `renderAgentUi(spec)`.

### Hand work to the agent (premade prompts)

```html
<button data-augmentor-prompt="triage_mail" data-augmentor-vars='{"mailId":"m1"}'>Triage</button>
```
```js
import {createAgent, bindPromptButtons, mountAugmentor} from '@augmentor/app-sdk/browser';
const panel = mountAugmentor({container, allow: ['microphone'], theme: {mode: 'light', accent: '#7c3aed'}});
bindPromptButtons(document.body, createAgent({panel}));
```

Prompts render on the server with typed variables (free text is inserted as quoted data).
When the panel advertises `prompt` ([PANEL-PROTOCOL.md](PANEL-PROTOCOL.md)) the prompt goes
into the open conversation; otherwise it runs in the background and the result is available
from `/api/augmentor/runs/:id` and the change feed. `defineMode` adds instruction overlays.

### Wake the agent (events, schedules, watchers)

```js
createAugmentorServer(app, {..., automation: a => {
  a.on('mail.received', {prompt: 'triage_mail', vars: e => ({mailId: e.data.id}), key: e => 'mail:' + e.data.id,
    batch: {windowMs: 60000}, quiet: {start: '22:00', end: '07:00', timeZone: 'Europe/Rome'}, budget: {perHour: 10}});
  a.schedule('morning_brief', '30 7 * * 1-5', {prompt: 'morning_brief', timeZone: 'Europe/Rome'});
  a.watch('overdue', {check: () => invoices.overdueCount(), everyMs: 600000, prompt: e => ({text: `Overdue invoices: ${e.data.value}`})});
}});
agent.events.publish('mail.received', {id: 'm1'}, {subject: 'mail:m1'});
```

Each firing is a durable, deduplicated job (`JobStore`) that runs a headless agent turn,
optionally validated by `expect(result)`. Interrupted jobs wait for reconciliation; nothing is
replayed blindly. `POST /api/augmentor/automation/pause` is the owner's kill switch.

### Background agent work (AgentRunner)

```js
const runner = agent.runner;  // or new AgentRunner({client})
const result = await runner.run({text: 'Research topic X and save a brief', title: 'Nightly research', timeoutMs: 20 * 60000});
// {status: 'completed' | 'timeout' | ..., text, toolCalls, sessionId}
```

The runner follows the session's events and awaits the turn end, answers approval/question
interactions by policy (default: refuse and tell the agent nobody is available) and cancels on
timeout. No private product files are read.

### Keep everyone in sync (change feed)

`subscribe('/api/augmentor/events', event => refresh(event.subject))` replaces polling.
Publish your own domain events with `agent.events.publish(type, data, {subject})`; pages see
them with `subscribe(url, handler, {types: ['deal.updated']})`.

### Remember (preferences)

`memory: true` adds `<prefix>_preferences` and `<prefix>_suggest_preference`. Agent
suggestions stay unconfirmed until the owner confirms them and never override a confirmed
preference; owner decisions on proposals are recorded with the fields they changed.

### Interoperate (MCP)

`createAugmentorServer(app, {..., mcp: {tokenFile}})` exposes the same tools, resources and
prompts at `/api/augmentor/mcp` for other MCP hosts, with the same approval and audit.

## 4. Test it without a model

```js
import {createMockRuntime, scriptedModel} from '@augmentor/app-sdk/testing';
const runtime = createMockRuntime({tools: agent.toolkit, script: scriptedModel([{call: ['deal_desk_update_deal', {...}]}, {say: 'Done'}])});
const result = await new AgentRunner({client: runtime.client()}).run({text: 'Move deal 1'});
```

The mock runtime speaks the native frame protocol and emits real session events. It proves
your wiring, not model behaviour or a real runtime. See the runnable
[studio-desk example](../examples/studio-desk/README.md) in the repository.

## 5. Topologies

| Topology | Status |
| --- | --- |
| App and Augmentor on the same machine | Supported path (same as 0.1) |
| App on another host on a private network (for example NAS + PC) | Works with `proxy.socketPath` tunnels and HTTP tools; recipe pending (FINDINGS A2) |
| Hosted multi-user app with Augmentor on each user's machine | Not supported; design pending (FINDINGS A1). `authenticateRuntime` and per-principal UI routing are the building blocks |

Do not fake a runtime in the page, fork the panel or script its DOM; those break on every
product update and bypass approval and audit.
