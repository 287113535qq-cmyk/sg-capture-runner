"""Pyramids isolated HoldNSpin and ten-free routes; old Hold mapping preserved."""
from native_nextgen_fields import NativeNextgenFields
from pyramids_hold_review import PyramidsHoldSequence, SOURCE
from pyramids_free_review import PyramidsFreeSequence, EXTENSION, feature_type
from round_fields import check, params, derive
from pyramids_major_review import has_major, PyramidsMajorSequence
from pyramids_mixed_review import has_mixed, review_mixed_sequence
from pyramids_fifteen_review import has_fifteen,review_fifteen
from pyramids_super_hold_review import has_super_hold,PyramidsSuperHoldSequence
from pyramids_super_free_review import has_super_free,PyramidsSuperFreeSequence
from pyramids_retrigger_review import has_retrigger,PyramidsRetriggerSequence


def hold_type(raw):
    return len(raw['steps']) > 1 or params(raw['steps'][0]['responsePayload']).get('NFG','0') != '0'


class PyramidsFields(NativeNextgenFields):
    def next_request(self, raw):
        if has_retrigger(raw):return PyramidsRetriggerSequence(self.plan).sequence(raw)
        if has_super_free(raw):return PyramidsSuperFreeSequence(self.plan).sequence(raw)
        if has_super_hold(raw):return PyramidsSuperHoldSequence(self.plan).sequence(raw)
        if has_fifteen(raw):
            r=review_fifteen(self.plan,raw)
            return None if r['complete'] else {'MSGID':'FREE_GAME'}
        if has_mixed(raw):
            result=review_mixed_sequence(self.plan,raw)
            return None if result['complete'] else {'MSGID':result['next']}
        if feature_type(raw):return (PyramidsMajorSequence if has_major(raw) else PyramidsFreeSequence)(self.plan).sequence(raw)
        if hold_type(raw):return PyramidsHoldSequence(self.plan).sequence(raw)
        return super().next_request(raw)

    def settled(self, raw):
        check(self.next_request(raw) is None, 'INCOMPLETE_ROUND')
        if has_retrigger(raw) or has_super_free(raw) or has_super_hold(raw) or has_fifteen(raw) or has_mixed(raw):return derive(raw)
        if feature_type(raw):
            (PyramidsMajorSequence if has_major(raw) else PyramidsFreeSequence)(self.plan).settled(raw)
            return derive(raw)
        return super().settled(raw)
