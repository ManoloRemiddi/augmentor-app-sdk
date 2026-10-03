<!-- Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0 -->
# Augmentor App SDK

Connect a trusted application to the maintained Augmentor agent. Embed its existing interface, provide an application role and tools, and use the same records from the UI and agent.

**0.1.0-preview.4 source candidate; latest published package: preview 3.**
[Runtime alignment](docs/RUNTIME-ALIGNMENT.md) adds capability discovery, an
experimental Codex app adapter and platform bootstrap/private-path support.
Customer platform/harness qualification and existing live deployments are
tracked separately. Requires Node 24.14+ and a compatible managed Augmentor runtime exposing `augmentor-app/1`. This package does not include the Augmentor UI, model runtime, Google credentials or another agent loop. A stock older Augmentor installation is not sufficient; `augmentor-app doctor` reports that explicitly.

The initial target is a single owner installing trusted applications on Linux, including an application backend reached through a private NAS tunnel. This is not a sandbox for untrusted JavaScript or a multi-tenant hosting system. Pi remains outside scope; Codex is experimental in the source candidate. Voice is experimental, disabled by default and independently switchable per workspace; cloud voice providers, including OpenAI, are deferred.

- **[Start here: agent integration guide](docs/AGENT-INTEGRATION.md)**: a self-contained workflow and a ready-to-use task for a coding agent.
- [API reference](docs/API.md), [acceptance checklist](docs/ACCEPTANCE.md) and [troubleshooting](docs/TROUBLESHOOTING.md).
- [Quick start](docs/QUICKSTART.md): package, runtime, manifest, registration, tools and embed.
- [Connection contract](docs/CONTRACT.md): identities, permissions, errors, recovery and data ownership.
- [Security and trust](docs/SECURITY.md): enforced boundaries and limits.
- [Qualification and handoff](docs/HANDOFF.md): reproducible tests and remaining gates.
- [Readiness](docs/READINESS.md) and [exact qualification](docs/QUALIFICATION.md): feasibility, release evidence and rollout status.

## Install

For new integrations, download the archive and checksum from the
[preview 3 release](https://github.com/ManoloRemiddi/augmentor-app-sdk/releases/tag/v0.1.0-preview.3).
The two qualified live apps remain on preview 2; this onboarding release does not
redeploy them. The repository and release assets are public; no GitHub account is needed to read
the source or download the SDK.
Use the current documentation on main for deployment notes. To build source
yourself, clone this public repository (check out
`v0.1.0-preview.3` to reproduce that release), then:

```sh
npm ci --ignore-scripts
npm test
npm run test:package
npm pack
```

Install the resulting `augmentor-app-sdk-0.1.0-preview.3.tgz` in your application using `npm install /absolute/path/to/the-package.tgz`. No public npm package is claimed. For reproducible deployment, keep a reviewed package copy in your application's `vendor/` directory and commit its lockfile and provenance. The package contains the SDK, not another copy of Augmentor.

From your application directory after installing the package:

```sh
./node_modules/.bin/augmentor-app init . --id my-app --name 'My app'
./node_modules/.bin/augmentor-app validate augmentor.app.json
./node_modules/.bin/augmentor-app doctor
```

The scaffold includes a read-only tool, authenticated backend wiring, maintained
panel mount and private-config example. Supply the application's real record
reader and owner-session check, then follow the [complete quick start](docs/QUICKSTART.md).
`plan` previews registration without changing state. Doctor checks the selected
runtime contract; actual readiness requires the documented live checks.

## Ownership

Augmentor owns its maintained UI, DSH adapter, sessions, policy, workspace memory bindings and runtime release lifecycle. Your application owns its authenticated API, business rules, connectors, data, artifacts, schedules and completion validators. The SDK owns the integration contract and reusable client, proxy, tool and job helpers.

The framework-neutral browser module is `@augmentor/app-sdk/browser`; server-side exports use Node. Optional `OperationStore` and `JobStore` helpers use SQLite. Existing applications can retain their own durable stores when they enforce the same contract.

## License

The [existing Augmentor license](LICENSE) permits private and commercial use. Selling or reselling the software, including modified versions, requires prior written agreement with Manolo Remiddi. Dependencies retain their own licenses. Optional voice models and services have separate terms. This preview grants no additional resale rights.
