import {reviewPyramidsRetrigger} from '../trial/pyramids-retrigger-review.mjs';
// Only explicit adapter gaps are game-local. Source rejections, ambiguous
// replies, money errors and storage failures retain the shared stop policy.
const adapterGaps = new Set([
  'MEGAHAT_UNREVIEWED',
  'INCA_UNREVIEWED_GSD', 'INCA_UNREVIEWED_FREE_ROUNDS',
  'INCA_UNREVIEWED_COIN', 'INCA_UNREVIEWED_JACKPOT',
  'PYRAMIDS_UNREVIEWED_GSD', 'PYRAMIDS_UNREVIEWED_FEATURE', 'PYRAMIDS_FREE_UNREVIEWED_GSD', 'PYRAMIDS_FREE_UNREVIEWED_FREE_ROUNDS',
  'UNSUPPORTED_PYRAMIDS_FREE_NESTED_COUNTER', 'UNSUPPORTED_PYRAMIDS_FREE_TERMINATION',
  'PYRAMIDS_FREE_COIN_PREFIX_ONLY', 'PYRAMIDS_FREE_UNREVIEWED_COIN',
  'PYRAMIDS_SUPER_HOLD_PREFIX_ONLY', 'PYRAMIDS_SUPER_HOLD_SCOPE',
  'PYRAMIDS_RETRIGGER_NOT_ADAPTED',
  'UNSUPPORTED_INCA_NESTED_COUNTER', 'UNSUPPORTED_INCA_TERMINATION',
  'UNKNOWN_TRIAL_FEATURE', 'UNKNOWN_JACKPOT_FEATURE', 'HUFF_FEATURE_NOT_ADAPTED',
  'UNSUPPORTED_BEAVER_NESTED_FEATURE', 'MOREPUFF_FEATURE_NOT_ADAPTED',
  'UNSUPPORTED_JINZITA_NESTED_COUNTER', 'UNSUPPORTED_JINZITA_TERMINATION',
  'HUFF_UNKNOWN_TOUCHUP_FIELD', 'HUFF_COMBINED_EXIT_NOT_ADAPTED',
  'HUFF_FRAME_EXIT_NOT_ADAPTED', 'HUFF_TOUCHUP_TRANSITION_NOT_ADAPTED',
  'HUFF_TOUCHUP_PROGRESS_NOT_ADAPTED', 'HUFF_TOUCHUP_TRIGGER_REQUIRED',
  'HUFF_TOUCHUP_AWARD_REQUIRED', 'HUFF_MISSING_FRAME_AWARDS',
  'HUFF_UNREVIEWED_FEATURE_SLOTS',
  'HARDHAT_FEATURE', 'HARDHAT_UNREVIEWED', 'HARDHAT_UNKNOWN_FIELD',
  'HARDHAT_COMBINED_EXIT', 'HARDHAT_PREVIOUS_SLOTS',
  'PIGGIES_FEATURE_NOT_ADAPTED', 'PIGGIES_SIZE_TWO_COMBINATION', 'PIGGIES_SIZE_TWO_TRIGGER',
  'PEARL_FEATURE_NOT_ADAPTED',
  'RHINO_UNKNOWN_FEATURE', 'RHINO_FEATURE', 'RHINO_WILD_MULTIPLIER',
]);
export const isAdapterGap = code => adapterGaps.has(code);

// Counter errors alone remain shared failures. Only a fully validated,
// unfinished +10 cash prefix may be parked as an adapter gap; this does not
// authorize another request or approve a terminal record.
export function reviewedAdapterFailure(code,raw){
  if(code!=='PYRAMIDS_FREE_COUNTERS'||raw?.steps?.length<3)return code;
  try{
    const result=reviewPyramidsRetrigger(raw);
    if(result.complete||result.next!=='FREE_GAME')return code;
    const totals=raw.steps.map(s=>Number(new URLSearchParams(s.responsePayload).get('TFG')));
    return totals.some((t,i)=>i>0&&t===totals[i-1]+10)?'PYRAMIDS_RETRIGGER_NOT_ADAPTED':code;
  }catch{return code;}
}
