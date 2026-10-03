<!-- Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0 -->
# SDK qualification — 30 September 2026

Preview 4 source extension: see [runtime alignment](RUNTIME-ALIGNMENT.md).
The live cutover below remains preview 2. No new installed platform/Codex
qualification is implied by the development candidate.

**Live cutover is complete.** The current deployment uses preview 2 and the
additional product corrections recorded below. The preview 1 record remains as
historical evidence; it does not describe the current app rollout.

## Preview 1: original revisions and distribution

| Component | Qualified source |
| --- | --- |
| SDK package | `9cb8faaaead57e379fdc5aa2a973497a4e98b828`, tag `v0.1.0-preview.1` |
| Product foundation | `eac2615d47c78711c0e5c37041556ade9d4b41ee`, [PR #23](https://github.com/ManoloRemiddi/augmentor-agent/pull/23) |
| YouTube migration | `e42db17`, [PR #1](https://github.com/ManoloRemiddi/youtube-dashboard/pull/1) |
| Sponsor desk migration | `b43561a`, [PR #1](https://github.com/ManoloRemiddi/sponsor-desk/pull/1) |

The [preview release](https://github.com/ManoloRemiddi/augmentor-app-sdk/releases/tag/v0.1.0-preview.1)
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

## Preview 1: original selection before app cutover

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


## Live cutover: preview 2

The owner authorized deploying both existing apps on 30 September 2026.

| Component | Deployed code |
| --- | --- |
| SDK | `e5948515b311109d55b0d4da18bd89a5619b480f`, `v0.1.0-preview.2` |
| YouTube dashboard | `8d4c39f7c697b4a533d2015443e804449bf230f3`, merged PRs #1 and #2 |
| Sponsor desk | `300aac14efc245c87315742d5adfee06004d5ccb`, app 3.1.5/schema 2, merged PRs #1 and #2 |
| Augmentor foundation | merged PR #23 |
| Product live corrections | `a400564d19d221366297a75701f5ff635bd084d0`, merged PR #24 (merge `b70d9651812ca1cffe6ba649e7527103fd787740`) |

[Preview 2 release](https://github.com/ManoloRemiddi/augmentor-app-sdk/releases/tag/v0.1.0-preview.2)
archive SHA-256:
`4cec3bc26103edff970d9d793bba092e840713fce5e33799fdc2851c238e98d3`.
Both app lockfiles pin that reviewed vendored archive. The release is immutable;
main's documentation is the current deployment record. Preview 1 is superseded
because its registration redeclared the preset's native tool presentation.

Selected and running embedding artifact:
`20260930-123536-bba3b966`, Augmentor 0.2.11, SHA-256
`91ae4b61eb4ce837477acaa19edbd8be1dbe21e5a2e047baf7a61e2a211484b3`.
It retains the earlier compatible artifact and adds only the qualified workspace
policy/proof, embedding-entry and workspace voice-settings corrections. This is a recorded mixed artifact,
not a fresh build of all current main changes. It was staged and activated through
`augmentor-update`; only the embedding service adopted it immediately.

YouTube runs on its normal `youtube-dashboard.service`, at
`http://127.0.0.1:8768`. Sponsor desk runs only in its existing NAS container,
reachable at `http://127.0.0.1:8871`, image
`sha256:8b3406e7a70fe2eadcf7aca1902fee6b0381bf6e0c9f4527ebca9a16345a65f5`.
The local Sponsor service remains disabled. Private-tunnel access, data mounts,
credentials, model selection, workspace cwd, memory identity and history remain
in place. Shared DSH, memory, speech and unrelated native windows were not restarted.

### Defects found through live tests

- Duplicate native-presentation registration prevented fresh DSH agents from
  mounting. SDK preview 2 inherits the product's presentation. The real DSH proof
  now composes that existing presentation before registering SDK tools.
- The execution guard denied ungranted tools, but the model still saw them.
  Product PR #24 filters the completed prompt assembly as well. Filtering only
  the preset's inherited global registry failed because many tools belong to
  the standing preset itself; the proof now reproduces standing-parent and
  agent-child scopes with both global and preset-local tools.
- The experimental voice control was covered by the settings sidebar. It now
  lives inside Voice settings and reports save success or failure. SDK workspaces
  show their own opt-in control; shared audio configuration stays in standalone
  Augmentor, avoiding a second shared-settings form with an incompatible response.
- DSH retains imported module instances. The two adapters use a release-specific
  URL for the corrected SDK entry so this entry-only correction can load without
  restarting shared DSH. This is not a general dependency-graph reload guarantee.

### Live evidence

- Product [PR #24](https://github.com/ManoloRemiddi/augmentor-agent/pull/24)
  merged after all checks passed: [Linux runtime, Debian, installed packages and Browser package](https://github.com/ManoloRemiddi/augmentor-agent/actions/runs/36703368773),
  [macOS 14 and 26 bundled runtimes](https://github.com/ManoloRemiddi/augmentor-agent/actions/runs/36703368382),
  and GitGuardian. Both app migration, correction and deployment-documentation
  PRs are merged. SDK [preview 2 CI](https://github.com/ManoloRemiddi/augmentor-app-sdk/actions/runs/36701227503)
  passed; the downloaded release archive matched the deployed archive checksum.
- Fresh locked app installs and complete suites pass: YouTube 90; Sponsor 124;
  SDK 12. Production audits report zero vulnerabilities. Product has 193 passing
  Node tests and 44 Browser tests; all 11 embedding/workspace tests pass after the final layout change.
- Real DSH proofs pass against installed DSH and the pinned package. They verify
  declared inputs, final denial despite cooperative allow hooks, allowed calls,
  scoped catalog filtering and unchanged unrelated-agent access.
- Native SDK tests used the owner's already selected local Qwen model. Each app
  performed exactly one successful read-only help tool call and completed its
  answer. Shared runtime administration was denied and voice negotiated off.
- The same route was then exercised through each actual app browser panel:
  send, streamed response, app tool execution, final answer and persisted history.
  Browser sessions `augmentor-cc368cab` and `augmentor-9bdcf610` each advertised
  exactly their 20 manifest grants. The other workspace's history was denied.
- Separate read-only cancellation tests in both apps observed a running turn,
  acknowledged cancellation and then confirmed `running: false`; neither test
  called an application tool. An acknowledgement alone was not treated as proof
  of stoppage.
- The experimental voice toggle saved on/off through the browser. Native
  negotiation reflected the preference while the other workspace remained off.
  Both workspaces were left off; no recording or playback was started.
- Final reloads preserved the completed test conversations without replaying
  their prompts. Workspace profiles retained the original cwd, preset, token
  reference and memory identities.
- YouTube record and job snapshots matched the pre-cutover read. Sponsor desk
  received independent authorized contract-review updates during this run; those
  newer records, documents and drafts were retained. Final read-back matched
  the post-review collections and drafts. The SDK test itself made no business
  edits, sent no email and published no comments.

Backups are private: local profile/preset/preferences and YouTube online SQLite
snapshot under `~/.local/state/augmentor/sdk-cutover-20260930`; NAS verified online
snapshot at `/data/backups/pre-app-sdk-20260930`, source archive under
`/home/manolo/sdk-cutover-20260930`, prior image tagged
`sponsor-desk:pre-app-sdk-20260930`. Roll integration code and profile/preset
before-images back together if required. Keep the current business database;
restoring it would discard later owner work.

### Testing scope and existing chats

For the complete SDK tool policy, use **New chat** after reloading the app.
Already instantiated legacy DSH agents retain their earlier composition;
reopening their history does not convert them. The existing history remains
available. No shared harness restart was used to force old chats to recompose.
The verified new chats and new background sessions use the SDK composition.

This qualifies the live connection and app regressions. It does not certify
all editorial output, every external-account action, physical microphone/audio,
OS suspend/resume or the owner's independent third-app adoption test. Voice is
experimental and remains off by default; cloud voice, Pi and Codex remain deferred.


## Agent onboarding: preview 3 — 1 October 2026

[PR #1](https://github.com/ManoloRemiddi/augmentor-app-sdk/pull/1) is merged.
Implementation head `b9d859d2d50195e52d1b8a933c91b4b137636746` passed
[push CI](https://github.com/ManoloRemiddi/augmentor-app-sdk/actions/runs/36829930736)
and [PR CI](https://github.com/ManoloRemiddi/augmentor-app-sdk/actions/runs/36829936174),
including clean packed-consumer acceptance, plus GitGuardian. The immutable
[preview 3 release](https://github.com/ManoloRemiddi/augmentor-app-sdk/releases/tag/v0.1.0-preview.3)
is tagged at merge `ed31dc00f98a58492155962307c2631c4b3501a5`.
Archive SHA-256:
`c50088cb6cd88c3bbf8fec48861a41fa845b2a25a7d3959f3e50088fdb8bdad8`.
The downloaded GitHub archive matched the local artifact and checksum byte for
byte, and contained the agent instructions and templates. Later documentation
records do not change those immutable release bytes.

This release improves the handoff to an agent working from the repository alone.
It adds the agent entry workflow, API reference, acceptance and troubleshooting
instructions; all are shipped in the package with AGENTS.md. The read-only
integration scaffold includes a declared DSH tool, authenticated backend/proxy
routing, maintained-panel mount and ignored private-configuration guidance.
The app still supplies its real owner-session check and record reader.

CLI help/version, non-executing file validation, registration planning and clearer
descriptor-only doctor output remove assumptions from the earlier quick start.
`validate` now rejects missing files, directory entries and escaping symlinks;
`--schema-only` is explicit. Init preflights all output files and rejects symlink
output directories. Plan omits private tool configuration and does not write
credentials, register profiles or contact a model.

Qualification on Node 24.19.0: all 18 source/CLI tests pass, including collisions,
file containment, private-plan output and absent-runtime behavior. The package
consumer test passes: build archive, inspect shipped files, install into a clean
project, reinstall from its lockfile, generate the adapter, and exercise the
installed SDK's tool schemas/client and generated backend over HTTP/WebSocket.
It covers owner and app-agent authentication, credential separation/stripping,
origin denial, undeclared tools, invalid/oversize input, authoritative fixture
read/projection, missing records and sanitized backend errors. DSH defineTool and
the upstream panel are synthetic in that consumer test. The separate real-DSH
registration proof also passes against the installed DSH package, without a model
request. Syntax checks and dependency audit pass (zero vulnerabilities).

The protocol remains `augmentor-app/1`; no product changes or live application
redeployments were performed. The two live apps retain the preview 2 evidence
above. No new live model, browser layout, physical voice, fresh-machine runtime
installation or independent third-app result is claimed. The owner still owns
that independent adoption test. Preview 3 is developer-onboarding qualification.


## Public repository — 1 October 2026

The owner authorized public visibility for this SDK repository and its existing
release assets. The tracked history was reviewed across 11 commits and 78 unique
file versions: no private credential/database files or credential-pattern matches
were found. Tracked material is SDK source, synthetic fixtures, guides and dated
integration evidence; live credentials, application records and runtime state
remain outside this repository. GitGuardian checks passed on the implementation.

Current access guides use anonymous source/release downloads. Earlier private
repository references are historical. Published preview archives and tags remain
immutable; licensing and runtime support are unchanged. Public source availability
does not imply a public npm publication or a new live-app deployment.

GitHub now reports `PUBLIC` / `private:false`. Anonymous requests verified the
repository metadata, current agent guide and both preview 3 assets; the downloaded
archive matched its published SHA-256 above. Access notes on all three existing
releases were updated without changing their archives or tags.
