import unittest
from feature_state import parse_feature_history as history, check_feature_wallet as wallet
from round_fields import FieldError

class FeatureStateTests(unittest.TestCase):
    def test_ordered_repeats_and_explicit_scope(self):
        self.assertEqual(history('1|1|2|1|', {1,2}), [1,1,2,1])
        self.assertEqual(history('', {1}, allow_empty=True), [])
        for bad in ('', '1||', '01|', '1|3', '1|'*101):
            with self.assertRaises(FieldError): history(bad, {1,2})

    def test_accrued_win_does_not_require_early_wallet_credit(self):
        self.assertEqual(wallet(144400,500,147900,143900,4000,settled=False,
                                response_balance=143900), {'uncreditedWin':4000})
        self.assertEqual(wallet(144400,500,147900,147900,4000,settled=False),
                         {'uncreditedWin':0})

    def test_settlement_requires_full_credit(self):
        self.assertEqual(wallet(144400,500,147900,147900,4000,settled=True,
                                response_balance=147900), {'uncreditedWin':0})
        with self.assertRaises(FieldError): wallet(144400,500,147900,143900,4000,settled=True)

    def test_bad_money_or_missing_settlement_contract_rejected(self):
        for args, options in (
            ((144400,500,147901,143900,4000), {'settled':False}),
            ((144400,500,147900,144000,4000), {'settled':False}),
            ((144400,500,147900,143900,4000), {'settled':False,'response_balance':147900}),
            ((144400,500,147900,143900,4000), {'settled':None}),
            ((144400,500,147900,143900,True), {'settled':False}),
        ):
            with self.assertRaises(FieldError): wallet(*args, **options)
