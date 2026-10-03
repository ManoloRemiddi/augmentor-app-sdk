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
workspace voice opt-in, saved chats, read-only memory context and prompt use.

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
| macOS / Codex | Experimental adapter, hosted qualification required | Pending |
| Windows / DSH | Bootstrap/private ACL/startup adapter | Pending |
| Windows / Codex | Explicitly unsupported | No adapter claimed |
| Pi / cloud voice | Outside this SDK extension | Not implemented |

## Qualification and compatibility maintenance

Run source/packed checks, then build the exact paired public product source and:

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
[`c583475`](https://github.com/ManoloRemiddi/augmentor-agent/commit/c583475f4e6420ddc46df0c5a49cfe87545dd78c)
by immutable commit. Product platform CI independently verifies OS private files
and startup contracts. Pending hosted checks are not passing evidence.

Maintain the same contract in both repositories. New shared settings, harness,
platform bootstrap, IPC, tool policy or lifecycle behavior needs a paired impact
assessment and qualification. Product version numbers alone do not establish
compatibility. Preserve released archives and deployed app provenance. The
owner's independent third app remains untouched; these fixtures are not that
adoption test. Physical dictation/voice, OS permission dialogs, installed service
and update/rollback acceptance remain separate gates.
