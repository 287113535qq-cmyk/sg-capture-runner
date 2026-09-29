import assert from 'node:assert/strict';
export function demoPilotProfilePath(env=process.env){
 const name=env.SG_DEMO_PILOT_PROFILE||'demo-pilot-beaver-20260930.json';
 assert(['demo-pilot-beaver-20260930.json','demo-pilot-replacement-20260930.json'].includes(name),'DEMO_PROFILE_PATH');
 return 'config/'+name;
}
