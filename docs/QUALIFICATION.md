<!-- Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0 -->
# Preview 1 qualification — 30 September 2026

## Revisions and distribution

| Component | Qualified source |
| --- | --- |
| SDK package | `9cb8faaaead57e379fdc5aa2a973497a4e98b828`, tag `v0.1.0-preview.1` |
| Product foundation | `eac2615d47c78711c0e5c37041556ade9d4b41ee`, [PR #23](https://github.com/ManoloRemiddi/augmentor-agent/pull/23) |
| YouTube migration | `e42db17`, [PR #1](https://github.com/ManoloRemiddi/youtube-dashboard/pull/1) |
| Sponsor desk migration | `b43561a`, [PR #1](https://github.com/ManoloRemiddi/sponsor-desk/pull/1) |

The [private preview release](https://github.com/ManoloRemiddi/augmentor-app-sdk/releases/tag/v0.1.0-preview.1)
contains the package and checksum file. The downloaded release asset was compared
with the package used by both migrations. SHA-256:
`44b7bb14e551d875e60020c6c7ac6eb00593687c7918c0b49e802dcacc2b399d`.
The release tag remains fixed; later qualification documents and proof scripts
on main do not change its package bytes. No npm publication has been made.

## Evidence

- SDK: all 12 contract tests, syntax checks and dependency audit pass; zero
  reported vulnerabilities. [Package-source CI](https://github.com/ManoloRemiddi/augmentor-app-sdk/actions/runs/36689797629) passed.
- Product: 193 Node tests, 44 Browser tests and 547 native tests pass (two native
  skips). The final voice-preference correction additionally passes all 11
  workspace/embedding tests. Its native negotiation was exercised against the
  staged artifact with a temporary preference, without enabling real audio.
  The final source passes the complete [Linux/package workflow](https://github.com/ManoloRemiddi/augmentor-agent/actions/runs/36690786169)
  and [macOS 14/26 regression workflow](https://github.com/ManoloRemiddi/augmentor-agent/actions/runs/36690786156).
  Those existing product suites do not qualify fresh SDK installation on macOS.
- Real DSH/Cordis: the final guard prevents an ungranted tool body from running
  even when a cooperative hook allows it. An unrelated agent retains its own
  access. The proof passes against both installed DSH and locked `0.1.5-rc.1`.
- The SDK's own tool registration was exercised with real scoped DSH: a valid
  array argument executes; an invalid array never reaches the implementation.
  Reproduce from this checkout with `node scripts/proof-dsh.mjs /path/to/dsh-package`.
- Both app migrations pass a clean locked dependency install and their complete
  suites: YouTube 90 tests; Sponsor desk 124 tests. Both validate their manifests
  and report zero audited dependency vulnerabilities.
- The packaged SDK connected through the actual staged native host to the
  existing DSH service. Workspace-scoped history and denial of shared permission
  changes were checked with temporary profiles. Canonical cwd comparison is
  required because a registered application directory may be a symlink.

The native tests used the host's matching Debian QtTest module extracted into a
temporary test directory. Installed Qt and speech environments were unchanged.
Tests are synthetic unless explicitly described above. No live model prompt,
email send, public post, business record write or physical microphone test is
claimed. The owner's third app has not been built or inspected.

## Selected versus running

The compatible Linux product preview is selected as managed release
`20260930-103709-c649e303`, product `0.2.11`, artifact SHA-256
`885210ed00aa460ce1e393ba3d96dfdfc4d7b054cf128ff6efb79b31636c3310`.
It was built from the previous selected `20260928-093018-2d4431f6` artifact with
only the SDK foundation files overlaid from the qualified source. Existing
product, DSH and speech versions were retained; this is explicitly a mixed
compatible artifact, not a fresh unmodified main build.

`augmentor-update` staged and activated it through the authenticated compatibility
preflight. `augmentor-app doctor` reports `augmentor-app/1` and DSH. The embedding
service was restarted after both registered workspaces reported no running
sessions. Shared DSH, memory, speech and native windows were not restarted.
Native windows remain online on the earlier release and report an update pending;
they adopt the selection on their next normal start.

The existing YouTube and Sponsor desk application services, authoritative stores
and registered profiles have **not** been migrated. Their reviewed source
changes are in the linked PRs, with package provenance and rollout instructions.
The YouTube migration also rejects old job attempts after retry or UI list truncation,
and refuses to infer stoppage from an absent row in a bounded session list.
These legacy profiles do not receive new SDK grants until explicitly registered
from their canonical application checkout. Already instantiated legacy agents
are not retroactively restricted. The selected product supports registration of
new SDK applications now; existing application cutover is a separate rollout.

Product source CI and the linked PRs are the current review record. The owner’s
dirty canonical Augmentor checkout and unrelated harness work were preserved.
