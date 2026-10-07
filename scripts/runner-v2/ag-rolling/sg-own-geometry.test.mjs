import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {OWN_TERMINAL,OWN_GEOMETRY,geometryPrevious,ownTerminalNext,ownTerminalFields,ownTerminalProof} from './sg-own-terminal.mjs';
import {rebaseResumeManifest} from './sg-resume-manifest.mjs';
import {queueHash} from './sg-queue-profile.mjs';
import {nextgenCodec} from './sg-nextgen-codec.mjs';
import {analyzer} from '../analyzer.mjs';
import {params} from '../../trial/capture-batch.mjs';
const book=JSON.parse(fs.readFileSync('config/ag-rolling-plans.json')),plan=book.plans['32708'],proof=book.proofs['32708'];
const fixtures=JSON.parse(fs.readFileSync(new URL('./sg-own-geometry-fixtures.json',import.meta.url))),natural=fixtures.at(-1);
const history=JSON.parse(fs.readFileSync(new URL('./sg-own-geometry-ordinary.json',import.meta.url)));
const parent=JSON.parse(fs.readFileSync(new URL('./sg-own-geometry-parent.json',import.meta.url))),cases=[];
const py=process.env.SG_TEST_PYTHON??'python3';
test('codec evidence rejects altered attestations in both validators',()=>{
 const damaged=[];
 for(const change of [c=>{c.actualCodecPythonRecordVerify=false;},c=>{c.results[0].routes++;},c=>{c.databaseWrites=1;}]){
  const p=structuredClone(proof),c=p.geometryEvidence.codecEvidence;change(c);delete c.evidenceHash;c.evidenceHash=queueHash(c);
  assert.throws(()=>ownTerminalProof(plan,p),/OWN_GEOMETRY_CODEC_PROOF/);damaged.push(p);
 }
 const code=`import sys,json\nsys.path.insert(0,'service')\nfrom own_terminal_fields import validate_proof\nx=json.load(sys.stdin);out=[]\nfor p in x['proofs']:\n try:validate_proof(x['plan'],p);out.append(False)\n except Exception:out.append(True)\nprint(json.dumps(out))`;
 const p=spawnSync(py,['-B','-c',code],{input:JSON.stringify({plan,proofs:damaged}),encoding:'utf8',timeout:30000});assert.equal(p.status,0,p.stderr);assert.deepEqual(JSON.parse(p.stdout),[true,true,true]);
});
test('v4 requires its exact parent and preserves v3 rejection of natural MZ3',()=>{
 assert.equal(plan.ownTerminalContract,OWN_GEOMETRY);assert.deepEqual(geometryPrevious(plan),parent.plan);
 assert.deepEqual(ownTerminalProof(plan,proof),{previousPlan:parent.plan,previousProof:parent.proof});
 for(const p of [parent.plan,plan])assert.throws(()=>ownTerminalNext(p,{...natural.raw,ownTerminalContract:OWN_TERMINAL}),/TERMINAL_NESTED_PENDING/);
 const marked={...natural.raw,ownTerminalContract:OWN_GEOMETRY};assert.equal(ownTerminalNext(plan,marked),null);
 assert.throws(()=>ownTerminalNext(parent.plan,marked));
});
for(let n=0;n<=natural.raw.steps.length;n++)test(`new natural prefix ${n} through actual independent route`,()=>{
 const raw={...natural.raw,ownTerminalContract:OWN_GEOMETRY,steps:natural.raw.steps.slice(0,n)};
 const expected=n===0?{MSGID:'BET'}:n===natural.raw.steps.length?null:{MSGID:'FREE_GAME'};
 assert.deepEqual(ownTerminalNext(plan,raw),expected);cases.push({plan,raw,expected});
});
test('wrong marker, game, stake and contract cannot borrow geometry admission',()=>{
 const raw={...natural.raw,ownTerminalContract:OWN_GEOMETRY};
 for(const [p,r] of [[{...plan,gameId:32715},raw],[{...plan,betRaw:101},raw],[{...plan,ownTerminalContractHash:'f'.repeat(64)},raw],[plan,{...raw,ownTerminalContract:'unknown'}]]){
  assert.throws(()=>ownTerminalNext(p,r));cases.push({plan:p,raw:r,rejected:true});
 }
});
test('v3 and older resume boundaries remain exact and completed games never rebase',()=>{
 const entry={gameId:'32708',planHash:queueHash(parent.plan),adapterProofHash:queueHash(parent.proof),campaignId:'unchanged',target:300000,baseline:1234};
 const args={previous:{manifest:[entry]},previousPlans:{plans:{32708:parent.plan},proofs:{32708:parent.proof}},plans:book};const before=queueHash(args);
 assert.deepEqual(rebaseResumeManifest(args),[{...entry,planHash:queueHash(plan),adapterProofHash:queueHash(proof)}]);assert.equal(queueHash(args),before);
 assert.throws(()=>rebaseResumeManifest({...args,completedGameIds:['32708']}),/COMPLETED/);
 const auto=ownTerminalProof(parent.plan,parent.proof),old={...entry,planHash:queueHash(auto.previousPlan),adapterProofHash:queueHash(auto.previousProof)};
 assert.deepEqual(rebaseResumeManifest({...args,previous:{manifest:[old]},previousPlans:{plans:{32708:auto.previousPlan},proofs:{32708:auto.previousProof}}}),[{...entry,planHash:queueHash(plan),adapterProofHash:queueHash(proof)}]);
 for(const k of ['previousPlanHash','previousProofHash','contractHash','naturalEvidenceSha256','clientSha256','offlineLinuxProofSha256']){const p=structuredClone(proof);p.geometryEvidence[k]='0'.repeat(64);assert.throws(()=>ownTerminalProof(plan,p));}
 const p=structuredClone(proof);p.ownTerminalEvidence.ordinaryRows--;assert.throws(()=>ownTerminalProof(plan,p));
});
function edit(x,key,value){const s=x.raw.steps.at(-1),pairs=s.responsePayload.split('&').filter(Boolean).map(p=>p.split(/=(.*)/s).slice(0,2)),v=Object.fromEntries(pairs);v[key]=value;s.responsePayload=Object.entries(v).map(([k,v])=>`${k}=${v}`).join('&');s.responseXml=`<GDMRESPONSE><OGS_RC>0</OGS_RC><SUCCESS>true</SUCCESS><PAYLOAD><![CDATA[${s.responsePayload}]]></PAYLOAD></GDMRESPONSE>`;}
function gsdEdit(x,key,value){const v=Object.fromEntries(x.raw.steps.at(-1).responsePayload.split('&').filter(Boolean).map(p=>p.split(/=(.*)/s).slice(0,2)));const g=Object.fromEntries(v.GSD.split('#').map(p=>p.split('~')));g[key]=value;edit(x,'GSD',Object.entries(g).map(([k,v])=>k+'~'+v).join('#'));}
const negative=[
 ...['2;1|4','2;1|0','2;1|8','5;1|3','1;5|3','-1;0|3','0;0|3|4','02;1|3','NaN;1|3'].map(v=>['invalid or unreviewed geometry '+v,x=>gsdEdit(x,'MZ',v)]),
 ...['SNFG','STFG','SCFGG'].map(k=>['nested counter '+k,x=>gsdEdit(x,k,'1')]),
 ['cascade pending',x=>gsdEdit(x,'CPDO','B|R')],['different grid',x=>gsdEdit(x,'AGS','6')],
 ...[['NFG','1'],['CFGG','2'],['TFG','4'],['FID','9|'],['FGTW','0'],['TW','8821'],['CW','1'],['AB','0'],['SUB','1']].map(([k,v])=>[k,x=>edit(x,k,v)]),
 ['incomplete round',x=>x.raw.steps.pop()],['new request mode',x=>x.raw.steps.at(-1).requestPayload+='&REC=1'],
 ['bad XML',x=>x.raw.steps.at(-1).responseXml=x.raw.steps.at(-1).responseXml.replace('<SUCCESS>true','<SUCCESS>false')],
 ['wrong observer',x=>x.raw.steps.at(-1).responseBalance++],['new session',x=>edit(x,'SID','other')],
 ['source rejected',x=>x.raw.steps.at(-1).sourceRejected=true]
];

test('all geometry, pending, money, identity and XML damages fail actual v4 settled route',()=>{
 for(const [label,damage] of negative.filter(([k])=>k!=='SUB')){const x=structuredClone(natural);damage(x);const raw={...x.raw,ownTerminalContract:OWN_GEOMETRY};assert.throws(()=>ownTerminalFields(plan,raw,'a'.repeat(64)),label);cases.push({plan,raw,op:'fields',rejected:true});}
});
test('actual Python route and registered plan validation match all prefix decisions',()=>{
 const code=`import sys,json\nsys.path.insert(0,'service')\nfrom native_nextgen_fields import NativeNextgenFields\nfrom ag_rolling_plan import validate_rolling_plan\nfrom own_terminal_fields import validate_proof\nx=json.load(sys.stdin);validate_rolling_plan(x['plan']);validate_proof(x['plan'],x['proof']);out=[]\nfor c in x['cases']:\n try:out.append({'value':(NativeNextgenFields(c['plan']).settled(c['raw']) if c.get('op')=='fields' else NativeNextgenFields(c['plan']).next_request(c['raw']))})\n except Exception:out.append({'rejected':True})\nprint(json.dumps(out))`;
 const p=spawnSync(py,['-B','-c',code],{input:JSON.stringify({plan,proof,cases}),encoding:'utf8',timeout:30000});assert.equal(p.status,0,p.stderr);
 assert.deepEqual(JSON.parse(p.stdout),cases.map(c=>c.rejected?{rejected:true}:{value:c.expected}));
});
const results=[];
test('actual codec + Python IPC + whole record and verify on natural terminal and 200 ordinary histories',async()=>{
 for(const game of history.games){
  const p=book.plans[game.gameId],ordinary=game.records.map(x=>x.raw),raws=game.gameId==='32708'?[natural.raw,...ordinary]:ordinary;
  let routes=0,ordinal=0,oldRecords=0;const hashes=[];
  // Per-session binding is still checked against each original source response.
  for(const raw of raws){ordinal++;const codec=await nextgenCodec({plan:p,session:{pid:params(raw.steps[0].requestPayload).PID},sequence:()=>ordinal,worker:0,batchId:1,createAnalyzer:()=>analyzer({python:py})});
   try{
    const value=codec.createRaw({balance:raw.startBalanceRaw});assert.equal(value.ownTerminalContract,p.ownTerminalContract);
    for(const step of raw.steps){const next=await codec.next(value);assert.equal(next.MSGID,step.msgId);assert.deepEqual(params(codec.payload(next)),params(step.requestPayload));value.steps.push(step);routes++;}
    assert.equal(await codec.next(value),null);const output=await codec.prepare(value,{attempt:'offline-geometry-v4',sessionHash:'a'.repeat(64)});
    assert(output.independentlyVerified);assert.deepEqual(output.record.raw,value);hashes.push(queueHash(output.record));
    if(game.gameId==='32708'&&ordinal===1){await assert.rejects(()=>codec.next({...raw,ownTerminalContract:OWN_TERMINAL}),/TERMINAL_NESTED_PENDING/);}
    else{const old=await codec.prepare(raw,{attempt:'offline-geometry-v4',sessionHash:'a'.repeat(64)});assert.deepEqual(old.record.normalized,output.record.normalized);assert.deepEqual(old.record.raw,raw);oldRecords++;}
   }finally{codec.close();}
  }
  results.push({gameId:game.gameId,records:raws.length,ordinaryOldRecords:oldRecords,routes,recordsHash:queueHash(hashes)});
 }
 assert.deepEqual(results,proof.geometryEvidence.codecEvidence.results);
 fs.mkdirSync('.local',{recursive:true});fs.writeFileSync(new URL('../../../.local/geometry-codec-result.json',import.meta.url),JSON.stringify({atMs:Date.now(),results,actualCodecPythonRecordVerify:true,strictOldMarkerRetained:true,sourceRequests:0,databaseWrites:0,productionReady:false},null,2));
});
