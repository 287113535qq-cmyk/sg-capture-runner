import assert from 'node:assert/strict';
export function assertNewTwoBusinessGameIds(ids){
 assert(Array.isArray(ids)&&ids.length===1&&['32595','32730'].includes(ids[0]),'SG_BUSINESS_NEW_TWO_EXCLUSIVE_GAME');
 return ids[0];
}
