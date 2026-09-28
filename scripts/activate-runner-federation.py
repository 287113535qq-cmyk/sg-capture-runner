"""Operator CLI: review first; apply only the exact reviewed paused state."""
import argparse
import json
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'service'))
from federation_migration import activate
from store import Rejected

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--root',required=True)
parser.add_argument('--backup-dir',required=True)
parser.add_argument('--expected-hash')
parser.add_argument('--apply',action='store_true')
args=parser.parse_args()
try:
    result=activate(args.root,args.backup_dir,args.expected_hash,args.apply)
    print(json.dumps(result))
except Rejected as exc:
    print(json.dumps({'ok':False,'error':str(exc)}));sys.exit(2)
