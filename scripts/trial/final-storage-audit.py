"""Operator-only, read-only final comparison of every Mongo record to its receipt.

Run on the storage server after all capture leases have ended. Never requests SG.
Only aggregate evidence is printed; source responses and credentials stay local.
"""
import bisect
import collections
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
import time

ROOT=Path('/var/lib/sg-capture-runner/trials/bookofsevens_300k_20260927')
TRIAL='bookofsevens_300k_20260927'


def main():
    started=time.time()
    plan=json.loads((ROOT/'parallel.json').read_text())
    specs=[{'id':None,'start':1,'end':plan['prefix']}]+plan['shards']
    connections=[];cursors=[];sizes=[];runs=[];timings=[]
    for spec in specs:
        root=ROOT if spec['id'] is None else ROOT/'shards'/str(spec['id'])
        db=sqlite3.connect(f'file:{root}/state.sqlite3?mode=ro',uri=True)
        db.row_factory=sqlite3.Row;connections.append(db)
        state=db.execute('SELECT * FROM trial WHERE id=1').fetchone()
        assert state['owner'] is None and state['status']!='claimed'
        assert state['durable']==state['checkpoint']==spec['end']
        assert db.execute('SELECT COUNT(*) FROM pending').fetchone()[0]==0
        assert db.execute('SELECT COUNT(*) FROM receipts WHERE committed=1').fetchone()[0]==spec['end']-spec['start']+1
        cursors.append(db.execute('SELECT sequence,payload FROM receipts ORDER BY sequence'))
        sizes.append({'shardId':spec['id'],'rawBytes':(root/'raw.jsonl').stat().st_size,'normalizedBytes':(root/'rounds.jsonl').stat().st_size})
        for r in db.execute('SELECT owner,started,ended,start_checkpoint,end_checkpoint FROM runs ORDER BY started'):
            runs.append({'shardId':spec['id'],'runId':r['owner'].split(':')[0],
                         **{k:r[k] for k in ('started','ended','start_checkpoint','end_checkpoint')}})
        timings.extend(r[0] for r in db.execute('SELECT ms FROM timings'))
    cfg=json.loads(Path('/etc/sg-capture-runner/mongo-auth.json').read_text())
    assert cfg['database']=='sg_capture_staging_v1'
    program=r'''(async()=>{
      const cfg=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
      if(cfg.database!=='sg_capture_staging_v1')throw Error('DATABASE_REJECTED');
      const target=db.getSiblingDB('sg_capture_staging_v1');await target.auth(cfg.user,cfg.password);
      const cursor=target.official_rounds.find({trialId:'bookofsevens_300k_20260927'}).sort({sequence:1}).batchSize(100);
      let count=0;
      while(await cursor.hasNext()){print('SG_RECORD='+JSON.stringify(await cursor.next()));count++;}
      print('SG_AUDIT_END='+count);
    })().catch(()=>{print('SG_AUDIT_FAILED');quit(2);});'''
    process=subprocess.Popen(['docker','exec','-i','mongodb','mongosh','--quiet','--norc','--eval',program],
                             stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,text=True)
    process.stdin.write(json.dumps(cfg));process.stdin.close()
    count=0;ended=False;starts=[s['start'] for s in specs]
    buys=collections.Counter();bonuses=collections.Counter();bets=collections.Counter()
    stats={'stakeRaw':0,'winRaw':0,'sourceFrames':0,'freeGameFrames':0,'freeRounds':0,'zeroWinRounds':0,'maxMul':0,'maxRoundFrames':0}
    sessions=set()
    try:
        for line in process.stdout:
            if line.startswith('SG_AUDIT_END='):
                assert int(line.split('=',1)[1])==count==300000;ended=True;continue
            assert line.startswith('SG_RECORD=') and len(line)<=1048576
            record=json.loads(line.split('=',1)[1]);count+=1
            assert record['sequence']==count and record['fixtureOnly'] is False
            slot=bisect.bisect_right(starts,count)-1
            row=cursors[slot].fetchone()
            assert row is not None and row['sequence']==count
            assert record==json.loads(row['payload']), 'MONGO_RECEIPT_CONTENT_MISMATCH'
            assert record['gameId']==32471 and record['runtimeGameId']==33026
            assert record['bet']==0.25 and record['buy']==0 and record['bonus'] in (0,1)
            buys[str(record['buy'])]+=1;bonuses[str(record['bonus'])]+=1;bets[str(record['bet'])]+=1
            money=record['normalized']['money'];frames=record['raw']['steps']
            stats['stakeRaw']+=money['betRaw'];stats['winRaw']+=money['totalWinRaw']
            stats['sourceFrames']+=len(frames);stats['freeGameFrames']+=sum(s['msgId']=='FREE_GAME' for s in frames)
            stats['freeRounds']+=record['bonus']>0;stats['zeroWinRounds']+=money['totalWinRaw']==0
            stats['maxMul']=max(stats['maxMul'],record['mul']);stats['maxRoundFrames']=max(stats['maxRoundFrames'],len(frames))
            sessions.add(record['sourceSessionHash'])
        assert process.wait(timeout=30)==0 and ended and count==300000
        assert all(c.fetchone() is None for c in cursors)
        assert len(sessions)==21 and stats['sourceFrames']==count+stats['freeGameFrames']
        assert stats['stakeRaw']==7500000
    finally:
        if process.poll() is None:process.kill();process.wait(timeout=10)
        process.stdout.close()
        for db in connections:db.close()
    timings.sort()
    latency={name:timings[min(len(timings)-1,int(len(timings)*fraction))] for name,fraction in [('p50',.5),('p95',.95),('p99',.99)]}
    formal=[r for r in runs if r['runId']=='36329489181']
    assert len(formal)==20 and all(r['ended'] is not None for r in formal)
    formal_start=min(r['started'] for r in formal);formal_end=max(r['ended'] for r in formal)
    formal_count=sum(r['end_checkpoint']-r['start_checkpoint'] for r in formal)
    events=[]
    for r in formal:events.extend([(r['started'],1),(r['ended'],-1)])
    active=peak=0
    for at,change in sorted(events,key=lambda p:(p[0],p[1])):active+=change;peak=max(peak,active)
    result={'schema':'sg-final-storage-content-audit-v1','trialId':TRIAL,'verifiedMongoRecords':count,
      'everyMongoRecordMatchesDurableReceipt':True,'continuousSequence':[1,count],
      'buyDistribution':dict(buys),'bonusDistribution':dict(bonuses),'betDistribution':dict(bets),
      'distinctSourceSessionsIncludingLegacy':len(sessions),'statistics':stats,
      'observedRtpPercent':100*stats['winRaw']/stats['stakeRaw'],'requestLatencyMs':latency,
      'files':sizes,'runs':runs,'formalContinuation':{'githubRunId':36329489181,'rounds':formal_count,
        'startedAtEpoch':formal_start,'endedAtEpoch':formal_end,'elapsedSeconds':formal_end-formal_start,
        'roundsPerSecond':formal_count/(formal_end-formal_start),'peakSimultaneousCaptureLeases':peak},
      'auditSeconds':round(time.time()-started,3),'auditedAtEpoch':time.time(),
      'officialSourceRequestsOnServer':False,'productionGamePoolWrites':False}
    target=ROOT/'final-mongo-content-audit.json'
    with target.with_suffix('.json.tmp').open('w') as handle:
        json.dump(result,handle,indent=2);handle.write('\n');handle.flush();os.fsync(handle.fileno())
    os.replace(target.with_suffix('.json.tmp'),target)
    print(json.dumps(result))


if __name__=='__main__':
    try:main()
    except Exception as error:
        import traceback
        print(json.dumps({'ok':False,'error':'FINAL_STORAGE_AUDIT_FAILED',
                          'exceptionType':type(error).__name__,'line':traceback.extract_tb(error.__traceback__)[-1].lineno}));sys.exit(2)
