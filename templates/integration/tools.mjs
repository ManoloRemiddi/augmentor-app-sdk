// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
import {registerDshTools} from '@augmentor/app-sdk/dsh';
import {createApplicationTools,createToolClient} from '@augmentor/app-sdk/tools';
export const name = __PLUGIN_ID_JSON__;
export const inject = ['tools'];
const definitions =
 [[__TOOL_NAME_JSON__, 'Read one current application record by its stable ID.',
      {id: {type: 'string', required: true, minLength: 1, maxLength: 160}},
      {type: 'object', required: ['id', 'version', 'title'], properties: {
        id: {type: 'string'}, version: {type: 'integer', minimum: 0}, title: {type: 'string'}
      }, additionalProperties: false}]];
export function applicationTools(config) {
  return createApplicationTools({definitions,execute:createToolClient({url:config.url,tokenFile:config.tokenFile})});
}
export async function apply(ctx,config) {
  await registerDshTools(ctx,{definitions,execute:createToolClient({url:config.url,tokenFile:config.tokenFile})});
}
