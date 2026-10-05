import assert from 'node:assert/strict';
export function assertPolterheistBusinessGameIds(ids){
 assert(Array.isArray(ids)&&ids.length===1&&ids[0]==='32731','SG_BUSINESS_POLTERHEIST_EXCLUSIVE_GAME');
 return ids[0];
}
