import assert from 'node:assert/strict';
export function demoPilotProfilePath(env=process.env){
 const name=env.SG_DEMO_PILOT_PROFILE||'demo-pilot-beaver-20260930.json';
 assert(['demo-pilot-veryfruity-action-revision2-20261003.json','demo-repair-rhino-guarantee-20261001.json','demo-pilot-pyramids-20261001.json','demo-pilot-inca-20261001.json','demo-repair-mansion-20261001.json','demo-repair-piggies-20261001.json','demo-repair-morepuff-20261001.json','demo-pilot-rhino-20261001.json','demo-pilot-pearl-20260930.json','demo-pilot-piggies-20260930.json','demo-pilot-mansion-20260930.json','demo-pilot-morepuff-20260930.json','demo-pilot-jinzita-20260930.json','demo-pilot-luxor-20260930.json','demo-pilot-beaver-20260930.json','demo-pilot-replacement-20260930.json','demo-residual-beaver-20260930.json'].includes(name),'DEMO_PROFILE_PATH');
 return 'config/'+name;
}

export function checkRhinoCandidateSource(profile,{repair=false}={}){
 if(profile.gameId!==32799)return;
 if(repair)assert(profile.repairedCandidate&&!profile.emptyCandidate&&!profile.sourceFormal&&/^[a-f0-9]{64}$/.test(profile.sourceClosureHash??''),'RHINO_REPAIR_BOUNDARY_REQUIRED');
 else assert(profile.sourceFormal?.schema==='sg-formal-source-boundary-v1'&&profile.emptyCandidate&&!profile.legacyImport,'RHINO_SOURCE_BOUNDARY_REQUIRED');
}
