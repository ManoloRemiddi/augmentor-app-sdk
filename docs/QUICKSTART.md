<!-- Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0 -->
# Integrate an application

This guide preserves the published preview 3 DSH/Linux installation recipe.
For preview 4 source builds, explicit Codex selection or platform setup, first
read [runtime alignment](RUNTIME-ALIGNMENT.md). Its helpers require the paired
product candidate; installing the SDK alone does not update the product.

Read [the agent entry guide](AGENT-INTEGRATION.md) first. These steps use an
existing trusted single-owner Node application. The scaffold is integration code,
not a separate reference app. Replace example IDs/ports with the target app's
stable identity and actual origin. Preserve existing identities during migration.

> **0.2 source:** for the agent-native kit (approvals, UI control, prompts, automation,
> change feed), use `init --template app` and follow [GUIDE.md](GUIDE.md) alongside the
> steps below; registration, tokens and acceptance are the same.

## 1. Install the pinned public release

Requirements: Node >=24.14, an existing application
package.json and a compatible managed Augmentor runtime on a Linux model host.
From the target app directory, download the immutable preview release:

```sh
mkdir -p vendor
curl --fail --location --output vendor/augmentor-app-sdk-0.1.0-preview.3.tgz https://github.com/ManoloRemiddi/augmentor-app-sdk/releases/download/v0.1.0-preview.3/augmentor-app-sdk-0.1.0-preview.3.tgz
curl --fail --location --output vendor/augmentor-app-sdk-0.1.0-preview.3.sha256 https://github.com/ManoloRemiddi/augmentor-app-sdk/releases/download/v0.1.0-preview.3/augmentor-app-sdk-0.1.0-preview.3.sha256
(cd vendor && sha256sum --check augmentor-app-sdk-0.1.0-preview.3.sha256)
npm install --save-exact ./vendor/augmentor-app-sdk-0.1.0-preview.3.tgz
./node_modules/.bin/augmentor-app --help
```

Keep the archive, checksum, lockfile and release provenance in the application's
repository according to its source policy. Do not depend on an absolute
path into another developer's SDK checkout. If building SDK source instead, use
`npm ci --ignore-scripts`, `npm run check`, `npm test`, `npm run test:package`, then
`npm pack`. Never replace a published release's bytes with a different local build.

Preview 3 adds onboarding/validation/scaffolding; the two recorded live apps
remain on preview 2. It is not necessary to redeploy them for documentation work.

## 2. Check the selected runtime

```sh
./node_modules/.bin/augmentor-app doctor
```

Doctor reads the selected descriptor without starting/changing a model. It must
report `compatible:true`, `augmentor-app/1` and DSH. It does **not** establish
running service, profile, model or voice readiness. A stock old installation
missing `services/workspaces/sdk.json` is incompatible.

The product needs its configured DSH with the monotonic `guard()` API, normal
Browser preset, workspace installer, embedding service and memory companion.
See [product SDK setup](https://github.com/ManoloRemiddi/augmentor-agent/blob/main/docs/APP-SDK.md).
Registration and native clients run on that model host. The local embedding
upstream defaults to loopback port 8872. A backend on a private NAS also needs its
existing private tunnel/socket routing; the SDK does not provision a network or
runtime. When this prerequisite is absent, continue source/fixture work and report
live qualification as blocked. Do not alter the owner's model/harness setup.

## 3. Generate and adapt the integration

```sh
./node_modules/.bin/augmentor-app init . --id my-app --name 'My app'
./node_modules/.bin/augmentor-app validate augmentor.app.json
```

Init preflights all outputs and refuses to overwrite files. It generates:

| File | Application-owned responsibility |
| --- | --- |
| `augmentor.app.json` | Stable ID, DSH, role, exact tool names; no extra grants; voice off |
| `augmentor/agent-role.md` | Purpose, vocabulary, read-only tasks and source trust |
| `augmentor/tools.mjs` | DSH adapter: `my_app_read_record`, bounded ID input, record output schema |
| `augmentor/server.mjs` | Proxy HTTP/upgrade routing and separately authenticated tool endpoint |
| `augmentor/browser.mjs` | Maintained-panel mount through the app's frontend bundler |
| `augmentor/install.example.json` | Placeholder installation options, containing no credentials |
| `augmentor/.gitignore` | Excludes `private/` installation state |
| `augmentor/INTEGRATION.md` | Task list for the consuming agent/developer |

The starter tool reads `{id,version,title}` from your backend's `readRecord(id)`.
Supply that callback from the real authoritative data store and enforce its
record-access rules. It must return a current record or `null`, never fixture data
in a live deployment. Adapt the backend projection and output schema together.
The endpoint accepts only the declared read tool and bounded inputs. It strips
other record fields from the response. Extend it deliberately for domain tasks.

The role does not grant authority. `permissions.tools` adds existing runtime tools
by exact name; application tool names are included automatically. No wildcard or
implicit shell/browser/delegation grant exists. Files must remain inside the app
root, including symlink resolution. The CLI validates files without executing them.

## 4. Create private installation configuration

There are three separate authorities: the owner's browser session, the app-agent
backend token, and the proxy-to-Augmentor token. Do not reuse them.

For this scaffold, create an ignored directory and a fresh app-agent token. This
command refuses to overwrite an existing token:

```sh
mkdir -p augmentor/private
chmod 700 augmentor/private
node --input-type=module <<'JS'
import {writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
writeFileSync('augmentor/private/app-agent.token', randomBytes(32).toString('hex') + '\n', {mode:0o600, flag:'wx'});
JS
cp -n augmentor/install.example.json augmentor/private/install.json
chmod 600 augmentor/private/install.json
```

Edit that private JSON. Set `origin` to the exact public app origin, e.g.
`http://127.0.0.1:8000`, with no path or trailing slash. Set the tool URL to its
`/api/augmentor/tool` route. Replace both placeholder token paths with absolute
paths inside this app's `augmentor/private/`. The backend and DSH adapter must
resolve the app-agent credential to the same value. Register will create the
**different** proxy token at `tokenFile`; do not put either token in source or JS.

For NAS deployment, paths refer to the filesystem of the process reading them:
registration and DSH tool modules live on the model host, while the backend needs
its own private credential mounts and proxy tunnel. Equal token values may need
separately provisioned private paths. Do not assume a model-host absolute path
exists inside a container. See [API options](API.md) and the app's deployment guide.

Optional private keys: `root`, `descriptor`, `id`, `preset`, `memory`,
`legacyPresets`. `root`/`descriptor` must be absolute. Existing integrations must
preserve exact profile/preset/canonical cwd/memory identities and token references.
No secret belongs in `augmentor.app.json`.

## 5. Wire the backend and maintained UI

The generated helper does not start a server. In your existing backend, construct
it using the private installation options and the application's actual callbacks:

```js
import {createAppIntegration} from './augmentor/server.mjs';
const integration = createAppIntegration({
  profile: install.id ?? 'my-app',
  origin: install.origin,
  proxyTokenFile: install.tokenFile,
  appAgentTokenFile: install.toolConfig['my-app-tools'].tokenFile,
  authorizeOwner, // existing check of the owner's session; returns exactly true
  readRecord     // existing authoritative reader: id -> {id,version,title} or null
});
// In the existing Node HTTP handler, before consuming the body:
if (await integration.http(req, res)) return;
// Continue the application's existing routing.
// In its WebSocket upgrade handler:
if (integration.upgrade(req, socket, head)) return;
// Continue other known socket routes, or destroy unknown upgrades.
```

Here `install`, `authorizeOwner` and `readRecord` are your app's private config,
auth check and record reader, not SDK globals. If using Express or another
framework, route raw `/augmentor/` and `/api/augmentor/tool` requests before a body
parser consumes them; preserve the existing app router and server upgrade event.
Configure bounded HTTP request/header timeouts on the owning server. For a
private local-only app, use its documented owner access policy. Never use
`authorizeOwner: () => true` for a remotely reachable app.

`socketPath` optionally routes the proxy to an existing private Unix tunnel;
otherwise upstream is loopback 8872. Credentials stay server-side. The app-agent
POST envelope is `{name,args,sessionId,eventId,operationId}`; event and operation
IDs identify the same DSH tool call, not an owner login. A new model tool call has
a new operation ID, so writes also need stable domain identities and app-owned
idempotency/revision rules. The read-only starter sends nothing externally.

In the app's frontend, bundle `augmentor/browser.mjs` normally:

```html
<div id="agent" style="height: 600px"></div>
```

```js
import {mountAppAgent} from './augmentor/browser.mjs';
const panel = mountAppAgent(document.querySelector('#agent'), {
  onStatus: status => { /* reflect status.online / status.busy */ },
  onNavigate: hash => { /* handle the app's allowed navigation hashes */ }
});
panel.setContext({view: 'records', recordId: 'selected-id', version: 3});
// On component teardown: panel.destroy();
```

If there is no bundler, serve only the SDK's `src/browser.mjs` at an authenticated
same-origin static route and import `mountAugmentor` from that URL. Do not expose
all of node_modules. Context is a bounded hint; tools reread actual records.
Augmentor owns chat rendering/history. Default settings opens the maintained
settings page in a tab; `onSettings(url)` can use the app's own dialog.

## 6. Preview, register and test

```sh
./node_modules/.bin/augmentor-app validate augmentor.app.json
./node_modules/.bin/augmentor-app plan augmentor.app.json augmentor/private/install.json
./node_modules/.bin/augmentor-app register augmentor.app.json augmentor/private/install.json
```

Review the plan's exact grants, cwd, memory and origin before registration. Plan
writes nothing, omits private tool configuration, and does not check installed
collisions or running readiness. Registration delegates to the product's
transactional installer and does not restart services. If interrupted, follow
[recovery](TROUBLESHOOTING.md); do not run another installer against a live one.

Start/reload the app through its own normal deployment flow. Use **New chat** for
the complete SDK policy. Ask for a selected harmless record by ID and verify the
real backend/tool result. Run [acceptance](ACCEPTANCE.md), including auth denials,
workspace isolation, Stop and history after reload. Keep fixture versus live
results distinct. A prompt acknowledgment is not verified completion.

## Optional background work and voice

Use `AugmentorClient` for dedicated background sessions. Persist the session ID,
operation ID and input before dispatch. Unknown outcomes require reconciliation,
not resubmission. Your scheduler/database owns attempt fencing, current source
versions and saved-output validation. `OperationStore` and `JobStore` are optional
helpers; see their exact behavior in [API](API.md). Queue cancellation and DSH
cancellation are separate; verify prior stoppage before a retry.

The maintained Settings page provides a workspace-specific experimental voice
toggle. Reopen the panel after changing it. Resonant Voice must already exist;
it uses the host's devices, not a remote browser microphone. The SDK does not
install weights, move models or change global audio settings. Cloud voice is
deferred. Leave voice off for initial integration tests.
