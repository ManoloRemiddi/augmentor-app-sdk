# Studio desk (synthetic SDK example)

A small creator CRM that shows every capability class of the SDK in one place. It is a
synthetic example: the data is invented and resets on restart, and it is not evidence that
any real deployment works.

```sh
node examples/studio-desk/server.mjs          # mock model, no Augmentor needed
node examples/studio-desk/server.mjs --runtime # use an installed Augmentor registered as studio-desk
```

Open the printed URL, then try:

- **Triage with agent**: a premade prompt runs in the background. The agent reads the email
  (marked as untrusted outside content), updates the deal with a version check, quotes from
  the rate card, opens and highlights the deal on your page, shows a card, and proposes a
  reply. The reply appears under *Waiting for you*; approving it sends it on the server.
- **Explain** on a deal card: a prompt with variables; the agent highlights the card.
- **Simulate new email**: publishes `mail.received`; the automation rule triages it as a
  durable, deduplicated job.
- *Agent activity* is the live change feed (Server-Sent Events) that replaces polling.

`app.mjs` is the whole agent surface in one declaration; `server.mjs` wires it with
`createAugmentorServer`; `public/page.js` uses the single-file browser bundle. In mock mode
a scripted model stands in for Augmentor and calls the app's real tool endpoint through the
same runtime module a real installation uses.
