import json
from pathlib import Path
import sys
import tempfile
import unittest
from xml.sax.saxutils import escape

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'service'))
import native_coverage as coverage


class NativeCoverageTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.assets=Path(self.temp.name)
        self.plan=json.loads((ROOT/'config/round-one-plans.json').read_text())['32651']
        self.directory=self.assets/'sg'/'32651';self.directory.mkdir(parents=True)
    def frame(self,feature=False,enhanced=False,rejected=False):
        request='&'.join(f'{k}={v}' for k,v in {**self.plan['requestParams'],
            'PID':'gdmgcmcoverage-fixture','MSGID':'BET',**({'ABPM':'1'} if enhanced else {})}.items())
        response='MSGID=ERROR&AB=100000' if rejected else 'MSGID=BET&B=99892&AB=99892&TW=0&IFG=0&NFG=0&FID='+('1|&CFG=1&FS_1=0&NFR_1=1' if feature else '0|')
        return {'msgId':'BET','requestPayload':request,'responsePayload':response,
            'responseXml':'<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>'+escape(response)+'</PAYLOAD></GDMRESPONSE>'}
    def run_review(self,frames):
        (self.directory/'traffic.jsonl').write_text(''.join(json.dumps(frame)+'\n' for frame in frames))
        return coverage.review(self.plan,self.assets)
    def test_natural_feature_missing_from_settled_rounds_is_detected_in_traffic(self):
        result=self.run_review([self.frame(),self.frame(feature=True)])
        self.assertTrue(result['needsCoverageReview'])
        self.assertEqual(result['issues'][0]['code'],'UNKNOWN_TRIAL_FEATURE')
        self.assertNotIn('PID',json.dumps(result))
        self.assertNotIn('gdmgcmcoverage-fixture',json.dumps(result))
    def test_enhanced_requests_and_rejected_bets_do_not_establish_base_feature_flow(self):
        result=self.run_review([self.frame(),self.frame(feature=True,enhanced=True),self.frame(rejected=True)])
        self.assertFalse(result['needsCoverageReview'])
        self.assertEqual(result['matchingBaseStarts'],1)
        self.assertFalse(result['absenceOfFindingsProvesAllFeaturesSupported'])
    def test_missing_and_truncated_traffic_require_review(self):
        self.assertTrue(coverage.review(self.plan,self.assets)['needsCoverageReview'])
        self.run_review([self.frame(),self.frame()])
        self.assertTrue(coverage.review(self.plan,self.assets,limit=1)['needsCoverageReview'])


if __name__=='__main__':unittest.main()
