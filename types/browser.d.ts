// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
// Browser entry (@augmentor/app-sdk/browser and the single-file browser.bundle).
export type UiSpec = {type: string; [key: string]: unknown};
export interface PanelTheme {mode?: 'light' | 'dark'; accent?: string | number; accentBrightness?: number; neutral?: string | number; neutralBrightness?: number}
export interface PanelHandle {
  frame: HTMLIFrameElement; ready: Promise<{profile: string | null; capabilities: string[]}>; readonly capabilities: string[]; supports(name: string): boolean;
  setContext(value: Record<string, unknown>): void; prompt(text: string, options?: {send?: boolean; fresh?: boolean; context?: Record<string, unknown>}): Promise<unknown>;
  newChat(): Promise<unknown>; focus(): void; destroy(): void;
}
export declare function mountAugmentor(options: {container: Element; path?: string; title?: string; allow?: string | string[]; theme?: PanelTheme;
  onStatus?(status: {online: boolean; busy: boolean; sessionId?: string}): void; onNavigate?(hash: string): void; onSettings?(url: string): void; onHide?(): void;
  onEvent?(event: {event: string; data: unknown}): void; onReady?(info: {profile: string | null; capabilities: string[]}): void}): PanelHandle;
export declare function applyPanelTheme(basePath: string, theme: PanelTheme, options?: {fetchImpl?: typeof fetch}): Promise<Record<string, string>>;
export declare function themePreferences(theme: PanelTheme): Record<string, string>;
export declare function hexToHue(hex: string): number;
export interface PageConnection {pageId: string; updateView(): void; disconnect(): void}
export declare function connectPage(options?: {endpoint?: string; actions?: Record<string, (args: any, info: {pageId: string; source?: string}) => unknown>; describeView?(): Record<string, unknown>;
  components?: Record<string, (props: any, options: {document: Document}) => Element>; onAction?(action: unknown, spec: UiSpec): void; webmcp?: boolean;
  EventSourceImpl?: typeof EventSource; fetchImpl?: typeof fetch; document?: Document}): PageConnection;
export declare function subscribe(url: string, handler: (event: {id: string; type: string; subject?: string; data: unknown}) => void, options?: {types?: string[]; EventSourceImpl?: typeof EventSource}): () => void;
export declare function showToast(message: string, options?: {tone?: string; href?: string; timeoutMs?: number; document?: Document}): HTMLElement;
export declare function showOverlay(content: Node, options?: {document?: Document; label?: string; onClose?(): void}): HTMLElement;
export declare function highlight(target: {target: string; text?: string; note?: string}, options?: {document?: Document; durationMs?: number}): {found: boolean; textFound?: boolean};
export declare function renderAgentUi(spec: UiSpec, options?: {onAction?(action: unknown, spec: UiSpec): void; onSubmit?(values: Record<string, unknown>): void;
  components?: Record<string, (props: any, options: {document: Document}) => Element>; document?: Document}): HTMLElement;
export declare function ensureStyles(doc?: Document): void;
export declare function lineDiff(before: string, after: string): {op: 'same' | 'add' | 'del'; text: string}[];
export declare function mountReviewQueue(container: Element, options?: {endpoint?: string; eventsUrl?: string; state?: string; fetchImpl?: typeof fetch; renderPreview?(item: any): Element | undefined;
  labels?: Record<string, string>; onDecision?(proposal: unknown): void; EventSourceImpl?: typeof EventSource; document?: Document}): {ready: Promise<unknown[]>; refresh(): Promise<unknown[]>; destroy(): void};
export interface AgentHandle {prompts(): Promise<unknown[]>; ask(id: string, vars?: Record<string, unknown>, options?: {run?: 'auto' | 'panel' | 'background'; mode?: string; context?: Record<string, unknown>; send?: boolean}): Promise<{delivered: 'panel' | 'background'; runId?: string}>;
  run(runId: string): Promise<{status: string; text?: string; sessionId?: string}>}
export declare function createAgent(options?: {endpoint?: string; panel?: PanelHandle; fetchImpl?: typeof fetch}): AgentHandle;
export declare function bindPromptButtons(root: Element, agent: AgentHandle, options?: {onResult?(result: {delivered: string; runId?: string}, button: Element): void; onError?(error: Error & {code?: string}, button: Element): void}): () => void;
export declare function snapshotContext<T extends Record<string, unknown>>(value: T): T;
export declare const UI_TYPES: string[];
