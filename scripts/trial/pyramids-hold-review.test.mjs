import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {pyramidsHoldReview as review} from './pyramids-hold-review.mjs';
const sample=()=>JSON.parse(fs.readFileSync(new URL('./fixtures/pyramids-hold-synthetic.json',import.meta.url)));
function change(raw,i,values){const s=raw.steps[i],p=Object.fromEntries(s.responsePayload.split('&').map(x=>{const j=x.indexOf('=');return[x.slice(0,j),x.slice(j+1)];}));Object.assign(p,values);s.responsePayload=Object.entries(p).map(([k,v])=>k+'='+v).join('&');s.responseXml='<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>'+s.responsePayload.replaceAll('&','&amp;').replaceAll('<','&lt;')+'</PAYLOAD></GDMRESPONSE>';}
test('natural-shape extension stays incomplete until explicit terminal and money reconcile',()=>{
 const r=sample(),original=structuredClone(r);for(let n=1;n<r.steps.length;n++)assert.equal(review({...r,steps:r.steps.slice(0,n)}).next,'FREE_GAME');
 assert.equal(review(r).betRaw,20);assert(review(r).complete);assert.deepEqual(r,original);
});
test('mixed, replayed, altered, external jackpot and incomplete evidence rejected',()=>{
 for(const [i,values]of [[0,{FID:'1|'}],[1,{FID:'0|1|'}],[1,{JPV:'x'}],[1,{GCT:1}],[1,{FRBAL:1}],[1,{CFGG:2}],[1,{TFG:7,NFG:6}],[1,{GSD:'HNS~1#HNS~1'}],[1,{GSD:'MANSION~1'}],[8,{TW:99}],[8,{B:100081,AB:100081}],[8,{AB:100079}]]){const r=sample();change(r,i,values);assert.throws(()=>review(r));}
 for(const mode of ['missing','extra','session','xml','grand']){const r=sample();if(mode==='missing')r.steps.splice(2,1);if(mode==='extra')r.steps.push(structuredClone(r.steps.at(-1)));if(mode==='session')r.steps[1].requestPayload=r.steps[1].requestPayload.replace('fixture-pyramids','other');if(mode==='xml')r.steps[1].responseXml=r.steps[0].responseXml;if(mode==='grand')change(r,0,{GSD:r.steps[0].responsePayload.split('GSD=')[1].replaceAll('CL~0;0;20','CL~0;0;-1')});assert.throws(()=>review(r));}
});
