<!-- Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0 -->
# Preview 4 source alignment

Preview 4 is an unreleased source candidate. Preview 3 remains the immutable
published onboarding package; YouTube and Sponsor desk retain their qualified
preview 2 deployment. This guide owns the candidate's added contracts and
qualification boundary. Neither cloning source nor installing its package
updates an existing Augmentor installation.

## Availability is a negotiated contract

Apps still use `augmentor-app/1`. `AugmentorClient` accepts `harness` (default
`dsh`), `requiredCapabilities` (default empty) and either `descriptor` or
`runtimeRoot`. It rejects unavailable adapters/features before initialization;
it never falls back from Codex to DSH. A legacy DSH runtime remains usable when
no new capabilities are required. Missing feature information is unknown.

`client.capabilities` and `refreshCapabilities()` return the product's workspace
snapshot. `capabilityState(description,name)` recognizes supported, disabled,
denied, unsupported and unknown. `requireCapabilities(description,names)` throws
`CAPABILITY_UNAVAILABLE` unless every required state is supported. A snapshot
is not permission enforcement: the product checks live grants at tool dispatch.
Refreshing/reconnecting never replays a prompt. A changed required capability
can prevent further successful `connect()` calls while cancellation and reads
remain available on an initialized client.

```js
const client = new AugmentorClient({
  profile: 'record-desk', harness: 'dsh',
  requiredCapabilities: ['tool-policy', 'scoped-sessions'],
});
await client.connect();
const state = capabilityState(client.capabilities, 'computer-use');
```

`readinessVerified:false` distinguishes API support from actual inference,
audio/OS consent or memory-engine availability. Apps must inspect operational
responses and complete their own acceptance. An image-capable model, explicit
tool grants and fresh OS consent are required for computer use. Handy inserts
system dictation into a focused app; it is separate from experimental Resonant
conversation voice. Dictation/setup/identity/shared memory configuration stays
in standalone Augmentor. The maintained embed handles local appearance,
Conversation/Thinking display, workspace voice opt-in, saved chats, read-only
memory context and prompt use. Appearance and the approved Open/Collapsed thinking
choice persist in the authenticated workspace store and profile-specific browser
caches, including apps on the same website origin. Colour resets preserve the
thinking choice. Standalone settings retain their separate development lifecycle.

## Explicit experimental Codex selection

Generate with `augmentor-app init . --id record-desk --harness codex`. Its private
installation example includes `connection`; replace that placeholder with an
existing owner-configured Codex connection ID. Do not reuse owner credentials
inside a manifest. Use `doctor --harness codex` and review `plan` before
registration. Older runtimes reject Codex before creating credentials.

Tool modules export `applicationTools(config)` for Codex, returning the adapter
created by `createApplicationTools` from `@augmentor/app-sdk/tools`. The shipped
scaffold exports both this function and DSH `apply`, from one definition/executor.
Existing `@augmentor/app-sdk/dsh` imports remain compatible.

`createApplicationTools({definitions,execute})` uses the existing tuples
`[name,description,parameters,outputSchema?]`. It exposes JSON-schema tool
metadata and validates arguments, owning session, declared names and output.
Execution receives `{sessionId,callId,signal}`; DSH's existing `{agent:{id},...}`
is also accepted. `createToolClient` accepts either shape and derives identical
durable operation IDs from session/native call ID/tool. It never retries a
backend request automatically. Application receipts/revisions remain mandatory
for writes and externally visible effects.

A response interrupted after HTTP headers arrive is also `UNKNOWN_OUTCOME`,
with the same operation ID attached. Callers reconcile the backend receipt;
neither a partial response nor cancellation proves that a write did not happen.

The paired product binds role/directory/connection/memory, filters histories and
checks ownership on session operations, including branch/attach/cancel. Existing
sessions retain their instruction/tool snapshot while live grant revocation is
checked at dispatch. Harness/connection/cwd/memory changes require explicit
migration; registration cannot silently repurpose a workspace. Native Codex
shell, file edits, web search, image generation and delegation are disabled in
app workers. The pinned engine still exposes core `request_user_input` as an
owner interaction. Installed JavaScript remains trusted OS code.

Codex is qualified with the actual 0.159.2 engine and synthetic provider replies.
This does not certify subscription eligibility, real-provider behavior, Windows
Codex, every model's tool support or installed product packaging.

## Selection context and recovery

`features['application-context']` reports the 16,000 UTF-8 byte limit and context
binding. The SDK's native prompt API and browser setter reject malformed,
oversized or more than 64-level nested JSON objects before sending. `{}` clears
selection. Product boundaries enforce the same bounds independently.

Codex binds the canonical selection snapshot to each durable operation. Queued
requests, steering, promotion and restart keep that original snapshot. The same
operation ID cannot change its text or context and is never resent automatically
after an unknown outcome. Selection reaches the pinned engine through bounded
untrusted fragments, separately from the user's prompt and the registered role.
A request-specific manifest supersedes older selection; omitted context becomes
`{}`. Historical fragments may remain visible; this does not erase history.
Older ledgers remain readable. Adding context to an already admitted older
operation is a conflict, not an implicit migration.

DSH retains its qualified latest-session selection with ten-minute expiry. Apps
needing exact queued targets must preserve them in their request/backend
operation and fetch current records/revisions through tools. Neither binding
lets selection alter tools or permissions. Codex branch-status requests include
the owning parent `sessionId` and intended child `newSessionId`; foreign parent,
workspace or child requests are refused before an absence claim.

## Platform setup

`runtimePaths()` describes platform defaults, respecting explicit XDG roots.
Linux reads the selected managed `desktop.json`. Mac uses Application Support;
Windows uses Local AppData defaults. New Mac/Windows installed artifacts need
the product's verified `app-sdk-runtime.py` bootstrap and `app-sdk-launch.py`
adapter; old public downloads do not gain these by installing the SDK alone.
An explicit `runtimeRoot` locates a nondefault installed bundle. The bootstrap
reads metadata only and returns an allowlisted product environment; it does
not start services or expose credentials. Windows identity/ACL verification
belongs to the product OS adapter, not environment strings or Unix chmod.

Product launch adapters preserve managed Node/Python and lifetime leases. Windows
uses a Job for owned bridge cleanup. Registration uses private protected tokens
and owner-only workspace directories. The product embedding installer supports
read-only `--plan` plus explicit Linux systemd/Mac launchd/Windows user Startup
registration. Windows Startup is login startup, without a service crash-restart
guarantee. Stop dependent app work/the owned embedding service before product
replacement; an app closing must not stop another app's shared service.

| Combination | Candidate scope | Customer installation evidence |
| --- | --- | --- |
| Linux / DSH | Existing protocol preserved, new feature snapshot | Earlier preview 2 qualification; no new live deployment |
| Linux / Codex | Experimental app adapter and actual engine fixture | Pending |
| macOS / DSH | Bootstrap/startup paths and common SDK contract | Pending |
| macOS / Codex | Experimental adapter and actual engine fixture | Pending |
| Windows / DSH | Bootstrap/private ACL/startup adapter | Pending |
| Windows / Codex | Explicitly unsupported | No adapter claimed |
| Pi / cloud voice | Outside this SDK extension | Not implemented |

## Qualification and compatibility maintenance

### Current functional pair — October 3

The source under qualification is SDK
[`925b72e`](https://github.com/ManoloRemiddi/augmentor-app-sdk/commit/925b72eeaa651fc254f46b30d3dbbcc7b596d3a8)
with product
[`8a085be`](https://github.com/ManoloRemiddi/augmentor-agent/commit/8a085be67f50d7b39e5639cdb1916e09517de805).
This pair includes the current public Handy corrections, workspace-local thinking
and appearance persistence, and direct registration identifier validation.
Later documentation-only commits do not change these tested source files.

| Gate for this exact pair | Current result |
| --- | --- |
| SDK source, packed consumer and paired runtime on Linux/macOS/Windows | All six jobs pass in [37116697011](https://github.com/ManoloRemiddi/augmentor-app-sdk/actions/runs/37116697011) |
| Product OS-private files, startup and workspace contracts | All three platforms pass in [37116596807](https://github.com/ManoloRemiddi/augmentor-agent/actions/runs/37116596807) |
| macOS 14/26 packaged runtime, including shipped SDK helpers | Pass in [37116596912](https://github.com/ManoloRemiddi/augmentor-agent/actions/runs/37116596912) |
| Windows x64/ARM64 desktop | Pass in [37116596991](https://github.com/ManoloRemiddi/augmentor-agent/actions/runs/37116596991) |
| Full Linux/source/native/installed-package/Browser regression | Still running in [37116596924](https://github.com/ManoloRemiddi/augmentor-agent/actions/runs/37116596924) |
| Windows x64/ARM64 packaged runtime and install/repair/removal | Still pending in [37116596824](https://github.com/ManoloRemiddi/augmentor-agent/actions/runs/37116596824) |

The paired engine proof uses the actual pinned Codex binary with synthetic
provider replies on Linux/macOS. Windows verifies supported DSH/platform
contracts and private files; it does not run or qualify Codex there. Four actual
isolated Chromium renders of product `8a085be` were inspected in light/dark
themes at 1100×760 and 400×780. Scoped navigation and the thinking selector fit
without visible errors. Synthetic workspace/runtime replies and disposable
browser profiles make this component presentation evidence, not an installed
customer app or real-provider check.

Published preview 3, both recorded preview 2 app deployments, and the owner's
independent third-app test are unchanged. No new package or product release,
merge, live app migration, login service or model configuration is claimed.
The customer installation column above and the release gates below remain open.

### Reproduction

From the SDK source checkout, run source/packed checks, then build the exact
paired public product source and:

```sh
npm run test:runtime -- /absolute/path/to/paired/augmentor-agent
```

This packs/installs the SDK into an isolated consumer and exercises its actual
client/tools through the product native host, private IPC and actual Codex
engine using synthetic records/Responses. It checks grants, schema validation,
foreign/shared denial, completed-operation no replay and durable reopening.
Windows runs the feature contract plus the separate product Python private-file
proof; it never substitutes a simulated Codex run for unsupported Windows IPC.
SDK CI tests Linux/macOS/Windows packages and pins the paired product source
[`8a085be`](https://github.com/ManoloRemiddi/augmentor-agent/commit/8a085be67f50d7b39e5639cdb1916e09517de805)
by immutable commit. Product platform CI independently verifies OS private files
and startup contracts. Pending hosted checks are not passing evidence.

### Earlier qualification checkpoints

The following dated evidence is historical. The current pair and result table
above supersede earlier running/pending statuses; earlier passes apply only to
their stated source, not subsequent functional changes.

The [six-job SDK matrix 37113782817](https://github.com/ManoloRemiddi/augmentor-app-sdk/actions/runs/37113782817)
passes on Linux, Mac and Windows at SDK `9a06429`, paired with product `6c3b1ca`.
The separate [product platform matrix 37113710249](https://github.com/ManoloRemiddi/augmentor-agent/actions/runs/37113710249)
passes all three platforms at `6c3b1ca`. These include the context/branch
follow-up. Final preflight additionally refuses connection IDs outside the
pinned Codex host's 128-character identifier pattern before registration;
fresh SDK checks qualify that subsequent source change independently.

Local source checks pass 29 SDK cases, the clean packed consumer and the paired
native proof. The proof uses `AUGMENTOR_PYTHON` when selected, otherwise resolves
the local Python interpreter. Windows qualification additionally requires the
product's pinned OS credential dependency. The first hosted candidate failed
Windows database cleanup because cleanup preceded closing its SQLite handles;
the corrected fixture closes handles before removal. Product-owned Mac path and
Windows quoting fixtures are corrected in the pinned follow-up above. Fresh
hosted results remain required; these corrections do not qualify an installed app.

Windows then passed all 28 SDK source cases and exposed a real packed adapter
issue: importing DSH's resolved drive-letter filename as an ESM URL failed.
The adapter now converts the resolved filename to a file URL on every platform;
the existing packed-consumer test exercises this exact import path. The paired
product also keeps embedded model connection administration in standalone
Augmentor, covered by its actual settings-entrypoint fixture.

The product bundle workflows additionally qualify shipped SDK helpers,
transactional registration, native description/denial and owned bridge exit
against packaged Mac/Windows binaries. These checks start no model or login
service and do not substitute for a complete installed app conversation.

[SDK matrix 37111618792](https://github.com/ManoloRemiddi/augmentor-app-sdk/actions/runs/37111618792)
passes all six source/packed/paired jobs on Linux, Mac and Windows at SDK
`d77405f`, paired with product `898d193`. The separate
[product matrix 37111509392](https://github.com/ManoloRemiddi/augmentor-agent/actions/runs/37111509392)
also passes all three platforms at `898d193`. The teardown follow-up closes resources before state deletion and always closes
the local provider server. The current pin additionally binds Codex selection
to durable operations and scopes branch-status recovery to its parent. An earlier Mac engine case failed and retained a server
until its job deadline; the later passing run does not establish that failure's
cause. Fresh pinned checks and packaged native proof results remain required.

Maintain the same contract in both repositories. New shared settings, harness,
platform bootstrap, IPC, tool policy or lifecycle behavior needs a paired impact
assessment and qualification. Product version numbers alone do not establish
compatibility. Preserve released archives and deployed app provenance. The
owner's independent third app remains untouched; these fixtures are not that
adoption test. Physical dictation/voice, OS permission dialogs, installed service
and update/rollback acceptance remain separate gates.

The selection follow-up passes 29 local SDK source cases, the clean packed
consumer and 27 paired product cases. These verify immutable queued context,
steering/promotion, unknown-outcome no replay, UTF-8 bounds, actual untrusted
provider input and parent-scoped branch status. The client also rejects invalid
Codex IDs before dispatch. The connection-ID preflight follow-up passes all six
jobs at SDK `b91b908`, paired with product `6c3b1ca`, in
[37114441418](https://github.com/ManoloRemiddi/augmentor-app-sdk/actions/runs/37114441418).
The newer product pin combines current public Handy fixes with scoped
thinking/appearance persistence and direct-registration connection-ID validation.
The product refuses incompatible IDs before creating registry locks, backups or
profiles, even if registration bypasses the SDK CLI. Its local
88 Browser cases and 11 workspace contracts pass. Fresh paired/package checks
qualify that newer pin independently. Earlier
[SDK matrix 37112032843](https://github.com/ManoloRemiddi/augmentor-app-sdk/actions/runs/37112032843)
passes all six jobs with the prior product pin `629eaa6`; its
[Mac 14/26 packaged checks](https://github.com/ManoloRemiddi/augmentor-agent/actions/runs/37111918486)
also pass, including shipped SDK helper/registration/native-exit proofs. Those
runs do not qualify the later selection changes or installed customer apps.
