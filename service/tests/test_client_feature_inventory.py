import importlib.util
from pathlib import Path
import tempfile
import unittest

s = importlib.util.spec_from_file_location('inventory', Path(__file__).resolve().parents[2] / 'scripts/client_feature_inventory.py')
m = importlib.util.module_from_spec(s)
s.loader.exec_module(m)


class InventoryTests(unittest.TestCase):
    def test_loader_only_never_becomes_client_evidence(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d)/'nextgen';root.mkdir()
            wms=Path(d)/'wms';p=wms/'missing'/'js';p.mkdir(parents=True)
            (p/'metadatabundle.js').write_text('"BET" "FREE_GAME" "NFG"',encoding='utf-8')
            result=m.inventory({'1':{'runtimeSlug':'missing'}},root,set(),{1},wms)
            row=result['games'][0]
            self.assertEqual(result['filesRead'],0)
            self.assertEqual(row['status'],'loader-only')
            self.assertEqual(row['clients'],[])
            self.assertEqual(row['references'],[])
            self.assertEqual(len(row['loaders']),1)
            self.assertFalse(row['captureAuthorization'])

    def test_wms_fixed_entry_and_slug_variants_are_only_unverified_candidates(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d)/'nextgen';root.mkdir()
            wms=Path(d)/'wms';p=wms/'firequeen_prt'/'app/js';p.mkdir(parents=True)
            (p/'main.js').write_text('"Logic" "EndGame" "FreeSpins"',encoding='utf-8')
            p=wms/'other'/'js';p.mkdir(parents=True)
            (p/'app.js').write_text('"Logic" "EndGame"',encoding='utf-8')
            p=wms/'modern'/'app/js';p.mkdir(parents=True)
            (p/'game.js').write_text('"Logic" "EndGame"',encoding='utf-8')
            p=wms/'named'/'app';p.mkdir(parents=True)
            (p/'named.Game.js').write_text('"Logic" "EndGame"',encoding='utf-8')
            p=root/'christmas'/'js';p.mkdir(parents=True)
            (p/'app.js').write_text('"BET"',encoding='utf-8')
            result=m.inventory({'1':{'runtimeSlug':'fire-queen'},'2':{'runtimeSlug':'christmas94'},
                                '3':{'runtimeSlug':'../../private'},'4':{'runtimeSlug':'unknown'},
                                '5':{'runtimeSlug':'other'},'6':{'runtimeSlug':'modern'},
                                '7':{'runtimeSlug':'named'}},root,set(),set(),wms)
            self.assertEqual(result['filesRead'],5)
            self.assertEqual(result['games'][0]['clients'][0]['rootKind'],'wms')
            self.assertEqual(result['games'][1]['clients'][0]['rootKind'],'nextgen')
            self.assertTrue(all(not r['ready'] and not r['captureAuthorization'] for r in result['games']))
            self.assertFalse(result['games'][0]['identityVerified'])
            self.assertEqual(result['games'][2]['status'],'unmapped')
            self.assertEqual(result['games'][3]['status'],'unmapped')

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
