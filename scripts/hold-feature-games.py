"""Operator-only reviewed hold. Default is a read-only dry run; never sends SG requests."""
import argparse
import hashlib
import json
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'service'))
from campaign import Campaign
from campaign_review import hold_unstarted
from store import require


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--root',type=Path,required=True)
    parser.add_argument('--evidence',type=Path,required=True)
    parser.add_argument('--apply',action='store_true')
    args=parser.parse_args()
    evidence=json.loads(args.evidence.read_text(encoding='utf-8'))
    coverage=ROOT/'docs/native-coverage-review-20260927.json'
    require(hashlib.sha256(coverage.read_bytes()).hexdigest()==evidence['coverageReportSHA256'], 'HOLD_COVERAGE_CHANGED')
    findings=json.loads(coverage.read_text(encoding='utf-8'))
    require(set(evidence['gameIds'])<=set(findings['gamesNeedingReview']), 'HOLD_UNSUPPORTED_EVIDENCE')
    campaign=Campaign(args.root)
    try:
        result=hold_unstarted(campaign,evidence,args.apply)
        print(json.dumps({**result,'campaign':campaign.status()},ensure_ascii=False))
    finally:campaign.close()

if __name__=='__main__':main()
