"""Reuse successful Linux checks only when every runtime tree is identical.

This check grants no capture permission. New configuration still requires its
independent profile validation, fresh ownership boundary and unique admission.
"""
import re
import subprocess

RUNTIME_ROOTS = ('scripts', 'service', 'collector', '.github')
REPOSITORIES = {'zyzuoyang/sg-capture-runner', '287113535qq-cmyk/sg-capture-runner'}


def validate_preflight_runtime(run, current_commit, resolve=None):
    assert run.get('status') == 'completed' and run.get('conclusion') == 'success', 'PREFLIGHT_NOT_SUCCESSFUL'
    assert run.get('repository', {}).get('full_name') in REPOSITORIES, 'PREFLIGHT_REPOSITORY'
    assert run.get('path') == '.github/workflows/preflight.yml' and run.get('run_attempt') == 1, 'PREFLIGHT_IDENTITY'
    old = run.get('head_sha', '')
    assert re.fullmatch('[a-f0-9]{40}', old) and re.fullmatch('[a-f0-9]{40}', current_commit), 'PREFLIGHT_COMMIT'
    if resolve is None:
        assert subprocess.check_output(['git','rev-parse','HEAD'],timeout=10).decode().strip()==current_commit, 'PREFLIGHT_CURRENT_HEAD'
        assert not subprocess.check_output(['git','status','--porcelain','--',*RUNTIME_ROOTS],timeout=10).strip(), 'PREFLIGHT_RUNTIME_WORKTREE_CHANGED'
        def resolve(commit, root):
            return subprocess.check_output(['git', 'rev-parse', commit + ':' + root], timeout=10).decode().strip()
    trees = {}
    for root in RUNTIME_ROOTS:
        previous, current = resolve(old, root), resolve(current_commit, root)
        assert re.fullmatch('[a-f0-9]{40}', previous) and previous == current, 'PREFLIGHT_RUNTIME_CHANGED'
        trees[root] = current
    return {'validatedCommit': old, 'currentCommit': current_commit, 'runtimeTrees': trees,
            'runtimeIdentical': True, 'sourceAllowance': 0}
