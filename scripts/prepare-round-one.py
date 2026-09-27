"""Build the first-round queue from read-only evidence, never from finish markers."""
import collections
from decimal import Decimal
import hashlib
import json
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'service'))
from native_nextgen_fields import NativeNextgenFields
from round_fields import FieldError, VERSION

ROOT=Path(__file__).resolve().parents[1]
ASSETS=Path('E:/platform-sync/api_new/api.numeric/capture/capture-sg/assets')
CAMPAIGN='sg_round_one_20260928'
def read(path):return json.loads(path.read_text(encoding='utf-8-sig'))
def write(path,obj):path.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def fingerprint(row):
    value=[str(int(Decimal(str(row['data']['startBalance']))*100)),
        [[s.get(k,'') for k in ('msgId','requestPayload','responsePayload','responseXml')] for s in row['data']['steps']]]
    return hashlib.sha256(json.dumps(value,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()

def main():
    inventory=read(ROOT/'.local/round-one-inventory.json')['games']
    launches=read(ASSETS/'sg_launches.json');server=read(ROOT/'.local/round-one-server-inventory.json')
    databases={r['database']:r for r in server['games']}
    registry=read(ROOT/'service/round_types.json');base=read(ROOT/'config/trial-pool.json')
    plans={};queue=[];proofs={};pending_candidates=[]
    for item in inventory:
        gid=item['gameId'];launch=launches[str(gid)];database='sg_'+launch['runtimeSlug']
        row={k:item[k] for k in ('gameId','runtimeGameId','sourceId','name')}
        row.update(targetTotal=300000,historicalDatabase=database,
            historicalDocumentCount=databases.get(database,{}).get('documentCount'),
            creditedHistoricalRounds=0,status='needs-adapter',reason='PROTOCOL_ADAPTER_REVIEW_REQUIRED')
        queue.append(row)
        if gid==32471:
            row.update(status='complete',reason='AUDITED_300000',creditedHistoricalRounds=300000,
                evidence='docs/trial-final-result.json');continue
        if set(item['protocols'])!={'nextgen'} or len(item['requestTemplates'])!=1 or not item['fullFileRead']:
            continue
        if any(set(key.split(','))-{'BET','FREE_GAME'} for key in item['messageSequences']):continue
        if item['freeSelectors']!=['implicit']:continue
        template=item['requestTemplates'][0]
        if set(template)-{'GN','MSGID','AP','BPL','LB','BPR','RB'}:continue
        key=launch['runtimeSlug']+'-round-one-base-v1'
        registry['profiles'][key]={'fixtureOnly':False,'protocol':'nextgen','adapter':'native-nextgen-v1',
            'modeSelectorKeys':['GSD','ABPM'],'modes':[{'buy':0,'kind':'base','selectors':{'GSD':None,'ABPM':None}}],
            'freeSelector':'implicit-single-free-game','freeTypes':{'native-free-game':1},
            'evidence':{'captureGameId':gid,'runtimeGameId':item['runtimeGameId'],'sourceId':item['sourceId']}}
        rows=[json.loads(line) for line in (ASSETS/'sg'/str(gid)/'rounds.jsonl').read_text(encoding='utf-8-sig').splitlines() if line.strip()]
        costs=collections.Counter(int(Decimal(str(r['bet']))*100) for r in rows if r.get('buy')==0 and r.get('bet',0)>0)
        if not costs:continue
        plan={**base,'configured':True,'campaignId':CAMPAIGN,'phase':1,'trialId':f'sg_r1_20260928_{gid}',
            'target':300000,'gameId':gid,'runtimeGameId':item['runtimeGameId'],'name':item['name'],
            'runtimeSlug':launch['runtimeSlug'],'sourceKey':key,'betRaw':costs.most_common(1)[0][0],
            'adapter':'native-nextgen-v1','requestParams':{k:v for k,v in template.items() if k!='MSGID'}}
        pending_candidates.append((row,plan,rows))
    write(ROOT/'service/round_types.json',registry)
    for row,plan,rows in pending_candidates:
        adapter=NativeNextgenFields(plan);accepted=[];errors=collections.Counter();free=0
        for record in rows:
            if record.get('buy')!=0:continue
            data=record['data'];raw={'fixtureOnly':False,'protocol':'nextgen','sourceKey':plan['sourceKey'],
                'roundFieldsVersion':VERSION,'startBalanceRaw':int(Decimal(str(data['startBalance']))*100),
                'steps':[{**s,'elapsedMs':0} for s in data['steps']]}
            try:
                fields=adapter.settled(raw)
                if fields['bet']!=record['bet'] or abs(fields['mul']-record['mul'])>1e-10:raise FieldError('HISTORICAL_FIELDS_MISMATCH')
                accepted.append(fingerprint(record));free+=fields['bonus']>0
            except (FieldError,KeyError,ValueError,TypeError) as error:errors[str(error) if isinstance(error,FieldError) else type(error).__name__]+=1
        row.update(adapterSampleAccepted=len(accepted),adapterSampleFreeRounds=free,adapterSampleErrors=dict(errors))
        # Unknown feature/state or mixed request shapes need their own adapter.
        if errors or free<1 or len(accepted)<10:continue
        row.update(status='ready',reason='NATIVE_NEXTGEN_REPLAY_VERIFIED',trialId=plan['trialId'])
        plans[str(row['gameId'])]=plan
        proofs[row['historicalDatabase']]={'gameId':row['gameId'],'hashes':sorted(set(accepted))}
    # Only publish explicit production profiles that passed their replay review.
    active={p['sourceKey'] for p in plans.values()}
    registry['profiles']={k:v for k,v in registry['profiles'].items() if not k.endswith('-round-one-base-v1') or k in active}
    write(ROOT/'service/round_types.json',registry)
    write(ROOT/'config/round-one-plans.json',plans)
    write(ROOT/'config/round-one.json',{'schema':'sg-round-one-v1','campaignId':CAMPAIGN,'phase':1,
        'targetPerGame':300000,'workers':20,'buy':0,'secondRoundEnabled':False,
        'diskReserveBytes':30*1024**3,'diskFinishReserveBytes':25*1024**3,
        'storagePolicy':'stop-before-new-round-at-reserve','games':queue})
    write(ROOT/'.local/round-one-legacy-proof-hashes.json',proofs)
    print(json.dumps({'games':len(queue),'statuses':dict(collections.Counter(r['status'] for r in queue)),
        'officialRequests':0,'secondRoundEnabled':False,'replayReviewedGames':list(plans)}))

if __name__=='__main__':main()
