"""Read-only historical corpus inventory; never sends a source request."""
import argparse
import collections
import concurrent.futures
import hashlib
import json
from pathlib import Path
from urllib.parse import urlsplit


def inspect_game(item, assets, max_records=2000):
    file=assets/'sg'/str(item['gameId'])/'rounds.jsonl'
    result={**item,'filePresent':file.is_file(),'records':0,'baseRecords':0,'malformed':0,
        'uniqueBaseRecords':0,'protocols':{},'messageSequences':{},'requestTemplates':[],
        'responseKeys':[],'freeSelectors':[],'sourceEndpoints':[]}
    if not file.exists():return result
    before=file.stat();protocols=collections.Counter();messages=collections.Counter()
    identities=set();templates=set();response_keys=set();free_selectors=set();endpoints=set()
    with file.open('rb') as stream:
        for line in stream:
            if max_records and result['records']>=max_records:break
            if not line.strip():continue
            result['records']+=1
            try:
                row=json.loads(line);data=row['data'];steps=data['steps']
                if not isinstance(steps,list) or not steps:raise ValueError()
                if row.get('buy')!=0:continue
                result['baseRecords']+=1
                identities.add(hashlib.sha256(line.strip()).digest())
                protocol='wms' if steps[0].get('msgId')=='Logic' else 'nextgen' if steps[0].get('msgId')=='BET' else 'unknown'
                protocols[protocol]+=1
                # Keep bounded, sanitized protocol observations; never copy a PID,
                # session, response body, cookie or launch URL into the report.
                messages[','.join(sorted(set(str(s.get('msgId')) for s in steps)))]+=1
                if result['baseRecords']<=5000 or len(steps)>2:
                    for step in steps:
                        url=urlsplit(step.get('url',''))
                        if url.hostname:endpoints.add(url.hostname+url.path)
                        if protocol=='nextgen':
                            request=dict(s.split('=',1) for s in step['requestPayload'].split('&') if '=' in s)
                            allowed={'GN','MSGID','AP','BPL','LB','BPR','RB','ABPM','ANTE','CFG','FP','GSD'}
                            public={k:v for k,v in request.items() if k in allowed}
                            if step.get('msgId')=='BET':templates.add(json.dumps(public,sort_keys=True))
                            response=dict(s.split('=',1) for s in step['responsePayload'].split('&') if '=' in s)
                            response_keys.update(response)
                            if step.get('msgId')=='FREE_GAME':free_selectors.add(str(response.get('CFG','implicit')))
            except (ValueError,KeyError,TypeError):result['malformed']+=1
    after=file.stat()
    result.update(uniqueBaseRecords=len(identities),protocols=dict(protocols),messageSequences=dict(messages),
        requestTemplates=[json.loads(x) for x in sorted(templates)],responseKeys=sorted(response_keys),
        freeSelectors=sorted(free_selectors),sourceEndpoints=sorted(endpoints),bytes=after.st_size,
        sampleLimit=max_records,fullFileRead=stream.closed and (not max_records or result['records']<max_records),
        unchangedDuringRead=(before.st_size,before.st_mtime_ns)==(after.st_size,after.st_mtime_ns),
        historicalProtocolAndMongoParityVerified=False)
    return result


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--assets',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True);parser.add_argument('--max-records',type=int,default=2000);args=parser.parse_args()
    games=json.loads(Path('config/games.json').read_text(encoding='utf-8'))
    results=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        pending={executor.submit(inspect_game,g,args.assets,args.max_records):g for g in games}
        for future in concurrent.futures.as_completed(pending):
            row=future.result();results.append(row)
            print(json.dumps({'gameId':row['gameId'],'records':row['records'],'uniqueBaseRecords':row['uniqueBaseRecords'],
                'inspectedGames':len(results),'games':len(games)}),flush=True)
    results.sort(key=lambda g:g['gameId'])
    output={'schema':'sg-round-one-inventory-v1','readOnly':True,'officialRequests':0,'targetPerGame':300000,
        'countsAreNotCompletionProof':True,'games':results}
    args.output.write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
