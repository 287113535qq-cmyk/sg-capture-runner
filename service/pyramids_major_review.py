"""Observed free CL=-3: additive mapping; counters, XML and money remain inherited."""
from pyramids_free_review import PyramidsFreeSequence, SOURCE
from round_fields import params, check
EXTENSION = SOURCE + '-pyramids-free-major-v1'

def has_major(raw):
    for step in raw.get('steps', []):
        gsd = params(step['responsePayload']).get('GSD', '')
        for item in gsd.split('#'):
            if item.startswith('CL~') and any(row.split(';')[2:3] == ['-3'] for row in item[3:].split('|')):
                return True
    return False

class PyramidsMajorSequence(PyramidsFreeSequence):
    # The inherited parser validates all geometry before isolating unknown symbols.
    # Original protocol and XML are checked directly, without substitution.
    reviewed_major = True
