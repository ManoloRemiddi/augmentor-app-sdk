<!-- Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0 -->
# Augmentor App SDK

This repository owns the application SDK, contracts, developer tools and integration tests. Augmentor's UI, native host, memory, execution policy and packaging remain in ManoloRemiddi/augmentor-agent. Never copy its UI or create a second agent loop here.

Read README.md and docs/HANDOFF.md. Check origin, branch and uncommitted changes before work. Update the owning contract with implementation changes. DSH is the only supported harness in this preview. Pi and Codex are out of scope. Voice is experimental, optional and disabled by default; cloud providers are deferred.

Use synthetic fixtures, isolated state and no external sends in tests. Preserve the two existing apps' data, session IDs, drafts and model settings. The owner will independently build the third reference app; do not build, inspect or arrange that test on their behalf. Fixtures and starter templates must be described as such, not independent adoption evidence.

Keep private app data, credentials, machine paths and installed configuration out of Git. The existing license permits private and commercial use; resale requires an agreement with the owner. Do not change those terms.
