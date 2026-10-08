<!-- Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0 -->
# Moving an integration from 0.1 to 0.2

**0.2.0-preview.1 is on `main` but has no release archive yet.** Installing it does not change any running
application, registered workspace or Augmentor installation. Live applications stay on their
pinned preview until their owner decides to move, through their own deployment procedure.

## What stays the same

- Protocol `augmentor-app/1`, manifest schema 1, registration (`plan`, `register`) and the
  workspace profile format.
- Every 0.1 export and signature: `AugmentorClient`, `createProxy`, `createApplicationTools`,
  `createToolClient`, `registerDshTools`, `OperationStore`, `JobStore`, `mountAugmentor`,
  manifest functions and the CLI's existing commands. The minimal `init` starter is unchanged.
- The tool HTTP envelope `{name, args, sessionId, eventId, operationId}`.

## What changes underneath (behaviour fixes)

| Change | Effect on 0.1 code |
| --- | --- |
| Nested `required` is enforced (B1) | Arguments missing nested required fields are now rejected before your code runs. Previously they reached the handler. |
| Parameters are compiled to the DSH descriptor DSL (B8) | Tools declaring `minLength`, `pattern`, `minimum` etc. now load in real DSH; those constraints are enforced by the SDK and described to the model. |
| Validation errors are compact `{path, message, missing?}` lists | Code reading raw AJV errors from `details.errors` must read the new shape. |
| `createToolClient`: missing token → `CONFIGURATION_UNAVAILABLE`; non-JSON error replies keep their status; empty successful replies return `null` | Error handling that matched `UNKNOWN_OUTCOME` for a missing token should match the new code. |
| Proxy refuses `..` and encoded dot segments; a throwing `authorize` gives 403 | Requests relying on dot segments are refused. |
| `AugmentorClient.call()` always returns a promise; non-object frames close the connection | `try { client.call() } catch` around synchronous throws is no longer needed. |
| `canonicalJSON` omits `undefined` members | Digests of inputs containing `undefined` change (they previously produced invalid JSON). |
| `OperationStore`/`JobStore` accept actions returning nothing | A receipt is now `completed` with `null` instead of stuck at `unknown`. |

## The single-file browser trap (F1)

Both live applications serve `@augmentor/app-sdk/browser` as one file. Since preview 3 that
module imports `./context.mjs`, so serving it alone breaks the panel mount after an upgrade.
In 0.2, serve **`dist/augmentor-browser.mjs`** (package export `@augmentor/app-sdk/browser.bundle`)
instead, or copy it with `augmentor-app bundle public/augmentor.mjs` and check copies later
with `augmentor-app bundle --verify`.

## Adopting 0.2 features gradually

Each step is independent and keeps existing behaviour:

1. **Bundle**: switch the browser module to the single-file bundle.
2. **Change feed**: create an `EventHub`, publish domain events, serve
   `createEventStream`, and replace polling with `subscribe`.
3. **Declarations**: move tools into `defineTool` with `effect`, and wrap them in
   `defineApp`. Keep the existing tool names to preserve conversations and grants. Generate
   `tools.json` and switch the runtime module to `createToolModule`.
4. **Server**: replace hand-written tool endpoints with `createAugmentorServer` (or
   `createToolEndpoint` alone). Keep your record versions; the SDK adds the operation-ID
   receipt in front of them.
5. **Approvals**: change irreversible tools to `effect: 'external'` and add the review queue,
   or keep them out of the tool set as today.
6. **UI control and prompts**: `connectPage` with your router; premade prompts and buttons.
7. **Background work**: replace custom job runners with `createAutomation` and `AgentRunner`
   (no more reading product files or polling `session.list`).

Re-register only when tool names or grants change, and use a new chat afterwards. DSH caches
modules; restart Augmentor through its supported lifecycle to load changed tool modules.
Preserve each application's data, session IDs, drafts and model settings throughout.
