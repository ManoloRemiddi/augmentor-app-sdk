<!-- Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0 -->
# Augmentor App SDK

Connect a trusted application to the maintained Augmentor agent. Embed its existing interface, provide an application role and tools, and use the same records from the UI and agent.

**0.1.0 preview. DSH only.** Requires Node 24.14+ and a compatible managed Augmentor runtime exposing `augmentor-app/1`. This package does not include the Augmentor UI, model runtime, Google credentials or another agent loop. A stock older Augmentor installation is not sufficient; `augmentor-app doctor` reports that explicitly.

The initial target is a single owner installing trusted applications on Linux, including an application backend reached through a private NAS tunnel. This is not a sandbox for untrusted JavaScript or a multi-tenant hosting system. Pi and Codex support are outside this preview. Voice is experimental, disabled by default and independently switchable per workspace; cloud voice providers, including OpenAI, are deferred.

- [Quick start](docs/QUICKSTART.md): package, runtime, manifest, registration, tools and embed.
- [Connection contract](docs/CONTRACT.md): identities, permissions, errors, recovery and data ownership.
- [Security and trust](docs/SECURITY.md): enforced boundaries and limits.
- [Qualification and handoff](docs/HANDOFF.md): reproducible tests and remaining gates.

## Install

During the private preview, clone this repository using your authorized GitHub account and build the package:

```sh
npm ci --ignore-scripts
npm test
npm pack
```

Install the resulting `augmentor-app-sdk-0.1.0-preview.1.tgz` in your application using `npm install /absolute/path/to/the-package.tgz`. No public npm package is claimed. For reproducible deployment, keep a reviewed package copy in your application's `vendor/` directory and commit its lockfile and provenance. The package contains the SDK, not another copy of Augmentor.

```js
import {AugmentorClient} from '@augmentor/app-sdk';
const agent = new AugmentorClient({profile: 'my-app'});
await agent.connect();
const sessionId = crypto.randomUUID();
await agent.createSession(sessionId);
// Persist the operation ID BEFORE submission. Never repeat an unknown outcome.
await agent.prompt({sessionId, operationId: crypto.randomUUID(), text: 'Read the selected record.'});
```

The application must be registered first. Read the quick start for the complete sequence. A prompt acknowledgment means accepted submission, not verified task completion.

## Ownership

Augmentor owns its maintained UI, DSH adapter, sessions, policy, workspace memory bindings and runtime release lifecycle. Your application owns its authenticated API, business rules, connectors, data, artifacts, schedules and completion validators. The SDK owns the integration contract and reusable client, proxy, tool and job helpers.

The framework-neutral browser module is `@augmentor/app-sdk/browser`; server-side exports use Node. Optional `OperationStore` and `JobStore` helpers use SQLite. Existing applications can retain their own durable stores when they enforce the same contract.

## License

The [existing Augmentor license](LICENSE) permits private and commercial use. Selling or reselling the software, including modified versions, requires prior written agreement with Manolo Remiddi. Dependencies retain their own licenses. Optional voice models and services have separate terms. This preview grants no additional resale rights.
