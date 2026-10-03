import {settledFields} from './sg.fields';
const {review}=require('./huff-retrigger-review.cjs');
export function huffRetriggerFields(raw:any,mappingHash:string){
 const s=review(raw);if(!s.complete||!/^[a-f0-9]{64}$/.test(mappingHash))throw Error('HUFF_RETRIGGER_MAPPING');
 return {...settledFields(s.start,s.end,s.win,0,2),protocol:'nextgen',sourceKey:raw.sourceKey,primaryBonusKind:'freeGame',typeMappingHash:mappingHash};
}
export function hasHuffRetrigger(raw:any):boolean{
 if(raw.sourceKey!=='huffnpuffmoneymansionhighlimit96-round-one-base-v1')return false;
 let priorTotal:number|undefined;
 return raw.steps.some((s:any)=>{const p=new URLSearchParams(s.responsePayload);const g=Object.fromEntries((p.get('GSD')??'').split('#').filter(Boolean).map(v=>{const i=v.indexOf('~');return [v.slice(0,i),v.slice(i+1)];}));
  const total=/^\d+$/.test(p.get('TFG')??'')?Number(p.get('TFG')):undefined;
  const result=/^1(?:\|1)+\|?$/.test(g.PCFID??'')||g.FEAT==='HARDHAT'&&(!['0','',undefined].includes(g.CFFGT)||priorTotal!==undefined&&total!==undefined&&total>priorTotal);
  priorTotal=total;return result;});
}
