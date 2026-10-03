import copy
import json
import unittest
from pathlib import Path
from huff_action_fields import HuffActionFields, CONTRACT_HASH
from huff_fields import HuffFields
from round_fields import FieldError


class HuffActionTests(unittest.TestCase):
    def test_actual_frame_exit_awards_mansion_and_rejects_inconsistent_completed_display(self):
        evidence = json.loads((Path(__file__).resolve().parents[2] / 'scripts/trial/fixtures/huff-hardhat-mansion-prefix.json').read_text(encoding='utf-8'))
        raw = evidence['raw']
        before = copy.deepcopy(raw)
        adapter = HuffActionFields(self.vector['plan'])
        self.assertFalse(evidence['naturalTerminalObserved'])
        for count in range(1, len(raw['steps']) + 1):
            self.assertEqual(adapter.next_request({**raw, 'steps': raw['steps'][:count]}), {'MSGID': 'FREE_GAME'})
        with self.assertRaises(FieldError):
            adapter.settled(raw)
        self.assertEqual(raw, before)
        import re
        for key, value in [('MMFG', '0'), ('CFNFG', '1'), ('CFTFG', '8'), ('CFCFGG', '6'),
                           ('PCFID', '1|'), ('FEAT', 'PAINT'), ('FRAMEWINS', '|'.join(['0'] * 15))]:
            changed = copy.deepcopy(raw)
            step = changed['steps'][-1]
            step['responsePayload'] = re.sub(key + r'~[^#&]*', key + '~' + value, step['responsePayload'])
            step['responseXml'] = '<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>' + step['responsePayload'].replace('&', '&amp;') + '</PAYLOAD></GDMRESPONSE>'
            with self.subTest(key=key), self.assertRaises(FieldError):
                adapter.next_request(changed)

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

    def test_actual_paint_display_prefix_and_conflicting_display_counters(self):
        evidence = json.loads((Path(__file__).resolve().parents[2] / 'scripts/trial/fixtures/huff-paint-display-prefix.json').read_text(encoding='utf-8'))
        self.assertEqual(evidence['evidenceKind'], 'sanitized-real-prefix')
        self.assertFalse(evidence['naturalTerminalObserved'])
        raw = evidence['raw']
        plan = {k: v for k, v in self.vector['plan'].items() if k not in ('featureProfile', 'actionContractHash')}
        adapter = HuffFields(plan)
        for count in range(1, len(raw['steps']) + 1):
            self.assertEqual(adapter.next_request({**raw, 'steps': raw['steps'][:count]}), {'MSGID': 'FREE_GAME'})
        with self.assertRaises(FieldError):
            adapter.settled(raw)
        for key, value in [('CFNFG', '4'), ('CFTFG', '7'), ('CFCFGG', '0'), ('CFFGT', 'bad'), ('FMS', 'bad')]:
            changed = copy.deepcopy(raw)
            step = changed['steps'][2]
            import re
            step['responsePayload'] = re.sub(key + r'~[^#&]*', key + '~' + value, step['responsePayload'])
            step['responseXml'] = '<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>' + step['responsePayload'].replace('&', '&amp;') + '</PAYLOAD></GDMRESPONSE>'
            with self.subTest(key=key), self.assertRaises(FieldError):
                adapter.next_request(changed)


if __name__ == '__main__':
    unittest.main()
