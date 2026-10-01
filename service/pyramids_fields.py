"""Pyramids isolated HoldNSpin and ten-free routes; old Hold mapping preserved."""
from native_nextgen_fields import NativeNextgenFields
from pyramids_hold_review import PyramidsHoldSequence, SOURCE
from pyramids_free_review import PyramidsFreeSequence, EXTENSION, feature_type
from round_fields import check, params, derive
from pyramids_major_review import has_major, PyramidsMajorSequence


def hold_type(raw):
    return len(raw['steps']) > 1 or params(raw['steps'][0]['responsePayload']).get('NFG','0') != '0'


class PyramidsFields(NativeNextgenFields):
    def next_request(self, raw):
        if feature_type(raw):return (PyramidsMajorSequence if has_major(raw) else PyramidsFreeSequence)(self.plan).sequence(raw)
        if hold_type(raw):return PyramidsHoldSequence(self.plan).sequence(raw)
        return super().next_request(raw)

    def settled(self, raw):
        check(self.next_request(raw) is None, 'INCOMPLETE_ROUND')
        if feature_type(raw):
            (PyramidsMajorSequence if has_major(raw) else PyramidsFreeSequence)(self.plan).settled(raw)
            return derive(raw)
        return super().settled(raw)
