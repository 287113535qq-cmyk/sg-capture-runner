"""Continuation evidence is independent of ancillary game normalization."""
import copy
import unittest
from test_pyramids_free_review import PLAN, frame, raw, rewrite, sample
from pyramids_flow_review import review_pyramids_flow
from pyramids_free_review import PyramidsFreeSequence
from round_fields import FieldError
from record_fields import execute


def flow_sample():
    value = sample()
    for step in value['steps']:
        step['methodName'] = 'processGameMessage'
    return value


def mixed_prefix():
    steps = [frame('BET', 10), frame('FREE_GAME', 6, 6, 0, '0|1|'),
             frame('FREE_GAME', 7, 8, 1, '0|1|')]
    for step in steps:
        step['methodName'] = 'processGameMessage'
    rewrite(steps[1], GSD='FGRS~9#FGTS~10#CFGC~1#HNSID~7')
    rewrite(steps[2], GSD='FGRS~9#FGTS~10#CFGC~1#HNSID~7#FGTHNS~1')
    return raw(steps)


class PyramidsFlowTests(unittest.TestCase):
    def test_large_awards_keep_known_route_but_do_not_relax_progress(self):
        value = flow_sample()
        value['steps'] = value['steps'][:2]
        rewrite(value['steps'][0], NFG=100, TFG=100, CFGG=0)
        rewrite(value['steps'][1], NFG=101, TFG=102, CFGG=1)
        self.assertEqual(review_pyramids_flow(PLAN, value)['next'], {'MSGID': 'FREE_GAME'})
        self.assertFalse(review_pyramids_flow(PLAN, value)['terminalCandidate'])
        rewrite(value['steps'][1], NFG=100, TFG=102, CFGG=2)
        with self.assertRaisesRegex(FieldError, 'FLOW_PROGRESS'):
            review_pyramids_flow(PLAN, value)

    def test_ordinary_response_omits_feature_state_but_free_cannot(self):
        value = flow_sample()
        value['steps'] = value['steps'][:1]
        rewrite(value['steps'][0], FID=None, NFG=None, TFG=None, CFGG=None)
        result = review_pyramids_flow(PLAN, value)
        self.assertTrue(result['terminalCandidate'])
        self.assertFalse(result['complete'])
        bad = flow_sample()
        rewrite(bad['steps'][1], FID=None, NFG=None, TFG=None, CFGG=None)
        with self.assertRaisesRegex(FieldError, 'FLOW_MISSING_CONTINUATION_STATE'):
            review_pyramids_flow(PLAN, bad)

    def test_runner_diagnostic_does_not_replace_strict_record_channel(self):
        value = flow_sample()
        rewrite(value['steps'][1], GSD='UNKNOWNDISPLAY~anything')
        result = execute({'op':'review_flow', 'plan':PLAN,
                          'raw':{**value, 'steps':value['steps'][:2]}})
        self.assertEqual(result['next'], {'MSGID':'FREE_GAME'})
        self.assertFalse(result['captureAuthorized'])
        with self.assertRaises(FieldError):
            execute({'op':'next', 'plan':PLAN,
                     'raw':{**value, 'steps':value['steps'][:2]}})

    def test_uninterpreted_ancillary_fields_do_not_block_known_free_route(self):
        value = mixed_prefix()
        original = copy.deepcopy(value)
        for size in range(1, 4):
            result = review_pyramids_flow(PLAN, {**value, 'steps': value['steps'][:size]})
            self.assertEqual(result['next'], {'MSGID': 'FREE_GAME'})
            self.assertFalse(result['complete'])
            self.assertTrue(result['normalizationRequired'])
            self.assertFalse(result['captureAuthorized'])
        self.assertEqual(value, original)

    def test_terminal_is_only_a_candidate_and_strict_parser_is_independent(self):
        value = flow_sample()
        rewrite(value['steps'][1], GSD='UNKNOWNDISPLAY~anything')
        self.assertEqual(review_pyramids_flow(PLAN, {**value, 'steps': value['steps'][:2]})['next'],
                         {'MSGID': 'FREE_GAME'})
        with self.assertRaises(FieldError):
            PyramidsFreeSequence(PLAN).settled(value)
        result = review_pyramids_flow(PLAN, value)
        self.assertIsNone(result['next'])
        self.assertTrue(result['terminalCandidate'])
        self.assertFalse(result['complete'])
        self.assertFalse(result['captureAuthorized'])

    def test_outer_free_survives_inner_hold_terminal(self):
        value = mixed_prefix()
        for n in range(6, -1, -1):
            step = frame('FREE_GAME', n, 8, 8-n, '0|1|')
            step['methodName'] = 'processGameMessage'
            rewrite(step, GSD='FGRS~9#FGTS~10#CFGC~1')
            value['steps'].append(step)
        self.assertEqual(review_pyramids_flow(PLAN, value)['next'], {'MSGID': 'FREE_GAME'})
        step = frame('FREE_GAME', 8, 10, 2)
        step['methodName'] = 'processGameMessage'
        value['steps'].append(step)
        self.assertEqual(review_pyramids_flow(PLAN, value)['next'], {'MSGID': 'FREE_GAME'})

    def test_faults_in_actual_flow_evidence_still_reject(self):
        for changes in ({'FID':'1||'}, {'FID':'2|'}, {'NFG':8}, {'CFGG':0},
                        {'GCT':1}, {'FRBAL':1}, {'B':99990}, {'TW':20},
                        {'GSD':'ONE~1#ONE~2'}, {'GSD':'FGTHNS~1~2'}):
            value = flow_sample()
            rewrite(value['steps'][1], **changes)
            with self.subTest(changes=changes), self.assertRaises(FieldError):
                review_pyramids_flow(PLAN, value)
        for kind in ('xml', 'session', 'method', 'missing', 'after_terminal'):
            value = flow_sample()
            if kind == 'xml': value['steps'][1]['responseXml'] = value['steps'][0]['responseXml']
            if kind == 'session': value['steps'][1]['requestPayload'] = value['steps'][1]['requestPayload'].replace('offline-pyramids-free', 'different')
            if kind == 'method': value['steps'][1]['methodName'] = 'other'
            if kind == 'missing': value['steps'].pop(1)
            if kind == 'after_terminal': value['steps'].append(copy.deepcopy(value['steps'][-1]))
            with self.subTest(kind=kind), self.assertRaises(FieldError):
                review_pyramids_flow(PLAN, value)

    def test_inner_and_outer_counters_are_not_interchangeable(self):
        for gsd in ('FGRS~8#FGTS~10#CFGC~1', 'FGRS~8#FGTS~10#CFGC~2', 'HNSID~7'):
            value = mixed_prefix()
            rewrite(value['steps'][-1], GSD=gsd)
            with self.subTest(gsd=gsd), self.assertRaises(FieldError):
                review_pyramids_flow(PLAN, value)


if __name__ == '__main__':
    unittest.main()
