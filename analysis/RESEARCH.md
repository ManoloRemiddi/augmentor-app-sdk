<!-- Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0 -->
# Research: agents embedded in software (state of the art, October 2026)

**Status: research synthesis, 2026-10-07.** Produced from three web-research streams and
four code analyses. External claims are cited with the source the research used; items
marked (2°) rest on secondary coverage only. Several primary sites were blocked by the
research environment's network proxy, in which case the specification source repositories
were read instead. Treat versions and dates as "reported", not verified here.

Companion documents: [FINDINGS.md](FINDINGS.md) (problems found in our code),
[CAPABILITIES.md](CAPABILITIES.md) (the functionality catalogue) and [PLAN.md](PLAN.md).

## 1. What embedded agents do in products today

| Class | What it means | Product examples | What the host app must provide |
| --- | --- | --- | --- |
| Q&A over app data | Answers from the app's own records with citations | Acrobat "PDF Spaces", HubSpot Data Agent, Gemini Enterprise over Workspace | Permission-aware retrieval, entity model, deep links |
| Command / action execution | Typed operations that change data | Agentforce actions (Flows/Apex/APIs), M365 declarative agents (OpenAPI/MCP), Apple App Intents | Tool registry with schemas, side-effect flags, scopes, idempotency |
| UI navigation and form prefill | Take the user to the screen, prefill, user confirms | Shopify Sidekick app actions (2°), WebMCP declarative forms, Copilot Studio computer use | Routable views, form-fill API, element/entity IDs, on-screen context |
| Generative UI | Agent renders interactive components | MCP Apps (`ui://`), ChatKit widgets, CopilotKit render actions, Canva Code | Component catalogue, sandbox, UI-event channel back to the agent |
| Drafting and review | Drafts for human edit | Superhuman Auto Drafts, Word Agent Mode, Figma First Draft | Draft state separate from committed data, voice/style context |
| Proactive suggestions | Unprompted recommendations | Sidekick "Pulse" (2°), Linear Triage Intelligence | Event stream, suggestion slots, dismiss/feedback signals |
| Scheduled automation | Recurring unattended work | Notion Custom Agents, Cursor automations, Replit scheduled agents | Job runner, durable state, service identity, budgets |
| Event-triggered workflows | Wake on app events | Copilot Studio autonomous triggers, Notion meeting-note triggers | Event bus/webhooks with filters |
| Long multi-step goals | Plan and execute larger tasks | GitHub Copilot coding agent (issue → draft PR), Replit Agent 3, Agentforce Atlas | Isolated workspace, progress, checkpoints |
| Data import / cleanup / enrichment | Bulk extraction and enrichment | Airtable Field Agents, Clay Claygents, HubSpot Smart Properties | Bulk APIs, schema introspection, provenance per value |
| Analytics and insights | Explain and cluster data | Sidekick analytics, Linear agent clustering requests | Query layer, aggregation outside the context window |
| Onboarding / teaching | Walkthroughs, tutoring | Sidekick walkthroughs, Acrobat "instructor" role | Highlight/overlay hooks, help content |
| Cross-app orchestration | Agents spanning many systems | Zapier MCP, ServiceNow AI Agent Fabric (MCP + A2A), Canva MCP server | Inbound MCP server, outbound MCP client |
| Approvals / HITL | Pause for human decision | n8n per-tool approval, Zapier Request Approval, Retool HITL, Intercom Fin Procedures | Pending-action store, approve/edit/reject, resume |
| Memory / personalisation | Learned preferences | Notion "My Notion AI" page, Microsoft Work IQ, Sidekick team skills | Visible, editable memory store, per-user profiles |
| Voice | Spoken interaction | Sidekick voice, Zendesk voice agents | Streaming I/O, short confirmations |
| Agent as teammate | Assign work to agents | Jira (assign to Rovo/Copilot/Claude, GA May 2026), Linear agent sessions, Asana AI Teammates | Agent identities, session/activity APIs, assignee model |
| Observability / audit / evals | Runs, cost, replay, simulations | Retool runs and evals, Intercom Simulations, Agentforce Audit Trail | Structured action log, replay, mock connectors |
| Undo | Reversible agent changes | Notion "you can always undo", branch/PR-based coding agents | Versioned writes tagged by agent and session |

Sources: Agentforce https://www.salesforce.com/agentforce/how-it-works/ ·
M365 plugins https://learn.microsoft.com/copilot-plugins/overview ·
MCP Apps https://www.thoughtworks.com/radar/platforms/mcp-apps ·
Notion agents https://notion.com/releases/2025-09-18 ·
Copilot Studio triggers https://m365admin.handsontek.net/?p=12628 ·
n8n HITL https://docs.n8n.io/advanced-ai/human-in-the-loop-tools ·
Jira agents https://support.atlassian.com/jira-software-cloud/docs/collaborate-on-work-items-with-ai-agents/ ·
Linear agents https://linear.app/developers/agents ·
Airtable AI fields https://support.airtable.com/docs/using-airtable-ai-in-fields ·
GitHub coding agent https://github.blog/news-insights/product-news/agents-panel-launch-copilot-coding-agent-tasks-anywhere-on-github/

### Interaction surfaces in use

Side panel or overlay chat; inline ghost text and auto-drafts; "Ask AI" buttons with
premade prompts; @mentions in comments; the agent as an assignee; an agent inbox or
"mission control" task list with session states (Linear: pending, active,
awaitingInput, error, complete, stale); notifications when work completes; review queues
and diffs; proof artifacts (screenshots, logs); AI fields in tables; proactive cards on
open; voice; third-party chat hosts (apps inside ChatGPT or Claude).

### Trust and control mechanisms in use

Agents inherit the user's permissions (Notion); separate agent identities (Microsoft Entra
Agent ID); confirmation by action class (Gemini in Chrome confirms sends, data changes and
form submissions and hands payments back to the user,
https://support.google.com/chrome/answer/16821166); per-tool approval gates; preview and
prefill; diffs; sandboxes and egress firewalls; deterministic flows next to free
reasoning (Salesforce "levels of determinism", Agent Script); PII masking; audit logs;
credit budgets; pre-deployment simulation; least-privilege defaults after the Comet
prompt-injection disclosure (2°).

## 2. How humans, agents and software interact

**Autonomy is a design choice, not a capability.** The Knight Institute / UW levels
(https://knightcolumbia.org/content/levels-of-autonomy-for-ai-agents-1) name the user's
role: L1 operator, L2 collaborator, L3 consultant, L4 approver, L5 observer. Anthropic's
February 2026 study of real usage (https://www.anthropic.com/research/measuring-agent-autonomy)
found experienced users move from approving every step to monitoring and interrupting;
auto-approve rises from about 20% to over 40% of sessions with experience, and only 0.8% of
actions looked irreversible. Its advice: approval alone is not enough; give visibility and
easy redirection. **Implication:** autonomy is a policy object per app, action class and
resource, with graduated trust and always-ask rules for irreversible, financial and
security-relevant actions.

**Human-in-the-loop patterns.** Durable interrupt and resume (LangGraph `interrupt()` /
`Command(resume)`); approve, edit or reject a tool call (LangChain HITL middleware); the
Agent Inbox with per-item allowed responses (accept, edit, respond, ignore,
https://blog.langchain.com/introducing-ambient-agents); structured elicitation (MCP form
mode, and URL mode for secrets and payments); "agent drafts, human commits" (draft PRs);
approval as a separate, verifiable record rather than a chat message (A2A
`input-required`). **Implication:** a typed proposed action with preview, rationale and
reversibility; durable interrupts resumable from any surface; an inbox API; checkpoints,
undo and dry run.

**Proactive and ambient agents.** Event, watcher or schedule triggers producing notify /
ask / act outcomes; overnight research delivered as morning cards (ChatGPT Pulse);
timing research shows help lands best at activity transitions and in a "Goldilocks
window" (https://arxiv.org/html/2504.09332v1). **Implication:** an app event bus,
trigger/schedule registry, interruptibility signals and an attention budget with urgency
tiers (log, digest, badge, interrupt) and "less like this" feedback.

**Generative UI and agent-driven UI.** Agents pick from a trusted component catalogue
(A2UI); embedded UIs in sandboxed iframes with JSON-RPC (MCP Apps, stable 2026-01-26);
shared state snapshots and deltas plus frontend tools (AG-UI); page-registered tools for
in-browser agents (WebMCP); outcome-based "intent" UI. **Implication:** semantic actions
rather than pixels: typed tools, view-state selectors, a component catalogue, two-way
shared state with an "agent is editing" indicator, navigation and focus APIs; pixel-level
computer use only as a fallback.

**Delegation and multi-agent.** Agents are delegates, not accountable assignees (Linear);
agent sessions with visible statuses; several agents compared on one task (GitHub Agent
HQ); A2A across organisations with narrowing permissions. **Implication:** agent identity
separate from the owner, session status streams, handoff contracts with acceptance
criteria and budgets.

**Memory.** Entity-scoped memory (user, agent, app, run — Mem0); project-only memory
(ChatGPT) is a context boundary, not an access boundary; file-based memory plus context
editing (Anthropic). **Implication:** owner → workspace → app → record → session scopes,
inspectable and editable, with provenance and learning from accept/edit/reject signals.

**Reliability and security.** OpenTelemetry GenAI conventions (`invoke_agent`,
`execute_tool`; still "Development"); deterministic tests with mock models (Vercel AI SDK
`MockLanguageModel`); OWASP LLM Top 10 2025 (LLM01 prompt injection, LLM06 excessive
agency, LLM10 unbounded consumption); OWASP Agentic Top 10 (December 2025: goal hijack,
tool misuse, privilege abuse, memory poisoning, cascading failures, human-agent trust
exploitation…); the "lethal trifecta" of private data + untrusted content + exfiltration
(https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/); architectural defences
(action-selector, plan-then-execute, dual LLM). **Implication:** tracing, replayable
action log, mock-model harness, budgets, taint marking of untrusted content, egress
control, red-team checks.

**Voice and multimodal.** Realtime speech agents with tool calls; screen understanding.
**Implication:** voice uses the same tools and approvals as text; barge-in; an
app-supplied "semantic screen" instead of raw pixels.

**Local-first and owner-controlled.** On-device models (Apple Foundation Models, Chrome
Prompt API), local servers with OpenAI-compatible APIs. A local agent spanning many apps
is the trifecta case, so policy must live in the owner's runtime. **Implication:** local
by default, explicit escalation to cloud, owner-side consent and audit, revocable per-app
grants, offline modes.

## 3. Protocols and standards: what to implement, mirror or ignore

| Standard | Status (reported) | Decision for the SDK | Why |
| --- | --- | --- | --- |
| **MCP core** | Latest revision 2026-07-28 (stateless, `server/discover`, multi-round-trip input, tasks moved to an extension); 2025-11-25 still widely deployed | **Implement** a server for app tools, resources and prompts, accepting both revisions' basics | Universal tool layer, Linux Foundation governed; DSH ships an MCP client |
| **MCP Apps** (`ui://`, `text/html;profile=mcp-app`) | Stable 2026-01-26; hosts include Claude, ChatGPT, VS Code, M365 | **Mirror now** (declare UI resources in the same shape); full host bridge later | Generative UI that works across hosts |
| **WebMCP** (`document.modelContext.registerTool`) | W3C CG draft; Chrome/Edge origin trials | **Implement the shape** for page tools; register natively when present | Agent-operable pages with the emerging browser API |
| **AG-UI 1.0** | CopilotKit; adopted by Mastra and Microsoft Agent Framework | **Mirror** event and interrupt shapes (run lifecycle, tool calls, state snapshot/delta, interrupts with resume) | App ↔ agent run streaming without inventing names |
| **A2A 1.0** | 2026-03; agent ↔ agent | **Mirror** task states and artifacts; no server now | Different problem (agent federation) |
| **OpenAI Apps SDK** | Implements MCP Apps plus `window.openai` extras | **Via MCP Apps**; mirror widget state only | Avoid vendor-only surface |
| **ChatKit / Agent Builder** | Agent Builder sunsetting 2026-11-30 | **Ignore** | Vendor-specific |
| **Vercel AI SDK** | `needsApproval: boolean | (input) => boolean` | **Mirror** the approval predicate signature | Familiar to web developers |
| **Claude Agent SDK** | allow / deny / ask decisions; Pre/PostToolUse hooks | **Mirror** decision triple and hook names | DSH ships Claude-style hooks |
| **LangGraph / Agent Inbox** | interrupt + resume; accept/edit/respond/ignore | **Mirror** for the approvals inbox | Best-known inbox shape |
| **Codex app-server** | JSON-RPC, threads/turns/items, unstable schema | **Backend adapter only** (already in the product) | Not an app-facing protocol |
| **App Intents / AppFunctions / Windows agent connectors** | Platform-specific | **Mirror metadata** so tools can be compiled to them later | Keep tool descriptions rich enough |
| **OpenTelemetry GenAI** | Development status | **Implement** span shapes in the activity log export | Observability interop |
| **llms.txt / AGENTS.md** | Widely used by coding agents | **Generate** from the tool registry | Cheap discoverability |
| **Agent payments (AP2/ACP/UCP)** | Volatile | **Ignore**; payments only out of band | Never through tool arguments |

Source repositories read: github.com/modelcontextprotocol/modelcontextprotocol,
github.com/modelcontextprotocol/ext-apps, github.com/webmachinelearning/webmcp,
github.com/ag-ui-protocol/ag-ui, github.com/a2aproject/A2A,
github.com/open-telemetry/semantic-conventions-genai. Approval APIs:
https://ai-sdk.dev/docs/agents/tool-approvals,
https://docs.claude.com/en/api/agent-sdk/permissions,
https://docs.langchain.com/oss/python/langgraph/interrupts,
https://mastra.ai/docs/agents/agent-approval.

### Security lessons adopted as SDK rules

1. Tool definitions are model-read instructions: hash them, namespace them per app, keep
   rosters small, and require re-consent when a definition changes.
2. Tool results may carry untrusted content: mark it (`untrustedContent`), prefer
   structured output validated against an output schema, cap sizes.
3. Hints such as read-only or destructive are not enforcement: the app server enforces
   approval and scopes itself.
4. No token passthrough; per-app credentials; origin checks; refuse unauthenticated
   loopback.
5. Secrets and payments never pass through the model or through forms.
6. Least privilege: per-tool grants, inputs shown before consequential execution, rate
   limits, audit of every call.
7. Generated UI only from a trusted catalogue or in sandboxed frames.
8. Schemas: no network `$ref`, bounded composition, validate inputs and outputs.

## 4. Evidence from the four Augmentor apps

| App | Architecture | Agent mode | Workarounds built because the SDK lacked them |
| --- | --- | --- | --- |
| Sponsor desk | App on NAS, agent on PC, SSH tunnels | Interactive copilot | Opaque `json` parameters, polling for changes, own heartbeat status, own settings dialog, `?release=` cache-busting, absolute links in prompts |
| YouTube workspace | One Linux desktop, tray, Electron | Background jobs first | Full job runner on private product internals, polling, own tool envelope, model selection read from product files |
| Augmentor Student | Hosted Next.js, many students | Page-driven tutor | Copied panel with an in-page fake runtime and a cloud model, DOM-scripted prompts, own approval cards, duplicated tool/role/prompt definitions |
| The product itself (Augmentor Desktop/Browser) | Owner's machine | Personal agent | (Reference for what the runtime can already do; see PLAN.md §2) |

All three apps independently asked for the same primitives: host-sent prompts with
templates, a review queue with approve/edit/reject, change events instead of polling,
agent control over navigation and highlighting, typed nested tool schemas with declared
effect and approval, generative cards, triggers and schedules, and memory that learns
from owner edits. The owner-built apps are reference evidence, not independent adoption.
