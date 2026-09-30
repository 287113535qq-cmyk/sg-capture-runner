import importlib.util
from pathlib import Path
import tempfile
import unittest

s = importlib.util.spec_from_file_location('inventory', Path(__file__).resolve().parents[2] / 'scripts/client_feature_inventory.py')
m = importlib.util.module_from_spec(s)
s.loader.exec_module(m)


class InventoryTests(unittest.TestCase):
    def test_game_entry_and_multiple_entries_remain_candidates_without_automatic_identity(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            for entry in ('app.js', 'game.js'):
                p = root/'both'/'js';p.mkdir(parents=True, exist_ok=True)
                (p/entry).write_text('"BET" "FREE_GAME" "NFG"', encoding='utf-8')
            p = root/'old'/'js';p.mkdir(parents=True)
            (p/'game.js').write_text('"BET" "FREE_GAME" "NFG"', encoding='utf-8')
            p = root/'bundle';p.mkdir()
            (p/'game.bundle.js').write_text('"Logic" "EndGame"', encoding='utf-8')
            result = m.inventory({'1': {'runtimeSlug': 'old95'}, '2': {'runtimeSlug': 'both'},
                                  '3': {'runtimeSlug': 'bundle'}}, root, set(), {1})
            self.assertEqual(result['filesRead'], 4)
            self.assertEqual(result['games'][0]['clients'][0]['entryPoint'], 'game.js')
            self.assertEqual(len(result['games'][1]['clients']), 2)
            self.assertEqual(result['games'][1]['references'], [])
            self.assertEqual(result['games'][2]['clients'][0]['entryPoint'], 'game.bundle.js')
            self.assertTrue(all(not r['identityVerified'] and not r['ready'] for r in result['games']))

    def test_lexical_overlap_is_not_semantic_proof_and_completed_clients_are_not_read(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            for name in ('one', 'two'):
                p = root/name/'js';p.mkdir(parents=True)
                (p/'app.js').write_text('"MSGID" "BET" "FREE_GAME" "NFG" "PRIVATE_SECRET"', encoding='utf-8')
            p = root/'done'/'js';p.mkdir(parents=True)
            (p/'app.js').write_bytes(b'\xff')  # Would fail UTF8 if completion exclusion regressed.
            plans = {'1': {'runtimeSlug': 'one96'}, '2': {'runtimeSlug': 'two'}, '3': {'runtimeSlug': 'done'},
                     '4': {'runtimeSlug': '../../escape'}}
            result = m.inventory(plans, root, {3}, {2})
            self.assertEqual(result['filesRead'], 2)
            row = result['games'][0]
            self.assertEqual(row['references'][0]['gameId'], 2)
            self.assertFalse(row['identityVerified'])
            self.assertEqual(row['semanticTraits'], {})
            self.assertNotIn('PRIVATE_SECRET', str(result))
            self.assertTrue(all(not r['captureAuthorization'] and not r['ready'] for r in result['games']))
            self.assertEqual(result['games'][-1]['status'], 'unmapped')

    def test_identifiers_do_not_match_substrings_and_offsets_are_bounded(self):
        f = m.fingerprint(('unknownNFG "NFG" ' * 10000).encode())
        self.assertEqual(len(f['tokenOffsets']['NFG']), 4)
        self.assertEqual(f['tokenOffsets']['NFG'][0], 12)
