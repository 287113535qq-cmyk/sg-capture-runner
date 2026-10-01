"""Offline mixed-chain hypothesis; actual evidence remains an eight-frame prefix.

Bounded additive validator. No capture permission; never resume an old session.
"""
import xml.etree.ElementTree as ET
import re
from pyramids_mixed_prefix import review_prefix,FREE_KEYS
from pyramids_major_review import PyramidsMajorSequence
from pyramids_hold_review import gsd_fields,KEYS,rows
from round_fields import check,params,amount

def review_mixed_sequence(plan,raw,free_total=10):
 check(free_total in (10,15),'MIXED_UNREVIEWED_FREE_TOTAL')
 steps=raw.get('steps');check(isinstance(steps,list) and 2<=len(steps)<=100,'MIXED_STEPS')
 check(all(s.get('methodName')=='processGameMessage' for s in steps),'MIXED_METHOD')
 trigger=next((i for i,s in enumerate(steps) if params(s['responsePayload']).get('FID')=='0|1|'),None)
 check(trigger is not None,'MIXED_TRIGGER_MISSING')
 prefix=review_prefix(plan,{**raw,'steps':steps[:trigger+1]},free_total=free_total)
 parser=PyramidsMajorSequence(plan);outer=dict(prefix['outer']);inner=dict(prefix['inner']);phase='hold'
 first=params(steps[0]['responsePayload']);pid=params(steps[0]['requestPayload'])['PID']
 initial_win=amount(params(steps[trigger]['responsePayload'])['TW']);last_win=initial_win
 first_g={x.split('~',1)[0]:x.split('~',1)[1] for x in first.get('GSD','').split('#') if '~' in x}
 base_coins=first_g.get('BGCL');complete=False
 for index,s in enumerate(steps[trigger+1:],trigger+1):
  check(not complete,'MIXED_FRAME_AFTER_COMPLETE')
  p=params(s['responsePayload']);q=parser.request_params(s['requestPayload'],'FREE_GAME')
  check(q['PID']==pid and s['msgId']==p.get('MSGID')=='FREE_GAME' and p.get('IFG')=='1','MIXED_SESSION_OR_MESSAGE')
  check(p.get('GCT','0')=='0' and p.get('FRBAL','0')=='0' and not any(k.startswith(('FS_','NFR_','CFR_','CFP_')) for k in p)
   and not any(k in p for k in ('CFG','ABPM','SB','JPV')),'MIXED_UNREVIEWED_FEATURE')
  text=s.get('responseXml');check(isinstance(text,str) and len(text)<262144 and '<!DOCTYPE' not in text.upper() and '<!ENTITY' not in text.upper(),'MIXED_XML')
  try:root=ET.fromstring(text)
  except ET.ParseError:check(False,'MIXED_XML')
  check(root.tag.upper()=='GDMRESPONSE' and len(root.findall('SUCCESS'))==len(root.findall('PAYLOAD'))==1
   and len(root.find('SUCCESS'))==len(root.find('PAYLOAD'))==0
   and root.findtext('SUCCESS').lower()=='true' and root.findtext('PAYLOAD')==s['responsePayload'],'MIXED_XML')
  check(amount(s.get('elapsedMs'))<=300000,'MIXED_TIMING')
  b,ab,win=(amount(p.get(k)) for k in ('B','AB','TW'));check(amount(raw['startBalanceRaw'])-b+win==plan['betRaw']==20 and win>=last_win,'MIXED_MONEY')
  g={}
  for entry in p.get('GSD','').split('#'):
   if not entry:continue
   fields=entry.split('~');check(len(fields)==2 and fields[0] not in g,'MIXED_GSD');g[fields[0]]=fields[1]
  n,t,c=(amount(p.get(k)) for k in ('NFG','TFG','CFGG'))
  if phase=='hold':
   check(p.get('FID')=='0|1|' and set(g)<=FREE_KEYS|KEYS|{'FGTS'} and 'SHNST' not in g,'MIXED_HOLD_FEATURE')
   check({'FGTS','FGRS','CFGC','HNS','HNSID','HNSRIDS','HVA','CS'}<=g.keys(),'MIXED_HOLD_FIELDS')
   check(tuple(amount(g[k]) for k in ('FGRS','CFGC','FGTS'))==(outer['remaining'],outer['current'],outer['total']),'MIXED_OUTER_CHANGED_DURING_HOLD')
   parser.validate_gsd({k:v for k,v in g.items() if k in FREE_KEYS},index)
   if 'BGCL' in g:check(base_coins is not None and g['BGCL']==base_coins,'MIXED_BASE_CHANGED')
   # Reuse the isolated Hold's known geometry and +2/+4 mechanics; the free
   # layer's counters remain separate and must not be overwritten by them.
   gsd_fields({'GSD':'#'.join(k+'~'+v for k,v in g.items() if k in KEYS)})
   for k in {'BGCL','CL','CLBN','HCL','HCLBT','HPCL'} & g.keys():
    check(not re.search(r'(^|[;|])-0([;|]|$)',g[k]) and all(r[2] in {10,20,40,60,80,100,300,400,600,800} for r in rows(g[k])),'MIXED_UNREVIEWED_COIN_VALUE')
   check(inner['remaining']>0 and 0<=n<=99 and 6<=t<=98 and 0<=c<=98 and n+c==t
    and c==inner['current']+1 and t-inner['total'] in {0,2,4} and n==inner['remaining']-1+t-inner['total'],'MIXED_HOLD_PROGRESS')
   if n==0:
    check(inner['remaining']==1 and t==inner['total'] and 'HNSTW' in g and win==initial_win+amount(g['HNSTW']),'MIXED_HOLD_PAYOUT')
    phase='free';complete=outer['remaining']==0
   inner={'remaining':n,'current':c,'total':t}
  else:
   check(p.get('FID') in {'1','1|'},'MIXED_SECOND_FEATURE_UNREVIEWED')
   parser.validate_gsd(g,index)
   for k in {'BGCL','CL','CLBN'} & g.keys():
    check(not re.search(r'(^|[;|])-0([;|]|$)',g[k]) and all(r[2] in {10,20,40,60,80,100,300,400,600,800} for r in rows(g[k])),'MIXED_POST_HOLD_UNREVIEWED_COIN')
   if 'BGCL' in g:check(base_coins is not None and g['BGCL']==base_coins,'MIXED_BASE_CHANGED')
   check(outer['remaining']>0 and t==outer['total']==free_total and c==outer['current']+1
    and n==outer['remaining']-1 and n+c==t,'MIXED_FREE_RESUME_PROGRESS')
   check(('FGRS' not in g or amount(g['FGRS'])==n) and ('CFGC' not in g or amount(g['CFGC'])==c),'MIXED_FREE_RESUME_COUNTER')
   outer={'remaining':n,'current':c,'total':t};complete=n==0
  if complete:
   check(ab==b and (s.get('responseBalance') is None or amount(s['responseBalance'])==b),'MIXED_FINAL_BALANCE')
  last_win=win
 result={'complete':complete,'next':None if complete else 'FREE_GAME','outer':outer,'inner':inner,'sourceRequests':0,'captureAuthorized':False}
 if complete:result.update(betRaw=20,endBalanceRaw=amount(params(steps[-1]['responsePayload'])['B']),totalWinRaw=last_win)
 return result


EXTENSION = "hyperchargedpyramidsofra96-round-one-base-v1-pyramids-free-hold-v1"

def has_mixed(raw):
 return any(params(s["responsePayload"]).get("FID")=="0|1|" for s in raw.get("steps", []))
