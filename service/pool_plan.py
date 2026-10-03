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
        if plan.get('gameId')==32812:
            require('countAllocation' not in plan and 'demoGeneration' in plan
                and os.environ.get('SG_DEMO_PILOT_PROFILE')=='demo-pilot-veryfruity-action-revision3-20261003.json','VERYFRUITY_FINITE_PROFILE_REQUIRED')
            from veryfruity_demo_plan import veryfruity_demo_plan
            profile=json.loads((Path(__file__).resolve().parents[1]/'config/demo-pilot-veryfruity-action-revision3-20261003.json').read_text(encoding='utf-8'))
            require(plan==veryfruity_demo_plan(expected,profile),'VERYFRUITY_DEMO_PLAN_CHANGED')
            return dict(plan)
        if 'countAllocation' in plan:
            filename=os.environ.get('SG_FORMAL_COUNT_PROFILE','')
            if filename.startswith('formal-prepared-count-'):
                match=re.fullmatch(r'formal-prepared-count-([0-9]{5})-([a-f0-9]{64})\.json',filename)
                require(match is not None,'PREPARED_COUNT_PROFILE_PATH')
                root=Path(__file__).resolve().parents[1]/'config'
                registry=json.loads((root/'prepared-count-authorizations.json').read_text(encoding='utf-8'))
                authorization=registry.get('profiles',{}).get(filename,{})
                require(registry.get('schema')=='sg-prepared-count-authorizations-v1'
                    and registry.get('sourceAllowance')==0 and authorization.get('gameId')==int(match[1])
                    and authorization.get('activation')==match[2],'PREPARED_COUNT_PROFILE_UNAUTHORIZED')
                profile=json.loads((root/filename).read_text(encoding='utf-8'))
                from prepared_count_plan import prepared_count_plan
                require(plan==prepared_count_plan(expected,profile,authorization),'PREPARED_COUNT_PLAN_CHANGED')
                return dict(plan)
            require('demoGeneration' not in plan and plan.get('gameId') in (32721,32795,32799), 'FORMAL_COUNT_SCOPE')
            filename=os.environ.get('SG_FORMAL_COUNT_PROFILE')
            if filename=='formal-repair-pyramids-resume-action-20261002.json':
                from pyramids_resume_action_plan import pyramids_resume_action_plan
                profile=json.loads((Path(__file__).resolve().parents[1]/'config'/filename).read_text(encoding='utf-8'))
                require(plan==pyramids_resume_action_plan(expected,profile),'RESUME_ACTION_PLAN')
                return plan
            if filename=='formal-repair-pyramids-direct-action-20261002.json':
                from pyramids_direct_action_plan import pyramids_direct_action_plan
                profile=json.loads((Path(__file__).resolve().parents[1]/'config'/filename).read_text(encoding='utf-8'))
                require(plan==pyramids_direct_action_plan(expected,profile),'DIRECT_ACTION_PLAN')
                return plan
            if filename=='formal-repair-pyramids-action-budget-20261002.json':
                from pyramids_action_budget_plan import pyramids_action_budget_plan
                profile=json.loads((Path(__file__).resolve().parents[1]/'config'/filename).read_text(encoding='utf-8'))
                require(plan==pyramids_action_budget_plan(expected,profile),'ACTION_BUDGET_PLAN')
                return plan
            if filename=='formal-repair-pyramids-action-20261002.json':
                from pyramids_action_plan import pyramids_action_plan
                profile=json.loads((Path(__file__).resolve().parents[1]/'config'/filename).read_text(encoding='utf-8'))
                require(plan==pyramids_action_plan(expected,profile),'PYRAMIDS_ACTION_REPAIR_PLAN')
                return plan
            if filename=='formal-repair-pyramids-super-coins-20261002.json':
                from pyramids_super_coins_plan import pyramids_super_coins_plan
                profile=json.loads((Path(__file__).resolve().parents[1]/'config'/filename).read_text(encoding='utf-8'))
                require(plan==pyramids_super_coins_plan(expected,profile),'PYRAMIDS_SUPER_COINS_REPAIR_PLAN')
                return plan
            if filename=='formal-repair-pyramids-cash-coins-20261002.json':
                from pyramids_cash_coins_plan import pyramids_cash_coins_plan
                profile=json.loads((Path(__file__).resolve().parents[1]/'config'/filename).read_text(encoding='utf-8'))
                require(plan==pyramids_cash_coins_plan(expected,profile),'PYRAMIDS_CASH_COINS_REPAIR_PLAN')
                return plan
            if filename=='formal-repair-pyramids-retrigger-20261002.json':
                from pyramids_retrigger_plan import pyramids_retrigger_plan
                profile=json.loads((Path(__file__).resolve().parents[1]/'config'/filename).read_text(encoding='utf-8'))
                require(plan==pyramids_retrigger_plan(expected,profile),'PYRAMIDS_RETRIGGER_REPAIR_PLAN')
                return plan
            if filename=='formal-repair-pyramids-super-free-20261002.json':
                from pyramids_super_free_plan import pyramids_super_free_plan
                profile=json.loads((Path(__file__).resolve().parents[1]/'config'/filename).read_text(encoding='utf-8'))
                require(plan==pyramids_super_free_plan(expected,profile),'PYRAMIDS_SUPER_FREE_REPAIR_PLAN')
                return plan
            if filename=='formal-repair-pyramids-super-hold-20261002.json':
                from pyramids_super_hold_plan import pyramids_super_hold_plan
                profile=json.loads((Path(__file__).resolve().parents[1]/'config'/filename).read_text(encoding='utf-8'))
                require(plan==pyramids_super_hold_plan(expected,profile),'PYRAMIDS_SUPER_HOLD_REPAIR_PLAN')
                return plan
            if filename=='formal-repair-pyramids-fifteen-20261002.json':
                from pyramids_fifteen_plan import pyramids_fifteen_plan
                profile=json.loads((Path(__file__).resolve().parents[1]/'config'/filename).read_text(encoding='utf-8'))
                require(plan==pyramids_fifteen_plan(expected,profile),'PYRAMIDS_FIFTEEN_REPAIR_PLAN')
                return dict(plan)
            if filename=='formal-repair-pyramids-mixed-20261002.json':
                from pyramids_mixed_plan import pyramids_mixed_plan
                profile=json.loads((Path(__file__).resolve().parents[1]/'config'/filename).read_text(encoding='utf-8'))
                require(plan==pyramids_mixed_plan(expected,profile),'PYRAMIDS_MIXED_REPAIR_PLAN')
                return dict(plan)
            if filename in ('formal-sessions-pearl-two-20261001.json', 'formal-sessions-pearl-four-20261001.json', 'formal-sessions-rhino-two-20261001.json', 'formal-sessions-rhino-four-20261001.json'):
                from session_layout_plan import session_layout_plan
                profile=json.loads((Path(__file__).resolve().parents[1]/'config'/filename).read_text(encoding='utf-8'))
                approved=session_layout_plan(expected, profile)
                require(plan == approved, 'SESSION_PROFILE_PLAN_CHANGED')
                return dict(plan)
            if filename in ('formal-repair-pyramids-major-20261001.json','formal-repair-pyramids-major-entryfix-20261001.json'):
                from pyramids_major_plan import pyramids_major_plan
                profile=json.loads((Path(__file__).resolve().parents[1]/'config'/filename).read_text(encoding='utf-8'))
                require(plan == pyramids_major_plan(expected, profile), 'PYRAMIDS_MAJOR_REPAIR_PLAN')
                return dict(plan)
            require(filename in ('formal-repair-pyramids-continuation-20261001.json','formal-repair-pyramids-display-20261001.json','formal-repair-pyramids-coins-20261001.json','formal-count-pyramids-20261001.json','formal-count-rhino-20261001.json','formal-count-rhino-guarantee-20261001.json','formal-count-pearl-20260930.json','formal-repair-pearl-20260930.json','formal-repair-pearl-awards-20261001.json'), 'FORMAL_COUNT_PROFILE_PATH')
            profile=json.loads((Path(__file__).resolve().parents[1]/'config'/filename).read_text(encoding='utf-8'))
            repair = filename == 'formal-repair-pearl-20260930.json'
            awards = filename == 'formal-repair-pearl-awards-20261001.json'
            rhino_repaired = filename == 'formal-count-rhino-guarantee-20261001.json'
            rhino = rhino_repaired or filename == 'formal-count-rhino-20261001.json'
            if rhino_repaired:
                require(profile.get('sourceProfileHash')=='d03dc36c60fa3bf208126fe7592d70ab16a74a32afe39844817fa160ac565433'
                    and profile.get('sourceRunKey')=='capture-run:36826318464:1'
                    and profile.get('sourceCommit')=='65d870c75d77022b2de8deaca2755f5cd55e1528'
                    and profile.get('sourceGeneration')=='a8bbaf0c5f2522764d73a5111acb42eceed9076d276f5b077f8bc1c6eabcfc0d'
                    and profile.get('repairedBaseline',{}).get('completePreserved')==51,'RHINO_REPAIRED_SOURCE_SCOPE')
            pyramids = filename == 'formal-count-pyramids-20261001.json'
            pyramids_continuation = filename == 'formal-repair-pyramids-continuation-20261001.json'
            pyramids_display = pyramids_continuation or filename == 'formal-repair-pyramids-display-20261001.json'
            pyramids_repair = pyramids_display or filename == 'formal-repair-pyramids-coins-20261001.json'
            if pyramids_repair:
                require(profile.get('group')=='secondary' and profile.get('workerOffset')==20
                    and profile.get('historicalBaseline')==150 and profile.get('totalTarget')==300000
                    and expected.get('target')==299850 and expected.get('trialId')=='sg_r1_20260928_32721'
                    and profile.get('oldProfileHash')==('ad341baba9491cb4ca804074fec940f1a85b12ea8df454eeacdddf4c6ff42e8b' if pyramids_continuation else '93fef71918ebb6ad0d08e546b3ec13a2964b8493b8f860306e99564899808533' if pyramids_display else '989d114146fc85a759015ead8fa46c0f7d89c19d29f590ac849c9ff059ffdb9c')
                    and profile.get('sourceRun')==('36842835455:1' if pyramids_continuation else '36791455132:1' if pyramids_display else '36778619850:1')
                    and profile.get('sourceCommit')==('819b429562e3c011305b2366e8ceac7354999dec' if pyramids_continuation else '876797180569bb1134fd7cc6c6934dc347cd0cb1' if pyramids_display else 'c3e172c9712084034ddd34d69ab51071d78cb1a4'), 'PYRAMIDS_REPAIR_PROFILE_SCOPE')
            if pyramids:
                require(profile.get('group')=='secondary' and profile.get('workerOffset')==20
                    and profile.get('historicalBaseline')==150 and profile.get('totalTarget')==300000
                    and expected.get('target')==299850 and expected.get('trialId')=='sg_r1_20260928_32721'
                    and profile.get('sourceRunKey')=='capture-run:36774221164:1'
                    and profile.get('sourceGeneration')=='85eeac22df0369e166f1c1b31dd4f38a222aeb5910903ee59208800df54a3783'
                    and profile.get('sourceProfileHash')=='93d4cf52cdec03b69e48f078f2ce0fd014165bd0791efa620ae46ec0a8cea339', 'PYRAMIDS_COUNT_PROFILE_SCOPE')
            require(profile.get('schema') == ('sg-formal-repair-pyramids-v2' if pyramids_display else 'sg-formal-repair-pyramids-v1' if pyramids_repair else 'sg-formal-count-pyramids-v1' if pyramids else 'sg-formal-count-rhino-v2' if rhino_repaired else 'sg-formal-count-rhino-v1' if rhino else 'sg-formal-repair-profile-v2' if awards else 'sg-formal-repair-profile-v1' if repair else 'sg-formal-count-profile-v1')
                and profile.get('gameId') == plan.get('gameId') == (32721 if pyramids or pyramids_repair else 32799 if rhino else 32795)
                and profile.get('basePlanHash') == digest(expected) and profile.get('activation') == plan['countAllocation']
                and isinstance(plan['countAllocation'],str) and re.fullmatch(r'[a-f0-9]{64}',plan['countAllocation'])
                and profile.get('completePreserved') == (151 if rhino_repaired else 2590 if pyramids_continuation else 2127 if pyramids_display else 1658 if pyramids_repair else 1362 if pyramids else 2596 if awards else 961 if repair else 100) and profile.get('remainingComplete') == (299849 if rhino_repaired else 297260 if pyramids_continuation else 297723 if pyramids_display else 298192 if pyramids_repair else 298488 if pyramids else 297404 if awards else 299039 if repair else 299900)
                and profile.get('maxSequence') == 600000 and profile.get('sessionRotation') == 'closed-batches-v1'
                and profile.get('planHash') == digest(plan), 'FORMAL_COUNT_PLAN_CHANGED')
            expected={**expected,'countAllocation':profile['activation']}
            if repair or awards:
                feature = 'additive-free-awards-v2' if awards else 'eight-free-retrigger-v1'
                require(profile.get('featureProfile') == feature, 'FORMAL_REPAIR_FEATURE')
                expected.update(maxSteps=1026,featureProfile=feature)
        if 'demoGeneration' in plan:
            filename=os.environ.get('SG_DEMO_PILOT_PROFILE','demo-pilot-beaver-20260930.json')
            repair_scopes = {'demo-repair-rhino-guarantee-20261001.json': (32799, 51, 'ragingrhino-wms-v1-terminal-guarantee-v1'), 'demo-repair-mansion-20261001.json': (32714, 129, 'huffnpuffmoneymansionhighlimit96-round-one-base-v1-hard-hat-retrigger-v2'),
                'demo-repair-piggies-20261001.json': (32636, 33, 'richlittlepiggiesworldclass96-round-one-base-v1-size2-free-v1'),
                'demo-repair-morepuff-20261001.json': (32718, 91, 'huffnmorepuffhighlimit96-round-one-base-v1-wheel-megahat-single-v1')}
            require(filename in repair_scopes or filename in ('demo-pilot-pyramids-20261001.json','demo-pilot-inca-20261001.json','demo-pilot-rhino-20261001.json','demo-pilot-pearl-20260930.json','demo-pilot-piggies-20260930.json','demo-pilot-mansion-20260930.json','demo-pilot-morepuff-20260930.json','demo-pilot-jinzita-20260930.json','demo-pilot-luxor-20260930.json','demo-pilot-beaver-20260930.json','demo-pilot-replacement-20260930.json','demo-residual-beaver-20260930.json'),'DEMO_PROFILE_PATH')
            profile=json.loads((Path(__file__).resolve().parents[1]/'config'/filename).read_text(encoding='utf-8'))
            next_scope = {'demo-pilot-pyramids-20261001.json': (32721, 32719), 'demo-pilot-rhino-20261001.json': (32799, 32795), 'demo-pilot-pearl-20260930.json': (32795, 32636), 'demo-pilot-piggies-20260930.json': (32636, 32714), 'demo-pilot-mansion-20260930.json': (32714, 32718), 'demo-pilot-morepuff-20260930.json': (32718, 32720), 'demo-pilot-luxor-20260930.json': (32835, 32820), 'demo-pilot-jinzita-20260930.json': (32720, 32835)}.get(filename)
            if filename in repair_scopes:
                game, preserved, extension = repair_scopes[filename]
                candidate = profile.get('repairedCandidate', {})
                registry = json.loads((Path(__file__).resolve().parent/'round_types.json').read_text(encoding='utf-8'))
                require(profile.get('fromGameId') in (32795, 32799, 32714, 32636, 32718)
                    and profile['fromGameId'] != game and not profile.get('legacyImport') and not profile.get('emptyCandidate')
                    and profile.get('completePreserved') == preserved and profile.get('abandonedAttempts') == 0
                    and candidate.get('schema') == 'sg-repaired-demo-candidate-v1' and candidate.get('extension') == extension
                    and candidate.get('basePlanHash') == digest(expected) and candidate.get('completePreserved') == preserved
                    and candidate.get('oldGeneration') != profile.get('generation')
                    and isinstance(candidate.get('oldGeneration'), str) and re.fullmatch(r'[a-f0-9]{64}', candidate['oldGeneration'])
                    and candidate.get('oldPlanHash') == digest({**expected, 'demoGeneration': candidate['oldGeneration']})
                    and candidate.get('mappingHash') == digest(registry['profiles'][extension])
                    and candidate.get('closureKey') == f"closed-demo-pilot:{expected['trialId']}:{candidate['oldGeneration']}"
                    and candidate.get('repairKey') == ("game-repair:sg_r1_20261001_32799:06a09fdff1cbd24320a2a0a12229b6e53cc2d5e6185ff13197f9cbf97c9a8554" if game == 32799 else f"game-repair:{expected['trialId']}:{candidate['oldGeneration']}")
                    and all(isinstance(candidate.get(k), str) and re.fullmatch(r'[a-f0-9]{64}', candidate[k])
                            for k in ('mappingHash','closureHash','repairHash','poolHash','campaignHash','batchesHash','recordsHash')),
                    'REPAIR_CANDIDATE_PLAN')
                ref = profile.get('sourceFormal', {})
                require((ref.get('schema') == 'sg-formal-source-boundary-v1' and ref.get('kind') in ('complete','retired')
                         and isinstance(ref.get('proofHash'), str) and re.fullmatch(r'[a-f0-9]{64}', ref['proofHash']))
                    or (isinstance(profile.get('sourceClosureHash'), str) and re.fullmatch(r'[a-f0-9]{64}', profile['sourceClosureHash'])),
                    'REPAIR_SOURCE_BOUNDARY_REQUIRED')
                next_scope = (game, profile['fromGameId'])
            if filename == 'demo-pilot-pyramids-20261001.json':
                legacy=profile.get('legacyImport',{})
                fixed=json.loads((Path(__file__).resolve().parents[1]/'config/parked-pyramids-20261001.json').read_text(encoding='utf-8'))
                require(digest(profile)=='93d4cf52cdec03b69e48f078f2ce0fd014165bd0791efa620ae46ec0a8cea339'
                    and profile.get('group')=='secondary' and type(profile.get('workerOffset')) is int and profile['workerOffset']==20
                    and profile.get('completePreserved')==1262 and profile.get('abandonedAttempts')==4
                    and profile.get('sourceClosureHash')=='6c4638ed879867f611a3aeffb6e97a40ba2b8cdeaa90d211f669711549c4425c'
                    and profile.get('sourceRunKey')=='capture-run:36765916285:1'
                    and digest(fixed)=='c29872c827b7cd192d7424bf46b17108a173ee3175c9aa291299010e0cf7ba28'
                    and legacy.get('fixedLegacyHash')==digest(fixed) and fixed.get('planHash')==digest(expected)
                    and all(legacy.get(k)==fixed[k] for k in ('archiveHash','bytes','complete','mongoCount','pending'))
                    and not any(profile.get(k) for k in ('sourceFormal','repairedCandidate','emptyCandidate')),
                    'SECONDARY_PYRAMIDS_PROFILE_SCOPE')
            idle = filename == 'demo-pilot-inca-20261001.json'
            if idle:
                legacy=profile.get('legacyImport',{})
                require(profile.get('schema')=='sg-demo-secondary-idle-pilot-v1' and profile.get('group')=='secondary'
                    and type(profile.get('workerOffset')) is int and profile['workerOffset']==20
                    and profile.get('gameId')==plan.get('gameId')==32719 and profile.get('fromGameId') is None
                    and profile.get('newBetAllowance')==100 and profile.get('perWorker')==5 and profile.get('workers')==20
                    and profile.get('completePreserved')==67 and profile.get('abandonedAttempts')==1
                    and legacy.get('schema')=='sg-parked-import-v1' and legacy.get('mongoCount')==60
                    and legacy.get('complete')==67 and legacy.get('pending')==1 and legacy.get('bytes')==74009
                    and legacy.get('archiveHash')=='2d815dffe1185deb4b13d180744f8eec69364956297efc122cd1858f9b6c01f2'
                    and not any(profile.get(k) for k in ('sourceFormal','sourceGeneration','sourceRunKey','repairedCandidate','emptyCandidate')),
                    'SECONDARY_IDLE_PROFILE_SCOPE')
            require((idle or (profile.get('schema') == 'sg-demo-next-game-v1' and profile.get('gameId') == next_scope[0]
                     and plan.get('gameId') == next_scope[0] and profile.get('fromGameId') == next_scope[1]
                     and profile.get('newBetAllowance') == 100 and profile.get('perWorker') == 5 and profile.get('workers') == 20
                     if next_scope else profile.get('schema') in ('sg-demo-pilot-v1','sg-demo-residual-pilot-v1')
                     and profile.get('gameId') == 32820 and plan.get('gameId') == 32820))
                and profile.get('oldPlanHash') == digest(expected)
                and profile.get('generation')==plan['demoGeneration']
                and isinstance(plan['demoGeneration'],str) and re.fullmatch(r'[a-f0-9]{64}',plan['demoGeneration'])
                and profile.get('planHash')==digest(plan),'DEMO_PLAN_MISMATCH')
            if filename in ('demo-pilot-pearl-20260930.json','demo-pilot-piggies-20260930.json','demo-pilot-mansion-20260930.json','demo-pilot-morepuff-20260930.json'):
                require(isinstance(profile.get('sourceClosureHash'),str) and re.fullmatch(r'[a-f0-9]{64}',profile['sourceClosureHash']), 'NEXT_GAME_SOURCE_CLOSE_REQUIRED')
            if filename == 'demo-pilot-rhino-20261001.json':
                ref=profile.get('sourceFormal',{})
                require(ref.get('schema')=='sg-formal-source-boundary-v1' and ref.get('kind') in ('complete','retired')
                    and isinstance(ref.get('proofHash'),str) and re.fullmatch(r'[a-f0-9]{64}',ref['proofHash'])
                    and profile.get('emptyCandidate',{}).get('schema')=='sg-empty-demo-candidate-v1'
                    and profile.get('completePreserved')==0 and profile.get('abandonedAttempts')==0, 'RHINO_SOURCE_BOUNDARY_REQUIRED')
            expected={**expected,'demoGeneration':profile['generation']}
        require(plan==expected and plan.get('phase')==1
            and plan.get('buy')==0 and (plan.get('adapter')=='native-nextgen-v1'
                or plan.get('gameId')==32795 and plan.get('adapter')=='pearl-wms-v1'
                or plan.get('gameId')==32799 and plan.get('adapter')=='rhino-wms-v1'), 'CAMPAIGN_PLAN_MISMATCH')
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
