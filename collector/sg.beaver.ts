/** Independent Beaver FID1 settlement verification. */
type Frame = {msgId: string; requestPayload: string; responsePayload: string; responseBalance?: string | number};
type Raw = {sourceKey: string; protocol: string; roundFieldsVersion: string; startBalanceRaw: number; steps: Frame[]};
type Plan = {gameId: number; sourceKey: string; betRaw: number; requestParams: Record<string, string>};
const check = (valid: unknown, message: string): void => { if (!valid) throw Error(message); };
function integer(value: unknown): number {
  check(typeof value === 'string' && /^\d+$/.test(value), 'INVALID_COUNTER');
  const result = Number(value);
  check(Number.isSafeInteger(result), 'INVALID_COUNTER');
  return result;
}
function pairs(text: string, separator = '&', delimiter = '='): Record<string, string> {
  check(typeof text === 'string', 'INVALID_PAYLOAD');
  const result: Record<string, string> = Object.create(null);
  for (const item of text.split(separator).filter(Boolean)) {
    const at = item.indexOf(delimiter), key = item.slice(0, at);
    check(at > 0 && !Object.prototype.hasOwnProperty.call(result, key), 'AMBIGUOUS_FIELD');
    if (delimiter === '~') check(item.lastIndexOf(delimiter) === at, 'AMBIGUOUS_GSD');
    result[key] = item.slice(at + 1);
  }
  return result;
}
export function beaverFields(raw: Raw, plan: Plan, baseHash: string, extensionHash: string) {
  check(plan.gameId === 32820 && plan.sourceKey === 'beaverlasvegas96-round-one-base-v1'
    && raw.sourceKey === plan.sourceKey && raw.protocol === 'nextgen'
    && raw.roundFieldsVersion === 'sg-round-fields-v1', 'PROFILE_REQUIRED');
  check(raw.steps.length > 0 && raw.steps.length <= 100, 'INVALID_STEPS');
  let previousRemaining = 0, special = false, hasReplay = false, beaver = false;
  let firstPlayer: string | undefined, previousFid: string | undefined;
  let last: Record<string, string> = {};
  for (let i = 0; i < raw.steps.length; i++) {
    const step = raw.steps[i], request = pairs(step.requestPayload), p = pairs(step.responsePayload);
    const msg = i === 0 ? 'BET' : 'FREE_GAME';
    check(step.msgId === msg && request.MSGID === msg && p.MSGID === msg && (i === 0 || previousRemaining > 0), 'INVALID_SEQUENCE');
    const expected = {...plan.requestParams, MSGID: msg};
    check(Object.keys(request).length === Object.keys(expected).length + 1
      && Object.entries(expected).every(([k, v]) => request[k] === v), 'REQUEST_MODE_CHANGED');
    check(/^gdmgcm.{1,505}$/.test(request.PID ?? '') && (i === 0 || request.PID === firstPlayer), 'SESSION_CHANGED');
    firstPlayer = request.PID;
    const fid = p.FID ?? '', active = fid === '1' || fid === '1|';
    check(['', '0', '0|', '1', '1|'].includes(fid)
      && !Object.keys(p).some(k => /^(FS_|NFR_|CFR_|CFP_)/.test(k))
      && ['CFG', 'ABPM', 'SB'].every(k => p[k] === undefined), 'UNSUPPORTED_FEATURE');
    const gsd = pairs(p.GSD ?? '', '#', '~');
    check(gsd.CFG === undefined || gsd.CFG === '0' && ['0', '0|'].includes(fid), 'UNSUPPORTED_BEAVER');
    beaver ||= gsd.CFG !== undefined;
    check(!((special || active) && beaver), 'MIXED_FEATURE');
    check(['0', '1'].includes(p.IFG) && (i === 0 || p.IFG === '1'), 'INVALID_FREE_STATE');
    for (const k of ['B', 'AB', 'TW']) integer(p[k]);
    const counters = ['NFG', 'TFG', 'CFGG'].map(k => p[k] === undefined ? null : integer(p[k]));
    check(counters.every(n => n === null || n <= 100), 'COUNTER_LIMIT');
    if (i > 0 || active || counters[0]) check(counters.every(n => n !== null), 'MISSING_COUNTER');
    if (active && !['1', '1|'].includes(previousFid ?? '')) check(i === 0 && (counters[0] ?? 0) > 0, 'NONINDEPENDENT_TRIGGER');
    if (special && !active) check(counters[0] === 0, 'MIXED_FEATURE');
    hasReplay ||= i > 0 && ['1', '1|'].includes(previousFid ?? '');
    special ||= active;
    previousRemaining = counters[0] ?? 0;
    previousFid = fid;
    last = p;
  }
  check(previousRemaining === 0 && (!special || hasReplay), 'INCOMPLETE_ROUND');
  const end = integer(last.B), win = integer(last.TW);
  check(end === integer(last.AB) && (raw.steps[raw.steps.length-1].responseBalance === undefined
    || Number(raw.steps[raw.steps.length-1].responseBalance) === end), 'BALANCE_MISMATCH');
  const start = raw.startBalanceRaw, stake = start - end + win;
  check(Number.isSafeInteger(start) && start >= 0 && stake === plan.betRaw, 'STAKE_MISMATCH');
  const free = raw.steps.length > 1;
  check(/^[a-f0-9]{64}$/.test(special ? extensionHash : baseHash), 'MAPPING_REQUIRED');
  return {roundFieldsVersion: raw.roundFieldsVersion, protocol: raw.protocol,
    bet: stake / 100, mul: win / stake, buy: 0, bonus: special ? 2 : free ? 1 : 0,
    primaryBonusKind: free ? 'freeGame' : 'none', sourceKey: raw.sourceKey,
    typeMappingHash: special ? extensionHash : baseHash,
    money: {startBalanceRaw: start, endBalanceRaw: end, totalWinRaw: win, betRaw: stake}};
}
