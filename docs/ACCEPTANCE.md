<!-- Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0 -->
# Integration acceptance checklist

Use fixtures for destructive/uncertain-outcome cases. A scaffold passing these
fixtures is not independent adoption evidence. Read-only real-model tests should
use an explicitly chosen harmless record. Do not send mail, publish or change
business records as a generic SDK smoke test.

## Before registration

- [ ] Authorized repo/release access; archive hash checked; exact package/lockfile recorded.
- [ ] Existing auth, record ownership and deployment topology identified.
- [ ] `validate` passes for real files; manifest names match registered tool names.
- [ ] `doctor` finds `augmentor-app/1`/DSH; do not treat this as running readiness.
- [ ] `plan` reviewed: unique/stable profile, preset, canonical cwd and memory binding.
- [ ] No wildcard or incidental shell/browser/delegation grants; voice off.
- [ ] Separate app-agent/proxy tokens and installation config ignored, private and absent from browser bundles, logs and Git diff.
- [ ] Migration backup and rollback identified without overwriting newer business data.

## Isolated adapter and application tests

- [ ] Owner-authenticated HTTP embed and WebSocket upgrade succeed.
- [ ] Missing owner auth, wrong Host/Origin, cross-site requests and forged browser Authorization fail without reaching protected upstream data.
- [ ] Tool endpoint rejects absent/wrong app-agent credentials, ungranted tool names, invalid arguments and oversize bodies.
- [ ] Tool reads a current authoritative record and returns only intended fields; unauthorized/not-found/error paths are honest.
- [ ] Role, manifest, tool input/output and backend validation agree.
- [ ] Any writes enforce current revisions/source versions, stable domain IDs and receipts. Simulate a lost response after a write and show that no duplicate action occurs.
- [ ] Any jobs fence cancelled/replaced/expired attempts, validate saved outputs, and refuse retry without proven prior stoppage. Missing rows in bounded lists do not authorize retry.

## Real managed-runtime and browser checks

- [ ] Registration succeeds on the model host without unexpected identity/config changes.
- [ ] `AugmentorClient.connect()` negotiates the expected profile and DSH; shared administration and another workspace's history are denied.
- [ ] A **new chat** in the actual host app panel receives one real model response and invokes the intended read-only app tool successfully.
- [ ] Assembled model tool catalog equals the manifest's exact union of app names and extra grants. The runtime also denies ungranted execution.
- [ ] Reload/reconnect preserves that conversation without replaying its request.
- [ ] A harmless running task can be stopped; confirm that exact session is idle. Cancellation acknowledgment alone is insufficient.
- [ ] If voice is offered, the workspace opt-in persists independently and starts off. Physical recording/playback needs separate testing before claiming audio works.
- [ ] Business data, drafts, prior history and app settings survive migration; normal app health checks pass.

## Delivery record

Report SDK version/archive SHA, app source revision, selected and running runtime,
deployment target, commands/results, fixture versus real-model/browser evidence,
rollback location (without secrets), and unresolved limitations. Record unsupported
checks as **not run**, with the prerequisite; do not call the integration verified
when live evidence is missing. Give the owner the actual app URL and the new-chat
instruction. Publish durable docs alongside source when authorized.

For SDK maintainers, `npm run test:package` exercises the shipped artifact and
scaffold in a clean temporary consumer using synthetic HTTP/WebSocket and record
fixtures. It does not register anything, start DSH, call a model, or exercise the
owner's third app. Live product/application qualification remains separate.
