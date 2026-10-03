<!-- Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0 -->
# Developer preview handoff

## Preview 4 source candidate — October 3, 2026

The owner-authorized source update is integrated on main through
[SDK PR #2](https://github.com/ManoloRemiddi/augmentor-app-sdk/pull/2), merge `3797777`,
after paired [product PR #34](https://github.com/ManoloRemiddi/augmentor-agent/pull/34),
merge `602669a`. The public-source integration uses this already-qualified
functional pair; the developer guides now distinguish source builds from the
immutable release and include [compatibility maintenance](MAINTENANCE.md).
Fresh local SDK, packed-consumer and paired-runtime checks pass, alongside all
88 Browser cases, four platform contracts and product check/build/privacy checks.
This updates source availability; customer release and live migration remain
separate gates.
All six SDK jobs also pass after merging, in
[37123748023](https://github.com/ManoloRemiddi/augmentor-app-sdk/actions/runs/37123748023).
All eight merged-product jobs also pass in
[37123715286 attempt 2](https://github.com/ManoloRemiddi/augmentor-agent/actions/runs/37123715286/attempts/2).
The first loaded-Chromium queue timeout, passing repeats and remaining experimental
acceptance gate are retained in the alignment record rather than marked resolved.

[Runtime alignment](RUNTIME-ALIGNMENT.md) owns the new feature negotiation,
harness-neutral tools, experimental Codex adapter, platform bootstrap and
paired-package/platform qualification. This candidate is not a published
release or live app cutover. Preserve the immutable preview 3 release and both
existing preview 2 deployments.

Current functional pair: SDK `925b72e` / product `8a085be`. The alignment guide
records passing SDK/platform/Mac-bundle/Windows-desktop/full-Linux and Windows
x64/ARM64 installation checks. All required source/package qualification is
complete for that pair; customer-release gates remain explicit and open.
Its newest checkpoint supersedes historical pending statuses without relabelling
older test runs. The agent entry guide also distinguishes the released DSH task
from an explicitly authorized experimental Codex source integration.


## Public access — 1 October 2026

The owner authorized making `ManoloRemiddi/augmentor-app-sdk` public. Source and
release assets are readable without GitHub authentication. The quick start uses
anonymous download URLs. Existing released archives/tags remain immutable; their
access notes reflect the earlier private development stage. Follow the maintained
guides on main for current access instructions. Application credentials and
installation configuration remain private. License and resale-agreement terms
are unchanged.

## Current onboarding release — 1 October 2026

Preview 3 adds the [agent entry guide](AGENT-INTEGRATION.md), [API](API.md),
[acceptance](ACCEPTANCE.md), [troubleshooting](TROUBLESHOOTING.md) and a rewritten
[quick start](QUICKSTART.md). These are the entry path for an agent integrating
a new application; prior conversation and private reference-app code are unnecessary.

`init` now generates coherent read-only tool/backend/browser wiring plus private
configuration guidance. The application must provide its real owner-session check
and record reader. `validate` checks existing contained regular files without
executing modules (`--schema-only` retains schema-only use). `plan` previews
identity/grants without installing. `doctor` explicitly labels descriptor-only
inspection, and `--help` / `--version` are available. The npm artifact includes
AGENTS.md, all guides and templates.

Run `npm run test:package` in addition to the source checks below. It packs and
installs into a clean temporary consumer, repeats a locked install, generates the
adapter, and exercises real HTTP/socket/tool paths with synthetic services and
records. It never registers a real workspace or calls a model. The two live apps
remain on preview 2; no new live app or UI/audio qualification is claimed here.

## Existing integration record

See [qualification](QUALIFICATION.md) for exact source revisions, the SDK
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
npm run test:package
npm audit
npm pack --dry-run
```

Tests use temporary databases and synthetic transports. They cover idempotency across restart and competing connections, unknown outcomes, expired/replaced/cancelled job attempts, output validation, path escapes, unsupported harnesses, fragmented native frames, host death, connection concurrency, proxy credential isolation, and declared tool schemas.

Runtime qualification additionally runs Augmentor's workspace tests and `scripts/workspace-sdk-dsh-proof.mjs /absolute/path/to/dsh-package`. The latter uses real DSH/Cordis with synthetic tools to prove final denial cannot be undone by cooperative pre-execute hooks and unrelated agents retain their access. It makes no model requests and does not modify the owner's DSH configuration.

Existing app regression tests are separate from installed/live qualification. YouTube's Google channel permissions, Sponsor desk's account authorizations, physical speech, and editorial quality remain their owning applications' qualification concerns. The SDK does not fix absent provider permissions or certify existing business content.

## Completion boundaries

The paragraph below records the original DSH-only implementation phase.
Preview 4 source scope and qualification are owned by [runtime alignment](RUNTIME-ALIGNMENT.md);
that extension remains unreleased and does not migrate the two live applications.

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
