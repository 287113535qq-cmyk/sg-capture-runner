"""New immutable AG queue plans; old SG profiles are unchanged."""
import json,re
from pathlib import Path
from store import require,digest


def validate_rolling_plan(plan):
    root=Path(__file__).resolve().parents[1]
    registry=json.loads((root/'config/ag-rolling-plans.json').read_text(encoding='utf-8'))
    require(registry.get('schema')=='sg-ag-rolling-plan-registry-v1' and registry.get('sourceAllowance')==0,
            'ROLLING_PLAN_REGISTRY')
    key=str(plan.get('gameId'))
    require(plan==registry.get('plans',{}).get(key) and plan.get('rollingPlan')=='sg-ag-rolling-plan-v1',
            'ROLLING_PLAN_CHANGED')
    proof=registry.get('proofs',{}).get(key,{})
    require(proof.get('schema')=='sg-ag-rolling-offline-adapter-v1' and proof.get('planHash')==digest(plan)
            and proof.get('sourceRequests')==0 and proof.get('acceptedBaseRounds',0)>=10
            and proof.get('gameId')==plan['gameId'] and proof.get('runtimeGameId')==plan['runtimeGameId']
            and re.fullmatch('[a-f0-9]{64}',proof.get('historyFileSha256','')) is not None,
            'ROLLING_OFFLINE_ADAPTER_PROOF')
    require(plan.get('schema')=='sg-work-pool-v1' and plan.get('configured') is True and plan.get('phase')==1
            and plan.get('buy')==0 and plan.get('mode')=='demo' and plan.get('target')==300000
            and plan.get('database')=='sg_capture_staging_v1' and plan.get('productionGamePoolWrites') is False
            and plan.get('adapter') in ('native-nextgen-v1', 'five-treasures-wms-v1', 'fortunes-megaways-wms-v1', 'acorn-base-wms-v1')
            and re.fullmatch(r'sg_ag_r1_[0-9]{8}_[0-9]{5}',plan.get('trialId','')) is not None
            and 'countAllocation' not in plan and 'demoGeneration' not in plan,
            'ROLLING_PLAN_SCOPE')
    if plan['adapter'] == 'five-treasures-wms-v1':
        from five_treasures_fields import SOURCE, mapping_hash
        wired = proof.get('wiringEvidence', {})
        unsigned = {k:v for k,v in wired.items() if k != 'evidenceHash'}
        require(plan['gameId'] == 32749 and plan['runtimeGameId'] == 32971 and plan['runtimeSlug'] == 'fivetreasures'
                and plan['sourceKey'] == SOURCE and plan['betRaw'] == 176 and plan['maxSteps'] == 8
                and plan.get('wmsGameId') == 20442 and plan.get('wmsChoiceCount') == 5
                and 'requestParams' not in plan and proof.get('acceptedBaseRounds') == 995
                and proof.get('acceptedFreeRounds') == 5 and proof.get('sampledRounds') == 1000
                and proof.get('independentJsPythonFields') is True and proof.get('typeMappingHash') == mapping_hash()
                and wired.get('schema') == 'sg-ag-wms-codec-wiring-replay-v1' and wired.get('evidenceHash') == digest(unsigned)
                and wired.get('gameId') == 32749 and wired.get('runtimeGameId') == 32971 and wired.get('wmsGameId') == 20442
                and wired.get('historyFileSha256') == proof['historyFileSha256']
                and wired.get('acceptedBaseRounds') == 995 and wired.get('acceptedFreeRounds') == 5
                and wired.get('sampledRounds') == 1000 and wired.get('sourceRoutesValidated') == 2030
                and wired.get('agOptionCounts') == {str(i):1 for i in range(1,6)} and wired.get('rawHashesUnchanged') is True
                and wired.get('actualRecordAndVerifyIpc') is True and wired.get('independentJsPythonFields') is True
                and wired.get('sourceRequests') == 0 and wired.get('mongoWrites') == 0
                and re.fullmatch('[a-f0-9]{64}', wired.get('fullRecordsHash', '')) is not None,
                'ROLLING_WMS_PLAN_SCOPE')
    if plan['adapter'] == 'fortunes-megaways-wms-v1':
        from fortunes_megaways_fields import SOURCE, TYPE_PROFILE, mapping_hash
        wired = proof.get('wiringEvidence', {})
        unsigned = {k:v for k,v in wired.items() if k != 'evidenceHash'}
        require(plan['gameId'] == 32751 and plan['runtimeGameId'] == 32973
                and plan['runtimeSlug'] == 'eightyeightfortunesmegaways' and plan['sourceKey'] == SOURCE
                and plan['betRaw'] == 16 and plan['maxSteps'] == 14 and plan.get('wmsGameId') == 20371
                and 'requestParams' not in plan and 'wmsChoiceCount' not in plan
                and proof.get('acceptedBaseRounds') == 996 and proof.get('acceptedFreeRounds') == 4
                and proof.get('sampledRounds') == 1000 and proof.get('typeMappingHash') == mapping_hash()
                and proof.get('independentJsPythonFields') is True
                and proof['historyFileSha256'] == TYPE_PROFILE['evidence']['historyFileSha256']
                and len(proof.get('acceptedRawHashes', [])) == 1000
                and all(re.fullmatch('[a-f0-9]{64}', h) for h in proof['acceptedRawHashes'])
                and wired.get('schema') == 'sg-ag-wms-fortunes-codec-replay-v1' and wired.get('evidenceHash') == digest(unsigned)
                and wired.get('gameId') == 32751 and wired.get('runtimeGameId') == 32973 and wired.get('wmsGameId') == 20371
                and wired.get('historyFileSha256') == proof['historyFileSha256']
                and wired.get('acceptedBaseRounds') == 996 and wired.get('acceptedFreeRounds') == 4
                and wired.get('sampledRounds') == 1000 and wired.get('sourceRoutesValidated') == 2042
                and wired.get('rawHashesUnchanged') is True and wired.get('actualRecordAndVerifyIpc') is True
                and wired.get('independentJsPythonFields') is True and wired.get('sourceRequests') == 0 and wired.get('mongoWrites') == 0
                and re.fullmatch('[a-f0-9]{64}', wired.get('fullRecordsHash', '')) is not None,
                'ROLLING_WMS_PLAN_SCOPE')
    if plan['adapter'] == 'acorn-base-wms-v1':
        from acorn_base_fields import SOURCE, TYPE_PROFILE, mapping_hash
        wired = proof.get('wiringEvidence', {})
        unsigned = {k:v for k,v in wired.items() if k != 'evidenceHash'}
        require(plan['gameId'] == 32752 and plan['runtimeGameId'] == 32974 and plan['runtimeSlug'] == 'acornpixie'
                and plan['sourceKey'] == SOURCE and plan['betRaw'] == 100 and plan['maxSteps'] == 2
                and plan.get('wmsGameId') == 20174 and 'requestParams' not in plan and 'wmsChoiceCount' not in plan
                and proof.get('acceptedBaseRounds') == proof.get('sampledRounds') == 1000 and proof.get('acceptedFreeRounds') == 0
                and proof['historyFileSha256'] == TYPE_PROFILE['evidence']['historyFileSha256']
                and proof.get('typeMappingHash') == mapping_hash() and proof.get('independentJsPythonFields') is True
                and len(proof.get('acceptedRawHashes', [])) == 1000
                and all(re.fullmatch('[a-f0-9]{64}', h) for h in proof['acceptedRawHashes'])
                and wired.get('schema') == 'sg-ag-wms-acorn-codec-replay-v1' and wired.get('evidenceHash') == digest(unsigned)
                and wired.get('gameId') == 32752 and wired.get('runtimeGameId') == 32974 and wired.get('wmsGameId') == 20174
                and wired.get('historyFileSha256') == proof['historyFileSha256']
                and wired.get('acceptedBaseRounds') == wired.get('sampledRounds') == 1000 and wired.get('acceptedFreeRounds') == 0
                and wired.get('sourceRoutesValidated') == 2000 and wired.get('rawHashesUnchanged') is True
                and wired.get('actualRecordAndVerifyIpc') is True and wired.get('independentJsPythonFields') is True
                and wired.get('sourceRequests') == wired.get('mongoWrites') == 0
                and re.fullmatch('[a-f0-9]{64}', wired.get('fullRecordsHash', '')) is not None,
                'ROLLING_WMS_PLAN_SCOPE')
    if plan.get('zeroAbpmContract') is not None:
        from zero_abpm_fields import binding
        entry=binding(plan);replay=proof.get('zeroAbpmReplay',{})
        require(replay.get('schema')=='sg-ag-zero-abpm-codec-replay-v1' and replay.get('actualRecordAndVerifyIpc') is True
                and replay.get('historyFileSha256')==proof['historyFileSha256']==entry['historyFileSha256']
                and replay.get('contractHash')==digest(entry) and replay.get('sourceRequests')==replay.get('mongoWrites')==0
                and len(proof.get('acceptedRawHashes',[]))==proof['acceptedBaseRounds']
                and re.fullmatch('[a-f0-9]{64}',replay.get('fullRecordsHash','')) is not None,'ROLLING_ZERO_ABPM_PROOF')
    return dict(plan)
