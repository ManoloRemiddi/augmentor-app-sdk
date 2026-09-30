<!-- Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0 -->
# Integrate an application

## 1. Prepare a compatible runtime

Install the SDK tarball in your application, then run `npx augmentor-app doctor`. It inspects the managed runtime descriptor without starting or changing a model. The required product feature is documented in Augmentor's `docs/APP-SDK.md`. A runtime missing `services/workspaces/sdk.json` is incompatible; do not bypass this by importing its internal version files.

The product must have DSH configured, its normal Browser preset, the workspace installer, embedding service and existing memory companion. Its DSH tools runtime must provide the monotonic `guard()` API. Registering a profile does not restart shared DSH. The Linux embedding service uses loopback port 8872. This preview does not qualify native Windows/macOS SDK installation.

## 2. Describe your application

Run `npx augmentor-app init .` in a new application directory. The command refuses to overwrite existing files. Edit the generated manifest and role. This is a starter template, not a reference application.

```json
{
  "schemaVersion": 1,
  "id": "my-app",
  "name": "My app",
  "harness": "dsh",
  "instructions": ["agent-role.md"],
  "tools": [{"id":"my-app-tools","module":"tools.mjs","names":["my_app_read"]}],
  "permissions": {"tools": ["memory_recall"]},
  "voice": {"experimental": true, "enabled": false}
}
```

`permissions.tools` grants additional existing runtime tools by exact name. Your declared application tool names are added automatically. No wildcard or implicit shell/browser/delegation grant exists. Files must be relative paths resolving inside your application root. Source material is evidence, not authorization. Validate with `npx augmentor-app validate augmentor.app.json`.

## 3. Implement your tools

An installed tool plugin runs as trusted local code. Keep remote credentials in its server-side configuration, never in the manifest or browser.

```js
import {registerDshTools, createToolClient} from '@augmentor/app-sdk/dsh';
export const name = 'my-app-tools';
export const inject = ['tools'];
export async function apply(ctx, config) {
  await registerDshTools(ctx, {
    definitions: [[
      'my_app_read', 'Read one current application record.',
      {id: {type: 'string', required: true}},
      {type: 'object', required: ['id', 'version']}
    ]],
    execute: createToolClient({url: config.url, tokenFile: config.tokenFile})
  });
}
```

The SDK validates declared arguments and optional output schemas. Prefer explicit object/array schemas; `type: 'json'` exists for compatibility and leaves domain validation to your backend. The backend receives `{name,args,sessionId,eventId,operationId}` over an authenticated POST. Both operation fields identify the same DSH tool call. **A new model tool call has a new operation ID**: your backend must also preserve domain identities and deduplicate externally meaningful actions. Do not infer authority merely from `sessionId`; the server token identifies this trusted application adapter. This is not a multi-user identity protocol.

The backend must authenticate the agent token, validate the operation against its own rules, enforce current revisions and source versions, and produce a durable result. Keep owner-only endpoints separate. Saving a draft must not call a send endpoint. Expose only the data required for the requested operation.

## 4. Register private installation details

Create an ignored mode-0600 installation file containing `origin` and `toolConfig`:

```json
{
  "origin": "http://127.0.0.1:8000",
  "toolConfig": {
    "my-app-tools": {
      "url": "http://127.0.0.1:8000/api/agent/tool",
      "tokenFile": "/absolute/private/path/app-agent.token"
    }
  }
}
```

Your backend creates and validates the app-agent credential. It is different from the embedding proxy credential. Run `npx augmentor-app register augmentor.app.json /absolute/path/private-install.json`. Registration generates a private proxy token if needed and delegates preset composition to the selected product's transactional installer. No model settings, credentials or services are restarted.

Optional private fields: `root`, `descriptor`, `id`, `preset`, `memory`, `legacyPresets`, and `tokenFile`. Existing integrations must preserve their exact profile/preset/cwd/memory identities. The runtime rejects accidental identity changes and cross-workspace collisions. Profiles are machine-specific installation state; never commit them. A crash leaves a recovery instruction; use the selected product's `scripts/install-workspace-profile.mjs --recover` only after its installer has stopped.

## 5. Mount the maintained interface

On your backend, route `/augmentor/` HTTP requests and WebSocket upgrades through `createProxy`. Pass `profile`, the exact public `origin`, `tokenFile`, and an `authorize(req)` callback that checks your owner session. The callback must return exactly `true`. A private tunnel or local-only app may use its documented owner access policy instead. Remote network binding needs actual user authentication.

```js
import {createProxy} from '@augmentor/app-sdk';
const proxy = createProxy({profile:'my-app', origin, tokenFile, authorize: ownerSessionIsValid});
// Within your authenticated request router:
// proxy.http(req, res)
// Within its WebSocket upgrade router:
// proxy.upgrade(req, socket, head)
```

`socketPath` supports the private NAS deployment pattern; otherwise the upstream is loopback port 8872. Never expose its bearer token in URLs or JavaScript. Exact Host/Origin checks apply in addition to owner authorization.

Bundle `@augmentor/app-sdk/browser`, or serve that single browser module through your authenticated static router. Give the container a real height:

```js
import {mountAugmentor} from '@augmentor/app-sdk/browser';
const panel = mountAugmentor({container: document.querySelector('#agent'), onStatus, onNavigate});
panel.setContext({view:'records', recordId:'selected-id', version:3});
// On teardown: panel.destroy()
```

Context is a bounded hint, not trusted record contents or permission. Tools must reread authoritative state. `onSettings` may open the maintained settings page in your dialog; by default it opens a separate tab. No custom chat renderer is necessary.

## 6. Run background work

Use `AugmentorClient` to create a dedicated session and submit with a persisted operation ID. `call()` exposes supported product commands for existing adapters, while `prompt`, `createSession`, `listSessions`, and `cancel` cover common operations. Listen for `event` and `disconnected` without interpreting connection loss as task failure. Call `close()` when disposing the client. After an unexpected disconnect, `connect()` can create a new transport but never replays a request.

Use your existing durable queue, or optional `JobStore`. Persist a job, claim an attempt, heartbeat its lease, and give that exact attempt/session to application tools. Reject writes from cancelled, superseded or unrelated attempts. A stale lease becomes `interrupted`; it does not authorize a retry. `retry` requires the application to verify the old execution has stopped. `finish` requires an application validator that rereads saved outputs. Cancellation of a queue record and cancellation of DSH are separate operations; coordinate both and show uncertainty when DSH does not acknowledge.

`OperationStore` records an unknown receipt before a side effect. Identical retries return a confirmed result or require reconciliation. It cannot make an arbitrary remote service exactly-once. For atomic local record updates, retain revision checking and idempotency in your application database transaction.

## Experimental voice

Manifest voice is disabled by default. The maintained embedded Settings page offers a workspace-specific experimental toggle. Reopen the panel after changing it. It requires the existing Resonant Voice installation and uses that host's audio devices. It does not move models, install weights, change global voice configuration, or capture a remote client's microphone. Cloud voice is a future provider integration.
