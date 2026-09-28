"""Offline client-pinned inventory for 32717; writes only a new review file."""
import argparse
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'service'))
from huff_goals_review import CLIENT_SHA256, SOURCE, review_round
from round_fields import FieldError, params
from store import digest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('client', 'traffic', 'output'):
        parser.add_argument('--' + name, type=Path, required=True)
    parser.add_argument('--pending', type=Path)
    args = parser.parse_args()
    if hashlib.sha256(args.client.read_bytes()).hexdigest() != CLIENT_SHA256:
        raise ValueError('GOALS_CLIENT_HASH_CHANGED')
    plan = json.loads((ROOT / 'config/round-one-plans.json').read_text())['32717']
    expected = {**plan['requestParams'], 'MSGID': 'BET'}
    chains, issues, steps, start_line = [], [], [], None

    def finish():
        if not steps:
            return
        try:
            result = review_round(plan, {'sourceKey': SOURCE, 'protocol': 'nextgen', 'steps': steps})
            chains.append({'startLine': start_line, **result})
        except FieldError as error:
            issues.append({'startLine': start_line, 'code': str(error)})
        except (ValueError, KeyError, TypeError):
            issues.append({'startLine': start_line, 'code': 'UNREADABLE_TRAFFIC_CHAIN'})

    traffic_hash, inspected = hashlib.sha256(), 0
    with args.traffic.open('rb') as source:
        while line := source.readline(1048577):
            inspected += 1
            if len(line) > 1048576 or inspected > 20000:
                raise ValueError('GOALS_TRAFFIC_REVIEW_LIMIT')
            traffic_hash.update(line)
            try:
                step = json.loads(line)
                msg = step.get('msgId')
                if msg in {'INIT', 'REELSTRIP', 'BET'}:
                    finish()
                    steps, start_line = [], None
                if msg == 'BET':
                    request = params(step.get('requestPayload'))
                    if {k: v for k, v in request.items() if k != 'PID'} == expected:
                        steps, start_line = [step], inspected
                elif steps:
                    steps.append(step)
            except (FieldError, ValueError, KeyError, TypeError, AttributeError):
                issues.append({'line': inspected, 'code': 'UNREADABLE_TRAFFIC_FRAME'})
                steps, start_line = [], None
        finish()
    pending = None
    if args.pending:
        data = json.loads(args.pending.read_text(encoding='utf-8-sig'))
        if data.get('awaiting') is not None:
            raise ValueError('GOALS_PENDING_UNKNOWN_SOURCE_OUTCOME')
        pending = {'sequence': data['sequence'], 'pendingHash': digest(data),
                   **review_round(plan, data['raw'])}
    report = {'schema': 'sg-huff-goals-inventory-v1', 'clientSha256': CLIENT_SHA256,
              'trafficSha256': traffic_hash.hexdigest(), 'trafficLines': inspected,
              'reviewedBaseChains': len(chains), 'reviewedFrames': sum(len(c['frames']) for c in chains),
              'observedFeatureIds': sorted({i for c in chains for i in c['observedFeatureIds']}),
              'observedReplayNames': sorted({i for c in chains for i in c['observedReplayNames']}),
              'totalCounterIncreases': sum(c['totalCounterIncreases'] for c in chains),
              'featureChains': [c for c in chains if len(c['frames']) > 1 or c['observedFeatureIds']],
              'issues': issues, 'pending': pending, 'captureAuthorized': False,
              'settlementVerified': False, 'officialSourceRequests': 0, 'databaseWrites': 0}
    with args.output.open('x', encoding='utf-8') as target:
        json.dump(report, target, ensure_ascii=False, indent=2)
        target.write('\n')
    print(json.dumps({k: v for k, v in report.items() if k not in {'featureChains', 'pending'}}))


if __name__ == '__main__':
    main()
