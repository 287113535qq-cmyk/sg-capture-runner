"""Trusted, operator-configured scope for the next Book of Sevens capture."""
import re
import json
from pathlib import Path
from store import require

POOL_SCHEMA = 'sg-work-pool-v1'


def validate_pool_plan(plan):
    require(isinstance(plan, dict) and plan.get('configured') is True, 'POOL_NOT_CONFIGURED')
    require(plan.get('schema') == POOL_SCHEMA, 'BAD_POOL_SCHEMA')
    if plan.get('campaignId'):
        plans=json.loads((Path(__file__).resolve().parents[1]/'config/round-one-plans.json').read_text(encoding='utf-8'))
        require(plan==plans.get(str(plan.get('gameId'))) and plan.get('phase')==1
            and plan.get('buy')==0 and plan.get('adapter')=='native-nextgen-v1','CAMPAIGN_PLAN_MISMATCH')
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
