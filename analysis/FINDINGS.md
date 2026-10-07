<!-- Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0 -->
# Ecosystem analysis: findings, problems and candidate solutions

**Status: living analysis, started 2026-10-07. No code has been changed because of it yet.**

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
| A hosted reference app (owner report) | not inspected | Lessons reported by the owner from a separate build session; see theme A. |

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

#### G3. No test harness with a mock model — Low

- **Candidate solution:** a documented harness that drives tools and approvals
  deterministically, as the product's DSH proofs already do.

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

1. **The supported topology is narrower than real apps.** A1 drove most
   workarounds (forked files, a second loop, DOM scripting, custom approvals).
2. **The browser API is hosting-only.** Anything interactive (C1–C8) has to be
   built around the panel instead of through it.
3. **No single tool declaration.** Without read/write and approval in the
   manifest (D1), every app re-declares tools and decides enforcement itself.
4. **Cross-repo versions move independently.** Voice branches, DSH 0.1/0.2 and the
   SDK's paired revision (E1–E4) drift without one compatibility record.
5. **Validation gaps hide mistakes** (B1, F6, F7) until runtime.

## 5. Candidate roadmap (not decided)

1. **SDK only, small:** B1 with tests; B2, B3; docs F1, F2, F3, F6 and a short
   "unsupported topologies and what not to do" section (A1 candidate 1).
2. **Paired SDK + agent:** C1, C2, C3, C5, C8 and D1 (manifest flags, panel
   approvals for every engine, server enforcement).
3. **Cross-repo:** E1 and E2 (voice), E3 (SDK proof on DSH 0.2), E6.
4. **Design before code:** A1 local pairing or relay, with per-user tool
   credentials.
5. **Later:** C6, C7, G1, G2, G3.

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

## 7. Pending analysis inputs

Further material from the owner will be analysed and added here.

## Log

- **2026-10-07** — Initial analysis of the SDK, `augmentor-agent`, `resonant-voice` and
  seven DSH plugin repositories; owner's report from the hosted reference app
  added (themes A, C, D, F, G, J). Nested `required` (B1) reproduced. No code
  changed.
