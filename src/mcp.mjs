// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
// Expose the same application tools, resources and prompts as a Model Context Protocol
// server (Streamable HTTP, JSON responses). Experimental: implements the stable core of
// revisions 2025-06-18 and 2025-11-25 and the stateless `server/discover` of 2026-07-28.
// Approval, validation, idempotency and audit are the toolkit's, exactly as for Augmentor.
import {randomUUID} from 'node:crypto';
import {check, AugmentorError} from './errors.mjs';
import {adapt, readToken, bearerMatches, readJson} from './http.mjs';

export const MCP_VERSIONS = ['2026-07-28', '2025-11-25', '2025-06-18', '2025-03-26'];
const rpcError = (id, code, message, data) => ({status: 200, body: {jsonrpc: '2.0', id: id ?? null, error: {code, message, ...(data ? {data} : {})}}});
const rpcResult = (id, result) => ({status: 200, body: {jsonrpc: '2.0', id, result}});

/**
 * @param toolkit    createToolkit() result
 * @param prompts    optional prompt library
 * @param resources  optional resource registry from defineApp
 * @param tokenFile  bearer token for MCP clients, or `authenticate(request) => principal|null`
 */
export function createMcpServer({toolkit, prompts, resources, name = 'augmentor-app', title, version = '0.0.0', instructions, tokenFile, authenticate, maxBytes = 512 * 1024} = {}) {
  check(toolkit && (tokenFile || typeof authenticate === 'function'), 'INVALID_REQUEST', 'A toolkit and tokenFile or authenticate are required');
  const serverInfo = {name, title: title || name, version};
  const capabilities = {tools: {listChanged: false}, ...(resources?.list().length ? {resources: {listChanged: false, subscribe: false}} : {}), ...(prompts?.prompts.length ? {prompts: {listChanged: false}} : {})};
  const toolList = () => toolkit.list().map(t => ({name: t.name, title: t.title, description: t.description, inputSchema: t.inputSchema,
    ...(t.outputSchema ? {outputSchema: t.outputSchema} : {}), annotations: t.annotations, ...(t._meta ? {_meta: t._meta} : {})}));

  async function dispatch(message, principal) {
    const {id, method, params = {}} = message;
    const notification = id === undefined || id === null;
    if (typeof method !== 'string') return rpcError(id, -32600, 'Invalid request');
    if (notification) return {status: 202};
    try {
      switch (method) {
        case 'initialize': {
          const requested = params.protocolVersion;
          return rpcResult(id, {protocolVersion: MCP_VERSIONS.includes(requested) ? requested : MCP_VERSIONS[1], capabilities, serverInfo, ...(instructions ? {instructions} : {})});
        }
        case 'server/discover': return rpcResult(id, {supportedVersions: MCP_VERSIONS, capabilities, serverInfo, ...(instructions ? {instructions} : {})});
        case 'ping': return rpcResult(id, {});
        case 'tools/list': return rpcResult(id, {tools: toolList()});
        case 'tools/call': {
          if (typeof params.name !== 'string') return rpcError(id, -32602, 'Tool name required');
          const operationId = typeof params._meta?.['augmentor/operationId'] === 'string' ? params._meta['augmentor/operationId'] : randomUUID();
          try {
            const value = await toolkit.call(params.name, params.arguments ?? {}, {sessionId: 'mcp-' + (principal.id || 'client'), operationId, principal, callId: String(id)});
            return rpcResult(id, {content: [{type: 'text', text: JSON.stringify(value)}], structuredContent: value && typeof value === 'object' ? value : {value}, isError: false});
          } catch (error) {
            if (error instanceof AugmentorError && error.code === 'PERMISSION_DENIED') return rpcError(id, -32602, `Unknown tool: ${params.name}`);
            // Tool execution errors go back to the model so it can correct itself.
            return rpcResult(id, {content: [{type: 'text', text: JSON.stringify({code: error.code || 'APPLICATION_ERROR', error: error instanceof AugmentorError ? error.message : 'The tool failed', ...(error.details?.errors ? {errors: error.details.errors} : {})})}], isError: true});
          }
        }
        case 'resources/list': return rpcResult(id, {resources: resources ? resources.list() : []});
        case 'resources/templates/list': return rpcResult(id, {resourceTemplates: resources ? resources.templates() : []});
        case 'resources/read': {
          check(resources, 'NOT_FOUND', 'No resources');
          const contents = await resources.read(String(params.uri || ''), {principal});
          return rpcResult(id, {contents});
        }
        case 'prompts/list': return rpcResult(id, {prompts: prompts ? prompts.list().map(p => ({name: p.id, title: p.title, description: p.description,
          arguments: Object.entries(p.variables.properties || {}).map(([key, s]) => ({name: key, description: s.description || '', required: (p.variables.required || []).includes(key)}))})) : []});
        case 'prompts/get': {
          check(prompts, 'NOT_FOUND', 'No prompts');
          const rendered = prompts.render(String(params.name || ''), params.arguments || {});
          return rpcResult(id, {description: rendered.title, messages: [{role: 'user', content: {type: 'text', text: rendered.text}}]});
        }
        default: return rpcError(id, -32601, `Method not found: ${method}`);
      }
    } catch (error) {
      return rpcError(id, error.code === 'NOT_FOUND' ? -32602 : error.code === 'INVALID_ARGUMENTS' ? -32602 : -32603, error instanceof AugmentorError ? error.message : 'Internal error');
    }
  }

  const handle = async request => {
    if (request.method === 'GET') return {status: 405, headers: {Allow: 'POST'}, body: {error: 'This MCP server does not offer a server-initiated stream'}};
    if (request.method === 'DELETE') return {status: 405, headers: {Allow: 'POST'}};
    if (request.method !== 'POST') return {status: 405, headers: {Allow: 'POST'}};
    // Browsers must not drive this endpoint (DNS-rebinding and CSRF defence).
    if (request.headers.origin) return {status: 403, body: {jsonrpc: '2.0', id: null, error: {code: -32600, message: 'Browser origins are not accepted'}}};
    let principal;
    try {
      principal = authenticate ? await authenticate(request) : (bearerMatches(request.headers.authorization, readToken(tokenFile)) ? {id: 'owner', kind: 'owner'} : null);
    } catch {principal = null;}
    if (!principal) return {status: 401, headers: {'WWW-Authenticate': 'Bearer'}, body: {jsonrpc: '2.0', id: null, error: {code: -32001, message: 'Unauthorized'}}};
    let message;
    try {message = await readJson(request, maxBytes);} catch {return rpcError(null, -32700, 'Parse error');}
    if (Array.isArray(message)) return rpcError(null, -32600, 'Batching is not supported');
    if (!message || message.jsonrpc !== '2.0') return rpcError(message?.id, -32600, 'Invalid request');
    return dispatch(message, principal);
  };
  return {...adapt(handle), dispatch};
}
