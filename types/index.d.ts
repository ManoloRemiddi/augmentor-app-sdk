// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
// Type declarations for @augmentor/app-sdk (server side, Node 24.14+).
import type {EventEmitter} from 'node:events';
import type {IncomingMessage, ServerResponse} from 'node:http';
import type {Duplex} from 'node:stream';

export type JsonSchema = Record<string, unknown>;
export type Json = null | boolean | number | string | Json[] | {[key: string]: Json};

export declare const SDK_PROTOCOL: 'augmentor-app/1';
export declare class AugmentorError extends Error {
  constructor(code: string, message: string, details?: Record<string, unknown>);
  readonly code: string;
  readonly details: Record<string, unknown>;
}

/** Normalised request passed to every SDK authorise callback. */
export interface SdkRequest {method: string; url: string; headers: Record<string, string | undefined>; raw: unknown; signal?: AbortSignal; text(limit: number): Promise<string>}
export type AuthorizeOwner = (request: SdkRequest) => boolean | string | Promise<boolean | string>;
export interface Principal {id: string; kind: 'owner' | 'user' | 'app' | string; [key: string]: unknown}

// ---------- tools ----------
export type Effect = 'read' | 'draft' | 'write' | 'external' | 'destructive';
export type ApprovalPolicy<I = any> = 'never' | 'always' | 'review' | ((input: I, ctx: ToolContext) => boolean | Promise<boolean>);
export interface ToolContext {
  tool: string; sessionId: string; callId?: string; operationId?: string; principal?: Principal; signal?: AbortSignal;
  services: Record<string, any>; toolkit: Toolkit; approved?: {proposalId: string; actor: string};
  emit(type: string, data?: Json, options?: {subject?: string}): unknown;
  progress(fraction: number, message?: string): unknown;
}
export interface ToolSpec<I = any, O = any> {
  name: string; title?: string; description: string;
  input?: JsonSchema; output?: JsonSchema; effect?: Effect; approval?: ApprovalPolicy<I>; idempotent?: boolean; untrustedOutput?: boolean;
  summary?(input: I, ctx: ToolContext): string | Promise<string>;
  preview?(input: I, ctx: ToolContext): UiSpec | Json | Promise<UiSpec | Json>;
  subject?(input: I, result?: O): string | undefined;
  undo?(input: I, result: O, ctx: ToolContext): unknown;
  limits?: {perMinute?: number; scope?: 'session' | 'global'}; timeoutMs?: number; examples?: {input: I; note?: string}[]; tags?: string[];
  ui?: {resourceUri?: string; [key: string]: unknown}; hidden?: boolean;
  handler(input: I, ctx: ToolContext): O | Promise<O>;
}
export interface ToolDefinition extends Readonly<Omit<ToolSpec, 'input' | 'output'>> {kind: 'tool'; inputSchema: JsonSchema; outputSchema: JsonSchema | null}
export declare function defineTool<I = any, O = any>(spec: ToolSpec<I, O>): ToolDefinition;
export declare const EFFECTS: Effect[];
export declare const UNTRUSTED_NOTE: string;
export interface ToolAnnotations {title: string; readOnlyHint: boolean; destructiveHint: boolean; idempotentHint: boolean; openWorldHint: boolean}
export declare function annotations(tool: ToolDefinition): ToolAnnotations;
export interface ToolDescriptor {name: string; title: string; description: string; inputSchema: JsonSchema; outputSchema?: JsonSchema; annotations: ToolAnnotations; effect: Effect; approval: 'never' | 'always' | 'conditional'}
export interface ApprovalReceipt {status: 'approval_required' | ProposalState; proposalId: string; summary: string; message: string; result?: Json}
export interface Toolkit {
  readonly tools: ToolDefinition[];
  get(name: string): ToolDefinition | undefined; has(name: string): boolean; add(tool: ToolDefinition): Toolkit;
  list(options?: {includeHidden?: boolean}): ToolDescriptor[];
  definitions(): [string, string, JsonSchema, JsonSchema?][]; names(): string[]; fingerprint(): string;
  call(name: string, input: any, context: {sessionId: string; operationId?: string; callId?: string; principal?: Principal; signal?: AbortSignal}): Promise<any>;
  decide(id: string, decision: {decision: 'approve' | 'edit' | 'reject'; args?: any; note?: string; actor?: string; execute?: boolean}): Promise<Proposal>;
  executeProposal(id: string, options?: {actor?: string}): Promise<Proposal>;
  invoke(name: string, input: any, context?: Partial<ToolContext>): Promise<any>;
  describe(options?: {heading?: string}): string;
}
export declare function createToolkit(options?: {tools?: ToolDefinition[]; policy?: {approval?: Partial<Record<Effect, 'never' | 'always' | 'review'>>; trust?: Record<string, {autoApproveAfter: number}>};
  operations?: OperationStore; proposals?: ProposalStore; activity?: ActivityLog; events?: EventHub; services?: Record<string, any>; appName?: string}): Toolkit;

// ---------- HTTP handlers ----------
export interface Handler {node(req: IncomingMessage, res: ServerResponse): Promise<void>; fetch(request: Request): Promise<Response>}
export declare function createToolEndpoint(options: {toolkit: Toolkit; tokenFile?: string; authenticate?(request: SdkRequest): Principal | null | Promise<Principal | null>; allowedHosts?: string[]; maxBytes?: number; onError?(error: unknown): void}): Handler;
export declare function createReviewEndpoint(options: {toolkit: Toolkit; proposals: ProposalStore; origin: string; authorize: AuthorizeOwner; path?: string}): Handler;
export declare function proposalView(proposal: Proposal): Record<string, unknown>;
export declare function adapt(handle: (request: SdkRequest) => Promise<{status?: number; headers?: Record<string, string>; body?: unknown}>): Handler & {handle: Function};
export declare function fromNode(req: IncomingMessage): SdkRequest;
export declare function fromFetch(request: Request): SdkRequest;

// ---------- stores ----------
export type ProposalState = 'pending' | 'approved' | 'rejected' | 'expired' | 'executing' | 'executed' | 'failed' | 'withdrawn';
export declare const PROPOSAL_STATES: ProposalState[];
export interface Proposal {id: string; operationId: string; tool: string; args: any; session: string | null; summary: string; preview: any; risk: string; subject: string | null;
  state: ProposalState; createdAt: number; expiresAt: number; decidedAt: number | null; decidedBy: string | null; note: string | null; finalArgs: any; result: any; error: any; fresh?: boolean}
export declare class ProposalStore {
  constructor(file?: string, options?: {now?: () => number});
  get(id: string): Proposal | null; byOperation(operationId: string): Proposal | null;
  create(options: {tool: string; args: any; operationId: string; session?: string; summary?: string; preview?: any; risk?: string; subject?: string; ttlMs?: number}): Proposal;
  list(options?: {state?: ProposalState | ProposalState[]; session?: string; tool?: string; subject?: string; limit?: number; offset?: number}): Proposal[];
  expire(): number; decide(id: string, options: {decision: 'approve' | 'edit' | 'reject'; args?: any; note?: string; actor?: string}): Proposal;
  claim(id: string): Proposal; settle(id: string, outcome: {result?: any; error?: any}): Proposal; withdraw(id: string): Proposal; close(): void;
}
export interface ActivityEntry {id: string; time: string; kind: string; actor: string; session: string | null; subject: string | null; summary: string; status: string; operationId: string | null; digest: string | null; data: any; durationMs: number | null}
export declare class ActivityLog {
  constructor(file?: string, options?: {now?: () => Date});
  record(entry: {kind: string; actor?: string; session?: string; subject?: string; summary?: string; status?: string; operationId?: string; input?: unknown; data?: Json; durationMs?: number}): ActivityEntry;
  list(options?: {kind?: string; session?: string; subject?: string; since?: string | Date; status?: string; limit?: number; offset?: number}): ActivityEntry[];
  spans(options?: object): {name: string; startTime: string; durationMs: number | null; status: 'OK' | 'ERROR'; attributes: Record<string, unknown>}[];
  close(): void;
}
export declare class OperationStore {
  constructor(file: string);
  get(scope: string, id: string): {scope: string; id: string; digest: string; state: 'unknown' | 'completed' | 'rejected'; result: any; updated_at: string} | null;
  reserve(scope: string, id: string, input: unknown): any; settle(scope: string, id: string, state: 'completed' | 'rejected', result?: unknown): any;
  execute<T>(scope: string, id: string, input: unknown, action: () => T | Promise<T>): Promise<T>; close(): void;
}
export interface Job {id: string; job_key: string; input: any; state: 'queued' | 'running' | 'interrupted' | 'completed' | 'partial' | 'failed' | 'cancelled'; attempt: string | null; session: string | null; lease_until: number; result: any}
export declare class JobStore {
  constructor(file: string);
  get(id: string): Job | null; find(key: string): Job | null; list(options?: {state?: Job['state'] | Job['state'][]; keyPrefix?: string; limit?: number; offset?: number}): Job[];
  enqueue(key: string, input: unknown): Job; claim(id: string, session: string, options?: {now?: number; leaseMs?: number}): Job;
  heartbeat(id: string, attempt: string, options?: {now?: number; leaseMs?: number}): void; interruptExpired(now?: number): number; cancel(id: string): Job;
  finish(id: string, attempt: string, result: {status: 'completed' | 'partial' | 'failed'; [key: string]: unknown}, validate: (result: any, job: Job) => boolean | Promise<boolean>): Promise<Job>;
  retry(id: string, options?: {previousStopped?: boolean}): Job; close(): void;
}
export interface Preference {scope: string; key: string; value: Json; source: 'owner' | 'app' | 'agent'; confirmed: boolean; evidence: any; updatedAt: string; ignored?: boolean}
export declare class PreferenceStore {
  constructor(file?: string, options?: {now?: () => Date});
  set(scope: string, key: string, value: Json, options?: {source?: 'owner' | 'app' | 'agent'; evidence?: Json}): Preference;
  get(scope: string, key: string): Preference | null; confirm(scope: string, key: string): Preference; remove(scope: string, key: string): boolean;
  list(options?: {scope?: string; confirmed?: boolean}): Preference[];
  observe(decision: {tool: string; decision: string; note?: string; subject?: string; args?: any; finalArgs?: any}): void;
  feedback(options?: {tool?: string; limit?: number; offset?: number}): {time: string; tool: string; decision: string; note: string | null; subject: string | null; changed: string[]}[];
  close(): void;
}
export declare function preferenceTools(store: PreferenceStore, options: {prefix: string}): ToolDefinition[];

// ---------- events ----------
export interface AppEvent<D = any> {id: string; seq: number; type: string; time: string; source: string; subject?: string; actor?: string; data: D}
export declare class EventHub {
  constructor(options?: {history?: number; now?: () => Date});
  publish<D = Json>(type: string, data?: D, options?: {source?: string; subject?: string; actor?: string}): AppEvent<D>;
  subscribe(types: string | string[], listener: (event: AppEvent) => unknown, options?: {onError?(error: unknown): void}): () => void;
  since(seq?: number, types?: string[]): AppEvent[];
  next(types: string | string[], options?: {timeoutMs?: number; signal?: AbortSignal; filter?(event: AppEvent): boolean}): Promise<AppEvent>;
}
export declare function matchesType(pattern: string, type: string): boolean;
export declare function createEventStream(hub: EventHub, options: {authorize: AuthorizeOwner; types?: string[]; filter?(event: AppEvent): boolean; heartbeatMs?: number; project?(event: AppEvent): unknown}): Handler;

// ---------- UI ----------
export type UiSpec = {type: 'text' | 'card' | 'table' | 'list' | 'checklist' | 'diff' | 'chart' | 'form' | 'choice' | 'receipt' | 'custom' | 'stack'; [key: string]: unknown};
export declare function uiSpecSchema(): JsonSchema;
export declare const UI_COMPONENTS: Record<string, {properties: Record<string, JsonSchema>; required: string[]}>;
export declare const UI_TYPES: string[];
export interface UiAction {kind: 'ui-action'; name: string; description: string; input: JsonSchema; effect: 'read' | 'draft'; timeoutMs?: number}
export declare function defineUiAction(spec: {name: string; description: string; input?: JsonSchema; effect?: 'read' | 'draft'; timeoutMs?: number}): UiAction;
export declare const STANDARD_UI_ACTIONS: UiAction[];
export interface UiBridge extends Handler {
  command(action: string, args?: Record<string, unknown>, options?: {principal?: string; pageId?: string; timeout?: number}): Promise<any>;
  tools(options: {prefix: string}): ToolDefinition[];
  stream(req: IncomingMessage, res: ServerResponse): Promise<void>; streamFetch(request: Request): Promise<Response>;
  pages(principal?: string): {id: string; focused: boolean; view: any}[]; actions(): string[];
}
export declare function createUiBridge(options: {authorize: AuthorizeOwner; origin: string; path?: string; actions?: UiAction[]; timeoutMs?: number; heartbeatMs?: number; events?: EventHub; singleOwner?: boolean}): UiBridge;

// ---------- prompts ----------
export interface PromptDefinition {kind: 'prompt'; id: string; title: string; description: string; template: string; variables: JsonSchema; run: 'panel' | 'background' | 'either'; session: 'new' | 'current'; mode?: string; model?: Json; placement: string[]; tags: string[]}
export declare function definePrompt(spec: {id: string; title: string; description?: string; template: string; variables?: JsonSchema; context?(vars: any): Record<string, Json>;
  run?: 'panel' | 'background' | 'either'; session?: 'new' | 'current'; mode?: string; model?: Json; placement?: string[]; tags?: string[]}): PromptDefinition;
export declare function defineMode(spec: {id: string; title: string; instructions: string}): {kind: 'mode'; id: string; title: string; instructions: string};
export interface RenderedPrompt {id: string; text: string; title: string; run: string; session: string; model?: Json; context?: Record<string, Json>}
export interface PromptLibrary {prompts: PromptDefinition[]; modes: {id: string; title: string}[]; get(id: string): PromptDefinition | undefined; list(): object[];
  render(id: string, vars?: Record<string, unknown>, options?: {mode?: string; extraContext?: Record<string, Json>}): RenderedPrompt}
export declare function createPromptLibrary(options?: {prompts?: PromptDefinition[]; modes?: ReturnType<typeof defineMode>[]}): PromptLibrary;

// ---------- runtime client and agent runs ----------
export declare class AugmentorClient extends EventEmitter {
  constructor(options: {profile: string; descriptor?: string; runtimeRoot?: string; harness?: 'dsh' | 'codex'; requiredCapabilities?: string[]; timeoutMs?: number; start?: Function});
  readonly profile: string; readonly harness: 'dsh' | 'codex'; capabilities?: Record<string, any>; ready?: boolean;
  connect(): Promise<this>; refreshCapabilities(): Promise<Record<string, any>>; call(method: string, params?: Record<string, unknown>): Promise<any>;
  createSession(sessionId?: string): Promise<any>; listSessions(): Promise<{items: any[]}>;
  prompt(options: {sessionId: string; operationId: string; text: string; context?: Record<string, Json>; mode?: 'queue' | 'steer'; attachments?: {type: 'image'; mediaType: string; data: string}[]}): Promise<any>;
  history(sessionId: string, options?: {maxMessages?: number; beforeSeq?: number}): Promise<{sessionId: string; header: any; events: any[]; hasMore: boolean; running: boolean}>;
  getSession(sessionId: string): Promise<{sessionId: string; running: boolean; header: any}>;
  models(sessionId: string): Promise<any>; selectModel(sessionId: string, selection: Record<string, unknown>): Promise<any>; rename(sessionId: string, title: string): Promise<any>;
  answerInteraction(id: string, value: {outcome: 'allowed-once' | 'rejected'} | {answer: {answers: {id: string; selected: string[]; custom?: string}[]}}): Promise<any>;
  cancel(sessionId: string): Promise<any>; close(): void;
}
export interface Interaction {id: string; kind: 'approval' | 'question'; params: any}
export interface RunResult {sessionId: string; operationId: string; status: 'completed' | 'aborted' | 'blocked' | 'error' | 'max-tokens' | 'timeout' | 'cancelled'; reason: string | null; text: string;
  toolCalls: {name: string; id: string; ok?: boolean}[]; interactions: {id: string; kind: string; answered: boolean; outcome?: string}[]; error?: string; durationMs: number}
export declare class AgentRunner {
  constructor(options: {client: AugmentorClient; interactions?: 'reject' | ((interaction: Interaction) => any); events?: EventHub; activity?: ActivityLog; pollMs?: number; timeoutMs?: number});
  createSession(options?: {sessionId?: string; title?: string; model?: Record<string, unknown>}): Promise<string>;
  run(options: {text: string; context?: Record<string, Json>; sessionId?: string; title?: string; model?: Record<string, unknown>; operationId?: string; mode?: 'queue' | 'steer';
    attachments?: {type: 'image'; mediaType: string; data: string}[]; timeoutMs?: number; signal?: AbortSignal; onEvent?(event: any): void; subject?: string}): Promise<RunResult>;
}
export declare function refuseInteractions(interaction: Interaction): any;

// ---------- automation and schedules ----------
export interface Rule {name?: string; prompt: string | ((event: AppEvent) => {text: string; context?: Record<string, Json>; title?: string}); vars?(event: AppEvent): Record<string, unknown>; context?(event: AppEvent): Record<string, Json>;
  filter?(event: AppEvent): boolean; key?(event: AppEvent): string; batch?: {windowMs?: number; max?: number}; quiet?: {start: string; end: string; timeZone?: string};
  budget?: {perHour?: number; perDay?: number}; session?(event: AppEvent): string | undefined; expect?(result: RunResult, info: {job: Job; event: any}): boolean | 'partial' | Promise<boolean | 'partial'>;
  title?: string; model?: Record<string, unknown>; timeoutMs?: number}
export interface Automation {
  on(types: string | string[], rule: Rule): Automation;
  schedule(name: string, cron: string, rule: Rule & {timeZone?: string; catchUpMs?: number}): Automation;
  watch(name: string, rule: Rule & {check(): unknown; everyMs?: number; changed?(previous: unknown, next: unknown): boolean}): Automation;
  trigger(name: string, data?: Json, options?: {key?: string; subject?: string}): Job | null;
  start(): Automation; stop(): void; pause(reason?: string): void; resume(): void; status(): Record<string, any>;
}
export declare function createAutomation(options: {runner: AgentRunner; jobs: JobStore; events: EventHub; prompts?: PromptLibrary; activity?: ActivityLog; maxConcurrent?: number; leaseMs?: number; now?: () => Date; onError?(error: unknown): void}): Automation;
export declare function parseCron(expression: string): object;
export declare function nextRun(expression: string, options?: {after?: Date; timeZone?: string}): Date;
export declare function previousRun(expression: string, options?: {before?: Date; timeZone?: string; lookbackMs?: number}): Date | null;
export declare function inQuietHours(date: Date, window: {start: string; end: string; timeZone?: string}): boolean;
export declare function localDate(date: Date, timeZone?: string): string;

// ---------- MCP ----------
export declare const MCP_VERSIONS: string[];
export declare function createMcpServer(options: {toolkit: Toolkit; prompts?: PromptLibrary; resources?: ResourceRegistry; name?: string; title?: string; version?: string; instructions?: string;
  tokenFile?: string; authenticate?(request: SdkRequest): Principal | null | Promise<Principal | null>; maxBytes?: number}): Handler & {dispatch(message: object, principal: Principal): Promise<any>};

// ---------- app ----------
export declare const GRANTS: Readonly<Record<'memory' | 'web' | 'ask' | 'browserObserve' | 'todo' | 'goals' | 'plan' | 'subagents' | 'workflow' | 'skills', string[]>>;
export interface ResourceDefinition {kind: 'resource'; uri: string; name: string; title: string; description: string; mimeType: string; template: boolean}
export declare function defineResource(spec: {uri: string; name: string; title?: string; description?: string; mimeType?: string; read(params: Record<string, string>, context: any): unknown}): ResourceDefinition;
export interface ResourceRegistry {list(): object[]; templates(): object[]; read(uri: string, context?: any): Promise<{uri: string; mimeType: string; text: string}[]>}
export interface AppDefinition {
  kind: 'app'; id: string; name: string; description: string; harness: 'dsh' | 'codex'; prefix: string; instructions: string[]; tools: ToolDefinition[];
  prompts: PromptLibrary; resources: ResourceRegistry; uiActions: UiAction[]; grants: string[]; voice: boolean; ui: boolean; memory: boolean; routes: Record<string, string>;
  allTools(options?: object): ToolDefinition[]; descriptors(): {schemaVersion: 1; app: string; fingerprint: string; tools: object[]};
  manifest(options?: {toolModule?: string; pluginId?: string}): Manifest; reference(): string;
}
export declare function defineApp(spec: {id: string; name: string; description?: string; harness?: 'dsh' | 'codex'; instructions?: string[]; tools?: ToolDefinition[];
  prompts?: PromptDefinition[]; modes?: ReturnType<typeof defineMode>[]; uiActions?: UiAction[]; resources?: ResourceDefinition[];
  grants?: (keyof typeof GRANTS | string)[]; voice?: boolean; ui?: boolean; builtins?: boolean; memory?: boolean; routes?: Record<string, string>}): AppDefinition;
export interface AugmentorServer {
  app: AppDefinition; toolkit: Toolkit; events: EventHub; proposals: ProposalStore; activity: ActivityLog; operations: OperationStore; jobs: JobStore;
  preferences: PreferenceStore | null; runner: AgentRunner | null; automation: Automation | null; bridge: UiBridge | null; mcp: Handler | null;
  node(req: IncomingMessage, res: ServerResponse): Promise<boolean>; upgrade(req: IncomingMessage, socket: Duplex, head: Buffer): boolean;
  fetch(request: Request): Promise<Response | null>; start(): AugmentorServer; close(): void;
}
export declare function createAugmentorServer(app: AppDefinition, options: {origin: string; authorizeOwner: AuthorizeOwner; runtimeTokenFile?: string;
  authenticateRuntime?(request: SdkRequest): Principal | null | Promise<Principal | null>; dataDir?: string; stores?: Partial<Record<'events' | 'proposals' | 'activity' | 'operations' | 'jobs' | 'preferences', unknown>>;
  client?: AugmentorClient; interactions?: 'reject' | ((interaction: Interaction) => any); proxy?: {profile?: string; tokenFile: string; socketPath?: string; port?: number; path?: string; authorize?: Function};
  mcp?: {tokenFile?: string; authenticate?: Function}; basePath?: string; services?: Record<string, any>; policy?: object; automation?(automation: Automation, context: {app: AppDefinition; toolkit: Toolkit; events: EventHub}): void;
  eventTypes?: string[]; allowedHosts?: string[]}): AugmentorServer;
export declare function normalizeRequest(request: IncomingMessage | Request): SdkRequest;

// ---------- 0.1 surface ----------
export interface Manifest {schemaVersion: 1; id: string; name: string; description?: string; harness: 'dsh' | 'codex'; instructions: string[];
  tools: {id: string; module: string; names: string[]}[]; permissions: {tools: string[]}; voice: {experimental: true; enabled: boolean}}
export declare function validateManifest(value: unknown): Manifest;
export declare function validateApplication(manifest: unknown, options: {root: string}): Manifest;
export declare function workspaceProfile(manifest: unknown, options: {root: string; origin: string; tokenFile: string; toolConfig?: Record<string, object>; id?: string; preset?: string; memory?: object; legacyPresets?: string[]; connection?: string}): Record<string, any>;
export declare function discoverRuntime(options?: {descriptor?: string; runtimeRoot?: string; harness?: 'dsh' | 'codex'}): Promise<Record<string, any>>;
export declare function runtimePaths(options?: {platform?: string; home?: string; env?: Record<string, string | undefined>}): {config: string; data: string; state: string; profiles: string; descriptor: string; runtimeRoot: string | null};
export declare function capabilityState(description: unknown, name: string): 'supported' | 'disabled' | 'denied' | 'unsupported' | 'unknown';
export declare function requireCapabilities<T>(description: T, names?: string[]): T;
export declare function createProxy(options: {profile: string; origin: string; tokenFile: string; authorize(req: IncomingMessage): boolean | Promise<boolean>; socketPath?: string; port?: number; path?: string}): {
  http(req: IncomingMessage, res: ServerResponse): Promise<void>; upgrade(req: IncomingMessage, socket: Duplex, head: Buffer): Promise<void>};
export declare function createApplicationTools(options: {definitions: [string, string, JsonSchema, JsonSchema?][]; execute(name: string, args: any, execution: any): Promise<any>}): {
  tools: {name: string; description: string; inputSchema: JsonSchema; outputSchema?: JsonSchema}[]; execute(name: string, args: any, execution: any): Promise<any>};
export declare function createToolClient(options: {url: string; tokenFile: string; timeoutMs?: number; maxBytes?: number; fetchImpl?: typeof fetch}): (name: string, args: any, execution: {sessionId?: string; agent?: {id: string}; callId: string; signal?: AbortSignal}) => Promise<any>;
export declare function parameterSchema(parameters?: JsonSchema): JsonSchema;
export declare function compileSchema(schema: JsonSchema, label?: string): ((value: unknown) => boolean) & {errors?: unknown[]};
export declare function toDshParameters(schema: JsonSchema): Record<string, JsonSchema>;
