import assert from 'node:assert/strict';

// Jitter only after an explicit version conflict (known zero mutation). Never
// used for unknown confirmations or replay of a source request.
export function contentionDelay(attempt,random=Math.random){
 assert(Number.isSafeInteger(attempt)&&attempt>=0,'CAS_CONTENTION_ATTEMPT');
 const sample=random();assert(Number.isFinite(sample)&&sample>=0&&sample<1,'CAS_CONTENTION_RANDOM');
 const ceiling=Math.min(250,10+attempt*10);
 return Math.floor(ceiling/2+sample*ceiling/2);
}
