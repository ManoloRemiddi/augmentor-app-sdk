<!-- Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0 -->
# Start here if an agent is integrating Augmentor

This guide is sufficient to plan an integration without the author's chat history,
private reference-app repositories or workstation configuration. It does not
replace the target app's own instructions. Read the target app's `AGENTS.md` first.

## Establish the task and the boundaries

Inspect the target application's remote, branch, uncommitted changes, package
manager, HTTP framework, authentication, database and deployment instructions.
Preserve existing work. Determine whether this is a new workspace or a migration.
Choose a stable app/profile ID; do not reuse `my-app` across installations.

Read, in order:

1. [GUIDE.md](GUIDE.md): the 0.2 agent-native kit on `main`, used for new apps. It covers
   tools with approvals, premade prompts, UI control, automation and the review queue, with
   code. `augmentor-app init --template app` generates the starting files and an
   `augmentor/INTEGRATION.md` checklist.
2. [Quick start](QUICKSTART.md): installing the SDK archive, checking the runtime, tokens,
   `plan`/`register` and embedding the panel. Registration is the same for 0.1 and 0.2.
3. [Contract](CONTRACT.md) and [security](SECURITY.md): authority, recovery and trust.
4. [API](API.md): exact exports, method signatures, defaults and ownership.
5. [Acceptance](ACCEPTANCE.md): what must be demonstrated before saying it works.
6. [Troubleshooting](TROUBLESHOOTING.md) when a step fails.

Existing integrations moving from 0.1 also read [MIGRATION-0.2.md](MIGRATION-0.2.md). Read
[runtime alignment](RUNTIME-ALIGNMENT.md) only for Codex or platform-adapter work.

Supported: trusted single-owner applications, Linux managed Augmentor runtime,
DSH, Node 24.14+. A cloud-only app without access to an owner-managed Augmentor
host is not this topology. Customer macOS/Windows SDK installation, multi-tenant SaaS, untrusted plugins,
Pi and cloud voice are not qualified here. Source since preview 4 (including 0.2) has an experimental
Codex application adapter and OS startup/private-path contracts; use the alignment
guide and its exact gates rather than treating product support as SDK qualification.
Keep Resonant Voice experimental, optional and off initially.

The repository and release assets are public. An agent can clone the source and
download the pinned SDK archive without a GitHub account. `@augmentor/app-sdk`
is installed from that archive; no public npm publication is claimed. Runtime
and application credentials remain installation-owned. Never print access tokens
or copy another app's credentials.

## Build in this order

| Stage | Concrete output | How to verify |
| --- | --- | --- |
| Inspect | App topology, stable identities, existing authority/data boundaries | Read target code and deployment guide; list unknowns |
| Install | SDK archive packed from `main` (0.2) or a published release, with lockfile and provenance | Clean locked dependency install |
| Scaffold | Role, `augmentor/app.mjs` (tools, prompts), server and page wiring | `init --template app --id ...`; `augmentor-app manifest` and `check` |
| Adapt | Real owner-session check, your record service, approval-gated external actions | Authenticated/denied API tests; `checkToolkit` and mock-runtime tests |
| Preview | Exact grants, origin, cwd, preset and memory identity | `validate`, `doctor`, then `plan` |
| Register | Private profile and preset on the model host | `register`, then `AugmentorClient.connect()` negotiation |
| Embed | Maintained Augmentor panel at the app's authenticated same-origin path, Ask buttons, review queue | Fresh chat; a real tool result; a prompt from a button; an approval |
| Qualify | Evidence against the checklist, failures handled explicitly | [Acceptance](ACCEPTANCE.md) |
| Deliver | Source, deployment status, test results and remaining limits | Commit/push when authorized; identify running versus source versions |

Use the generated scaffold as adapter code inside the existing (or new) application. It
is not a runnable business app: the record service and `authorizeOwner` must be supplied
by that application. Do not substitute fixture data and call the integration done.
The same read-only projection must agree between backend and tool output schema.

An app's business API, credentials, source provenance, records, domain validation,
schedules and externally visible actions remain app-owned. Augmentor owns chat
rendering, the selected harness lifecycle, workspace memory and model policy. Use the SDK's client,
proxy and browser mount; do not fork Augmentor's UI, spawn another agent loop or
import its release internals. Never grant shell/browser/delegation merely to make
a missing app tool work.

## Ask only when the answer is necessary

Proceed with reversible source work and isolated tests. Request missing facts
when the target app, authorized deployment, desired record
scope, owner authentication or installation identity cannot be established.
Do not fabricate a model provider, credential, deployment target or business
permission. Follow existing user authorization; this guide adds no approval gate.

When there is no compatible managed runtime, complete the app adapter and fixture
checks, then report the runtime prerequisite precisely. Link the product's
[SDK guide](https://github.com/ManoloRemiddi/augmentor-agent/blob/main/docs/APP-SDK.md)
and [managed deployment guide](https://github.com/ManoloRemiddi/augmentor-agent/blob/main/docs/DESKTOP-DEPLOYMENTS.md).
There is no qualified generic fresh-runtime installer in this SDK. Do not modify
the owner's DSH/model settings or copy a private selected release to bypass it.

## Migrate an existing integration carefully

Read and preserve its profile ID, preset, canonical cwd, memory bindings, token
references, selected model, data paths, sessions and jobs. `plan` cannot detect
all installed identity collisions; the product installer performs those checks.
Back up installation configuration and app data through the owning app's tools.
Stage changes through its deployment procedure; do not patch a selected Augmentor
release in place. Registration does not restart Augmentor. New or changed tool modules load
the next time Augmentor starts: quit and reopen it (or apply its next update) when no task is
running. Use a **new chat** for the full policy: previously instantiated agents retain their
composition.

DSH caches imported modules. Do not promise hot-reload after installing a new SDK
package or changing tools. Preview 2's two live apps used a release-specific entry
URL for a narrowly qualified entry-only correction; that is historical evidence,
not a general reload recipe. Coordinate adoption with active work and the managed
runtime's lifecycle. Never restart shared DSH to stop a single app job.

Scaffold and fixture results are wiring evidence, not proof of a live installation. The two
existing integrations are dated evidence in [qualification](QUALIFICATION.md), not required
templates or required credentials.

## Ready-to-use task for another coding agent

Provide this prompt together with the actual target app and deployment scope:

> Integrate the Augmentor App SDK into this application. Read the SDK repository's
> AGENTS.md and docs/AGENT-INTEGRATION.md, then the target app's own instructions.
> Use the 0.2 kit packed from the SDK's `main` (`augmentor-app init --template app`),
> the maintained Augmentor panel, exact tool grants and the existing application
> authentication/data rules. Declare tools with effects in `augmentor/app.mjs`; keep
> irreversible actions approval-gated or out of the tool set; add premade prompts for the
> app's common requests. Keep DSH as the harness and voice experimental/off.
> Run the documented acceptance checks and report source, installed and live
> evidence separately. Preserve existing data, histories, jobs and configuration.
> Ask for facts you cannot establish; do not invent credentials or claim fixture
> results prove a live integration. Follow my stated deployment authorization.

That prompt targets DSH on a Linux model host. For an explicitly authorized
preview 4 Codex development integration, also supply this instruction:

> Use the unreleased preview 4 source candidate and the immutable paired product
> revision from docs/RUNTIME-ALIGNMENT.md. Select Codex explicitly on Linux or
> macOS; do not fall back to DSH or claim Windows Codex support. Reuse an existing
> owner-configured Codex connection ID and generate the Codex scaffold. Verify
> the workspace role, exact grants, session/memory ownership, context binding,
> cancellation, recovery and packed-runtime proof before claiming source
> integration. Keep installation-wide settings in standalone Augmentor. Report
> customer installation and real-provider checks separately; this candidate is
> not a published release or permission to migrate a live application.
