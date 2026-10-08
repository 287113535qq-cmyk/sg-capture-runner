import {ownOrdinaryV2Plan,ownOrdinaryBinding,ownOrdinaryDecoder} from './sg-own-wms-ordinary-wiring-v2.mjs';
import assert from 'node:assert/strict';
import {queueHash} from './sg-queue-profile.mjs';
import {stable} from '../mongo-writer.mjs';
import * as own32752 from './sg-acorn-base.mjs';
import * as own32759 from './sg-crystalforest-base.mjs';
import * as own32764 from './sg-dragonspin-base.mjs';
import * as own32770 from './sg-giantsgold-base.mjs';
import * as own32774 from './sg-himalayas-base.mjs';
export const WMS_FIVE_PINS=Object.freeze({"32752":{"planHash":"28688a14de2548fe878ce7e1150627947b8a12e4c9e5ddadd942dda8421aee8a","proofHash":"2e79cadbd7f69d21401f9aaea7df80be79727f2936e6bb78894b48efba92075b","bindingHash":"4aac279c93a3c7800c02ebcbc6b0a8ebc68887f773961455506065d405b5d949"},"32759":{"planHash":"c28cf91528296fd7e0b7b56f3a21a3ce58b7d8fd2f68baa39c28adb4edbe0643","proofHash":"3787732824b4419e5ee36f160672e31b881ab36797c4d652919108710e70c14c","bindingHash":"03a52169f5afee423936d6cd9270c3f0ce2e5797f8afb6605d8752bfe28f308e"},"32764":{"planHash":"ba8de90a743694ce188cd987d45f8e53d35b7c576ec004c9b09dbda9eb75b810","proofHash":"83d68a4b4c044d76de792fba3d84042957650d20d1ad106e6612bc600e644129","bindingHash":"b267f8b932fd309c4b3b633519cc8a7cf58bbd60edeae20ff6c2bce95d4cfde6"},"32770":{"planHash":"f70fb45f6c1c483b670b193f471771d03eaed7e0012ceb310a8c75e1ca69cb0b","proofHash":"9cd2a2f77f7abe25eb2bff67714f93b00c55109f876bca43e21ec84e16dcbe18","bindingHash":"950246d3187ae3dcf1999470e42d833d74a04c6e5da3489e971681ec0783bac0"},"32774":{"planHash":"63026b6314e34fbd7891867c07bd0ba8cfc05d4f95fd0257d9e4570556b87e58","proofHash":"42542b2ce1c3652602bf545084a6ea158c0c969fa5fd330661c4740539c91e3c","bindingHash":"296893bdcc573e8dc78edb03d5475050afb7d03d1a99124707f791b257b3c1a2"}});
const OWN={'32752':own32752,'32759':own32759,'32764':own32764,'32770':own32770,'32774':own32774};
export const ORIGINAL_BUSINESS_IDS=Object.freeze(["32441", "32442", "32443", "32464", "32474", "32476", "32477", "32486", "32489", "32497", "32500", "32501", "32502", "32503", "32504", "32514", "32529", "32530", "32532", "32536", "32544", "32545", "32547", "32548", "32550", "32555", "32590", "32595", "32614", "32615", "32616", "32617", "32618", "32620", "32621", "32626", "32629", "32631", "32632", "32634", "32635", "32637", "32641", "32644", "32681", "32686", "32687", "32689", "32691", "32703", "32705", "32706", "32707", "32708", "32709", "32712", "32713", "32715", "32716", "32722", "32724", "32725", "32727", "32728", "32729", "32730", "32731", "32732", "32733", "32734", "32735", "32738", "32740", "32741", "32742", "32743", "32744", "32749", "32821", "32832", "32839"]);
export function ownWmsBusinessPlan(plan){return ownOrdinaryV2Plan(plan)||!!plan&&!!WMS_FIVE_PINS[String(plan.gameId)]&&queueHash(plan)===WMS_FIVE_PINS[String(plan.gameId)].planHash;}
export function assertOwnWmsBinding(plan,binding){if(ownOrdinaryV2Plan(plan))return ownOrdinaryBinding(plan,binding);assert(ownWmsBusinessPlan(plan)&&queueHash(binding)===WMS_FIVE_PINS[String(plan.gameId)].bindingHash,'SG_WMS_OWN_EXACT_BINDING');return true;}
export function ordinaryBusinessAdapter(plan){return plan?.adapter==='native-nextgen-v1'||ownWmsBusinessPlan(plan);}
export function assertBusinessGameScope(games,plans){
 const ids=games.map(g=>g.gameId).sort();
 assert(new Set(ids).size===ids.length,'SG_BUSINESS_SCOPE_DUPLICATE');
 if(ids.length===81){assert(stable(ids)===stable(ORIGINAL_BUSINESS_IDS),'SG_BUSINESS_ORIGINAL_SCOPE_CHANGED');return 81;}
 assert(stable(ids)===stable([...ORIGINAL_BUSINESS_IDS,...Object.keys(WMS_FIVE_PINS)].sort()),'SG_BUSINESS_EXACT_FIVE_APPEND_REQUIRED');
 for(const id of Object.keys(WMS_FIVE_PINS))assert(ownWmsBusinessPlan(plans[id]),'SG_WMS_OWN_PLAN');return 86;
}
export async function verifyOwnWmsBusinessPage({plan,records,parser}){
 assert(ownWmsBusinessPlan(plan),'SG_WMS_OWN_PLAN');
 assert(Array.isArray(records)&&records.length>0&&records.length<=100&&new Set(records.map(r=>r._id)).size===records.length&&new Set(records.map(r=>r.sequence)).size===records.length,'SG_WMS_PAGE_IDENTITY');
 const revised=ownOrdinaryV2Plan(plan);
 for(const r of records){
  const own=revised?ownOrdinaryDecoder(plan,r.raw):OWN[String(plan.gameId)];
  assert(r.gameId===plan.gameId&&r.runtimeGameId===plan.runtimeGameId&&r.trialId===plan.trialId&&r.fixtureOnly===false&&r.raw.fixtureOnly===false&&r.raw.protocol==='wms'&&r.raw.sourceKey===(revised?own.SOURCE:plan.sourceKey),'SG_WMS_NATIVE_SCOPE');
  assert(stable(own.settled(r.raw,r.normalized.typeMappingHash))===stable(r.normalized),'SG_WMS_BUSINESS_JS_FIELDS');
 }
 const result=await parser.verifyPage(plan,[...records].sort((a,b)=>a.sequence-b.sequence));
 assert(result?.verified===true&&result.count===records.length,'SG_WMS_BUSINESS_PYTHON_FIELDS');return result;
}
