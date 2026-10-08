<!-- Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0 -->
# Augmentor App SDK

Make an application **agent-native** with the maintained Augmentor agent. Declare your
app's tools, premade prompts, UI actions and resources once; the agent can then read and
change your data, drive your pages, render rich results and run background work, while your
app hands it work through buttons, events and schedules. The owner stays in control through
server-enforced approvals, a review queue, preferences and an audit trail.

**`main` is 0.2.0-preview.1, used for new apps; the latest release archive is preview 3
(0.1 API).** 0.2 is verified with synthetic fixtures, a mock runtime, real Chromium, the real
DSH 0.1.5-rc.1 agent loop and a real DSH web host with the Augmentor integration installed
and the maintained panel open (`npm run test:installed`; deterministic model). It has not yet
been run with a real model or on a packaged desktop, and no release archive is published.
In-panel premade prompts need an Augmentor build that includes
[augmentor-agent#43](https://github.com/ManoloRemiddi/augmentor-agent/pull/43); older panels fall back to background runs.
The 0.1 API and protocol `augmentor-app/1` are unchanged, and no live application is
changed by this source. Requires Node 24.14+ and a compatible managed Augmentor runtime
exposing `augmentor-app/1`. This package does not include the Augmentor UI, model runtime,
Google credentials or another agent loop.

The target is a single owner installing trusted applications, on the same machine as
Augmentor or reached through a private network tunnel. This is not a sandbox for untrusted
JavaScript or a multi-tenant hosting system; hosted multi-user apps are a design in progress.
Pi remains outside scope; Codex is experimental. Voice is experimental, disabled by default
and independently switchable per workspace; cloud voice providers are deferred.

- **[Start here: agent integration guide](docs/AGENT-INTEGRATION.md)**: a self-contained workflow and a ready-to-use task for a coding agent.
- **[Make an app agent-native (0.2 guide)](docs/GUIDE.md)**: every capability class with code.
- [Migration from 0.1](docs/MIGRATION-0.2.md) and the [embedded panel protocol v2](docs/PANEL-PROTOCOL.md).
- [API reference](docs/API.md), [acceptance checklist](docs/ACCEPTANCE.md) and [troubleshooting](docs/TROUBLESHOOTING.md).
- [Quick start](docs/QUICKSTART.md): package, runtime, manifest, registration, tools and embed.
- [Connection contract](docs/CONTRACT.md): identities, permissions, errors, recovery and data ownership.
- [Security and trust](docs/SECURITY.md): enforced boundaries and limits.
- [Qualification and handoff](docs/HANDOFF.md): reproducible tests and remaining gates.
- [Readiness](docs/READINESS.md) and [exact qualification](docs/QUALIFICATION.md): feasibility, release evidence and rollout status.
- [Compatibility maintenance](docs/MAINTENANCE.md): keep SDK contracts, product adapters, settings and qualification aligned as Augmentor changes.
- In the repository only: [analysis](analysis/) (findings, research, capability catalogue, plan, app upgrade plans) and the runnable [studio-desk example](examples/studio-desk/README.md).

## What 0.2 adds

| Capability | API |
| --- | --- |
| One declaration → manifest, runtime descriptors, MCP, reference | `defineApp`, `defineTool`, `augmentor-app manifest/check/describe` |
| Tools with effect, approval policy, presenter, limits, idempotency, audit | `createToolkit`, `createToolEndpoint` |
| Proposals and the owner's review queue | `ProposalStore`, `createReviewEndpoint`, `mountReviewQueue` |
| Agent steers the page (navigate, open, highlight, prefill, notify, show, ask, view) | `createUiBridge`, `connectPage` |
| Trusted generative UI catalogue | `renderAgentUi`, `uiSpecSchema` |
| Premade prompts, modes and "Ask" buttons | `definePrompt`, `defineMode`, `createAgent`, `bindPromptButtons` |
| Headless runs that await the turn | `AgentRunner` |
| Event triggers, schedules (cron + time zone), watchers, kill switch | `createAutomation` |
| Change feed instead of polling | `EventHub`, `createEventStream`, `subscribe` |
| Preferences with provenance and decision feedback | `PreferenceStore`, `defineApp({memory: true})` |
| MCP server for other agent hosts | `createMcpServer` |
| One call for Node or fetch servers | `createAugmentorServer` |
| Mock runtime and scripted model | `@augmentor/app-sdk/testing` |
| Single-file browser module and TypeScript types | `dist/augmentor-browser.mjs`, `types/` |

## Install

**New apps:** build the 0.2 archive from `main` and keep it in the app's `vendor/` folder
(commands below, then `npm install --save-exact ./vendor/augmentor-app-sdk-0.2.0-preview.1.tgz`).
**0.1 API only:** download the archive and checksum from the
[preview 3 release](https://github.com/ManoloRemiddi/augmentor-app-sdk/releases/tag/v0.1.0-preview.3),
or check out `v0.1.0-preview.3` before building. The two live apps remain on preview 2
until they are migrated. The repository and release assets are public; no GitHub account is
needed. The preview 4 qualification in [runtime alignment](docs/RUNTIME-ALIGNMENT.md) applies
to its recorded commits. In either checkout, run:

```sh
npm ci --ignore-scripts
npm test
npm run test:package
npm pack
```

0.2 adds optional checks: `npm run test:browser` and `npm run test:example` (Chromium via
Playwright), `npm run check:types` (TypeScript), `npm run test:agent-loop -- <DSH install> <product
checkout>` (the real DSH agent loop on a product-installed workspace preset),
`npm run test:installed -- <built product> <python>` (real DSH web host, product installer,
maintained panel in Chromium), and `npm run build` to regenerate the
single-file browser bundle. Record the commit an archive was built from. The published
preview 3 archive and existing live apps remain unchanged. Installing a newer SDK alone
does not add product adapters to an older Augmentor installation.

Install the archive matching the checkout's package version in your application
using `npm install /absolute/path/to/the-package.tgz`. No public npm package is
claimed. For reproducible deployment, keep a reviewed package copy in your
application's `vendor/` directory and commit its lockfile and provenance. The
package contains the SDK, not another copy of Augmentor.

From your application directory after installing the package:

```sh
./node_modules/.bin/augmentor-app init . --id my-app --name 'My app'
./node_modules/.bin/augmentor-app validate augmentor.app.json
./node_modules/.bin/augmentor-app doctor
```

The default scaffold includes a read-only tool, authenticated backend wiring, maintained
panel mount and private-config example. `init --template app` scaffolds the 0.2
agent-native kit instead (definition, generated manifest and descriptors, server and page
wiring). Supply the application's real data layer and owner-session check, then follow the
[complete quick start](docs/QUICKSTART.md) and the [0.2 guide](docs/GUIDE.md).
`plan` previews registration without changing state. Doctor checks the selected
runtime contract; actual readiness requires the documented live checks.

## Ownership

Augmentor owns its maintained UI, DSH adapter, sessions, policy, workspace memory bindings and runtime release lifecycle. Your application owns its authenticated API, business rules, connectors, data, artifacts and completion validators, and decides what the agent may do. The SDK owns the integration contract and the reusable client, proxy, toolkit, approval, UI bridge, prompt, automation, change-feed and test helpers.

The framework-neutral browser module is `@augmentor/app-sdk/browser` (or the single file `@augmentor/app-sdk/browser.bundle`); server-side exports use Node. The optional stores use SQLite. Existing applications can retain their own durable stores when they enforce the same contract.

## License

The [existing Augmentor license](LICENSE) permits private and commercial use. Selling or reselling the software, including modified versions, requires prior written agreement with Manolo Remiddi. Dependencies retain their own licenses. Optional voice models and services have separate terms. This preview grants no additional resale rights.
