#!/usr/bin/env python3
"""Operator CLI only. The RPC does not expose this transition or enabling."""
import argparse
import json
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'service'))
from group_migration import activate

parser=argparse.ArgumentParser()
parser.add_argument('--root',required=True)
parser.add_argument('--backup',required=True)
parser.add_argument('--proof-hash')
parser.add_argument('--apply',action='store_true')
args=parser.parse_args()
print(json.dumps(activate(args.root,args.backup,args.proof_hash,args.apply)))
