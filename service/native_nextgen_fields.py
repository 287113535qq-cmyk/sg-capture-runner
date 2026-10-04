"""Per-game, evidence-pinned ordinary NextGen BET/FREE_GAME adapter."""
import xml.etree.ElementTree as ET
from round_fields import check, params, amount, derive, VERSION


class NativeNextgenFields:
    def __init__(self, plan):
        self.plan=plan

    def request_params(self, payload, msg):
        p=params(payload)
        expected={**self.plan['requestParams'],'MSGID':msg}
        check({k:v for k,v in p.items() if k!='PID'}==expected,'FIRST_ROUND_REQUEST_MODE')
        check(p.get('PID','').startswith('gdmgcm') and 6<len(p['PID'])<512,'TRIAL_SESSION_REQUIRED')
        check(msg in {'BET','FREE_GAME'},'TRIAL_MESSAGE_NOT_ALLOWED')
        return p

    def frame(self, step):
        check(isinstance(step,dict),'INVALID_TRIAL_FRAME')
        msg=step.get('msgId');self.request_params(step.get('requestPayload'),msg)
        p=params(step.get('responsePayload'))
        check(p.get('MSGID')==msg,'MESSAGE_ID_MISMATCH')
        check(p.get('FID','0|') in {'0','0|',''},'UNKNOWN_TRIAL_FEATURE')
        check(not any(k.startswith(('FS_','NFR_')) for k in p),'UNKNOWN_TRIAL_FEATURE')
        check('CFG' not in p and 'ABPM' not in p,'UNKNOWN_TRIAL_FEATURE')
        for k in ('B','AB','TW'):amount(p.get(k))
        remaining=amount(p.get('NFG','0'));check(remaining<=100,'TRIAL_FREE_LIMIT')
        check(p.get('IFG') in {'0','1'},'INVALID_NEXTGEN_STATE')
        if msg=='FREE_GAME':check(p['IFG']=='1' and 'NFG' in p,'INVALID_FREE_GAME_STATE')
        text=step.get('responseXml')
        check(isinstance(text,str) and len(text)<262144 and '<!DOCTYPE' not in text.upper()
            and '<!ENTITY' not in text.upper(),'INVALID_TRIAL_XML')
        try:root=ET.fromstring(text)
        except ET.ParseError:check(False,'INVALID_TRIAL_XML')
        check(root.tag.upper()=='GDMRESPONSE' and str(root.findtext('SUCCESS')).lower()=='true'
            and root.findtext('PAYLOAD')==step['responsePayload'],'TRIAL_XML_EVIDENCE_MISMATCH')
        check(amount(step.get('elapsedMs'))<=300000,'INVALID_TRIAL_TIMING')
        return remaining

    def settled(self, raw):
        if raw.get('explicitProbeContract') is not None:
            from explicit_request_probe import binding,is_feature
            binding(self.plan,raw)
            check(not is_feature(raw),'INCOMPLETE_EXPLICIT_PROBE')
        if raw.get('automaticFreeContract') is not None:
            from automatic_free_fields import binding,settled
            binding(self.plan)
            if raw.get('balanceContract') is not None:
                from held_balance_fields import binding as balance_binding
                balance_binding(self.plan)
            return settled(raw)
        if raw.get('balanceContract') is not None:
            from held_balance_fields import binding, settled
            binding(self.plan)
            check(raw.get('sourceKey')==self.plan['sourceKey'],'TRIAL_PROFILE_REQUIRED')
            return settled(raw)
        check(raw.get('fixtureOnly') is False and raw.get('protocol')=='nextgen'
            and raw.get('sourceKey')==self.plan['sourceKey'] and raw.get('roundFieldsVersion')==VERSION,'TRIAL_PROFILE_REQUIRED')
        steps=raw['steps'];check(0<len(steps)<=100 and steps[0]['msgId']=='BET','INVALID_ROUND_STEPS')
        prior=None;player=None
        for i,step in enumerate(steps):
            check(step['msgId']==('BET' if i==0 else 'FREE_GAME'),'MULTIPLE_PAID_ROUNDS')
            if i:check(prior>0,'UNEXPECTED_FREE_CONTINUATION')
            prior=self.frame(step);pid=params(step['requestPayload'])['PID']
            check(player is None or player==pid,'SESSION_CHANGED_MID_ROUND');player=pid
        check(prior==0,'INCOMPLETE_ROUND')
        fields=derive(raw)
        check(fields['money']['betRaw']==self.plan['betRaw'] and fields['buy']==0,'TRIAL_ACTUAL_COST_MISMATCH')
        return fields

    def next_request(self, raw):
        if raw.get('automaticFreeContract') is not None:
            from automatic_free_fields import binding,next_request
            binding(self.plan)
            return next_request(raw)
        return {'MSGID':'FREE_GAME'} if self.frame(raw['steps'][-1]) else None
