import assert from 'node:assert/strict';

export const repositories = Object.freeze({
  'zyzuoyang/sg-capture-runner': {name:'primary', offset:0},
  '287113535qq-cmyk/sg-capture-runner': {name:'secondary', offset:20},
});

export function globalShard(local, plan, repository) {
  assert(Number.isInteger(local) && local>=0 && local<20, 'BAD_LOCAL_SHARD');
  const group = repositories[repository];
  assert(group, 'RUNNER_REPOSITORY_NOT_ALLOWED');
  assert(group.offset===0 || plan?.campaignId==='sg_round_one_20260928' && plan.phase===1
    && plan.buy===0 && plan.schema==='sg-work-pool-v1', 'SECONDARY_ROUND_ONE_ONLY');
  return local + group.offset;
}
