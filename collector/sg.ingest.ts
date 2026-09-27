import { buildRoundDoc, SGTrafficEntry } from './sg.round';
import { ROUND_FIELDS_VERSION } from './sg.fields';

/** Prepare a NextGen captured round for the business-field transport contract.
 * Mapping values must come from the reviewed per-game policy; the server checks
 * them against the raw protocol and its own pinned policy again before writing.
 */
export function prepareNextgenRound(raw: any, mapping: { buy: number; bonus: number; typeMappingHash: string }) {
  if (raw.protocol !== 'nextgen' || raw.roundFieldsVersion !== ROUND_FIELDS_VERSION) throw new Error('SG_UNSUPPORTED_ROUND_CONTRACT');
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
