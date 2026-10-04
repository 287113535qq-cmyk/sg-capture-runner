"""Persistent GitHub-side analyzer. Private JSON pipes only; no networking."""
import json
import pathlib
import sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / 'service'))
from store import canonical, digest
from pool_plan import validate_pool_plan
from native_nextgen_fields import NativeNextgenFields
from piggies_fields import PiggiesFields, SOURCE as PIGGIES_SOURCE
from pearl_fields import PearlFields, SOURCE as PEARL_SOURCE
from pearl_retrigger_fields import PearlRetriggerFields
from pearl_award_fields import PearlAwardFields
from rhino_fields import RhinoFields, SOURCE as RHINO_SOURCE
from squid_fields import SquidFields, SOURCE as SQUID_SOURCE
from huff_fields import HuffFields, SOURCE as HUFF_SOURCE
from huff_action_fields import HuffActionFields, ACTION_VERSION as HUFF_ACTION_VERSION, has_home_improvement
from demon_nested_fields import DemonNestedFields as DemonFields, SOURCE as DEMON_SOURCE
from quarterback_fields import QuarterbackFields, SOURCE as QUARTERBACK_SOURCE

from beaver_fields import BeaverSequence, SOURCE as BEAVER_SOURCE

from pyramids_fields import PyramidsFields, SOURCE as PYRAMIDS_SOURCE
from pyramids_action_fields import PyramidsActionFields, ACTION_VERSION
from pyramids_direct_action_fields import PyramidsDirectActionFields, ACTION_VERSION as DIRECT_ACTION_VERSION
from pyramids_resume_action_fields import PyramidsResumeActionFields, ACTION_VERSION as RESUME_ACTION_VERSION
from inca_fields import IncaFields, SOURCE as INCA_SOURCE
from jinzita_fields import JinzitaSequence, SOURCE as JINZITA_SOURCE
from morepuff_fields import MorepuffSequence, SOURCE as MOREPUFF_SOURCE
from luxor_fields import LuxorSequence, SOURCE as LUXOR_SOURCE
from veryfruity_action_fields import VeryFruityActionFields, SOURCE as VERYFRUITY_SOURCE
from five_treasures_fields import FiveTreasuresFields, SOURCE as FIVE_SOURCE

adapters = {}


def execute(request):
    plan = request['plan']
    key = digest(plan)
    if key not in adapters:
        plan = validate_pool_plan(plan)
        cls = {PYRAMIDS_SOURCE: PyramidsFields, INCA_SOURCE: IncaFields, RHINO_SOURCE: RhinoFields, MOREPUFF_SOURCE: MorepuffSequence, JINZITA_SOURCE: JinzitaSequence, LUXOR_SOURCE: LuxorSequence, BEAVER_SOURCE: BeaverSequence, SQUID_SOURCE: SquidFields, HUFF_SOURCE: HuffFields, DEMON_SOURCE: DemonFields, QUARTERBACK_SOURCE: QuarterbackFields}.get(plan['sourceKey'], NativeNextgenFields)
        adapters[key] = ((PearlAwardFields if plan.get('featureProfile') == 'additive-free-awards-v2' else PearlRetriggerFields if plan.get('featureProfile') == 'eight-free-retrigger-v1' else PearlFields) if plan['sourceKey'] == PEARL_SOURCE else PiggiesFields if plan['sourceKey'] == PIGGIES_SOURCE else cls)(plan)
        if plan['sourceKey']==PYRAMIDS_SOURCE and plan.get('featureProfile') in (ACTION_VERSION,DIRECT_ACTION_VERSION,RESUME_ACTION_VERSION):
            adapters[key]=PyramidsActionFields(plan)
        if plan['sourceKey']==PYRAMIDS_SOURCE and plan.get('featureProfile')==DIRECT_ACTION_VERSION:
            adapters[key]=PyramidsDirectActionFields(plan)
        if plan['sourceKey']==PYRAMIDS_SOURCE and plan.get('featureProfile')==RESUME_ACTION_VERSION:
            adapters[key]=PyramidsResumeActionFields(plan)
        if plan['sourceKey']==VERYFRUITY_SOURCE:
            adapters[key]=VeryFruityActionFields(plan)
        if plan['sourceKey']==HUFF_SOURCE and plan.get('featureProfile')==HUFF_ACTION_VERSION:
            adapters[key]=HuffActionFields(plan)
        if plan['sourceKey']==FIVE_SOURCE:
            adapters[key]=FiveTreasuresFields(plan)
    adapter = adapters[key]
    if request.get('op') == 'plan':
        return {'validated': True}
    if request.get('op') == 'review_explicit':
        from explicit_request_review import review_explicit_prefix
        return review_explicit_prefix(plan, request['raw'])
    if request.get('op') in ('explicit_probe_route','explicit_probe_intent'):
        from explicit_request_probe import route,intent
        return route(plan,request['raw']) if request['op']=='explicit_probe_route' else intent(plan,request['raw'],request['payload'])
    if request.get('op') == 'five_bootstrap':
        assert plan['sourceKey'] == FIVE_SOURCE
        return adapter.bootstrap(request['step'], request['session'])
    if request.get('op') == 'nextgen_bootstrap':
        assert plan['adapter'] == 'native-nextgen-v1'
        import xml.etree.ElementTree as ET
        from round_fields import params, amount
        step = request['step']
        q, p = params(step['requestPayload']), params(step['responsePayload'])
        assert step['msgId'] in ('INIT', 'REELSTRIP') and step['methodName'] == 'processGameMessage'
        assert q == {'GN': plan['runtimeSlug'], 'PID': request['pid'], 'MSGID': step['msgId']}
        assert request['pid'].startswith('gdmgcm') and p['MSGID'] == step['msgId']
        text = step['responseXml']
        assert isinstance(text, str) and len(text) < 262144 and '<!DOCTYPE' not in text.upper() and '<!ENTITY' not in text.upper()
        root = ET.fromstring(text)
        assert root.tag.upper() == 'GDMRESPONSE' and root.findtext('SUCCESS').lower() == 'true' and root.findtext('PAYLOAD') == step['responsePayload']
        assert amount(step['elapsedMs']) <= 300000 and not step.get('sourceRejected')
        return {'validated': True, 'balanceRaw': amount(p.get('AB', p.get('B'))) if step['msgId'] == 'INIT' else None}
    if request.get('op') == 'review_flow':
        # Diagnostic channel only. Existing next/intent/record permissions and
        # applied profiles remain independent; this cannot approve a record.
        assert plan['sourceKey'] == PYRAMIDS_SOURCE
        from pyramids_flow_review import review_pyramids_flow
        return review_pyramids_flow(plan, request['raw'])
    if request.get('op') == 'verify_batch':
        records = request.get('records')
        assert isinstance(records, list) and 1 <= len(records) <= 100
        assert len({r['_id'] for r in records}) == len(records)
        assert all(r.get('fixtureOnly') is False for r in records)
        assert all(type(r.get('sequence')) is int and r['sequence'] > 0 for r in records)
        assert all(a['sequence'] < b['sequence'] for a, b in zip(records, records[1:]))
        # Preserve the exact single-record monetary, XML and content checks.
        # A failure anywhere rejects the entire page, with no partial receipt.
        for record in records:
            assert execute({'op': 'verify', 'plan': plan,
                            'raw': record['raw'], 'record': record}) == {'verified': True}
        return {'verified': True, 'count': len(records),
                'idsHash': digest([[r['_id'], r['contentHash']] for r in records])}
    op, raw = request['op'], request['raw']
    if op == 'classify':
        # Full evidence verification precedes optional gameplay interpretation.
        # A classification gap cannot change the original receipt or quota.
        record = request['record']
        assert execute({'op': 'verify', 'plan': plan, 'raw': raw,
                        'record': record}) == {'verified': True}
        assert record['normalized'].get('classificationStatus') == 'pending'
        from round_fields import FieldError
        result = {'schema': 'sg-round-analysis-v1', 'recordId': record['_id'],
                  'contentHash': record['contentHash'], 'rawHash': record['rawHash'],
                  'sourceAllowance': 0}
        if has_home_improvement(raw):
            return {**result, 'status': 'review-required', 'reason': 'GAMEPLAY_CLASSIFIER_UNAVAILABLE'}
        if plan.get('featureProfile') not in (ACTION_VERSION, DIRECT_ACTION_VERSION, RESUME_ACTION_VERSION, HUFF_ACTION_VERSION):
            return {**result, 'status': 'review-required',
                    'reason': 'GAMEPLAY_CLASSIFIER_UNAVAILABLE'}
        try:
            classified = (HuffFields(plan) if plan.get('featureProfile')==HUFF_ACTION_VERSION else PyramidsFields(plan)).settled(raw)
        except FieldError as exc:
            code = str(exc)
            assert code and len(code) <= 80 and all(c in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ_' for c in code)
            return {**result, 'status': 'review-required', 'reason': code}
        if classified.get('classificationStatus') == 'pending':
            return {**result, 'status': 'review-required', 'reason': 'GAMEPLAY_CLASSIFIER_UNAVAILABLE'}
        assert all(classified[k] == record['normalized'][k] for k in ('bet', 'mul', 'buy'))
        return {**result, 'status': 'classified', 'classification': classified}
    if plan['sourceKey'] in (PEARL_SOURCE, RHINO_SOURCE, VERYFRUITY_SOURCE, FIVE_SOURCE):
        if op == 'next':
            return adapter.next_request(raw)
        if op == 'intent':
            return adapter.validate_intent(raw, request['payload'])
        if op == 'bootstrap':
            return adapter.bootstrap(request['step'])
    if op == 'next':
        return adapter.next_request(raw) if raw['steps'] or plan.get('featureProfile') in (ACTION_VERSION,DIRECT_ACTION_VERSION,RESUME_ACTION_VERSION) else {'MSGID':'BET'}
    if op == 'intent':
        next_step=adapter.next_request(raw) if raw['steps'] or plan.get('featureProfile') in (ACTION_VERSION,DIRECT_ACTION_VERSION,RESUME_ACTION_VERSION) else {'MSGID':'BET'}
        assert next_step is not None
        parsed=adapter.request_params(request['payload'],next_step['MSGID'])
        assert all(parsed.get(k)==v for k,v in next_step.items())
        if raw['steps']:
            from round_fields import params
            assert parsed['PID']==params(raw['steps'][0]['requestPayload'])['PID']
        return {'validated':True}
    fields = adapter.settled(raw)
    if op == 'fields':
        return fields
    if op == 'verify':
        old = request['record']
        assert all(old[k]==plan[k] for k in ('trialId','gameId','runtimeGameId'))
        identity={k:old[k] for k in ('sequence','attempt','trialId','gameId','runtimeGameId')}
        assert digest(identity)==old['_id']
        assert fields == old['normalized'] and digest(raw) == old['rawHash']
        assert digest(fields) == old['normalizedHash']
        # JavaScript/JSON transport does not distinguish 2 from 2.0. Rebuild
        # only the independently derived money fields in their original Python
        # numeric representation before checking the unchanged legacy digest.
        restored={**old,'normalized':fields,'bet':fields['bet'],'mul':fields['mul']}
        assert old['bet']==fields['bet'] and old['mul']==fields['mul']
        assert digest({k:v for k,v in restored.items() if k!='contentHash'}) == old['contentHash']
        return {'verified': True}
    assert op == 'record' and request['normalized'] == fields
    identity = {k: request[k] for k in ('sequence', 'attempt')}
    identity.update(trialId=plan['trialId'], gameId=plan['gameId'], runtimeGameId=plan['runtimeGameId'])
    record = {'_id': digest(identity), **identity, 'fixtureOnly': False,
              'sourceRoundIdentity': 'collector-operation', 'sourceSessionHash': request['sessionHash'],
              'raw': raw, 'normalized': fields,
              **{k: fields[k] for k in ('bet', 'mul', 'buy', 'bonus', 'roundFieldsVersion')},
              'shardId': request['worker'], 'batchId': request['batchId']}
    record['rawHash'], record['normalizedHash'] = digest(raw), digest(fields)
    record['contentHash'] = digest(record)
    return record


if __name__ == '__main__':
    for line in sys.stdin.buffer:
        try:
            assert len(line) <= 8 * 1024 * 1024
            result = execute(json.loads(line))
            print(json.dumps({'ok': True, 'result': result}, separators=(',', ':')), flush=True)
        except Exception as exc:
            code = str(exc)
            if not code or len(code) > 80 or any(c not in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ_' for c in code):
                code = 'RUNNER_RECORD_VALIDATION_FAILED'
            print(json.dumps({'ok': False, 'error': code}), flush=True)
