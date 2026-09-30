// Only explicit adapter gaps are game-local. Source rejections, ambiguous
// replies, money errors and storage failures retain the shared stop policy.
const adapterGaps = new Set([
  'UNKNOWN_TRIAL_FEATURE', 'UNKNOWN_JACKPOT_FEATURE', 'HUFF_FEATURE_NOT_ADAPTED',
  'UNSUPPORTED_BEAVER_NESTED_FEATURE',
  'UNSUPPORTED_JINZITA_NESTED_COUNTER', 'UNSUPPORTED_JINZITA_TERMINATION',
]);
export const isAdapterGap = code => adapterGaps.has(code);
