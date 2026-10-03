import copy
import json
import unittest
from pathlib import Path
from huff_action_fields import HuffActionFields, CONTRACT_HASH
from huff_fields import HuffFields
from round_fields import FieldError


class HuffActionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.vector = json.loads((Path(__file__).resolve().parents[2] / 'scripts/trial/fixtures/huff-action.json').read_text(encoding='utf-8'))

    def test_fid3_prefixes_terminal_and_independent_pending_classification(self):
        plan, raw = self.vector['plan'], self.vector['raw']
        adapter = HuffActionFields(plan)
        self.assertEqual(CONTRACT_HASH, plan['actionContractHash'])
        for count in range(len(raw['steps']) + 1):
            prefix = {**raw, 'steps': raw['steps'][:count]}
            following = None if count == len(raw['steps']) else {'MSGID': 'FREE_GAME' if count else 'BET'}
            self.assertEqual(adapter.next_request(prefix), following)
        result = adapter.settled(raw)
        self.assertIsNone(result['bonus'])
        self.assertEqual(result['classificationStatus'], 'pending')
        self.assertEqual(result['money'], dict(startBalanceRaw=100000, endBalanceRaw=100250, totalWinRaw=750, betRaw=500))
        with self.assertRaises(FieldError):
            adapter.settled({**raw, 'steps': raw['steps'][:2]})

    def test_invalid_money_session_counter_xml_and_unknown_actions(self):
        adapter = HuffActionFields(self.vector['plan'])
        for index, field, value in [(1, 'FID', '5|'), (2, 'CFGG', '0'), (2, 'B', '99501'),
                                     (7, 'AB', '99500'), (2, 'GCT', '1'), (2, 'CFG', '1'), (2, 'FID', '4|')]:
            raw = copy.deepcopy(self.vector['raw'])
            step = raw['steps'][index]
            p = dict(v.split('=', 1) for v in step['responsePayload'].split('&'))
            p[field] = value
            step['responsePayload'] = '&'.join(k + '=' + v for k, v in p.items())
            step['responseXml'] = '<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>' + step['responsePayload'].replace('&', '&amp;') + '</PAYLOAD><OGS_RC>0</OGS_RC></GDMRESPONSE>'
            with self.subTest(field=field), self.assertRaises(FieldError):
                adapter.next_request(raw)
        raw = copy.deepcopy(self.vector['raw'])
        raw['steps'][2]['requestPayload'] = raw['steps'][2]['requestPayload'].replace('gdmgcmoffline-vector', 'gdmgcmother')
        with self.assertRaises(FieldError):
            adapter.next_request(raw)

    def test_original_base_profile_keeps_raw_immutable_and_finishes_with_pending_type(self):
        raw = copy.deepcopy(self.vector['raw'])
        del raw['requestFlowVersion']
        del raw['actionContractHash']
        before = copy.deepcopy(raw)
        plan = {k: v for k, v in self.vector['plan'].items() if k not in ('featureProfile', 'actionContractHash')}
        adapter = HuffFields(plan)
        self.assertEqual(adapter.next_request({**raw, 'steps': raw['steps'][:2]}), {'MSGID': 'FREE_GAME'})
        self.assertEqual(adapter.settled(raw), HuffActionFields(self.vector['plan']).settled(self.vector['raw']))
        self.assertEqual(raw, before)
        with self.assertRaises(FieldError):
            adapter.settled({**raw, 'steps': raw['steps'][:2]})
        with self.assertRaises(FieldError):
            HuffFields({**plan, 'betRaw': 1000}).next_request(raw)


if __name__ == '__main__':
    unittest.main()
