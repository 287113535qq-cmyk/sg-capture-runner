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
            and plan.get('adapter') in ('native-nextgen-v1', 'five-treasures-wms-v1', 'fortunes-megaways-wms-v1', 'acorn-base-wms-v1', 'eighty-fortunes-wms-v1', 'actionbank-base-wms-v1', 'blazing-x-wms-v1')
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
    if plan['adapter'] == 'blazing-x-wms-v1':
        from blazing_x_fields import SOURCE, TYPE_PROFILE, mapping_hash
        wired = proof.get('wiringEvidence', {})
        unsigned = {k:v for k,v in wired.items() if k != 'evidenceHash'}
        require(plan['gameId'] == 32755 and plan['runtimeGameId'] == 32977 and plan['runtimeSlug'] == 'blazingxasia'
                and plan['sourceKey'] == SOURCE and plan['betRaw'] == 240 and plan['maxSteps'] == 12
                and plan.get('wmsGameId') == 20363 and 'requestParams' not in plan and 'wmsChoiceCount' not in plan
                and proof.get('sampledRounds') == 1000 and proof.get('acceptedBaseRounds') == 997 and proof.get('acceptedFreeRounds') == 3
                and proof.get('freeHistoricalIndices') == [77,667,714] and proof.get('unhandledHistoricalVariants') == {}
                and proof['historyFileSha256'] == TYPE_PROFILE['evidence']['historyFileSha256']
                and proof.get('typeMappingHash') == mapping_hash() and proof.get('independentJsPythonFields') is True
                and proof.get('actualRecordAndVerifyIpc') is True
                and len(proof.get('acceptedRawHashes', [])) == len(set(proof.get('acceptedRawHashes', []))) == 1000
                and digest(proof['acceptedRawHashes']) == 'd042e587846fad977b65fd2fd4c8a26005e9d989ce4a21d35a817e1a362e39b9'
                and wired.get('schema') == 'sg-ag-wms-blazing-codec-replay-v1' and wired.get('evidenceHash') == digest(unsigned)
                and wired.get('gameId') == 32755 and wired.get('runtimeGameId') == 32977 and wired.get('wmsGameId') == 20363
                and wired.get('historyFileSha256') == proof['historyFileSha256']
                and wired.get('acceptedBaseRounds') == 997 and wired.get('sampledRounds') == 1000 and wired.get('acceptedFreeRounds') == 3
                and wired.get('freeHistoricalIndices') == [77,667,714] and wired.get('sourceRoutesValidated') == 2030
                and wired.get('rawHashesUnchanged') is True and wired.get('acceptedRawHashesHash') == digest(proof['acceptedRawHashes'])
                and wired.get('actualRecordAndVerifyIpc') is True and wired.get('independentJsPythonFields') is True
                and wired.get('sourceRequests') == wired.get('mongoWrites') == wired.get('failedOrHistoricalRoundsCredited') == 0
                and wired.get('fullRecordsHash') == 'a8d8e2a398b063b4f59edf0eb8f4be5bf03b2c7091565cb29e4f2fbf0aa142ea', 'ROLLING_WMS_PLAN_SCOPE')
    if plan['adapter'] == 'actionbank-base-wms-v1':
        from actionbank_base_fields import SOURCE, TYPE_PROFILE, mapping_hash
        wired = proof.get('wiringEvidence', {})
        unsigned = {k:v for k,v in wired.items() if k != 'evidenceHash'}
        require(plan['gameId'] == 32753 and plan['runtimeGameId'] == 32975 and plan['runtimeSlug'] == 'actionbankplus'
                and plan['sourceKey'] == SOURCE and plan['betRaw'] == 200 and plan['maxSteps'] == 2
                and plan.get('wmsGameId') == 20369 and 'requestParams' not in plan and 'wmsChoiceCount' not in plan
                and proof.get('sampledRounds') == 1000 and proof.get('acceptedBaseRounds') == 989 and proof.get('acceptedFreeRounds') == 0
                and proof.get('rejectedPartialFreeRounds') == len(proof.get('rejectedHistoricalPrefixes', [])) == 11
                and proof.get('unhandledHistoricalVariants') == {'ACTIONBANK_FEATURE_NOT_ADAPTED':11}
                and proof['historyFileSha256'] == TYPE_PROFILE['evidence']['historyFileSha256']
                and proof.get('typeMappingHash') == mapping_hash() and proof.get('independentJsPythonFields') is True
                and len(proof.get('acceptedRawHashes', [])) == len(set(proof.get('acceptedRawHashes', []))) == 989
                and digest(proof['acceptedRawHashes']) == '3447ba99e257483b37f8397eb7f451edc846134d9b556028640ccdb9a21324cd'
                and wired.get('schema') == 'sg-ag-wms-actionbank-codec-replay-v1' and wired.get('evidenceHash') == digest(unsigned)
                and wired.get('gameId') == 32753 and wired.get('runtimeGameId') == 32975 and wired.get('wmsGameId') == 20369
                and wired.get('historyFileSha256') == proof['historyFileSha256']
                and wired.get('acceptedBaseRounds') == 989 and wired.get('sampledRounds') == 1000 and wired.get('acceptedFreeRounds') == 0
                and wired.get('rejectedPartialFreeRounds') == wired.get('rejectedPaidPrefixIntentsValidated') == 11
                and wired.get('rejectedHistoricalIndices') == [v['sampleIndex'] for v in proof['rejectedHistoricalPrefixes']]
                and wired.get('rejectedHistoricalIndices') == [13,39,62,184,197,281,344,487,506,521,680]
                and wired.get('sourceRoutesValidated') == 1978 and wired.get('rawHashesUnchanged') is True
                and wired.get('acceptedRawHashesHash') == digest(proof['acceptedRawHashes'])
                and wired.get('actualRecordAndVerifyIpc') is True and wired.get('independentJsPythonFields') is True
                and wired.get('unreviewedFeatureEndGameRejected') is True
                and wired.get('sourceRequests') == wired.get('mongoWrites') == wired.get('failedOrHistoricalRoundsCredited') == 0
                and wired.get('fullRecordsHash') == '2b8d12af6fefaeff58545876b4a750777f50ee83944d64b19628d638f83c077b',
                'ROLLING_WMS_PLAN_SCOPE')
    if plan['adapter'] == 'eighty-fortunes-wms-v1':
        from eighty_fortunes_fields import SOURCE, TYPE_PROFILE, mapping_hash
        wired = proof.get('wiringEvidence', {})
        unsigned = {k:v for k,v in wired.items() if k != 'evidenceHash'}
        require(plan['gameId'] == 32750 and plan['runtimeGameId'] == 32972 and plan['runtimeSlug'] == 'eightyeightfortunes'
                and plan['sourceKey'] == SOURCE and plan['betRaw'] == 176 and plan['maxSteps'] == 12
                and plan.get('wmsGameId') == 20077 and 'requestParams' not in plan and 'wmsChoiceCount' not in plan
                and proof.get('sampledRounds') == 1001 and proof.get('acceptedBaseRounds') == 992
                and proof.get('acceptedJackpotRounds') == 4 and proof.get('acceptedFreeRounds') == 1
                and proof.get('rejectedPartialFreeRounds') == len(proof.get('rejectedHistoricalPrefixes', [])) == 4
                and proof['historyFileSha256'] == TYPE_PROFILE['evidence']['historyFileSha256']
                and proof.get('fullFreeProbeSha256') == TYPE_PROFILE['evidence']['fullFreeProbeSha256']
                and proof.get('typeMappingHash') == mapping_hash() and proof.get('independentJsPythonFields') is True
                and len(proof.get('acceptedRawHashes', [])) == len(set(proof.get('acceptedRawHashes', []))) == 997
                and all(re.fullmatch('[a-f0-9]{64}', h) for h in proof['acceptedRawHashes'])
                and wired.get('schema') == 'sg-ag-wms-eighty-codec-replay-v1' and wired.get('evidenceHash') == digest(unsigned)
                and wired.get('gameId') == 32750 and wired.get('runtimeGameId') == 32972 and wired.get('wmsGameId') == 20077
                and wired.get('historyFileSha256') == proof['historyFileSha256'] and wired.get('fullFreeProbeSha256') == proof['fullFreeProbeSha256']
                and wired.get('acceptedBaseRounds') == 992 and wired.get('acceptedJackpotRounds') == 4 and wired.get('acceptedFreeRounds') == 1
                and wired.get('sampledRounds') == 1001 and wired.get('rejectedPartialFreeRounds') == 4
                and wired.get('rejectedHistoricalIndices') == [v['sampleIndex'] for v in proof['rejectedHistoricalPrefixes']]
                and wired.get('sourceRoutesValidated') == 2004 and wired.get('rawHashesUnchanged') is True
                and wired.get('actualRecordAndVerifyIpc') is True and wired.get('independentJsPythonFields') is True
                and wired.get('legacyOrdinaryAndJackpotParityRounds') == 996 and wired.get('fullProbeCorrectedWinRaw') == 5930
                and wired.get('fullProbeLegacyOmissionRaw') == 880 and wired.get('unreviewed1760TriggerTerminalRejected') is True
                and wired.get('sourceRequests') == wired.get('mongoWrites') == wired.get('failedOrHistoricalRoundsCredited') == 0
                and re.fullmatch('[a-f0-9]{64}', wired.get('fullRecordsHash', '')) is not None,
                'ROLLING_WMS_PLAN_SCOPE')
    if plan.get('automaticTerminalContract') is not None:
        from automatic_terminal_fields import CONTRACT,binding,policy
        p=policy();e=proof.get('automaticTerminalEvidence',{});wire=e.get('wiringEvidence',{})
        binding(plan,dict(fixtureOnly=False,protocol='nextgen',sourceKey=plan['sourceKey'],roundFieldsVersion='sg-round-fields-v1',
                         automaticFreeContract=plan['automaticFreeContract'],automaticTerminalContract=CONTRACT,steps=[]))
        require(e.get('schema')=='sg-ag-moneyraid-terminal-repair-evidence-v2'
                and e.get('previousPlanHash')==p['sourceBinding']['previousPlanHash']
                and e.get('previousProofHash')==p['sourceBinding']['previousProofHash']
                and e.get('contractHash')==plan['automaticTerminalContractHash']
                and e.get('nativeEvidenceHash')==p['nativeEvidenceHash'] and e.get('ownClosedNaturalRounds')==104
                and e.get('durableFrameCount')==872 and e.get('terminalFidCounts')=={'2|':91,'3|':13}
                and e.get('independentJsPython') is True and e.get('sourceRequests')==e.get('mongoWrites')==e.get('failedRoundsCredited')==0
                and len(p.get('nativeRawHashes',[]))==len(set(p.get('nativeRawHashes',[])))==104
                and len(p.get('nativeClosedHashes',[]))==104
                and all(re.fullmatch('[a-f0-9]{64}',h) for h in p['nativeRawHashes']+p['nativeClosedHashes'])
                and wire.get('schema')=='sg-ag-moneyraid-terminal-codec-replay-v2'
                and wire.get('evidenceHash')==digest({k:v for k,v in wire.items() if k!='evidenceHash'})
                and wire.get('previousPlanHash')==e['previousPlanHash'] and wire.get('contractHash')==e['contractHash']
                and wire.get('ownClosedNaturalFullRounds')==104 and wire.get('terminalFidCounts')==e['terminalFidCounts']
                and wire.get('actualOwnCodecPythonRequests')==872 and wire.get('oldMarkerUnreviewedTerminalRejected')==104
                and wire.get('oldAcceptedUnmarkedRecordParity')==97 and wire.get('oldMarkedV1RecordParity')==99
                and wire.get('futureHistoricalFieldsParity')==99 and wire.get('futureHistoricalRoutes')==118
                and wire.get('oldBetZeroRefreshStillRejected')==1
                and wire.get('actualCodecPythonRecordAndVerify') is True and wire.get('independentEveryFrameFinanceAndRequests') is True
                and wire.get('acceptedOldRawHashesUnchanged') is True
                and wire.get('sourceRequests')==wire.get('mongoWrites')==wire.get('failedRoundsCredited')==0
                and re.fullmatch('[a-f0-9]{64}',wire.get('ownFullRecordsHash','')) is not None,
                'ROLLING_AUTOMATIC_TERMINAL_PROOF')
    if plan.get('zeroAbpmContract') is not None:
        from zero_abpm_fields import binding
        entry=binding(plan);replay=proof.get('zeroAbpmReplay',{})
        require(replay.get('schema')=='sg-ag-zero-abpm-codec-replay-v1' and replay.get('actualRecordAndVerifyIpc') is True
                and replay.get('historyFileSha256')==proof['historyFileSha256']==entry['historyFileSha256']
                and replay.get('contractHash')==digest(entry) and replay.get('sourceRequests')==replay.get('mongoWrites')==0
                and len(proof.get('acceptedRawHashes',[]))==proof['acceptedBaseRounds']
                and re.fullmatch('[a-f0-9]{64}',replay.get('fullRecordsHash','')) is not None,'ROLLING_ZERO_ABPM_PROOF')
    return dict(plan)
