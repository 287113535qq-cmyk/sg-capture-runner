import {hasPyramidsSuperCoins,superCoinFields} from './sg.pyramids-super-coins';
import {hasPyramidsSuperFree,superFreeFields} from './sg.pyramids-super-free';
import {hasPyramidsCashCoins,cashCoinFields} from './sg.pyramids-coins';
import {hasPyramidsRetrigger,retriggerFields} from './sg.pyramids-retrigger';
import {pyramidsFields} from './sg.pyramids';
import {hasPyramidsFifteen,fifteenFields} from './sg.pyramids-fifteen';
import {hasPyramidsSuperHold,superHoldFields} from './sg.pyramids-super-hold';
import {hasPyramidsMixed,reviewMixedCollector} from './sg.pyramids-mixed';
import {incaFields} from './sg.inca';
import {hasHuffRetrigger,huffRetriggerFields} from './sg.huff-retrigger';
import {validatePiggies} from './sg.piggies';
import {hasMorepuffWheel,morepuffFields} from './sg.morepuff';
import {hasHuffTouchup,huffTouchupFields} from './sg.huff-touchup';
import {jinzitaFields} from './sg.jinzita';
import {luxorFields} from './sg.luxor';
import {beaverFields} from './sg.beaver';
import {validateDemonNestedMapping} from './sg.demon';
import { buildRoundDoc, SGTrafficEntry } from './sg.round';
import { ROUND_FIELDS_VERSION } from './sg.fields';

/** Prepare a NextGen captured round for the business-field transport contract.
 * Mapping values must come from the reviewed per-game policy; the server checks
 * them against the raw protocol and its own pinned policy again before writing.
 */
export function prepareNextgenRound(raw: any, mapping: { buy: number; bonus: number; typeMappingHash: string }) {
  if(hasPyramidsSuperCoins(raw)){
    if(mapping.buy!==0||mapping.bonus!==10)throw Error('SG_PYRAMIDS_SUPER_COIN_MAPPING_MISMATCH');
    return superCoinFields(raw,mapping.typeMappingHash);
  }
  if(hasPyramidsCashCoins(raw)){
    if(mapping.buy!==0||mapping.bonus!==9)throw Error('SG_PYRAMIDS_COIN_MAPPING_MISMATCH');
    return cashCoinFields(raw,mapping.typeMappingHash);
  }
  if(hasPyramidsRetrigger(raw)){
    if(mapping.buy!==0||mapping.bonus!==8)throw Error('SG_PYRAMIDS_RETRIGGER_MAPPING_MISMATCH');
    return retriggerFields(raw,mapping.typeMappingHash);
  }
  if(hasPyramidsSuperFree(raw)){
    if(mapping.buy!==0||mapping.bonus!==7)throw Error('SG_PYRAMIDS_SUPER_FREE_MAPPING_MISMATCH');
    return superFreeFields(raw,mapping.typeMappingHash);
  }
  if(hasPyramidsSuperHold(raw)){
    if(mapping.buy!==0||mapping.bonus!==6)throw Error('SG_PYRAMIDS_SUPER_HOLD_MAPPING_MISMATCH');
    return superHoldFields(raw,mapping.typeMappingHash);
  }
  if(hasPyramidsFifteen(raw)){
    if(mapping.buy!==0||mapping.bonus!==5)throw Error('SG_PYRAMIDS_FIFTEEN_MAPPING_MISMATCH');
    return fifteenFields(raw,mapping.typeMappingHash);
  }
  if(hasPyramidsMixed(raw)){
    const result=reviewMixedCollector(raw,mapping.typeMappingHash);
    if(!result.complete||!result.fields||mapping.buy!==0||mapping.bonus!==4)throw Error('SG_PYRAMIDS_MIXED_MAPPING_MISMATCH');
    return result.fields;
  }
  if(raw.sourceKey==='hyperchargedpyramidsofra96-round-one-base-v1'){
    const value=pyramidsFields(raw,mapping.typeMappingHash,mapping.bonus===3);
    if(value.buy!==mapping.buy||value.bonus!==mapping.bonus)throw Error('SG_PYRAMIDS_MAPPING_MISMATCH');
    return value;
  }
  if(raw.sourceKey==='richlittlepiggiesworldclass96-round-one-base-v1')validatePiggies(raw,mapping);
  if (raw.protocol !== 'nextgen' || raw.roundFieldsVersion !== ROUND_FIELDS_VERSION) throw new Error('SG_UNSUPPORTED_ROUND_CONTRACT');
  if(hasHuffRetrigger(raw)){
    const value=huffRetriggerFields(raw,mapping.typeMappingHash);
    if(value.buy!==mapping.buy||value.bonus!==mapping.bonus)throw Error('SG_HUFF_RETRIGGER_MAPPING_MISMATCH');
    return value;
  }
  if(hasHuffTouchup(raw)){
    const value=huffTouchupFields(raw,mapping.typeMappingHash);
    if(value.buy!==mapping.buy||value.bonus!==mapping.bonus)throw Error('SG_HUFF_TOUCHUP_MAPPING_MISMATCH');
    return value;
  }
  if(raw.sourceKey==='thedemoncodecap250c96-round-one-base-v1' && raw.steps.some((s:any)=>new URLSearchParams(s.responsePayload).get('FID')==='0|1|'))validateDemonNestedMapping(raw,mapping);
  if(hasMorepuffWheel(raw)){
    const value=morepuffFields(raw,mapping.typeMappingHash);
    if(value.buy!==mapping.buy||value.bonus!==mapping.bonus)throw Error('SG_MOREPUFF_MAPPING_MISMATCH');
    return value;
  }
  if(raw.sourceKey === 'hyperchargedincajungle96-round-one-base-v1') {
    const value=incaFields(raw,mapping.typeMappingHash);
    if(value.buy!==mapping.buy||value.bonus!==mapping.bonus)throw Error('SG_INCA_MAPPING_MISMATCH');
    return value;
  }
  if(raw.sourceKey === 'hyperchargedjinzita96-round-one-base-v1') {
    const value=jinzitaFields(raw,mapping.typeMappingHash);
    if(value.buy!==mapping.buy||value.bonus!==mapping.bonus)throw Error('SG_JINZITA_MAPPING_MISMATCH');
    return value;
  }
  if(raw.sourceKey === 'pyramidsofluxor96-round-one-base-v1') {
    const value=luxorFields(raw,mapping.typeMappingHash);
    if(value.buy!==mapping.buy||value.bonus!==mapping.bonus)throw Error('SG_LUXOR_MAPPING_MISMATCH');
    return value;
  }
  if(raw.sourceKey === 'beaverlasvegas96-round-one-base-v1') {
    const fields = beaverFields(raw, {gameId:32820,sourceKey:raw.sourceKey,betRaw:100,
      requestParams:{AP:'false',BPL:'5',GN:'beaverlasvegas96',LB:'20'}}, mapping.typeMappingHash,mapping.typeMappingHash);
    if(fields.buy !== mapping.buy || fields.bonus !== mapping.bonus) throw Error('SG_BEAVER_MAPPING_MISMATCH');
    return fields;
  }
  const entries: SGTrafficEntry[] = raw.steps.map((step: SGTrafficEntry) => ({
    ...step, ts: step.ts ?? '', url: step.url ?? '', methodName: step.methodName ?? 'processGameMessage', responseXml: step.responseXml ?? '',
  }));
  const { doc } = buildRoundDoc(1, String(raw.sourceKey), entries, raw.startBalanceRaw, { buy: mapping.buy, bonusType: mapping.bonus });
  return {
    roundFieldsVersion: ROUND_FIELDS_VERSION, protocol: raw.protocol, sourceKey: raw.sourceKey,
    bet: doc.bet, mul: doc.mul, buy: doc.buy, bonus: doc.bonus,
    primaryBonusKind: doc.data.primaryBonusKind, money: doc.data.money, typeMappingHash: mapping.typeMappingHash,
  };
}
