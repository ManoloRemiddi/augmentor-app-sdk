// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
// Server side of the agent's tool calls. The DSH/Codex tool module (createToolClient)
// POSTs {name, args, sessionId, operationId}; this endpoint authenticates the runtime,
// validates the envelope and runs the toolkit. Works with Node and fetch servers.
import {check, AugmentorError, isId} from './errors.mjs';
import {adapt, json, errorResponse, readJson, readToken, bearerMatches} from './http.mjs';

const OPERATION = /^([a-f0-9]{64}|[A-Za-z0-9_.:-]{1,160})$/;

/**
 * @param toolkit       createToolkit() result
 * @param tokenFile     private file with the runtime's bearer token (single-owner apps)
 * @param authenticate  alternative: async (request) => principal | null (per-user tokens)
 * @param allowedHosts  optional Host header allow-list (the runtime calls from the server side)
 */
export function createToolEndpoint({toolkit, tokenFile, authenticate, allowedHosts, maxBytes = 256 * 1024, onError} = {}) {
  check(toolkit && typeof toolkit.call === 'function', 'INVALID_REQUEST', 'A toolkit is required');
  check(tokenFile || typeof authenticate === 'function', 'INVALID_REQUEST', 'Configure tokenFile or an authenticate callback');
  const handle = async request => {
    try {
      if (request.method !== 'POST') return {status: 405, headers: {Allow: 'POST'}, body: {code: 'METHOD_NOT_ALLOWED', error: 'Use POST'}};
      if (allowedHosts && !allowedHosts.includes(request.headers.host)) return json(403, {code: 'PERMISSION_DENIED', error: 'Unexpected host'});
      // Browsers never call this route; a cross-site browser request is refused outright.
      if (request.headers.origin || ['cross-site', 'same-site'].includes(request.headers['sec-fetch-site'])) return json(403, {code: 'PERMISSION_DENIED', error: 'Agent tool calls do not come from browsers'});
      let principal;
      if (authenticate) {
        principal = await authenticate(request);
        if (!principal) return json(401, {code: 'PERMISSION_DENIED', error: 'Runtime credential required'});
      } else {
        if (!bearerMatches(request.headers.authorization, readToken(tokenFile))) return json(401, {code: 'PERMISSION_DENIED', error: 'Runtime credential required'});
        principal = {id: 'owner', kind: 'owner'};
      }
      const envelope = await readJson(request, maxBytes);
      check(envelope && typeof envelope === 'object' && !Array.isArray(envelope), 'INVALID_REQUEST', 'Tool envelope must be an object');
      const {name, args = {}, sessionId, operationId, callId} = envelope;
      check(typeof name === 'string' && /^[A-Za-z][A-Za-z0-9_]{0,127}$/.test(name), 'INVALID_REQUEST', 'Tool name required');
      check(isId(sessionId), 'INVALID_CALLER', 'A valid agent session ID is required');
      check(operationId === undefined || OPERATION.test(operationId), 'INVALID_ID', 'Invalid operation ID');
      check(args && typeof args === 'object' && !Array.isArray(args), 'INVALID_ARGUMENTS', 'Tool arguments must be an object');
      const result = await toolkit.call(name, args, {sessionId, operationId, callId, principal, signal: request.signal});
      return json(200, result);
    } catch (error) {
      try {onError?.(error);} catch {}
      return errorResponse(error);
    }
  };
  return adapt(handle);
}

/** Map an endpoint error envelope back to an AugmentorError (used by in-process clients). */
export function envelopeError(body, status) {
  return new AugmentorError(typeof body?.code === 'string' ? body.code : 'APPLICATION_ERROR', typeof body?.error === 'string' ? body.error : 'Application request failed', {status, ...(body?.details ? {details: body.details} : {})});
}
