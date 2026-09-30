<!-- Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0 -->
# Developer preview handoff

See [qualification](QUALIFICATION.md) for exact source revisions, the private
release, selected runtime and the completed live cutover of both existing apps.
Preview 2 fixes the live DSH composition issue found during deployment.

30 September 2026. Scope agreed by the owner: dedicated private SDK repository; fortify existing app integration first; DSH only; existing private/commercial-use and resale-agreement license; optional experimental Resonant Voice; cloud voice later. The independent third application is the owner's blind test and must remain independent.

Source components: manifest validation, runtime negotiation, bounded native client, authenticated HTTP/WebSocket proxy, framework-neutral maintained-UI mount, DSH tool registration, bounded tool HTTP client, optional durable operation receipts and job leases, registration/validation/doctor/scaffold CLI.

Augmentor runtime changes remain in its canonical repository: current-main integration of the earlier embedding work, SDK handshake, explicit monotonic tool policy, shared-administration restrictions, workspace voice toggle and recoverable transactional profile installation. App integrations remain in their own private repositories. No runtime or chat UI is copied into the SDK.

## Reproduce

```sh
npm ci --ignore-scripts
npm test
npm run check
npm audit
npm pack --dry-run
```

Tests use temporary databases and synthetic transports. They cover idempotency across restart and competing connections, unknown outcomes, expired/replaced/cancelled job attempts, output validation, path escapes, unsupported harnesses, fragmented native frames, host death, connection concurrency, proxy credential isolation, and declared tool schemas.

Runtime qualification additionally runs Augmentor's workspace tests and `scripts/workspace-sdk-dsh-proof.mjs /absolute/path/to/dsh-package`. The latter uses real DSH/Cordis with synthetic tools to prove final denial cannot be undone by cooperative pre-execute hooks and unrelated agents retain their access. It makes no model requests and does not modify the owner's DSH configuration.

Existing app regression tests are separate from installed/live qualification. YouTube's Google channel permissions, Sponsor desk's account authorizations, physical speech, and editorial quality remain their owning applications' qualification concerns. The SDK does not fix absent provider permissions or certify existing business content.

## Completion boundaries

The preview requires a product build containing `augmentor-app/1`. Source and fixture success alone do not establish a selected or running runtime. Record exact commits, package hashes, deployment scope and live checks in the final qualification record. Public npm publication, multi-tenant hosting, Pi/Codex harnesses, cloud voice and the owner's independent adoption test are excluded from this implementation phase.

## Source qualification — 30 September 2026

SDK: 12 tests pass; syntax checks and the production dependency audit pass
(zero reported vulnerabilities). Product implementation `b410512` on `feat/app-sdk-foundation` in the canonical
[Augmentor repository](https://github.com/ManoloRemiddi/augmentor-agent): 193 Node tests, 44 Browser tests and
547 native tests pass (two native tests skipped). Native tests used the host's
matching Debian QtTest module extracted into a temporary test directory; no
installed speech or Qt environment was changed. The tool guard proof passes
against both the installed DSH runtime and the locked `0.1.5-rc.1` package.
These are contract and regression checks, not real-model or acoustic acceptance.


## Live cutover follow-up

Both existing apps now use preview 2 on their normal live services. See the current
section of QUALIFICATION.md for the exact package, app commits, managed runtime,
NAS image and backups. Real model/tool/browser, history isolation, cancellation
and voice preference checks passed. Use a new chat for the complete SDK policy;
already loaded legacy DSH agents retain their prior composition. The shared
harness was not restarted. The owner's independent third app remains untouched.
