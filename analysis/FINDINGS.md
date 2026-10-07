<!-- Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0 -->
# Ecosystem analysis: findings, problems and candidate solutions

**Status: living analysis, started 2026-10-07. Implementation of the resulting plan
(PLAN.md) is in progress on this branch; each fix is recorded in the log.**

This document records what we are learning about the Augmentor App SDK and
everything it depends on, before any new code is written. Each finding states the
problem, the evidence, the impact and one or more *candidate* solutions. A
candidate is not a decision; decisions are recorded in the [log](#log) when made.

This folder is not part of the npm package (`package.json` ships an allowlist that
does not include `analysis/`). It is still public with the repository, so it
contains no private app data, credentials, machine paths or exploit detail for
private repositories. Security findings in private repositories are listed by
title only and kept with their owner.

## How to read and extend this document

Every finding has an ID (`A1`, `B3`, …) so later analysis can refer to it. Add new
findings to the matching theme, or open a new theme letter. Do not renumber.

| Evidence level | Meaning |
| --- | --- |
| **Reproduced** | Demonstrated by running code (script or test) during the analysis. |
| **Confirmed** | Read in the source at the stated revision; not executed. |
| **Reported** | Stated by another session or by the owner; not yet checked here. |

Severity is about this ecosystem's single-owner trust model: **High** breaks a
security boundary or loses data, **Medium** breaks a supported path or misleads
an integrator, **Low** is friction, hygiene or defence-in-depth.

## 1. Scope and sources

| Repository | Revision analysed | Role |
| --- | --- | --- |
| `augmentor-app-sdk` (this repo) | `25e3952` (= `main`) | Integration contract, client, proxy, tools, jobs. Preview 3 published, preview 4 in source. |
| `augmentor-agent` | `9fa2317` (`main`) | The product: Qt Desktop, Chromium Browser, native host, DSH/Pi/Codex adapters, the `augmentor-app/1` runtime side. v0.2.13 preview. |
| `resonant-voice` (private) | `9f43183` (`main`, v0.1.16) | DSH plugin for local speech. Augmentor ships 0.1.19 from an unmerged branch. |
| `dsh-model-picker-augmented` | `3264aa7` (1.1.2) | Bundled DSH plugin. |
| `dsh-adaptive-reasoning` | `7c38ebb` (0.2.3) | Bundled DSH plugin. |
| `dsh-steering` | `b7d2e18` (0.1.0) | Vendored into `augmentor-agent/adapters`. |
| `dsh-prompt-library` | `71b945c` (0.2.1) | Diverged from Augmentor's own adapter. |
| `DSH-Metafolder-Plugin` | `a5332d9` (1.2.1) | Optional; not used by Augmentor. |
| `deepseek-harness-plugins` | `404e2e9` | Catalogue and ZIP builder; not used by Augmentor. |
| `dsh-privacy-guard` (private) | `352f301` (0.1.0) | Not used by Augmentor. |
| `sponsor-desk` (private) | `0cc576e` (v3.1.5) | Live reference app 1: sponsorship CRM and inbox. SDK preview 2. |
| `youtube-dashboard` (private) | `b571d2d` | Live reference app 2: creator workspace with background agent jobs. SDK preview 2. |
| A hosted reference app (owner report) | not inspected | Lessons reported by the owner from a separate build session; see theme A. |

The two live apps were built by the owner alongside the SDK. They are real
integrations but not independent third-party adoption evidence.

Test runs during the analysis (Node 22.22.0; the SDK requires 24.14+, so SDK
results are indicative only):

- SDK: `npm run check` passes, `npm test` 29/29, `npm run test:package` 1/1.
- resonant-voice: 34/34 Node and 15/15 Python. The real-DSH integration test needs
  an installed DSH and did not run.
- Plugins: Model Picker 3/3, Adaptive Reasoning 63/63, Steering 4/4, Prompt Library
  5/5, Metafolder passes.
- augmentor-agent: typecheck and build pass, workspace/Codex tests 16/16. The full
  suite gave 416 pass and 92 fail; the failures inspected were missing environment
  (DSH, Qt, Chromium, Codex), not code.
- sponsor-desk: the 7 of 18 test files that need no extra dependencies or services
  pass (55/55). The other 11 need network installs or spawn the server.
- youtube-dashboard: 90/90 pass offline, loopback only, with fixtures and mocked
  Google calls.
- Neither app has a test for its tool registration or manifest validation.

## 2. How the pieces fit

```text
 Owner's application                       Augmentor (owner's machine)
 ┌──────────────────────────────┐          ┌──────────────────────────────────────┐
 │ Browser page                 │          │ Embed server  /embed/<profile>/      │
 │  mountAugmentor() ── iframe ─┼─same-────┼─► maintained panel (sidepanel.html)  │
 │                              │ origin   │        │                             │
 │ App server                   │ proxy    │ Native host ── DSH / Codex / (Pi)    │
 │  createAugmentorProxy() ─────┼─bearer───┤        │   workspace preset          │
 │  tool endpoint ◄─────────────┼──HTTPS or┼── application tools (SDK wrapper)    │
 │  OperationStore / JobStore   │ loopback │ DSH plugins: product, memory, voice… │
 └──────────────────────────────┘          └──────────────────────────────────────┘
```

- The SDK owns the contract (`augmentor-app/1`), the client, the proxy, tool
  validation and the optional stores. It has no UI and no agent loop.
- The panel, sessions, approvals, presets, memory and voice belong to
  `augmentor-agent`. Most of Augmentor's DSH behaviour lives in its own
  `adapters/dsh-*` plugins.
- External DSH plugins shipped in the complete install: Model Picker Augmented
  1.1.2, Adaptive Reasoning 0.2.3, Resonant Voice 0.1.19.
- The supported topology assumes the app's server can reach the Augmentor host
  (same machine or private network) and holds the proxy's bearer token.

## 2a. Why the SDK exists: use cases from the reference apps

The goal is twofold: let the owner add the agent to more of their own apps, and let
other people embed it in their systems with little friction. Three apps show what
"embedding the agent" means in practice.

| | Sponsor desk | YouTube workspace | Hosted tutoring app (owner report) |
| --- | --- | --- | --- |
| Domain | Sponsorship CRM: deals, tasks, payments, documents, pricing, mail inbox | Creator workspace: ideas, video pipeline, comments, library | Student tutoring: courses, flashcards |
| Users | One owner | One owner | Many students, each with their own runtime |
| Topology | App on a NAS; Augmentor on the owner's PC; SSH tunnels both ways | Everything on one Linux desktop (plus tray and Electron shell) | App on a web host; Augmentor on each student's machine |
| Main agent mode | Interactive copilot in the side panel | Background jobs in headless sessions (scheduled daily and on demand); panel chat second | Interactive tutor in the panel, host page wants to drive it |
| Agent reads | Overview, deals, mail threads, pricing rules | Overview, records, video context, transcripts, comments | Course material |
| Agent writes | Record updates, private drafts, quotes, tracking | Versioned records, reply suggestions, job results | Flashcards and other course records |
| Irreversible steps | Kept out of the tool set: owner sends mail and decides tasks in the app UI | Kept out of the tool set: owner publishes replies in the app UI | Approval cards wanted in the panel |
| SDK | Preview 2 tarball, vendored | Preview 2 tarball, vendored | Copied and modified SDK files |

What the agent is used for, across the three:

1. **Copilot over the app's own records.** The agent reads the same records as the
   UI and proposes or makes changes through the app's API, never directly in the
   database. Context is a small hint (current view and record IDs); tools re-read
   the real data.
2. **Drafter, with the owner committing.** Replies, quotes and reviews are saved as
   drafts. The app's own UI performs the irreversible step (send, publish, decide).
   Both live apps achieve "approval" by leaving those actions out of the tool set.
3. **Background worker.** Scheduled or on-demand jobs run in separate headless
   sessions. The app builds the prompt, waits for the turn to finish, validates
   what was saved and records the outcome.
4. **Interactive tutor or assistant driven by the page.** The host page wants to
   start or steer a conversation from its own buttons (reported app).

The reusable integration pattern both live apps converged on:

- one authoritative app store with record versions and event-ID idempotency,
  shared by the UI and the agent's tools;
- thin, bearer-authenticated tool endpoints over the app's API, with read-back
  after writes;
- secrets and OAuth kept on the app server, never visible to tools or the model;
- deterministic rules (sync, imports, reminders) on the app side, kept separate
  from agent judgement;
- a same-origin proxy with an owner check and a vendored SDK tarball.

Everything the SDK does not provide for this pattern was rebuilt in each app (see
themes C, D, K and the synthesis).

## 3. Findings

### A. Deployment topology

#### A1. Hosted app + runtime on the user's own machine has no supported path — Medium (root cause)

- **Evidence:** Confirmed. `docs/AGENT-INTEGRATION.md` (supported list) says
  "A cloud-only app without access to an owner-managed Augmentor host is not this
  topology", and stops there. Reported by the owner: a hosted app (web host, with
  each user's Augmentor on their own computer) had no supported way to connect, so
  its build went around the SDK.
- **What went wrong as a result (reported):**
  - the app's status check probed the hosting server's own loopback, not the user's machine;
  - a copied SDK browser file was edited to add `prompt()` and `onChange`;
  - a second agent loop was written inside a copied panel entry file, driving the
    panel by filling `#input` and clicking `#send`, `#stop`, `#newchat`;
  - custom approval cards were built because the panel only has Codex approvals
    (via `window.confirm`);
  - all of it would be overwritten by the next SDK or Augmentor update.
- **Why the SDK can't simply allow it:** the trust model changes in both directions.
  - *App → runtime (panel):* a hosted page cannot reach the user's `127.0.0.1`
    through the app server, and the server-held bearer token no longer exists.
    Browsers also restrict public sites from calling loopback/private addresses.
  - *Runtime → app (tools):* already possible, since `createToolClient` accepts
    HTTPS. But each user's runtime then needs its own credential for the app's tool
    endpoint; a browser session cookie is not an agent credential.
  - "Single owner" becomes "many users, each the owner of their own runtime, all
    trusting one hosted app". That is close to, but not the same as, the excluded
    multi-tenant case.
- **Candidate solutions:**
  1. *Document first (cheap, now):* state what to do instead (nothing supported yet)
     and list the anti-patterns: in-page fake hosts, forked panel copies, scripting
     the panel's DOM, a second agent loop.
  2. *Local pairing:* the user's Augmentor approves a specific hosted origin and
     issues an origin-bound token; the page talks to the local embed server
     directly. Needs a pairing UI in Augmentor, CORS/private-network handling, and
     a browser-side reachability check.
  3. *Relay:* the local runtime dials out to the hosted app (or a relay) and the
     panel is served back through it. Avoids loopback restrictions; adds
     infrastructure and a new trust party.
  4. *Per-user tool credentials:* whichever of 2 or 3, tool calls carry a
     runtime-issued, per-user token that the app verifies, never the page cookie.
- **Open questions:** Q1, Q2, Q3.

#### A2. Split-host topology works only through hand-built plumbing — Medium

- **Evidence:** Confirmed in sponsor-desk. The app server runs on a NAS and
  Augmentor on the owner's PC.
  - The browser reaches the NAS through a forward SSH tunnel; the proxy reaches the
    PC's embed server through a reverse SSH Unix-socket tunnel, using the SDK proxy's
    `socketPath` option.
  - The tools module runs inside DSH on the PC, so the app needs a second checkout
    on the agent host with its own config and token file, calling the NAS back
    through the tunnel.
  - `AugmentorClient` spawns a local native host, so the NAS-side server cannot run
    background agent jobs.
- **Impact:** the SDK's pieces allow it, but nothing describes or packages it; each
  integrator has to design the tunnels, tool-module placement and token handling.
- **Candidate solutions:** document split-host as a supported topology with a
  recipe; let a tool module be installed on the agent host from the app's manifest
  without a full app checkout; consider a remote client transport (see K1).

#### A3. Three apps, three topologies — synthesis

Same host (YouTube), split host on a private network (Sponsor), hosted app with a
runtime per user (tutoring app). The SDK documents only the first and partly
supports the second. Any "low friction for third parties" goal has to state which
of these are supported, and give each a recipe.

### B. SDK correctness (this repository)

#### B1. Nested `required` is lost or breaks registration — Medium

- **Evidence:** Reproduced. `jsonSchema()` in `src/tools.mjs` strips `required`
  from every property and rebuilds it only at the top level.
  - JSON Schema style (`items: {type:'object', properties:{…}, required:['front','back']}`):
    the list is silently dropped, so `cards: [{}]` passes validation and the tool runs.
  - SDK style (`required: true` on nested properties): AJV refuses to compile, so
    `createApplicationTools` throws at registration.
- **Impact:** a nested object cannot express required fields at all. Apps write
  their own converters (the reported app has a hand-written `toSdkParameters`).
- **Candidate solutions:** recurse through `properties` and `items`, honouring both
  styles; add `additionalProperties:false` consistently for nested objects; tests
  for both styles. Check the DSH `defineTool` descriptor format before also
  accepting plain JSON Schema (see D2).

#### B2. `OperationStore` receipt stuck at `unknown` when an action returns `undefined` — Medium

- **Evidence:** Reported by analysis agent (reproduced there). `src/operations.mjs`
  binds the result to SQLite; `undefined` throws after the side effect has run.
  `JobStore.enqueue(key, undefined)` fails the same way.
- **Impact:** a write that returns nothing is recorded as permanently unknown and
  the caller gets a raw `TypeError`.
- **Candidate solution:** normalise `undefined` to `null` (or reject before running
  the action) and test it.

#### B3. Native frame containing JSON `null` crashes the host app — Low/Medium

- **Evidence:** Reported by analysis agent (reproduced there). `src/client.mjs`
  reads `message.id` from a parsed frame without checking it is an object.
- **Candidate solution:** treat a non-object frame as a protocol failure (`fail()`).

#### B4. Error classification inconsistencies — Low

Reported by analysis agent:
- `call()`/`prompt()` throw synchronously for oversized requests or backpressure but
  reject for `NOT_CONNECTED`.
- `tools.mjs`: a missing token file is reported as `UNKNOWN_OUTCOME` although
  nothing was sent; a non-JSON error reply loses its status; a 204 becomes
  `UNKNOWN_OUTCOME`.
- `proxy.mjs`: an `authorize` callback that throws yields 503 "reconnecting"
  instead of 403.
- `manifest.mjs`: an invalid origin throws a raw `TypeError`; a tool ID of
  `constructor` resolves to `Object` and is silently dropped.

#### B5. Proxy forwards `..` path segments upstream — Low (defence-in-depth)

- **Evidence:** Confirmed in both repos. `src/proxy.mjs` appends the raw suffix to
  `/embed/<profile>/`. The product's `apps/browser/embed/server.mjs` normalises
  with `new URL()` and checks each profile's own token, so this is not exploitable
  against the current product.
- **Candidate solution:** normalise and reject `..`/encoded dots in the SDK proxy so
  it does not rely on the upstream.

#### B6. The app's whole environment is passed to the native host — Low

- **Evidence:** Reported by analysis agent. `client.mjs` and `runtime.mjs` spawn
  with the app's `process.env`, including its secrets. Not documented in
  `SECURITY.md`.
- **Candidate solution:** pass an allowlist, or document it explicitly.

#### B7. Smaller gaps — Low

Reported by analysis agent:
- `dsh.mjs` resolves `@deepseek-ai/dsh-tools` from `process.argv[1]`, which fails
  under `node -e` or a REPL.
- A refresh that fails a capability check still leaves `prompt()` usable;
  `RUNTIME-ALIGNMENT.md` only promises reads and cancellation.
- `JobStore` has no list/query method, so after a restart an app cannot find
  interrupted jobs without raw SQL.
- The 15 s proxy socket idle timeout also applies to streaming responses.
- Only a `typeof` check tests `mountAugmentor`.

#### B8. The starter template's tool is rejected by real DSH — Medium/High

- **Evidence:** Reproduced against the real DSH 0.1.5-rc.1 schema compiler (dsh-tools
  `lib/types/schema.js`): `registerDshTools` passes the app's parameters unchanged to
  `defineTool`, whose descriptor DSL accepts only `description`, `title`, `default` and
  `examples` as annotations. The template declares `minLength`/`maxLength`, so DSH
  refuses with "parameters.id.minLength is not supported by the value schema DSL". The
  SDK's tests use a fake `defineTool`, which hid it.
- **Impact:** an integrator following the template gets a tool plugin that fails to
  load in the real runtime.
- **Candidate solution:** compile JSON Schema to the DSH descriptor DSL (constraints the
  DSL cannot express are enforced by the SDK's AJV validation and described in text),
  and test against the real compiler.

### C. Browser embedding API (`@augmentor/app-sdk/browser`)

Today `mountAugmentor` (`src/browser.mjs`) offers `setContext`, `destroy`, and the
callbacks `onStatus`, `onNavigate`, `onSettings` and `onHide`. Confirmed.

Most items below need the maintained panel in `augmentor-agent`
(`apps/browser/embed/entry.mjs`) to handle a new message, so each is a **paired
change** in both repositories. A panel-handled `prompt` is not a second agent
loop: the panel still owns the loop.

| ID | Gap (reported by owner, confirmed absent in code) | Candidate solution |
| --- | --- | --- |
| C1 | No way to send a prompt from the host page | `prompt(text, {send, fresh, context})` message handled by the panel. Context travels in the same message, removing the ordering race the reported app worked around with a 4-second wait. |
| C2 | No event when an approved write finishes | Panel emits `augmentor-write-completed` (tool name, operation ID, outcome) so the host refreshes its data. |
| C3 | iframe `allow` (microphone, clipboard) can only be set after mount | `allow` option applied before `src` is set. |
| C4 | No help fitting context under 16 KB | `setContext` already throws `INVALID_CONTEXT` on the host; add a size helper and a panel-side rejection notice. |
| C5 | `onHide` meaning undocumented | Document it (panel asked to be hidden) in `docs/API.md`. |
| C6 | No TypeScript types; no framework helper | Ship `.d.ts`; optional React hook later. |
| C7 | No theming or branding | Pass host colour tokens and a display name; the panel is currently a fixed dark theme and shows the raw model label. |
| C8 | Approvals only exist for Codex, via `window.confirm` | Panel renders approval cards for every engine (see D1). |
| C9 | Both live apps built their own Settings dialog around `onSettings`, and one hard-codes the panel's internal `settings.html#appearance` URL (confirmed) | A `mountSettings()` helper or documented settings entry points. |
| C10 | `onStatus` gives only online/busy; one app keeps its own agent heartbeat records for its dashboard (confirmed) | Richer status (current session, turn state, last error) through the same channel. |

Evidence from the live apps on C1 and C8:

- Neither live app hit C8: both keep irreversible actions out of the tool set, so
  no in-panel approval is needed. That pattern should be documented as the first
  recommendation; panel approvals are for apps that genuinely need the agent to
  perform an irreversible step.
- Sponsor desk confirms C1: its "Work on this / Ask Augmentor" buttons can only set
  context and open the panel. YouTube does not need C1 in the panel; it sends
  prompts headlessly from the server (see K1). Both forms of "host sends a prompt"
  are needed.

### D. Tool contract: one source of truth

#### D1. Tool definitions are duplicated and approval is not declared — Medium

- **Evidence:** Reported. In the hosted app the write-tool list appears 4 times, the
  schemas twice, the role 3 times with different rules, and voice is enabled in one
  place and disabled in another. The SDK has no read/write or approval flag in the
  manifest.
- **Impact:** drift between definitions, and approval enforced (or not) only by
  whichever copy the browser uses.
- **Candidate solution:** declare each tool once in the manifest with
  `effect: read|write` and `approval: required|none`. The panel renders approvals
  for every engine, and the server-side tool helper refuses a write without a
  recorded approval. This also makes the safe path the default for new apps.

#### D2. JSON Schema vs DSH descriptors — open

- **Evidence:** Confirmed. `registerDshTools` passes the app's `parameters`
  unchanged to DSH's `defineTool`, while SDK validation converts them for AJV.
- **Open question:** what descriptor format `defineTool` accepts on 0.1.5-rc.1 and
  on 0.2.0-rc.2. Accepting plain JSON Schema means converting for DSH too, not
  just AJV.

#### D3. Rich arguments fall back to untyped `json`, and models get them wrong — Medium

- **Evidence:** Confirmed in both live apps. `jsonSchema()` maps `type:'json'` to
  `{}` (no constraints). Sponsor desk passes whole commands, drafts and pricing
  inputs as `json`; YouTube passes whole records and reviews as `json`. The real
  shapes live only in prose (a help tool returning a contract document, role files)
  and in server-side validation.
- **Impact:** reported in YouTube's own handoff and validation docs: the model sent
  objects where arrays were expected and background jobs could not finish. This is
  the practical cost of B1.
- **Candidate solutions:** fix B1; support nested objects, arrays and unions
  (`oneOf` for command types) end to end, including the DSH descriptor (D2); give
  the model the schema, not prose.

#### D4. Tool rules repeated in prose across many files — Medium

- **Evidence:** Confirmed. Sponsor desk: tool names in at least 4 code places and
  usage in 3 prose files. YouTube: each tool defined in 3 places (manifest names,
  schema module, server dispatch), with rules repeated in role, skill, contract and
  job prompts (for example "agents never post" about six times). Reported app: four
  copies of the write-tool list, three different role texts.
- **Candidate solution:** one tool declaration (D1) that carries the description,
  effect, approval and usage notes, from which the manifest names, the server
  dispatch table and the help text are generated or checked.

#### D5. No server-side tool endpoint helper; `operationId` unused — Medium

- **Evidence:** Confirmed in both live apps.
  - Neither uses the SDK's `createToolClient` envelope consistently: sponsor desk
    calls its endpoint with its own fetch (no `operationId`, plain `Error` on
    failure); YouTube's endpoint returns `{error}` without a `code`, so domain
    conflicts arrive as a generic application error.
  - Both implement idempotency with a **model-supplied** `eventId` plus record
    versions. A model-supplied key cannot be told apart from a blind retry; the
    SDK's derived `operationId` (session + call + tool) is ignored.
  - YouTube validates tool arguments only inside DSH; its CLI and second write
    path skip that validation.
- **Candidate solutions:** an endpoint-side helper (Node and fetch-style, see G1)
  that verifies the token and Origin, validates arguments with the same schema,
  exposes `operationId` and returns the error envelope; document how `operationId`
  and app record versions work together.

#### D6. No async or long-running tool pattern — Low/Medium

- **Evidence:** Confirmed in sponsor desk: mail sync uses a bounded 12 s wait plus a
  `requestId` the agent must pass back to continue.
- **Candidate solution:** a documented "started / poll with ID / finished" tool
  pattern, ideally with progress shown in the panel.

#### D7. No file transfer in or out of tools — Low/Medium

- **Evidence:** Confirmed in sponsor desk: its instructions send the agent to a
  shell CLI for binary documents and uploads, but SDK workspace grants have no shell.
- **Candidate solution:** a bounded attachment reference type that tools can accept
  and return.

#### D8. Owner instructions cannot be cited verifiably — Low/Medium

- **Evidence:** Confirmed in sponsor desk. Its older integration recorded write
  evidence as a reference to the owner's chat message and checked it against its
  own chat store. In native mode no verifiable message reference reaches the tool,
  so policy changes rely on a note the agent writes itself.
- **Candidate solution:** pass a verifiable reference to the triggering owner
  message (session, turn, digest) in the tool execution context.

### E. Cross-repository alignment

#### E1. Voice cannot work for a DSH-based SDK app — Medium

- **Evidence:** Confirmed in `resonant-voice` `main` and in the shipped 0.1.19
  archive. The voice ticket route only accepts the two built-in presets
  (`augmentor-linux-product`, `augmentor-browser-product`). Augmentor's
  `apps/browser/pipe.mjs` maps any other session to the browser surface, so an SDK
  workspace session (`augmentor-<id>`) is refused with "Conversation belongs to
  another role". Meanwhile `services/workspaces/profiles.mjs` treats workspace
  sessions as product-owned, and the SDK manifest offers a per-workspace voice switch.
- **Candidate solution:** merge the workspace-profile authorisation from
  `resonant-voice` PR #1 (or equivalent), pass the workspace preset list in its
  Cordis config, then ship a new voice archive with the agent.

#### E2. Resonant Voice ships from an unmerged branch; four branches diverge — Medium

- **Evidence:** Confirmed. `main` is 0.1.16; four PRs are open (0.1.17, 0.1.17,
  0.1.19, 0.1.20). Augmentor ships `7d0fd6d`, the parent of the head of draft PR #2.
  Each branch bumps the version, so merges will conflict.
- **Candidate solution:** pick a merge order, land everything on `main`, and only
  ship archives built from `main` tags.

#### E3. Two DSH targets in flight; SDK qualified on one — Medium

- **Evidence:** Confirmed. The complete install pins DSH 0.1.5-rc.1 with plugins
  1.1.2 / 0.2.3 / 0.1.19. `augmentor-agent/docs/DSH-0.2-COMPATIBILITY.md` qualifies
  0.2.0-rc.2 with Model Picker 1.1.3, Adaptive Reasoning 0.2.4 and Voice 0.1.20,
  whose archives are not in `release/dsh/plugins`. DSH 0.2 changes the tool-result
  shape and producer attribution. The SDK's `src/dsh.mjs` and
  `scripts/proof-dsh.mjs` are only qualified on 0.1.5-rc.1.
- **Candidate solution:** run the SDK's DSH proof against 0.2.0-rc.2 and record
  the result before any SDK DSH change.

#### E4. SDK's paired product revision is behind product `main` — Low

- **Evidence:** Confirmed. CI pins product `8a085be`, which is code-equivalent to
  the documented merge `602669a`. Product `main` is 34 commits ahead, including
  Codex/Linux deployment fixes and the DSH 0.2 browser-plugin lock change.
- **Candidate solution:** re-pair after the next product change that touches
  `services/workspaces`, `apps/browser` or `packages/codex-runtime`.

#### E5. Workspace preferences bypass policy limits — Low/Medium (design question)

- **Evidence:** Reported by analysis agent; voice part confirmed.
  - `services/workspaces/policy.mjs` `voiceEnabled` lets the stored preference
    override `policy.voice`, so the manifest's voice setting is a default, not a ceiling.
  - `context:<sessionId>` preferences written through the embed endpoint reach the
    model without the SDK's 16 KB / depth checks (only a 1 MB total limit).
- **Note:** only the owner (through the authenticated proxy) can write these.
- **Open question:** Q4.

#### E6. One bad workspace profile can stop the personal agent loading — Medium

- **Evidence:** Reported by analysis agent. `adapters/dsh-memory/automatic.mjs` and
  `adapters/dsh-product/index.mjs` read all profiles at load; `profiles()` throws on a
  corrupt index or an invalid profile (for example a Codex profile on Windows).
  Profiles are also re-read on every event, and new SDK profiles need a DSH
  restart to be recognised.
- **Candidate solution:** skip and report invalid profiles instead of throwing;
  cache with invalidation.

#### E7. Context budgeting does not cover SDK workspaces — Low

- **Evidence:** Confirmed. `adapters/dsh-context-budget/index.mjs` owns only the two
  personal presets, unlike execution and memory which use `ownsProductSession`.

#### E8. Codex capability contract is stale — Low

- **Evidence:** Reported by analysis agent. `packages/contracts` says Codex has no
  branch/edit; `codex-bridge.mjs` and `adapters/codex.py` report both as available,
  and the stale value is sent on `harness.select`.

#### E9. Legacy browser native-host path skips the workspace guard — Low

- **Evidence:** Reported by analysis agent. `apps/browser/install-native-host.sh`
  registers an old host name pointing at `pipe.mjs` without the unified boundary;
  `pack-release.sh` builds a bundle that cannot run.

#### E10. DSH caches tool modules; updates need undocumented workarounds — Medium

- **Evidence:** Confirmed in both live apps. Each imports the SDK with a
  `?release=<version>` query so a running DSH loads the corrected module. The
  product installer hashes only the top-level tool module, not its dependency
  graph, and new grants only apply in a new chat.
- **Impact:** a tool fix can silently not take effect until DSH restarts.
- **Candidate solutions:** have the installer fingerprint the module's whole
  dependency graph and report "restart needed"; document the behaviour.

#### E11. Apps read undocumented product internals — Medium

- **Evidence:** Confirmed in YouTube's job runner (`server/jobs.mjs`):
  - it copies the panel's model choice from the product's private workspace
    `preferences.json`, at a hard-coded `~/.local/state` path that ignores
    `XDG_STATE_HOME`;
  - it hard-codes the profile/token directory and the runtime descriptor location;
  - it checks the SDK client's private `.child` field to know whether it is connected.
- **Impact:** any product or SDK refactor of those layouts breaks a live app
  without warning.
- **Candidate solutions:** public APIs for each (K1): inherit the workspace's model
  selection, a documented runtime/profile discovery call, and `client.connected`.

### F. Documentation and release hygiene

| ID | Finding | Evidence | Candidate fix |
| --- | --- | --- | --- |
| F1 | QUICKSTART and TROUBLESHOOTING say a no-bundler app can serve only `src/browser.mjs`; since `9a06429` it imports `context.mjs` → `errors.mjs` | Confirmed | Serve the three files, or bundle `browser.mjs` into one file. |
| F2 | `docs/QUALIFICATION.md` (shipped in the package) contains machine and backup paths, which `AGENTS.md` forbids | Confirmed | Replace with neutral descriptions. |
| F3 | Preview 3/4 and Codex status contradict each other across docs (for example `READINESS.md` says Pi and Codex are deferred) | Reported, partly confirmed | One status table, linked from every guide. |
| F4 | `API.md` omits `connection` from `workspaceProfile`; `QUICKSTART.md` omits `runtimeRoot` and `connection` | Reported | Update the reference. |
| F5 | The packed `AGENTS.md` tells readers to run scripts that are not shipped | Reported | Separate consumer and maintainer instructions. |
| F6 | Not documented that the manifest tool ID, module `name` and `toolConfig` key must match | Reported by owner | Document, and have `validate` check it. |
| F7 | No guidance for rejecting a half-manifest, half-profile `profile.json` | Reported by owner | `validate` error with a pointer to the right file. |
| F8 | `RUNTIME-ALIGNMENT.md` links the product's feature branch after its merge | Reported | Link the merge commit. |
| F9 | `augmentor-agent` docs are stale in several places (README 0.2.12 and Mac preview 2, FEATURE-MATRIX "0.2.9", DSH-SETUP mentions retired OpenCode, broken relative links) | Reported by analysis agent | Product-side cleanup. |

**F1 is an upgrade blocker for both live apps (Medium).** Confirmed: both serve
`@augmentor/app-sdk/browser` as a single file at `/augmentor-sdk.mjs`. Preview 2's
`browser.mjs` has no imports, so this works today. From preview 3 it imports
`./context.mjs`, so the same route would break the panel mount on upgrade. Any
upgrade note for existing apps must cover this, and the SDK should ship a
self-contained browser bundle.

#### F10. Registration bypasses the SDK; no profile adoption or migration — Medium

- **Evidence:** Confirmed in both live apps. Neither uses `augmentor-app register`.
  Both call `workspaceProfile()` and then run the product's
  `install-workspace-profile.mjs` directly, so they can carry over an existing
  preset, memory binding, token and legacy presets. Sponsor desk also passes an
  undocumented `retiredPluginIds`.
- **Impact:** the documented registration path does not serve the real case
  (moving an existing integration onto the SDK without losing sessions, memory
  and model settings).
- **Candidate solution:** a supported `register --adopt` (or `migrate`) that keeps
  the existing preset, memory and session bindings, and documents each option.

#### F11. `permissions.tools` is easy to misread; both apps grant the same set — Low

- **Evidence:** Confirmed. `permissions.tools` lists *product* tools the workspace
  may use (`QUICKSTART.md`), not the app's own tools. During this analysis it was
  first misread as a subset of the app's tools. Both live apps grant the identical
  nine: memory recall/source, web search/fetch, ask-user and four browser
  observation/navigation tools.
- **Candidate solutions:** rename or document prominently (for example
  `productTools`), and offer named grant sets ("research", "browser-observe").

#### F12. Instructions can ask for tools the grants deny; nothing checks it — Low/Medium

- **Evidence:** Confirmed in sponsor desk: instructions point the agent to a shell
  CLI and heartbeat behaviour not available to the workspace; two instruction files
  give contradicting link formats; AGENTS.md and the native instructions disagree on
  heartbeat.
- **Candidate solution:** `validate` warns when instruction files reference tool
  names that are neither declared nor granted.

#### F13. Links in agent output depend on the host's absolute origin — Low

- **Evidence:** Confirmed in sponsor desk: prompts carry absolute loopback-origin
  links so the panel can turn them into `augmentor-link` navigation.
- **Candidate solution:** an origin-independent link scheme (for example
  `app:#/deals/123`) resolved by the panel against the parent origin.

### G. Server frameworks and copied files

#### G1. Only Node `req/res` servers are supported — Low/Medium

- **Evidence:** Reported by owner; the templates use Node `http` only.
- **Candidate solution:** fetch-style helpers (proxy handler, tool endpoint with
  AJV, token and Origin checks) usable from Next.js route handlers, plus a note
  that WebSocket upgrades do not work there.

#### G2. Copied SDK/panel files drift silently — Low

- **Evidence:** Reported by owner.
- **Candidate solution:** a `vendor` command that stamps copies with version and
  hash, and a `doctor` check that flags stale or modified copies.
- **Live-app evidence:** sponsor desk still carries inactive rollback material from
  before the SDK: a full copy of an Augmentor 0.2.11 release with four patches, a
  copied panel, and an older app-side agent loop. Its server falls back to the old
  HTTP bridge when the socket setting is missing. YouTube vendors only the SDK
  tarball and has no copied files. Both keep the obsolete preview 1 tarball.

#### G3. No test harness with a mock model — Low

- **Candidate solution:** a documented harness that drives tools and approvals
  deterministically, as the product's DSH proofs already do.

#### E12. Runtime limits that affect headless use — Medium

- **Evidence:** Reported by the product analysis (product `9fa2317`), partly confirmed:
  - a native connection follows at most two sessions for events; older follows drop;
  - every `session.prompt` claims a 15 s interaction lease; while the embedded panel holds
    a session's lease, a server-side prompt to the same session fails with "Another
    Augmentor window owns these interactions";
  - a headless client that ignores `approval.requested` / `question.requested` leaves the
    turn waiting until it is aborted.
- **Candidate solutions:** SDK runners use their own sessions, answer or reject
  interactions by policy, and fall back to `session.history` headers; product-side:
  more follows and a lease-sharing rule (PANEL-PROTOCOL).

#### E13. App repository instructions and user skills leak into workspace sessions — Medium

- **Evidence:** Reported by the product analysis: DSH resolves the project root from the
  workspace `cwd` (nearest `.git`), so the app repository's developer `AGENTS.md` and the
  user's `~/.agents/skills` become visible to end-user workspace sessions.
- **Candidate solution:** a product option to exclude skill roots and agent instruction
  files for workspace presets; meanwhile, keep developer-only instructions out of the
  app's runtime root.

### K. Server-side agent work (background jobs)

#### K1. Background jobs need a supported runner; one app built its own — Medium

- **Evidence:** Confirmed in YouTube (`server/jobs.mjs`). Its main use of the agent
  is background work: a daily 07:30 research job plus on-demand research, package,
  article, review and reply jobs, each in its own headless DSH session. To do this
  it built:
  - a scheduler with daylight-saving handling and catch-up, leases, an
    `interrupted` state, cancel plus confirm-stopped, and output validation;
  - direct calls to `session.create`, `session.rename`, `session.selectModel`,
    `session.prompt` and `session.cancel` instead of `prompt()`;
  - turn completion detected by polling `session.list` every 10 s, treating three
    idle checks as finished, with a 25-minute cap;
  - a lookup that fails when an older session falls outside the bounded
    `session.list` ("outcome unknown");
  - model selection copied from the product's private files (E11).
  Sponsor desk proposes a scheduled "daily judgement" agent job but has not built
  it; its deterministic jobs run on `setInterval`. The SDK's `JobStore` is used by
  neither app.
- **Missing public pieces:**
  - an awaitable turn result or a "turn finished" event;
  - session lookup by ID (not a bounded list scan);
  - inheriting the workspace's model selection for job sessions;
  - a public connection state on the client;
  - a remote transport so a server not on the agent host can run jobs (A2).
- **Candidate solution:** a job runner built on `JobStore` and `AugmentorClient`:
  schedule, lease, start a headless session with the workspace model, await the
  turn, cancel and confirm stopped, validate outputs, record the outcome.

#### K2. Agent writes are invisible to the app's UI until it polls — Low/Medium

- **Evidence:** Confirmed in both live apps: sponsor desk polls its workspace every
  10 s and mailbox every 30 s; YouTube polls every 8 s and 5 s, and its tray has its
  own loop. This is C2 seen from the app side.
- **Candidate solution:** C2's write-completed event in the panel, plus a
  server-side hook or event for writes made by background sessions.

### L. Hosted multi-user apps (from the tutoring app analysis)

Analysed at the owner's request (main `b10272d`, integration branch `3951d1a`). It
corrects A1's report: there is no second loop beside the runtime; on both branches an
in-page fake `augmentor/1` host replaces the runtime and uses the app's cloud model, and
the DSH tool path is unused configuration. New requirements:

| ID | Requirement |
| --- | --- |
| L1 | A supported cloud or bring-your-own-model backend using the same tool declarations, as fallback when no local runtime exists |
| L2 | Browser-side detection of the user's runtime and a status API (a server probe is meaningless when hosted) |
| L3 | Prompt templates with typed slots, send or prefill, fresh, and a policy for a running turn |
| L4 | Modes or personas as a first-class instruction overlay |
| L5 | App-declared approval presenters (summary template, action label, partial accept, edit) |
| L6 | Generative UI primitives: question/choice, graded quiz item, selectable card list, plan with toggles |
| L7 | Account-bound sessions, memory and learner profile |
| L8 | Record versions for agent appends to user-edited text |
| L9 | Identity and entitlement bridging between per-user runtime credentials and app accounts |
| L10 | Configurable loop limits (steps, result size, history window) |
| L11 | Provenance marking for tool results that carry untrusted content |
| L12 | Host commands to open, focus and collapse the panel |
| L13 | Routing app-side model jobs to the cloud model or the user's runtime |

Security issues on that branch are tracked with the owner by title only (see I).

### H. Licensing

- **H1 (Medium):** `resonant-voice` declares `"license": "MIT"` in `package.json` but
  ships Breeze voice files whose terms are research/non-commercial. The SDK's
  licence permits commercial use, so an app that turns voice on inherits a
  conflict unless the voice terms are surfaced. Confirmed.
- **H2 (Low):** two files in `augmentor-agent` carry plain `SPDX: MIT` headers while
  the rest of the repository uses the Augmentor resale licence. Reported.

### I. Private repositories and apps (titles only)

Details are kept out of this public repository.

- `dsh-privacy-guard`: a High-severity sandbox boundary issue and a Medium local
  dashboard authentication issue were confirmed. Owner informed in session.
- The hosted reference app: app-side security issues in its unmerged integration
  branch were reported by the owner's session (tool endpoint authentication and
  approval enforcement, and a development auth bypass). They must be fixed before
  it ships, independently of SDK changes. D1 and A1 candidate 4 are the SDK
  changes that would make the safe pattern the default.
- `youtube-dashboard`: the proxy's owner check relies on the request coming from
  loopback (no owner session); a second write path skips the tool schema and
  per-job limits; personal paths and identifiers are committed in docs and config.
- `sponsor-desk`: one shared bearer token serves both the native tools and the full
  CLI; the tool endpoint only checks the session ID's format.
- SDK-side relevance: the template's owner-authorisation example should show a
  real owner session, and D5's endpoint helper would remove the second-path gap.

### J. Development workflow friction (reported by owner)

- Cloud sessions could not reach local files or apps on `127.0.0.1`.
- Remote Control setup failed on an unpushed branch and on login.
- Starting a "new session" silently started another cloud session.
- Results had to be copied by hand between cloud and local sessions, and the app's
  hosting copy differs from its GitHub "sanitised export", with handover done by
  pasted prompts.

These are not SDK defects, but they shaped how the integration was built and
should be considered when choosing a supported topology (A1).

## 4. Synthesis: root causes

1. **The supported topology is narrower than real apps.** Three apps used three
   topologies (A3). A1 drove most workarounds in the reported app; A2 needed
   hand-built tunnels.
2. **The SDK covers the panel, not the server side of agent work.** The live apps'
   heaviest custom code is server-side: a background job runner (K1), tool
   endpoints with their own envelope and idempotency (D5), registration and
   migration (F10), and reading product internals (E11).
3. **The browser API is hosting-only.** Anything interactive (C1–C10) has to be
   built around the panel instead of through it, and app UIs poll for changes (K2).
4. **Tools are under-specified.** Without nested schemas (B1, D3) and one
   declaration carrying effect, approval and usage (D1, D4), shapes move into prose
   and models get them wrong.
5. **Cross-repo versions move independently.** Voice branches, DSH 0.1/0.2, the
   SDK's paired revision and DSH module caching (E1–E4, E10) drift without one
   compatibility record.
6. **Validation gaps hide mistakes** (B1, F6, F7, F12) until runtime.

What already works and should be kept: the app-owned store with versions and
event IDs, thin tool endpoints with read-back, "agent drafts, owner commits",
bounded context hints, server-held secrets, and vendored tarballs.

## 4a. What a low-friction integrator would need

Drawn from the three apps. Each item names the findings it resolves.

| Need | Today | Findings |
| --- | --- | --- |
| A clear choice of supported topology, each with a recipe | Same-host only documented | A1, A2, A3 |
| One tool declaration: schema (nested, unions), effect, approval, usage notes | Names in manifest, schemas and rules elsewhere | B1, D1, D3, D4 |
| A tool endpoint helper (Node and fetch) with token/Origin checks, validation, `operationId`, error envelope | Each app hand-writes it | D5, G1 |
| A background job runner with turn completion, model inheritance and cancel/confirm | One app built its own on private internals | K1, E11 |
| Panel events and commands: prompt, write-completed, status, settings | Context and hide only | C1, C2, C9, C10, K2 |
| Registration that adopts and migrates an existing profile | Apps call the product installer directly | F10 |
| A self-contained browser bundle and an upgrade note for existing apps | Single-file serving breaks on preview 3+ | F1 |
| Clear grants with named sets | `permissions.tools` easy to misread | F11 |
| A test harness with a mock model and a manifest/tool check | Neither app tests its registration | G3, F6, F12 |

## 5. Candidate roadmap (not decided)

1. **SDK only, small:** B1 with tests; B2, B3; docs F1 (with a self-contained
   browser bundle), F2, F3, F6, F11; a short "unsupported topologies and what not
   to do" section (A1 candidate 1); document "agent drafts, owner commits" as the
   first approval pattern.
2. **SDK server side:** D5 endpoint helper (Node and fetch), D3 nested and union
   schemas end to end (needs D2 answered), K1 job runner on `JobStore` with the
   public client APIs it needs (some require product changes).
3. **Paired SDK + agent:** C1, C2/K2, C3, C5, C9, C10, and D1 (manifest flags, panel
   approvals for every engine, server enforcement).
4. **Cross-repo:** E1 and E2 (voice), E3 (SDK proof on DSH 0.2), E6, E10, F10
   (adopt/migrate registration).
5. **Design before code:** A1 local pairing or relay with per-user tool
   credentials; A2 split-host recipe and remote client transport.
6. **Later:** C6, C7, G2, G3, D6, D7, D8, F13.

Existing live apps are not changed by any of this. Moving them to a newer SDK is
a separate, owner-approved step that must preserve their data, session IDs,
drafts and model settings.

## 6. Open questions for the owner

- **Q1.** Is "hosted app + runtime on each user's machine" a topology the SDK should
  support, or should such apps be told to self-host next to the runtime?
- **Q2.** If supported: local pairing (direct browser connection) or a relay?
- **Q3.** Does "many users, each the owner of their own runtime" stay within the
  single-owner trust model, or does it need its own security section?
- **Q4.** Should a workspace's manifest voice and context limits be ceilings that
  owner preferences cannot exceed (E5)?
- **Q5.** Which DSH line is the target for the next SDK preview: 0.1.5-rc.1, 0.2.0-rc.2,
  or both?
- **Q6.** Should the SDK own a background job runner (K1), or only the public
  primitives (turn result, session lookup, model inheritance) apps build on?
- **Q7.** Is "agent drafts, owner commits" the recommended default, with panel
  approvals only for apps that need the agent to take irreversible steps?
- **Q8.** Should the split-host setup (A2) be a supported topology for third parties,
  or remain an owner-specific arrangement?
- **Q9.** When should the two live apps move off preview 2, given F1 and the
  data-preservation requirement?

## 7. Pending analysis inputs

Further material from the owner will be analysed and added here.

## Log

- **2026-10-07** — Initial analysis of the SDK, `augmentor-agent`, `resonant-voice` and
  seven DSH plugin repositories; owner's report from the hosted reference app
  added (themes A, C, D, F, G, J). Nested `required` (B1) reproduced. No code
  changed.
- **2026-10-07** — Analysed the two live reference apps (sponsor-desk, youtube-dashboard).
  Added use cases (2a), A2–A3, C9–C10, D3–D8, E10–E11, F10–F13, theme K, the
  integrator-needs table (4a), Q6–Q9, and private-app titles in I. Confirmed F1
  would break both apps' panel on an upgrade past preview 2. No code changed.
- **2026-10-07** — Deep analysis and research for SDK 0.2: added B8 (reproduced against the
  real DSH compiler), E12, E13 and theme L (tutoring app, analysed at the owner's
  request). See RESEARCH.md, CAPABILITIES.md and PLAN.md. Implementation follows on
  this branch.
