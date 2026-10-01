import test from 'node:test';import assert from 'node:assert/strict';import {windowTiming} from './window-timing.mjs';
const step=(at,t={schema:'sg-source-timing-v1',headersMs:900,bodyMs:1,totalMs:901})=>({ts:new Date(at).toISOString(),msgId:'Logic',sourceTiming:t});
test('streaming windows count complete records and bounded request tails without raw output',()=>{
 const a=windowTiming(0,1200000);for(const at of [0,590000,600000,1199999])a.record({raw:{steps:[step(at)]}});
 const r=a.finish();assert.equal(r.windows.length,2);assert.deepEqual(r.windows.map(w=>w.complete),[2,2]);assert.equal(r.windows[0].histograms['Logic.totalMs'].p95UpperMs,1000);assert.equal(r.windows[0].stableIntervalCandidate,true);assert.equal(r.sourceRequests,0);assert(!JSON.stringify(r).includes('responsePayload'));
});
test('missing or inconsistent timing and short observation never qualify as stable',()=>{
 const a=windowTiming(0,700000);a.record({raw:{steps:[step(1,null),step(2,{schema:'sg-source-timing-v1',headersMs:100,bodyMs:10,totalMs:90}),step(600001)]}});
 const r=a.finish();assert.equal(r.windows[0].missing,1);assert.equal(r.windows[0].invalid,1);assert(r.windows.every(w=>!w.stableIntervalCandidate));assert.equal(r.windows[1].fullTenMinuteInterval,false);
 assert.throws(()=>windowTiming(0,Infinity));
});
