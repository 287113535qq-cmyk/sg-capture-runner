import assert from 'node:assert/strict';

export function countControlPolicy(mode,profile,runtimeProfile){
 const isRhino=['sg-formal-count-rhino-v1','sg-formal-count-rhino-v2'].includes(profile.schema);
 const isSessions=['sg-session-layout-profile-v1','sg-session-layout-rhino-v1'].includes(profile.schema);
 const isRepair=['sg-formal-repair-profile-v1','sg-formal-repair-profile-v2'].includes(profile.schema);
 const initialWindow=runtimeProfile==='count-runtime-rhino-measurement-20261001.json';
 const observationWindow=runtimeProfile==='count-runtime-rhino-two-observation-20261001.json';
 const continuousCount=['count-runtime-rhino-continuous-20261001.json','count-runtime-rhino-ag-continuation-20261001.json'].includes(runtimeProfile);
 assert(!isSessions||['sessions','admit'].includes(mode)||(mode==='refresh'&&(observationWindow||continuousCount)),'SESSION_CONTROL_OPERATION');
 assert(mode!=='sessions'||isSessions,'SESSION_CONTROL_PROFILE');
 assert(!runtimeProfile||initialWindow||observationWindow||continuousCount||runtimeProfile==='count-runtime-pearl-observation-20261001.json','COUNT_RUNTIME_PROFILE_PATH');
 assert(!runtimeProfile||(['refresh','admit'].includes(mode)&&(initialWindow?profile.schema==='sg-formal-count-rhino-v2':(observationWindow||continuousCount)?profile.schema==='sg-session-layout-rhino-v1'&&profile.sessionLayout?.lanesPerHost===2:profile.schema==='sg-formal-repair-profile-v2')),'COUNT_RUNTIME_REFRESH_SCOPE');
 assert(!isRhino||['activate','admit'].includes(mode)||(mode==='refresh'&&initialWindow),'RHINO_FORMAL_OPERATION');
 assert(mode!=='repair'||isRepair,'FORMAL_REPAIR_PROFILE_REQUIRED');
 assert(!isRepair||['repair','admit','refresh'].includes(mode),'FORMAL_REPAIR_OPERATION');
 assert(mode!=='refresh'||runtimeProfile,'COUNT_RUNTIME_PROFILE_REQUIRED');
 return {isRhino,isSessions,isRepair,initialWindow,observationWindow,continuousCount};
}
