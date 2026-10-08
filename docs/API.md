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
| `doctor [descriptor] [--harness dsh|codex] [--runtime-root installed-root]` | Reads selected runtime descriptor and SDK protocol/requested harness contract. `runningServicesVerified:false`: not a service, model, profile or voice check. |
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
| `discoverRuntime({descriptor?, runtimeRoot?, harness='dsh'} = {})` | Resolves the managed descriptor or installed bundle bootstrap and verifies the requested harness/platform contract. Descriptor and runtimeRoot are mutually exclusive. Defaults come from `runtimePaths()`. Does not establish running readiness. |
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
| `connect()` | Coalesces concurrent calls, negotiates workspace/requested harness/product, checks required capabilities and initializes the bridge. Resolves to client. No prompt is submitted. |
| `createSession(sessionId = randomUUID())` | Sends `session.create`; returns the product result object, not the session ID string. Generate/persist your own ID when you need it later. |
| `prompt({sessionId, operationId, text, context?})` | Nonempty text; stable persisted operation ID becomes product `requestId`. Queue acknowledgment is not task completion. |
| `listSessions()` | Product `session.list` result. A returned row's `running:false` is an observation; a missing row is not proof of non-execution. |
| `cancel(sessionId)` | Requests cancellation; confirm the owned session stopped before retrying work. |
| `call(method, params={})` | Advanced passthrough to supported, workspace-authorized product commands. Does not add methods or bypass policy. For history: `call('session.history', {sessionId})`. Returned events retain product shapes; see matching product code before consuming other commands/events. |
| `on('event', handler)` | Receives unsolicited product messages `{method, params, ...}`; not a normalized stream of tokens |
| `on('disconnected', handler)` | Connection lost; pending mutations may have unknown outcomes. Explicit `connect()` may reconnect; no request is replayed. |
| `close()` | Disposes this transport permanently; make a new client afterwards. Does not mean harness work has been cancelled. |

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
accepts `harness` (default dsh) and an installed Mac/Windows bundle `runtimeRoot`
alternative to descriptor. Linux uses its selected managed descriptor. It verifies
the requested adapter, not service/model readiness.
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
imports remain compatible. This additive section and alignment guide describe
source candidate behavior; the immutable preview 3 package has its own API guide.

`prompt({sessionId,operationId,text,context?})` and browser `setContext(context)`
accept JSON objects of at most 16,000 UTF-8 bytes and 64 nested levels. Invalid
context throws `INVALID_CONTEXT` before dispatch. `{}` clears selection. Codex
session/operation IDs use up to 128 letters, digits, underscores or hyphens;
the private connection ID uses the same pattern and is checked during planning;
the existing voice request namespace is also accepted for operation IDs.
Codex persists selection with the operation and rejects reuse of an ID with
changed text or context. Queueing, steering, promotion and reopening retain that
snapshot. DSH retains its existing latest-session selection behavior; inspect
`features['application-context'].binding` before depending on queue snapshots.
Context is evidence, never instructions or a grant. Tools must fetch current
records/revisions before a write. Low-level Codex branch-status requests must
include both the owning parent `sessionId` and intended child `newSessionId`.

## 0.2 additive API (0.2.0-preview.1 source)

Everything below is additive; the sections above keep their signatures. Full examples are
in [GUIDE.md](GUIDE.md); declarations are in `types/`.

### CLI

| Command | Effect |
| --- | --- |
| `init [dir] --template app` | Agent-native starter: `augmentor/app.mjs`, role, runtime `tools.mjs`, `server.mjs`, `page.mjs`; generates `augmentor.app.json` and `augmentor/tools.json` from the written definition |
| `manifest app.mjs [--out root]` | Imports the `defineApp()` module (default export or `app`) and writes the manifest and `tools.json` beside the manifest's tool module. Run from the app root |
| `check app.mjs` | Fails on stale manifest/descriptors or undeclared app tools named in instruction files; warns on product tools that are not granted and on risky declarations |
| `describe app.mjs [--format markdown\|llms]` | Generated reference or `llms.txt` |
| `bundle file.mjs` / `bundle --verify file.mjs` | Copy the single-file browser module with a sha256/version stamp; detect stale or edited copies |

### Declarations

- `defineApp({id, name, description?, harness?, instructions, tools, prompts?, modes?, uiActions?, resources?, grants?, voice?, ui = true, builtins = true, memory = false, routes?})` →
  `{manifest(), descriptors(), reference(), allTools(), prompts, resources, …}`. Tool names
  must start with `<id with _>_`. `grants` accepts product tool names or `GRANTS` keys
  (`memory`, `web`, `ask`, `browserObserve`, `todo`, `goals`, `plan`, `subagents`, `workflow`,
  `skills`). Built-ins: `<prefix>_reference`, `<prefix>_proposal_status`, `<prefix>_read_resource`
  (when resources exist), UI tools (when `ui`), preference tools (when `memory`).
- `defineTool({name, description, title?, input?, output?, effect = 'write', approval?, idempotent?, untrustedOutput?, summary?, preview?, subject?, undo?, limits?, timeoutMs?, examples?, tags?, ui?, hidden?, handler})`.
  `effect` ∈ `read | draft | write | external | destructive`; default approval: `external`
  and `destructive` always, others never. `approval` ∈ `'never' | 'always' | 'review' | (input, ctx) => boolean`.
  Handlers receive `(input, ctx)` with `ctx.services`, `sessionId`, `operationId`, `principal`,
  `signal`, `emit(type, data)` and `progress(fraction, message)`.
- `definePrompt({id, title, template, variables?, context?, run = 'either', session = 'current', mode?, model?, placement?, tags?})`, `defineMode({id, title, instructions})`.
- `defineUiAction({name, description, input?, effect = 'read' | 'draft', timeoutMs?})`.
- `defineResource({uri: 'app://kind/{id}', name, read(params, context), description?, mimeType?})`.

### Server

- `createAugmentorServer(app, {origin, authorizeOwner, runtimeTokenFile | authenticateRuntime, dataDir?, stores?, services?, policy?, client?, interactions?, proxy?, mcp?, automation?, basePath = '/api/augmentor', eventTypes?, allowedHosts?})` →
  `{node(req, res) → Promise<boolean>, upgrade(req, socket, head) → boolean, fetch(request) → Promise<Response | null>, start(), close(), toolkit, events, proposals, activity, operations, jobs, preferences, runner, automation, bridge, mcp}`.
  `authorizeOwner(request)` receives `{method, url, headers, raw}` and returns an owner ID,
  `true` or `false`.
- `createToolkit({tools, proposals?, activity?, events?, operations?, services?, policy?: {approval?, trust?}, appName?})` →
  `call(name, input, {sessionId, operationId?, callId?, principal?, signal?})`,
  `decide(id, {decision: 'approve' | 'edit' | 'reject', args?, note?, actor?})`, `executeProposal(id)`,
  `invoke(name, input)` (app-initiated, no approval), `list()`, `definitions()`, `fingerprint()`, `describe()`.
  An approval-gated call resolves to `{status: 'approval_required', proposalId, summary, message}`.
- `createToolEndpoint({toolkit, tokenFile | authenticate, allowedHosts?, maxBytes?})`, `createReviewEndpoint({toolkit, proposals, origin, authorize, path?})`,
  `createEventStream(hub, {authorize, types?, filter?, project?})`, `createUiBridge({authorize, origin, path?, actions?, timeoutMs?, events?, singleOwner = true})`,
  `createMcpServer({toolkit, prompts?, resources?, tokenFile | authenticate, name?, version?, instructions?})` — each `{node, fetch}`.
- `ProposalStore`, `ActivityLog` (`record`, `list`, `spans`), `EventHub` (`publish`, `subscribe`, `since`, `next`), `PreferenceStore` (`set`, `get`, `confirm`, `remove`, `list`, `observe`, `feedback`); `JobStore` gains `find(key)` and `list({state, keyPrefix})`.
- `AgentRunner({client, interactions = 'reject' | fn, events?, activity?, pollMs?, timeoutMs?})` → `run({text, context?, sessionId?, title?, model?, operationId?, mode?, attachments?, timeoutMs?, signal?, onEvent?, subject?})`
  resolving to `{sessionId, operationId, status, reason, text, toolCalls, interactions, durationMs}`.
- `AugmentorClient` gains `history`, `getSession`, `models`, `selectModel`, `rename`, `answerInteraction`, `prompt({mode: 'queue' | 'steer', attachments})` and emits notifications by method name (`session.event`, `session.status`, `approval.requested`, `question.requested`).
- `createAutomation({runner, jobs, events, prompts?, activity?, maxConcurrent = 1, leaseMs})` → `on(types, rule)`, `schedule(name, cron, rule)`, `watch(name, rule)`, `trigger(name, data)`, `start`, `stop`, `pause`, `resume`, `status`.
  Rules: `{prompt, vars?, context?, filter?, key?, batch?, quiet?, budget?, session?, expect?, title?, model?, timeoutMs?}`.
- `parseCron`, `nextRun`, `previousRun`, `inQuietHours`, `localDate` (five-field cron, IANA time zones).
- `createToolModule({pluginId, descriptors})` from `@augmentor/app-sdk/dsh`: the runtime module (`name`, `inject`, `apply`, `applicationTools`).

### Browser (`@augmentor/app-sdk/browser`, single file: `browser.bundle`)

- `mountAugmentor({..., allow?, theme?: {mode, accent, accentBrightness, neutral, neutralBrightness}, onEvent?, onReady?})` adds `ready`, `capabilities`, `supports(name)`, `prompt(text, {send, fresh, context})`, `newChat()`, `focus()` (v2 panel features; see [PANEL-PROTOCOL.md](PANEL-PROTOCOL.md)).
- `connectPage({endpoint?, actions?, describeView?, components?, onAction?, webmcp = true})` → `{pageId, updateView, disconnect}`.
- `renderAgentUi(spec, {onAction?, onSubmit?, components?})`, `showToast`, `showOverlay`, `highlight`, `lineDiff`.
- `mountReviewQueue(container, {endpoint?, eventsUrl?, state?, renderPreview?, labels?, onDecision?})`.
- `createAgent({endpoint?, panel?})` → `{prompts(), ask(id, vars, {run, mode, context}), run(runId)}`; `bindPromptButtons(root, agent, {onResult, onError})`; `subscribe(url, handler, {types})`.

### Testing (`@augmentor/app-sdk/testing`)

`createMockRuntime({profile?, harness?, tools?, script?, features?, models?})` → `{client(), sessions, close(), on('call' | 'event' | 'turn')}`;
`scriptedModel(steps)`; `checkToolkit(toolkit)`. Synthetic only: proves wiring, not model behaviour or a real runtime.

New error codes: `APPROVAL_UNAVAILABLE`, `RATE_LIMITED`, `CONFIGURATION_UNAVAILABLE`, `UI_UNAVAILABLE`, `UI_TIMEOUT`, `UNSUPPORTED_ACTION`, `INVALID_EVENT`, `INVALID_PROMPT`, `INVALID_SCHEDULE`, `INVALID_RESOURCE`, `CONFLICT`, `BUNDLE_UNSTAMPED`, `BUNDLE_MODIFIED`, `BUNDLE_STALE`.
