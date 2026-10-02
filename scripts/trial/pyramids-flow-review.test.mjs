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
def add(name,raw):
 try: result=review_pyramids_flow(PLAN,raw);accepted=True
 except Exception: result=None;accepted=False
 cases.append(dict(name=name,raw=raw,accepted=accepted,result=result))
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
 const p=spawnSync(process.env.PYTHON??'python',['-B','-c',script],{encoding:'utf8',env:{...process.env,PYTHONUTF8:'1'}});
 assert.equal(p.status,0,p.stderr);const {plan,cases}=JSON.parse(p.stdout);
 for(const c of cases){
  const before=JSON.stringify(c.raw);
  if(c.accepted)assert.deepEqual(reviewPyramidsFlow(plan,c.raw),c.result,c.name);
  else assert.throws(()=>reviewPyramidsFlow(plan,c.raw),undefined,c.name);
  assert.equal(JSON.stringify(c.raw),before);
 }
 assert(cases.some(c=>c.name==='inner-terminal-keeps-outer-free'&&c.result.next));
 assert(cases.some(c=>c.result?.terminalCandidate));
});
