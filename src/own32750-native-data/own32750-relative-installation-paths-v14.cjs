'use strict';
// Resolve only explicit relative installation DATA. No CWD/default asset/OS path or network lookup.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const directories=new Set(['nativeRoot','staticRoot']);
const keys=Object.freeze(['nativeRoot','staticRoot','domPortModule','saxModule','canvasModule','canvasPackageJSON','metadataPath','wrapperPath']);
function validateOwn32750RelativeInstallation(plan){
 assert(plan&&plan.root&&['module-directory','explicit-root','original-ag-project'].includes(plan.root.kind),'Own32750 explicit installation root mode required');
 if(plan.root.kind==='explicit-root')assert(typeof plan.root.path==='string'&&path.isAbsolute(plan.root.path),'Own32750 actual absolute explicit root required');
 else {assert(!Object.prototype.hasOwnProperty.call(plan.root,'path'),'Own32750 anchored root does not accept a hidden alternate root');if(plan.root.kind==='original-ag-project')assert(plan.root.moduleDirectoryFromRoot==='src/own32750-native-data'&&plan.root.packageJSON==='package.json'&&plan.root.packageName==='ag-capture-public-runner'&&plan.root.canvasDependency==='0.1.100','Own32750 original AG project descriptor required');}
 assert(plan.relativePaths&&Object.keys(plan.relativePaths).length===keys.length,'Own32750 exactly eight explicit relative paths required');
 for(const key of keys){const relative=plan.relativePaths[key];assert(typeof relative==='string'&&relative.length>0&&!relative.includes('\0')&&!relative.includes('\\')&&!relative.includes(':')&&!path.posix.isAbsolute(relative)&&!path.win32.isAbsolute(relative)&&!relative.split('/').includes('..'),'Own32750 portable relative path required: '+key)}
 return plan;
}
function within(root,target){const relative=path.relative(root,target);return relative===''||relative!=='..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative)}
function resolveOwn32750Installation(plan,moduleDirectory){
 validateOwn32750RelativeInstallation(plan);assert(typeof moduleDirectory==='string'&&path.isAbsolute(moduleDirectory),'Own32750 actual __dirname required');
 const lexicalModule=path.resolve(moduleDirectory);
 const lexicalRoot=path.resolve(plan.root.kind==='original-ag-project'?path.resolve(lexicalModule,'..','..'):plan.root.kind==='module-directory'?lexicalModule:plan.root.path),root=fs.realpathSync(lexicalRoot);
 assert(path.dirname(root)!==root&&fs.statSync(root).isDirectory(),'Own32750 concrete installed directory root required');
 if(plan.root.kind==='original-ag-project'){
  const expectedModule=path.resolve(lexicalRoot,plan.root.moduleDirectoryFromRoot),actualModule=fs.realpathSync(lexicalModule);
  assert(path.relative(expectedModule,lexicalModule)===''&&path.relative(path.resolve(root,plan.root.moduleDirectoryFromRoot),actualModule)==='','Own32750 helper must be at declared original AG module location');
  const lexicalPackage=path.resolve(lexicalRoot,plan.root.packageJSON);assert(within(lexicalRoot,lexicalPackage),'Own32750 project package lexical escape');
  const actualPackage=fs.realpathSync(lexicalPackage);assert(within(root,actualPackage)&&fs.statSync(actualPackage).isFile(),'Own32750 project package real path escape or type');
  const pkg=JSON.parse(fs.readFileSync(actualPackage,'utf8'));assert(pkg.name===plan.root.packageName&&pkg.dependencies?.['@napi-rs/canvas']===plan.root.canvasDependency,'Own32750 actual original AG project and pinned Canvas dependency required');
 }
 const paths={};
 for(const key of keys){const lexical=path.resolve(lexicalRoot,plan.relativePaths[key]);assert(within(lexicalRoot,lexical),'Own32750 lexical path escaped root: '+key);const actual=fs.realpathSync(lexical);assert(within(root,actual),'Own32750 symlink/real path escaped root: '+key);const stat=fs.statSync(actual);assert(directories.has(key)?stat.isDirectory():stat.isFile(),'Own32750 installed path type mismatch: '+key);paths[key]=actual}
 return Object.freeze(paths);
}
module.exports={validateOwn32750RelativeInstallation,resolveOwn32750Installation};
