import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {connectGateway} from './transport.mjs';import {ResourceGate} from './resource-gate.mjs';import {RunnerState} from './state-store.mjs';import {analyzer} from './analyzer.mjs';
import {authenticatedRead} from './github-boundary.mjs';import {maintenanceBoundary} from './demo-run-fence.mjs';import {checkPrimaryLeases} from './lease-boundary.mjs';
import {nextDemoGame} from './demo-next-game.mjs';
import {demoPilotProfilePath} from './demo-pilot-profile.mjs';
import {importParkedDemo} from './parked-import.mjs';import {decodeParkedArchive} from './parked-decoder.mjs';
assert(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REPOSITORY==='zyzuoyang/sg-capture-runner','PRIMARY_GITHUB_REQUIRED');
const load=p=>JSON.parse(fs.readFileSync(p,'utf8')),path=demoPilotProfilePath(),profile=load(path),plans=load('config/round-one-plans.json');
const scope={'config/demo-pilot-luxor-20260930.json':[32835,32820,82,1], 'config/demo-pilot-jinzita-20260930.json':[32720,32835,320,2]}[path];
assert(scope&&profile.gameId===scope[0]&&profile.fromGameId===scope[1]&&profile.completePreserved===scope[2]&&profile.abandonedAttempts===scope[3],'NEXT_GAME_PROFILE_SCOPE');
assert((profile.gameId===32720)===!!profile.legacyImport,'NEXT_GAME_IMPORT_SCOPE');
for(const [path,expected] of Object.entries(profile.files)){
 assert(/^(scripts|service|collector|\.github)\/[a-zA-Z0-9_./-]+$/.test(path)&&!path.includes('..'),'NEXT_GAME_FILE_SCOPE');
 assert(createHash('sha256').update(fs.readFileSync(path,'utf8').replace(/\r\n/g,'\n')).digest('hex')===expected,'NEXT_GAME_RUNTIME_CHANGED');
}
const run=process.env.GITHUB_RUN_ID+':'+process.env.GITHUB_RUN_ATTEMPT,commit=process.env.GITHUB_SHA,read=authenticatedRead(process.env.GH_TOKEN);
const transport=connectGateway(),gate=new ResourceGate(),store=new RunnerState({transport,gate,deadline:Date.now()+30*60000}),parser=analyzer();
const idle=maintenanceBoundary({read,store,oldProfile:load('config/demo-pilot-beaver-20260930.json'),run,commit});
try{
 const boundary=async()=>{
  assert(Date.now()>=profile.createdAt&&Date.now()<profile.expiresAt,'NEXT_GAME_PROFILE_STALE');await idle();
  const ended=await read('repos/zyzuoyang/sg-capture-runner/actions/runs/'+profile.sourceRunKey.split(':')[1]);
  const jobs=await read('repos/zyzuoyang/sg-capture-runner/actions/runs/'+ended.id+'/jobs?filter=all&per_page=100');
  assert('capture-run:'+ended.id+':'+ended.run_attempt===profile.sourceRunKey&&ended.head_sha===profile.sourceCommit&&ended.status==='completed'&&ended.conclusion==='success'&&ended.path==='.github/workflows/trial-300k.yml'&&ended.repository.full_name==='zyzuoyang/sg-capture-runner'&&jobs.total_count===jobs.jobs.length&&jobs.total_count<100&&jobs.jobs.every(j=>j.status==='completed'),'NEXT_GAME_SOURCE_NOT_FINISHED');
  await store.writable();assert(gate.status().metrics.diskFreeBytes>=30*1024**3,'DISK_RESERVE_REQUIRED');await checkPrimaryLeases({store,plans});
  const holds=await transport.request('global_holds');assert(holds.length===2&&holds.every(r=>r.value.active===false),'GLOBAL_HOLD');
 };
 if(profile.legacyImport)await importParkedDemo({store,transport,decode:decodeParkedArchive,plan:plans[profile.gameId],profile,boundary,commit,run});
 console.log(JSON.stringify(await nextDemoGame({store,transport,gate,parser,plans,profile,boundary,commit,run})));
}catch(error){console.log(JSON.stringify({error:/^[A-Z_]{1,100}$/.test(error.message)?error.message:'NEXT_GAME_REQUIRES_REVIEW',sourceRequests:0}));process.exitCode=2;}
finally{parser.close();transport.close();}
