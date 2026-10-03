import fs from 'node:fs';import path from 'node:path';
import {protocolHash as hash} from './protocol-resume.mjs';
import {preparedCountAuthorization} from './prepared-count-authorization.mjs';
import {preparedCountPlan} from './prepared-count-plan.mjs';

// Historical evidence interpretation only. These filenames cannot come from
// a mailbox; Python still independently validates the exact original plan.
const profiles=[
 ['SG_FORMAL_COUNT_PROFILE','formal-repair-pyramids-action-20261002.json'],
 ['SG_FORMAL_COUNT_PROFILE','formal-repair-pyramids-direct-action-20261002.json'],
 ['SG_FORMAL_COUNT_PROFILE','formal-repair-pyramids-resume-action-20261002.json'],
 ['SG_FORMAL_COUNT_PROFILE','formal-repair-pyramids-action-budget-20261002.json'],
 ['SG_DEMO_PILOT_PROFILE','demo-pilot-veryfruity-action-revision3-20261003.json']
];
export function offlineAnalysisEnvironment(root,plan,ambient=process.env){
 const env={...ambient,PYTHONUTF8:'1'};
 delete env.SG_FORMAL_COUNT_PROFILE;delete env.SG_DEMO_PILOT_PROFILE;
 const registryFile=path.join(root,'config/prepared-count-authorizations.json');
 if(plan.countAllocation&&fs.existsSync(registryFile)){
  const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
  const registry=read('config/prepared-count-authorizations.json');
  const name=`formal-prepared-count-${plan.gameId}-${plan.countAllocation}.json`;
  if(registry.profiles?.[name]){
   const authorization=preparedCountAuthorization(name,read);
   const expected=preparedCountPlan(read('config/round-one-plans.json')[plan.gameId],read('config/'+name),authorization);
   if(hash(expected)!==hash(plan))throw Error('ANALYSIS_PREPARED_PLAN_CHANGED');
   env.SG_FORMAL_COUNT_PROFILE=name;return env;
  }
 }
 const matches=profiles.filter(([,name])=>{
  const file=path.join(root,'config',name);if(!fs.existsSync(file))return false;
  const p=JSON.parse(fs.readFileSync(file,'utf8'));return p.gameId===plan.gameId&&p.planHash===hash(plan);
 });
 if(matches.length>1)throw Error('ANALYSIS_PROFILE_AMBIGUOUS');
 if(matches.length)env[matches[0][0]]=matches[0][1];
 return env;
}
