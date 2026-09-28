"""Generate/check documentation from committed config and reviewed code only."""
import argparse
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'service'))
from game_rule_catalog import ROOT, generated

parser = argparse.ArgumentParser()
parser.add_argument('--check', action='store_true')
args = parser.parse_args()
destination = ROOT / 'docs/game-rules'
expected = generated()
if args.check:
    assert destination.is_dir() and {p.name for p in destination.iterdir()} == set(expected), 'RULE_ARCHIVE_FILE_SET_CHANGED'
    assert all((destination / name).read_text(encoding='utf-8') == content for name, content in expected.items()), 'RULE_ARCHIVE_STALE'
else:
    destination.mkdir(exist_ok=True)
    for name, content in expected.items():
        (destination / name).write_text(content, encoding='utf-8', newline='\n')
print(f'Rule cards: {len(expected)-1}; source requests: 0; database reads: 0; runtime changes: 0')
