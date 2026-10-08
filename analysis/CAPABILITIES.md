<!-- Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
# Capability catalogue: what the Augmentor agent can do inside software

**Status: catalogue, 2026-10-07.** This is the long list the SDK is designed against. It
starts from the three reference apps (sponsorship CRM, creator workspace, student tutor),
generalises them with the research in [RESEARCH.md](RESEARCH.md), and maps every capability
to the SDK primitive that enables it. The implementation plan is in [PLAN.md](PLAN.md).

## How to read it

The **three actors** are the human (owner or user), the software (the app: its data, UI and
rules) and the agent (Augmentor, running on the owner's runtime). Every capability is one
of six **directions of flow**:

| Direction | Meaning | Example |
| --- | --- | --- |
| Agent → software (act) | The agent reads or changes app state | Update a deal; save a draft reply |
| Agent → software UI (steer) | The agent drives what the human sees | Open the thread and highlight the clause |
| Software → agent (ask) | The app hands the agent work | "Triage this email" button; nightly research job |
| Software → agent (inform) | The app tells the agent what happened | New mail arrived; video published |
| Agent → human (via software) | The agent asks, proposes or reports in the app | Review card with Approve/Edit/Reject |
| Human → agent (via software) | The human steers the agent from the app | Approve, correct, dismiss "less like this" |

**Autonomy levels** (Knight Institute / UW, user's role): **L1** operator (agent acts only
on request), **L2** collaborator, **L3** consultant (agent leads, asks for preferences),
**L4** approver (agent acts, asks only at risky points), **L5** observer (agent runs alone;
human monitors and can stop it).

**Tier**: **T1** works with today's `augmentor-app/1` runtime through the app's own server
and pages. **T2** needs the paired product (panel/runtime) support described in
[docs/PANEL-PROTOCOL.md](../docs/PANEL-PROTOCOL.md); the SDK negotiates it and degrades to
T1 behaviour when absent.

**SDK primitive** names refer to the modules in [PLAN.md §4](PLAN.md#4-the-sdk-primitives).

---

## Class 1 — Understand the app (perception and context)

The agent knows where the human is, what they are looking at, and what the app contains.

| # | Capability | Primitive | Tier |
| --- | --- | --- | --- |
| 1.1 | Current view, route, selection and visible records as a "semantic screen" (not pixels) | `connectPage({describeView})`, `setContext` | T1 |
| 1.2 | Selected text range, focused field, cursor position | `describeView`, `ui_get_view` tool | T1 |
| 1.3 | Read any record by stable ID with an explicit projection | `defineTool({effect:'read'})` | T1 |
| 1.4 | Search across app data with filters and pagination | read tool + `paginate` helper | T1 |
| 1.5 | Addressable resources (`app://deal/42`) the agent can open on demand | `defineResource` (MCP resources) | T1 |
| 1.6 | Schema introspection: "what kinds of records exist, what fields" | auto `<app>_describe` tool from the definition | T1 |
| 1.7 | App help and policies as readable documents (no prose duplication in roles) | resources + generated help tool | T1 |
| 1.8 | Recent activity: what changed since the agent last looked | `ActivityLog`, `EventHub.since` | T1 |
| 1.9 | User's preferences and saved decisions relevant to this view | memory resources | T1 |
| 1.10 | Context budgeting: fit the most relevant context into the limit | `fitContext()` | T1 |
| 1.11 | Untrusted-content marking for user/web/email text | `untrusted()` wrapper, `untrustedContent` hint | T1 |
| 1.12 | Live state sync: the agent's view stays current while the page changes | context updates per page event; AG-UI-style snapshot | T1 (page) / T2 (panel) |

## Class 2 — Act in the app (commands and data changes)

| # | Capability | Primitive | Tier |
| --- | --- | --- | --- |
| 2.1 | Create, update, archive records through the app's API (never the DB) | `defineTool({effect:'write'})` | T1 |
| 2.2 | Versioned writes with optimistic concurrency (`expectedVersion`) | tool + `VERSION_CONFLICT` envelope | T1 |
| 2.3 | Idempotent writes keyed by the SDK's operation ID | endpoint + `OperationStore` | T1 |
| 2.4 | Bulk operations with partial results | tool returning `{done, failed, next}` | T1 |
| 2.5 | Discriminated command unions (one tool, several typed commands) | JSON Schema `oneOf` + `const` | T1 |
| 2.6 | Long-running operations with progress and a handle to poll | `defineTool({longRunning:true})` → task handle | T1 |
| 2.7 | File and attachment transfer in and out of tools | `attachment` reference type | T1 |
| 2.8 | Dry run: show exactly what a write would do | `dryRun` flag on write tools | T1 |
| 2.9 | Undo / compensating action for the agent's own writes | `defineTool({undo})`, activity receipts | T1 |
| 2.10 | Provenance on every agent write (session, operation, evidence) | execution context → app store | T1 |
| 2.11 | Irreversible actions kept out of the tool set by design | `effect:'external'` → proposal only | T1 |
| 2.12 | Rate limits and per-tool budgets | `limits` on tool / toolkit | T1 |

## Class 3 — Steer the interface (agent → UI)

The agent "has its hands on" the software the human is using.

| # | Capability | Primitive | Tier |
| --- | --- | --- | --- |
| 3.1 | Navigate to a view or route with filters | `ui.navigate` page action | T1 |
| 3.2 | Open a specific record, tab, step or dialog | `ui.open` | T1 |
| 3.3 | Highlight a record, field or text range (pulse, outline) | `ui.highlight` | T1 |
| 3.4 | Prefill a form without submitting it (human confirms) | `ui.fill` | T1 |
| 3.5 | Set filters, sort, search box | `ui.filter` | T1 |
| 3.6 | Show a toast or receipt with an "Open" link | `ui.notify` | T1 |
| 3.7 | Show a diff between two versions (draft, document, record) | `ui.show({type:'diff'})` | T1 |
| 3.8 | Scroll to, focus, play media at a timestamp | app-specific page tools | T1 |
| 3.9 | Any app-specific UI action registered by the page (WebMCP-shaped) | `registerPageTool` | T1 |
| 3.10 | Ask what is on screen right now | `ui.get_view` | T1 |
| 3.11 | Guided walkthrough: step-by-step overlay for teaching | sequence of highlight + notify | T1 |
| 3.12 | Open, focus, collapse the agent panel from the page | `panel.open/close/focus` | T1 (host) |
| 3.13 | Agent presence: "agent is editing this record" indicator | `agent.presence` event | T1 |

## Class 4 — Hand work to the agent (software → agent)

| # | Capability | Primitive | Tier |
| --- | --- | --- | --- |
| 4.1 | Premade prompts declared once with typed variables | `definePrompt` | T1 |
| 4.2 | "Ask agent" buttons anywhere in the UI, carrying their own context | `bindPromptButtons` / `agent.ask(promptId, vars)` | T1 (headless) / T2 (in panel) |
| 4.3 | Send to the open panel conversation, prefill the composer, or start fresh | `panel.prompt(text, {mode:'send'|'prefill', fresh})` | T2 |
| 4.4 | Run a prompt headlessly and await the result | `AgentRunner.run()` | T1 |
| 4.5 | Modes / personas as instruction overlays ("tutor", "explain simply") | prompt `mode` + role overlays | T1 |
| 4.6 | Command palette: natural-language command bar inside the app | prompt + `ui` tools | T1 |
| 4.7 | Assign a record to the agent like a teammate ("agent: handle this") | `assign()` → job with status | T1 |
| 4.8 | Queue policy when a turn is running (queue, interrupt, reject) | `run({ifBusy})` | T1 |
| 4.9 | Clipboard / selection as input to a prompt | page context variables | T1 |
| 4.10 | Follow-up to the same conversation from a later event | run with `session` continuation | T1 |

## Class 5 — Wake the agent (events, triggers, schedules)

| # | Capability | Primitive | Tier |
| --- | --- | --- | --- |
| 5.1 | Domain events published by the app (`mail.received`, `video.published`) | `EventHub.publish` | T1 |
| 5.2 | Trigger rules: event + filter → prompt or job | `automation.on(type, rule)` | T1 |
| 5.3 | Debounce and batch bursts ("12 new comments" → one run) | rule `batch: {window, max}` | T1 |
| 5.4 | Schedules: cron with time zone, catch-up of missed runs | `automation.schedule(cron, ...)` | T1 |
| 5.5 | Watchers: re-check a condition periodically, fire on change | `automation.watch(check, every)` | T1 |
| 5.6 | Deduplication by event key; at-most-once start per key | `JobStore` job keys | T1 |
| 5.7 | Quiet hours and attention budget | rule `quiet`, `budget` | T1 |
| 5.8 | Follow-through: owner's decision triggers the agent's next step | `proposal.decided` event → rule | T1 |
| 5.9 | Inbound webhooks from external services (normalised to events) | `createWebhookEndpoint` → `EventHub` | T1 |
| 5.10 | Deadline and ageing triggers (no reply in 7 days, invoice overdue) | watcher + schedule | T1 |

## Class 6 — Background work (jobs and long goals)

| # | Capability | Primitive | Tier |
| --- | --- | --- | --- |
| 6.1 | Run a job in its own headless session with the workspace's model | `JobRunner` + `AgentRunner` | T1 |
| 6.2 | Await turn completion (no polling of private files) | `AgentRunner.waitForTurn` | T1 (polling fallback) / T2 (events) |
| 6.3 | Leases, heartbeats, interrupted state, cancel and confirm-stopped | `JobStore` (existing) + runner | T1 |
| 6.4 | Output contracts: the job must save specific records; validated before "done" | `job.expect` / `validate` | T1 |
| 6.5 | Partial completion with an explicit list of what is missing | `partial` status | T1 |
| 6.6 | Retry policy with reconciliation (never blind replay) | `retry({previousStopped})` | T1 |
| 6.7 | Progress reporting to the app UI (`job.progress` events) | `EventHub` | T1 |
| 6.8 | Budgets: time, steps, tool calls, cost per job | runner limits | T1 |
| 6.9 | Daily briefing / digest produced as a structured record | job + output schema | T1 |
| 6.10 | Multi-step plan with checkpoints the owner can inspect | job steps + activity | T1 |
| 6.11 | Model selection per job (inherit, or a named model) | `run({model})` | T1 |

## Class 7 — Human in the loop (proposals, approvals, questions)

| # | Capability | Primitive | Tier |
| --- | --- | --- | --- |
| 7.1 | Agent drafts, owner commits (draft records + app UI commit) | pattern + draft tools | T1 |
| 7.2 | Proposals: typed pending action with summary, preview, evidence, risk | `ProposalStore` | T1 |
| 7.3 | Review queue / agent inbox with Approve, Edit, Reject, Respond | `createReviewEndpoint` + `mountReviewQueue` | T1 |
| 7.4 | Server-enforced approval (a browser click alone never authorises) | toolkit `approval` + endpoint | T1 |
| 7.5 | Approval policies: never / always / predicate (`needsApproval(input)`) / by risk | `defineTool({approval})` | T1 |
| 7.6 | Edit before approve, with validation of the edited arguments | `decide({decision:'edit'})` | T1 |
| 7.7 | Partial accept (some of the proposed items) | proposal with item list | T1 |
| 7.8 | Decision fed back to the agent so it follows through | `proposal.decided` → follow-up run | T1 |
| 7.9 | Questions with options (elicitation) shown in the app | `ui.ask` page action / form card | T1 |
| 7.10 | Approval cards in the panel for every engine | panel approvals | T2 |
| 7.11 | Graduated trust: auto-approve after N accepted proposals of a kind | policy `trust` | T1 |
| 7.12 | "Less like this" / dismissal reasons recorded as preferences | proposal reject note → memory | T1 |
| 7.13 | Expiry of stale proposals | proposal TTL | T1 |

## Class 8 — Show rich results (generative UI)

| # | Capability | Primitive | Tier |
| --- | --- | --- | --- |
| 8.1 | Cards with title, fields, badges and action buttons | `ui.show({type:'card'})` | T1 |
| 8.2 | Tables and comparison matrices | `type:'table'` | T1 |
| 8.3 | Charts from data (bar, line) rendered by the host | `type:'chart'` | T1 |
| 8.4 | Checklists the human ticks | `type:'checklist'` | T1 |
| 8.5 | Diff / before-after views | `type:'diff'` | T1 |
| 8.6 | Forms and choice lists (questions, quizzes) | `type:'form'`, `type:'choice'` | T1 |
| 8.7 | App-registered custom components (catalogue, schema-validated) | `registerComponent(name, schema, render)` | T1 |
| 8.8 | Receipts for completed actions with deep links | `type:'receipt'` | T1 |
| 8.9 | MCP Apps-shaped UI resources for other hosts | `ui://` resource declaration | T1 (declare) |
| 8.10 | Rendered inside the panel conversation | panel cards | T2 |

## Class 9 — Keep everyone in sync (state and change events)

| # | Capability | Primitive | Tier |
| --- | --- | --- | --- |
| 9.1 | Write-completed events to pages (replace polling) | `createEventStream` + `subscribe()` | T1 |
| 9.2 | Targeted refresh: events carry record type and ID | event `subject` | T1 |
| 9.3 | Receipts with "View" deep links after agent writes | `tool.completed` event + toast | T1 |
| 9.4 | Agent activity stream (running, waiting for you, done, failed) | `agent.*`, `job.*` events | T1 |
| 9.5 | Reconnect with replay of missed events | `Last-Event-ID` | T1 |
| 9.6 | Panel → page events (turn finished, session changed) | panel events | T2 |

## Class 10 — Remember and personalise

| # | Capability | Primitive | Tier |
| --- | --- | --- | --- |
| 10.1 | Owner preferences learned from edits to drafts (tone, length) | `PreferenceStore` + `learn()` | T1 |
| 10.2 | Decisions and their reasons (why a deal was declined) | proposal notes → preferences | T1 |
| 10.3 | Per-record notes the agent keeps (relationship history) | app records + resource | T1 |
| 10.4 | Inspectable, editable, exportable memory view in the app | preference resource + review UI | T1 |
| 10.5 | Scopes: owner, app, record, session; no cross-app leakage | scoped keys | T1 |
| 10.6 | Product dual memory (relationships, projects) | product memory tools granted in manifest | T1 (grant) |

## Class 11 — Trust, safety and governance

| # | Capability | Primitive | Tier |
| --- | --- | --- | --- |
| 11.1 | Declared effect per tool (read, write, external, destructive) | `defineTool({effect})` | T1 |
| 11.2 | Autonomy policy per action class (L1–L5) | `policy` on toolkit | T1 |
| 11.3 | Tool definition hashing; change detection requires re-consent | `toolkit.fingerprint()` + `doctor` | T1 |
| 11.4 | Untrusted content marking and size caps | `untrusted()`, result limits | T1 |
| 11.5 | Secrets never reach the model (server-held credentials, URL-mode flows) | design rule + checks | T1 |
| 11.6 | Per-app credentials, origin checks, constant-time token checks | endpoint helpers | T1 |
| 11.7 | Complete audit log with OTel-shaped spans | `ActivityLog` | T1 |
| 11.8 | Kill switch: pause all automation for an app | `automation.pause()` | T1 |
| 11.9 | Egress awareness: tools that send data out are `external` and need approval | effect + policy | T1 |
| 11.10 | Per-user scoping in multi-user apps (tool calls bound to the user) | execution `principal` | T1 (design in A1) |

## Class 12 — Interoperate

| # | Capability | Primitive | Tier |
| --- | --- | --- | --- |
| 12.1 | Expose the app as an MCP server (same tools, resources, prompts) | `createMcpServer(app)` | T1 |
| 12.2 | Page tools compatible with WebMCP | `registerPageTool` + native registration | T1 |
| 12.3 | Generated `llms.txt` / `AGENTS.md` from the definition | `augmentor-app describe` | T1 |
| 12.4 | Run events shaped like AG-UI for existing front-end kits | `toAgUiEvents` | T1 |
| 12.5 | Tool metadata rich enough for App Intents / AppFunctions export | definition fields | T1 (metadata) |

## Class 13 — Build, test and operate

| # | Capability | Primitive | Tier |
| --- | --- | --- | --- |
| 13.1 | One app definition generates manifest names, dispatch and help | `defineApp` + `augmentor-app sync` | T1 |
| 13.2 | Static checks: instructions reference only declared/granted tools | `augmentor-app check` | T1 |
| 13.3 | Mock runtime and scripted model for deterministic tests | `@augmentor/app-sdk/testing` | T1 |
| 13.4 | Contract tests: every tool's schema, effect and approval | `testToolkit()` | T1 |
| 13.5 | Fetch-style (Next.js) and Node handlers for every endpoint | `adapt()` | T1 |
| 13.6 | Self-contained browser bundle; no single-file serving trap | `dist/browser.mjs` | T1 |
| 13.7 | Vendored copies stamped and checked for drift | `augmentor-app vendor` / `doctor` | T1 |
| 13.8 | Profile adoption and migration for existing integrations | `register --adopt` | T1 |
| 13.9 | TypeScript types | `.d.ts` | T1 |

## Class 14 — Voice and multimodal

| # | Capability | Primitive | Tier |
| --- | --- | --- | --- |
| 14.1 | Voice requests produce the same tool calls and approvals as text | same toolkit | T1 |
| 14.2 | Spoken confirmation for sensitive actions with on-screen fallback | proposal + panel voice | T2 |
| 14.3 | Per-workspace voice switch that actually reaches the voice plugin | product fix E1 | T2 |
| 14.4 | Microphone permission declared before the iframe loads | `mountAugmentor({allow})` | T1 |

---

## Software types and the classes they need most

The catalogue is meant to be reused across very different software. ● = central, ○ = useful.

| Software type | 1 Understand | 2 Act | 3 Steer UI | 4 Hand work | 5 Wake | 6 Background | 7 HITL | 8 Rich UI | 9 Sync | 10 Memory | Typical high-value flows |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CRM / deals (Sponsor desk) | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | Triage inbound mail → link → draft → price → review |
| Creator / content pipeline (YouTube) | ● | ● | ○ | ● | ● | ● | ○ | ● | ● | ● | Nightly research, packaging variants, comment drafting |
| Education / tutoring (Student) | ● | ● | ● | ● | ○ | ○ | ● | ● | ● | ● | Quiz me, flashcard drafts, study plan, progress review |
| Support desk / inbox | ● | ● | ● | ● | ● | ○ | ● | ● | ● | ● | Classify, answer from KB, escalate, macro suggestions |
| Project / task management | ● | ● | ● | ● | ● | ● | ● | ○ | ● | ○ | Assign to agent, triage, status digests, dependency checks |
| Bookkeeping / finance | ● | ● | ○ | ● | ● | ● | ● | ● | ● | ○ | Match receipts, categorise, flag anomalies; money always human |
| E-commerce admin | ● | ● | ● | ● | ● | ● | ● | ● | ● | ○ | Product copy, inventory alerts, order exceptions |
| Knowledge base / notes | ● | ● | ● | ● | ○ | ○ | ○ | ○ | ● | ● | Link, summarise, tidy, answer with citations |
| Design / documents | ● | ● | ● | ● | ○ | ○ | ● | ● | ● | ● | Draft variants, review comments, consistency checks |
| Smart home / IoT dashboard | ● | ● | ○ | ● | ● | ● | ● | ○ | ● | ○ | Routines, anomaly alerts, confirm physical actions |
| Analytics dashboard | ● | ○ | ● | ● | ● | ● | ○ | ● | ● | ○ | Explain metric moves, scheduled reports, drill-down navigation |
| Developer / ops tools | ● | ● | ○ | ● | ● | ● | ● | ● | ● | ○ | Incident summaries, runbook steps with approval |

## Autonomy defaults by effect

| Effect | Default level | Default approval | Examples |
| --- | --- | --- | --- |
| `read` | L5 | never | overview, search, read record |
| `draft` (private, reversible, inside the app) | L4–L5 | never | draft reply, suggestion, note |
| `write` (changes shared app state) | L4 | policy (default: never for owner apps, always for multi-user) | update deal stage, save record |
| `external` (leaves the app: send, post, publish) | L3 | always (or not a tool at all) | send email, post comment |
| `destructive` (delete, money, rights, signatures) | L1–L3 | always; prefer human-only UI | delete, pay, sign |
