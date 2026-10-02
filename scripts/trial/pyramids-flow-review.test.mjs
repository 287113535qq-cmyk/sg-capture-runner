import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {reviewPyramidsFlow} from './pyramids-flow-review.mjs';

test('independent action channel agrees with Python on continuation, terminal and bad evidence',()=>{
 const script=`
import sys,json,copy
sys.path[:0]=['service','service/tests','scripts/runner-v2']
from test_pyramids_flow_review import PLAN,flow_sample,mixed_prefix,frame,rewrite
from pyramids_flow_review import review_pyramids_flow
cases=[]
def add(name,raw,plan=PLAN):
 try: result=review_pyramids_flow(plan,raw);accepted=True
 except Exception: result=None;accepted=False
 cases.append(dict(name=name,plan=plan,raw=raw,accepted=accepted,result=result))
budget={**PLAN,'maxSteps':1026,'actionResourceBudget':{'maxFrames':1026,'maxRawBytes':4194304}}
long=flow_sample();long['steps']=[frame('BET',120,120,0)]+[frame('FREE_GAME',n,120,120-n) for n in range(119,-1,-1)]
for step in long['steps']:step['methodName']='processGameMessage'
add('121-frames-bound-budget',long,budget)
add('old-plan-still-limits-frames',long)
add('budget-null-rejected',long,{**budget,'actionResourceBudget':None})
add('budget-extra-key-rejected',long,{**budget,'actionResourceBudget':{**budget['actionResourceBudget'],'unbounded':True}})
add('budget-wrong-plan-rejected',long,{**budget,'maxSteps':100})
oversize=copy.deepcopy(long);oversize['retainedDisplay']='x'*4194304;add('raw-bytes-limit',oversize,budget)
full=flow_sample()
large=flow_sample();large['steps']=large['steps'][:2]
rewrite(large['steps'][0],NFG=100,TFG=100,CFGG=0)
rewrite(large['steps'][1],NFG=101,TFG=102,CFGG=1)
add('large-award-valid-progress',large)
bad_large=copy.deepcopy(large);rewrite(bad_large['steps'][1],NFG=100,TFG=102,CFGG=2)
add('large-award-invalid-progress',bad_large)
for length in range(1,len(full['steps'])+1):add('free-prefix-'+str(length),{**full,'steps':full['steps'][:length]})
mixed=mixed_prefix()
for length in range(1,4):add('mixed-prefix-'+str(length),{**mixed,'steps':mixed['steps'][:length]})
for n in range(6,-1,-1):
 step=frame('FREE_GAME',n,8,8-n,'0|1|');step['methodName']='processGameMessage'
 rewrite(step,GSD='FGRS~9#FGTS~10#CFGC~1');mixed['steps'].append(step)
add('inner-terminal-keeps-outer-free',mixed)
step=frame('FREE_GAME',8,10,2);step['methodName']='processGameMessage';mixed['steps'].append(step)
add('outer-resume',mixed)
ordinary=flow_sample();ordinary['steps']=ordinary['steps'][:1]
rewrite(ordinary['steps'][0],FID=None,NFG=None,TFG=None,CFGG=None);add('ordinary-no-feature-fields',ordinary)
for changes in ({'FID':'1||'},{'FID':'2|'},{'NFG':8},{'CFGG':0},{'GCT':1},{'FRBAL':1},{'B':99990},{'TW':20},{'GSD':'ONE~1#ONE~2'},{'GSD':'FGTHNS~1~2'}):
 raw=flow_sample();rewrite(raw['steps'][1],**changes);add('bad-payload',raw)
for kind in ('xml','session','method','missing','after_terminal'):
 raw=flow_sample()
 if kind=='xml':raw['steps'][1]['responseXml']=raw['steps'][0]['responseXml']
 if kind=='session':raw['steps'][1]['requestPayload']=raw['steps'][1]['requestPayload'].replace('offline-pyramids-free','different')
 if kind=='method':raw['steps'][1]['methodName']='other'
 if kind=='missing':raw['steps'].pop(1)
 if kind=='after_terminal':raw['steps'].append(copy.deepcopy(raw['steps'][-1]))
 add(kind,raw)
print(json.dumps(dict(plan=PLAN,cases=cases)))
`;
 const p=spawnSync(process.env.PYTHON??'python',['-B','-c',script],{encoding:'utf8',maxBuffer:16*1024*1024,env:{...process.env,PYTHONUTF8:'1'}});
 assert.equal(p.status,0,p.stderr);const {plan,cases}=JSON.parse(p.stdout);
 for(const c of cases){
  const before=JSON.stringify(c.raw);
  if(c.accepted)assert.deepEqual(reviewPyramidsFlow(c.plan??plan,c.raw),c.result,c.name);
  else assert.throws(()=>reviewPyramidsFlow(c.plan??plan,c.raw),undefined,c.name);
  assert.equal(JSON.stringify(c.raw),before);
 }
 assert(cases.some(c=>c.name==='inner-terminal-keeps-outer-free'&&c.result.next));
 assert(cases.some(c=>c.result?.terminalCandidate));
});


test('direct layered BET requires new opt-in and rejects already progressed outer state',()=>{
 const script=`import sys,json
sys.path[:0]=['service','service/tests']
from test_pyramids_flow_review import PLAN,frame,rewrite
from test_pyramids_free_review import raw
s=frame('BET',6,6,0,'0|1|');s['methodName']='processGameMessage'
rewrite(s,GSD='FGRS~10#FGTS~10#CFGC~0')
print(json.dumps({'plan':PLAN,'raw':raw([s])}))`;
 const p=spawnSync(process.env.PYTHON,['-c',script],{encoding:'utf8'});assert.equal(p.status,0,p.stderr);
 const {plan,raw}=JSON.parse(p.stdout);
 assert.throws(()=>reviewPyramidsFlow(plan,raw),/FLOW_TRIGGER/);
 assert.deepEqual(reviewPyramidsFlow(plan,raw,{directLayeredEntry:true}).next,{MSGID:'FREE_GAME'});
 for(const state of ['FGRS~9#FGTS~10#CFGC~1','FGRS~0#FGTS~0#CFGC~0']){
  const bad=structuredClone(raw);const step=bad.steps[0],before=step.responsePayload;
  step.responsePayload=before.replace('FGRS~10#FGTS~10#CFGC~0',state);
  step.responseXml=step.responseXml.replace(before.replaceAll('&','&amp;'),step.responsePayload.replaceAll('&','&amp;'));
  assert.throws(()=>reviewPyramidsFlow(plan,bad,{directLayeredEntry:true}),/FLOW_LAYERED_TRIGGER/);
 }
});
