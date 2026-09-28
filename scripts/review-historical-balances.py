"""Read-only money evidence review; never repairs or credits historical rounds."""
import argparse
import collections
from decimal import Decimal, InvalidOperation
import hashlib
import json
from pathlib import Path
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'service'))
from round_fields import FieldError, MAX_SAFE, check, nextgen, params


def minor_units(value):
    try:
        number = Decimal(str(value)) * 100
        check(number.is_finite() and number == number.to_integral_value()
              and 0 <= number <= MAX_SAFE, 'INVALID_HISTORICAL_MONEY')
        return int(number)
    except (InvalidOperation, ValueError, TypeError):
        raise FieldError('INVALID_HISTORICAL_MONEY') from None


def successful_xml(step):
    text = step.get('responseXml')
    check(isinstance(text, str) and len(text) < 262144
          and '<!DOCTYPE' not in text.upper() and '<!ENTITY' not in text.upper(),
          'INVALID_RESPONSE_XML')
    try:
        root = ET.fromstring(text)
    except ET.ParseError:
        raise FieldError('INVALID_RESPONSE_XML') from None
    check(root.tag.upper() == 'GDMRESPONSE'
          and str(root.findtext('SUCCESS')).lower() == 'true'
          and root.findtext('PAYLOAD') == step.get('responsePayload'),
          'RESPONSE_XML_EVIDENCE_MISMATCH')


def step_hash(step):
    # Includes private request identity only inside a one-way digest. Never
    # report request/response bodies, URLs, session identifiers or their values.
    fields = [step.get(k) for k in ('msgId', 'requestPayload', 'responsePayload', 'responseXml')]
    return hashlib.sha256(json.dumps(fields, separators=(',', ':'), ensure_ascii=True).encode()).hexdigest()


def snapshot(path):
    stat = path.stat()
    return stat.st_size, stat.st_mtime_ns


def review(game_id, assets):
    directory = assets / 'sg' / str(game_id)
    path = directory / 'rounds.jsonl'
    before = snapshot(path)
    digest, counts, errors = hashlib.sha256(), collections.Counter(), collections.Counter()
    findings, targets = [], {}
    with path.open('rb') as stream:
        for line_number, line in enumerate(stream, 1):
            digest.update(line)
            if not line.strip():
                continue
            counts['records'] += 1
            try:
                row = json.loads(line)
                if row.get('buy') != 0:
                    counts['otherModes'] += 1
                    continue
                counts['baseRecords'] += 1
                raw = row['data']
                steps = raw['steps']
                check(isinstance(steps, list) and 0 < len(steps) <= 100
                      and all(isinstance(s, dict) for s in steps), 'INVALID_ROUND_STEPS')
                check(steps[0].get('msgId') == 'BET', 'NEXTGEN_ONLY')
                for step in steps:
                    successful_xml(step)
                start, stored = minor_units(raw['startBalance']), minor_units(row['bet'])
                end, win, kind, _ = nextgen(raw)
                stake = start - end + win
                code = ('NON_POSITIVE_BALANCE_DERIVED_STAKE' if stake <= 0 else
                        'STORED_BET_MISMATCH' if stored != stake else None)
                if code is None:
                    counts['moneyEquationMatchesStoredBet'] += 1
                    counts['matchingRowsWithContinuation'] += len(steps) > 1
                    continue
                counts['anomalies'] += 1
                issue = {'roundLine': line_number, 'roundSHA256': hashlib.sha256(line.strip()).hexdigest(),
                         'code': code, 'startBalanceRaw': start, 'endBalanceRaw': end,
                         'totalWinRaw': win, 'balanceDerivedStakeRaw': stake,
                         'storedBetRaw': stored, 'messageCount': len(steps), 'kind': kind,
                         'sourceOutcome': 'success-xml-preserved', 'creditEligible': False,
                         'trafficMatches': []}
                findings.append(issue)
                targets.setdefault(step_hash(steps[0]), []).append(issue)
            except (FieldError, ValueError, KeyError, TypeError, AttributeError):
                # Deliberately do not expose exception text from private files.
                counts['unreviewableRecords'] += 1
                errors['INVALID_OR_UNSUPPORTED_EVIDENCE'] += 1
    check(before == snapshot(path), 'HISTORICAL_FILE_CHANGED_DURING_REVIEW')
    traffic = directory / 'traffic.jsonl'
    traffic_digest, previous = hashlib.sha256(), None
    traffic_before = snapshot(traffic) if traffic.is_file() else None
    if traffic_before is not None:
        with traffic.open('rb') as stream:
            for line_number, line in enumerate(stream, 1):
                traffic_digest.update(line)
                if not line.strip():
                    continue
                try:
                    step = json.loads(line)
                    request, response = params(step['requestPayload']), params(step['responsePayload'])
                    successful_xml(step)
                    check(response.get('MSGID') == step.get('msgId'), 'MESSAGE_ID_MISMATCH')
                    for issue in targets.get(step_hash(step), []):
                        same_session = (previous is not None and bool(request.get('PID'))
                                        and previous[0] == request['PID'])
                        issue['trafficMatches'].append({
                            'line': line_number, 'SHA256': hashlib.sha256(line.strip()).hexdigest(),
                            'sameSessionAsPreviousSuccessfulFrame': same_session,
                            'previousBalanceMatchesRecordedStart': bool(
                                same_session and previous[1].get('B') == str(issue['startBalanceRaw'])
                                and previous[1].get('AB') == str(issue['startBalanceRaw']))})
                    previous = request.get('PID'), response
                except (FieldError, ValueError, KeyError, TypeError, AttributeError):
                    previous = None
        check(traffic_before == snapshot(traffic), 'HISTORICAL_FILE_CHANGED_DURING_REVIEW')
    for issue in findings:
        issue['trafficMatchStatus'] = ('unique' if len(issue['trafficMatches']) == 1 else
                                       'ambiguous' if issue['trafficMatches'] else 'missing')
    return {'gameId': game_id, 'roundsSHA256': digest.hexdigest(), 'counts': dict(counts),
            'unreviewableReasons': dict(errors), 'anomalies': findings,
            'trafficPresent': traffic_before is not None,
            'trafficSHA256': traffic_digest.hexdigest() if traffic_before is not None else None,
            'unchangedDuringRead': True, 'fullProtocolCoverageProven': False,
            'mongoParityVerified': False, 'creditedHistoricalRounds': 0}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--assets', type=Path, required=True)
    parser.add_argument('--game-ids', type=int, nargs='+', required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    output = args.output.resolve()
    check(output.is_relative_to(ROOT) and not output.is_relative_to(args.assets.resolve()),
          'REPORT_MUST_STAY_IN_CAPTURE_REPOSITORY')
    catalog = {g['gameId'] for g in json.loads((ROOT / 'config/games.json').read_text(encoding='utf-8'))}
    check(set(args.game_ids) <= catalog, 'UNKNOWN_GAME_ID')
    games = [review(gid, args.assets) for gid in sorted(set(args.game_ids))]
    report = {'schema': 'sg-historical-balance-review-v1', 'readOnly': True,
              'officialRequests': 0, 'databaseWrites': 0, 'queueMutations': 0,
              'historicalRecordMutations': 0, 'countsAreNotCompletionProof': True,
              'reviewedGames': len(games), 'anomalyCount': sum(g['counts'].get('anomalies', 0) for g in games),
              'games': games}
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({k: v for k, v in report.items() if k != 'games'}))


if __name__ == '__main__':
    main()
