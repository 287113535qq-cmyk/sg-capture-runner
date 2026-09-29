/** Exact standalone foam terminal convention. NFR is awarded rounds;
 * successful END either omits all feature counters or has CFR=NFR.
 * The Runner and Python additionally validate every request/XML frame.
 */
export function settledQuarterbackFoam(source: string, entries: any[]): boolean {
  if (source !== 'quarterbackfieldsofglory96-round-one-base-v1' || entries.length !== 4
      || entries.map(e => e.msgId).join(',') !== 'BET,FEATURE_START,FEATURE_PICK,FEATURE_END') return false;
  const parse = (text: string) => {
    const out: Record<string, string> = Object.create(null);
    for (const item of text.split('&').filter(Boolean)) {
      const at = item.indexOf('='), key = item.slice(0, at);
      if (at < 1 || Object.hasOwnProperty.call(out, key)) throw Error('SG_AMBIGUOUS_PROTOCOL');
      out[key] = item.slice(at + 1);
    }
    return out;
  };
  const feature = entries.some(e => ['1', '1|'].includes(parse(e.responsePayload).FID)) ? '1' : '2';
  const p = entries.map(e => parse(e.responsePayload)), r = entries.map(e => parse(e.requestPayload));
  if (p.some((v, i) => v.MSGID !== entries[i].msgId || !['', '0', '0|', feature, feature+'|'].includes(v.FID ?? '')
      || ![undefined, '0', feature].includes(v.CFG) || ![undefined, '0'].includes(v.IFG) || v.ABPM !== undefined
      || ['NFG', 'TFG', 'CFGG'].some(k => v[k] !== undefined && v[k] !== '0')
      || Object.keys(v).some(k => /^(NFR|FS|CFP|CFR|FTV|FPM)_/.test(k) && !k.endsWith('_'+feature)))
      || r.some((v, i) => v.MSGID !== entries[i].msgId || v.PID !== r[0].PID || v.GN !== 'quarterbackfieldsofglory96'
        || (i > 0 && v.CFG !== feature))) return false;
  if (![feature, feature+'|'].includes(p[0].FID) || p[0]['FS_'+feature] !== '0' || p[0]['NFR_'+feature] !== '1' || p[0]['CFP_'+feature] !== '0'
      || p[1]['CFP_'+feature] !== '0' || p[2]['CFP_'+feature] !== '1') return false;
  if(feature === '1') {
    if(r[2].FP !== '0|1|1') return false;
  } else {
  const gsd: Record<string, string> = Object.create(null);
  for (const part of (p[1].GSD ?? '').split('#').filter(Boolean)) {
    const pair = part.split('~');
    if (pair.length !== 2 || Object.hasOwnProperty.call(gsd, pair[0])) return false;
    gsd[pair[0]] = pair[1];
  }
  const data = (gsd.featureData ?? '').split(';');
  if (data.length > 5 || data.some(v => !/^\d+$/.test(v) || !Number.isSafeInteger(Number(v)))
      || r[2].FP !== `0|1|${data[0]}`) return false;
  }
  const end = p[3];
  if ([feature, feature+'|'].includes(end.FID) && (end['NFR_'+feature] === undefined || end['CFR_'+feature] === undefined)
      && !['CFG', 'FS_'+feature, 'NFR_'+feature, 'CFR_'+feature, 'CFP_'+feature].every(k => end[k] === undefined)) return false;
  return (end['NFR_'+feature] === undefined || end['NFR_'+feature] === '0' || end['NFR_'+feature] === '1' && end['CFR_'+feature] === '1')
    && (end['CFP_'+feature] === undefined || end['CFP_'+feature] === '1');
}

export function quarterbackFeatureBonus(entries: any[]): number {
  return entries.some(e => /(?:^|&)FID=1(?:\||&|$)/.test(e.responsePayload)) ? 3 : 2;
}
