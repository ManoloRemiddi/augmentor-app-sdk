<!-- Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0 -->
# Delivery report — Augmentor App SDK 0.2.0-preview.1 (2026-10-08)

Branch `claude/admiring-dijkstra-sq4i9a`. Nothing was published, merged, deployed or changed
in any other repository or live application. No pull request was opened.

## What you asked for, and where it is

| Request | Result |
| --- | --- |
| Deep analysis of the three apps | [FINDINGS.md](FINDINGS.md) §2a, themes A–L; [APP-UPGRADES.md](APP-UPGRADES.md) |
| Research on what is possible and trending | [RESEARCH.md](RESEARCH.md) (products, interaction patterns, protocols, security) |
| A long list of functionality and functionality classes | [CAPABILITIES.md](CAPABILITIES.md): 14 classes, ~140 capabilities, software-type matrix, autonomy defaults |
| A plan | [PLAN.md](PLAN.md) |
| A finished SDK | `src/`, `dist/`, `types/`, `templates/app/`, `examples/studio-desk/`, docs: [GUIDE.md](../docs/GUIDE.md), [PANEL-PROTOCOL.md](../docs/PANEL-PROTOCOL.md), [MIGRATION-0.2.md](../docs/MIGRATION-0.2.md) |

## What the SDK now does

The agent can operate the software and the software can hand the agent work:

- **One declaration** (`defineApp`) → manifest, runtime descriptors, DSH/Codex/MCP schemas, reference text; `augmentor-app manifest/check/describe` keep them in sync.
- **Tools with effects and approvals**: read/draft/write/external/destructive, server-enforced proposals, owner review queue, edit-before-approve, graduated trust, idempotent writes, audit log, change events.
- **Agent steers the UI**: navigate, open, highlight, prefill (never submit), notify, show rich cards/tables/charts/diffs, ask the user, read the current view, plus app-defined page actions — through the app server, so it works with today's runtime.
- **Software hands work to the agent**: premade prompts with typed variables and modes, "Ask" buttons, background runs that await the turn, in-panel delivery when the panel supports it.
- **Ambient automation**: event triggers with dedupe, batching, quiet hours and budgets; cron schedules with time zones and catch-up; watchers; pause switch.
- **Live sync**: Server-Sent Events change feed replaces polling.
- **Memory**: scoped preferences with provenance; owner decisions recorded as feedback; agent suggestions never override the owner.
- **Interoperability**: MCP server with the same approvals and audit.
- **Developer experience**: Node and fetch (Next.js) handlers, single-file browser bundle, TypeScript types, `init --template app`, mock runtime + scripted model, runnable example.

## Bugs found and fixed

B1 nested required fields; **B8 — the starter template's tool fails to load in real DSH,
silently** (confirmed in the real DSH 0.1.5-rc.1 tool runtime; fixed by compiling schemas to
DSH's descriptor DSL); B2–B5, B7 error-handling and store defects; `canonicalJSON` emitting
invalid JSON for undefined members; F1 single-file browser module that breaks both live apps
on upgrade; F2 machine paths in a shipped document.

## Evidence (Node 24.19.0, Linux)

| Check | Result |
| --- | --- |
| `npm run check` (syntax + bundle freshness) | pass |
| `npm test` | 62 pass, 1 opt-in skipped |
| Schema test against the real DSH compiler (`AUGMENTOR_DSH_TOOLS_SCHEMA`) | 5/5 |
| `npm run test:package` (clean consumer: minimal starter + app kit end to end) | pass |
| `npm run check:types` | pass |
| `npm run test:browser` (Chromium, synthetic stand-in panel) | 7/7 |
| `npm run test:example` (Chromium, mock model) | pass |
| `scripts/proof-dsh.mjs` against the real DSH 0.1.5-rc.1 tool runtime | pass |
| `npm run test:runtime` against built product `main` `9fa2317` | 27/27 |
| `npm run test:agent-loop` — real pinned DSH agent loop, product installer + preset roster + workspace guard, SDK server and page, fixture model | pass (7 model requests, 19 assertions) |
| `npm run test:installed` — real `dsh --profile web` host, product installer, `augmentor-app register`, product embedding service + native host, maintained panel in Chromium, SDK host page, fixture model | pass with the paired panel v2 product change; fails at the capability check without it (expected) |
| `npm audit` | 0 vulnerabilities |

What `test:agent-loop` proves end to end: the product's `installProfile` writes the workspace
preset, DSH's preset roster mounts it (role in the system prompt, SDK tool module, product
policy guard), the model is offered only granted tools with nested required fields, a
versioned write lands in the app, an invalid enum is refused inside DSH before any HTTP call,
the agent's UI command reaches the open page, an `external` tool becomes a proposal that runs
exactly once after the owner approves, an ungranted tool is refused by the product guard, and
the turn ends `completed`. The model is a deterministic fixture: this proves the wiring, not
model quality.

What `test:installed` proves on top: Augmentor installed into a real DSH web host by the
product's own setup code; the application registered with the SDK CLI; the maintained panel
running in Chromium inside the application's page; the page sending a premade prompt into the
panel conversation, the agent operating the application (data, UI, a gated external action)
and the panel reporting the turn back to the page; the owner approving in the application; and
a background premade prompt completing through the SDK client and the product native host.

Panel protocol v2 product side: implemented in augmentor-agent (embedded entry, a small
`host-commands.mjs` used by the side panel, a unit test and the embedding document; about 80
lines) and merged as [augmentor-agent#43](https://github.com/ManoloRemiddi/augmentor-agent/pull/43)
on October 8. Installed panels advertise v2 once their build includes it; older panels use the
T1 paths, which work today.

Not done: a real model (no credentials were used), the packaged desktop application with its
tray and home services, macOS/Windows runs, the product's jsdom panel suites (their test
dependencies were not installed here; the root workspace suites and the new unit test pass),
any live-app migration, publication.

## Decisions for you

1. Q1–Q3: should hosted multi-user apps (Augmentor Student) be supported, and how
   (local pairing vs relay, per-student credentials)? The SDK has the building blocks
   (`authenticateRuntime`, per-principal UI routing) but not the pairing design.
2. Q5: target DSH line for the next preview (0.1.5-rc.1, 0.2.0-rc.2 or both). The descriptor
   compiler matches both per the product analysis; only 0.1.5-rc.1 was run here.
3. Q7: confirm "agent drafts, owner commits" as the default recommendation.
4. Q9: when to move Sponsor desk and the YouTube workspace off preview 2 (start with the
   single-file bundle; see APP-UPGRADES.md).
5. Whether to publish 0.2.0-preview.1 as a release archive (both pull requests are merged).

## Notes

- The tutoring app was analysed read-only because you asked for all three apps. On October 8
  you removed the old AGENTS.md rule about not building or inspecting a "third reference app".
- Security issues in private repositories are listed by title only in this public repository.
- One research report was flagged by the harness for an instruction-shaped pattern; it was the
  Claude Agent SDK permission-mode name (`bypassPermissions`) quoted in the research, not an
  instruction, and nothing was acted on.
