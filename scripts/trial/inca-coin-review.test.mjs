import{test}from'node:test';import assert from'node:assert/strict';import{incaCoinReview}from'./inca-coin-review.mjs';import{incaReview}from'./inca-free-review.mjs';
function sample(){const raw={fixtureOnly:false,protocol:'nextgen',sourceKey:'hyperchargedincajungle96-round-one-base-v1',roundFieldsVersion:'sg-round-fields-v1',startBalanceRaw:100000,steps:[]};for(let i=0;i<=10;i++){const msg=i?'FREE_GAME':'BET';raw.steps.push({msgId:msg,elapsedMs:1,requestPayload:`PID=gdmgcmoffline-inca&MSGID=${msg}&BPL=1&GN=hyperchargedincajungle96&LB=40`,responsePayload:`MSGID=${msg}&FID=1|&NFG=${10-i}&TFG=10&CFGG=${i}&IFG=${i?1:0}&B=99980&AB=99980&TW=0&GSD=BGRS~1;2;3;4;5;#NWI~1;4;`});}return raw;}
function change(raw,i,edits){const p=Object.fromEntries(raw.steps[i].responsePayload.split('&').map(s=>{const at=s.indexOf('=');return[s.slice(0,at),s.slice(at+1)];}));for(const[k,v]of Object.entries(edits)){if(v===null)delete p[k];else p[k]=String(v);}raw.steps[i].responsePayload=Object.entries(p).map(([k,v])=>`${k}=${v}`).join('&');}

test('coin repair retains incomplete prefixes and reconciles synthetic terminal without opening old scope',()=>{
 const raw=sample();for(let i=0;i<raw.steps.length;i++)change(raw,i,{GSD:'CL~0;1;20;|2;4;800;|#BGCL~1;2;10;|'});
 const before=structuredClone(raw);for(let i=1;i<=10;i++)assert.equal(incaCoinReview({...raw,steps:raw.steps.slice(0,i)}).next,'FREE_GAME');
 assert(incaCoinReview(raw).complete);assert.deepEqual(raw,before);assert.throws(()=>incaReview(raw));
});
test('coin repair refuses malformed grids, jackpots, new fields and mixed features',()=>{
 for(const GSD of ['CL~0;0;-4;','CL~0;0;999;','CL~3;0;20;','CL~0;5;20;','CL~0;0;20;|0;0;40;','CL~0;0;20;||','CL~','CL~0;0;20;#HCL~0;0;20;','BGCL~0;0;20;9;','CL~0;0;20;#CL~0;0;20;']){const raw=sample();change(raw,0,{GSD});assert.throws(()=>incaCoinReview(raw));}
 const raw=sample();change(raw,1,{FID:'1|0|',GSD:'CL~0;0;20;'});assert.throws(()=>incaCoinReview(raw));
});
