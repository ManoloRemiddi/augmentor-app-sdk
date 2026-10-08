// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
import type {EventEmitter} from 'node:events';
import type {AugmentorClient, Toolkit} from './index.js';
export interface ScriptContext {text: string; context: Record<string, unknown> | null; sessionId: string; signal: AbortSignal;
  call(name: string, args?: Record<string, unknown>): Promise<any>; ask(questions: string | {id: string; question: string}[]): Promise<any>;
  approve(toolName: string, args?: unknown): Promise<any>; say(text: string): void}
export interface MockRuntime extends EventEmitter {root: string; descriptor: string; sessions: Map<string, any>; readonly connections: number;
  client(options?: object): AugmentorClient; start(): unknown; close(): void}
export declare function createMockRuntime(options?: {profile?: string; harness?: 'dsh' | 'codex'; script?(context: ScriptContext): string | void | Promise<string | void>;
  tools?: Toolkit | ((name: string, args: any, ctx: {sessionId: string; callId: string; operationId: string}) => Promise<any>); features?: Record<string, {state: string}>; models?: Record<string, unknown>}): MockRuntime;
export declare function scriptedModel(steps: ({call?: [string, Record<string, unknown>?]; ask?: string; say?: string})[] | (() => Promise<object[]>)): (context: ScriptContext) => Promise<string>;
export declare function checkToolkit(toolkit: Toolkit): string[];
