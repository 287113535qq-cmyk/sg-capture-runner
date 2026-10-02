"""Independent SFGT ten-free cash scope. Natural trigger, synthetic terminal.

Reuse reviewed counters and money; do not infer mixed, jackpot or retrigger routes.
"""
import xml.etree.ElementTree as ET
from pyramids_free_review import PyramidsFreeSequence, SOURCE
from round_fields import check, params

EXTENSION = SOURCE + '-pyramids-super-free-v1'

def has_super_free(raw):
    return raw.get('sourceKey') == SOURCE and any('SFGT~1' in params(s['responsePayload']).get('GSD','').split('#') for s in raw.get('steps',[]))

class PyramidsSuperFreeSequence(PyramidsFreeSequence):
    extra_gsd = {'SFGT'}

    def validate_gsd(self, gsd, index):
        check(gsd.get('SFGT') == '1' if index == 0 else gsd.get('SFGT','0') in {'0','1'}, 'PYRAMIDS_SUPER_FREE_FLAG')
        super().validate_gsd(gsd,index)

    def sequence(self, raw):
        for step in raw.get('steps',[]):
            xml = step.get('responseXml')
            check(isinstance(xml,str) and len(xml)<262144 and '<!DOCTYPE' not in xml.upper() and '<!ENTITY' not in xml.upper(), 'PYRAMIDS_SUPER_FREE_XML')
            try: root = ET.fromstring(xml)
            except ET.ParseError: check(False,'PYRAMIDS_SUPER_FREE_XML')
            success,payload,rc = root.findall('SUCCESS'),root.findall('PAYLOAD'),root.findall('OGS_RC')
            check(root.tag=='GDMRESPONSE' and len(rc)<=1 and len(root)==2+len(rc) and len(success)==len(payload)==1
                  and not list(success[0]) and not list(payload[0]) and (success[0].text or '').lower()=='true'
                  and payload[0].text==step['responsePayload'] and all(not list(r) and r.text=='0' for r in rc), 'PYRAMIDS_SUPER_FREE_XML')
        return super().sequence(raw)
