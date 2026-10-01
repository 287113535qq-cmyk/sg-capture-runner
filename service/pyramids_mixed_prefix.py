"""Offline observed Free->Hold prefix only; no capture/import authorization."""
import xml.etree.ElementTree as ET
import re
from pyramids_major_review import PyramidsMajorSequence
from pyramids_hold_review import gsd_fields, KEYS, rows
from round_fields import check,params,amount,VERSION

FREE_KEYS={'BGRS','IIFS','VA','FGRS','CFGC','FGVABN','BGCL','CL','CLBN','FSRS'}
TRIGGER_KEYS=FREE_KEYS|{'FGTS','HCL','HVA'}

def review_prefix(plan,raw,free_total=10):
 check(free_total in (10,15),'MIXED_UNREVIEWED_FREE_TOTAL')
 check(raw.get('fixtureOnly') is False and raw.get('roundFieldsVersion')==VERSION,'MIXED_PROFILE')
 steps=raw.get('steps');check(isinstance(steps,list) and 2<=len(steps)<=free_total+1,'MIXED_PREFIX_LENGTH')
 parser=PyramidsMajorSequence(plan);parser.reviewed_free_total=free_total
 check(parser.sequence({**raw,'steps':steps[:-1]})=={'MSGID':'FREE_GAME'},'MIXED_FREE_PREFIX')
 step=steps[-1];p=params(step['responsePayload']);prior=params(steps[-2]['responsePayload'])
 check(step['msgId']==p.get('MSGID')=='FREE_GAME' and p.get('FID')=='0|1|' and p.get('IFG')=='1','MIXED_TRIGGER')
 q=parser.request_params(step['requestPayload'],'FREE_GAME')
 check(q['PID']==params(steps[0]['requestPayload'])['PID'],'SESSION_CHANGED_MID_ROUND')
 check(p.get('GCT','0')=='0' and p.get('FRBAL','0')=='0'
  and not any(k.startswith(('FS_','NFR_','CFR_','CFP_')) for k in p)
  and not any(k in p for k in ('CFG','ABPM','SB','JPV')),'MIXED_UNREVIEWED_FEATURE')
 text=step.get('responseXml');check(isinstance(text,str) and len(text)<262144
  and '<!DOCTYPE' not in text.upper() and '<!ENTITY' not in text.upper(),'INVALID_TRIAL_XML')
 try:root=ET.fromstring(text)
 except ET.ParseError:check(False,'INVALID_TRIAL_XML')
 check(root.tag.upper()=='GDMRESPONSE' and len(root.findall('SUCCESS'))==len(root.findall('PAYLOAD'))==1
  and len(root.find('SUCCESS'))==len(root.find('PAYLOAD'))==0 and str(root.findtext('SUCCESS')).lower()=='true'
  and root.findtext('PAYLOAD')==step['responsePayload'],'TRIAL_XML_EVIDENCE_MISMATCH')
 check(amount(step.get('elapsedMs'))<=300000,'INVALID_TRIAL_TIMING')
 check(tuple(amount(p.get(k)) for k in ('NFG','TFG','CFGG'))==(6,6,0),'MIXED_HOLD_INITIAL_COUNTER')
 g={}
 for entry in p.get('GSD','').split('#'):
  if not entry:continue
  bits=entry.split('~');check(len(bits)==2 and bits[0] not in g and bits[0] in TRIGGER_KEYS,'MIXED_GSD')
  g[bits[0]]=bits[1]
 check({'FGRS','CFGC','FGTS','CL','CLBN','HCL','HVA','FGVABN'}<=g.keys(),'MIXED_MISSING_GSD')
 free_remaining=amount(g['FGRS']);free_current=amount(g['CFGC']);free_total=amount(g['FGTS'])
 check(free_remaining==amount(prior['NFG'])-1 and free_current==amount(prior['CFGG'])+1
  and free_total==amount(prior['TFG'])==free_total and free_remaining+free_current==free_total,'MIXED_OUTER_COUNTERS')
 parser.validate_gsd({k:v for k,v in g.items() if k in FREE_KEYS},len(steps)-1)
 gsd_fields({'GSD':'#'.join(k+'~'+v for k,v in g.items() if k in KEYS)})
 check(g['CL']==g['CLBN']==g['HCL'],'MIXED_TRIGGER_COIN_SNAPSHOTS')
 for k in {'BGCL','CL','CLBN','HCL'} & g.keys():
  check(not re.search(r'(^|[;|])-0([;|]|$)',g[k]) and all(r[2] in {10,20,40,60,80,100,300,400,600,800} for r in rows(g[k])),'MIXED_UNREVIEWED_COIN_VALUE')
 for s in steps:
  v=params(s['responsePayload']);b,ab,tw=(amount(v.get(k)) for k in ('B','AB','TW'))
  check(amount(raw.get('startBalanceRaw'))-b+tw==plan['betRaw']==20,'MIXED_PREFIX_COST')
 return {'complete':False,'next':'FREE_GAME','phase':'free-entered-hold','outer':{'remaining':free_remaining,'current':free_current,'total':free_total},
  'inner':{'remaining':6,'current':0,'total':6},'sourceRequests':0,'captureAuthorized':False}
