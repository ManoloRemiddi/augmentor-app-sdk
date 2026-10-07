// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
// Loaded by the Augmentor runtime. It reads the generated descriptors and forwards calls to
// your server; no application code runs inside the agent runtime.
import {createToolModule} from '@augmentor/app-sdk/dsh';
export const {name, inject, apply, applicationTools} = createToolModule({pluginId: __PLUGIN_ID_JSON__, descriptors: new URL('./tools.json', import.meta.url)});
