<!-- Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0 -->
# Connection contract v1

Protocol: `augmentor-app/1`. Manifest schema: `1`. Supported harness: `dsh`. Versions with a different protocol major fail closed. Preview package patch versions may add optional fields; required semantic changes require a protocol revision.

## Identity and authority

Application ID identifies a developer integration. Workspace/profile ID identifies one owner-installed instance. DSH preset plus canonical cwd identifies its sessions. Memory uses an explicit person/project binding. Session ID belongs to DSH. Request/operation IDs identify submissions, and job attempt IDs fence work across retries. These identifiers are not interchangeable credentials.

Two independent private credentials are involved: the app proxy authenticates to Augmentor, and the app tool adapter authenticates to the application's backend. They remain server-side. Owner browser authentication belongs to the host app. Third-party Google/service OAuth belongs to that app's connector and is never copied from another workspace.

Installed tool grants are exact names enforced by a final DSH guard. Runtime administration, shared permission settings and shared prompt mutations are excluded from SDK workspaces. Legacy profiles remain compatibility profiles until explicitly migrated. Trusted plugin code has the OS rights of its process; the guard restricts model-dispatched tools, not malicious installed JavaScript.

## Transport and embedding

`workspace.describe({protocol})` precedes product negotiation and reports workspace identity, harness, product protocol/version, granted tools and experimental voice configuration. An incompatible or non-SDK profile rejects connection. The SDK then performs the product handshake and initializes its existing DSH bridge. The app never parses release internals.

Native request frames are capped at 1 MiB and responses at 20 MiB. The client bounds pending requests and output backlog. HTTP tools cap response bytes and combine deadlines with caller cancellation. Reads may be retried by callers after reconnect. Mutating requests are never retried automatically. Browser context is at most 16 KB; `postMessage` requires the exact parent window and origin. App context cannot alter presets or permissions.

Browser events remain `augmentor-ready`, `augmentor-context`, `augmentor-status`, `augmentor-settings`, `augmentor-link` and `augmentor-hide`. The SDK validates origin/source and navigation targets. Augmentor owns rendering and history; the application owns its outer panel, navigation and owner authentication.

## Operations and jobs

For a side effect: persist identity and input digest → dispatch → confirm durable outcome. A crash, deadline or unparseable response after dispatch produces uncertainty. Do not generate a new ID to bypass an unresolved receipt. Reusing an ID with changed arguments is a conflict. External reconciliation may confirm completion or a definite rejection; absence from a partial listing is not proof of non-execution.

Jobs follow `queued → running → completed | partial | failed`. Loss of execution knowledge gives `interrupted`. Owner cancellation gives `cancelled`. Retries require verified stoppage and generate a new attempt identity. Late results from prior attempts fail. Output validation remains application-owned and must verify actual artifacts, their source freshness and assignment. No generic schema can certify editorial or business correctness.

Scheduling remains app-owned: use a stable key for each scheduled occurrence, an explicit timezone, bounded catch-up after wake and limits on resources/concurrency. Interactive work and background work use separate DSH sessions. Never restart shared DSH to cancel one job. No shared global GPU scheduler is claimed by this SDK.

## State and errors

The application owns canonical records, artifacts, provenance, source acknowledgments and connector caches. DSH owns conversation history. Augmentor memory is derived context. Memory, chat completion and dashboard status never independently prove a payment, public reply or external send.

Key error codes: `INVALID_MANIFEST`, `RUNTIME_UNAVAILABLE`, `INCOMPATIBLE_RUNTIME`, `INVALID_CALLER`, `INVALID_ARGUMENTS`, `PERMISSION_DENIED`, `NOT_CONNECTED`, `DISCONNECTED`, `UNKNOWN_OUTCOME`, `OPERATION_CONFLICT`, `STALE_ATTEMPT`, `RECONCILIATION_REQUIRED`, `BACKPRESSURE`. Operation IDs may be logged; credentials and private source content must not be. HTTP adapters preserve domain conflicts and limits in their structured errors.

Source deletion, retention and export require coordination across application caches, artifacts, DSH history, derived memory and backups. This preview does not supply a universal erase API. Uninstalling the SDK package must not delete those stores or other applications' profiles.
