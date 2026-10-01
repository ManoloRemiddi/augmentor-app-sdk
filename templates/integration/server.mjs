// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
// Application-owned wiring. It never starts a server or registers a workspace.
import {readFileSync} from 'node:fs';
import {timingSafeEqual} from 'node:crypto';
import {createProxy} from '@augmentor/app-sdk';

const toolName = __TOOL_NAME_JSON__;
const toolPath = '/api/augmentor/tool';
const reply = (res, status, body) => {
  res.writeHead(status, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'});
  res.end(JSON.stringify(body));
};

export function createAppIntegration({origin, proxyTokenFile, appAgentTokenFile, authorizeOwner, readRecord,
  profile = __APP_ID_JSON__, socketPath, port}) {
  if (typeof authorizeOwner !== 'function' || typeof readRecord !== 'function') {
    throw Error('Supply the existing owner-session check and authoritative record reader');
  }
  const proxy = createProxy({profile, origin, tokenFile: proxyTokenFile,
    authorize: authorizeOwner, socketPath, port});
  return {
    // Returns false when the existing application router should handle the request.
    async http(req, res) {
      if (req.url?.startsWith('/augmentor/')) {await proxy.http(req, res); return true;}
      if (req.url !== toolPath) return false;
      const fail = (status, code, error) => {reply(res, status, {code, error}); return true;};
      try {
        if (req.headers.host !== new URL(origin).host ||
            (req.headers.origin && req.headers.origin !== origin) || req.headers['sec-fetch-site'] === 'cross-site') {
          return fail(403, 'PERMISSION_DENIED', 'Application origin required');
        }
        // Read on each request so replacing the private credential takes effect.
        const token = readFileSync(appAgentTokenFile, 'utf8').trim();
        if (token.length < 32 || /[\r\n]/.test(token)) throw Error('Invalid private token');
        const expected = Buffer.from('Bearer ' + token), supplied = Buffer.from(req.headers.authorization || '');
        if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
          return fail(401, 'PERMISSION_DENIED', 'Application agent credential required');
        }
        if (req.method !== 'POST') {res.setHeader('Allow', 'POST'); return fail(405, 'METHOD_NOT_ALLOWED', 'Use POST');}
        if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') {
          return fail(415, 'INVALID_REQUEST', 'Use application/json');
        }
        const chunks = []; let bytes = 0;
        for await (const chunk of req.iterator({destroyOnReturn: false})) {
          bytes += chunk.length;
          if (bytes > 16384) {req.resume(); return fail(413, 'REQUEST_TOO_LARGE', 'Tool input exceeds 16 KiB');}
          chunks.push(chunk);
        }
        let input;
        try {input = JSON.parse(Buffer.concat(chunks).toString('utf8'));}
        catch {return fail(400, 'INVALID_ARGUMENTS', 'Invalid JSON');}
        if (input?.name !== toolName) return fail(403, 'PERMISSION_DENIED', 'Tool is not granted by this application');
        const validId = value => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,160}$/.test(value);
        if (!validId(input.sessionId) || !validId(input.operationId) || input.eventId !== input.operationId ||
            !input.args || typeof input.args !== 'object' || Array.isArray(input.args) ||
            Object.keys(input.args).length !== 1 || typeof input.args.id !== 'string' ||
            !input.args.id.trim() || input.args.id.length > 160) {
          return fail(400, 'INVALID_ARGUMENTS', 'A record ID and valid operation envelope are required');
        }
        // Authentication identifies this trusted app adapter, not an end user.
        // The callback must apply this app's record-access rules. No model text is executed.
        const record = await readRecord(input.args.id);
        if (!record) return fail(404, 'NOT_FOUND', 'Record not found or unavailable');
        if (record.id !== input.args.id || !Number.isSafeInteger(record.version) || record.version < 0 ||
            typeof record.title !== 'string' || record.title.length > 4000) {
          return fail(500, 'INVALID_OUTPUT', 'Record reader did not provide a bounded, current record');
        }
        // Explicit projection: do not expose arbitrary database fields to the model.
        reply(res, 200, {id: record.id, version: record.version, title: record.title});
        return true;
      } catch {
        return fail(503, 'APPLICATION_UNAVAILABLE', 'Application reader or private configuration unavailable');
      }
    },
    upgrade(req, socket, head) {
      if (!req.url?.startsWith('/augmentor/')) return false;
      void proxy.upgrade(req, socket, head);
      return true;
    }
  };
}
