import unittest
from feature_reuse_index import build, recommend, recommend_observed

class ReuseIndexTests(unittest.TestCase):
    def test_unknown_can_match_evidenced_traits_without_becoming_ready(self):
        traits={'protocol':'wms-xml','session':'response-rotation','requests':'Logic-EndGame'}
        evidence={key:dict(kind='official-client',sha256='a'*64) for key in traits}
        rows=recommend_observed(dict(traits=traits,evidence=evidence))
        self.assertEqual({r['referenceGameId'] for r in rows},{32795,32799,32812})
        self.assertTrue(all(not r['ready'] and not r['captureAuthorization'] for r in rows))
        self.assertTrue(all('terminal' in r['missingTraits'] for r in rows if r['referenceGameId'] != 32812))
        self.assertIn('counters', next(r for r in rows if r['referenceGameId'] == 32812)['missingTraits'])
        with self.assertRaises(ValueError):recommend_observed(dict(traits=traits,evidence={}))
        with self.assertRaises(ValueError):recommend_observed(dict(traits={**traits,'FID':2},evidence=evidence))
        self.assertEqual(recommend(32441),[])

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

    def test_pyramids_hold_cannot_inherit_inca_free_progression(self):
        match=next(x for x in recommend(32721) if x['referenceGameId']==32719)
        self.assertEqual(match['scope'],'transport-only')
        self.assertIn('counters',match['differences'])
        self.assertIn('terminal',match['differences'])
        self.assertFalse(match['captureAuthorization'])

    def test_veryfruity_partial_review_does_not_inherit_settlement(self):
        match = next(x for x in recommend(32812) if x['referenceGameId'] == 32795)
        self.assertEqual(match['scope'], 'transport-only')
        self.assertIn('terminal', match['differences'])
        self.assertIn('counters', match['differences'])
        self.assertTrue(any('unverified' in text for text in match['requiredReview']))
        self.assertFalse(match['captureAuthorization'])

if __name__ == '__main__':
    unittest.main()
