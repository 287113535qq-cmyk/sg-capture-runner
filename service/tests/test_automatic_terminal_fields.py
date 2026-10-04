import copy,json,unittest
from pathlib import Path
from xml.sax.saxutils import escape
from automatic_terminal_fields import CONTRACT,policy,next_request,settled
from automatic_free_fields import prefix as old_prefix
from native_nextgen_fields import NativeNextgenFields
from round_fields import FieldError,derive
from ag_rolling_plan import validate_rolling_plan
from store import Rejected
BOOK=json.loads((Path(__file__).resolve().parents[2]/'config/ag-rolling-plans.json').read_bytes());PLAN=BOOK['plans']['32595']
PID='gdmgcmoffline-python-terminal'
def xml(p):return '<GDMRESPONSE><OGS_RC>0</OGS_RC><SUCCESS>true</SUCCESS><PAYLOAD>'+escape(p)+'</PAYLOAD></GDMRESPONSE>'
def sample(fid='2|',total=7):
    raw=dict(fixtureOnly=False,protocol='nextgen',sourceKey=PLAN['sourceKey'],roundFieldsVersion='sg-round-fields-v1',startBalanceRaw=10000,automaticFreeContract=PLAN['automaticFreeContract'],automaticTerminalContract=CONTRACT,steps=[])
    for i in range(total+1):
        msg='FREE_GAME' if i else 'BET';win=50+10*i;ab=9800+win if i==total else 9800
        p={k:'0' for k in policy()['responseKeySets'][msg][-1]}
        p.update(MSGID=msg,IFG=str(int(i>0)),NFG=str(total-i),FID=fid,B=str(9800+win),AB=str(ab),TW=str(win),CW=str(10 if i else 50),FGTW=str(10*i),TFG=str(total),CFGG=str(i),BPR='10',MUL='1',FRBAL='0',SID='stable-response-session')
        if not i:p['FGT']=str(total)
        payload='&'.join(f'{k}={v}' for k,v in p.items());q={**PLAN['requestParams'],'PID':PID,'MSGID':msg}
        raw['steps'].append(dict(methodName='processGameMessage',msgId=msg,requestPayload='&'.join(f'{k}={v}' for k,v in q.items()),responsePayload=payload,responseXml=xml(payload),responseBalance=ab,elapsedMs=0))
    return raw
def alter(raw,i,key,value):
    s=raw['steps'][i];p=dict(x.split('=',1) for x in s['responsePayload'].split('&'))
    if value is None:p.pop(key,None)
    else:p[key]=value
    s['responsePayload']='&'.join(f'{k}={v}' for k,v in p.items());s['responseXml']=xml(s['responsePayload'])
class AutomaticTerminalTests(unittest.TestCase):
    def test_five_reviewed_counter_paths_settle_and_match_native_and_derive(self):
        for fid,total in [('2|',7),* [('3|',i) for i in range(9,13)]]:
            raw=sample(fid,total);self.assertIsNone(next_request(raw,PLAN));fields=settled(raw,PLAN)
            self.assertEqual(fields['money'],dict(startBalanceRaw=10000,endBalanceRaw=9850+10*total,totalWinRaw=50+10*total,betRaw=200));self.assertEqual(fields,NativeNextgenFields(PLAN).settled(raw));self.assertEqual(fields,derive(raw))
            raw['steps'].pop();self.assertEqual(next_request(raw,PLAN),{'MSGID':'FREE_GAME'})
            with self.assertRaisesRegex(FieldError,'INCOMPLETE'):settled(raw,PLAN)
    def test_unseen_fids_retrigger_counters_and_explicit_features_refused(self):
        for raw in [sample('2|',8),sample('3|',8),sample('3|',13),sample('4|',7)]:
            with self.assertRaises(FieldError):next_request(raw,PLAN)
        for i,k,v in [(1,'FID','3|'),(1,'NFG','7'),(1,'TFG','8'),(1,'CFGG','0'),(1,'FGT','7'),(0,'FGT','8'),(1,'FS_2','1'),(1,'CFG','2'),(1,'ABPM','0')]:
            raw=sample();alter(raw,i,k,v)
            with self.subTest(k=k),self.assertRaises(FieldError):next_request(raw,PLAN)
    def test_money_awards_observer_pid_sid_business_error_and_xml_refused(self):
        for k,v in [('B','9861'),('AB','9860'),('TW','59'),('CW','11'),('FGTW','11'),('SID','changed'),('FRBAL','1')]:
            raw=sample();alter(raw,1,k,v)
            with self.subTest(k=k),self.assertRaises(FieldError):next_request(raw,PLAN)
        for kind in ['observer','pid','xml_error','xml_status','xml_reject','timing']:
            raw=sample();s=raw['steps'][1]
            if kind=='observer':s['responseBalance']+=1
            elif kind=='pid':s['requestPayload']=s['requestPayload'].replace(PID,'gdmgcmother')
            elif kind=='xml_error':s['responseXml']=s['responseXml'].replace('</GDMRESPONSE>','<ERROR>rejected</ERROR></GDMRESPONSE>')
            elif kind=='xml_status':s['responseXml']=s['responseXml'].replace('<OGS_RC>0','<OGS_RC>1')
            elif kind=='xml_reject':s['responseXml']=s['responseXml'].replace('<SUCCESS>true','<SUCCESS>false')
            else:s['elapsedMs']=300001
            with self.subTest(kind=kind),self.assertRaises(FieldError):next_request(raw,PLAN)
    def test_old_v1_marker_terminal_refused_and_ordinary_fid1_preserved(self):
        raw=sample();del raw['automaticTerminalContract']
        with self.assertRaisesRegex(FieldError,'UNREVIEWED_AUTOMATIC_TERMINAL'):NativeNextgenFields(PLAN).settled(raw)
        for fid,total in [('0|',0),('1|',7)]:
            raw=sample(fid,total);prior=old_prefix(raw);fields=settled(raw,PLAN);self.assertEqual(fields['money']['totalWinRaw'],prior['win']);self.assertEqual(fields['money']['endBalanceRaw'],prior['balance'])
    def test_exact_game_plan_marker_source_and_wager_required(self):
        for k,v in [('gameId',32500),('betRaw',201),('runtimeGameId',33027),('automaticTerminalContractHash','f'*64)]:
            with self.subTest(k=k),self.assertRaisesRegex(FieldError,'BINDING'):next_request(sample(),{**PLAN,k:v})
        raw=sample();raw['automaticTerminalContract']='unknown'
        with self.assertRaisesRegex(FieldError,'PROFILE'):next_request(raw,PLAN)
    def test_mandatory_wiring_proof_never_allows_missing_or_tampered_evidence(self):
        from unittest.mock import patch
        path=Path(__file__).resolve().parents[2]/'config/ag-rolling-plans.json';original=Path.read_text
        self.assertEqual(validate_rolling_plan(PLAN),PLAN)
        for damage in ['missing','hash','count','credit']:
            proof=copy.deepcopy(BOOK['proofs']['32595'])
            if damage=='missing':proof['automaticTerminalEvidence'].pop('wiringEvidence')
            elif damage=='hash':proof['automaticTerminalEvidence']['wiringEvidence']['evidenceHash']='f'*64
            elif damage=='count':proof['automaticTerminalEvidence']['ownClosedNaturalRounds']=103
            else:proof['automaticTerminalEvidence']['failedRoundsCredited']=1
            altered=copy.deepcopy(BOOK);altered['proofs']['32595']=proof
            def read(current,*args,**kwargs):return json.dumps(altered) if current==path else original(current,*args,**kwargs)
            with patch.object(Path,'read_text',read),self.subTest(damage=damage),self.assertRaisesRegex(Rejected,'ROLLING_AUTOMATIC_TERMINAL_PROOF'):validate_rolling_plan(PLAN)
