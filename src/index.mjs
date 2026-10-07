// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
// 0.1 surface (unchanged signatures)
export {AugmentorClient} from './client.mjs';
export {createProxy} from './proxy.mjs';
export {validateManifest, validateApplication, workspaceProfile} from './manifest.mjs';
export {discoverRuntime} from './runtime.mjs';
export {runtimePaths} from './platform.mjs';
export {capabilityState, requireCapabilities} from './capabilities.mjs';
export {createApplicationTools, createToolClient} from './tools.mjs';
export {OperationStore} from './operations.mjs';
export {JobStore} from './jobs.mjs';
export {AugmentorError, SDK_PROTOCOL} from './errors.mjs';
// 0.2: one declaration, one server
export {defineApp, defineResource, createAugmentorServer, GRANTS, normalizeRequest} from './app.mjs';
export {defineTool, createToolkit, annotations, EFFECTS, UNTRUSTED_NOTE} from './toolkit.mjs';
export {createToolEndpoint} from './endpoint.mjs';
export {ProposalStore, PROPOSAL_STATES} from './approvals.mjs';
export {createReviewEndpoint, proposalView} from './review.mjs';
export {ActivityLog} from './activity.mjs';
export {EventHub, createEventStream, matchesType} from './events.mjs';
export {createUiBridge, defineUiAction, STANDARD_UI_ACTIONS} from './ui.mjs';
export {uiSpecSchema, UI_COMPONENTS, UI_TYPES} from './ui-spec.mjs';
export {definePrompt, defineMode, createPromptLibrary} from './prompts.mjs';
export {AgentRunner, refuseInteractions} from './agent.mjs';
export {createAutomation} from './automation.mjs';
export {parseCron, nextRun, previousRun, inQuietHours, localDate} from './cron.mjs';
export {createMcpServer, MCP_VERSIONS} from './mcp.mjs';
export {parameterSchema, compileSchema} from './schema.mjs';
export {toDshParameters} from './dsh-schema.mjs';
export {adapt, fromNode, fromFetch} from './http.mjs';
