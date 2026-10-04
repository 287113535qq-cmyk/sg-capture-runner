import copy,json,pathlib,sys,unittest
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]))
from explicit_request_probe import CONTRACT,route,intent
from native_nextgen_fields import NativeNextgenFields
from round_fields import FieldError
from test_explicit_request_review import REG,sample
class ExplicitProbeTests(unittest.TestCase):
    def raw(self,key='32474',start=False):
        r=sample(key,start);r['explicitProbeContract']=CONTRACT;return r
    def test_only_reviewed_continuations_and_no_settlement(self):
        for key in ['32474','32497']:
            r=route(REG['plans'][key],self.raw(key));self.assertFalse(r['settlementApproved'])
            self.assertEqual(r['request'],{'MSGID':'FEATURE_START','CFG':'1' if key=='32474' else '0'})
        p=REG['plans']['32474'];r=self.raw('32474',True);self.assertEqual(len(route(p,r)['options']),15)
        q=f"GN={p['runtimeSlug']}&PID=gdmgcmoffline-explicit&MSGID=FEATURE_PICK&CFG=1&FP=1|1|14"
        self.assertEqual(intent(p,r,q),{'validated':True})
        with self.assertRaisesRegex(FieldError,'INCOMPLETE_EXPLICIT_PROBE'):NativeNextgenFields(p).settled(r)
    def test_unknown_response_and_altered_scope_cannot_continue(self):
        p=REG['plans']['32474'];r=self.raw('32474',True);r['steps'].append(copy.deepcopy(r['steps'][1]))
        with self.assertRaisesRegex(FieldError,'RESPONSE_REVIEW_REQUIRED'):route(p,r)
        with self.assertRaisesRegex(FieldError,'RESPONSE_REVIEW_REQUIRED'):route(REG['plans']['32497'],self.raw('32497',True))
        for changed in [{**p,'betRaw':109},{**p,'explicitProbeContractHash':'a'*64}]:
            with self.assertRaisesRegex(FieldError,'BINDING'):route(changed,self.raw())
        missing=self.raw();missing.pop('explicitProbeContract')
        with self.assertRaisesRegex(FieldError,'PROFILE'):route(p,missing)
    def test_intent_rejects_wrong_ordinal_position_session_and_extra_fields(self):
        p=REG['plans']['32474'];r=self.raw('32474',True)
        prefix=f"GN={p['runtimeSlug']}&PID=gdmgcmoffline-explicit&MSGID=FEATURE_PICK&CFG=1&"
        for fp in ['FP=0|1|0','FP=1|2|0','FP=1|1|15','FP=1|1|0&EXTRA=1']:
            with self.assertRaisesRegex(FieldError,'POSITION|INTENT_CHANGED'):intent(p,r,prefix+fp)
        with self.assertRaisesRegex(FieldError,'INTENT_CHANGED'):intent(p,r,(prefix+'FP=1|1|0').replace('gdmgcmoffline-explicit','gdmgcmother'))
if __name__=='__main__':unittest.main()
