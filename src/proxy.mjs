// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
import http from 'node:http';
import {readFileSync} from 'node:fs';
import {check} from './errors.mjs';
const HOP = ['connection','upgrade','keep-alive','proxy-authenticate','proxy-authorization','te','trailer','transfer-encoding','authorization','cookie','forwarded','x-forwarded-host','x-forwarded-for','x-forwarded-proto'];
export function createProxy({profile, origin, tokenFile, authorize, socketPath, port = 8872, path = '/augmentor/'}) {
  check(/^[a-z][a-z0-9-]{0,63}$/.test(profile) && new URL(origin).origin === origin, 'INVALID_PROXY', 'Profile and exact origin required');
  check(typeof authorize === 'function', 'INVALID_PROXY', 'An owner authorization callback is required');
  check(/^\/[a-zA-Z0-9/_-]+\/$/.test(path), 'INVALID_PROXY', 'Invalid public proxy path');
  // Reject dot segments (raw or encoded) instead of relying on the upstream to normalise them.
  const traversal = url => {const p = url.split(/[?#]/)[0]; let d; try {d = decodeURIComponent(p);} catch {return true;}
    return /(^|\/)\.\.?(\/|$)/.test(p) || /(^|\/)\.\.?(\/|$)/.test(d) || d.includes('\\') || d.includes('\0');};
  const allowed = async req => {
    if (req.headers.host !== new URL(origin).host || !req.url?.startsWith(path) || traversal(req.url) || req.headers['sec-fetch-site'] === 'cross-site') return false;
    if (req.headers.origin && req.headers.origin !== origin) return false;
    try {return await authorize(req) === true;} catch {return false;}
  };
  const options = (req, upgrade = false) => {
    const token = readFileSync(tokenFile, 'utf8').trim();
    check(token.length >= 32 && !/[\r\n]/.test(token), 'INVALID_PROXY', 'Invalid proxy credential');
    const headers = {...req.headers};
    for (const name of [...HOP, ...(req.headers.connection || '').toLowerCase().split(',').map(s => s.trim())]) delete headers[name];
    headers.host = '127.0.0.1'; headers.authorization = 'Bearer ' + token;
    if (upgrade) {headers.connection = 'Upgrade'; headers.upgrade = 'websocket';}
    return {...(socketPath ? {socketPath} : {hostname: '127.0.0.1', port}),
      path: '/embed/' + profile + '/' + req.url.slice(path.length), method: req.method, headers};
  };
  const unavailable = res => {if (!res.headersSent) res.writeHead(503, {'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Retry-After':'5'}); res.end('<!doctype html><meta http-equiv="refresh" content="5"><title>Augmentor unavailable</title><p>Augmentor is reconnecting. Submitted work has not been replayed.</p>');};
  return {
    async http(req, res) {
      try {
        if (!await allowed(req)) {res.writeHead(403); res.end(); return;}
        const upstream = http.request(options(req), reply => {
          const headers = {...reply.headers}; delete headers['set-cookie'];
          // Streaming responses may be idle for long periods once headers arrive.
          upstream.setTimeout(0); res.writeHead(reply.statusCode, headers); reply.on('error', () => res.destroy()); reply.pipe(res);
        });
        upstream.setTimeout(15000, () => upstream.destroy()); upstream.on('error', () => unavailable(res));
        req.on('aborted', () => upstream.destroy()); res.on('close', () => upstream.destroy()); req.pipe(upstream);
      } catch {unavailable(res);}
    },
    async upgrade(req, socket, head) {
      socket.on('error', () => {});
      try {
        if (req.headers.origin !== origin || !await allowed(req)) {socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return;}
        const upstream = http.request(options(req, true));
        upstream.on('upgrade', (reply, remote, rest) => {
          upstream.setTimeout(0); remote.setTimeout(0);
          const headers = {...reply.headers}; delete headers['set-cookie'];
          socket.write('HTTP/1.1 101 Switching Protocols\r\n' + Object.entries(headers).map(([k,v]) => k + ': ' + v).join('\r\n') + '\r\n\r\n');
          if (rest.length) socket.write(rest); if (head.length) remote.write(head);
          socket.pipe(remote).pipe(socket); socket.on('error', () => remote.destroy()); remote.on('error', () => socket.destroy());
          socket.on('close', () => remote.destroy()); remote.on('close', () => socket.destroy());
        });
        upstream.on('response', reply => {reply.resume(); socket.end('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n');});
        upstream.on('error', () => socket.destroy()); upstream.setTimeout(10000, () => upstream.destroy());
        socket.on('close', () => upstream.destroy()); upstream.end();
      } catch {socket.destroy();}
    },
  };
}
