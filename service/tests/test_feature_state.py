import unittest
from feature_state import parse_feature_history as history, check_feature_wallet as wallet, parse_feature_values as values, review_feature_values as roles
from round_fields import FieldError

class FeatureStateTests(unittest.TestCase):
    def test_display_codes_do_not_imply_another_feature_or_cash_amount(self):
        scope={'size':3,'display_sentinels':(-1,-2,-3,-4,-5),'continuation_sentinels':(-100,)}
        self.assertEqual(roles('-4.00|1.5|0', **scope),
                         {'values':['-4.00','1.5','0'],'requiresFeatureContinuation':False})
        self.assertTrue(roles('-4|-100.00|0', **scope)['requiresFeatureContinuation'])
        for text in ('-6|0|0','-4.1|0|0','-0|0|0'):
            with self.assertRaises(FieldError):roles(text, **scope)
        for options in ({'display_sentinels':[-1],'continuation_sentinels':[-1]},
                        {'display_sentinels':[-1,-1]}, {'display_sentinels':[True]},
                        {'continuation_sentinels':[1]}, {'negative_sentinels':[-1]}):
            with self.assertRaises(FieldError):roles('0', size=1, **options)

    def test_fractional_display_values_keep_exact_lexemes_and_explicit_sentinels(self):
        self.assertEqual(values('0|1.5|3.00', size=3), ['0','1.5','3.00'])
        self.assertEqual(values('0|-100.0', size=2, negative_sentinels=(-100,)), ['0','-100.0'])
        for bad in ('NaN','1e3','01','1.0000001','1000000.000001','-1','-100','1\n','1|2','-0'):
            with self.assertRaises(FieldError): values(bad,size=1)
        with self.assertRaises(FieldError): values('1.5',size=1,decimal_places=0)

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
