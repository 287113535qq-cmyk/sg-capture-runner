"""Persistent GitHub-side analyzer. Private JSON pipes only; no networking."""
import json
import pathlib
import sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / 'service'))
from store import canonical, digest
from pool_plan import validate_pool_plan
from native_nextgen_fields import NativeNextgenFields
from squid_fields import SquidFields, SOURCE as SQUID_SOURCE
from huff_fields import HuffFields, SOURCE as HUFF_SOURCE
from demon_fields import DemonFields, SOURCE as DEMON_SOURCE
from quarterback_fields import QuarterbackFields, SOURCE as QUARTERBACK_SOURCE

adapters = {}


def execute(request):
    plan = request['plan']
    key = digest(plan)
    if key not in adapters:
        plan = validate_pool_plan(plan)
        cls = {SQUID_SOURCE: SquidFields, HUFF_SOURCE: HuffFields, DEMON_SOURCE: DemonFields, QUARTERBACK_SOURCE: QuarterbackFields}.get(plan['sourceKey'], NativeNextgenFields)
        adapters[key] = cls(plan)
    adapter = adapters[key]
    op, raw = request['op'], request['raw']
    if op == 'next':
        return adapter.next_request(raw) if raw['steps'] else {'MSGID':'BET'}
    if op == 'intent':
        next_step=adapter.next_request(raw) if raw['steps'] else {'MSGID':'BET'}
        assert next_step is not None
        parsed=adapter.request_params(request['payload'],next_step['MSGID'])
        assert all(parsed.get(k)==v for k,v in next_step.items())
        if raw['steps']:
            from round_fields import params
            assert parsed['PID']==params(raw['steps'][0]['requestPayload'])['PID']
        return {'validated':True}
    fields = adapter.settled(raw)
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
