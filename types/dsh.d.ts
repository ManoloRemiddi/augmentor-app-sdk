// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
import type {JsonSchema} from './index.js';
export {createToolClient} from './index.js';
export declare function registerDshTools(ctx: {tools: {register(tool: unknown): void}}, options: {definitions: [string, string, JsonSchema, JsonSchema?][]; execute(name: string, args: any, execution: any): Promise<any>; defineTool?: (spec: any) => any}): Promise<void>;
export declare function createToolModule(options: {pluginId: string; descriptors: URL | string | {schemaVersion: 1; tools: object[]}}): {
  name: string; inject: string[]; apply(ctx: any, config: {url: string; tokenFile: string; timeoutMs?: number}): Promise<void>;
  applicationTools(config: {url: string; tokenFile: string; timeoutMs?: number}): {tools: object[]; execute(name: string, args: any, execution: any): Promise<any>}};
