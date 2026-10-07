// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
// Framework-neutral request handling. Each SDK endpoint is written once as
// `handle(request) -> {status, headers, body}` and adapted to Node or fetch.
import {readFileSync} from 'node:fs';
import {timingSafeEqual, createHash} from 'node:crypto';
import {AugmentorError} from './errors.mjs';

/** Normalised request: method, path, headers (lower-case), and a lazy bounded body reader. */
export function fromNode(req) {
  return {method: req.method, url: req.url || '/', headers: Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k.toLowerCase(), Array.isArray(v) ? v.join(', ') : v])),
    async text(limit) {
      const chunks = []; let bytes = 0;
      for await (const chunk of req) {bytes += chunk.length; if (bytes > limit) throw new AugmentorError('REQUEST_TOO_LARGE', `Request body exceeds ${limit} bytes`); chunks.push(chunk);}
      return Buffer.concat(chunks).toString('utf8');
    }, signal: undefined, raw: req};
}

export function fromFetch(request) {
  const url = new URL(request.url);
  return {method: request.method, url: url.pathname + url.search, headers: Object.fromEntries([...request.headers].map(([k, v]) => [k.toLowerCase(), v])),
    async text(limit) {
      if (!request.body) return '';
      const reader = request.body.getReader(), chunks = []; let bytes = 0;
      for (;;) {const {done, value} = await reader.read(); if (done) break; bytes += value.length;
        if (bytes > limit) {await reader.cancel(); throw new AugmentorError('REQUEST_TOO_LARGE', `Request body exceeds ${limit} bytes`);} chunks.push(value);}
      return Buffer.concat(chunks.map(c => Buffer.from(c))).toString('utf8');
    }, signal: request.signal, raw: request};
}

export function send(res, {status = 200, headers = {}, body}) {
  if (res.headersSent) {res.end(); return;}
  const json = body !== undefined && typeof body !== 'string' && !(body instanceof Uint8Array);
  res.writeHead(status, {'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...(json ? {'Content-Type': 'application/json; charset=utf-8'} : {}), ...headers});
  res.end(json ? JSON.stringify(body) : body);
}

export function toResponse({status = 200, headers = {}, body}) {
  const json = body !== undefined && typeof body !== 'string' && !(body instanceof Uint8Array);
  return new Response(body === undefined ? null : json ? JSON.stringify(body) : body,
    {status, headers: {'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...(json ? {'Content-Type': 'application/json; charset=utf-8'} : {}), ...headers}});
}

/** Wrap a core handler as both a Node `(req,res)` handler and a fetch `(Request) => Response` handler. */
export function adapt(handle) {
  return {
    handle,
    async node(req, res) {send(res, await handle(fromNode(req)));},
    async fetch(request) {return toResponse(await handle(fromFetch(request)));},
  };
}

export const json = (status, body, headers) => ({status, body, headers});
export const failure = (status, code, message, details) => json(status, {code, error: message, ...(details ? {details} : {})});

/** Error envelope used by every SDK endpoint: {code, error, details?}. */
export function errorResponse(error) {
  if (error instanceof AugmentorError || (error && typeof error.code === 'string' && error.name === 'AugmentorError')) {
    const status = {INVALID_ARGUMENTS: 400, INVALID_REQUEST: 400, INVALID_JSON: 400, PERMISSION_DENIED: 403, NOT_FOUND: 404,
      METHOD_NOT_ALLOWED: 405, CONFLICT: 409, OPERATION_CONFLICT: 409, VERSION_CONFLICT: 409, REQUEST_TOO_LARGE: 413,
      UNSUPPORTED_MEDIA_TYPE: 415, APPROVAL_REQUIRED: 202, RATE_LIMITED: 429, UNKNOWN_OUTCOME: 409, OPERATION_REJECTED: 409}[error.code] || 422;
    return failure(status, error.code, error.message, safeDetails(error.details));
  }
  return failure(500, 'APPLICATION_ERROR', 'The application could not complete the request');
}

function safeDetails(details) {
  if (!details || typeof details !== 'object') return undefined;
  try {const text = JSON.stringify(details); return text.length <= 8192 ? JSON.parse(text) : undefined;} catch {return undefined;}
}

/** Read a private token file on every call so rotation takes effect without restart. */
export function readToken(file) {
  let token;
  try {token = readFileSync(file, 'utf8').trim();} catch {throw new AugmentorError('CONFIGURATION_UNAVAILABLE', 'A private credential is unavailable');}
  if (token.length < 32 || /[\r\n\s]/.test(token)) throw new AugmentorError('CONFIGURATION_UNAVAILABLE', 'A private credential is invalid');
  return token;
}

/** Constant-time bearer check (hashing first equalises lengths). */
export function bearerMatches(header, token) {
  const supplied = createHash('sha256').update(String(header || '')).digest();
  const expected = createHash('sha256').update('Bearer ' + token).digest();
  return timingSafeEqual(supplied, expected);
}

export async function readJson(request, limit) {
  const type = (request.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (type !== 'application/json') throw new AugmentorError('UNSUPPORTED_MEDIA_TYPE', 'Use application/json');
  const text = await request.text(limit);
  try {return JSON.parse(text);} catch {throw new AugmentorError('INVALID_JSON', 'Request body is not valid JSON');}
}

/** Same-origin browser checks for routes the app's own pages call. */
export function sameOrigin(request, origin) {
  const host = new URL(origin).host;
  if (request.headers.host !== host) return false;
  if (request.headers.origin && request.headers.origin !== origin) return false;
  if (request.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(request.headers['sec-fetch-site'])) return false;
  return true;
}
