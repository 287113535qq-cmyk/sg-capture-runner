import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {protocolHash as hash} from './protocol-resume.mjs';
import {preparationInputHash,preparationSourceHash} from './preparation-handlers.mjs';
import {preparationRevision} from './preparation-revision.mjs';

// AG reuses results for a fixed task revision. Share source reads within one
// preparation tick, never across ticks or across a long-running local check.
// Mutable inventory, owner claims and online admission are not cached here.
export function preparationInputs(root,{python,read=fs.readFileSync}={}){
  let sources=new Map(),games=new Map();
  const bytesHash=p=>createHash('sha256').update(read(p)).digest('hex');
  const source=file=>{
    if(!sources.has(file))sources.set(file,fs.existsSync(file)?preparationSourceHash(read(file,'utf8')):'missing');
    return sources.get(file);
  };
  return {
    reset(){sources=new Map();games=new Map();},
    forGame(gameId,index,lane){
      const key=lane+':'+gameId;
      if(games.has(key))return games.get(key);
      const reference=index.games.find(g=>g.gameId===gameId);
      const {handler,fileHashes,revisionHash}=preparationRevision(root,gameId,reference,{sourceHash:source});
      const evidenceDir=path.join(root,'.local/preparation-worker/evidence',String(gameId)),receipts=[];
      if(fs.existsSync(evidenceDir))for(const name of fs.readdirSync(evidenceDir).filter(n=>/^[a-f0-9]{64}\.json$/.test(n))){
        try{const value=JSON.parse(read(path.join(evidenceDir,name),'utf8'));if(hash(value)+'.json'===name)receipts.push(value);}catch{}
      }
      // Canonical ordering prevents filesystem enumeration order from retrying
      // an unchanged failed task. Evidence contents remain hash-verified.
      receipts.sort((a,b)=>hash(a).localeCompare(hash(b)));
      const resultFile=path.join(root,'.local/preparation-worker',lane,gameId+'-result.json');
      const value={reference,handler,fileHashes,revisionHash,receipts,evidenceDir,
        inputHash:preparationInputHash({gameId,reference,fileHashes,evidenceHashes:[
          hash({python,worker:source(path.join(root,'scripts/preparation-worker.mjs'))}),
          ...receipts.map(hash),...(fs.existsSync(resultFile)?[bytesHash(resultFile)]:[])]})};
      games.set(key,value);return value;
    },
  };
}
