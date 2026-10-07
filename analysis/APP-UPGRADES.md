<!-- Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
# Upgrade plans for the three reference apps

**Status: plans, 2026-10-07. Nothing here has been applied to any app.** Each plan uses SDK
0.2.0-preview.1 (this branch) and must go through the owning app's own deployment and data
preservation rules. Private details are omitted; apps are described by their public role.

## Common first steps (all three)

1. Pin the new SDK archive in `vendor/` and switch the browser module to the single-file
   bundle (`augmentor-app bundle`) — this alone removes the F1 upgrade blocker.
2. Move each app's tool list into one `defineApp()` module, keeping existing tool names so
   conversations and grants stay valid. Generate `augmentor.app.json` and `tools.json`; add
   `augmentor-app check` to the app's test script.
3. Replace UI polling with the change feed.
4. Add `<prefix>_reference` and delete duplicated prose that restated tool rules.

## Sponsor desk (CRM + inbox, app on NAS, agent on PC)

| Today | With 0.2 |
| --- | --- |
| Opaque `json` parameters for commands, drafts, pricing | `oneOf` command unions with nested required fields; the model gets the real schema |
| Agent writes run without approval; send/decide kept out of tools | Keep that, and add `effect: 'external'` proposals only where the owner wants the agent to queue a send for review |
| "Work on this / Ask Augmentor" only set context | Premade prompts (`triage_email`, `draft_reply`, `quote_request`, `explain_stuck_deal`, `chase_payment`, …) as buttons on thread, deal, overview and earnings |
| Agent moves the UI only through link hashes | UI bridge: open thread at a message, open deal at a field, fill the calculator without saving, show a price comparison card, show draft diffs |
| Proposed but unbuilt "daily judgement" job | `automation.schedule('daily_judgement', …)` with output `expect`, narrow tool set and the pause switch; Gmail sync publishes `mail.received` for triage rules |
| Hand-built heartbeat records | `agent.run.*`, `job.*` events and the activity log |
| Owner-decision provenance relies on agent notes | Proposals carry the owner's decision and note; preferences record edits |

Topology note: the tool module must still be installed on the PC (FINDINGS A2); 0.2 makes
it a three-line module reading `tools.json`, so the PC needs no app checkout beyond that file.

## YouTube workspace (creator pipeline, background jobs first)

| Today | With 0.2 |
| --- | --- |
| Custom job runner: polls `session.list`, reads private product files for the model, checks a private client field | `createAutomation` + `AgentRunner`: schedules with time zone and catch-up, leases, awaited turns from session events, model selection per run, `expect` output checks |
| Polling every 5–8 s | Change feed; job progress and result cards as events |
| Whole records as untyped `json` | Typed record schemas per kind (unions), fixing the documented wrong-shape failures |
| Comment replies: agent suggests, owner submits | Keep; add "Make this shorter", "Turn into an idea" prompt buttons; agent prefills the reply box with `ui_fill` |
| Tray polls `/status` | Tray subscribes to the change feed |

## Augmentor Student (hosted, many students)

This app needs FINDINGS A1 (hosted app + runtime on each student's machine), which 0.2 does
not solve. What 0.2 provides now:

- Remove the copied panel, the in-page fake runtime and DOM scripting; use `mountAugmentor`
  where a student has a runtime, and `createAgent().ask()` for page-driven prompts.
- Server-enforced approvals (proposals) instead of browser-only approval cards.
- `authenticateRuntime` (per-user runtime credentials) and per-principal UI routing
  (`singleOwner: false`) as the building blocks for the multi-user design.
- Quiz, flashcard and plan review as `choice`, `form`, `checklist` and `custom` UI specs.
- Prompt library with modes ("Explain simply", "Quiz me") instead of three role copies.

Open design work before shipping: runtime pairing per student, entitlement binding, and a
documented cloud fallback using the same tool declarations.
