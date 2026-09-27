"""Operator-only pool status/activation; never reachable through the SSH RPC."""
import argparse
import json
from pathlib import Path
from pool_plan import validate_pool_plan
from pool_trial import PoolTrial
from trial_mongo import TrialMongo
from store import require


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('action',choices=['status','enable'])
    args=parser.parse_args()
    plan=json.loads((Path(__file__).resolve().parents[1]/'config/trial-pool.json').read_text())
    if args.action=='status' and plan.get('configured') is not True:
        print(json.dumps({'configured':False,'sourceEnabled':False}));return
    validate_pool_plan(plan)
    mongo=TrialMongo(plan=plan)
    service=PoolTrial('/var/lib/sg-capture-runner',plan,mongo.scoped)
    try:
        if args.action=='enable':
            require(not service.pool.status()['complete'],'POOL_ALREADY_COMPLETE')
            service.pool.enable_by_operator()
        print(json.dumps(service.status()))
    finally:
        service.close();mongo.close()


if __name__=='__main__':main()
