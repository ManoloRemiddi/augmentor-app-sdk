<!-- Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0 -->
# Embedded panel protocol v2 (product contract)

**Status: implemented on both sides.** The SDK host side ships in 0.2.0-preview.1. The
product side was merged in [augmentor-agent#43](https://github.com/ManoloRemiddi/augmentor-agent/pull/43)
(`apps/browser/embed/entry.mjs`, `apps/browser/extension/host-commands.mjs`, `sidepanel.js`,
`docs/WORKSPACE-EMBEDDING.md`). `npm run test:installed` proves it against a real DSH web host.
An installed Augmentor advertises v2 only once its build includes that change; an older panel
advertises no v2 capability, so every feature below degrades to the v1 behaviour described in
each section. The panel side must not be emulated by scripting the panel's DOM or by a second
agent loop in the page.

## Negotiation

The panel's ready message gains an optional `capabilities` array:

```js
parent.postMessage({type: 'augmentor-ready', profile, capabilities: ['prompt', 'new-chat', 'events', 'status-session', 'focus']}, parentOrigin);
```

A v1 panel omits it; the host treats the list as empty. Each capability is independent. All
messages are exchanged only with the exact parent window and origin, as in v1, and every
payload is bounded (prompt text 16,000 characters; context 16 KB / 64 levels, the v1 limit).

## Host → panel

| Message | Capability | Fields | Panel behaviour |
| --- | --- | --- | --- |
| `augmentor-context` | v1 | `context` | Unchanged |
| `augmentor-prompt` | `prompt` | `requestId`, `text`, `send`, `fresh`, `context?` | If `fresh`, start a new conversation in the workspace. Apply `context` as the selection for this prompt. If `send`, submit as the owner's message through the panel's normal send path; otherwise place the text in the composer for the owner to edit and send. An unsent owner draft is never replaced (`BUSY`); while a DSH turn runs the prompt is refused with `BUSY` (the maintained panel queues only for Codex); an open past conversation is refused (`REFUSED`) unless `fresh`. Reply with `augmentor-result`. |
| `augmentor-new-chat` | `new-chat` | `requestId` | Open a new conversation; reply with `augmentor-result`. |
| `augmentor-focus` | `focus` | — | Focus the composer. |

A prompt from the host is the owner's message, sent from their authenticated page; it never
changes the workspace's tools, grants, preset or model.

## Panel → host

| Message | Capability | Fields | Meaning |
| --- | --- | --- | --- |
| `augmentor-ready` | v1 (+v2) | `profile`, `capabilities?` | Panel loaded |
| `augmentor-status` | v1 / `status-session` | `online`, `busy`, `sessionId?` | Connection and turn state; with `status-session` it includes the open conversation ID |
| `augmentor-result` | `prompt`, `new-chat` | `requestId`, `ok`, `result?`, `code?`, `error?` | Outcome of a host command (`code` e.g. `BUSY`, `REFUSED`) |
| `augmentor-event` | `events` | `event`, `data` | `turn.started`, `turn.finished` `{reason}`, `tool.completed` `{tool, isError}`, `session.changed` `{sessionId}` (each also carries `sessionId`; no tool arguments or results) |
| `augmentor-hide`, `augmentor-link`, `augmentor-settings` | v1 | as v1 | Unchanged |

`augmentor-event` carries notifications only. Application data changes are still announced by
the application's own change feed (`/api/augmentor/events`), which also covers background
runs and is the authoritative source for refreshing records.

## What works today without v2

| Need | Today (T1) |
| --- | --- |
| "Ask agent" buttons | `createAgent().ask()` runs the prompt in the background through the app server and returns a run ID; results arrive on the change feed |
| Agent drives the page | UI bridge (`connectPage`) through the app server — independent of the panel |
| Refresh after agent writes | Change feed (`subscribe`) |
| Approvals | Server proposals and the review queue in the app (`mountReviewQueue`) |
| Theming | `mountAugmentor({theme})` writes the workspace appearance preferences before load |
| Microphone/clipboard permissions | `mountAugmentor({allow})` sets the iframe `allow` before load |

## Related product work (not part of this protocol)

Recorded in [analysis/FINDINGS.md](../analysis/FINDINGS.md): approval and question cards
in the DSH panel (today `window.confirm`), sharing the interaction lease between the panel
and server-side runs (E12), following more than two sessions per connection (E12), MCP rows
in workspace presets, an event ingress route that starts sessions, voice authorisation for
workspace presets (E1) and excluding developer skills and `AGENTS.md` from workspace
sessions (E13).
