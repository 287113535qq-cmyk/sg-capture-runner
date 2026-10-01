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
        ['Natural historical 8+5 chain and independent three-language validators reviewed. Formal reentry and two-lane capture are active; this is a reusable feature reference, not authorization for another game.',
         'No readyForEndGame in this client; do not copy the Pearl terminal condition.']),
    32636: entry('nextgen-independent-free', dict(protocol='nextgen-payload', session='same-PID',
        requests='BET-FREE_GAME', counters='TFG=NFG+CFGG', terminal='explicit-NFG0-and-game-exits'),
        ['service/piggies_fields.py', 'scripts/trial/piggies-protocol.mjs', 'collector/sg.piggies.ts'],
        ['Size2 projection now has independent Python/Runner/collector mapping and capture/controller tests. Old33 records remain unchanged; natural size2 terminal and independent reentry remain outstanding.']),
    32719: entry('nextgen-independent-free', dict(protocol='nextgen-payload', session='same-PID',
        requests='BET-FREE_GAME', counters='TFG=NFG+CFGG', terminal='explicit-NFG0-and-game-exits'),
        ['service/inca_coin_review.py','scripts/trial/inca-coin-review.mjs','service/inca_free_review.py','service/inca_fields.py','scripts/trial/inca-free-review.mjs','scripts/trial/inca-protocol.mjs','collector/sg.inca.ts'],
        ['Pinned official Inca methods confirm FID1 FreeSpins, FID0 HoldNSpin and FGRS/CFGC overrides; independently reviewed, not inferred from the name.',
         'Finite source run preserved94 records and closed29 used/71 foregone; no natural free terminal. Coin/free repair now has independent Python/Runner/collector mapping and capture checks; all94 old records unchanged. No repair reentry; continuations/terminal remain synthetic.',
         'HoldNSpin has separate real trigger evidence and reviewed outro, but no natural terminal. Do not inherit Pyramids award semantics or Jinzita broader progression.']),
    32721: entry('nextgen-hold-extensions', dict(protocol='nextgen-payload', session='same-PID',
        requests='BET-FREE_GAME', counters='TFG=NFG+CFGG-plus-2-or-4', terminal='isolated-hold-outro-and-request-BET'),
        ['service/pyramids_hold_review.py','scripts/trial/pyramids-hold-review.mjs','service/pyramids_free_review.py','scripts/trial/pyramids-free-review.mjs','service/pyramids_major_review.py','service/pyramids_fields.py','scripts/trial/pyramids-protocol.mjs','collector/sg.pyramids.ts'],
        ['Isolated Hold (+2/+4) and ten-free mappings are integrated independently in Python/Runner/collector. Major free-coin extension was actually reentered; new source added416 full rounds, total3627 Mongo (plus150 historical). Unknown mixed feature then parked; zero-source retirement preserved3627 and released reservations. Reentry does not prove all feature exits.',
         'Official FID0=HoldNSpin/FID1=FreeSpins; Inca has the same enum but different unreviewed extension/coin behavior. Free-frame CL=-3 has a separate reviewed mapping. A real eight-frame Free-to-Hold prefix preserves outer FGRS3/CFGC7/FGTS10 while NFG/TFG/CFGG reset to6/6/0; official helpers and independent full-XML prefix validation agree. Hold exit with outer free remaining continues FREE_GAME; terminal and resumption shapes remain synthetic. Mixed production mapping, external jackpots and arbitrary negative codes remain unsupported; reuse geometry/transport, independently review counter-domain transitions and payout accounting.']),
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


def recommend_observed(document):
    """Match independently observed traits for a previously unclassified game.

    Evidence references are mandatory. This never updates REVIEWED or grants readiness.
    """
    allowed = {'protocol', 'session', 'requests', 'counters', 'terminal', 'initialFree', 'retriggerAward'}
    traits = document.get('traits', {})
    evidence = document.get('evidence', {})
    if not isinstance(evidence, dict):
        raise ValueError('TRAIT_EVIDENCE_REQUIRED')
    if not isinstance(traits, dict) or not traits or set(traits) - allowed or traits.get('protocol') not in {'wms-xml', 'nextgen-payload'}:
        raise ValueError('OBSERVED_PROTOCOL_TRAITS_REQUIRED')
    for key, value in traits.items():
        if isinstance(value, bool) or not isinstance(value, (str, int)) or (isinstance(value, str) and (not value or len(value) > 120)):
            raise ValueError('INVALID_OBSERVED_TRAIT')
        ref = evidence.get(key, {})
        if not isinstance(ref, dict):
            raise ValueError('TRAIT_EVIDENCE_REQUIRED')
        digest = ref.get('sha256', '')
        if not isinstance(digest, str) or len(digest) != 64 or any(c not in '0123456789abcdef' for c in digest) or ref.get('kind') not in {'official-client', 'private-capture', 'independent-review'}:
            raise ValueError('TRAIT_EVIDENCE_REQUIRED')
    result = []
    for game_id, reference in REVIEWED.items():
        if reference['traits']['protocol'] != traits['protocol']:
            continue
        common = {k: v for k, v in traits.items() if reference['traits'].get(k) == v}
        differences = {k: {'observed': traits.get(k), 'reference': reference['traits'].get(k)}
                       for k in sorted(set(traits) | set(reference['traits'])) if k not in common}
        result.append(dict(referenceGameId=game_id, referenceGroup=reference['group'],
            scope='observed-trait-candidate', common=common, differences=differences,
            missingTraits=sorted(set(reference['traits']) - set(traits)),
            referenceFiles=reference['files'], requiredReview=reference['requiredReview'],
            captureAuthorization=False, ready=False))
    return sorted(result, key=lambda x: (-len(x['common']), len(x['differences']), x['referenceGameId']))


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
    parser.add_argument('--observed-traits', type=Path)
    args = parser.parse_args()
    if args.observed_traits:
        result = dict(gameId=args.game, candidates=recommend_observed(json.loads(args.observed_traits.read_text(encoding='utf-8'))),
                      captureAuthorization=False, ready=False)
    else:
        result = build() if args.game is None else dict(gameId=args.game, candidates=recommend(args.game), captureAuthorization=False)
    text = json.dumps(result, ensure_ascii=False, indent=2) + '\n'
    if args.output:
        args.output.write_text(text, encoding='utf-8')
        print(json.dumps({'output': str(args.output), 'games': len(result.get('games', [])), 'captureAuthorization': False}))
    else:
        print(text)
