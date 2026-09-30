"""Read-only lexical triage of cached clients. Tokens are NOT gameplay evidence.

Never executes JavaScript, guesses feature IDs, changes queues, or grants capture.
Slug-derived paths are explicitly unverified candidates until independently checked.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path

TOKENS = ('MSGID', 'BET', 'FREE_GAME', 'FEATURE_START', 'FEATURE_PICK', 'FEATURE_END',
          'NFG', 'TFG', 'CFGG', 'FID', 'FGRS', 'CFGC', 'BGCL', 'CL', 'WHSTOP',
          'WHEELSPIN', 'WHSLICE', 'MMBG', 'FRAMEWINS', 'Logic', 'EndGame',
          'readyForEndGame', 'lastFreeSpin', 'FreeSpins', 'HoldNSpin')
IDENTIFIER = frozenset('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_$')


def fingerprint(data):
    if len(data) > 32 * 1024 * 1024:
        raise ValueError('CLIENT_TOO_LARGE')
    text = data.decode('utf-8', errors='strict')
    seen = {token: [] for token in TOKENS}
    # C-level literal searches avoid a lookbehind/alternation at every byte of
    # hundreds of megabytes of minified source. Retain only four offsets/token.
    for token, offsets in seen.items():
        start = 0
        while len(offsets) < 4:
            at = text.find(token, start)
            if at < 0:
                break
            end = at + len(token)
            if (at == 0 or text[at-1] not in IDENTIFIER) and (end == len(text) or text[end] not in IDENTIFIER):
                offsets.append(at)
            start = end
    return dict(sha256=hashlib.sha256(data).hexdigest(), bytes=len(data),
                tokenOffsets={k: v for k, v in seen.items() if v})


def inventory(plans, root, completed, reviewed):
    root = root.resolve(strict=True)
    rows, cache = [], {}
    for game_id, plan in sorted(plans.items(), key=lambda pair: int(pair[0])):
        gid = int(game_id)
        row = dict(gameId=gid, ready=False, captureAuthorization=False)
        if gid in completed:
            rows.append(dict(row, status='completed-skipped', clients=[]))
            continue
        slug = plan.get('runtimeSlug', '')
        if not re.fullmatch('[a-z0-9_-]{1,100}', slug):
            rows.append(dict(row, status='unmapped', clients=[]))
            continue
        names = {slug}
        if slug.endswith(('95', '96')):
            names.add(slug[:-2])
        clients = []
        # Cached clients use app.js, older game.js, and fixed bundle layouts.
        # Inspect only these fixed entry points, never recursively scan assets.
        paths = [root / name / entry for name in sorted(names)
                 for entry in ('js/app.js', 'js/game.js', 'game.bundle.js', 'game_min.js')]
        for path in paths:
            if not path.is_file():
                continue
            # A cache junction or symlink cannot escape the explicitly selected root.
            real = path.resolve(strict=True)
            if not real.is_relative_to(root):
                raise ValueError('CLIENT_PATH_ESCAPES_ROOT')
            if real not in cache:
                cache[real] = fingerprint(real.read_bytes())
            clients.append(dict(relativePath=path.relative_to(root).as_posix(),
                entryPoint=path.name, **cache[real]))
        rows.append(dict(row, status='lexical-candidate' if clients else 'unmapped', clients=clients,
            identityVerified=False, semanticTraits={}, requiredReview=[
                'Verify client identity independently of its directory name.',
                'Trace request route, counter transitions, money, session and complete exits.',
                'Token presence never proves a feature enum or terminal condition.']))
    refs = [r for r in rows if r['gameId'] in reviewed and len(r['clients']) == 1]
    for row in rows:
        row['references'] = []
        if len(row['clients']) != 1:
            continue
        own = set(row['clients'][0]['tokenOffsets'])
        for ref in refs:
            if ref['gameId'] == row['gameId']:
                continue
            other = set(ref['clients'][0]['tokenOffsets'])
            common = own & other
            if len(common) < 3:
                continue
            row['references'].append(dict(gameId=ref['gameId'], scope='lexical-only',
                commonTokens=sorted(common), targetOnly=sorted(own-other), referenceOnly=sorted(other-own),
                jaccard=len(common)/len(own|other), referenceSha256=ref['clients'][0]['sha256']))
        row['references'] = sorted(row['references'], key=lambda x: (-x['jaccard'], x['gameId']))[:5]
    return dict(schema='sg-offline-client-inventory-v1', games=rows, filesRead=len(cache),
        semanticClassification=False, captureAuthorization=False,
        limitations='Lexical candidates only. Directory matches and token overlaps cannot confer semantic equivalence or readiness.')


if __name__ == '__main__':
    from feature_reuse_index import REVIEWED
    p = argparse.ArgumentParser()
    p.add_argument('--client-root', type=Path, required=True)
    p.add_argument('--completed', type=Path, required=True, help='Private JSON array of completed game IDs; never rescanned')
    p.add_argument('--output', type=Path, required=True)
    a = p.parse_args()
    completed = json.loads(a.completed.read_text(encoding='utf-8'))
    if not isinstance(completed, list) or not all(type(n) is int for n in completed) or 32836 not in completed:
        raise ValueError('COMPLETED_SCOPE_REQUIRED')
    config = Path(__file__).resolve().parents[1]/'config'
    plans = json.loads((config/'round-one-plans.json').read_text(encoding='utf-8'))
    catalog = json.loads((config/'round-one.json').read_text(encoding='utf-8'))['games']
    plans = {str(g['gameId']): plans.get(str(g['gameId']),
        {'runtimeSlug': g.get('historicalDatabase', '').removeprefix('sg_')}) for g in catalog}
    result = inventory(plans, a.client_root, set(completed), REVIEWED)
    a.output.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    counts = {key: sum(r['status'] == key for r in result['games']) for key in ('completed-skipped','lexical-candidate','unmapped')}
    print(json.dumps(dict(games=len(result['games']), filesRead=result['filesRead'], counts=counts, sourceRequests=0)))
