"""Observed fifteen-free trigger, separate mapping; no old-profile authorization."""
import xml.etree.ElementTree as ET
from pyramids_major_review import PyramidsMajorSequence, SOURCE
from pyramids_mixed_review import has_mixed,review_mixed_sequence
from round_fields import params,check,amount
EXTENSION=SOURCE+'-pyramids-fifteen-free-v1'
def has_fifteen(raw):
    return raw.get('sourceKey')==SOURCE and bool(raw.get('steps')) and params(raw['steps'][0]['responsePayload']).get('TFG')=='15'
class PyramidsFifteenSequence(PyramidsMajorSequence):
    reviewed_free_total=15
def review_fifteen(plan,raw):
    check(has_fifteen(raw),'PYRAMIDS_FIFTEEN_REQUIRED')
    for s in raw['steps']:
        text=s.get('responseXml');check(isinstance(text,str) and len(text)<262144 and '<!DOCTYPE' not in text.upper() and '<!ENTITY' not in text.upper(),'INVALID_TRIAL_XML')
        try:r=ET.fromstring(text)
        except ET.ParseError:check(False,'INVALID_TRIAL_XML')
        check(r.tag.upper()=='GDMRESPONSE' and len(r.findall('SUCCESS'))==len(r.findall('PAYLOAD'))==1
              and len(r.find('SUCCESS'))==len(r.find('PAYLOAD'))==0
              and r.findtext('SUCCESS').lower()=='true' and r.findtext('PAYLOAD')==s['responsePayload'],'TRIAL_XML_EVIDENCE_MISMATCH')
        p=params(s['responsePayload']);check(amount(raw['startBalanceRaw'])-amount(p['B'])+amount(p['TW'])==20,'PYRAMIDS_FIFTEEN_MONEY')
    if has_mixed(raw):return review_mixed_sequence(plan,raw,free_total=15)
    parser=PyramidsFifteenSequence(plan);next_request=parser.sequence(raw)
    if next_request:return {'complete':False,'next':'FREE_GAME','sourceRequests':0,'captureAuthorized':False}
    return parser.settled(raw)
