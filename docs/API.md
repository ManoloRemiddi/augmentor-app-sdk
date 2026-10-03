<!-- Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0 -->
# Preview API reference

ES modules, Node >=24.14.0. Only `@augmentor/app-sdk/browser` belongs in a browser
bundle. Import server helpers from `@augmentor/app-sdk`; import DSH tools from
`@augmentor/app-sdk/dsh`. SQLite helpers use Node's built-in `node:sqlite`.

## CLI

Use `./node_modules/.bin/augmentor-app` in the consumer app, or
`node bin/augmentor-app.mjs` in the SDK checkout. Avoid a bare `npx` that might try
to download an unrelated public package when the local package is missing.

| Command | Behavior |
| --- | --- |
| `--help` | Usage without state changes |
| `--version` | Installed SDK package version |
| `init [directory] --id app-id --name "App name"` | Writes manifest plus integration scaffold. Preflights every output; refuses collisions. Defaults remain `my-app` / `My app`; use an explicit unique ID. Does not install dependencies, credentials or runtime. |
| `validate manifest.json` | Schema, unique tool names/IDs, existing regular instruction/module files and symlink/path containment. Does not import modules or certify their exports/behavior. Paths are relative to the manifest's directory. |
| `validate manifest.json --schema-only` | Schema and uniqueness only; for manifests whose files are not yet staged |
| `doctor [descriptor] [--harness dsh|codex] [--runtime-root installed-root]` | Reads selected runtime descriptor and SDK protocol/DSH contract. `runningServicesVerified:false`: not a service, model, profile or voice check. |
| `plan manifest.json private-install.json` | Read-only profile derivation. Shows exact identity, origin, grants and memory binding; omits credentials/tool configuration. Does not run the installer, check active identities, validate credentials or start services. |
| `register manifest.json private-install.json` | Validates files/runtime, creates a private proxy credential if absent, delegates installation to the managed product. Does not restart services. |

Failures exit nonzero and print a code/message when available. Schema failures
include instance paths and the violated rule. Installation keys: `origin`
(required), `toolConfig`, `root`, `descriptor`, `id`, `preset`, `memory`,
`legacyPresets`, `tokenFile`, `connection`, `runtimeRoot`. Codex requires an
explicit existing connection ID. Descriptor/runtimeRoot are mutually exclusive. Unknown keys are rejected. `root` and `descriptor`,
when supplied, must be absolute. The default root is the manifest directory.
`toolConfig` keys must match declared plugin IDs and values must be objects;
their internal fields are application-owned, not certified by plan.

## Server exports

| Export | Contract |
| --- | --- |
| `validateManifest(value)` | Returns a cloned valid manifest; no file checks |
| `validateApplication(value, {root})` | Adds read-only existing-file and containment checks; returns the cloned manifest |
| `workspaceProfile(manifest, {root, origin, tokenFile, toolConfig?, id?, preset?, memory?, legacyPresets?})` | Pure profile construction with file checks; does not install. Exact HTTPS/loopback origin; absolute proxy token path. Default preset `augmentor-<id>`, memory person `app-<id>-owner`, project canonical cwd. |
| `discoverRuntime({descriptor?} = {})` | Resolves selected managed descriptor/contract. Default `$XDG_DATA_HOME/augmentor/desktop.json`, or `~/.local/share/augmentor/desktop.json`. Does not establish running readiness. |
| `createProxy({profile, origin, tokenFile, authorize, socketPath?, port=8872, path='/augmentor/'})` | Returns async `http(req,res)` / `upgrade(req,socket,head)`. Server-only. Owner callback may be async; it must return exactly `true`. Route only matching paths. HTTPS/owner access is host-owned. |
| `AugmentorError` | `Error` with `.code` and `.details`. Log only selected non-private details. |
| `SDK_PROTOCOL` | `augmentor-app/1` |

`createProxy` sends the server-held proxy token upstream, strips browser cookies
and Authorization, and enforces Host/Origin before owner authorization. WebSocket
upgrades require the exact Origin. `socketPath` addresses the NAS/private-tunnel
case and supersedes the loopback port. There is no automatic tunnel provisioner.

## Native client

```js
const client = new AugmentorClient({profile, descriptor, harness: 'dsh',
  requiredCapabilities: [], timeoutMs: 40000});
try {
  await client.connect();
  console.log(client.capabilities.protocol); // workspace.describe result
  const sessions = await client.listSessions();
  // Session rows are in sessions.items; do not infer stoppage from absence.
} finally {
  client.close();
}
```

| Member | Meaning |
| --- | --- |
| `connect()` | Coalesces concurrent calls, negotiates workspace/DSH/product and initializes the bridge. Resolves to client. No prompt is submitted. |
| `createSession(sessionId = randomUUID())` | Sends `session.create`; returns the product result object, not the session ID string. Generate/persist your own ID when you need it later. |
| `prompt({sessionId, operationId, text, context?})` | Nonempty text; stable persisted operation ID becomes product `requestId`. Queue acknowledgment is not task completion. |
| `listSessions()` | Product `session.list` result. A returned row's `running:false` is an observation; a missing row is not proof of non-execution. |
| `cancel(sessionId)` | Requests cancellation; confirm the owned session stopped before retrying work. |
| `call(method, params={})` | Advanced passthrough to supported, workspace-authorized product commands. Does not add methods or bypass policy. For history: `call('session.history', {sessionId})`. Returned events retain product shapes; see matching product code before consuming other commands/events. |
| `on('event', handler)` | Receives unsolicited product messages `{method, params, ...}`; not a normalized stream of tokens |
| `on('disconnected', handler)` | Connection lost; pending mutations may have unknown outcomes. Explicit `connect()` may reconnect; no request is replayed. |
| `close()` | Disposes this transport permanently; make a new client afterwards. Does not mean DSH work has been cancelled. |

Do not chain an untracked `randomUUID()` directly inside a prompt call. Persist
session ID, operation ID and prompt input **before** submission. On
`UNKNOWN_OUTCOME`, retain that identity and reconcile actual execution/artifacts.
Do not resubmit merely because the connection recovers. Separate interactive and
job sessions. The application decides completion by reading saved outputs.

## Tool adapter

`registerDshTools(ctx, {definitions, execute, defineTool?})` registers tuples:
`[name, description, parameters, outputSchema?]`. `parameters` maps field names to
DSH type descriptors (`required:true` marks a required argument). SDK validation
rejects extra top-level arguments and checks the optional output JSON Schema.
`execute(name, args, execution)` returns JSON-serializable data. An owning
`execution.agent.id` is required. `defineTool` injection is for fixtures; normally
the helper resolves it from DSH. The product owns native tool presentation.

`createToolClient({url, tokenFile, timeoutMs=25000, maxBytes=4194304, fetchImpl=fetch})`
returns that executor. Requires HTTPS or a loopback HTTP endpoint, refuses
redirects, combines the deadline and caller abort signal, and does not retry.
The app-agent token is read server-side per request. The POST JSON envelope is
`{name,args,sessionId,eventId,operationId}`. `eventId === operationId`, derived from
session/call/tool identity. A subsequent model tool call gets a different ID:
domain-level deduplication remains necessary for writes. A successful response
is JSON; errors should return non-2xx with `{code,error}`. The backend must check
its own authentication, current authority, inputs, revisions and source versions.

## Browser mount

`mountAugmentor({container, path='/augmentor/', title='Augmentor', onStatus?,
onNavigate?, onSettings?, onHide?})` returns `{frame, setContext, destroy}`.
The container must be a DOM Element with usable height. Path must be same-origin.
`setContext(object)` sends at most 16 KB of hints; tools must reread actual records.
Callbacks receive `{online,busy}`, a hash navigation string, or the validated
settings URL, respectively. Default settings behavior opens a tab. `destroy()`
removes the iframe/listener; it is not cancellation of a running agent task.

## Optional durable helpers

| Helper | Methods and limits |
| --- | --- |
| `new OperationStore(file)` | `reserve(scope,id,input)` records `unknown` before dispatch and returns `fresh`. `get(scope,id)` reads receipt. `settle(scope,id,'completed'|'rejected',result)` requires a previously unknown receipt. `execute(scope,id,input,action)` reuses confirmed completion, refuses rejected/unknown receipts, and leaves thrown actions unknown. `close()` releases DB. |
| `new JobStore(file)` | `enqueue(key,input)` deduplicates stable job key/input. `claim(id,session,{now?,leaseMs=60000}?)` returns attempt/session lease. `heartbeat(id,attempt,{now?,leaseMs?}?)` renews an owned unexpired lease. `interruptExpired(now?)` marks expired running attempts interrupted. `cancel(id)` changes queue state only. `finish(id,attempt,result,validate)` requires explicit completed/partial/failed status and async validator returning exactly true. `retry(id,{previousStopped:true})` permits a new claim; the caller must establish that assertion. `get(id)` / `close()` read/release. |

Create the database's private parent directory first. These helpers do not own
business transactions, scheduling, model cancellation or app tool write fencing.
App write endpoints must reject an attempt after cancellation/replacement/expiry
and validate assignment/source freshness in the same transaction as their writes.
`finish` may reconcile the same interrupted attempt; it cannot certify outputs.
SQLite receipts cannot guarantee exactly-once effects at an arbitrary external API.

## Preview 4 additive API

`runtimePaths({platform?, home?, env?})` returns config/data/state/profiles,
descriptor and installed runtimeRoot defaults. `discoverRuntime` additionally
accepts `harness` (default dsh) and an installed `runtimeRoot` alternative to
descriptor. It verifies the requested adapter, not service/model readiness.
`AugmentorClient` accepts these plus `requiredCapabilities`; its
`refreshCapabilities()` returns a newly negotiated snapshot without replay.
`capabilityState(description,name)` and `requireCapabilities(description,names)`
use the states described in [runtime alignment](RUNTIME-ALIGNMENT.md).

`createApplicationTools` and `createToolClient` are exported from the root and
`@augmentor/app-sdk/tools`. The former accepts the same tool tuples as
`registerDshTools`, returns `{tools,execute}`, validates declared schemas and
requires a string session identity. Execution accepts Codex `{sessionId,callId,
signal}` or DSH `{agent:{id},callId,signal}`. The latter preserves stable receipt
identity across these forms. `init --harness codex` adds the private connection
placeholder and exports the shared applicationTools adapter. Existing DSH
imports remain compatible. The older API table describes the released baseline;
this additive section and alignment guide own the source candidate behavior.
