<!-- Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0 -->
# Augmentor App SDK

This repository owns the application SDK, contracts, developer tools and integration tests. Augmentor's UI, native host, memory, execution policy and packaging remain in ManoloRemiddi/augmentor-agent. Never copy its UI or create a second agent loop, in this SDK or in an app built with it.

## Building an app with this SDK

Any app may be built or connected with this SDK. Start with [docs/AGENT-INTEGRATION.md](docs/AGENT-INTEGRATION.md) and follow its reading order; no prior conversation or private app code is needed. New apps use the 0.2 kit on `main` (`augmentor-app init --template app`, [docs/GUIDE.md](docs/GUIDE.md)). Follow the target app's own instructions for its data, authentication and deployment. Keep its credentials, private data and machine paths out of Git, and report fixture or mock results as wiring evidence, not as a working live installation.

## Maintaining this SDK

Read README.md, docs/HANDOFF.md and docs/MAINTENANCE.md. Check origin, branch and uncommitted changes before work. Run `npm ci --ignore-scripts`, `npm run check`, `npm test` and `npm run test:package`; also `npm run check:types`, `npm run test:browser` and `npm run test:example` where TypeScript and Playwright are available, and `npm run build` after browser changes. Run the paired product proofs (`test:runtime`, `test:agent-loop`, `test:installed`) and the hosted platform gates for adapter changes; never infer installed qualification from fixtures. Update the owning contract, guides, templates and acceptance evidence with every implementation change. Published package versions and tags are immutable; bump the preview for shipped code or template changes, and do not claim source changes redeploy existing applications. Before changing Codex or platform adapters, read docs/RUNTIME-ALIGNMENT.md. Pi remains out of scope. Voice is experimental, optional and disabled by default; cloud providers are deferred.

Use synthetic fixtures, isolated state and no external sends in tests. Preserve the existing apps' data, session IDs, drafts and model settings. Describe fixtures and starter templates as such, not as independent adoption evidence.

Keep private app data, credentials, machine paths and installed configuration out of Git. The existing license permits private and commercial use; resale requires an agreement with the owner. Do not change those terms.
