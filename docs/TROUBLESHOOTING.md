<!-- Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0 -->
# Integration troubleshooting

Do not repair integration failures by expanding grants, disabling authentication,
changing model selection or restarting shared work. Start from the exact failure.

| Symptom | Inspect / next action |
| --- | --- |
| Repository/release download fails | The SDK repository and release assets are public. Check the exact repository/tag/asset URL and network response; GitHub authentication is unnecessary for downloads. No public npm package is provided. |
| CLI not found or `npx` asks to install a package | Install the reviewed archive in the target app; invoke `./node_modules/.bin/augmentor-app --help`. |
| `INVALID_MANIFEST` | Read the reported schema path. Use DSH, relative existing regular files inside the root, unique exact tool names, and explicit experimental voice settings. `--schema-only` does not qualify files. |
| `SCAFFOLD_CONFLICT` | Existing files were preserved. Read/adapt them or generate into a separate staging directory; do not delete user files to rerun init. |
| `RUNTIME_UNAVAILABLE` / `INCOMPATIBLE_RUNTIME` | Check the selected managed descriptor and `doctor`. A source checkout or an old stock runtime is insufficient. Follow the product's SDK/deployment guide; never invent a descriptor pointing at unqualified code. |
| Doctor passes but panel/client fails | Doctor only reads the selected descriptor. Verify the running embedding service, private tunnel if applicable, registered profile, DSH readiness and installed-versus-running versions. |
| Registration identity collision | Compare profile ID, preset, canonical cwd and memory with the existing installation. Preserve identity; do not delete old profiles/history or make a new memory identity to bypass migration errors. |
| Interrupted registration | Ensure the installer process has stopped, then use the selected product's `scripts/install-workspace-profile.mjs --recover`. Preserve its private journal/before-images. Never run recovery against an active installer. |
| HTTP/socket 403 | Compare exact scheme/host/port to registration and proxy origin; `localhost` and `127.0.0.1` differ. Check owner session, same-origin routing and WebSocket Origin. Do not put the proxy token in a URL. |
| Tool HTTP 401 | Confirm the adapter's app-agent token matches the backend credential. It is different from the proxy credential. Read privately; never print tokens. |
| Tool absent or denied | Compare manifest names with actual adapter registration and exact installed grants. Use a fresh chat after initial migration. Do not add broad runtime tools. |
| Duplicate native presentation error | Use SDK preview 2 or newer; the Augmentor preset owns presentation. Do not call `presentAs` again in your app plugin. |
| Tool module change appears ignored | DSH caches modules. A new chat alone does not guarantee changed module bytes reload. Coordinate the managed runtime lifecycle when idle; historical entry-only reload evidence is not a general hot-reload contract. |
| Empty panel or bare browser import fails | Give container a height; bundle `@augmentor/app-sdk/browser` or serve that one module at an authenticated same-origin route. Do not serve all of node_modules. |
| `INVALID_ARGUMENTS` / `INVALID_OUTPUT` | Align tool declaration and backend contract. A schema is not proof the saved business result is correct. |
| `UNKNOWN_OUTCOME`, timeout or disconnect | Keep the persisted operation identity. Inspect the owned session and authoritative artifacts/receipts before deciding the outcome. Reconnect does not permit replay. |
| Stop acknowledged but job still uncertain | Observe the exact owned session stopped and fence its attempt; absence from a bounded session list is insufficient. Queue cancellation alone does not cancel DSH. |
| Voice toggle exists but audio unavailable | It is experimental and uses installed Resonant Voice plus host audio devices. Remote browser microphones/cloud providers are not implemented by this preview. |

When reporting a problem, include SDK version, non-secret error code, protocol,
app/profile ID if shareable, tested source/running release, and a minimal synthetic
reproduction. Exclude credentials, private records, prompts and raw configuration.
