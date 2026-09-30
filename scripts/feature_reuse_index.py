"""Offline reuse suggestions. Never imported by capture or admission code.

Only reviewed traits are indexed. Missing traits never count as a match.
Game names and equal numeric feature IDs are deliberately not match keys.
"""
import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def entry(group, traits, files, differences):
    return dict(group=group, traits=traits, files=files, requiredReview=differences)


REVIEWED = {
    32795: entry('wms-free-retrigger', dict(protocol='wms-xml', session='response-rotation',
        requests='Logic-EndGame', counters='total-progress-remaining', terminal='readyForEndGame-EndGame',
        initialFree=8, retriggerAward=8),
        ['scripts/trial/pearl-retrigger-protocol.mjs', 'service/pearl_retrigger_fields.py', 'collector/sg.pearl-retrigger.ts', 'service/pearl_award_fields.py', 'scripts/trial/pearl-award-protocol.mjs'],
        ['The frozen v1 scope was8. A real initial15 trigger led to separately admitted counter-driven v2; The ended run now has25392 independently verified complete records including a natural17-frame free chain; current continuation preserves its original target.',
         'Counter-driven v2 has since been independently activated; never reuse a prior applied profile for a different game.',
         'Stake encoding, feature XML, maximum-win exits and session identity are game-specific.']),
    32799: entry('wms-free-retrigger', dict(protocol='wms-xml', session='response-rotation',
        requests='Logic-EndGame', counters='total-progress-remaining', terminal='lastFreeSpin-EndGame',
        initialFree=8, retriggerAward=5), ['scripts/trial/rhino-protocol.mjs','service/rhino_fields.py','collector/sg.rhino.ts'],
        ['Independent modules and worker/controller offline checks passed; natural historical 8+5 chain reviewed, production entry not yet admitted.',
         'No readyForEndGame in this client; do not copy the Pearl terminal condition.']),
    32636: entry('nextgen-independent-free', dict(protocol='nextgen-payload', session='same-PID',
        requests='BET-FREE_GAME', counters='TFG=NFG+CFGG', terminal='explicit-NFG0-and-game-exits'),
        ['service/piggies_fields.py', 'scripts/trial/piggies-protocol.mjs', 'collector/sg.piggies.ts'],
        ['Size2 projection now has independent Python/Runner/collector mapping and capture/controller tests. Old33 records remain unchanged; natural size2 terminal and independent reentry remain outstanding.']),
    32720: entry('nextgen-independent-free', dict(protocol='nextgen-payload', session='same-PID',
        requests='BET-FREE_GAME', counters='TFG=NFG+CFGG', terminal='explicit-NFG0-and-game-exits'),
        ['service/jinzita_fields.py', 'scripts/trial/jinzita-protocol.mjs', 'collector/sg.jinzita.ts'],
        ['FID1 means free spins here; FGRS/CFGC and GCT require independent checks.',
         'Independent free terminal is synthetic evidence, not whole-game coverage.']),
    32835: entry('nextgen-independent-free', dict(protocol='nextgen-payload', session='same-PID',
        requests='BET-FREE_GAME', counters='TFG=NFG+CFGG', terminal='explicit-NFG0-and-game-exits'),
        ['service/luxor_fields.py', 'scripts/trial/luxor-protocol.mjs', 'collector/sg.luxor.ts'],
        ['FID2 means free spins here; switching to respin/cascade is not a terminal.',
         'Independent free terminal is synthetic evidence.']),
    32820: entry('nextgen-independent-free', dict(protocol='nextgen-payload', session='same-PID',
        requests='BET-FREE_GAME', counters='TFG=NFG+CFGG', terminal='explicit-NFG0-and-game-exits'),
        ['service/beaver_fields.py', 'scripts/trial/beaver-protocol.mjs', 'collector/sg.beaver.ts'],
        ['FID1/CFG1 is independent free; CFG0 selects a different feature.',
         'Independent free terminal is synthetic evidence.']),
    32714: entry('nextgen-mansion-features', dict(protocol='nextgen-payload', session='same-PID',
        requests='BET-FREE_GAME', counters='feature-specific', terminal='client-feature-exits'),
        ['service/huff_fields.py', 'scripts/trial/huff-protocol.mjs', 'service/huff_touchup_review.py', 'service/huff_retrigger_review.py', 'scripts/trial/huff-retrigger-review.mjs', 'collector/sg.huff-retrigger.ts'],
        ['Isolated HardHat duplicate1|1 slots now have an additive counter-validated mapping; natural retrigger terminal and new admission remain outstanding. Mixed TouchUp/Mansion transitions still require separate evidence.',
         'Do not transfer FID meanings or treat NFG0 alone as terminal.']),
    32718: entry('nextgen-wheel-features', dict(protocol='nextgen-payload', session='same-PID',
        requests='BET-FREE_GAME', counters='feature-specific', terminal='client-feature-exits'),
        ['service/morepuff_fields.py', 'scripts/trial/morepuff-protocol.mjs', 'collector/sg.morepuff.ts', 'service/morepuff_megahat_review.py', 'scripts/trial/morepuff-megahat-review.mjs', 'collector/sg.morepuff-megahat.ts'],
        ['FID2 is Wheel; WHSTOP and combined features decide continuation.',
         'Additive MegaHat single-free mapping supports only the reviewed two-frame prefix plus a strict synthetic one-free exit; retriggers, new awards and frame features remain unsupported. Natural terminal and new admission still outstanding.']),
    32651: entry('nextgen-pick-features', dict(protocol='nextgen-payload', session='same-PID',
        requests='BET-START-PICK-END', counters='feature-specific', terminal='feature-END-and-followups'),
        ['service/squid_fields.py', 'scripts/trial/squid-protocol.mjs'],
        ['Pick count and selection parameters are specific to this game; free-to-jackpot remains unsupported.']),
    32836: entry('nextgen-pick-features', dict(protocol='nextgen-payload', session='same-PID',
        requests='BET-START-PICK-END', counters='feature-specific', terminal='feature-END-and-followups'),
        ['service/quarterback_fields.py', 'scripts/trial/quarterback-protocol.mjs'],
        ['Foam and Pick A Ball use different FP and terminal counter shapes; completed game must not be resampled.']),
}


def recommend(game_id):
    target = REVIEWED.get(game_id)
    if target is None:
        return []  # Unknown is not the generic NextGen family.
    output = []
    for other_id, other in REVIEWED.items():
        if other_id == game_id or target['traits']['protocol'] != other['traits']['protocol']:
            continue
        keys = sorted(set(target['traits']) | set(other['traits']))
        common = {k: target['traits'][k] for k in keys if k in target['traits']
                  and k in other['traits'] and target['traits'][k] == other['traits'][k]}
        differences = {k: {'target': target['traits'].get(k), 'reference': other['traits'].get(k)}
                       for k in keys if k not in common}
        output.append(dict(referenceGameId=other_id,
            scope='family-candidate' if target['group'] == other['group'] else 'transport-only',
            common=common, differences=differences, referenceFiles=other['files'],
            requiredReview=target['requiredReview'] + other['requiredReview'], captureAuthorization=False))
    return sorted(output, key=lambda x: (x['scope'] != 'family-candidate', -len(x['common']), x['referenceGameId']))


def build():
    games = json.loads((ROOT / 'config/games.json').read_text(encoding='utf-8'))
    result = []
    for game in games:
        gid = game['gameId']; reviewed = REVIEWED.get(gid)
        result.append(dict(gameId=gid, name=game['name'], status='reviewed-traits' if reviewed else 'unclassified',
            group=reviewed['group'] if reviewed else None,
            traits=reviewed['traits'] if reviewed else {},
            references={f: hashlib.sha256((ROOT / f).read_bytes().replace(b'\r\n', b'\n')).hexdigest()
                        for f in reviewed['files']} if reviewed else {},
            candidates=recommend(gid), captureAuthorization=False))
    return dict(schema='sg-offline-feature-reuse-index-v1', captureAuthorization=False,
        limitations='Suggestions only. No profile/quota/queue changes. Unknown games require evidence before matching.',
        games=result)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--game', type=int); parser.add_argument('--output', type=Path)
    args = parser.parse_args(); result = build() if args.game is None else dict(gameId=args.game, candidates=recommend(args.game), captureAuthorization=False)
    text = json.dumps(result, ensure_ascii=False, indent=2) + '\n'
    if args.output:
        args.output.write_text(text, encoding='utf-8')
        print(json.dumps({'output': str(args.output), 'games': len(result.get('games', [])), 'captureAuthorization': False}))
    else:
        print(text)
