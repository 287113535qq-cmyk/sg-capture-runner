/** Exact standalone foam terminal convention. NFR is awarded rounds;
 * successful END plus CFR=NFR establishes completion for this one family.
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
  const p = entries.map(e => parse(e.responsePayload)), r = entries.map(e => parse(e.requestPayload));
  if (p.some((v, i) => v.MSGID !== entries[i].msgId || !['', '0', '0|', '2', '2|'].includes(v.FID ?? '')
      || ['NFG', 'TFG', 'CFGG'].some(k => v[k] !== undefined && v[k] !== '0')
      || Object.keys(v).some(k => /^(NFR|FS|CFP|CFR|FTV|FPM)_/.test(k) && !k.endsWith('_2')))
      || r.some((v, i) => v.MSGID !== entries[i].msgId || v.PID !== r[0].PID || v.GN !== 'quarterbackfieldsofglory96'
        || (i > 0 && v.CFG !== '2'))) return false;
  if (!['2', '2|'].includes(p[0].FID) || p[0].FS_2 !== '0' || p[0].NFR_2 !== '1' || p[0].CFP_2 !== '0'
      || p[1].CFP_2 !== '0' || p[2].CFP_2 !== '1') return false;
  const gsd: Record<string, string> = Object.create(null);
  for (const part of (p[1].GSD ?? '').split('#').filter(Boolean)) {
    const pair = part.split('~');
    if (pair.length !== 2 || Object.hasOwnProperty.call(gsd, pair[0])) return false;
    gsd[pair[0]] = pair[1];
  }
  const data = (gsd.featureData ?? '').split(';');
  if (data.length > 5 || data.some(v => !/^\d+$/.test(v) || !Number.isSafeInteger(Number(v)))
      || r[2].FP !== `0|1|${data[0]}`) return false;
  const end = p[3];
  if (['2', '2|'].includes(end.FID) && (end.NFR_2 === undefined || end.CFR_2 === undefined)) return false;
  return (end.NFR_2 === undefined || end.NFR_2 === '0' || end.NFR_2 === '1' && end.CFR_2 === '1')
    && (end.CFP_2 === undefined || end.CFP_2 === '1');
}
