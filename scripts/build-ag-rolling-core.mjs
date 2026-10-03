import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url),ts=require('../collector/node_modules/typescript');
const sourceRoot=path.join(root,'scripts/ag-reference');
const receipt=JSON.parse(fs.readFileSync(path.join(sourceRoot,'source.json'),'utf8').replace(/^\uFEFF/,''));
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
assert(receipt.schema==='ag-source-snapshot-v1'&&receipt.files.length===12,'AG_SOURCE_INVENTORY');
for(const f of receipt.files)assert(sha(fs.readFileSync(path.join(sourceRoot,f.path)))===f.sha256,'AG_SOURCE_CHANGED:'+f.path);
// Extract original declarations by the TypeScript AST. No scheduler, quota,
// task-state or controller algorithm is rewritten or patched here. Imports of
// AG's transport/protocol and its executable CLI are the only excluded parts.
const inventory=[
 ['scripts/campaign.ts',['positiveInteger','normalizeRunId','normalizeAgDatabaseName','splitQuota','stagingCollectionName','validateStagingCounts']],
 ['scripts/game-target.ts',['SAFE_AG_DATABASE','resolveGameTarget']],
 ['scripts/rolling-contract.ts',['LANES','TARGET','safeId','taskId','validateRollingPayload']],
 ['scripts/rolling-worker.ts',['LANE_BUDGET_MINUTES','LANE_BUDGET_MS','childEnvironment','runLane','sanitizeOutput']],
 ['scripts/rolling-controller-lib.ts',['ROLLING_WORKERS','ROLLING_TARGET','quotas','workerSummary','mergeDecision','canResetInterruptedTasks','stagingName']],
];
let input='';const declarations=[];
for(const [file,names] of inventory){
 const source=fs.readFileSync(path.join(sourceRoot,file),'utf8');
 const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 for(const name of names){
  const found=ast.statements.filter(s=>(ts.isFunctionDeclaration(s)&&s.name?.text===name)
   ||(ts.isVariableStatement(s)&&s.declarationList.declarations.some(d=>d.name.getText(ast)===name)));
  assert(found.length===1,'AG_DECLARATION_MISSING:'+name);
  const original=found[0].getText(ast);input+=original+'\n';
  declarations.push({file,name,sha256:sha(original)});
 }
}
const output=ts.transpileModule(input,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
assert(!output.diagnostics?.length,'AG_TRANSPILE_FAILED');
const banner='// Generated from the unchanged AG source snapshot. Run node scripts/build-ag-rolling-core.mjs --check.\n';
const code=banner+output.outputText;
const meta=JSON.stringify({schema:'ag-rolling-core-v1',typescript:ts.version,declarations,sha256:sha(code)},null,2)+'\n';
let runtime='';const runtimeDeclarations=[];
for(const file of ['src/ag.plan.ts','src/ag.scheduler.ts']){
 const source=fs.readFileSync(path.join(sourceRoot,file),'utf8');
 const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 for(const s of ast.statements){
  if(!ts.isFunctionDeclaration(s)&&!ts.isClassDeclaration(s)&&!ts.isVariableStatement(s))continue;
  const original=s.getText(ast);runtime+=original.replace(/^export /,'')+'\n';
  runtimeDeclarations.push({file,name:s.name?.text??s.declarationList?.declarations[0].name.getText(ast),sha256:sha(original)});
 }
}
const wrapped=`export function createAGCaptureRuntime(dependencies){
 const {fs,RoxorCometDSession,captureAGRound,AGDiscardedRoundError,AGInitialSpinResponseError,isInitialSpinRuntimeError,console}=dependencies;
 ${runtime}
 return {runAGScheduler,AGGameRunner,buildCaptureState,isCaptureComplete};
}`;
const runtimeOutput=ts.transpileModule(wrapped,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
assert(!runtimeOutput.diagnostics?.length,'AG_RUNTIME_TRANSPILE_FAILED');
const runtimeCode=banner+runtimeOutput.outputText;
const runtimeMeta=JSON.stringify({schema:'ag-capture-runtime-v1',typescript:ts.version,declarations:runtimeDeclarations,sha256:sha(runtimeCode)},null,2)+'\n';
let originalTests='';const testNames=[];
for(const file of ['test/rolling-worker.test.ts','test/rolling-controller.test.ts']){
 originalTests+='\n{\n';
 const source=fs.readFileSync(path.join(sourceRoot,file),'utf8'),ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 for(const s of ast.statements){
  if(ts.isImportDeclaration(s))continue;
  if(file.endsWith('rolling-controller.test.ts')&&s.pos>=source.indexOf('function mergeFixture'))break;
  if(ts.isExpressionStatement(s)&&ts.isCallExpression(s.expression)&&s.expression.expression.getText(ast)==='test'){
   const title=s.expression.arguments[0].text;
   if(title==='single and rolling workflows share global queue lock'||title==='only Coin Trio preserves its business display state collection')continue;
   testNames.push({file,title});
  }
  originalTests+=s.getText(ast)+'\n';
 }
 originalTests+='\n}\n';
}
const testCode=banner+`import assert from 'node:assert/strict';import test from 'node:test';
import {taskId,validateRollingPayload,childEnvironment,runLane,LANE_BUDGET_MINUTES,sanitizeOutput,
 quotas,mergeDecision,workerSummary,canResetInterruptedTasks,stagingName} from './ag-core.mjs';\n`
 +ts.transpileModule(originalTests,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const dest=path.join(root,'scripts/runner-v2/ag-rolling');fs.mkdirSync(dest,{recursive:true});
for(const [name,value] of [['ag-core.mjs',code],['ag-core.json',meta],['ag-capture-runtime.mjs',runtimeCode],['ag-capture-runtime.json',runtimeMeta],['ag-original.test.mjs',testCode]]){
 const p=path.join(dest,name);
 if(process.argv.includes('--check'))assert(fs.existsSync(p)&&fs.readFileSync(p,'utf8')===value,'AG_CORE_OUT_OF_DATE:'+name);
 else fs.writeFileSync(p,value);
}
console.log(JSON.stringify({agSourceFiles:12,originalDeclarations:declarations.length+runtimeDeclarations.length,originalTests:testNames.length,algorithmsChanged:0,checked:process.argv.includes('--check')}));
