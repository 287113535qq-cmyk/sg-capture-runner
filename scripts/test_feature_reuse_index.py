import unittest
from feature_reuse_index import build, recommend

class ReuseIndexTests(unittest.TestCase):
    def test_wms_reuse_keeps_terminal_and_award_differences(self):
        match = recommend(32799)[0]
        self.assertEqual(match['referenceGameId'], 32795)
        self.assertEqual(match['differences']['retriggerAward'], {'target': 5, 'reference': 8})
        self.assertIn('terminal', match['differences'])
        self.assertFalse(match['captureAuthorization'])

    def test_equal_protocol_does_not_merge_wheel_with_independent_free(self):
        match = next(x for x in recommend(32718) if x['referenceGameId'] == 32835)
        self.assertEqual(match['scope'], 'transport-only')
        self.assertIn('terminal', match['differences'])

    def test_inca_reuses_only_independently_reviewed_free_traits(self):
        match=next(x for x in recommend(32719) if x['referenceGameId']==32720)
        self.assertEqual(match['scope'],'family-candidate')
        self.assertFalse(match['captureAuthorization'])
        self.assertTrue(any('synthetic' in x for x in match['requiredReview']))

    def test_unknown_does_not_inherit_generic_ready(self):
        self.assertEqual(recommend(32441), [])
        result = build()
        self.assertEqual(len(result['games']), 178)
        self.assertFalse(result['captureAuthorization'])
        self.assertTrue(all(not x['captureAuthorization'] for x in result['games']))
        self.assertTrue(all(not x['candidates'] for x in result['games'] if x['status'] == 'unclassified'))

if __name__ == '__main__':
    unittest.main()
