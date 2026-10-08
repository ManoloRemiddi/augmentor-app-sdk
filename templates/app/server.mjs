// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
// Application-owned wiring. Call from your server; it never starts a server or registers a workspace.
import {createAugmentorServer, AugmentorClient} from '@augmentor/app-sdk';
import app from './app.mjs';

/**
 * @param origin           exact application origin (https://… or loopback)
 * @param authorizeOwner   your existing owner-session check: (request) => owner ID | false
 * @param records          your data layer: {read(id), update(args), share(args)}
 * @param runtimeTokenFile private token the Augmentor tool module presents (toolConfig.tokenFile)
 * @param proxyTokenFile   private token for the maintained panel proxy (registration tokenFile)
 * @param background       run premade prompts on the server when the open panel cannot take them
 *                         (and enable automation); needs the registered Augmentor runtime
 */
export function createAgentServer({origin, authorizeOwner, records, runtimeTokenFile, proxyTokenFile, dataDir, socketPath, port, background = true, profile = app.id}) {
  if (typeof authorizeOwner !== 'function' || !records) throw Error('Supply the existing owner-session check and your record service');
  return createAugmentorServer(app, {origin, authorizeOwner, runtimeTokenFile, dataDir, services: {records},
    proxy: proxyTokenFile ? {profile, tokenFile: proxyTokenFile, socketPath, port} : undefined,
    client: background ? new AugmentorClient({profile, harness: app.harness}) : undefined,
    automation: automation => {
      // Example (off until you uncomment it): a weekday morning review in the owner's time zone.
      // automation.schedule('daily_review', '30 8 * * 1-5', {prompt: 'daily_review', timeZone: 'Europe/London'});
    }});
}
