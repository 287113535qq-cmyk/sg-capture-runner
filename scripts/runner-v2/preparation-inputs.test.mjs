import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {preparationInputs} from './preparation-inputs.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {reviewedPreparation} from './preparation-handlers.mjs';
import {preparationGates} from './preparation-inventory.mjs';

test('one tick reads shared source once; new ticks invalidate content even with unchanged mtime',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'sg-preparation-inputs-'));
  try{
    fs.mkdirSync(path.join(root,'scripts'),{recursive:true});
    fs.writeFileSync(path.join(root,'scripts/preparation-worker.mjs'),'worker');
    const file=path.join(root,'shared.py');fs.writeFileSync(file,'before');const stamp=fs.statSync(file);
    const index={games:[32758,32805].map(gameId=>({gameId,references:{'shared.py':'old-index-hash'}}))};
    const reads=new Map(),inputs=preparationInputs(root,{python:'fixed',read:(file,...args)=>{
      reads.set(file,(reads.get(file)??0)+1);return fs.readFileSync(file,...args);
    }});
    const a=inputs.forGame(32758,index,'admission');inputs.forGame(32758,index,'admission');inputs.forGame(32805,index,'admission');
    assert.equal(reads.get(file),1);assert.equal(reads.get(path.join(root,'scripts/preparation-worker.mjs')),1);
    fs.writeFileSync(file,'after!');fs.utimesSync(file,stamp.atime,stamp.mtime);inputs.reset();
    const b=inputs.forGame(32758,index,'admission');assert.notEqual(a.revisionHash,b.revisionHash);
    assert.notEqual(a.inputHash,b.inputHash);assert.equal(reads.get(file),2);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('new evidence reopens unchanged blocked code and corrupt evidence cannot admit',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'sg-preparation-evidence-'));
  try{
    fs.mkdirSync(path.join(root,'scripts'),{recursive:true});fs.writeFileSync(path.join(root,'scripts/preparation-worker.mjs'),'worker');
    const inputs=preparationInputs(root,{python:'fixed'}),index={games:[{gameId:32758,references:{}}]};
    const before=inputs.forGame(32758,index,'admission');
    assert.equal(reviewedPreparation({...before,gameId:32758}).status,'blocked');
    fs.mkdirSync(before.evidenceDir,{recursive:true});
    for(const gate of preparationGates){
      const value={schema:'sg-preparation-gate-v1',gate,gameId:32758,revisionHash:before.revisionHash,
        verified:true,sourceAllowance:0,supportingHashes:['a'.repeat(64)]};
      fs.writeFileSync(path.join(before.evidenceDir,hash(value)+'.json'),JSON.stringify(value));
    }
    fs.writeFileSync(path.join(before.evidenceDir,'b'.repeat(64)+'.json'),JSON.stringify({verified:true}));
    inputs.reset();const after=inputs.forGame(32758,index,'admission');
    assert.equal(after.revisionHash,before.revisionHash);assert.notEqual(after.inputHash,before.inputHash);
    assert.equal(after.receipts.length,6);assert.equal(reviewedPreparation({...after,gameId:32758}).status,'prepared');
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
