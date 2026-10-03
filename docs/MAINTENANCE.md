<!-- Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0 -->
# Keep the SDK and Augmentor aligned

The SDK and product have separate versions and repositories. An Augmentor feature
does not become an SDK feature merely because both packages build. Current source
is preview 4; the published onboarding package remains preview 3. Start with
[runtime alignment](RUNTIME-ALIGNMENT.md) for the immutable qualified source pair,
platform/harness matrix and remaining installation gates.

## Assess each product change

| Product change | Required integration review |
| --- | --- |
| Harness or engine upgrade | Explicit adapter selection, tool catalog, role/session/memory ownership, cancellation and uncertain outcomes. Keep DSH the default; never silently switch a conversation. |
| Native or Browser UI | Reuse the maintained product interface. Check embedded navigation, authentication, context and workspace preference restoration; do not copy UI into this package. |
| Settings or administration route | Identify workspace versus installation ownership. Enforce the boundary in the native runtime as well as the UI, including direct calls. Test denial and same-origin workspace isolation. |
| OS, launcher or installer | Review product discovery, managed binaries, private state, startup ownership and lifetime leases. Run checks on each affected OS; a successful Linux build does not qualify Mac or Windows. |
| Computer use | Require exact grants, supported backend/model and fresh OS consent. Discovery is an availability snapshot; dispatch must enforce current authority. |
| Handy or conversational voice | Keep global dictation setup in standalone Augmentor. Keep Resonant workspace opt-in experimental/off by default. Do not add a second dictation process or equate API support with working audio. |
| Application context or recovery | Preserve bounds, workspace ownership, request identity and documented harness-specific binding. Lost acknowledgment must not replay an action or authorize a new identity. |

For an unknown feature, report `unknown`. Required features must be `supported`
before initialization. `disabled`, `denied` and `unsupported` are distinct states;
none authorizes fallback or an automatic change to owner configuration.
`readinessVerified:false` means discovery has not tested a provider, microphone,
OS permission or memory engine.

## Keep one reviewed source pair

1. Inspect both repositories' instructions, origins, branches and changes. Work
   separately from dirty owner checkouts and preserve installed state.
2. Update the owning product contract and SDK API/scaffold/guides together.
   Preserve `augmentor-app/1` compatibility for additive optional fields; change
   the protocol when required semantics are incompatible. Never rewrite a
   published version or tag.
3. Build the product and run `npm run check`, `npm test`, `npm run test:package`
   and `npm run test:runtime -- /absolute/path/to/paired-product` in the SDK.
   Use isolated synthetic state. The packed consumer is a fixture, not the
   owner's independent third application.
4. Pin the product SHA in `.github/workflows/validate.yml` to the reviewed
   functional revision. Keep the pin immutable; do not replace it with `main`.
   Run the six source/packed/paired jobs on Linux, macOS and Windows, plus the
   affected product platform, Browser and packaged-runtime workflows.
5. Record exact source SHAs, successful run URLs, test scope and remaining gates
   in the alignment and handoff guides. Later documentation-only commits may
   retain that qualification; a functional change requires applicable retesting.
   Integrate paired product source before the SDK source that depends on it.

The source update may remain experimental while product account/setup work is
developing. Windows Codex, Pi and cloud voice remain outside preview 4. An app
must not infer a qualified combination from the host operating system alone.

## Release and app adoption

Source integration, an SDK archive, an installed product and a running app are
different deliverables. Before expanding advertised installation support, verify
the exact SDK archive and runtime artifact together: customer install/login
startup, workspace registration, real provider/account, conversation/tool/reopen,
Stop, shared-administration denial, retained drafts/data and upgrade/rollback.
Physical voice and OS consent require their own acceptance when offered.

Follow [acceptance](ACCEPTANCE.md) and the application's deployment procedure.
Do not hot-patch a selected product artifact, restart shared work to load tools,
silently change credentials/models, or switch an existing workspace's harness.
Keep the recorded YouTube/Sponsor desk deployment and rollback evidence until
their separately qualified migration. Leave the owner's independent third-app
test independent. Preserve the existing license and resale-agreement terms.
