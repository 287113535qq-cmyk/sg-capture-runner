"""New immutable AG queue plans; old SG profiles are unchanged."""
import json,re
from pathlib import Path
from store import require,digest


def validate_rolling_plan(plan):
    root=Path(__file__).resolve().parents[1]
    registry=json.loads((root/'config/ag-rolling-plans.json').read_text(encoding='utf-8'))
    require(registry.get('schema')=='sg-ag-rolling-plan-registry-v1' and registry.get('sourceAllowance')==0,
            'ROLLING_PLAN_REGISTRY')
    if 'ordinarySemanticContract' in plan:
        from own_wms_ordinary_wiring_v2 import validate
        return validate(plan,registry)
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
            and plan.get('adapter') in ('native-nextgen-v1', 'five-treasures-wms-v1', 'fortunes-megaways-wms-v1', 'acorn-base-wms-v1', 'eighty-fortunes-wms-v1', 'actionbank-base-wms-v1', 'blazing-x-wms-v1', 'arthur-base-wms-v1', 'celestial-base-wms-v1', 'cheshire-base-wms-v1', 'cooljewels-base-wms-v1', 'crystalforest-base-wms-v1', 'dancingdrums-base-wms-v1', 'drumsexplosion-base-wms-v1', 'desertcats-base-wms-v1', 'jekyll-base-wms-v1', 'dragonspin-base-wms-v1', 'deepseamagic-base-wms-v1', 'eurekablast-base-wms-v1', 'firequeen-base-wms-v1', 'frozeninferno-base-wms-v1', 'fudaole-base-wms-v1', 'giantsgold-base-wms-v1', 'goldenchief-base-wms-v1', 'heidibier-base-wms-v1', 'hercules-base-wms-v1', 'himalayas-base-wms-v1', 'hulahula-base-wms-v1', 'moolah-base-wms-v1', 'jinjimegaways-base-wms-v1', 'jinjitreasure-base-wms-v1', 'jinsedragon-base-wms-v1', 'kingbabylon-base-wms-v1')
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
    if plan['adapter'] == 'celestial-base-wms-v1':
        from celestial_base_fields import SOURCE, TYPE_PROFILE, mapping_hash
        wired = proof.get('wiringEvidence', {})
        unsigned = {k:v for k,v in wired.items() if k != 'evidenceHash'}
        require(plan['gameId'] == 32756 and plan['runtimeGameId'] == 32978 and plan['runtimeSlug'] == 'celestialking'
                and plan['sourceKey'] == SOURCE and plan['betRaw'] == 100 and plan['maxSteps'] == 2
                and plan.get('wmsGameId') == 20210 and 'requestParams' not in plan and 'wmsChoiceCount' not in plan
                and proof.get('sampledRounds') == 1000 and proof.get('acceptedBaseRounds') == 994 and proof.get('acceptedFreeRounds') == 0
                and proof.get('rejectedFeatureRounds') == len(proof.get('rejectedHistoricalPrefixes', [])) == 6
                and proof.get('unhandledHistoricalVariants') == {'CELESTIAL_FEATURE_NOT_ADAPTED':6}
                and proof['historyFileSha256'] == TYPE_PROFILE['evidence']['historyFileSha256']
                and proof.get('typeMappingHash') == mapping_hash() and proof.get('independentJsPythonFields') is True
                and proof.get('actualRecordAndVerifyIpc') is True
                and len(proof.get('acceptedRawHashes', [])) == len(set(proof.get('acceptedRawHashes', []))) == 994
                and digest(proof['acceptedRawHashes']) == '97af3d0e9ecf05d8f8057252f3285347aadc5d76361503ceb13e691d7b868826'
                and digest(proof['rejectedHistoricalPrefixes']) == 'cfc23d5a01ac8c8900a4365dd8d1aa2f4d3aaf77caa596e59a15a77149ebff7b'
                and wired.get('schema') == 'sg-ag-wms-celestial-codec-replay-v1'
                and wired.get('evidenceHash') == digest(unsigned) == '44bba4b8c362842e171c21dd8fa18909454a8ea28dd7510aba9001b3fe06fc62'
                and wired.get('actualRecordAndVerifyIpc') is True and wired.get('independentJsPythonFields') is True
                and wired.get('sourceRequests') == wired.get('mongoWrites') == wired.get('failedOrHistoricalRoundsCredited') == 0,
                'ROLLING_WMS_PLAN_SCOPE')
    if plan['adapter'] == 'cheshire-base-wms-v1':
        from cheshire_base_fields import SOURCE, TYPE_PROFILE, mapping_hash
        wired = proof.get('wiringEvidence', {})
        unsigned = {k:v for k,v in wired.items() if k != 'evidenceHash'}
        require(plan['gameId'] == 32757 and plan['runtimeGameId'] == 32979 and plan['runtimeSlug'] == 'cheshirecat'
                and plan['sourceKey'] == SOURCE and plan['betRaw'] == 240 and plan['maxSteps'] == 2
                and plan.get('wmsGameId') == 20132 and 'requestParams' not in plan and 'wmsChoiceCount' not in plan
                and proof.get('sampledRounds') == 1000 and proof.get('acceptedBaseRounds') == 1000 and proof.get('acceptedFreeRounds') == 0
                and proof.get('rejectedFeatureRounds') == len(proof.get('rejectedHistoricalPrefixes', [])) == 0
                and proof.get('unhandledHistoricalVariants') == {}
                and proof['historyFileSha256'] == TYPE_PROFILE['evidence']['historyFileSha256']
                and proof.get('typeMappingHash') == mapping_hash() and proof.get('independentJsPythonFields') is True
                and proof.get('actualRecordAndVerifyIpc') is True
                and len(proof.get('acceptedRawHashes', [])) == len(set(proof.get('acceptedRawHashes', []))) == 1000
                and digest(proof['acceptedRawHashes']) == '6308548f41997b338dcce566da73694d71b0d3cb3ff9846cbac1e3121ba7fe19'
                and digest(proof['rejectedHistoricalPrefixes']) == '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945'
                and wired.get('schema') == 'sg-ag-wms-cheshire-codec-replay-v1'
                and wired.get('evidenceHash') == digest(unsigned) == '961c3f59a0340a54bd6a99b1fccc0116a1092b5d3a8339030d97fee0428ef42d'
                and wired.get('actualRecordAndVerifyIpc') is True and wired.get('independentJsPythonFields') is True
                and wired.get('sourceRequests') == wired.get('mongoWrites') == wired.get('failedOrHistoricalRoundsCredited') == 0,
                'ROLLING_WMS_PLAN_SCOPE')
    if plan['adapter'] == 'cooljewels-base-wms-v1':
        from cooljewels_base_fields import SOURCE, TYPE_PROFILE, mapping_hash
        wired = proof.get('wiringEvidence', {})
        unsigned = {k:v for k,v in wired.items() if k != 'evidenceHash'}
        require(plan['gameId'] == 32758 and plan['runtimeGameId'] == 32980 and plan['runtimeSlug'] == 'cooljewels'
                and plan['sourceKey'] == SOURCE and plan['betRaw'] == 50 and plan['maxSteps'] == 2
                and plan.get('wmsGameId') == 20150 and 'requestParams' not in plan and 'wmsChoiceCount' not in plan
                and proof.get('sampledRounds') == 1000 and proof.get('acceptedBaseRounds') == 994 and proof.get('acceptedFreeRounds') == 0
                and proof.get('rejectedFeatureRounds') == len(proof.get('rejectedHistoricalPrefixes', [])) == 6
                and proof.get('unhandledHistoricalVariants') == {'COOLJEWELS_FEATURE_NOT_ADAPTED':6}
                and proof['historyFileSha256'] == TYPE_PROFILE['evidence']['historyFileSha256']
                and proof.get('typeMappingHash') == mapping_hash() and proof.get('independentJsPythonFields') is True
                and proof.get('actualRecordAndVerifyIpc') is True
                and len(proof.get('acceptedRawHashes', [])) == len(set(proof.get('acceptedRawHashes', []))) == 994
                and digest(proof['acceptedRawHashes']) == '6181abce7208923fe09ccdcac9b6903a4dc17d71a829cbbf35faa9e173650900'
                and digest(proof['rejectedHistoricalPrefixes']) == '403d7c918d67e3d9eb3a70fa8476df389af33a7bbea1af81ac2c33dae0ed4f76'
                and wired.get('schema') == 'sg-ag-wms-cooljewels-codec-replay-v1'
                and wired.get('evidenceHash') == digest(unsigned) == '57c2d3bcb0de054d955556bcc88fc7c07e1757d848e610162a2d192ebb064a2b'
                and wired.get('actualRecordAndVerifyIpc') is True and wired.get('independentJsPythonFields') is True
                and wired.get('sourceRequests') == wired.get('mongoWrites') == wired.get('failedOrHistoricalRoundsCredited') == 0,
                'ROLLING_WMS_PLAN_SCOPE')
    if plan['adapter'] == 'crystalforest-base-wms-v1':
        from crystalforest_base_fields import SOURCE, TYPE_PROFILE, mapping_hash
        wired = proof.get('wiringEvidence', {})
        unsigned = {k:v for k,v in wired.items() if k != 'evidenceHash'}
        require(plan['gameId'] == 32759 and plan['runtimeGameId'] == 32981 and plan['runtimeSlug'] == 'crystalforest'
                and plan['sourceKey'] == SOURCE and plan['betRaw'] == 25 and plan['maxSteps'] == 2
                and plan.get('wmsGameId') == 20142 and 'requestParams' not in plan and 'wmsChoiceCount' not in plan
                and proof.get('sampledRounds') == 1000 and proof.get('acceptedBaseRounds') == 1000 and proof.get('acceptedFreeRounds') == 0
                and proof.get('rejectedFeatureRounds') == len(proof.get('rejectedHistoricalPrefixes', [])) == 0
                and proof.get('unhandledHistoricalVariants') == {}
                and proof['historyFileSha256'] == TYPE_PROFILE['evidence']['historyFileSha256']
                and proof.get('typeMappingHash') == mapping_hash() and proof.get('independentJsPythonFields') is True
                and proof.get('actualRecordAndVerifyIpc') is True
                and len(proof.get('acceptedRawHashes', [])) == len(set(proof.get('acceptedRawHashes', []))) == 1000
                and digest(proof['acceptedRawHashes']) == 'ab70ba240eabed1d50da636c4d5749313401da9554d26756af6ce0de2a8bc0c4'
                and digest(proof['rejectedHistoricalPrefixes']) == '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945'
                and wired.get('schema') == 'sg-ag-wms-crystalforest-codec-replay-v1'
                and wired.get('evidenceHash') == digest(unsigned) == '2e397148a3d90fd4df4fb9ddbd52b3ccfbef54235168b92159de3689663cc3c9'
                and wired.get('actualRecordAndVerifyIpc') is True and wired.get('independentJsPythonFields') is True
                and wired.get('sourceRequests') == wired.get('mongoWrites') == wired.get('failedOrHistoricalRoundsCredited') == 0,
                'ROLLING_WMS_PLAN_SCOPE')
    if plan['adapter'] == 'dancingdrums-base-wms-v1':
        from dancingdrums_base_fields import SOURCE, TYPE_PROFILE, mapping_hash
        wired = proof.get('wiringEvidence', {})
        unsigned = {k:v for k,v in wired.items() if k != 'evidenceHash'}
        require(plan['gameId'] == 32760 and plan['runtimeGameId'] == 32982 and plan['runtimeSlug'] == 'dancingdrums'
                and plan['sourceKey'] == SOURCE and plan['betRaw'] == 528 and plan['maxSteps'] == 2
                and plan.get('wmsGameId') == 20207 and 'requestParams' not in plan and 'wmsChoiceCount' not in plan
                and proof.get('sampledRounds') == 1000 and proof.get('acceptedBaseRounds') == 993 and proof.get('acceptedFreeRounds') == 0
                and proof.get('rejectedFeatureRounds') == len(proof.get('rejectedHistoricalPrefixes', [])) == 7
                and proof.get('unhandledHistoricalVariants') == {'DANCINGDRUMS_FEATURE_NOT_ADAPTED':7}
                and proof['historyFileSha256'] == TYPE_PROFILE['evidence']['historyFileSha256']
                and proof.get('typeMappingHash') == mapping_hash() and proof.get('independentJsPythonFields') is True
                and proof.get('actualRecordAndVerifyIpc') is True
                and len(proof.get('acceptedRawHashes', [])) == len(set(proof.get('acceptedRawHashes', []))) == 993
                and digest(proof['acceptedRawHashes']) == '58f07d89ee8c900c0c61f9b10c5da32b488f22b56ed96f24ff765cb27c068de5'
                and digest(proof['rejectedHistoricalPrefixes']) == '420f4d29d1445b59b0cd4b8a0259c49fc81f9ae644de7e60b6d4c3460e6e6bab'
                and wired.get('schema') == 'sg-ag-wms-dancingdrums-codec-replay-v1'
                and wired.get('evidenceHash') == digest(unsigned) == '943aa922f6af1a44d6d0bccb9919f957b655555a80b6c5a186b4e5030dd9c6f1'
                and wired.get('actualRecordAndVerifyIpc') is True and wired.get('independentJsPythonFields') is True
                and wired.get('sourceRequests') == wired.get('mongoWrites') == wired.get('failedOrHistoricalRoundsCredited') == 0,
                'ROLLING_WMS_PLAN_SCOPE')
    if plan['adapter'] == 'drumsexplosion-base-wms-v1':
        from drumsexplosion_base_fields import SOURCE, TYPE_PROFILE, mapping_hash
        wired = proof.get('wiringEvidence', {})
        unsigned = {k:v for k,v in wired.items() if k != 'evidenceHash'}
        require(plan['gameId'] == 32761 and plan['runtimeGameId'] == 32983 and plan['runtimeSlug'] == 'dancingdrumsexplosion'
                and plan['sourceKey'] == SOURCE and plan['betRaw'] == 176 and plan['maxSteps'] == 2
                and plan.get('wmsGameId') == 20454 and 'requestParams' not in plan and 'wmsChoiceCount' not in plan
                and proof.get('sampledRounds') == 1000 and proof.get('acceptedBaseRounds') == 994 and proof.get('acceptedFreeRounds') == 0
                and proof.get('rejectedFeatureRounds') == len(proof.get('rejectedHistoricalPrefixes', [])) == 6
                and proof.get('unhandledHistoricalVariants') == {'DRUMSEXPLOSION_FEATURE_NOT_ADAPTED':6}
                and proof['historyFileSha256'] == TYPE_PROFILE['evidence']['historyFileSha256']
                and proof.get('typeMappingHash') == mapping_hash() and proof.get('independentJsPythonFields') is True
                and proof.get('actualRecordAndVerifyIpc') is True
                and len(proof.get('acceptedRawHashes', [])) == len(set(proof.get('acceptedRawHashes', []))) == 994
                and digest(proof['acceptedRawHashes']) == 'edcc885aab8dbf39ff81cdf890cd39b73327e5e342bb74ecd1c11231b86e0648'
                and digest(proof['rejectedHistoricalPrefixes']) == 'aefca1518f0f1344c69fd78f421ceb59c2c99d367bc3f6c387e21de4d9de9224'
                and wired.get('schema') == 'sg-ag-wms-drumsexplosion-codec-replay-v1'
                and wired.get('evidenceHash') == digest(unsigned) == '728c3901b05dbd8751be1f24598a8aa14ddcb536a219eadcb34cff3e0c8189b6'
                and wired.get('actualRecordAndVerifyIpc') is True and wired.get('independentJsPythonFields') is True
                and wired.get('sourceRequests') == wired.get('mongoWrites') == wired.get('failedOrHistoricalRoundsCredited') == 0,
                'ROLLING_WMS_PLAN_SCOPE')
    if plan['adapter'] == 'desertcats-base-wms-v1':
        from desertcats_base_fields import SOURCE, TYPE_PROFILE, mapping_hash
        wired = proof.get('wiringEvidence', {})
        unsigned = {k:v for k,v in wired.items() if k != 'evidenceHash'}
        require(plan['gameId'] == 32762 and plan['runtimeGameId'] == 32984 and plan['runtimeSlug'] == 'desertcats'
                and plan['sourceKey'] == SOURCE and plan['betRaw'] == 200 and plan['maxSteps'] == 2
                and plan.get('wmsGameId') == 20315 and 'requestParams' not in plan and 'wmsChoiceCount' not in plan
                and proof.get('sampledRounds') == 1000 and proof.get('acceptedBaseRounds') == 1000 and proof.get('acceptedFreeRounds') == 0
                and proof.get('rejectedFeatureRounds') == len(proof.get('rejectedHistoricalPrefixes', [])) == 0
                and proof.get('unhandledHistoricalVariants') == {}
                and proof['historyFileSha256'] == TYPE_PROFILE['evidence']['historyFileSha256']
                and proof.get('typeMappingHash') == mapping_hash() and proof.get('independentJsPythonFields') is True
                and proof.get('actualRecordAndVerifyIpc') is True
                and len(proof.get('acceptedRawHashes', [])) == len(set(proof.get('acceptedRawHashes', []))) == 1000
                and digest(proof['acceptedRawHashes']) == '24a6b035b83445edaf109bdd4c041a8dcf4c8f43538fadc693cf0a8f1bf7ca42'
                and digest(proof['rejectedHistoricalPrefixes']) == '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945'
                and wired.get('schema') == 'sg-ag-wms-desertcats-codec-replay-v1'
                and wired.get('evidenceHash') == digest(unsigned) == '5f3ac11b308a2b161b5f8177be79583e0e4e2069e608367ac6b27b2d32760ea1'
                and wired.get('actualRecordAndVerifyIpc') is True and wired.get('independentJsPythonFields') is True
                and wired.get('sourceRequests') == wired.get('mongoWrites') == wired.get('failedOrHistoricalRoundsCredited') == 0,
                'ROLLING_WMS_PLAN_SCOPE')
    if plan['adapter'] == 'jekyll-base-wms-v1':
        from jekyll_base_fields import SOURCE, TYPE_PROFILE, mapping_hash
        wired = proof.get('wiringEvidence', {})
        unsigned = {k:v for k,v in wired.items() if k != 'evidenceHash'}
        require(plan['gameId'] == 32763 and plan['runtimeGameId'] == 32985 and plan['runtimeSlug'] == 'drjekyllgoeswild'
                and plan['sourceKey'] == SOURCE and plan['betRaw'] == 100 and plan['maxSteps'] == 2
                and plan.get('wmsGameId') == 20126 and 'requestParams' not in plan and 'wmsChoiceCount' not in plan
                and proof.get('sampledRounds') == 1000 and proof.get('acceptedBaseRounds') == 554 and proof.get('acceptedFreeRounds') == 0
                and proof.get('rejectedFeatureRounds') == len(proof.get('rejectedHistoricalPrefixes', [])) == 446
                and proof.get('unhandledHistoricalVariants') == {'JEKYLL_FEATURE_NOT_ADAPTED':446}
                and proof['historyFileSha256'] == TYPE_PROFILE['evidence']['historyFileSha256']
                and proof.get('typeMappingHash') == mapping_hash() and proof.get('independentJsPythonFields') is True
                and proof.get('actualRecordAndVerifyIpc') is True
                and len(proof.get('acceptedRawHashes', [])) == len(set(proof.get('acceptedRawHashes', []))) == 554
                and digest(proof['acceptedRawHashes']) == '1663972cecb848738d0c3ddcbdc50a43bbb0484993ed8e0a65b108268c756928'
                and digest(proof['rejectedHistoricalPrefixes']) == '3407ba0442661370a4e6aaddd33bb883556097b44b37861c8bb9d02de4fa7688'
                and wired.get('schema') == 'sg-ag-wms-jekyll-codec-replay-v1'
                and wired.get('evidenceHash') == digest(unsigned) == '3e38781c3421decae28514275496d374792d3b6771a623974786232b66c9efe2'
                and wired.get('actualRecordAndVerifyIpc') is True and wired.get('independentJsPythonFields') is True
                and wired.get('sourceRequests') == wired.get('mongoWrites') == wired.get('failedOrHistoricalRoundsCredited') == 0,
                'ROLLING_WMS_PLAN_SCOPE')
    if plan['adapter'] == 'dragonspin-base-wms-v1':
        from dragonspin_base_fields import SOURCE, TYPE_PROFILE, mapping_hash
        wired = proof.get('wiringEvidence', {})
        unsigned = {k:v for k,v in wired.items() if k != 'evidenceHash'}
        require(plan['gameId'] == 32764 and plan['runtimeGameId'] == 32986 and plan['runtimeSlug'] == 'dragonspin'
                and plan['sourceKey'] == SOURCE and plan['betRaw'] == 210 and plan['maxSteps'] == 2
                and plan.get('wmsGameId') == 20117 and 'requestParams' not in plan and 'wmsChoiceCount' not in plan
                and proof.get('sampledRounds') == 1000 and proof.get('acceptedBaseRounds') == 1000 and proof.get('acceptedFreeRounds') == 0
                and proof.get('rejectedFeatureRounds') == len(proof.get('rejectedHistoricalPrefixes', [])) == 0
                and proof.get('unhandledHistoricalVariants') == {}
                and proof['historyFileSha256'] == TYPE_PROFILE['evidence']['historyFileSha256']
                and proof.get('typeMappingHash') == mapping_hash() and proof.get('independentJsPythonFields') is True
                and proof.get('actualRecordAndVerifyIpc') is True
                and len(proof.get('acceptedRawHashes', [])) == len(set(proof.get('acceptedRawHashes', []))) == 1000
                and digest(proof['acceptedRawHashes']) == '8038fd0d95c50627029ef428d96a6b360c17772a841655d4bb6cd2c5d24a3aee'
                and digest(proof['rejectedHistoricalPrefixes']) == '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945'
                and wired.get('schema') == 'sg-ag-wms-dragonspin-codec-replay-v1'
                and wired.get('evidenceHash') == digest(unsigned) == '414a6f8482900114ded4c1459d53cf2e46c1249230fdda843a8cbfb3bc965086'
                and wired.get('actualRecordAndVerifyIpc') is True and wired.get('independentJsPythonFields') is True
                and wired.get('sourceRequests') == wired.get('mongoWrites') == wired.get('failedOrHistoricalRoundsCredited') == 0,
                'ROLLING_WMS_PLAN_SCOPE')
    if plan['adapter'] == 'deepseamagic-base-wms-v1':
        from deepseamagic_base_fields import SOURCE, TYPE_PROFILE, mapping_hash
        wired = proof.get('wiringEvidence', {})
        unsigned = {k:v for k,v in wired.items() if k != 'evidenceHash'}
        require(plan['gameId'] == 32765 and plan['runtimeGameId'] == 32987 and plan['runtimeSlug'] == 'dropandlockdeepseamagic'
                and plan['sourceKey'] == SOURCE and plan['betRaw'] == 200 and plan['maxSteps'] == 2
                and plan.get('wmsGameId') == 20412 and 'requestParams' not in plan and 'wmsChoiceCount' not in plan
                and proof.get('sampledRounds') == 1000 and proof.get('acceptedBaseRounds') == 991 and proof.get('acceptedFreeRounds') == 0
                and proof.get('rejectedFeatureRounds') == len(proof.get('rejectedHistoricalPrefixes', [])) == 9
                and proof.get('unhandledHistoricalVariants') == {'DEEPSEAMAGIC_FEATURE_NOT_ADAPTED':9}
                and proof['historyFileSha256'] == TYPE_PROFILE['evidence']['historyFileSha256']
                and proof.get('typeMappingHash') == mapping_hash() and proof.get('independentJsPythonFields') is True
                and proof.get('actualRecordAndVerifyIpc') is True
                and len(proof.get('acceptedRawHashes', [])) == len(set(proof.get('acceptedRawHashes', []))) == 991
                and digest(proof['acceptedRawHashes']) == 'd056d3f9dae2344c69c2ada6213053d3f61b0f3cd4b9187f87d47decae08d802'
                and digest(proof['rejectedHistoricalPrefixes']) == 'cfd4b1caff8d177994daf9e0d0130621de1bdada126a265f200e9a9188d1ee11'
                and wired.get('schema') == 'sg-ag-wms-deepseamagic-codec-replay-v1'
                and wired.get('evidenceHash') == digest(unsigned) == 'b9bca620de9a3eb8a21712199e3e382bbb746a3ab779193af342bf083ef5ed16'
                and wired.get('actualRecordAndVerifyIpc') is True and wired.get('independentJsPythonFields') is True
                and wired.get('sourceRequests') == wired.get('mongoWrites') == wired.get('failedOrHistoricalRoundsCredited') == 0,
                'ROLLING_WMS_PLAN_SCOPE')
    if plan['adapter'] == 'eurekablast-base-wms-v1':
        from eurekablast_base_fields import SOURCE, TYPE_PROFILE, mapping_hash
        wired = proof.get('wiringEvidence', {})
        unsigned = {k:v for k,v in wired.items() if k != 'evidenceHash'}
        require(plan['gameId'] == 32766 and plan['runtimeGameId'] == 32988 and plan['runtimeSlug'] == 'eurekareelsblastsuperlock'
                and plan['sourceKey'] == SOURCE and plan['betRaw'] == 50 and plan['maxSteps'] == 2
                and plan.get('wmsGameId') == 20400 and 'requestParams' not in plan and 'wmsChoiceCount' not in plan
                and proof.get('sampledRounds') == 1000 and proof.get('acceptedBaseRounds') == 975 and proof.get('acceptedFreeRounds') == 0
                and proof.get('rejectedFeatureRounds') == len(proof.get('rejectedHistoricalPrefixes', [])) == 25
                and proof.get('unhandledHistoricalVariants') == {'EUREKABLAST_FEATURE_NOT_ADAPTED':25}
                and proof['historyFileSha256'] == TYPE_PROFILE['evidence']['historyFileSha256']
                and proof.get('typeMappingHash') == mapping_hash() and proof.get('independentJsPythonFields') is True
                and proof.get('actualRecordAndVerifyIpc') is True
                and len(proof.get('acceptedRawHashes', [])) == len(set(proof.get('acceptedRawHashes', []))) == 975
                and digest(proof['acceptedRawHashes']) == 'b0fa189d3a7dd18765516097c0412d0cc4de55de64805ae41e795b4e331a0680'
                and digest(proof['rejectedHistoricalPrefixes']) == '3551b3398b85376f2630d2dac6c8792db80ee88845fd0095f8ee409d1c5b2ac9'
                and wired.get('schema') == 'sg-ag-wms-eurekablast-codec-replay-v1'
                and wired.get('evidenceHash') == digest(unsigned) == '4bb9796bd007a35b9fb5289d8c45450bfe2db23f7270f7bb44185371482041a3'
                and wired.get('actualRecordAndVerifyIpc') is True and wired.get('independentJsPythonFields') is True
                and wired.get('sourceRequests') == wired.get('mongoWrites') == wired.get('failedOrHistoricalRoundsCredited') == 0,
                'ROLLING_WMS_PLAN_SCOPE')
    if plan['adapter'] == 'firequeen-base-wms-v1':
        from firequeen_base_fields import SOURCE, TYPE_PROFILE, mapping_hash
        wired = proof.get('wiringEvidence', {})
        unsigned = {k:v for k,v in wired.items() if k != 'evidenceHash'}
        require(plan['gameId'] == 32767 and plan['runtimeGameId'] == 32989 and plan['runtimeSlug'] == 'firequeen_prt'
                and plan['sourceKey'] == SOURCE and plan['betRaw'] == 50 and plan['maxSteps'] == 2
                and plan.get('wmsGameId') == 20192 and 'requestParams' not in plan and 'wmsChoiceCount' not in plan
                and proof.get('sampledRounds') == 1000 and proof.get('acceptedBaseRounds') == 989 and proof.get('acceptedFreeRounds') == 0
                and proof.get('rejectedFeatureRounds') == len(proof.get('rejectedHistoricalPrefixes', [])) == 11
                and proof.get('unhandledHistoricalVariants') == {'FIREQUEEN_FEATURE_NOT_ADAPTED':11}
                and proof['historyFileSha256'] == TYPE_PROFILE['evidence']['historyFileSha256']
                and proof.get('typeMappingHash') == mapping_hash() and proof.get('independentJsPythonFields') is True
                and proof.get('actualRecordAndVerifyIpc') is True
                and len(proof.get('acceptedRawHashes', [])) == len(set(proof.get('acceptedRawHashes', []))) == 989
                and digest(proof['acceptedRawHashes']) == 'f631cd5a9ca09e19db64957053e99722e4ff3dc6f022cf71b237ee1bdf2dc9d7'
                and digest(proof['rejectedHistoricalPrefixes']) == 'de21852c02ae17916017f2d3dd01bd4aa176a77cc279d9ac0518273d6342d536'
                and wired.get('schema') == 'sg-ag-wms-firequeen-codec-replay-v1'
                and wired.get('evidenceHash') == digest(unsigned) == '7d3d50a9307e9e40ce61abf44061b3283c9926cfe04efb28c0cf1e461d1454b8'
                and wired.get('actualRecordAndVerifyIpc') is True and wired.get('independentJsPythonFields') is True
                and wired.get('sourceRequests') == wired.get('mongoWrites') == wired.get('failedOrHistoricalRoundsCredited') == 0,
                'ROLLING_WMS_PLAN_SCOPE')
    if plan['adapter'] == 'frozeninferno-base-wms-v1':
        from frozeninferno_base_fields import SOURCE, TYPE_PROFILE, mapping_hash
        wired = proof.get('wiringEvidence', {})
        unsigned = {k:v for k,v in wired.items() if k != 'evidenceHash'}
        require(plan['gameId'] == 32768 and plan['runtimeGameId'] == 32990 and plan['runtimeSlug'] == 'frozeninferno'
                and plan['sourceKey'] == SOURCE and plan['betRaw'] == 5000 and plan['maxSteps'] == 2
                and plan.get('wmsGameId') == 20090 and 'requestParams' not in plan and 'wmsChoiceCount' not in plan
                and proof.get('sampledRounds') == 1000 and proof.get('acceptedBaseRounds') == 677 and proof.get('acceptedFreeRounds') == 0
                and proof.get('rejectedFeatureRounds') == len(proof.get('rejectedHistoricalPrefixes', [])) == 323
                and proof.get('unhandledHistoricalVariants') == {'FROZENINFERNO_FEATURE_NOT_ADAPTED':323}
                and proof['historyFileSha256'] == TYPE_PROFILE['evidence']['historyFileSha256']
                and proof.get('typeMappingHash') == mapping_hash() and proof.get('independentJsPythonFields') is True
                and proof.get('actualRecordAndVerifyIpc') is True
                and len(proof.get('acceptedRawHashes', [])) == len(set(proof.get('acceptedRawHashes', []))) == 677
                and digest(proof['acceptedRawHashes']) == '02298c89c3d626c560496cfe3b826029a906c1512fdb90dd6b48ad0c05376206'
                and digest(proof['rejectedHistoricalPrefixes']) == '5e2cf33aae6853112804beb03b6880318f59b4d4b473e789a98a4d71517720b1'
                and wired.get('schema') == 'sg-ag-wms-frozeninferno-codec-replay-v1'
                and wired.get('evidenceHash') == digest(unsigned) == 'e8b217951aec1000081e405a066cbcb21a8387361b5de5b31457bbf9231cb316'
                and wired.get('actualRecordAndVerifyIpc') is True and wired.get('independentJsPythonFields') is True
                and wired.get('sourceRequests') == wired.get('mongoWrites') == wired.get('failedOrHistoricalRoundsCredited') == 0,
                'ROLLING_WMS_PLAN_SCOPE')
    if plan['adapter'] == 'fudaole-base-wms-v1':
        from fudaole_base_fields import SOURCE, TYPE_PROFILE, mapping_hash
        wired = proof.get('wiringEvidence', {})
        unsigned = {k:v for k,v in wired.items() if k != 'evidenceHash'}
        require(plan['gameId'] == 32769 and plan['runtimeGameId'] == 32991 and plan['runtimeSlug'] == 'fudaole'
                and plan['sourceKey'] == SOURCE and plan['betRaw'] == 200 and plan['maxSteps'] == 2
                and plan.get('wmsGameId') == 20135 and 'requestParams' not in plan and 'wmsChoiceCount' not in plan
                and proof.get('sampledRounds') == 1000 and proof.get('acceptedBaseRounds') == 992 and proof.get('acceptedFreeRounds') == 0
                and proof.get('rejectedFeatureRounds') == len(proof.get('rejectedHistoricalPrefixes', [])) == 8
                and proof.get('unhandledHistoricalVariants') == {'FUDAOLE_FEATURE_NOT_ADAPTED':8}
                and proof['historyFileSha256'] == TYPE_PROFILE['evidence']['historyFileSha256']
                and proof.get('typeMappingHash') == mapping_hash() and proof.get('independentJsPythonFields') is True
                and proof.get('actualRecordAndVerifyIpc') is True
                and len(proof.get('acceptedRawHashes', [])) == len(set(proof.get('acceptedRawHashes', []))) == 992
                and digest(proof['acceptedRawHashes']) == 'e4c2043acdc32d5be713b27a219f44e3ed5082ef120b925be347109f0e5e3958'
                and digest(proof['rejectedHistoricalPrefixes']) == 'd0a78daa632762a111eecd99ffd34189d264f6b1240fdb8eecb30a9a5d29ef54'
                and wired.get('schema') == 'sg-ag-wms-fudaole-codec-replay-v1'
                and wired.get('evidenceHash') == digest(unsigned) == '609954af45d08075c44296ae139e56abf02acf5557e8d1d177dbf8da9cdf85a7'
                and wired.get('actualRecordAndVerifyIpc') is True and wired.get('independentJsPythonFields') is True
                and wired.get('sourceRequests') == wired.get('mongoWrites') == wired.get('failedOrHistoricalRoundsCredited') == 0,
                'ROLLING_WMS_PLAN_SCOPE')
    if plan['adapter'] == 'giantsgold-base-wms-v1':
        from giantsgold_base_fields import SOURCE, TYPE_PROFILE, mapping_hash
        wired = proof.get('wiringEvidence', {})
        unsigned = {k:v for k,v in wired.items() if k != 'evidenceHash'}
        require(plan['gameId'] == 32770 and plan['runtimeGameId'] == 32992 and plan['runtimeSlug'] == 'giantsgold_prt'
                and plan['sourceKey'] == SOURCE and plan['betRaw'] == 50 and plan['maxSteps'] == 2
                and plan.get('wmsGameId') == 20129 and 'requestParams' not in plan and 'wmsChoiceCount' not in plan
                and proof.get('sampledRounds') == 1000 and proof.get('acceptedBaseRounds') == 1000 and proof.get('acceptedFreeRounds') == 0
                and proof.get('rejectedFeatureRounds') == len(proof.get('rejectedHistoricalPrefixes', [])) == 0
                and proof.get('unhandledHistoricalVariants') == {}
                and proof['historyFileSha256'] == TYPE_PROFILE['evidence']['historyFileSha256']
                and proof.get('typeMappingHash') == mapping_hash() and proof.get('independentJsPythonFields') is True
                and proof.get('actualRecordAndVerifyIpc') is True
                and len(proof.get('acceptedRawHashes', [])) == len(set(proof.get('acceptedRawHashes', []))) == 1000
                and digest(proof['acceptedRawHashes']) == 'd9a571b651abd221fd1ea404b444821abb93ca738572c859b4eed7a4b160bfae'
                and digest(proof['rejectedHistoricalPrefixes']) == '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945'
                and wired.get('schema') == 'sg-ag-wms-giantsgold-codec-replay-v1'
                and wired.get('evidenceHash') == digest(unsigned) == '2c5817d7c7ff532f60a257bf4a77181db2758a1091541d5c03607c0f96c64075'
                and wired.get('actualRecordAndVerifyIpc') is True and wired.get('independentJsPythonFields') is True
                and wired.get('sourceRequests') == wired.get('mongoWrites') == wired.get('failedOrHistoricalRoundsCredited') == 0,
                'ROLLING_WMS_PLAN_SCOPE')
    if plan['adapter'] == 'goldenchief-base-wms-v1':
        from goldenchief_base_fields import SOURCE, TYPE_PROFILE, mapping_hash
        wired = proof.get('wiringEvidence', {})
        unsigned = {k:v for k,v in wired.items() if k != 'evidenceHash'}
        require(plan['gameId'] == 32771 and plan['runtimeGameId'] == 32993 and plan['runtimeSlug'] == 'goldenchief'
                and plan['sourceKey'] == SOURCE and plan['betRaw'] == 100 and plan['maxSteps'] == 2
                and plan.get('wmsGameId') == 20125 and 'requestParams' not in plan and 'wmsChoiceCount' not in plan
                and proof.get('sampledRounds') == 1000 and proof.get('acceptedBaseRounds') == 987 and proof.get('acceptedFreeRounds') == 0
                and proof.get('rejectedFeatureRounds') == len(proof.get('rejectedHistoricalPrefixes', [])) == 13
                and proof.get('unhandledHistoricalVariants') == {'GOLDENCHIEF_FEATURE_NOT_ADAPTED':13}
                and proof['historyFileSha256'] == TYPE_PROFILE['evidence']['historyFileSha256']
                and proof.get('typeMappingHash') == mapping_hash() and proof.get('independentJsPythonFields') is True
                and proof.get('actualRecordAndVerifyIpc') is True
                and len(proof.get('acceptedRawHashes', [])) == len(set(proof.get('acceptedRawHashes', []))) == 987
                and digest(proof['acceptedRawHashes']) == '75f02ff9edcc86e031ba1564af79546494822bf1822c40d639864ddd09417b10'
                and digest(proof['rejectedHistoricalPrefixes']) == 'a389ca5bb3978c81a104b096dbd25f3e6c866b14fd8d0e068b25ac958cb05352'
                and wired.get('schema') == 'sg-ag-wms-goldenchief-codec-replay-v1'
                and wired.get('evidenceHash') == digest(unsigned) == 'cfb27dcf552e5f6421dac8cbfb8ec1fc2a17d0fd51c82f147bfcbbe302f480af'
                and wired.get('actualRecordAndVerifyIpc') is True and wired.get('independentJsPythonFields') is True
                and wired.get('sourceRequests') == wired.get('mongoWrites') == wired.get('failedOrHistoricalRoundsCredited') == 0,
                'ROLLING_WMS_PLAN_SCOPE')
    if plan['adapter'] == 'heidibier-base-wms-v1':
        from heidibier_base_fields import SOURCE, TYPE_PROFILE, mapping_hash
        wired = proof.get('wiringEvidence', {})
        unsigned = {k:v for k,v in wired.items() if k != 'evidenceHash'}
        require(plan['gameId'] == 32772 and plan['runtimeGameId'] == 32994 and plan['runtimeSlug'] == 'heidisbierhaus'
                and plan['sourceKey'] == SOURCE and plan['betRaw'] == 75 and plan['maxSteps'] == 2
                and plan.get('wmsGameId') == 20157 and 'requestParams' not in plan and 'wmsChoiceCount' not in plan
                and proof.get('sampledRounds') == 1000 and proof.get('acceptedBaseRounds') == 986 and proof.get('acceptedFreeRounds') == 0
                and proof.get('rejectedFeatureRounds') == len(proof.get('rejectedHistoricalPrefixes', [])) == 14
                and proof.get('unhandledHistoricalVariants') == {'HEIDIBIER_FEATURE_NOT_ADAPTED':14}
                and proof['historyFileSha256'] == TYPE_PROFILE['evidence']['historyFileSha256']
                and proof.get('typeMappingHash') == mapping_hash() and proof.get('independentJsPythonFields') is True
                and proof.get('actualRecordAndVerifyIpc') is True
                and len(proof.get('acceptedRawHashes', [])) == len(set(proof.get('acceptedRawHashes', []))) == 986
                and digest(proof['acceptedRawHashes']) == '4cc50f76a59495d6b91d7ffeeb9bf31bc73a69c945240e4e2cb6b136f7834954'
                and digest(proof['rejectedHistoricalPrefixes']) == 'c0d5b3a90044077bb6fdba8b9a9b8aa61f6d1475a634f5e432b1757eb71d2767'
                and wired.get('schema') == 'sg-ag-wms-heidibier-codec-replay-v1'
                and wired.get('evidenceHash') == digest(unsigned) == 'e340886f22c1f9247371717f8259d25e5722da03a6838ac8ada6181cd86775c0'
                and wired.get('actualRecordAndVerifyIpc') is True and wired.get('independentJsPythonFields') is True
                and wired.get('sourceRequests') == wired.get('mongoWrites') == wired.get('failedOrHistoricalRoundsCredited') == 0,
                'ROLLING_WMS_PLAN_SCOPE')
    if plan['adapter'] == 'hercules-base-wms-v1':
        from hercules_base_fields import SOURCE, TYPE_PROFILE, mapping_hash
        wired = proof.get('wiringEvidence', {})
        unsigned = {k:v for k,v in wired.items() if k != 'evidenceHash'}
        require(plan['gameId'] == 32773 and plan['runtimeGameId'] == 32995 and plan['runtimeSlug'] == 'herculeshighandmighty'
                and plan['sourceKey'] == SOURCE and plan['betRaw'] == 100 and plan['maxSteps'] == 2
                and plan.get('wmsGameId') == 20102 and 'requestParams' not in plan and 'wmsChoiceCount' not in plan
                and proof.get('sampledRounds') == 1000 and proof.get('acceptedBaseRounds') == 1000 and proof.get('acceptedFreeRounds') == 0
                and proof.get('rejectedFeatureRounds') == len(proof.get('rejectedHistoricalPrefixes', [])) == 0
                and proof.get('unhandledHistoricalVariants') == {}
                and proof['historyFileSha256'] == TYPE_PROFILE['evidence']['historyFileSha256']
                and proof.get('typeMappingHash') == mapping_hash() and proof.get('independentJsPythonFields') is True
                and proof.get('actualRecordAndVerifyIpc') is True
                and len(proof.get('acceptedRawHashes', [])) == len(set(proof.get('acceptedRawHashes', []))) == 1000
                and digest(proof['acceptedRawHashes']) == 'a2210a830d6d80f983f7612b13fb89c52b5a5ce920bfdffb7efea6bddcd59418'
                and digest(proof['rejectedHistoricalPrefixes']) == '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945'
                and wired.get('schema') == 'sg-ag-wms-hercules-codec-replay-v1'
                and wired.get('evidenceHash') == digest(unsigned) == 'be18571fa7973496aa2ff8c4ba4dd1256e4184f350db6a9cf14ba4792a56d0d3'
                and wired.get('actualRecordAndVerifyIpc') is True and wired.get('independentJsPythonFields') is True
                and wired.get('sourceRequests') == wired.get('mongoWrites') == wired.get('failedOrHistoricalRoundsCredited') == 0,
                'ROLLING_WMS_PLAN_SCOPE')
    if plan['adapter'] == 'himalayas-base-wms-v1':
        from himalayas_base_fields import SOURCE, TYPE_PROFILE, mapping_hash
        wired = proof.get('wiringEvidence', {})
        unsigned = {k:v for k,v in wired.items() if k != 'evidenceHash'}
        require(plan['gameId'] == 32774 and plan['runtimeGameId'] == 32996 and plan['runtimeSlug'] == 'himalayas'
                and plan['sourceKey'] == SOURCE and plan['betRaw'] == 200 and plan['maxSteps'] == 2
                and plan.get('wmsGameId') == 20230 and 'requestParams' not in plan and 'wmsChoiceCount' not in plan
                and proof.get('sampledRounds') == 1000 and proof.get('acceptedBaseRounds') == 1000 and proof.get('acceptedFreeRounds') == 0
                and proof.get('rejectedFeatureRounds') == len(proof.get('rejectedHistoricalPrefixes', [])) == 0
                and proof.get('unhandledHistoricalVariants') == {}
                and proof['historyFileSha256'] == TYPE_PROFILE['evidence']['historyFileSha256']
                and proof.get('typeMappingHash') == mapping_hash() and proof.get('independentJsPythonFields') is True
                and proof.get('actualRecordAndVerifyIpc') is True
                and len(proof.get('acceptedRawHashes', [])) == len(set(proof.get('acceptedRawHashes', []))) == 1000
                and digest(proof['acceptedRawHashes']) == '6ac59c1b08907c86280c9be559e2aa949f9ecdd87ca0376c365a81f5863efb30'
                and digest(proof['rejectedHistoricalPrefixes']) == '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945'
                and wired.get('schema') == 'sg-ag-wms-himalayas-codec-replay-v1'
                and wired.get('evidenceHash') == digest(unsigned) == '86c01319d2a62a1d876577d4ac9a0dd877462e7291064d41e69ffb817ab31f75'
                and wired.get('actualRecordAndVerifyIpc') is True and wired.get('independentJsPythonFields') is True
                and wired.get('sourceRequests') == wired.get('mongoWrites') == wired.get('failedOrHistoricalRoundsCredited') == 0,
                'ROLLING_WMS_PLAN_SCOPE')
    if plan['adapter'] == 'hulahula-base-wms-v1':
        from hulahula_base_fields import SOURCE, TYPE_PROFILE, mapping_hash
        wired = proof.get('wiringEvidence', {})
        unsigned = {k:v for k,v in wired.items() if k != 'evidenceHash'}
        require(plan['gameId'] == 32775 and plan['runtimeGameId'] == 32997 and plan['runtimeSlug'] == 'hulahulanights'
                and plan['sourceKey'] == SOURCE and plan['betRaw'] == 100 and plan['maxSteps'] == 2
                and plan.get('wmsGameId') == 20188 and 'requestParams' not in plan and 'wmsChoiceCount' not in plan
                and proof.get('sampledRounds') == 1000 and proof.get('acceptedBaseRounds') == 1000 and proof.get('acceptedFreeRounds') == 0
                and proof.get('rejectedFeatureRounds') == len(proof.get('rejectedHistoricalPrefixes', [])) == 0
                and proof.get('unhandledHistoricalVariants') == {}
                and proof['historyFileSha256'] == TYPE_PROFILE['evidence']['historyFileSha256']
                and proof.get('typeMappingHash') == mapping_hash() and proof.get('independentJsPythonFields') is True
                and proof.get('actualRecordAndVerifyIpc') is True
                and len(proof.get('acceptedRawHashes', [])) == len(set(proof.get('acceptedRawHashes', []))) == 1000
                and digest(proof['acceptedRawHashes']) == 'cf277592d198f951cfe1e19c67e8e5f948cfb38860032b26f63d5754b55b9656'
                and digest(proof['rejectedHistoricalPrefixes']) == '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945'
                and wired.get('schema') == 'sg-ag-wms-hulahula-codec-replay-v1'
                and wired.get('evidenceHash') == digest(unsigned) == 'dff2f749138bac400c7215fec552db0209e0fc8ad103bba9ae6134cbd983128b'
                and wired.get('actualRecordAndVerifyIpc') is True and wired.get('independentJsPythonFields') is True
                and wired.get('sourceRequests') == wired.get('mongoWrites') == wired.get('failedOrHistoricalRoundsCredited') == 0,
                'ROLLING_WMS_PLAN_SCOPE')
    if plan['adapter'] == 'moolah-base-wms-v1':
        from moolah_base_fields import SOURCE, TYPE_PROFILE, mapping_hash
        wired = proof.get('wiringEvidence', {})
        unsigned = {k:v for k,v in wired.items() if k != 'evidenceHash'}
        require(plan['gameId'] == 32776 and plan['runtimeGameId'] == 32998 and plan['runtimeSlug'] == 'invadersfromplanetmoolah_prt'
                and plan['sourceKey'] == SOURCE and plan['betRaw'] == 25 and plan['maxSteps'] == 2
                and plan.get('wmsGameId') == 20145 and 'requestParams' not in plan and 'wmsChoiceCount' not in plan
                and proof.get('sampledRounds') == 1000 and proof.get('acceptedBaseRounds') == 1000 and proof.get('acceptedFreeRounds') == 0
                and proof.get('rejectedFeatureRounds') == len(proof.get('rejectedHistoricalPrefixes', [])) == 0
                and proof.get('unhandledHistoricalVariants') == {}
                and proof['historyFileSha256'] == TYPE_PROFILE['evidence']['historyFileSha256']
                and proof.get('typeMappingHash') == mapping_hash() and proof.get('independentJsPythonFields') is True
                and proof.get('actualRecordAndVerifyIpc') is True
                and len(proof.get('acceptedRawHashes', [])) == len(set(proof.get('acceptedRawHashes', []))) == 1000
                and digest(proof['acceptedRawHashes']) == '5fe6133786ba967bb38e1ec93ca6b9a7369c0d93afe1e9abd755e4f18207d1fd'
                and digest(proof['rejectedHistoricalPrefixes']) == '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945'
                and wired.get('schema') == 'sg-ag-wms-moolah-codec-replay-v1'
                and wired.get('evidenceHash') == digest(unsigned) == '544e2ca5d5efe9f9aef197cba0742632bfb4a58957647b521b4dfbf3a75ebf47'
                and wired.get('actualRecordAndVerifyIpc') is True and wired.get('independentJsPythonFields') is True
                and wired.get('sourceRequests') == wired.get('mongoWrites') == wired.get('failedOrHistoricalRoundsCredited') == 0,
                'ROLLING_WMS_PLAN_SCOPE')
    if plan['adapter'] == 'jinjimegaways-base-wms-v1':
        from jinjimegaways_base_fields import SOURCE, TYPE_PROFILE, mapping_hash
        wired = proof.get('wiringEvidence', {})
        unsigned = {k:v for k,v in wired.items() if k != 'evidenceHash'}
        require(plan['gameId'] == 32777 and plan['runtimeGameId'] == 32999 and plan['runtimeSlug'] == 'jjbxmegaways'
                and plan['sourceKey'] == SOURCE and plan['betRaw'] == 88 and plan['maxSteps'] == 2
                and plan.get('wmsGameId') == 20468 and 'requestParams' not in plan and 'wmsChoiceCount' not in plan
                and proof.get('sampledRounds') == 1000 and proof.get('acceptedBaseRounds') == 991 and proof.get('acceptedFreeRounds') == 0
                and proof.get('rejectedFeatureRounds') == len(proof.get('rejectedHistoricalPrefixes', [])) == 9
                and proof.get('unhandledHistoricalVariants') == {'JINJIMEGAWAYS_FEATURE_NOT_ADAPTED':9}
                and proof['historyFileSha256'] == TYPE_PROFILE['evidence']['historyFileSha256']
                and proof.get('typeMappingHash') == mapping_hash() and proof.get('independentJsPythonFields') is True
                and proof.get('actualRecordAndVerifyIpc') is True
                and len(proof.get('acceptedRawHashes', [])) == len(set(proof.get('acceptedRawHashes', []))) == 991
                and digest(proof['acceptedRawHashes']) == 'a326ed45dee19b7afdeb3f06a14f3b9d06101169dda7ec696a85b0dcee13fb35'
                and digest(proof['rejectedHistoricalPrefixes']) == '284137d61be9515802fedbff184facc81ccc6917e31092ce56cbad767a0fdcd4'
                and wired.get('schema') == 'sg-ag-wms-jinjimegaways-codec-replay-v1'
                and wired.get('evidenceHash') == digest(unsigned) == 'c5ff0f6c10db5d44e2e8d81fe55a71358c3c72008c361972c79ffbca6ca18448'
                and wired.get('actualRecordAndVerifyIpc') is True and wired.get('independentJsPythonFields') is True
                and wired.get('sourceRequests') == wired.get('mongoWrites') == wired.get('failedOrHistoricalRoundsCredited') == 0,
                'ROLLING_WMS_PLAN_SCOPE')
    if plan['adapter'] == 'jinjitreasure-base-wms-v1':
        from jinjitreasure_base_fields import SOURCE, TYPE_PROFILE, mapping_hash
        wired = proof.get('wiringEvidence', {})
        unsigned = {k:v for k,v in wired.items() if k != 'evidenceHash'}
        require(plan['gameId'] == 32778 and plan['runtimeGameId'] == 33000 and plan['runtimeSlug'] == 'jinjibaoxiendlesstreasure'
                and plan['sourceKey'] == SOURCE and plan['betRaw'] == 16 and plan['maxSteps'] == 2
                and plan.get('wmsGameId') == 20322 and 'requestParams' not in plan and 'wmsChoiceCount' not in plan
                and proof.get('sampledRounds') == 1000 and proof.get('acceptedBaseRounds') == 997 and proof.get('acceptedFreeRounds') == 0
                and proof.get('rejectedFeatureRounds') == len(proof.get('rejectedHistoricalPrefixes', [])) == 3
                and proof.get('unhandledHistoricalVariants') == {'JINJITREASURE_FEATURE_NOT_ADAPTED':2,'JINJITREASURE_CUMULATIVE_WIN_MISMATCH':1}
                and proof['historyFileSha256'] == TYPE_PROFILE['evidence']['historyFileSha256']
                and proof.get('typeMappingHash') == mapping_hash() and proof.get('independentJsPythonFields') is True
                and proof.get('actualRecordAndVerifyIpc') is True
                and len(proof.get('acceptedRawHashes', [])) == len(set(proof.get('acceptedRawHashes', []))) == 997
                and digest(proof['acceptedRawHashes']) == '634b71247fe84206eb72a1392f2386047b851b03ee7397f9488401eaa4a9694d'
                and digest(proof['rejectedHistoricalPrefixes']) == '2e16e2ce04dcf11c3bd45d71750a7d786dcb72c0bb01037aee03b0e3620db820'
                and wired.get('schema') == 'sg-ag-wms-jinjitreasure-codec-replay-v1'
                and wired.get('evidenceHash') == digest(unsigned) == '27e68d59cba9324f5c21a4c468f6e8e2cb77e469e1b77fb2977c22e9212634a0'
                and wired.get('actualRecordAndVerifyIpc') is True and wired.get('independentJsPythonFields') is True
                and wired.get('sourceRequests') == wired.get('mongoWrites') == wired.get('failedOrHistoricalRoundsCredited') == 0,
                'ROLLING_WMS_PLAN_SCOPE')
    if plan['adapter'] == 'jinsedragon-base-wms-v1':
        from jinsedragon_base_fields import SOURCE, TYPE_PROFILE, mapping_hash
        wired = proof.get('wiringEvidence', {})
        unsigned = {k:v for k,v in wired.items() if k != 'evidenceHash'}
        require(plan['gameId'] == 32779 and plan['runtimeGameId'] == 33001 and plan['runtimeSlug'] == 'jinsedaodragon'
                and plan['sourceKey'] == SOURCE and plan['betRaw'] == 100 and plan['maxSteps'] == 2
                and plan.get('wmsGameId') == 20401 and 'requestParams' not in plan and 'wmsChoiceCount' not in plan
                and proof.get('sampledRounds') == 1000 and proof.get('acceptedBaseRounds') == 993 and proof.get('acceptedFreeRounds') == 0
                and proof.get('rejectedFeatureRounds') == len(proof.get('rejectedHistoricalPrefixes', [])) == 7
                and proof.get('unhandledHistoricalVariants') == {'JINSEDRAGON_FEATURE_NOT_ADAPTED':7}
                and proof['historyFileSha256'] == TYPE_PROFILE['evidence']['historyFileSha256']
                and proof.get('typeMappingHash') == mapping_hash() and proof.get('independentJsPythonFields') is True
                and proof.get('actualRecordAndVerifyIpc') is True
                and len(proof.get('acceptedRawHashes', [])) == len(set(proof.get('acceptedRawHashes', []))) == 993
                and digest(proof['acceptedRawHashes']) == '8b3161e42d7784b04475f3fca20e89cda2104edac9451184c8adf50fa727b23e'
                and digest(proof['rejectedHistoricalPrefixes']) == 'a35f46db69fb521f382a506d0eface4e0378768277c7e1718498215017691065'
                and wired.get('schema') == 'sg-ag-wms-jinsedragon-codec-replay-v1'
                and wired.get('evidenceHash') == digest(unsigned) == 'b243bccc37ef709709a491aaacc6a1cf280e9bfcc3c1abec5af612ef928c2390'
                and wired.get('actualRecordAndVerifyIpc') is True and wired.get('independentJsPythonFields') is True
                and wired.get('sourceRequests') == wired.get('mongoWrites') == wired.get('failedOrHistoricalRoundsCredited') == 0,
                'ROLLING_WMS_PLAN_SCOPE')
    if plan['adapter'] == 'kingbabylon-base-wms-v1':
        from kingbabylon_base_fields import SOURCE, TYPE_PROFILE, mapping_hash
        wired = proof.get('wiringEvidence', {})
        unsigned = {k:v for k,v in wired.items() if k != 'evidenceHash'}
        require(plan['gameId'] == 32780 and plan['runtimeGameId'] == 33002 and plan['runtimeSlug'] == 'kingofbabylonactionspins'
                and plan['sourceKey'] == SOURCE and plan['betRaw'] == 200 and plan['maxSteps'] == 2
                and plan.get('wmsGameId') == 20402 and 'requestParams' not in plan and 'wmsChoiceCount' not in plan
                and proof.get('sampledRounds') == 1000 and proof.get('acceptedBaseRounds') == 977 and proof.get('acceptedFreeRounds') == 0
                and proof.get('rejectedFeatureRounds') == len(proof.get('rejectedHistoricalPrefixes', [])) == 23
                and proof.get('unhandledHistoricalVariants') == {'KINGBABYLON_FEATURE_NOT_ADAPTED':23}
                and proof['historyFileSha256'] == TYPE_PROFILE['evidence']['historyFileSha256']
                and proof.get('typeMappingHash') == mapping_hash() and proof.get('independentJsPythonFields') is True
                and proof.get('actualRecordAndVerifyIpc') is True
                and len(proof.get('acceptedRawHashes', [])) == len(set(proof.get('acceptedRawHashes', []))) == 977
                and digest(proof['acceptedRawHashes']) == 'a756b77a85efc87ddce028a023d4b87da2b4f1030821f826e6e9c92f568a8d55'
                and digest(proof['rejectedHistoricalPrefixes']) == 'ea94367eaa9e1b3a8abb6d20b5162c57143bec789c7922ccd0dba20434e166d0'
                and wired.get('schema') == 'sg-ag-wms-kingbabylon-codec-replay-v1'
                and wired.get('evidenceHash') == digest(unsigned) == 'f8c8a5a2cc45a1d5efd91b4720635ccb71f877df76e0dafbbaf7a35cfbb83824'
                and wired.get('actualRecordAndVerifyIpc') is True and wired.get('independentJsPythonFields') is True
                and wired.get('sourceRequests') == wired.get('mongoWrites') == wired.get('failedOrHistoricalRoundsCredited') == 0,
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
    if plan.get('arthurFeatureContract') is not None:
        from arthur_feature_fields import validate_proof as arthur_feature_proof
        arthur_feature_proof(plan,proof)
    if plan['adapter'] == 'arthur-base-wms-v1' and plan.get('arthurFeatureContract') is None:
        from arthur_base_fields import SOURCE, TYPE_PROFILE, mapping_hash
        wired = proof.get('wiringEvidence', {})
        unsigned = {k:v for k,v in wired.items() if k != 'evidenceHash'}
        require(plan['gameId'] == 32754 and plan['runtimeGameId'] == 32976 and plan['runtimeSlug'] == 'arthurandtheroundtable'
                and plan['sourceKey'] == SOURCE and plan['betRaw'] == 200 and plan['maxSteps'] == 2
                and plan.get('wmsGameId') == 20467 and 'requestParams' not in plan and 'wmsChoiceCount' not in plan
                and proof.get('sampledRounds') == 1000 and proof.get('acceptedBaseRounds') == 986 and proof.get('acceptedFreeRounds') == 0
                and proof.get('rejectedFeatureRounds') == len(proof.get('rejectedHistoricalPrefixes', [])) == 14
                and proof.get('unhandledHistoricalVariants') == {'ARTHUR_FEATURE_NOT_ADAPTED':14}
                and proof['historyFileSha256'] == TYPE_PROFILE['evidence']['historyFileSha256']
                and proof.get('typeMappingHash') == mapping_hash() and proof.get('independentJsPythonFields') is True
                and len(proof.get('acceptedRawHashes', [])) == len(set(proof.get('acceptedRawHashes', []))) == 986
                and digest(proof['acceptedRawHashes']) == '97cd056876b1fa559bd2a0bcaf24ca0ab59a7abc95eac52569974f23c5bcf1a2'
                and wired.get('schema') == 'sg-ag-wms-arthur-codec-replay-v1' and wired.get('evidenceHash') == digest(unsigned)
                and wired.get('gameId') == 32754 and wired.get('runtimeGameId') == 32976 and wired.get('wmsGameId') == 20467
                and wired.get('historyFileSha256') == proof['historyFileSha256']
                and wired.get('acceptedBaseRounds') == 986 and wired.get('sampledRounds') == 1000 and wired.get('acceptedFreeRounds') == 0
                and wired.get('rejectedFeatureRounds') == wired.get('rejectedPaidPrefixIntentsValidated') == 14
                and wired.get('rejectedHistoricalIndices') == [v['sampleIndex'] for v in proof['rejectedHistoricalPrefixes']]
                and digest(proof['rejectedHistoricalPrefixes']) == '91ff202a33f222cb2e6058c236ca7e4277c1324d768d2d072215778eaf18e0a8'
                and wired.get('rejectedHistoricalIndices') == [3, 243, 315, 365, 535, 593, 647, 677, 866, 891, 902, 912, 951, 992]
                and wired.get('sourceRoutesValidated') == 1972 and wired.get('rawHashesUnchanged') is True
                and wired.get('acceptedRawHashesHash') == digest(proof['acceptedRawHashes'])
                and wired.get('actualRecordAndVerifyIpc') is True and wired.get('independentJsPythonFields') is True
                and wired.get('unreviewedFeatureEndGameRejected') is True
                and wired.get('sourceRequests') == wired.get('mongoWrites') == wired.get('failedOrHistoricalRoundsCredited') == 0
                and wired.get('fullRecordsHash') == '1fe12b8812b952cd446631a04c8863a3deddfcd33d2d59b79dca7a772183410e',
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
    if plan.get('dragonFreeContract') is not None:
        from dragon_first_free_fields import validate_proof
        validate_proof(plan,proof)
    if plan.get('dragonEndContract') is not None:
        from dragon_end_fields import validate_proof
        parent_plan=plan;parent_proof=proof
        if plan.get('dragonFreeContract') is not None:
            from dragon_first_free_fields import previous
            parent_plan=previous(plan)
            parent_proof={**{k:v for k,v in proof.items() if k!='dragonFreeEvidence'},'planHash':digest(parent_plan)}
        validate_proof(parent_plan,parent_proof)
    if plan.get('carnivalPickContract') is not None:
        from carnival_pick_fields import validate_proof
        validate_proof(plan,proof)
    if plan.get('ownTerminalContract') is not None:
        from own_terminal_fields import validate_proof
        validate_proof(plan,proof)
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
