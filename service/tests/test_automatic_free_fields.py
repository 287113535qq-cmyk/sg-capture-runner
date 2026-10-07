import copy,json,pathlib,sys,unittest
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]))
from automatic_free_fields import CONTRACT,settled
from native_nextgen_fields import NativeNextgenFields
from round_fields import FieldError,derive
REGISTRY=json.loads((pathlib.Path(__file__).resolve().parents[2]/'config/ag-rolling-plans.json').read_text(encoding='utf-8'))
PLAN=REGISTRY['plans']['32500']
def sample(p=PLAN):
    steps=[];held=1000-p['betRaw']
    for i,(msg,nfg,win) in enumerate([('BET',2,0),('FREE_GAME',1,20),('FREE_GAME',0,50)]):
        fid=('1|0|' if i==1 else '0|') if p['gameId']==32486 else '1|'
        ab=held+win if i==2 else held
        q='&'.join(f'{k}={v}' for k,v in {**p['requestParams'],'PID':'gdmgcmoffline-automatic','MSGID':msg}.items())
        payload=f'MSGID={msg}&IFG={int(i>0)}&NFG={nfg}&FID={fid}&B={held+win}&AB={ab}&TW={win}'
        steps.append({'methodName':'processGameMessage','msgId':msg,'requestPayload':q,'responsePayload':payload,
            'responseXml':'<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>'+payload.replace('&','&amp;')+'</PAYLOAD></GDMRESPONSE>',
            'responseBalance':ab,'elapsedMs':0})
    return {'fixtureOnly':False,'protocol':'nextgen','sourceKey':p['sourceKey'],'roundFieldsVersion':'sg-round-fields-v1',
            'automaticFreeContract':CONTRACT,**({'balanceContract':p['balanceContract']} if p.get('balanceContract') else {}),
            'startBalanceRaw':1000,'steps':steps}
def change(raw,i,old,new):
    step=raw['steps'][i];step['responsePayload']=step['responsePayload'].replace(old,new)
    step['responseXml']='<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>'+step['responsePayload'].replace('&','&amp;')+'</PAYLOAD></GDMRESPONSE>'
    return raw
class AutomaticFreeTests(unittest.TestCase):
    def test_known_per_game_automatic_ids_route_to_original_free_request_and_complete(self):
        for p in [REGISTRY['plans'][g] for g in ['32486','32500','32501']]:
            a=NativeNextgenFields(p);r=sample(p)
            self.assertEqual(a.next_request({**r,'steps':[]}),{'MSGID':'BET'})
            self.assertEqual(a.next_request({**r,'steps':r['steps'][:1]}),{'MSGID':'FREE_GAME'})
            self.assertIsNone(a.next_request(r));f=a.settled(r)
            self.assertEqual(f['money']['betRaw'],p['betRaw']);self.assertEqual(f['bonus'],1)
            self.assertEqual(derive(r),f)
    def test_partial_feature_prefix_cannot_be_recorded_or_counted(self):
        r=sample();r['steps'].pop()
        self.assertEqual(NativeNextgenFields(PLAN).next_request(r),{'MSGID':'FREE_GAME'})
        with self.assertRaisesRegex(FieldError,'INCOMPLETE'):settled(r)
    def test_explicit_choice_unknown_ids_and_unsupported_terminal_id_are_rejected(self):
        for old,new in [('FID=1|','FID=2|'),('FID=1|','FID=1|&FS_1=0'),('FID=1|','FID=1|&NFR_1=1'),
                        ('FID=1|','FID=1|&CFG=1'),('FID=1|','FID=1|&ABPM=1')]:
            with self.assertRaisesRegex(FieldError,'FEATURE'):settled(change(sample(),0,old,new))
        p=REGISTRY['plans']['32486']
        with self.assertRaisesRegex(FieldError,'FEATURE'):settled(change(sample(p),2,'FID=0|','FID=1|0|'))
    def test_financial_fields_available_credit_and_observer_are_checked_on_every_frame(self):
        for r in [change(sample(),1,'B=920','B=921'),change(sample(),1,'AB=900','AB=920'),
                  change(sample(),2,'TW=50','TW=49')]:
            with self.assertRaisesRegex(FieldError,'MONEY'):settled(r)
        r=sample();r['steps'][1]['responseBalance']+=1
        with self.assertRaisesRegex(FieldError,'OBSERVER'):settled(r)
    def test_source_request_session_xml_and_pinned_plan_cannot_be_changed(self):
        r=sample();r['steps'][1]['requestPayload']+='&REC=1'
        with self.assertRaisesRegex(FieldError,'REQUEST_MODE'):settled(r)
        r=sample();r['steps'][1]['requestPayload']=r['steps'][1]['requestPayload'].replace('gdmgcmoffline-automatic','gdmgcmother')
        with self.assertRaisesRegex(FieldError,'SESSION'):settled(r)
        r=sample();r['steps'][0]['responseXml']=r['steps'][0]['responseXml'].replace('TW=0','TW=1')
        with self.assertRaisesRegex(FieldError,'XML_EVIDENCE'):settled(r)
        with self.assertRaisesRegex(FieldError,'PLAN_BINDING'):NativeNextgenFields({**PLAN,'betRaw':101}).settled(sample())
    def test_unmarked_historical_feature_is_not_silently_approved_by_a_new_plan(self):
        r=sample();r.pop('automaticFreeContract');r.pop('balanceContract')
        with self.assertRaisesRegex(FieldError,'UNKNOWN_TRIAL_FEATURE'):NativeNextgenFields(PLAN).settled(r)
    def test_reviewed_long_continuation_is_source_bound_and_keeps_partial_rounds_incomplete(self):
        from automatic_free_fields import next_request
        for game in ['32529','32530']:
            p=REGISTRY['plans'][game];r=sample(p);held=1000-p['betRaw'];steps=[]
            for i in range(101):
                msg='BET' if i==0 else 'FREE_GAME';remaining=100-i;ab=held if remaining else held+i
                q='&'.join(f'{k}={v}' for k,v in {**p['requestParams'],'PID':'gdmgcmoffline-automatic','MSGID':msg}.items())
                payload=f'MSGID={msg}&IFG={int(i>0)}&NFG={remaining}&FID=0|&B={held+i}&AB={ab}&TW={i}'
                steps.append({'methodName':'processGameMessage','msgId':msg,'requestPayload':q,'responsePayload':payload,
                 'responseXml':'<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>'+payload.replace('&','&amp;')+'</PAYLOAD></GDMRESPONSE>',
                 'responseBalance':ab,'elapsedMs':0})
            r['steps']=steps;a=NativeNextgenFields(p)
            self.assertIsNone(a.next_request(r));self.assertEqual(a.settled(r)['money']['endBalanceRaw'],1000)
            partial={**r,'steps':steps[:100]};self.assertEqual(next_request(partial),{'MSGID':'FREE_GAME'})
            with self.assertRaisesRegex(FieldError,'INCOMPLETE'):a.settled(partial)
            with self.assertRaisesRegex(FieldError,'PLAN_BINDING'):NativeNextgenFields({**p,'maxSteps':100}).settled(r)
            with self.assertRaisesRegex(FieldError,'INVALID_ROUND_STEPS'):a.settled({**r,'steps':[steps[0]]*1027})
            with self.assertRaisesRegex(FieldError,'INVALID_ROUND_STEPS'):settled({**sample(),'steps':[sample()['steps'][0]]*101})
    def test_native_prefix_only_feature_ids_do_not_approve_unseen_terminals(self):
        p=REGISTRY['plans']['32595'];a=NativeNextgenFields(p)
        for fid in ['2|','3|']:
            r=sample(p)
            for i in range(len(r['steps'])):change(r,i,'FID=1|',f'FID={fid}')
            self.assertEqual(a.next_request({**r,'steps':r['steps'][:2]}),{'MSGID':'FREE_GAME'})
            with self.assertRaisesRegex(FieldError,'UNREVIEWED_AUTOMATIC_TERMINAL'):a.settled(r)
    def test_hurricane_reviewed_terminal_keeps_all_other_native_choices_and_partial_rounds_rejected(self):
        p=REGISTRY['plans']['32550'];a=NativeNextgenFields(p)
        for fid in ['3|','0|']:
            r=sample(p)
            for i in range(len(r['steps'])):change(r,i,'FID=1|',f'FID={fid}')
            self.assertIsNone(a.next_request(r))
            self.assertEqual(a.settled(r)['money']['endBalanceRaw'],942)
            partial={**r,'steps':r['steps'][:2]}
            self.assertEqual(a.next_request(partial),{'MSGID':'FREE_GAME'})
            with self.assertRaisesRegex(FieldError,'INCOMPLETE'):a.settled(partial)
        r=sample(p)
        for i in range(len(r['steps'])):change(r,i,'FID=1|','FID=3|')
        for value in ['1|','2|','2|4|','2|5|','2|6|','3|&CFG=3','3|&FS_3=0','3|&NFR_3=1']:
            with self.assertRaisesRegex(FieldError,'UNKNOWN_TRIAL_FEATURE'):
                a.next_request(change(copy.deepcopy(r),0,'FID=3|',f'FID={value}'))
        with self.assertRaisesRegex(FieldError,'UNKNOWN_TRIAL_FEATURE'):
            a.next_request(change(copy.deepcopy(r),0,'NFG=2','NFG=0'))
        with self.assertRaisesRegex(FieldError,'TRIAL_FREE_LIMIT'):
            a.next_request(change(copy.deepcopy(r),1,'NFG=1','NFG=101'))
        unmarked=copy.deepcopy(r);unmarked.pop('automaticFreeContract')
        with self.assertRaisesRegex(FieldError,'UNKNOWN_TRIAL_FEATURE'):a.next_request(unmarked)
    def test_huff_own_trigger_mixed_free_frames_and_terminal_remain_strict(self):
        p=REGISTRY['plans']['32715'];a=NativeNextgenFields(p)
        def make(mid='1|2|'):
            r=sample(p)
            for i,fid in enumerate(['2|',mid,'0|']):change(r,i,'FID=1|',f'FID={fid}')
            return r
        for fid in ['0|','0|1|','0|2|','1|2|','2|']:
            r=make(fid);self.assertIsNone(a.next_request(r));self.assertEqual(a.settled(r)['bonus'],1)
            partial={**r,'steps':r['steps'][:2]};self.assertEqual(a.next_request(partial),{'MSGID':'FREE_GAME'})
            with self.assertRaisesRegex(FieldError,'INCOMPLETE'):a.settled(partial)
        for fid in ['1|','3|','2|&CFG=1','2|&NFR_2=1','2|&FS_2=0']:
            with self.assertRaisesRegex(FieldError,'FEATURE'):a.next_request(change(make(),0,'FID=2|',f'FID={fid}'))
        for fid in ['2|','1|2|']:
            with self.assertRaisesRegex(FieldError,'TERMINAL'):a.settled(change(make(),2,'FID=0|',f'FID={fid}'))
        with self.assertRaisesRegex(FieldError,'MONEY'):a.next_request(change(make(),1,'B=820','B=821'))
    def test_direct_hit_mid_free_evidence_does_not_admit_paid_feature_triggers_or_unknown_terminals(self):
        p=REGISTRY['plans']['32708'];a=NativeNextgenFields(p)
        def make(mid='2|0|',end='2|0|'):
            r=sample(p)
            for i,fid in enumerate(['0|',mid,end]):change(r,i,'FID=1|',f'FID={fid}')
            return r
        for mid in ['0|','0|1|','0|2|','1|0|','2|','2|0|']:
            for end in ['0|','1|0|','2|0|']:
                r=make(mid,end);self.assertIsNone(a.next_request(r));self.assertEqual(a.settled(r)['bonus'],1)
                self.assertEqual(a.next_request({**r,'steps':r['steps'][:2]}),{'MSGID':'FREE_GAME'})
        for fid in ['1|','2|','2|0|']:
            with self.assertRaisesRegex(FieldError,'FEATURE'):a.next_request(change(make(),0,'FID=0|',f'FID={fid}'))
        for fid in ['2|','0|1|','0|2|']:
            with self.assertRaisesRegex(FieldError,'TERMINAL'):a.settled(make('2|0|',fid))
        for suffix in ['&CFG=2','&NFR_2=1','&ABPM=1']:
            with self.assertRaisesRegex(FieldError,'FEATURE'):a.next_request(change(make(),1,'FID=2|0|','FID=2|0|'+suffix))
        with self.assertRaisesRegex(FieldError,'INCOMPLETE'):a.settled({**make(),'steps':make()['steps'][:2]})
if __name__=='__main__':unittest.main()
