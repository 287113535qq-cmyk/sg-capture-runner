import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import test from 'node:test';import assert from 'node:assert/strict';
import {replaceLocalJson} from './atomic-local-state.mjs';
test('interrupted old temporary file cannot block later local state publication',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sg-local-state-'));
 try{
  const file=path.join(dir,'inventory.json'),old=file+'.'+process.pid+'.tmp';
  fs.writeFileSync(old,'incomplete old attempt');
  replaceLocalJson(file,{revision:1});replaceLocalJson(file,{revision:2});
  assert.deepEqual(JSON.parse(fs.readFileSync(file)),{revision:2});
  assert.equal(fs.readFileSync(old,'utf8'),'incomplete old attempt');
  assert.deepEqual(fs.readdirSync(dir).sort(),[path.basename(file),path.basename(old)].sort());
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('failed rename preserves published state and cleans only its own temporary file',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sg-local-state-'));
 try{
  const file=path.join(dir,'inventory.json');replaceLocalJson(file,{revision:1});
  assert.throws(()=>replaceLocalJson(file,{revision:2},{...fs,renameSync(){throw Error('RENAME_FAILED');}}),/RENAME_FAILED/);
  assert.deepEqual(JSON.parse(fs.readFileSync(file)),{revision:1});
  assert.deepEqual(fs.readdirSync(dir),['inventory.json']);
  replaceLocalJson(file,{revision:2});assert.equal(JSON.parse(fs.readFileSync(file)).revision,2);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
