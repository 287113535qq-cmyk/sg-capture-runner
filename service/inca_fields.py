"""Inca bounded ten-free mapping; historical ordinary fields stay unchanged."""
from inca_free_review import IncaSequence, SOURCE, EXTENSION, feature_type
from native_nextgen_fields import NativeNextgenFields
from round_fields import derive, check, params

class IncaFields(IncaSequence):
    def next_request(self, raw):
        if feature_type(raw):
            return self.sequence(raw)
        check(len(raw['steps']) == 1 and params(raw['steps'][0]['responsePayload']).get('NFG','0') == '0', 'UNKNOWN_TRIAL_FEATURE')
        return NativeNextgenFields.next_request(self, raw)

    def settled(self, raw):
        if not feature_type(raw):
            self.next_request(raw)
            return NativeNextgenFields.settled(self, raw)
        super().settled(raw)
        return derive(raw)
