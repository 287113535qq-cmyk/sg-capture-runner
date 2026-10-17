'use strict';
// Resolve only explicit relative installation DATA. No CWD/default asset/OS path or network lookup.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const directories=new Set(['nativeRoot','cacheRoot']);
const keys=Object.freeze(['nativeRoot','cacheRoot','domPortModule','canvasModule','canvasPackageJSON','requireJSPath','metadataPath','wrapperPath','fontFile','audioInputsIndex','staticReceiptsIndex','fontBinderModule','oggDecoderModule','oggDecoderPackageJSON']);
function validateOwn32806RelativeInstallation(plan){
 assert(plan&&plan.root&&['module-directory','explicit-root','original-ag-project'].includes(plan.root.kind),'Own32806 explicit installation root mode required');
 if(plan.root.kind==='explicit-root')assert(typeof plan.root.path==='string'&&path.isAbsolute(plan.root.path),'Own32806 actual absolute explicit root required');
 else {assert(!Object.prototype.hasOwnProperty.call(plan.root,'path'),'Own32806 anchored root does not accept a hidden alternate root');if(plan.root.kind==='original-ag-project')assert(plan.root.moduleDirectoryFromRoot==='src/own32806-native-data'&&plan.root.packageJSON==='package.json'&&plan.root.packageName==='ag-capture-public-runner'&&plan.root.canvasDependency==='0.1.100','Own32806 original AG project descriptor required');}
 assert(plan.relativePaths&&Object.keys(plan.relativePaths).length===keys.length,'Own32806 exactly fourteen explicit relative paths required');
 for(const key of keys){const relative=plan.relativePaths[key];assert(typeof relative==='string'&&relative.length>0&&!relative.includes('\0')&&!relative.includes('\\')&&!relative.includes(':')&&!path.posix.isAbsolute(relative)&&!path.win32.isAbsolute(relative)&&!relative.split('/').includes('..'),'Own32806 portable relative path required: '+key)}
 return plan;
}
function within(root,target){const relative=path.relative(root,target);return relative===''||relative!=='..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative)}
function resolveOwn32806Installation(plan,moduleDirectory){
 validateOwn32806RelativeInstallation(plan);assert(typeof moduleDirectory==='string'&&path.isAbsolute(moduleDirectory),'Own32806 actual __dirname required');
 const lexicalModule=path.resolve(moduleDirectory);
 const lexicalRoot=path.resolve(plan.root.kind==='original-ag-project'?path.resolve(lexicalModule,'..','..'):plan.root.kind==='module-directory'?lexicalModule:plan.root.path),root=fs.realpathSync(lexicalRoot);
 assert(path.dirname(root)!==root&&fs.statSync(root).isDirectory(),'Own32806 concrete installed directory root required');
 if(plan.root.kind==='original-ag-project'){
  const expectedModule=path.resolve(lexicalRoot,plan.root.moduleDirectoryFromRoot),actualModule=fs.realpathSync(lexicalModule);
  assert(path.relative(expectedModule,lexicalModule)===''&&path.relative(path.resolve(root,plan.root.moduleDirectoryFromRoot),actualModule)==='','Own32806 helper must be at declared original AG module location');
  const lexicalPackage=path.resolve(lexicalRoot,plan.root.packageJSON);assert(within(lexicalRoot,lexicalPackage),'Own32806 project package lexical escape');
  const actualPackage=fs.realpathSync(lexicalPackage);assert(within(root,actualPackage)&&fs.statSync(actualPackage).isFile(),'Own32806 project package real path escape or type');
  const pkg=JSON.parse(fs.readFileSync(actualPackage,'utf8'));assert(pkg.name===plan.root.packageName&&pkg.dependencies?.['@napi-rs/canvas']===plan.root.canvasDependency,'Own32806 actual original AG project and pinned Canvas dependency required');
 }
 const paths={};
 for(const key of keys){const lexical=path.resolve(lexicalRoot,plan.relativePaths[key]);assert(within(lexicalRoot,lexical),'Own32806 lexical path escaped root: '+key);const actual=fs.realpathSync(lexical);assert(within(root,actual),'Own32806 symlink/real path escaped root: '+key);const stat=fs.statSync(actual);assert(directories.has(key)?stat.isDirectory():stat.isFile(),'Own32806 installed path type mismatch: '+key);paths[key]=actual}
 return Object.freeze(paths);
}
module.exports={validateOwn32806RelativeInstallation,resolveOwn32806Installation};
