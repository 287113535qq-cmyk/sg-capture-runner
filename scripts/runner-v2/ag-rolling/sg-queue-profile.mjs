import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {stable} from '../mongo-writer.mjs';
import {validateSgPayload} from './sg-contract.mjs';
import {inspectFederation} from './sg-federation.mjs';
import {inspectWindowRecovery} from './sg-window-recovery-binding.mjs';
const digest=value=>createHash('sha256').update(stable(value)).digest('hex');
export function queueProfile({name,profile,authorization,plans,readBytes}){
 assert(/^ag-rolling-queue-[a-f0-9]{64}\.json$/.test(name??'')&&profile?.schema==='sg-ag-rolling-queue-v1'
  &&profile.group==='primary'&&profile.target===300000&&profile.lanes===20&&profile.sessionsPerLane===8
  &&profile.canaries===2&&profile.canaryRounds===10&&profile.stagingOveragePerLane===7,'SG_AG_QUEUE_PROFILE');
 const {activation,...unsigned}=profile;
 assert(activation===digest(unsigned)&&name===`ag-rolling-queue-${activation}.json`
  &&authorization?.schema==='sg-ag-rolling-authorizations-v1'&&authorization.sourceAllowance===0
  &&authorization.profiles?.[name]?.profileHash===digest(profile),'SG_AG_QUEUE_AUTHORIZATION');
 assert(/^[a-f0-9]{40}$/.test(profile.codeCommit??'')&&/^\d+$/.test(String(profile.linuxRun))
  &&plans.schema==='sg-ag-rolling-plan-registry-v1'&&plans.sourceAllowance===0
  &&profile.planRegistryHash===digest(plans),'SG_AG_QUEUE_CODE_PROOF');
 assert(/^[a-f0-9]{64}$/.test(profile.nativeGatewayHash??'')&&/^[a-f0-9]{64}$/.test(profile.nativeManifestHash??''),
  'SG_AG_NATIVE_INSTALLATION_BINDING');
 assert(Object.keys(profile.files??{}).length>=300&&typeof readBytes==='function','SG_AG_QUEUE_FILE_MANIFEST');
 for(const [file,hash] of Object.entries(profile.files)){
  assert(/^(scripts|service|collector|\.github)\/[A-Za-z0-9_./-]+$/.test(file)&&!file.includes('..')
   &&/^[a-f0-9]{64}$/.test(hash),'SG_AG_QUEUE_FILE_SCOPE');
  assert(createHash('sha256').update(readBytes(file).toString('utf8').replace(/\r\n/g,'\n')).digest('hex')===hash,
   'SG_AG_QUEUE_RUNTIME_CHANGED');
 }
 validateSgPayload(profile.payload,profile.manifest);
 if(profile.federation)inspectFederation(profile);
 if(profile.operation){
  if(profile.operation==='close-ended-window')inspectWindowRecovery(profile);
  else assert(profile.operation==='close-ended-admission'&&profile.sourceAllowance===0&&profile.preparationRecovery&&!profile.federation,'SG_AG_CONTROL_OPERATION');
 }
 assert(!profile.windowRecovery||profile.operation==='close-ended-window','SG_AG_WINDOW_RECOVERY_HAS_NO_SOURCE');
 if(profile.preparationRecovery){
  const r=profile.preparationRecovery;
  assert(profile.resume&&r.schema==='sg-ag-preparing-recovery-v1'
   &&Object.keys(r).sort().join(',')==='nativeSourceHash,schema,targetActivation,targetCommit,targetProfileHash,targetRun'
   &&/^[a-f0-9]{64}$/.test(r.targetActivation??'')&&r.targetActivation!==profile.activation
   &&/^[0-9]+:1$/.test(r.targetRun??'')&&/^[a-f0-9]{40}$/.test(r.targetCommit??'')
   &&/^[a-f0-9]{64}$/.test(r.targetProfileHash??'')&&/^[a-f0-9]{64}$/.test(r.nativeSourceHash??''),
   'SG_AG_PREPARING_RECOVERY_PROFILE');
 }
 if(profile.append)assert(profile.resume&&profile.append.schema==='sg-ag-rolling-append-v1'
  &&/^[a-f0-9]{64}$/.test(profile.append.previousPayloadHash??'')
  &&/^[a-f0-9]{64}$/.test(profile.append.previousManifestHash??'')
  &&/^[a-f0-9]{64}$/.test(profile.append.emptyEvidenceHash??'')
  &&Array.isArray(profile.append.gameBindings)&&profile.append.gameBindings.length>0,'SG_AG_QUEUE_APPEND_PROFILE');
 for(const game of profile.payload.games){
  const plan=plans.plans[game.gameId],proof=plans.proofs[game.gameId],entry=profile.manifest.find(g=>g.gameId===game.gameId);
  assert(plan&&String(plan.gameId)===game.gameId&&plan.buy===0&&plan.target===300000&&game.baseline===0
   &&game.mongoUri===`sg-native://primary/${game.dbName}`&&entry.planHash===digest(plan)
   &&entry.adapterProofHash===digest(proof)&&proof.planHash===digest(plan)&&proof.acceptedBaseRounds>=10
   &&proof.formalAdmission==='requires-two-AG-live-canaries'
   &&!plans.alreadyComplete.includes(plan.gameId),'SG_AG_QUEUE_GAME_BINDING');
 }
 return profile;
}
export {digest as queueHash};
