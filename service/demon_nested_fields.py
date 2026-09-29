"""Offline nested state boundary; not a deployed adapter or settlement proof."""
from round_fields import params, check, amount
from demon_fields import DemonFields

def gsd(text):
    out={}
    for item in text.split('#'):
        if not item: continue
        k,sep,v=item.partition('~')
        check(sep and k not in out,'NESTED_GSD_AMBIGUOUS')
        out[k]=v
    return out

def next_request(raw, plan):
    check(raw.get('sourceKey')=='thedemoncodecap250c96-round-one-base-v1' and raw.get('protocol')=='nextgen','NESTED_PROFILE_REQUIRED')
    steps=raw.get('steps',[])
    if not any(params(s['responsePayload']).get('FID')=='0|1|' for s in steps):
        return DemonFields(plan).next_request(raw)
    check(0<len(steps)<=100,'NESTED_FRAME_LIMIT')
    legacy=DemonFields(plan);expected='BET';player=None;previous=None;saved=None;seen=False
    for i,step in enumerate(steps):
        check(expected is not None and step['msgId']==expected,'NESTED_SEQUENCE_CHANGED')
        req=params(step['requestPayload']);p=params(step['responsePayload']);fid=p.get('FID','')
        check(req.get('MSGID')==step['msgId'] and p.get('MSGID')==step['msgId'],'MESSAGE_ID_MISMATCH')
        check(player is None or player==req.get('PID'),'SESSION_CHANGED_MID_ROUND');player=req.get('PID')
        check(fid in {'','0','0|','1|0|','0|1|'},'UNKNOWN_TRIAL_FEATURE')
        if fid!='0|1|':legacy.state(step)
        else:
            import xml.etree.ElementTree as ET
            legacy.request_params(step['requestPayload'],step['msgId'])
            check(step['msgId']=='FREE_GAME' and p.get('IFG')=='1','NESTED_NOT_FREE')
            check(not any(k.startswith(('FS_','NFR_')) for k in p) and 'CFG' not in p and 'ABPM' not in p,'UNKNOWN_TRIAL_FEATURE')
            for k in ('B','AB','TW'):amount(p.get(k))
            xml=step.get('responseXml');check(isinstance(xml,str) and len(xml)<262144 and '<!DOCTYPE' not in xml.upper() and '<!ENTITY' not in xml.upper(),'INVALID_TRIAL_XML')
            try:r=ET.fromstring(xml)
            except ET.ParseError:raise ValueError('INVALID_TRIAL_XML') from None
            check(r.tag.upper()=='GDMRESPONSE' and str(r.findtext('SUCCESS')).lower()=='true' and r.findtext('PAYLOAD')==step['responsePayload'],'TRIAL_XML_EVIDENCE_MISMATCH')
            check(amount(step.get('elapsedMs'))<=300000,'INVALID_TRIAL_TIMING')
        n,t,c=[amount(p[k]) if k in p else None for k in ('NFG','TFG','CFGG')]
        check(all(v is None or v<=100 for v in (n,t,c)),'TRIAL_FREE_LIMIT')
        if fid=='0|1|':
            check(previous in {'1|0|','0|1|'} and all(v is not None for v in (n,t,c)),'NESTED_ENTRY_CHANGED')
            d=gsd(p.get('GSD',''));outer=tuple(amount(d[k]) for k in ('STFG','SCFGG','SNFG') if k in d)
            check(len(outer)==3 and all(v<=100 for v in outer) and outer[0]==outer[1]+outer[2],'NESTED_SAVED_COUNTERS_INVALID')
            check(t==c+n,'NESTED_INNER_COUNTERS_INVALID')
            if previous=='0|1|':check(outer==saved,'NESTED_SAVED_COUNTERS_CHANGED')
            if previous=='1|0|':
                check(legacy.next_request({**raw,'steps':steps[:i]})=={'MSGID':'FREE_GAME'} if not seen else True,'NESTED_ENTRY_CHANGED')
                prior=params(steps[i-1]['responsePayload'])
                check(outer==(amount(prior['TFG']),amount(prior['CFGG'])+1,amount(prior['NFG'])-1),'NESTED_OUTER_TRANSITION_CHANGED')
            saved=outer;seen=True
            # Client generic loop stops on NFG0. Contradictory saved outer work
            # must be reviewed, never counted as a complete round or guessed.
            check(n>0,'NESTED_TERMINAL_REQUIRES_REVIEW')
        elif previous=='0|1|':
            check(fid=='1|0|' and n>0 and (t,c,n)==saved,'NESTED_RETURN_REQUIRES_REVIEW')
            saved=None
        elif seen:
            prior=params(steps[i-1]['responsePayload'])
            if n==0:
                check(previous=='1|0|' and amount(prior['NFG'])==1
                      and fid in {'','0','0|'} and saved is None,
                      'NESTED_TERMINAL_REQUIRES_REVIEW')
            else:
                check(previous=='1|0|' and fid=='1|0|' and t==c+n
                      and c==amount(prior['CFGG'])+1 and t>=amount(prior['TFG']),
                      'NESTED_OUTER_PROGRESS_REQUIRES_REVIEW')
        if seen and fid!='0|1|':
            d=gsd(p.get('GSD',''))
            check('SNFG' not in d or amount(d['SNFG'])==0,
                  'NESTED_UNCLEARED_SAVED_COUNTER')
        previous=fid;expected='FREE_GAME' if n else None
    return {'MSGID':expected} if expected else None

def settlement_money(raw, plan):
    """Offline money evidence only; does not register a production mapping."""
    from round_fields import VERSION, nextgen
    check(raw.get('roundFieldsVersion')==VERSION,'ROUND_FIELDS_VERSION_REQUIRED')
    check(next_request(raw,plan) is None,'INCOMPLETE_ROUND')
    end,win,kind,_=nextgen(raw)
    start=amount(raw.get('startBalanceRaw'))
    check(start-end+win==plan['betRaw'],'TRIAL_ACTUAL_COST_MISMATCH')
    check(kind=='freeGame','NESTED_FREE_SETTLEMENT_REQUIRED')
    return {'startBalanceRaw':start,'endBalanceRaw':end,'totalWinRaw':win,'betRaw':plan['betRaw']}


SOURCE='thedemoncodecap250c96-round-one-base-v1'
EXTENSION=SOURCE+'-demon-nested-free-v1'
def has_nested(raw):
    return raw.get('sourceKey')==SOURCE and any(params(s['responsePayload']).get('FID')=='0|1|' for s in raw['steps'])

class DemonNestedFields(DemonFields):
    def next_request(self, raw):
        return next_request(raw,self.plan)

    def settled(self, raw):
        if not has_nested(raw):return super().settled(raw)
        from round_fields import derive,VERSION
        check(raw.get('fixtureOnly') is False and raw.get('roundFieldsVersion')==VERSION,'TRIAL_PROFILE_REQUIRED')
        settlement_money(raw,self.plan)
        fields=derive(raw)
        check(fields['buy']==0 and fields['bonus']==2,'NESTED_MAPPING_REQUIRED')
        return fields
