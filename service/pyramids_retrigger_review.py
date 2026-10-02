"""Independent +10 cash retrigger validation, without source permission."""
import xml.etree.ElementTree as ET
from pyramids_free_review import PyramidsFreeSequence, SOURCE
from round_fields import check, params

EXTENSION = SOURCE + '-pyramids-ten-retrigger-v1'

def has_retrigger(raw):
    steps = raw.get('steps', [])
    return (raw.get('sourceKey') == SOURCE and bool(steps)
            and params(steps[0]['responsePayload']).get('TFG') == '10'
            and any(params(s['responsePayload']).get('TFG', '0').isdigit()
                    and int(params(s['responsePayload']).get('TFG', '0')) > 10 for s in steps[1:]))

class PyramidsRetriggerSequence(PyramidsFreeSequence):
    def validate_counters(self, n, t, c, previous):
        check(10 <= t <= 100 and t % 10 == 0 and n + c == t and 0 <= n <= t and 0 <= c <= t, 'PYRAMIDS_RETRIGGER_COUNTERS')
        if previous is None:
            check(t == 10, 'PYRAMIDS_RETRIGGER_TRIGGER')

    def validate_progress(self, n, t, c, previous):
        pn, pt, pc = previous
        check(pn > 0 and c == pc + 1 and t in (pt,pt+10) and n == pn - 1 + t - pt, 'PYRAMIDS_RETRIGGER_PROGRESS')
        if n == 0:
            check(pn == 1 and pt == t, 'PYRAMIDS_RETRIGGER_TERMINAL')

    def sequence(self, raw):
        for step in raw.get('steps',[]):
            xml = step.get('responseXml')
            check(isinstance(xml,str) and len(xml)<262144 and '<!DOCTYPE' not in xml.upper() and '<!ENTITY' not in xml.upper(), 'PYRAMIDS_RETRIGGER_XML')
            try: root = ET.fromstring(xml)
            except ET.ParseError: check(False,'PYRAMIDS_RETRIGGER_XML')
            success,payload,rc = root.findall('SUCCESS'),root.findall('PAYLOAD'),root.findall('OGS_RC')
            check(root.tag=='GDMRESPONSE' and len(rc)<=1 and len(root)==2+len(rc) and len(success)==len(payload)==1
                  and not list(success[0]) and not list(payload[0]) and (success[0].text or '').lower()=='true'
                  and payload[0].text==step['responsePayload'] and all(not list(r) and r.text=='0' for r in rc), 'PYRAMIDS_RETRIGGER_XML')
        return super().sequence(raw)
