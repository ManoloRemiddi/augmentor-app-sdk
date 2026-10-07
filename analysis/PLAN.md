<!-- Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0 -->
# Plan: Augmentor App SDK 0.2 — the agent-native app kit

**Status: plan, 2026-10-07; implemented on this branch (see the log at the end).**
Inputs: [FINDINGS.md](FINDINGS.md), [RESEARCH.md](RESEARCH.md), [CAPABILITIES.md](CAPABILITIES.md).

## 1. Goal

Today the SDK embeds a panel and forwards tool calls. The goal is an SDK with which any
application becomes **agent-native**: the agent can operate the whole application (data,
UI, background work) and the application can hand the agent work (premade prompts, events,
schedules) — with the human in control through proposals, review and an audit trail.

Design principles:

1. **One declaration.** Tools, prompts, UI actions, resources and triggers are declared once
   (`defineApp`). Manifest names, server dispatch, DSH descriptors, MCP listings and help
   text are generated from it (fixes D1, D4, F6, F12).
2. **Works with today's runtime (T1); better with the paired product (T2).** Everything
   that can flow through the app's own server and pages does so now. Panel features that
   need the product are negotiated and degrade cleanly. No second agent loop, no copied
   panel (AGENTS.md).
3. **The server enforces; the browser presents.** Approval, scoping, idempotency and audit
   happen on the app server. A browser click never authorises a write on its own.
4. **Standards-shaped.** Tool metadata maps to MCP (annotations, output schema), page tools
   to WebMCP, approvals to the `needsApproval` / accept-edit-reject shapes, run events to
   AG-UI, traces to OpenTelemetry GenAI (RESEARCH §3).
5. **Compatible.** `augmentor-app/1` stays the product contract. Existing exports keep their
   signatures (the product's own tests import `client.mjs` and `tools.mjs`). Existing apps
   on preview 2 are not changed by this work.

## 2. What the runtime already offers (verified)

From the product and DSH analysis (product `9fa2317`, DSH 0.1.5-rc.1):

- The native host forwards `session.event` notifications (`turn/start`, `turn/end` with
  reason, `user/message` whose `source.rpcId` equals the SDK `operationId`, assistant and
  tool events), `session.status`, `approval.requested`, `question.requested` and
  `interaction.resolved`. **Turn completion can be awaited without private files** (K1).
- `session.prompt` is idempotent per `requestId`; `mode` may be `queue` or `steer`; text
  beginning `/name` runs a command (`/goal`, `/plan`); content may include images.
- `session.history` (paged) returns a header with `running`: a lookup by ID that is not
  limited by `session.list`.
- `session.models`, `session.selectModel`, `session.rename`, `session.branch` are allowed
  for workspace sessions; `augmentor/interaction` answers approvals and questions.
- Workspace presets already mount ask-user, todo, web, jobs, skills, goals, plan mode,
  subagents and workflow; naming them in `permissions.tools` grants them.
- DSH `defineTool` accepts a **strict descriptor DSL** (root property map with
  `required: true`; objects must state `additionalProperties`; `oneOf`; annotations
  `description/title/default/examples` only). The SDK passed raw parameters, so the
  starter template's `minLength` is **rejected by real DSH** (new finding B8).
- Limits: a connection follows at most two sessions; a headless prompt fails while the
  embedded panel holds the session's interaction lease; the embedded panel accepts only
  `augmentor-context` from the host.

## 3. Architecture

```text
                         ┌───────────────────── defineApp() ─────────────────────┐
                         │ tools · prompts · uiActions · resources · triggers     │
                         └──────┬───────────────┬───────────────┬────────────────┘
        generated ──────────────┘               │               └──────── generated
  augmentor.app.json + DSH plugin         App server router            MCP server
  (descriptor DSL, Codex tools)    ┌──────────────┴──────────────┐   (other hosts)
                                   │ /tool        tool endpoint  │
   Augmentor runtime ── tool call ─┤ /review      proposals      │
   (DSH / Codex)                   │ /ui          UI bridge      │◄── page: connectPage()
        ▲                          │ /events      SSE change feed│◄── page: subscribe()
        │ prompts, await turns     │ /prompt      ask the agent  │◄── page: agent.ask()
        └──── AgentRunner ◄────────┤ automation   triggers, jobs │
                                   │ ActivityLog · ProposalStore │
                                   │ OperationStore · JobStore   │
                                   └─────────────────────────────┘
```

## 4. The SDK primitives

| Primitive | Module | Capabilities (CAPABILITIES.md) | Fixes |
| --- | --- | --- | --- |
| Schema normaliser + DSH descriptor compiler | `schema.mjs`, `dsh-schema.mjs` | 2.5, 13.4 | B1, B8, D2, D3 |
| `defineTool` / toolkit (effect, approval, annotations, untrusted output, limits, undo, fingerprint) | `toolkit.mjs` | 1.3–1.7, 2.x, 7.4–7.5, 11.1–11.4 | D1, D4 |
| Tool endpoint (Node + fetch), idempotency, error envelope, activity, events | `endpoint.mjs`, `http.mjs` | 2.2–2.3, 9.1, 11.6–11.7, 13.5 | D5, G1, B4 |
| Proposals and review (approve / edit / reject, follow-through) | `approvals.mjs`, `review.mjs` | 7.x | C8 |
| Event hub + SSE change feed | `events.mjs` | 5.1, 9.x | C2, K2 |
| Activity log (OTel-shaped spans) | `activity.mjs` | 1.8, 11.7 | — |
| UI bridge: agent steers the page; page actions; view description | `ui.mjs`, browser `connectPage` | 3.x, 1.1–1.2, 7.9, 8.x | C1 (partly), F13 |
| Prompt library with typed variables | `prompts.mjs` | 4.1–4.5 | C1 (headless) |
| AgentRunner: run, await turn, interactions, models, sessions | `client.mjs`, `agent.mjs` | 4.4, 4.8, 6.1–6.2, 6.11 | K1, E11 |
| Automation: triggers, schedules (cron + time zone), watchers, job runner, budgets, pause | `automation.mjs`, `cron.mjs` | 5.x, 6.x, 11.8 | K1 |
| Preferences (scoped, inspectable learning) | `preferences.mjs` | 10.1–10.5 | — |
| MCP server | `mcp.mjs` | 12.1 | — |
| `defineApp` + one-call server (`createAugmentorServer`) + manifest generation | `app.mjs` | 13.1 | D4, F6 |
| Browser kit: `mountAugmentor` v2, `connectPage`, `subscribe`, `renderAgentUi`, `mountReviewQueue`, `bindPromptButtons`, self-contained bundle | `browser*.mjs`, `dist/` | 3.x, 4.2–4.3, 8.x, 9.x, 13.6, 14.4 | C3, C5, C7, C9, F1 |
| Testing kit: mock runtime, scripted model, toolkit contract tests | `testing.mjs` | 13.3–13.4 | G3 |
| CLI: `check`, `manifest`, `describe` (llms.txt / AGENTS.md), `bundle`, `stamp` | `bin/` | 12.3, 13.1–13.2, 13.7 | F12, G2 |
| Types | `types/*.d.ts` | 13.9 | C6 |
| Panel protocol v2 (product contract, negotiated) | `docs/PANEL-PROTOCOL.md` | 4.3, 7.10, 8.10, 9.6 | C1, C2, C7, C10 |

## 5. Decisions

- **Version** `0.2.0-preview.1`. Large additive surface; `augmentor-app/1` unchanged.
  Unpublished source; existing live apps stay on preview 2 until the owner decides (Q9).
- **Approvals are server proposals by default** (works with every engine and in hosted
  apps). Panel approval cards are a T2 enhancement.
- **UI control goes through the app server** (SSE to the page, result POST back), so it
  works today with any runtime and any topology the app server can reach.
- **Prompts from the page** run headlessly through the server today (result streamed to
  the page and recorded); in-panel delivery is T2 and is used automatically when the
  panel advertises it.
- **Generative UI** uses a small trusted catalogue rendered by the host with DOM APIs (no
  HTML injection), plus app-registered components validated by schema. MCP Apps-shaped
  `ui://` declarations are recorded for other hosts.
- **MCP** server implements the stable core (initialize/discover, tools, resources,
  prompts, ping) over HTTP JSON-RPC with bearer auth; experimental.
- **No new runtime dependency** beyond `ajv`.

## 6. Phases

1. Correctness base: defect fixes (B1–B8), schema/DSH compiler. ✔ before features.
2. Server core: toolkit, endpoint, proposals/review, events, activity.
3. Agent side: client events, AgentRunner, prompts, automation and jobs, testing kit.
4. Page side: UI bridge, browser kit, renderer, review queue, bundle.
5. Integration: `defineApp`, one-call server, MCP, preferences, CLI, templates.
6. Docs, types, examples, migration guides for the two live apps, version, full test
   matrix on Node 24, package consumer test.

## 7. Out of scope (recorded for the owner)

Product-side work (panel protocol v2, panel approval UI, more followed sessions, MCP rows
in presets, webhook ingress, voice workspace authorisation E1, skill/AGENTS.md leakage
into workspace sessions), the hosted multi-user pairing design (A1), and any change to
the live apps.

## Log

- 2026-10-07: plan written after six research/analysis streams.
- 2026-10-08: phases 1–6 implemented on this branch (see FINDINGS log for fixed IDs). The real
  DSH agent loop proof (`test:agent-loop`) passes on a product-installed workspace preset. Product
  work in §7 and the hosted multi-user design remain open.
