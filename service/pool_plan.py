"""Trusted, operator-configured scope for the next Book of Sevens capture."""
import os
import re
import json
from pathlib import Path
from store import require, digest

POOL_SCHEMA = 'sg-work-pool-v1'


def validate_pool_plan(plan):
    require(isinstance(plan, dict) and plan.get('configured') is True, 'POOL_NOT_CONFIGURED')
    require(plan.get('schema') == POOL_SCHEMA, 'BAD_POOL_SCHEMA')
    if plan.get('campaignId'):
        plans=json.loads((Path(__file__).resolve().parents[1]/'config/round-one-plans.json').read_text(encoding='utf-8'))
        expected=plans.get(str(plan.get('gameId')))
        if 'countAllocation' in plan:
            require('demoGeneration' not in plan and plan.get('gameId') == 32795, 'FORMAL_COUNT_SCOPE')
            filename=os.environ.get('SG_FORMAL_COUNT_PROFILE')
            require(filename == 'formal-count-pearl-20260930.json', 'FORMAL_COUNT_PROFILE_PATH')
            profile=json.loads((Path(__file__).resolve().parents[1]/'config'/filename).read_text(encoding='utf-8'))
            require(profile.get('schema') == 'sg-formal-count-profile-v1' and profile.get('gameId') == 32795
                and profile.get('basePlanHash') == digest(expected) and profile.get('activation') == plan['countAllocation']
                and isinstance(plan['countAllocation'],str) and re.fullmatch(r'[a-f0-9]{64}',plan['countAllocation'])
                and profile.get('completePreserved') == 100 and profile.get('remainingComplete') == 299900
                and profile.get('maxSequence') == 600000 and profile.get('sessionRotation') == 'closed-batches-v1'
                and profile.get('planHash') == digest(plan), 'FORMAL_COUNT_PLAN_CHANGED')
            expected={**expected,'countAllocation':profile['activation']}
        if 'demoGeneration' in plan:
            filename=os.environ.get('SG_DEMO_PILOT_PROFILE','demo-pilot-beaver-20260930.json')
            require(filename in ('demo-pilot-pearl-20260930.json','demo-pilot-piggies-20260930.json','demo-pilot-mansion-20260930.json','demo-pilot-morepuff-20260930.json','demo-pilot-jinzita-20260930.json','demo-pilot-luxor-20260930.json','demo-pilot-beaver-20260930.json','demo-pilot-replacement-20260930.json','demo-residual-beaver-20260930.json'),'DEMO_PROFILE_PATH')
            profile=json.loads((Path(__file__).resolve().parents[1]/'config'/filename).read_text(encoding='utf-8'))
            next_scope = {'demo-pilot-pearl-20260930.json': (32795, 32636), 'demo-pilot-piggies-20260930.json': (32636, 32714), 'demo-pilot-mansion-20260930.json': (32714, 32718), 'demo-pilot-morepuff-20260930.json': (32718, 32720), 'demo-pilot-luxor-20260930.json': (32835, 32820), 'demo-pilot-jinzita-20260930.json': (32720, 32835)}.get(filename)
            require((profile.get('schema') == 'sg-demo-next-game-v1' and profile.get('gameId') == next_scope[0]
                     and plan.get('gameId') == next_scope[0] and profile.get('fromGameId') == next_scope[1]
                     and profile.get('newBetAllowance') == 100 and profile.get('perWorker') == 5 and profile.get('workers') == 20
                     if next_scope else profile.get('schema') in ('sg-demo-pilot-v1','sg-demo-residual-pilot-v1')
                     and profile.get('gameId') == 32820 and plan.get('gameId') == 32820)
                and profile.get('oldPlanHash') == digest(expected)
                and profile.get('generation')==plan['demoGeneration']
                and isinstance(plan['demoGeneration'],str) and re.fullmatch(r'[a-f0-9]{64}',plan['demoGeneration'])
                and profile.get('planHash')==digest(plan),'DEMO_PLAN_MISMATCH')
            if filename in ('demo-pilot-pearl-20260930.json','demo-pilot-piggies-20260930.json','demo-pilot-mansion-20260930.json','demo-pilot-morepuff-20260930.json'):
                require(isinstance(profile.get('sourceClosureHash'),str) and re.fullmatch(r'[a-f0-9]{64}',profile['sourceClosureHash']), 'NEXT_GAME_SOURCE_CLOSE_REQUIRED')
            expected={**expected,'demoGeneration':profile['generation']}
        require(plan==expected and plan.get('phase')==1
            and plan.get('buy')==0 and (plan.get('adapter')=='native-nextgen-v1'
                or plan.get('gameId')==32795 and plan.get('adapter')=='pearl-wms-v1'), 'CAMPAIGN_PLAN_MISMATCH')
        require(type(plan.get('target')) is int and 20<=plan['target']<=300000,'BAD_POOL_TARGET')
        return dict(plan)
    trial = plan.get('trialId')
    require(isinstance(trial, str) and re.fullmatch(r'bookofsevens_[a-z0-9_]{1,70}', trial)
        and trial != 'bookofsevens_300k_20260927', 'BAD_POOL_TRIAL')
    require(type(plan.get('target')) is int and 20 <= plan['target'] <= 300000, 'BAD_POOL_TARGET')
    fixed = {'gameId': 32471, 'runtimeGameId': 33026, 'runtimeSlug': 'bookofsevens96',
        'sourceKey': 'bookofsevens96-base-v1', 'mode': 'demo', 'workers': 20, 'buy': 0,
        'betRaw': 25, 'betPerLine': 5, 'lineBet': 5, 'maxSteps': 100, 'mongoBatchSize': 100,
        'minRequestIntervalMs': 0, 'database': 'sg_capture_staging_v1',
        'collection': 'official_rounds', 'productionGamePoolWrites': False}
    require(all(type(plan.get(k)) is type(v) and plan[k] == v for k, v in fixed.items()), 'POOL_SCOPE_CHANGED')
    return dict(plan)
