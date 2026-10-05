"""Independent local candidate; preserves the historical source identity."""
import copy,json,pathlib,re,sys
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent))
from record_fields import execute

def candidate(r,b,p):
 assert p['gameId']==32723 and p['runtimeGameId']==33123 and p['trialId']=='sg_r1_20260928_32723' and p['target']==299850
 assert p['runtimeSlug']=='labomba96' and p['sourceKey']=='labomba96-round-one-base-v1' and p['campaignId']=='sg_round_one_20260928'
 assert p['adapter']=='native-nextgen-v1' and p['buy']==0 and p['betRaw']==125
 assert all(b[k]==p[k] for k in ['gameId','runtimeGameId','trialId','runtimeSlug']) and b['database']=='sg_labomba96' and 'queueId' not in b
 assert b['rtp'] and all(type(v) is int and v>=0 for v in b['rtp']) and b['rtp']==sorted(set(b['rtp']))
 assert r['fixtureOnly'] is False and r['raw']['fixtureOnly'] is False and r['raw']['sourceKey']==p['sourceKey']
 assert all(r[k]==p[k] for k in ['trialId','gameId','runtimeGameId'])
 assert re.fullmatch('[a-f0-9]{64}',r['_id']) and re.fullmatch('[a-f0-9]{64}',r['contentHash'])
 assert type(r['sequence']) is int and 1<=r['sequence']<=p['target'] and type(r['batchId']) is int and r['batchId']>=1
 assert type(r['shardId']) is int and 0<=r['shardId']<20
 f=r['normalized'];m=f['money'];steps=r['raw']['steps']
 assert f['sourceKey']==p['sourceKey'] and f['typeMappingHash']==b['typeMappingHash'] and f['roundFieldsVersion']=='sg-round-fields-v1'
 assert all(r[k]==f[k] for k in ['bet','mul','buy','bonus','roundFieldsVersion']) and f['buy']==0
 assert (f['primaryBonusKind'],f['bonus']) in [('none',0),('freeGame',1)]
 assert all(type(m[k]) is int and m[k]>=0 for k in ['startBalanceRaw','endBalanceRaw','betRaw','totalWinRaw'])
 assert m['betRaw']==125 and m['endBalanceRaw']==m['startBalanceRaw']-125+m['totalWinRaw'] and f['bet']==m['betRaw']/100
 assert f['mul']==m['totalWinRaw']/m['betRaw'] and steps and steps[-1]['responseBalance']==m['endBalanceRaw']
 return {'_id':r['_id'][:24],'bonus':f['bonus'],'buy':f['buy'],'bet':f['bet'],'mul':f['mul'],'rtp':copy.deepcopy(b['rtp']),'gameId':p['runtimeGameId'],
  'data':{'gameId':p['runtimeGameId'],'runtimeSlug':p['runtimeSlug'],'startBalance':m['startBalanceRaw']/100,'endBalance':m['endBalanceRaw']/100,
   'totalWin':m['totalWinRaw']/100,'roundFieldsVersion':f['roundFieldsVersion'],'money':copy.deepcopy(m),'stepCount':len(steps),
   'msgIds':[s['msgId'] for s in steps],'steps':copy.deepcopy(steps),'primaryBonusKind':f['primaryBonusKind'],
   'specialKinds':[] if f['primaryBonusKind']=='none' else [f['primaryBonusKind']],'enhancedBetLevel':0,'enhancedBetLabel':'','isFreeChoiceRound':False,
   'freeChoiceOptionIndex':0,'freeChoiceOptionCount':0,'captureSourceCampaignId':p['campaignId'],'captureNativeShardId':r['shardId'],
   'captureBatchId':r['batchId'],'captureSequence':r['sequence'],'captureRecordId':r['_id'],'captureContentHash':r['contentHash'],
   'captureTrialId':r['trialId'],'captureTransformVersion':'sg-historical-simulate-candidate-v1'}}

if __name__=='__main__':
 for line in sys.stdin.buffer:
  try:
   assert len(line)<=8*1024*1024
   q=json.loads(line);assert set(q)=={'plan','binding','records'}
   records=q['records'];assert isinstance(records,list) and 1<=len(records)<=100 and len({r['_id'] for r in records})==len(records)
   docs=[]
   for r in records:
    assert execute({'op':'verify','plan':q['plan'],'raw':r['raw'],'record':r})=={'verified':True}
    docs.append(candidate(r,q['binding'],q['plan']))
   print(json.dumps({'ok':True,'result':docs},separators=(',',':')),flush=True)
  except Exception:
   print(json.dumps({'ok':False,'error':'OWN_HISTORICAL_CANDIDATE_REJECTED'}),flush=True)
