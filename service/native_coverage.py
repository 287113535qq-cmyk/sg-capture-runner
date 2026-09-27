"""Review ancillary historical traffic without changing plans or making requests.

A small rounds.jsonl containing only settled BET/FREE_GAME records cannot prove
that the same game's other natural features are covered. Inspect successful
traffic following the exact configured ordinary BET template as well.
"""
import argparse
import collections
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'service'))
from native_nextgen_fields import NativeNextgenFields
from round_fields import FieldError, params


def review(plan, assets, limit=20000):
    path = assets / 'sg' / str(plan['gameId']) / 'traffic.jsonl'
    result = {'gameId':plan['gameId'], 'name':plan['name'], 'trafficPresent':path.is_file(),
        'matchingBaseStarts':0, 'successfulFrames':0, 'issues':[], 'truncated':False}
    if not path.is_file():
        result['needsCoverageReview'] = True
        return result
    adapter, in_base = NativeNextgenFields(plan), False
    expected = {**plan['requestParams'], 'MSGID':'BET'}
    counts, examples, digest = collections.Counter(), {}, hashlib.sha256()
    with path.open('rb') as stream:
        for index, line in enumerate(stream, 1):
            if index > limit:
                result['truncated'] = True
                break
            digest.update(line)
            try:
                step = json.loads(line)
                msg = step.get('msgId')
                request, response = params(step['requestPayload']), params(step['responsePayload'])
                if msg == 'BET':
                    in_base = ({k:v for k,v in request.items() if k!='PID'} == expected
                        and response.get('MSGID') == 'BET')
                    if in_base:result['matchingBaseStarts'] += 1
                elif msg in {'INIT','REELSTRIP'}:
                    in_base = False
                if not in_base or response.get('MSGID') != msg:
                    continue
                result['successfulFrames'] += 1
                try:
                    adapter.frame({**step, 'elapsedMs':0})
                except FieldError as error:
                    code = str(error)
                    counts[code] += 1
                    examples.setdefault(code, {'line':index, 'message':msg,
                        'responseKeys':sorted(response),
                        'evidenceSHA256':hashlib.sha256(line).hexdigest()})
            except (ValueError, KeyError, TypeError, FieldError):
                # Broken traffic cannot establish a safe feature boundary.
                in_base = False
                counts['UNREADABLE_TRAFFIC_FRAME'] += 1
    result['issues'] = [{'code':code, 'count':count, **examples.get(code,{})}
        for code,count in sorted(counts.items())]
    result['inspectedTrafficSHA256'] = digest.hexdigest()
    result['needsCoverageReview'] = bool(counts or result['truncated'] or not result['matchingBaseStarts'])
    result['absenceOfFindingsProvesAllFeaturesSupported'] = False
    return result


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--assets',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    plans=json.loads((ROOT/'config/round-one-plans.json').read_text(encoding='utf-8'))
    games=[review(plan,args.assets) for plan in plans.values()]
    report={'schema':'sg-native-coverage-review-v1','officialSourceRequests':0,
        'databaseWrites':0,'queueMutations':0,'smallSettledSampleIsNotFullProtocolCoverage':True,
        'reviewedGames':len(games),'gamesNeedingReview':[r['gameId'] for r in games if r['needsCoverageReview']],
        'games':games}
    args.output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k!='games'}))


if __name__=='__main__':main()
