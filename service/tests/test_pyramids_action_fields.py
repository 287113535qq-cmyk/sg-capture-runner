import copy,unittest
from test_pyramids_flow_review import PLAN,flow_sample,mixed_prefix,rewrite
from pyramids_action_fields import PyramidsActionFields,ACTION_VERSION,CONTRACT_HASH
from pyramids_fields import PyramidsFields
from round_fields import FieldError

ACTION_PLAN={**PLAN,'featureProfile':ACTION_VERSION,'actionContractHash':CONTRACT_HASH}
def action_raw(raw):
    return {**copy.deepcopy(raw),'requestFlowVersion':ACTION_VERSION,'actionContractHash':CONTRACT_HASH}

class ActionFieldsTests(unittest.TestCase):
    def test_original_traffic_and_money_complete_without_invented_game_class(self):
        raw=action_raw(flow_sample())
        for s in raw['steps']:rewrite(s,GSD='UNKNOWNDISPLAY~uninterpreted#HNSID~7#FGTHNS~1')
        before=copy.deepcopy(raw);parser=PyramidsActionFields(ACTION_PLAN)
        for n in range(1,len(raw['steps'])):
            self.assertEqual(parser.next_request({**raw,'steps':raw['steps'][:n]}),{'MSGID':'FREE_GAME'})
            with self.assertRaisesRegex(FieldError,'ACTION_INCOMPLETE'):parser.settled({**raw,'steps':raw['steps'][:n]})
        record=parser.settled(raw)
        self.assertEqual(record['classificationStatus'],'pending')
        self.assertIsNone(record['bonus']);self.assertIsNone(record['primaryBonusKind'])
        self.assertEqual(record['money']['betRaw'],20)
        self.assertEqual(raw,before)
        with self.assertRaises(FieldError):PyramidsFields(PLAN).settled(raw)

    def test_unknown_gameplay_never_authorizes_unknown_actions_or_bad_wallet(self):
        for change in ({'FID':'2|'},{'GCT':'1'},{'B':'99999'},{'AB':'99999'}):
            raw=action_raw(flow_sample());rewrite(raw['steps'][-1],**change)
            with self.subTest(change=change),self.assertRaises(FieldError):PyramidsActionFields(ACTION_PLAN).settled(raw)
        raw=action_raw(mixed_prefix())
        self.assertEqual(PyramidsActionFields(ACTION_PLAN).next_request(raw),{'MSGID':'FREE_GAME'})
        with self.assertRaises(FieldError):PyramidsActionFields(ACTION_PLAN).settled(raw)

    def test_both_profile_and_new_raw_contract_are_required(self):
        raw=action_raw(flow_sample())
        for plan in (PLAN,{**ACTION_PLAN,'actionContractHash':'0'*64}):
            with self.assertRaises(FieldError):PyramidsActionFields(plan).next_request(raw)
        for change in ({'requestFlowVersion':'other'},{'actionContractHash':'0'*64}):
            with self.assertRaises(FieldError):PyramidsActionFields(ACTION_PLAN).next_request({**raw,**change})

    def test_existing_records_keep_old_classification_and_new_profiles_cannot_relabel_them(self):
        raw=flow_sample()
        self.assertEqual(PyramidsActionFields(ACTION_PLAN).settled(raw),PyramidsFields(PLAN).settled(raw))

if __name__=='__main__':unittest.main()
