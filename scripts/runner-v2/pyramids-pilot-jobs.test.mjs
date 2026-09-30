import test from 'node:test';import assert from 'node:assert/strict';
import {reviewPyramidsPilotJobs} from './pyramids-count-profile.mjs';
const fixture=()=>{const jobs=[{name:'secondary-admit',status:'completed',conclusion:'success'},...Array.from({length:20},(_,i)=>({name:`fresh-capture-${i}`,status:'completed',conclusion:'success'})),{name:'capture-${{ matrix.shard }}',status:'completed',conclusion:'skipped'}];return {total_count:jobs.length,jobs};};
test('Pyramids pilot uses all twenty distinct fresh-capture jobs',()=>{
 assert.doesNotThrow(()=>reviewPyramidsPilotJobs(fixture()));
 for(const mutate of [v=>v.jobs[1].name='capture-0',v=>v.jobs[1].name='fresh-capture-1',v=>v.jobs[1].conclusion='skipped',v=>v.jobs[0].conclusion='skipped',v=>v.total_count++,v=>v.jobs[1].status='in_progress']){
  const v=fixture();mutate(v);assert.throws(()=>reviewPyramidsPilotJobs(v),/PYRAMIDS_COUNT_SOURCE_JOBS/);
 }
});
