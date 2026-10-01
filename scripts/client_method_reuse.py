"""Offline exact-body candidates from executed official request methods.

Presence may be an unused library implementation, so call sites, identity,
counter domains, money and terminal branches still require independent review.
This module cannot classify a game ready or modify a capture queue.
"""
import hashlib


def match_bodies(data, *, expected_sha256, references):
    assert isinstance(data, bytes) and len(data) <= 32 * 1024 * 1024
    assert hashlib.sha256(data).hexdigest() == expected_sha256, 'CLIENT_HASH_CHANGED'
    assert isinstance(references, dict) and 1 <= len(references) <= 16
    matches = {}
    for label, reference in references.items():
        assert label in {'Spin.send', 'Close.send', 'Request.createHeader',
                         'Request.createAccountData', 'Spin.createStake', 'Spin.createPaylineCount'}
        body = reference['body']
        assert isinstance(body, bytes) and 32 <= len(body) <= 16384
        assert hashlib.sha256(body).hexdigest() == reference['sha256'], 'REFERENCE_HASH_CHANGED'
        offsets, start = [], 0
        while len(offsets) < 4:
            at = data.find(body, start)
            if at < 0:
                break
            offsets.append(at); start = at + len(body)
        if offsets:
            matches[label] = {'sha256': reference['sha256'], 'offsets': offsets}
    return {'schema': 'sg-offline-exact-request-method-candidate-v1',
            'clientSha256': expected_sha256, 'matches': matches,
            'requiredReview': ['Trace the actual selected engine and any method overrides.',
                               'Verify game/header identity and stake encoding.',
                               'Review response counter domains, money and every complete exit.'],
            'semanticEquivalenceProved': False, 'ready': False, 'captureAuthorization': False}


def eligible_task(task):
    # Existing applied work and completed games never become analysis targets.
    return task['status'] not in ('active', 'complete') and task.get('candidateOnly') is True
