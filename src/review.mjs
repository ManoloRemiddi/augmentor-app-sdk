// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
// Owner-facing review queue ("agent inbox"): list proposals, approve, edit or reject.
// Same-origin JSON only; the owner check is the application's own session check.
import {check} from './errors.mjs';
import {adapt, json, failure, errorResponse, readJson, sameOrigin} from './http.mjs';

const ID = /^[0-9a-f-]{36}$/;

/** Public projection of a proposal for the owner's UI (no raw operation IDs). */
export function proposalView(p) {
  return {id: p.id, tool: p.tool, summary: p.summary, preview: p.preview, risk: p.risk, subject: p.subject, state: p.state,
    args: p.args, finalArgs: p.finalArgs, createdAt: p.createdAt, expiresAt: p.expiresAt, decidedAt: p.decidedAt, decidedBy: p.decidedBy,
    note: p.note, result: p.state === 'executed' ? p.result : undefined, error: p.error || undefined, session: p.session};
}

/**
 * @param toolkit    toolkit with a proposal store
 * @param proposals  ProposalStore
 * @param origin     the app's exact origin (CSRF boundary)
 * @param authorize  async (request) => owner identity string | true | false
 * @param path       mount path, e.g. '/api/augmentor/review'
 */
export function createReviewEndpoint({toolkit, proposals, origin, authorize, path = '/api/augmentor/review'} = {}) {
  check(toolkit && proposals && typeof authorize === 'function', 'INVALID_REQUEST', 'toolkit, proposals and authorize are required');
  check(new URL(origin).origin === origin, 'INVALID_ORIGIN', 'Exact application origin required');
  const base = path.replace(/\/$/, '');
  const handle = async request => {
    try {
      if (!sameOrigin(request, origin)) return failure(403, 'PERMISSION_DENIED', 'Same-origin request required');
      const who = await Promise.resolve().then(() => authorize(request)).catch(() => false);
      if (!who) return failure(403, 'PERMISSION_DENIED', 'Owner session required');
      const actor = typeof who === 'string' ? who : 'owner';
      const url = new URL(request.url, origin), rest = url.pathname.slice(base.length).split('/').filter(Boolean);
      if (request.method === 'GET' && rest.length === 0) {
        const state = url.searchParams.get('state') || 'pending';
        const list = proposals.list({state: state === 'all' ? undefined : state.split(','), limit: url.searchParams.get('limit') || 50, offset: url.searchParams.get('offset') || 0});
        return json(200, {items: list.map(proposalView)});
      }
      if (request.method === 'GET' && rest.length === 1 && ID.test(rest[0])) {
        const p = proposals.get(rest[0]); return p ? json(200, proposalView(p)) : failure(404, 'NOT_FOUND', 'Proposal not found');
      }
      if (request.method === 'POST' && rest.length === 2 && ID.test(rest[0]) && rest[1] === 'decision') {
        const body = await readJson(request, 64 * 1024);
        check(['approve', 'edit', 'reject'].includes(body?.decision), 'INVALID_REQUEST', 'decision must be approve, edit or reject');
        const result = await toolkit.decide(rest[0], {decision: body.decision, args: body.args, note: typeof body.note === 'string' ? body.note : undefined, actor});
        return json(200, proposalView(result));
      }
      return failure(404, 'NOT_FOUND', 'Unknown review route');
    } catch (error) {return errorResponse(error);}
  };
  return adapt(handle);
}
