"""Operator-installed runner topology, separate from immutable capture plans.

The SSH forced command selects a group; an RPC request cannot select another
group or enable federation. Existing worker IDs and session hashes stay fixed.
"""
import json
from pathlib import Path
from store import require

CAMPAIGN = 'sg_round_one_20260928'
TOPOLOGY = {
    'schema': 'sg-runner-federation-v1', 'campaignId': CAMPAIGN,
    'groups': {
        'primary': {'repository': 'zyzuoyang/sg-capture-runner', 'start': 0, 'count': 20},
        'secondary': {'repository': '287113535qq-cmyk/sg-capture-runner', 'start': 20, 'count': 20},
    },
}


def topology_path(root):
    return Path(root) / 'campaigns' / CAMPAIGN / 'runner-federation.json'


def worker_count(directory, trial_id):
    if not trial_id.startswith('sg_r1_20260928_'):
        return 20
    directory = Path(directory).resolve()
    require(directory.name == trial_id and directory.parent.name == 'trials', 'FEDERATION_TRIAL_PATH')
    path = topology_path(directory.parent.parent)
    if not path.exists():
        return 20
    require(json.loads(path.read_text(encoding='utf-8')) == TOPOLOGY, 'FEDERATION_TOPOLOGY_CHANGED')
    return 40


def group_range(group, capacity):
    require(group in TOPOLOGY['groups'], 'RUNNER_GROUP_UNKNOWN')
    item = TOPOLOGY['groups'][group]
    require(item['start'] + item['count'] <= capacity, 'RUNNER_GROUP_DISABLED')
    return range(item['start'], item['start'] + item['count'])
