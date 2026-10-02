import test from 'node:test';import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';import {createRequire} from 'node:module';import path from 'node:path';
import {pyramidsActionNext} from '../trial/pyramids-direct-action-protocol.mjs';
const require=createRequire(import.meta.url);
require('../../collector/node_modules/ts-node').register({project:path.resolve('collector/tsconfig.json'),transpileOnly:true});
const {prepareNextgenActionRound}=require('../../collector/sg.pyramids-direct-action.ts');

test('independent Python, Runner and collector agree on direct layered flow and resource boundaries',()=>{
 const script=`
import sys,json,copy
sys.path[:0]=['service','service/tests','scripts/runner-v2']
from test_pyramids_action_fields import ACTION_PLAN,rewrite
from test_pyramids_free_review import frame,raw
from pyramids_direct_action_fields import PyramidsDirectActionFields,ACTION_VERSION,CONTRACT_HASH
plan={**ACTION_PLAN,'featureProfile':ACTION_VERSION,'actionContractHash':CONTRACT_HASH,'maxSteps':1026,'actionResourceBudget':{'maxFrames':1026,'maxRawBytes':4194304}}
adapter=PyramidsDirectActionFields(plan)
steps=[frame('BET',6,6,0,'0|1|')]+[frame('FREE_GAME',n,6,6-n,'0|1|') for n in range(5,-1,-1)]
for step in steps:rewrite(step,GSD='FGRS~10#FGTS~10#CFGC~0#UNKNOWNDISPLAY~unchanged')
steps += [frame('FREE_GAME',n,10,10-n,'1|') for n in range(9,-1,-1)]
def mark(steps):
 q=raw(steps)
 for s in q['steps']:s['methodName']='processGameMessage'
 q.update(requestFlowVersion=ACTION_VERSION,actionContractHash=CONTRACT_HASH)
 return q
v=mark(steps)
large=mark([frame('BET',120,120,0,'1|')]+[frame('FREE_GAME',n,120,120-n,'1|') for n in range(119,-1,-1)])
maximum=mark([frame('BET',1025,1025,0,'1|')]+[frame('FREE_GAME',n,1025,1025-n,'1|') for n in range(1024,-1,-1)])
positives=[v,large,maximum];negatives=[]
bad=copy.deepcopy(v);del bad['steps'][6];negatives.append(bad)
bad=copy.deepcopy(v);rewrite(bad['steps'][1],GSD='FGRS~9#FGTS~10#CFGC~1');negatives.append(bad)
bad=copy.deepcopy(v);rewrite(bad['steps'][0],GSD='FGRS~9#FGTS~10#CFGC~1');negatives.append(bad)
bad=copy.deepcopy(v);rewrite(bad['steps'][1],CFGG='2');negatives.append(bad)
bad=copy.deepcopy(v);rewrite(bad['steps'][-1],AB='1');negatives.append(bad)
bad=copy.deepcopy(v);bad['steps']+=copy.deepcopy(bad['steps'][-1:]);negatives.append(bad)
bad=copy.deepcopy(v);bad['steps'][2]['requestPayload']=bad['steps'][2]['requestPayload'].replace('gdmgcm','wrong');negatives.append(bad)
bad=copy.deepcopy(v);bad['steps'][2]['responseXml']='<GDMRESPONSE><SUCCESS>true</SUCCESS></GDMRESPONSE>';negatives.append(bad)
bad=copy.deepcopy(v);rewrite(bad['steps'][2],GSD='X~1#X~2');negatives.append(bad)
bad=copy.deepcopy(v);rewrite(bad['steps'][1],GCT='1');negatives.append(bad)
bad=copy.deepcopy(maximum);bad['steps']+=copy.deepcopy(bad['steps'][-1:]);negatives.append(bad)
bad=copy.deepcopy(v);bad['steps'][0]['oversizedEvidence']='x'*4194304;negatives.append(bad)
for q in negatives:
 try:adapter.settled(q)
 except Exception:pass
 else:raise AssertionError('python accepted negative')
print(json.dumps({'plan':plan,'positives':positives,'expected':[adapter.settled(q) for q in positives],'negatives':negatives}))
`;
 const result=spawnSync(process.env.PYTHON??'python',['-B','-c',script],{encoding:'utf8',maxBuffer:12*1024**2,env:{...process.env,PYTHONUTF8:'1'}});
 assert.equal(result.status,0,result.stderr);const data=JSON.parse(result.stdout);
 assert.deepEqual(data.positives.map(r=>r.steps.length),[17,121,1026]);
 for(const [j,raw]of data.positives.entries()){
  for(let i=1;i<=raw.steps.length;i++)assert.deepEqual(pyramidsActionNext(data.plan,{...raw,steps:raw.steps.slice(0,i)}),i<raw.steps.length?{MSGID:'FREE_GAME'}:null);
  assert.deepEqual(prepareNextgenActionRound(raw,data.plan),data.expected[j]);
  assert.throws(()=>prepareNextgenActionRound({...raw,steps:raw.steps.slice(0,-1)},data.plan));
 }
 assert.equal(data.negatives.length,12);
 for(const raw of data.negatives){assert.throws(()=>pyramidsActionNext(data.plan,raw));assert.throws(()=>prepareNextgenActionRound(raw,data.plan));}
});
