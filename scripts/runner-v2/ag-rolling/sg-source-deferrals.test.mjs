import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inspectSourceDeferrals,sourceEligibleView} from './sg-source-deferrals.mjs';
function fixture(){
 const games=['32502','32741'].map(gameId=>({gameId})),manifest=games.map(g=>({...g,planHash:'a'.repeat(64)}));
 const resume={previousActivation:'b'.repeat(64),previousRun:'123:1',endedProofHash:'c'.repeat(64)};
 const rows=[{gameId:'32502',planHash:'a'.repeat(64),reason:'OWN_UNRESOLVED_FEATURE_FAULT'}];
 const e={schema:'sg-ag-source-deferral-evidence-v1',...resume,sourceJobsEnded:true,games:rows,
  origins:[{file:'own-closed-faults.json',sha256:'d'.repeat(64)}],sourceRequests:0,databaseWrites:0,completedCredit:0};
 const bytes=Buffer.from(JSON.stringify(e)),sha=createHash('sha256').update(bytes).digest('hex');
 const profile={payload:{queueId:'same',games},manifest,resume,fullAgControl:{completedBusinessReceipts:{}},
  sourceDeferrals:{schema:'sg-ag-source-deferrals-v1',previousActivation:resume.previousActivation,previousRun:resume.previousRun,
   games:rows,evidenceFile:`config/ag-source-deferrals-${sha}.json`,evidenceSha256:sha}};
 return {profile,bytes,view:{payload:profile.payload,manifest},e};
}
test('source lanes omit only evidenced deferred games and keep original order and namespaces',()=>{
 const f=fixture(),before=structuredClone(f.profile);assert.deepEqual([...inspectSourceDeferrals(f.profile,()=>f.bytes)],['32502']);
 const next=sourceEligibleView(f.profile,f.view);assert.deepEqual(next.payload.games,[f.profile.payload.games[1]]);
 assert.deepEqual(next.deferred,['32502']);assert.equal(next.payload.queueId,'same');assert.deepEqual(f.profile,before);
});
test('old profiles keep their entire AG view',()=>{const f=fixture();delete f.profile.sourceDeferrals;assert.deepEqual(sourceEligibleView(f.profile,f.view).payload,f.view.payload);});
test('a changed plan cannot inherit an old deferral binding',()=>{const f=fixture();f.profile.manifest[0].planHash='e'.repeat(64);assert.throws(()=>inspectSourceDeferrals(f.profile),/DEFERRAL_GAME/);});
test('completed-game exclusions and unknown game IDs cannot hide completion accounting',()=>{for(const modify of [f=>f.profile.fullAgControl.completedBusinessReceipts['32502']={},f=>f.profile.sourceDeferrals.games[0].gameId='32503']){const f=fixture();modify(f);assert.throws(()=>inspectSourceDeferrals(f.profile),/DEFERRAL_GAME/);}});
test('duplicate policy entries and mismatched prior generation fail closed',()=>{for(const modify of [f=>f.profile.sourceDeferrals.games.push(f.profile.sourceDeferrals.games[0]),f=>f.profile.sourceDeferrals.previousRun='999:1']){const f=fixture();modify(f);assert.throws(()=>inspectSourceDeferrals(f.profile));}});
test('tampered evidence bytes fail before source selection',()=>{const f=fixture();assert.throws(()=>inspectSourceDeferrals(f.profile,()=>Buffer.from('{}')),/EVIDENCE_HASH/);});
test('unended evidence or fabricated completion credit is never admitted',()=>{for(const patch of [{sourceJobsEnded:false},{completedCredit:1},{endedProofHash:'e'.repeat(64)}]){const f=fixture();const bytes=Buffer.from(JSON.stringify({...f.e,...patch})),sha=createHash('sha256').update(bytes).digest('hex');Object.assign(f.profile.sourceDeferrals,{evidenceFile:`config/ag-source-deferrals-${sha}.json`,evidenceSha256:sha});assert.throws(()=>inspectSourceDeferrals(f.profile,()=>bytes),/DEFERRAL_EVIDENCE/);}});
test('an entirely deferred cohort returns no source tasks without changing the inventory',()=>{const f=fixture();f.view={payload:{...f.profile.payload,games:[f.profile.payload.games[0]]},manifest:[f.profile.manifest[0]]};const v=sourceEligibleView(f.profile,f.view);assert.equal(v.payload.games.length,0);assert.equal(f.profile.payload.games.length,2);});


test('a separately evidenced unsettled merge is removed from admission baselines and lane work without a completion claim',()=>{
 const f=fixture();f.profile.sourceDeferrals.games[0].reason='OWN_UNSETTLED_NATIVE_MERGE';
 const before=structuredClone(f.profile),view=sourceEligibleView(f.profile,{payload:f.profile.payload,manifest:f.profile.manifest});
 assert.deepEqual(view.payload.games.map(g=>g.gameId),['32741']);assert.deepEqual(f.profile,before);
 assert.equal(f.profile.fullAgControl.completedBusinessReceipts['32502'],undefined);
});
