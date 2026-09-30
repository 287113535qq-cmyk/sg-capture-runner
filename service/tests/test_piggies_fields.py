import copy,json,pathlib,sys,unittest
from xml.sax.saxutils import escape
ROOT=pathlib.Path(__file__).resolve().parents[2]
sys.path[:0]=[str(ROOT/'service'),str(ROOT/'scripts/runner-v2')]
from piggies_fields import PiggiesFields,SOURCE
from round_fields import VERSION,FieldError,params
from record_fields import execute
PLAN=json.loads((ROOT/'config/round-one-plans.json').read_text())['32636']

def rewrite(step,**updates):
    p=params(step['responsePayload'])
    for k,v in updates.items():
        if v is None:p.pop(k,None)
        else:p[k]=str(v)
    step['responsePayload']='&'.join(k+'='+v for k,v in p.items())
    step['responseXml']='<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>'+escape(step['responsePayload'])+'</PAYLOAD></GDMRESPONSE>'
    return step

def sample(free=True):
    counts=[(2,2,0),(3,4,1),(2,4,2),(1,4,3),(0,4,4)] if free else [(0,0,0)]
    steps=[]
    for i,(n,t,c) in enumerate(counts):
        msg='FREE_GAME' if i else 'BET'
        step={'msgId':msg,'elapsedMs':1,'requestPayload':'&'.join(k+'='+v for k,v in {**PLAN['requestParams'],'MSGID':msg,'PID':'gdmgcmpiggies-offline'}.items()),'responsePayload':'MSGID='+msg}
        steps.append(rewrite(step,NFG=n,TFG=t,CFGG=c,IFG=int(i>0),FGT=2 if free and not i else None,FID='0|',B=99900,AB=99900,TW=0,GSD='VA~0#MSR~0',FRBAL=0))
    return dict(fixtureOnly=False,sourceKey=SOURCE,protocol='nextgen',roundFieldsVersion=VERSION,startBalanceRaw=100000,steps=steps)

class PiggiesTests(unittest.TestCase):
    def test_retrigger_prefixes_and_independent_runner(self):
        raw=sample()
        for i in range(1,len(raw['steps'])):
            part={**raw,'steps':raw['steps'][:i]}
            self.assertEqual(execute(dict(plan=PLAN,op='next',raw=part)),{'MSGID':'FREE_GAME'})
            with self.assertRaises(FieldError):PiggiesFields(PLAN).settled(part)
        for raw in [sample(),sample(False)]:
            self.assertIsNone(execute(dict(plan=PLAN,op='next',raw=raw)))
            self.assertEqual(PiggiesFields(PLAN).settled(raw)['bonus'],int(len(raw['steps'])>1))

    def test_unsafe_prefix_and_terminal_reject(self):
        for update in [dict(FID='1|'),dict(GCT=1),dict(FRBAL=1),dict(GSD='UNKNOWN~1'),dict(CFG=1),dict(NFR_1=1),dict(NFG=None),dict(TFG=0),dict(CFGG=3),dict(IFG=0),dict(B=99901),dict(TW=1)]:
            raw=sample();rewrite(raw['steps'][-1],**update)
            with self.assertRaises(FieldError):PiggiesFields(PLAN).settled(raw)
        raw=sample();raw['steps'][1]['requestPayload']=raw['steps'][1]['requestPayload'].replace('gdmgcmpiggies-offline','gdmgcmdifferent')
        with self.assertRaises(FieldError):PiggiesFields(PLAN).settled(raw)
        raw=sample();raw['steps'][0]['responseXml']='bad'
        with self.assertRaises(FieldError):PiggiesFields(PLAN).next_request(raw)
        raw=sample(False);raw['startBalanceRaw']=101695
        with self.assertRaisesRegex(FieldError,'TRIAL_ACTUAL_COST_MISMATCH'):PiggiesFields(PLAN).next_request(raw)

if __name__=='__main__':unittest.main()
