<!-- Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0 -->
# Augmentor App SDK

This repository owns the application SDK, contracts, developer tools and integration tests. Augmentor's UI, native host, memory, execution policy and packaging remain in ManoloRemiddi/augmentor-agent. Never copy its UI or create a second agent loop here.

For integrating this SDK into an app, start with [docs/AGENT-INTEGRATION.md](docs/AGENT-INTEGRATION.md), then follow its reading order. No prior conversation or private reference-app code is required.

For SDK maintenance, read README.md and docs/HANDOFF.md. Run `npm ci --ignore-scripts`, `npm run check`, `npm test`, and `npm run test:package`; the last command verifies the packed artifact in a clean temporary consumer. Update the guides/templates and acceptance evidence together. Published package versions/tags are immutable; bump the preview for shipped code or template changes. Do not claim source or fixture changes redeploy existing applications. Check origin, branch and uncommitted changes before work. Update the owning contract with implementation changes. The released baseline is DSH/Linux. Preview 4 source adds experimental Codex and platform adapters; read docs/RUNTIME-ALIGNMENT.md before changing or claiming support. Pi remains out of scope. Run the paired product proof and hosted platform gates for adapter changes; never infer installed qualification from fixtures. Voice is experimental, optional and disabled by default; cloud providers are deferred.

Use synthetic fixtures, isolated state and no external sends in tests. Preserve the two existing apps' data, session IDs, drafts and model settings. The owner will independently build the third reference app; do not build, inspect or arrange that test on their behalf. Fixtures and starter templates must be described as such, not independent adoption evidence.

Keep private app data, credentials, machine paths and installed configuration out of Git. The existing license permits private and commercial use; resale requires an agreement with the owner. Do not change those terms.
