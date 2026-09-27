/** Stable business-field contract. Amount evidence is in integer hundredths. */
export const ROUND_FIELDS_VERSION = 'sg-round-fields-v1';
export type BonusKind = 'none' | 'freeGame' | 'feature' | 'freeFeature';

export function settledFields(start: number, end: number, win: number, buy: number, bonus: number) {
  if (![start, end, win].every(n => Number.isSafeInteger(n) && n >= 0)) {
    throw new Error('SG_INVALID_MONEY_EVIDENCE');
  }
  const stake = start - end + win;
  if (!Number.isSafeInteger(stake) || stake <= 0) throw new Error('SG_INVALID_WAGER_BASIS');
  if (![buy, bonus].every(n => Number.isSafeInteger(n) && n >= 0)) throw new Error('SG_INVALID_TYPE_MAPPING');
  return {
    roundFieldsVersion: ROUND_FIELDS_VERSION,
    bet: stake / 100, mul: win / stake, buy, bonus,
    money: { startBalanceRaw: start, endBalanceRaw: end, totalWinRaw: win, betRaw: stake },
  };
}
