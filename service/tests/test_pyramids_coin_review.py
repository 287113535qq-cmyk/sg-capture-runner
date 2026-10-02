import copy
import unittest
from test_pyramids_free_review import PLAN, rewrite
from test_pyramids_retrigger_review import retrigger_sample
from pyramids_coin_review import PyramidsCoinSequence
from pyramids_retrigger_review import PyramidsRetriggerSequence
from pyramids_major_review import PyramidsMajorSequence
from round_fields import FieldError
from round_fields import type_profile
from pyramids_coin_review import EXTENSION
from pyramids_fields import PyramidsFields


def coin_sample(symbol=-4):
    value = retrigger_sample()
    for index, step in enumerate(value['steps']):
        rewrite(step, GSD='BGRS~1;2;3;4;5;' + (f'#CL~0;0;{symbol};|' if index else ''))
    return value


class CoinReviewTests(unittest.TestCase):
    def test_known_signed_symbols_retain_original_xml_and_cash_contract(self):
        adapter = PyramidsCoinSequence(PLAN)
        for symbol in (-4, -3, -2):
            value = coin_sample(symbol)
            before = copy.deepcopy(value)
            result = adapter.review(value)
            self.assertTrue(result['complete'])
            self.assertEqual(result['settlement']['betRaw'], 20)
            self.assertFalse(result['captureAuthorization'])
            self.assertFalse(result['naturalCoinTerminalObserved'])
            self.assertEqual(value, before)
            mapped = PyramidsFields(PLAN).settled(value)
            self.assertEqual(mapped['bonus'], 9)
            self.assertEqual(mapped['typeMappingHash'], type_profile(EXTENSION)[1])
            for length in (1, 3, 15, 20):
                prefix = {**value, 'steps': value['steps'][:length]}
                self.assertEqual(adapter.sequence(prefix), {'MSGID':'FREE_GAME'})
                with self.assertRaises(FieldError): adapter.settled(prefix)

    def test_old_scopes_are_not_expanded(self):
        for symbol in (-4, -3, -2):
            with self.assertRaisesRegex(FieldError, 'UNREVIEWED_COIN'):
                PyramidsRetriggerSequence(PLAN).sequence(coin_sample(symbol))
        from test_pyramids_major_review import major_sample
        self.assertIsNone(PyramidsMajorSequence(PLAN).sequence(major_sample()))
        value = major_sample()
        rewrite(value['steps'][1], GSD='CL~0;0;-4;|')
        with self.assertRaisesRegex(FieldError, 'UNREVIEWED_COIN'):
            PyramidsMajorSequence(PLAN).sequence(value)

    def test_geometry_unknown_symbols_and_base_negative_coins_remain_faults(self):
        for gsd in ['CL~3;0;-4;|','CL~0;5;-4;|','CL~0;0;-4;|0;0;20;|',
                    'CL~0;0;-4;|3;0;-2;|','CL~0;0;-1;|','CL~0;0;-5;|',
                    'BGCL~0;0;-4;|','CL~0;0;-4;|#CLBN~0;0;20;|']:
            value = coin_sample();rewrite(value['steps'][1], GSD=gsd)
            with self.assertRaises(FieldError): PyramidsCoinSequence(PLAN).review(value)
        value = coin_sample();rewrite(value['steps'][0], GSD='CL~0;0;-4;|')
        with self.assertRaises(FieldError): PyramidsCoinSequence(PLAN).review(value)

    def test_wallet_progress_and_mixed_or_forced_exits_still_rejected(self):
        for index, changes in [(1, {'B':99999}), (1, {'AB':99999}), (1, {'TW':1}),
                (20, {'AB':99900}), (1, {'FID':'0|1|'}), (1, {'GCT':1}),
                (2, {'NFG':19}), (2, {'GSD':'SFGT~1#CL~0;0;-4;|'})]:
            value = coin_sample();rewrite(value['steps'][index], **changes)
            with self.assertRaises(FieldError): PyramidsCoinSequence(PLAN).review(value)

    def test_pending_account_balance_uses_ab_not_uncredited_tw(self):
        value = coin_sample()
        for index, step in enumerate(value['steps']):
            terminal = index == len(value['steps']) - 1
            rewrite(step, TW=20 if index else 0, B=100000 if index else 99980,
                    AB=100000 if terminal else 99980)
            step['responseBalance'] = 100000 if terminal else 99980
        self.assertTrue(PyramidsCoinSequence(PLAN).review(value)['complete'])
        value['steps'][1]['responseBalance'] = 100000
        with self.assertRaisesRegex(FieldError, 'COIN_RESPONSE_BALANCE'):
            PyramidsCoinSequence(PLAN).review(value)
