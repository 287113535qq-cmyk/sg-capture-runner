#!/usr/bin/env python3
"""Forced-command entrypoint. stdin is one bounded JSON request; no shell commands."""
import json
import os
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from store import Store, Rejected, InjectedCrash
from mongo_bridge import MongoBridge

def main():
    if os.environ.get('SSH_ORIGINAL_COMMAND', ''):
        raise Rejected('SHELL_COMMAND_FORBIDDEN')
    content = sys.stdin.buffer.readline(1048577)
    if len(content) > 1048576:
        raise Rejected('REQUEST_TOO_LARGE')
    request = json.loads(content)
    if request.get('schema') not in {'sg-real-trial-v1','sg-work-pool-v1','sg-round-one-v1'}:
        result = Store('/var/lib/sg-capture-runner', MongoBridge()).dispatch(request)
        print(json.dumps(result, separators=(',', ':')))
        return
    from trial_store import TrialStore
    from trial_mongo import TrialMongo
    from trial_parallel import ParallelTrial
    root='/var/lib/sg-capture-runner'
    from trial_store import TRIAL
    shared_mongo=None
    if request.get('schema') == 'sg-round-one-v1':
        from campaign import Campaign
        service=Campaign(root)
    elif request.get('schema') == 'sg-work-pool-v1':
        from pool_trial import PoolTrial
        from pool_audit import parallel_audit
        from pool_plan import validate_pool_plan
        config=Path(__file__).resolve().parents[1]/'config'
        if str(request.get('trialId','')).startswith('sg_r1_'):
            plans=json.loads((config/'round-one-plans.json').read_text(encoding='utf-8'))
            matches=[p for p in plans.values() if p['trialId']==request['trialId']]
            if len(matches)!=1:raise Rejected('CAMPAIGN_PLAN_MISMATCH')
            plan=validate_pool_plan(matches[0])
        else:plan=validate_pool_plan(json.loads((config/'trial-pool.json').read_text()))
        shared_mongo=TrialMongo(plan=plan)
        service=PoolTrial(root,plan,shared_mongo.scoped,audit_executor=parallel_audit)
    elif (Path(root)/'trials'/TRIAL/'parallel.json').exists():
        service=ParallelTrial(root,lambda scope:TrialMongo(sequence_range=scope))
    else:
        service=TrialStore(root,TrialMongo())
    try:
        while True:
            try:
                result = service.dispatch(request)
            except Rejected as exc:
                result = {'ok':False,'error':str(exc),'fixtureOnly':False}
            except BaseException:
                result = {'ok':False,'error':'TRIAL_INTERNAL_FAILURE','fixtureOnly':False}
            print(json.dumps(result,separators=(',', ':')), flush=True)
            content = sys.stdin.buffer.readline(1048577)
            if not content:
                break
            if len(content)>1048576:
                raise Rejected('REQUEST_TOO_LARGE')
            request=json.loads(content)
    finally:
        service.close()
        if shared_mongo:shared_mongo.close()

if __name__ == '__main__':
    try:
        main()
    except InjectedCrash:
        os._exit(91)  # Real process termination after a requested fixture-only crash point.
    except Rejected as exc:
        print(json.dumps({'ok':False,'error':str(exc),'fixtureOnly':True}))
        sys.exit(2)
    except BaseException:
        print(json.dumps({'ok':False,'error':'INTERNAL_FAILURE','fixtureOnly':True}))
        sys.exit(3)
