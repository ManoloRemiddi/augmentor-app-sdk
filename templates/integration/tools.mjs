// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
import {registerDshTools, createToolClient} from '@augmentor/app-sdk/dsh';
export const name = __PLUGIN_ID_JSON__;
export const inject = ['tools'];
export async function apply(ctx, config) {
  await registerDshTools(ctx, {
    definitions: [[__TOOL_NAME_JSON__, 'Read one current application record by its stable ID.',
      {id: {type: 'string', required: true, minLength: 1, maxLength: 160}},
      {type: 'object', required: ['id', 'version', 'title'], properties: {
        id: {type: 'string'}, version: {type: 'integer', minimum: 0}, title: {type: 'string'}
      }, additionalProperties: false}]],
    execute: createToolClient({url: config.url, tokenFile: config.tokenFile})
  });
}
