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

    def test_dragon_end_v3_documents_only_own_end_request_boundary(self):
        card=self.cards[32497];rule=card['roundRule']
        self.assertFalse(card['captureAuthorization']);self.assertEqual(rule['family'],'nextgen-dragon-end-evidence-v3')
        self.assertEqual(card['runtimeGameId'],33032)
        for value in ('88份','257条','81条','99份','未在线应用','mandatory wiringEvidence'):
            self.assertIn(value,rule['bounds'])
        self.assertIn('CFP_0',rule['continue']);self.assertIn('首END',rule['complete'])

    def test_carnival_v3_keeps_own_first_second_shape_and_no_special_settlement(self):
        card=self.cards[32474];rule=card['roundRule']
        self.assertFalse(card['captureAuthorization']);self.assertEqual(rule['family'],'nextgen-carnival-pick-evidence-v3')
        self.assertEqual(card['runtimeGameId'],33027)
        for value in ('77份','244条','1065条','100份','未在线应用','mandatory wiringEvidence'):
            self.assertIn(value,rule['bounds'])
        self.assertIn('13份',rule['continue']);self.assertIn('第三PICK',rule['complete'])

    def test_arthur_ordinary_card_preserves_own_special_boundaries(self):
        card=self.cards[32754];rule=card['roundRule']
        self.assertEqual(rule['family'],'wms-arthur-free-wild-evidence-v2')
        self.assertEqual(card['runtimeGameId'],32976)
        self.assertEqual(card['parameters']['wmsGameId'],20467)
        self.assertFalse(card['captureAuthorization'])
        for text in ('986','1972','14自身','6免费','3Excalibur','5Wild','extra3/5','真实Init'):
            self.assertIn(text,rule['bounds'])

    def test_arthur_feature_card_requires_actual_own_wiring_and_keeps_ordinary_limits(self):
        card=self.cards[32754];rule=card['roundRule']
        self.assertFalse(card['captureAuthorization']);self.assertEqual(card['parameters']['maxSteps'],22)
        for value in ('997完整/2069','97自身','mandatory wiringEvidence','未在线应用','不抵300000','最多10线'):
            self.assertIn(value,rule['bounds'])
        self.assertIn('奖值已含倍率',rule['fields']['Token / FSInfo'])
        self.assertEqual(card['configuredNaturalBonusCodes'],[1])

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
        rolling=json.loads((ROOT/'config/ag-rolling-plans.json').read_text(encoding='utf-8'))['plans']
        if rolling.get('32595',{}).get('automaticTerminalContract')=='nextgen-moneyraid-terminal-evidence-v2':
            plans['32595']=rolling['32595']
        if rolling.get('32474',{}).get('carnivalPickContract')=='nextgen-carnival-pick-evidence-v3':
            plans['32474']=rolling['32474']
        if rolling.get('32497',{}).get('dragonEndContract')=='nextgen-dragon-end-evidence-v3':
            plans['32497']=rolling['32497']
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

    def test_moneyraid_documents_own_terminal_counts_old_marker_boundary_and_no_authorization(self):
        card=self.cards[32595];rule=card['roundRule']
        self.assertFalse(card['captureAuthorization']);self.assertEqual(card['runtimeGameId'],33066)
        self.assertEqual(rule['family'],'nextgen-moneyraid-terminal-evidence-v2')
        self.assertEqual(rule['messages'],['BET','FREE_GAME'])
        for value in ['104份','872条','旧v1 marker','不回计','未在线应用']:self.assertIn(value,rule['bounds'])
        self.assertIn('FID2初始7次',rule['continue']);self.assertIn('FID3初始9/10/11/12次',rule['continue'])
        self.assertNotIn('FEATURE_PICK',rule['messages'])
        self.assertNotEqual((self.cards[32550]['roundRule'] or {}).get('family'),rule['family'])

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

    def test_five_treasures_documents_identity_and_limited_actual_canaries_without_authorizing_capture(self):
        card=self.cards[32749]
        self.assertFalse(card['captureAuthorization'])
        self.assertEqual(card['runtimeGameId'],32971)
        self.assertEqual(card['parameters']['wmsGameId'],20442)
        self.assertEqual(card['roundRule']['family'],'five-treasures-wms-v1')
        self.assertIn('FreeSpinChoice',card['roundRule']['messages'])
        self.assertIn('CASH_BALANCE',card['settlement']['stakeRaw'])
        self.assertIn('两次真实canary各10局',card['roundRule']['bounds'])
        self.assertIn('不代表整款完成',card['roundRule']['bounds'])
        self.assertNotIn('B=AB',card['settlement']['required'])

    def test_eighty_fortunes_documents_deferred_cash_and_limited_terminal_proof(self):
        card=self.cards[32750]
        self.assertFalse(card['captureAuthorization'])
        self.assertFalse(card['allSpecialStageTypesCovered'])
        self.assertEqual(card['runtimeGameId'],32972)
        self.assertEqual(card['parameters']['wmsGameId'],20077)
        self.assertEqual(card['roundRule']['family'],'eighty-fortunes-wms-v1')
        self.assertIn('首个免费续帧才兑现一次',card['roundRule']['continue'])
        self.assertIn('trigger1760终局拒绝',card['settlement']['required'])
        self.assertIn('4份旧免费半局仍拒绝',card['roundRule']['bounds'])
        self.assertIn('无native scope或真实Init/canary',card['roundRule']['bounds'])

    def test_celestial_ordinary_card_keeps_hns_early_end_and_own_total_stake_boundary(self):
        card=self.cards[32756];rule=card['roundRule']
        self.assertEqual(rule['family'],'celestial-base-wms-v1')
        self.assertEqual(card['runtimeGameId'],32978)
        self.assertEqual(card['parameters']['wmsGameId'],20210)
        self.assertIn('994',rule['bounds']);self.assertIn('剩余3次',rule['bounds'])
        self.assertIn('不能改成90',rule['start']);self.assertIn('没有readyForEndGame',rule['continue'])
        self.assertEqual(card['typeMappings']['celestialking-base-ag-rolling-wms-v1']['freeTypes'],{})

    def test_blazing_card_has_own_ten_free_and_distinct_actual_wager(self):
        card=self.cards[32755]
        self.assertEqual(card['roundRule']['family'],'blazing-x-wms-v1')
        self.assertEqual(card['runtimeGameId'],32977)
        self.assertEqual(card['parameters']['wmsGameId'],20363)
        self.assertIn('997普通+3完整免费',card['roundRule']['bounds'])
        self.assertIn('真实Init',card['roundRule']['bounds'])
        self.assertIn('实际240',card['settlement']['required'])

    def test_actionbank_card_distinguishes_partial_free_from_ordinary_evidence(self):
        card=self.cards[32753]
        self.assertEqual(card['roundRule']['family'],'actionbank-base-wms-v1')
        self.assertEqual(card['runtimeGameId'],32975)
        self.assertFalse(card['captureAuthorization'])
        self.assertFalse(card['allSpecialStageTypesCovered'])
        self.assertEqual(card['parameters']['wmsGameId'],20369)
        self.assertIn('989',card['roundRule']['bounds'])
        self.assertIn('11旧免费半局',card['roundRule']['bounds'])
        self.assertIn('真实Init',card['roundRule']['bounds'])

    def test_acorn_ordinary_only_document_does_not_claim_unknown_feature_coverage(self):
        card=self.cards[32752]
        self.assertFalse(card['captureAuthorization'])
        self.assertFalse(card['allSpecialStageTypesCovered'])
        self.assertEqual(card['runtimeGameId'],32974)
        self.assertEqual(card['parameters']['wmsGameId'],20174)
        self.assertEqual(card['roundRule']['messages'],['Init','Logic','EndGame'])
        self.assertIn('目前仅普通单Logic',card['roundRule']['continue'])
        self.assertIn('无native scope或真实Init/canary',card['roundRule']['bounds'])
        self.assertIn('特殊形状拒绝',card['settlement']['required'])

    def test_fortunes_megaways_adapter_is_documented_as_a_distinct_offline_wms_candidate(self):
        card=self.cards[32751]
        self.assertFalse(card['captureAuthorization'])
        self.assertFalse(card['allSpecialStageTypesCovered'])
        self.assertEqual(card['runtimeGameId'],32973)
        self.assertEqual(card['parameters']['wmsGameId'],20371)
        self.assertEqual(card['roundRule']['family'],'fortunes-megaways-wms-v1')
        self.assertIn('级联奖只计入对应Logic',card['settlement']['required'])
        self.assertIn('尚无native scope',card['roundRule']['bounds'])


if __name__ == '__main__':
    unittest.main()
