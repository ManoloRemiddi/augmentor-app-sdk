// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
import {createRequire} from 'node:module';
import {realpathSync} from 'node:fs';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createApplicationTools} from './tools.mjs';
export {createToolClient} from './tools.mjs';
export async function registerDshTools(ctx,{definitions,execute,defineTool:factory}) {
  if(!factory){
    // DSH resolves plugins from its own entry point; fall back to this module for embedded or REPL use.
    const base=process.argv[1]?realpathSync(process.argv[1]):fileURLToPath(import.meta.url);
    const require=createRequire(base);factory=(await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-tools')).href)).defineTool;}
  const application=createApplicationTools({definitions,execute});
  for(const [name,description,parameters] of definitions){
    ctx.tools.register(factory({name,description,parameters,output:{schema:{type:'string'},render:(_args,value)=>[{type:'text',text:value}]},
      async execute(args,execution){return JSON.stringify(await application.execute(name,args,execution));}
    }));
  }
  // The Augmentor preset owns presentation. DSH rejects a second declaration,
  // including an identical mode, in the same composition.
}
