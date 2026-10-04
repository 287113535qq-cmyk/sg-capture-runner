import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'service'))
from game_rule_catalog import cards, generated, GAME_ID_PATTERN
from round_fields import type_profile
from store import digest


class GameRuleCatalogTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.cards = cards()

    def test_all_games_have_honest_unknown_coverage_and_no_capture_permission(self):
        games = json.loads((ROOT / 'config/games.json').read_text(encoding='utf-8'))
        self.assertEqual(set(self.cards), {g['gameId'] for g in games})
        self.assertEqual(len(self.cards), 178)
        for card in self.cards.values():
            self.assertFalse(card['captureAuthorization'])
            self.assertIsNone(card['allSpecialStageTypesTotal'])
            self.assertFalse(card['allSpecialStageTypesCovered'])
            self.assertIsNone(card['observations']['actualSpecialStageCount'])
            self.assertEqual(card['ruleHash'], digest({k: v for k, v in card.items() if k != 'ruleHash'}))

    def test_actual_plan_and_mapping_hashes_match_runtime(self):
        plans = json.loads((ROOT / 'config/round-one-plans.json').read_text(encoding='utf-8'))
        for gid, plan in plans.items():
            card = self.cards[int(gid)]
            self.assertEqual(card['planHash'], digest(plan))
            for source, mapping_hash in card['mappingHashes'].items():
                self.assertEqual(mapping_hash, type_profile(source)[1])

    def test_game_specific_rules_are_not_transferred_between_equal_fid_numbers(self):
        squid, huff, goals = (self.cards[x] for x in (32651, 32714, 32717))
        self.assertIn('FEATURE_PICK', squid['roundRule']['messages'])
        self.assertNotIn('FEATURE_PICK', huff['roundRule']['messages'])
        self.assertIn('HARDHAT', huff['roundRule']['bounds'])
        self.assertNotIn('HARDHAT', goals['roundRule']['bounds'])
        self.assertIn('docs/huff-goals-client-review-20260928.md', goals['analysisDocuments'])
        self.assertEqual(self.cards[32471]['roundRule']['family'], 'book-of-sevens-native-v1')

    def test_unsupported_games_remain_undocumented_and_prior_analyses_are_linked(self):
        unsupported = [c for c in self.cards.values() if c['roundRule'] is None]
        self.assertTrue(unsupported)
        for card in unsupported:
            self.assertEqual(card['ruleAvailability'], 'not-documented')
            self.assertIsNone(card['configuredOutcomeCategoryCount'])
        for card in self.cards.values():
            self.assertTrue(all((ROOT / p).is_file() for p in card['analysisDocuments']))

    def test_generation_is_deterministic_and_contains_no_private_payload_fields(self):
        first, second = generated(), generated()
        self.assertEqual(first, second)
        self.assertEqual(len(first), 179)
        for gid in self.cards:
            text = first[f'{gid}.json']
            for private in ('"requestPayload"', '"responsePayload"', '"responseXml"', '"sessionHash"', '"password"'):
                self.assertNotIn(private, text)

    def test_game_ids_inside_hashes_are_not_misidentified_as_analysis_references(self):
        text = '游戏32714 "32717": sg_r1_20260928_32714 f7a518927e0c13343bc30c034d7613167dd1b98801150aeb162ffb32636be509'
        self.assertEqual(set(GAME_ID_PATTERN.findall(text)), {'32714', '32717'})

    def test_veryfruity_documents_action_flow_instead_of_nextgen_feature_fields(self):
        rule = self.cards[32812]['roundRule']
        self.assertEqual(rule['messages'], ['Init', 'Logic', 'EndGame'])
        self.assertEqual(rule['family'], 'veryfruity-wms-action-v1')
        self.assertIn('classification pending', rule['complete'])
        self.assertIn('service/veryfruity_action_fields.py', rule['files'])

    def test_five_treasures_offline_candidate_documents_its_actual_wms_identity_and_settlement(self):
        card=self.cards[32749]
        self.assertFalse(card['captureAuthorization'])
        self.assertEqual(card['runtimeGameId'],32971)
        self.assertEqual(card['parameters']['wmsGameId'],20442)
        self.assertEqual(card['roundRule']['family'],'five-treasures-wms-v1')
        self.assertIn('FreeSpinChoice',card['roundRule']['messages'])
        self.assertIn('CASH_BALANCE',card['settlement']['stakeRaw'])
        self.assertIn('离线候选',card['roundRule']['bounds'])
        self.assertNotIn('B=AB',card['settlement']['required'])


if __name__ == '__main__':
    unittest.main()
