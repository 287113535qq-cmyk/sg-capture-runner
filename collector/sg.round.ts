import { extractRoundBalance, parsePayloadParams } from './sg.parse';
import { settledFields } from './sg.fields';

export interface SGTrafficEntry {
  ts: string;
  url: string;
  methodName: string;
  msgId: string;
  requestPayload: string;
  responsePayload: string;
  responseBalance?: number;
  responseXml: string;
}

export type SGPrimaryBonusKind = 'none' | 'freeGame' | 'feature' | 'freeFeature';

export interface SGMongoDoc {
  gameId?: number;
  bonus: number;
  buy: number;
  data: Record<string, any>;
  mul: number;
  rtp: number[];
  bet: number;
}

export interface SGRoundDocMeta {
  selectedFreeChoiceOptionIndex?: number | null;
  freeChoiceOptionCount?: number | null;
  buy?: number | null;
  /** Per-game reviewed free-data type. Never derived from the generic bonus kind. */
  bonusType?: number | null;
  enhancedBetLevel?: number | null;
  enhancedBetLabel?: string | null;
  forcedPrimaryBonusKind?: SGPrimaryBonusKind | null;
}

export interface SGRoundBuildResult {
  doc: SGMongoDoc;
  finalBalance: number;
  totalWinRaw: number;
  betRaw: number;
}

function toNumber(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function splitPositiveFeatureIds(value: string): number[] {
  return String(value || '')
    .split('|')
    .map((item) => toNumber(item.trim()))
    .filter((item) => item > 0);
}

function splitFeatureIds(value: string): number[] {
  return String(value || '')
    .split('|')
    .map((item) => toNumber(item.trim()))
    .filter((item) => item >= 0);
}

function hasOwnParam(params: Record<string, string>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(params, key);
}

function collectFeatureCfgs(params: Record<string, string>): number[] {
  const result = new Set<number>();

  const cfg = toNumber(params.CFG);
  if (hasOwnParam(params, 'CFG') && cfg >= 0) {
    result.add(cfg);
  }

  for (const key of Object.keys(params)) {
    let match = key.match(/^FS_(\d+)$/);
    if (match) {
      result.add(Number(match[1]));
      continue;
    }

    match = key.match(/^NFR_(\d+)$/);
    if (match) {
      result.add(Number(match[1]));
    }
  }

  return Array.from(result.values()).sort((a, b) => a - b);
}

function hasPositiveFeatureId(params: Record<string, string>): boolean {
  return splitPositiveFeatureIds(String(params.FID || '')).length > 0;
}

function extractFeatureLives(params: Record<string, string>): number {
  const gsd = String(params.GSD || '');
  const match = gsd.match(/#lives~(\d+)/i);
  if (!match) return 0;
  return toNumber(match[1]);
}

function hasFeaturePayload(params: Record<string, string>): boolean {
  const gsd = String(params.GSD || '');
  if (!gsd) return false;

  return gsd.includes('#fb~') || gsd.includes('#lives~') || gsd.includes('#initialVals~') || gsd.includes('#finalValues~');
}

function extractGsdNumber(params: Record<string, string>, key: string): number | null {
  const gsd = String(params.GSD || '');
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = gsd.match(new RegExp(`(?:^|#)${escapedKey}~(-?\\d+)`, 'i'));
  return match ? toNumber(match[1]) : null;
}

function hasGsdToken(params: Record<string, string>, token: string): boolean {
  const gsd = String(params.GSD || '');
  const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[#|])${escapedToken}~`, 'i').test(gsd);
}

function resolveWheelFeatureEndCfg(params: Record<string, string>): number | null {
  if (String(params.MSGID || '').toUpperCase() !== 'FEATURE_PICK') {
    return null;
  }

  const gsd = String(params.GSD || '');
  if (!gsd.includes('WHEEL_PICK~')) {
    return null;
  }

  const cfg = toNumber(params.CFG) || splitPositiveFeatureIds(String(params.FID || ''))[0] || 0;
  if (cfg <= 0) {
    return null;
  }

  const currentIndex = extractGsdNumber(params, 'WHEEL_IDX');
  const nextIndex = extractGsdNumber(params, 'WHEEL_NEXT_IDX') ?? 0;
  if (nextIndex === 0 || (currentIndex !== null && nextIndex === currentIndex)) {
    return cfg;
  }

  return null;
}

function isWheelFeaturePickResponse(params: Record<string, string>): boolean {
  return String(params.MSGID || '').toUpperCase() === 'FEATURE_PICK' && String(params.GSD || '').includes('WHEEL_PICK~');
}

function hasAnyPendingFeatureRound(params: Record<string, string>): boolean {
  return Object.keys(params).some((key) => /^NFR_\d+$/.test(key) && toNumber(params[key]) > 0);
}

function hasAnyStartedFeature(params: Record<string, string>): boolean {
  return Object.keys(params).some((key) => /^FS_\d+$/.test(key) && toNumber(params[key]) > 0);
}

function hasPendingMbwTriggeredFreeGame(params: Record<string, string>): boolean {
  const gsd = String(params.GSD || '');
  if (!gsd.includes('MBW_TRIGGERED~Y')) {
    return false;
  }

  if (!String(params.FID || '').trim()) {
    return false;
  }

  if (gsd.includes('MBW_FEATURE_PRIZE_LIST~')) {
    return false;
  }

  if (toNumber(params.NFG) === 0) {
    return false;
  }

  return true;
}

function isTerminalBuyInFeatureState(params: Record<string, string>): boolean {
  const fid = String(params.FID || '').trim();
  if (!/^0\|?$/.test(fid)) {
    return false;
  }

  const gsd = String(params.GSD || '');
  return /(?:^|#)FSK~/.test(gsd) && /(?:^|#)GFS~/.test(gsd) && /(?:^|#)TGB~/.test(gsd);
}

export function resolveFeatureStartCfg(params: Record<string, string>, startedCfgs: ReadonlySet<number>): number | null {
  const hasFeatureId = hasPositiveFeatureId(params);

  for (const cfg of collectFeatureCfgs(params)) {
    if (startedCfgs.has(cfg)) {
      continue;
    }

    const started = toNumber(params[`FS_${cfg}`]) > 0;
    const pendingRounds = toNumber(params[`NFR_${cfg}`]) > 0;
    if (!started && (pendingRounds || hasFeatureId)) {
      return cfg;
    }
  }

  return null;
}

export function needsFreeGameContinuation(params: Record<string, string>): boolean {
  const freeGameCount = toNumber(params.NFG);
  if (freeGameCount > 0) {
    return true;
  }

  // Some NextGen titles (for example Road Trip 66) use NFG=-1/FGT=-1 as a
  // pending free-game state. Treating it as complete causes the next BET to
  // fail with ERROR_PROTOCOL_SEQUENCE.
  if (freeGameCount < 0 && String(params.FID || '').trim() && !isTerminalBuyInFeatureState(params)) {
    return true;
  }

  return hasPendingMbwTriggeredFreeGame(params);
}

export interface SGFeaturePickRequest {
  cfg: number;
  fp: string;
  currentPick: number;
  lives: number;
  kind: 'standard' | 'freeChoice' | 'wheel';
  optionIndex?: number;
}

function normalizeFreeChoiceOptionValue(optionValue: number): number {
  if (!Number.isFinite(optionValue)) {
    return 0;
  }

  return Math.max(0, Math.min(5, Math.round(optionValue)));
}

function resolveFreeChoiceFp(params: Record<string, string>, cfg: number, optionValue: number): string {
  const featurePickMarker = String(params[`FPM_${cfg}`] || '').trim();
  const featureValue = String(params[`FTV_${cfg}`] || '').trim();

  // Dancing Drums Link style games serialize the pick tuple as round|pick|card.
  if (featurePickMarker === '|' && featureValue === '0;1;1;-1;|') {
    return `1|1|${optionValue}`;
  }

  return `0|1|${optionValue}`;
}

export function resolveFreeChoiceTriggerPickRequest(
  params: Record<string, string>,
  requestedOptionValue: number,
): SGFeaturePickRequest | null {
  if (hasGsdToken(params, 'JPT') || hasGsdToken(params, 'GPT')) {
    return null;
  }

  if (!hasOwnParam(params, 'CFG')) {
    return null;
  }

  const cfg = toNumber(params.CFG);
  if (cfg < 0) {
    return null;
  }

  const featureIds = splitFeatureIds(String(params.FID || ''));
  if (!featureIds.includes(cfg)) {
    return null;
  }

  if (toNumber(params[`FS_${cfg}`]) > 0) {
    return null;
  }

  if (toNumber(params[`NFR_${cfg}`]) <= 0) {
    return null;
  }

  if (!Object.prototype.hasOwnProperty.call(params, `CFP_${cfg}`)) {
    return null;
  }

  if (!String(params[`FTV_${cfg}`] || '').trim()) {
    return null;
  }

  const optionValue = normalizeFreeChoiceOptionValue(requestedOptionValue);
  return {
    cfg,
    fp: resolveFreeChoiceFp(params, cfg, optionValue),
    currentPick: optionValue,
    lives: 0,
    kind: 'freeChoice',
    optionIndex: optionValue + 1,
  };
}

function resolveWheelFeaturePickRequest(params: Record<string, string>): SGFeaturePickRequest | null {
  if (!isWheelFeaturePickResponse(params)) {
    return null;
  }

  const cfg = toNumber(params.CFG) || splitPositiveFeatureIds(String(params.FID || ''))[0] || 0;
  if (cfg <= 0) {
    return null;
  }

  if (toNumber(params[`FS_${cfg}`]) <= 0 || toNumber(params[`NFR_${cfg}`]) <= 0) {
    return null;
  }

  const nextIndex = extractGsdNumber(params, 'WHEEL_NEXT_IDX');
  if (nextIndex === null || nextIndex <= 0) {
    return null;
  }

  const currentIndex = extractGsdNumber(params, 'WHEEL_IDX');
  if (currentIndex !== null && nextIndex === currentIndex) {
    return null;
  }

  const currentPick = Math.max(0, toNumber(params[`CFP_${cfg}`]));
  if (currentPick <= 0) {
    return null;
  }

  // 10,000 BC's frontend builds wheel picks as:
  // FP=(next wheel index)|(next total pick number)|choice.
  return {
    cfg,
    fp: `${nextIndex}|${currentPick + 1}|0`,
    currentPick,
    lives: 0,
    kind: 'wheel',
  };
}

export function resolveFeaturePickRequest(params: Record<string, string>): SGFeaturePickRequest | null {
  const wheelPick = resolveWheelFeaturePickRequest(params);
  if (wheelPick !== null) {
    return wheelPick;
  }

  if (!hasAnyStartedFeature(params) || !hasFeaturePayload(params)) {
    return null;
  }

  if (!hasOwnParam(params, 'CFG')) {
    return null;
  }

  const cfg = toNumber(params.CFG);
  if (cfg < 0) {
    return null;
  }

  if (toNumber(params[`FS_${cfg}`]) <= 0) {
    return null;
  }

  const lives = extractFeatureLives(params);
  if (lives <= 0) {
    return null;
  }

  const currentPick = Math.max(0, toNumber(params[`CFP_${cfg}`]));
  return {
    cfg,
    fp: `1|${currentPick + 1}`,
    currentPick,
    lives,
    kind: 'standard',
  };
}

export function resolveProgressiveFeaturePickRequest(
  params: Record<string, string>,
  featureMaxPickCounts: ReadonlyMap<number, number>,
): SGFeaturePickRequest | null {
  if (!hasOwnParam(params, 'CFG')) {
    return null;
  }

  const cfg = toNumber(params.CFG);
  if (cfg < 0) {
    return null;
  }

  if (toNumber(params[`FS_${cfg}`]) <= 0 || toNumber(params[`NFR_${cfg}`]) <= 0) {
    return null;
  }

  if (!Object.prototype.hasOwnProperty.call(params, `FPM_${cfg}`)) {
    return null;
  }

  const currentPick = Math.max(0, toNumber(params[`CFP_${cfg}`]));
  const maxPicks = Math.max(0, toNumber(featureMaxPickCounts.get(cfg)));
  if (currentPick <= 0 || maxPicks <= 0 || currentPick > maxPicks) {
    return null;
  }

  return {
    cfg,
    fp: `0|${currentPick}|0`,
    currentPick,
    lives: Math.max(0, maxPicks - currentPick + 1),
    kind: 'standard',
  };
}

export function resolveProgressiveFeatureInitialPickRequest(
  params: Record<string, string>,
  featureMaxPickCounts: ReadonlyMap<number, number>,
): SGFeaturePickRequest | null {
  if (!hasOwnParam(params, 'CFG')) {
    return null;
  }

  const cfg = toNumber(params.CFG);
  if (cfg < 0) {
    return null;
  }

  if (toNumber(params[`FS_${cfg}`]) > 0 || toNumber(params[`NFR_${cfg}`]) <= 0) {
    return null;
  }

  if (!Object.prototype.hasOwnProperty.call(params, `FPM_${cfg}`) || !Object.prototype.hasOwnProperty.call(params, `FTV_${cfg}`)) {
    return null;
  }

  const currentPick = Math.max(0, toNumber(params[`CFP_${cfg}`]));
  const maxPicks = Math.max(0, toNumber(featureMaxPickCounts.get(cfg)));
  if (currentPick !== 0 || maxPicks <= 0) {
    return null;
  }

  return {
    cfg,
    fp: '0|1|0',
    currentPick,
    lives: maxPicks,
    kind: 'standard',
  };
}

export function resolveProgressiveFeatureEndCfg(
  params: Record<string, string>,
  featureMaxPickCounts: ReadonlyMap<number, number>,
): number | null {
  if (!hasOwnParam(params, 'CFG')) {
    return null;
  }

  const cfg = toNumber(params.CFG);
  if (cfg < 0) {
    return null;
  }

  if (toNumber(params[`FS_${cfg}`]) <= 0 || toNumber(params[`NFR_${cfg}`]) <= 0) {
    return null;
  }

  if (!Object.prototype.hasOwnProperty.call(params, `FPM_${cfg}`)) {
    return null;
  }

  const currentPick = Math.max(0, toNumber(params[`CFP_${cfg}`]));
  const maxPicks = Math.max(0, toNumber(featureMaxPickCounts.get(cfg)));
  // CFP is the next pick index for these ladders; when it advances past the
  // max, the game expects FEATURE_END rather than another FEATURE_PICK.
  return currentPick > maxPicks && maxPicks > 0 ? cfg : null;
}

export function resolveFeatureEndCfg(params: Record<string, string>): number | null {
  if (!hasAnyStartedFeature(params) || !hasFeaturePayload(params)) {
    return null;
  }

  if (!hasOwnParam(params, 'CFG')) {
    return null;
  }

  const cfg = toNumber(params.CFG);
  if (cfg < 0) {
    return null;
  }

  if (toNumber(params[`FS_${cfg}`]) <= 0) {
    return null;
  }

  // Pick features embedded in free spins settle back into the free-game flow.
  // Sending FEATURE_END here leaves games such as Aladdin's Legacy in an
  // ERROR_PROTOCOL_SEQUENCE state.
  if (toNumber(params.IFG) > 0) {
    return null;
  }

  return extractFeatureLives(params) <= 0 ? cfg : null;
}

export function resolveFreeChoiceFeatureEndCfg(params: Record<string, string>): number | null {
  if (isWheelFeaturePickResponse(params)) {
    return resolveWheelFeatureEndCfg(params);
  }

  if (!hasOwnParam(params, 'CFG')) {
    return null;
  }

  const cfg = toNumber(params.CFG);
  if (cfg < 0) {
    return null;
  }

  if (toNumber(params[`FS_${cfg}`]) <= 0) {
    return null;
  }

  if (toNumber(params[`CFP_${cfg}`]) <= 0) {
    return null;
  }

  if (!Object.prototype.hasOwnProperty.call(params, `FPM_${cfg}`)) {
    return null;
  }

  // Free-game pick features can settle on FEATURE_PICK and reject a follow-up
  // FEATURE_END with ERROR_PROTOCOL_SEQUENCE. Base-game pick features still
  // need FEATURE_END to clear server-side feature state before the next BET.
  if (toNumber(params.IFG) > 0) {
    return null;
  }

  return cfg;
}

export function isBonusRound(entries: SGTrafficEntry[]): boolean {
  return entries.some((entry) => {
    if (entry.msgId === 'FREE_GAME' || entry.msgId === 'FEATURE_START' || entry.msgId === 'FEATURE_PICK' || entry.msgId === 'FEATURE_END') {
      return true;
    }

    const params = parsePayloadParams(entry.responsePayload || '');
    return (
      needsFreeGameContinuation(params) ||
      resolveFeatureStartCfg(params, new Set<number>()) !== null ||
      resolveFeaturePickRequest(params) !== null ||
      resolveFeatureEndCfg(params) !== null
    );
  });
}

export function classifyPrimaryBonusKind(entries: SGTrafficEntry[]): SGPrimaryBonusKind {
  const msgIds = entries.map((entry) => String(entry.msgId || ''));
  const hasFreeGame = msgIds.includes('FREE_GAME');
  const hasFeature = msgIds.some((msgId) => msgId === 'FEATURE_START' || msgId === 'FEATURE_PICK' || msgId === 'FEATURE_END');

  if (hasFreeGame && hasFeature) {
    return 'freeFeature';
  }
  if (hasFreeGame) {
    return 'freeGame';
  }
  if (hasFeature) {
    return 'feature';
  }
  return 'none';
}

function normalizePrimaryBonusKind(value: unknown): SGPrimaryBonusKind | null {
  const normalized = String(value || '').trim();
  if (normalized === 'freeGame' || normalized === 'feature' || normalized === 'freeFeature') {
    return normalized;
  }
  return null;
}

export function buildRoundDoc(
  gameId: number,
  runtimeSlug: string,
  entries: SGTrafficEntry[],
  preBalance: number,
  meta: SGRoundDocMeta = {},
): SGRoundBuildResult {
  if (!entries.length) {
    throw new Error('cannot build SG round without entries');
  }

  const lastEntry = entries[entries.length - 1];
  const finalParams = parsePayloadParams(lastEntry.responsePayload);
  if (lastEntry.msgId === 'FEATURE_START' || finalParams.MSGID === 'FEATURE_START'
      || needsFreeGameContinuation(finalParams) || resolveFeaturePickRequest(finalParams) !== null
      || Object.keys(finalParams).some(key => /^NFR_\d+$/.test(key) && Number(finalParams[key]) > 0)) {
    throw new Error('SG_INCOMPLETE_ROUND');
  }
  const lastBalance = lastEntry.responseBalance ?? extractRoundBalance({ ogsRc: '', success: true, payload: lastEntry.responsePayload });
  if (lastBalance === undefined) {
    throw new Error('cannot resolve SG round final balance');
  }

  // Missing, malformed or inconsistent settlement evidence must not become zero.
  if (finalParams.TW === undefined || !/^\d+$/.test(finalParams.TW)) throw new Error('SG_INVALID_MONEY_EVIDENCE');
  const totalWinRaw = Number(finalParams.TW);
  for (const key of ['B', 'AB']) {
    if (finalParams[key] !== undefined && (!/^\d+$/.test(finalParams[key]) || Number(finalParams[key]) !== lastBalance)) {
      throw new Error('SG_UNRECONCILED_FINAL_BALANCE');
    }
  }
  const primaryBonusKind = normalizePrimaryBonusKind(meta.forcedPrimaryBonusKind) || classifyPrimaryBonusKind(entries);
  const hasFree = entries.some(entry => entry.msgId === 'FREE_GAME');
  const bonus = meta.bonusType ?? (hasFree ? NaN : 0);
  if ((hasFree && !(bonus > 0)) || (!hasFree && bonus !== 0)) throw new Error('SG_FREE_TYPE_MAPPING_REQUIRED');
  const fields = settledFields(preBalance, lastBalance, totalWinRaw, meta.buy ?? 0, bonus);
  const betRaw = fields.money.betRaw;
  const specialKinds = primaryBonusKind === 'none' ? [] : [primaryBonusKind];
  const doc: SGMongoDoc = {
    bonus: fields.bonus,
    buy: fields.buy,
    bet: fields.bet,
    mul: fields.mul,
    rtp: [],
    data: {
      gameId,
      runtimeSlug,
      startBalance: preBalance / 100,
      endBalance: lastBalance / 100,
      totalWin: totalWinRaw / 100,
      roundFieldsVersion: fields.roundFieldsVersion,
      money: fields.money,
      stepCount: entries.length,
      msgIds: entries.map((entry) => entry.msgId),
      steps: entries,
      primaryBonusKind,
      specialKinds,
      enhancedBetLevel: Math.max(0, toNumber(meta.enhancedBetLevel)),
      enhancedBetLabel: String(meta.enhancedBetLabel || '').trim(),
      isFreeChoiceRound: Number(meta.selectedFreeChoiceOptionIndex || 0) > 0,
      freeChoiceOptionIndex: Number(meta.selectedFreeChoiceOptionIndex || 0) || 0,
      freeChoiceOptionCount: Number(meta.freeChoiceOptionCount || 0) || 0,
    },
  };

  return {
    doc,
    finalBalance: lastBalance,
    totalWinRaw,
    betRaw,
  };
}
