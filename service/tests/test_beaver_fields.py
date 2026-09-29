"""Synthetic adapter/analyzer integration tests; no source/storage requests."""
import copy
import json
from pathlib import Path
import sys
import unittest
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT / 'service'), str(ROOT / 'scripts/runner-v2')]
from beaver_fields import BeaverSequence, SOURCE, EXTENSION
from native_nextgen_fields import NativeNextgenFields
from round_fields import FieldError, VERSION, type_profile
from record_fields import execute

PLAN = json.loads((ROOT / 'config/round-one-plans.json').read_text())['32820']


def frame(msg, nfg=None, fid='0|', **extra):
    request = {**PLAN['requestParams'], 'MSGID': msg, 'PID': 'gdmgcmoffline-beaver'}
    p = dict(MSGID=msg, FID=fid, IFG=str(int(msg == 'FREE_GAME')), B='99900', AB='99900', TW='0')
    if nfg is not None:
        p.update(NFG=str(nfg), TFG='6', CFGG=str(max(0, 6-nfg)))
    p.update({k: str(v) for k, v in extra.items()})
    payload = '&'.join(f'{k}={v}' for k, v in p.items())
    xml = ET.Element('GDMRESPONSE')
    ET.SubElement(xml, 'SUCCESS').text = 'true'
    ET.SubElement(xml, 'PAYLOAD').text = payload
    return dict(msgId=msg, requestPayload='&'.join(f'{k}={v}' for k, v in request.items()),
                responsePayload=payload, responseXml=ET.tostring(xml, encoding='unicode'), elapsedMs=1)


def raw(steps):
    return dict(protocol='nextgen', sourceKey=SOURCE, fixtureOnly=False,
                roundFieldsVersion=VERSION, startBalanceRaw=100000, steps=steps)


def sample(clear=False):
    return raw([frame('BET', 6, '1|'), frame('FREE_GAME', 8, '1|', TFG=9, CFGG=1),
                frame('FREE_GAME', 0, '0|' if clear else '1|', TFG=9, CFGG=9,
                      TW=500, B=100400, AB=100400)])


class BeaverFieldsTests(unittest.TestCase):
    def test_analyzer_intent_and_same_identity_record_readback(self):
        for clear in [False, True]:
            value = sample(clear)
            partial = {**value, 'steps': value['steps'][:1]}
            self.assertEqual(execute(dict(op='next', plan=PLAN, raw=partial)), {'MSGID': 'FREE_GAME'})
            self.assertTrue(execute(dict(op='intent', plan=PLAN, raw=partial,
                payload=value['steps'][1]['requestPayload']))['validated'])
            with self.assertRaises(FieldError):
                execute(dict(op='intent', plan=PLAN, raw=partial, payload=value['steps'][0]['requestPayload']))
            fields = BeaverSequence(PLAN).settled(value)
            self.assertEqual((fields['bonus'], fields['buy'], fields['money']['betRaw']), (2, 0, 100))
            self.assertEqual(fields['typeMappingHash'], type_profile(EXTENSION)[1])
            record = execute(dict(op='record', plan=PLAN, raw=value, normalized=fields,
                sequence=120, attempt='offline-only', sessionHash='a'*64, worker=7, batchId=2))
            self.assertTrue(execute(dict(op='verify', plan=PLAN, raw=value, record=record))['verified'])
            changed = copy.deepcopy(record)
            changed['normalized']['bonus'] = 1
            with self.assertRaises(AssertionError):
                execute(dict(op='verify', plan=PLAN, raw=value, record=changed))

    def test_old_base_and_beaver_bonus_keep_all_fields(self):
        for value in [raw([frame('BET')]), raw([frame('BET', 1), frame('FREE_GAME', 0, GSD='CFG~0')])]:
            self.assertEqual(BeaverSequence(PLAN).settled(value), NativeNextgenFields(PLAN).settled(value))

    def test_missing_counters_do_not_end(self):
        for key in ['NFG', 'TFG', 'CFGG']:
            value = sample()
            s = value['steps'][-1]
            s['responsePayload'] = '&'.join(p for p in s['responsePayload'].split('&') if not p.startswith(key+'='))
            with self.assertRaisesRegex(FieldError, 'BEAVER_MISSING_FREE_COUNTER'):
                execute(dict(op='next', plan=PLAN, raw=value))

    def test_mixed_and_unknown_branches_rejected(self):
        for fid in ['10|', '11|', '20|', '21|', '1|0|', '0|1|', '01|']:
            with self.assertRaises(FieldError):
                execute(dict(op='next', plan=PLAN, raw=raw([frame('BET', 6, fid)])))
        for value in [raw([frame('BET', 1), frame('FREE_GAME', 6, '1|')]),
                      raw([frame('BET', 1, '1|'), frame('FREE_GAME', 0, GSD='CFG~0')])]:
            with self.assertRaises(FieldError):
                execute(dict(op='next', plan=PLAN, raw=value))

    def test_amount_xml_and_paid_replay_rejected(self):
        for variant in range(5):
            value = sample()
            if variant == 0: value['startBalanceRaw'] += 1
            if variant == 1: value['steps'][-1] = frame('FREE_GAME', 0, '1|', B=100400, AB=100399, TW=500)
            if variant == 2: value['steps'][-1]['responseXml'] = '<GDMRESPONSE><SUCCESS>false</SUCCESS></GDMRESPONSE>'
            if variant == 3: value['steps'][1] = frame('BET', 6, '1|')
            if variant == 4: value['steps'][1]['requestPayload'] += '&LB=20'
            with self.assertRaises(FieldError):
                BeaverSequence(PLAN).settled(value)


if __name__ == '__main__':
    unittest.main()
