import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from xml.sax.saxutils import escape
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from trial_store import TrialStore, SCHEMA, TRIAL
from trial_fields import settled, frame
from store import Rejected
from round_fields import FieldError
from trial_recover import recover
from trial_maintenance import gate

def payload(msg):
    return f'GN=bookofsevens96&PID=gdmgcmexplicit-test-fixture&MSGID={msg}&AP=false&BPL=5&LB=5'

def step(msg='BET',balance=99975,win=0,remaining=0,actual=None):
    response=f'MSGID={msg}&B={balance}&AB={balance if actual is None else actual}&TW={win}&BPL=5&LB=5&FID=0|&IFG={int(msg=="FREE_GAME")}&NFG={remaining}'
    return {'msgId':msg,'requestPayload':payload(msg),'responsePayload':response,
        'responseXml':'<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>'+escape(response)+'</PAYLOAD></GDMRESPONSE>',
        'responseBalance':balance if actual is None else actual,'elapsedMs':12}

def raw(steps=None,start=100000):
    return {'fixtureOnly':False,'protocol':'nextgen','sourceKey':'bookofsevens96-base-v1',
        'roundFieldsVersion':'sg-round-fields-v1','startBalanceRaw':start,'steps':steps or [step()]}

class MemoryMongo:
    def __init__(self):
        self.rows={};self.lose_ack=False;self.inserted=0
    def ensure(self):pass
    def put(self,rows):
        count=0
        for r in rows:
            if r['_id'] in self.rows:
                if self.rows[r['_id']]!=r:raise Rejected('IDENTITY_CONFLICT')
            else:self.rows[r['_id']]=copy.deepcopy(r);count+=1
        self.inserted+=count
        if self.lose_ack:self.lose_ack=False;raise Rejected('TRIAL_MONGO_FAILED')
        return count
    def summary(self):
        rows=list(self.rows.values())
        return {'count':len(rows),'stakeRaw':sum(r['normalized']['money']['betRaw'] for r in rows),
                'winRaw':sum(r['normalized']['money']['totalWinRaw'] for r in rows),
                'sourceFrames':sum(len(r['raw']['steps']) for r in rows),
                'freeRounds':sum(r['bonus']>0 for r in rows),'zeroWinRounds':sum(r['mul']==0 for r in rows)}

class TrialTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(prefix='sg-trial-test-')
        self.root=Path(self.tmp.name).resolve()
        self.assertEqual(self.root.parent,Path(tempfile.gettempdir()).resolve())
        self.clock=[1000.0];self.mongo=MemoryMongo()
        self.store=TrialStore(self.root,self.mongo,lambda:self.clock[0]);self.owner='test-a'
        self.claim()
    def tearDown(self):
        self.store.close();self.assertTrue(self.root.name.startswith('sg-trial-test-'));self.tmp.cleanup()
    def call(self,op,**kw):
        return self.store.dispatch({'schema':SCHEMA,'trialId':TRIAL,'op':op,**kw})
    def claim(self):
        self.lease=self.call('claim',owner=self.owner,sessionHash='a'*64,commitSha='b'*40)
    def own(self):return {'owner':self.owner,'epoch':self.lease['epoch']}
    def begin(self,seq=1,start=100000):
        return self.call('begin',**self.own(),sequence=seq,attempt=f'00000000-0000-0000-0000-{seq:012d}',startBalanceRaw=start,requestPayload=payload('BET'))
    def record(self,seq=1):
        self.begin(seq)
        return self.call('frame',**self.own(),sequence=seq,step=step(),normalized=settled(raw()))
    def reclaim(self):
        self.store.close();self.clock[0]+=601;self.owner+='b'
        self.store=TrialStore(self.root,self.mongo,lambda:self.clock[0]);self.claim()
    def test_files_durable_before_mongo_and_checkpoint(self):
        self.record();s=self.call('status')
        self.assertEqual((s['durable'],s['checkpoint']),(1,0));self.assertFalse(self.mongo.rows)
        self.call('release',**self.own())
        self.assertEqual(self.call('audit')['verifiedFileRounds'],1)
    def test_same_outcome_in_different_rounds_is_not_deduplicated(self):
        self.record(1);self.record(2);self.call('release',**self.own())
        self.assertEqual(len(self.mongo.rows),2)
        self.assertEqual(self.call('audit')['statistics']['count'],2)
    def test_mongo_lost_ack_recovers_idempotently(self):
        self.record();self.mongo.lose_ack=True
        with self.assertRaises(Rejected):self.call('flush',**self.own())
        self.assertEqual(self.call('status')['checkpoint'],0);self.assertEqual(len(self.mongo.rows),1)
        self.reclaim();self.assertEqual(self.lease['checkpoint'],1);self.assertEqual(self.mongo.inserted,1)
        self.call('release',**self.own());self.assertEqual(self.call('audit')['verifiedFileRounds'],1)
    def test_response_journal_survives_crash_before_receipt(self):
        self.begin()
        class Crash(BaseException):pass
        with patch.object(self.store,'_stage',side_effect=Crash):
            with self.assertRaises(Crash):self.call('frame',**self.own(),sequence=1,step=step(),normalized=settled(raw()))
        self.assertEqual(len(self.store.pending()['raw']['steps']),1)
        self.reclaim();self.assertEqual(self.lease['checkpoint'],1);self.assertIsNone(self.lease['pendingRound'])
    def test_partial_file_tail_recovers_without_duplicate_line(self):
        self.begin()
        original=self.store.writer._append_exact
        def broken(path,offset,line):
            with path.open('ab') as f:f.write(line[:31]);f.flush()
            raise OSError('test crash')
        with patch.object(self.store.writer,'_append_exact',side_effect=broken):
            with self.assertRaises(OSError):self.call('frame',**self.own(),sequence=1,step=step(),normalized=settled(raw()))
        self.reclaim();self.call('release',**self.own())
        self.assertEqual(self.call('audit')['verifiedFileRounds'],1)
    def test_unacknowledged_official_intent_halts_instead_of_rebet(self):
        self.begin();self.clock[0]+=601
        with self.assertRaisesRegex(Rejected,'SOURCE_OUTCOME_UNKNOWN'):
            self.call('claim',owner='other',sessionHash='a'*64,commitSha='b'*40)
        self.assertEqual(self.call('status')['status'],'halted')
        with self.assertRaisesRegex(Rejected,'LEASE_LOST'):
            self.call('frame',**self.own(),sequence=1,step=step(),normalized=settled(raw()))
    def test_claim_does_not_steal_live_lease(self):
        with self.assertRaisesRegex(Rejected,'GAME_BUSY'):
            self.call('claim',owner='other',sessionHash='a'*64,commitSha='b'*40)
    def test_unknown_profile_mode_and_wrong_fields_rejected(self):
        bad=raw();bad['steps'][0]['requestPayload']+='&ABPM=1'
        with self.assertRaises(FieldError):settled(bad)
        self.begin();fields=settled(raw());fields['buy']=11
        with self.assertRaisesRegex(Rejected,'PROTOCOL_VALIDATION_FAILED'):
            self.call('frame',**self.own(),sequence=1,step=step(),normalized=fields)
        self.assertEqual(self.call('status')['checkpoint'],0);self.assertFalse(self.mongo.rows)
        self.assertEqual(self.call('status')['pending']['frames'],1)
    def test_free_round_resume_and_final_settlement(self):
        steps=[step(remaining=2),step('FREE_GAME',100000,25,1,99975),step('FREE_GAME',100025,50,0)]
        self.begin();self.call('frame',**self.own(),sequence=1,step=steps[0])
        self.reclaim();self.assertEqual(len(self.lease['pendingRound']['raw']['steps']),1)
        for i,s in enumerate(steps[1:],1):
            self.call('intent',**self.own(),sequence=1,requestPayload=payload('FREE_GAME'))
            fields={'normalized':settled(raw(steps))} if i==2 else {}
            self.call('frame',**self.own(),sequence=1,step=s,**fields)
        self.call('release',**self.own());audit=self.call('audit')
        self.assertEqual(audit['statistics']['freeRounds'],1)
        r=next(iter(self.mongo.rows.values()));self.assertEqual((r['buy'],r['bonus'],r['bet'],r['mul']),(0,1,0.25,2))
    def test_rejected_xml_is_preserved_and_not_counted(self):
        self.begin();s=step();s['responseXml']=s['responseXml'].replace('true','false')
        with self.assertRaisesRegex(Rejected,'PROTOCOL_VALIDATION_FAILED'):
            self.call('frame',**self.own(),sequence=1,step=s)
        self.assertEqual(self.store.pending()['raw']['steps'][0],s);self.assertEqual(self.call('status')['checkpoint'],0)
    def test_storage_failure_releases_for_recovery(self):
        self.record();self.call('fail',**self.own(),category='storage')
        self.owner='new-run';self.claim();self.assertEqual(self.lease['checkpoint'],1)
    def test_session_changed_rejected(self):
        self.call('release',**self.own())
        with self.assertRaisesRegex(Rejected,'TRIAL_SESSION_CHANGED'):
            self.call('claim',owner='new',sessionHash='c'*64,commitSha='b'*40)
    def test_incomplete_round_cannot_release_or_audit(self):
        self.begin();self.call('frame',**self.own(),sequence=1,step=step(remaining=2))
        with self.assertRaisesRegex(Rejected,'ROUND_PENDING'):self.call('release',**self.own())
        with self.assertRaisesRegex(Rejected,'TRIAL_NOT_QUIESCENT'):self.call('audit')
    def test_only_explicit_uncharged_bootstrap_rejection_can_be_reopened(self):
        self.begin();s=step();s['responsePayload']='MSGID=ERROR&EID=ERROR_PROTOCOL_SEQUENCE&AB=100000'
        s['responseXml']='<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>'+escape(s['responsePayload'])+'</PAYLOAD></GDMRESPONSE>'
        with self.assertRaises(Rejected):self.call('frame',**self.own(),sequence=1,step=s)
        result=recover(self.store.root)
        self.assertEqual(result['archivedRejectedAttempts'],1)
        saved=json.loads(self.store.db.execute('SELECT raw FROM rejected_attempts').fetchone()[0])
        self.assertEqual(saved['steps'][0],s);self.assertIsNone(self.store.pending())
        self.assertEqual(self.call('status')['status'],'pending')
    def test_timeout_evidence_cannot_be_cleared_by_bootstrap_recovery(self):
        self.begin();self.call('fail',**self.own(),category='source_network')
        with self.assertRaises(Rejected):recover(self.store.root)
        self.assertIsNotNone(self.store.pending())
    def test_merged_exchange_confirms_previous_and_durably_prepares_next(self):
        self.begin()
        following={'sequence':2,'attempt':'00000000-0000-0000-0000-000000000002','startBalanceRaw':99975,'requestPayload':payload('BET')}
        first=self.call('exchange',**self.own(),sequence=1,step=step(),normalized=settled(raw()),following=following)
        self.assertTrue(first['followingIntentDurable']);self.assertEqual(first['durable'],1)
        self.assertEqual(self.store.pending()['sequence'],2)
        self.assertEqual(self.store.pending()['awaiting'],payload('BET'))
        second=step(balance=99950)
        self.call('exchange',**self.own(),sequence=2,step=second,normalized=settled(raw([second],99975)))
        self.call('release',**self.own());self.assertEqual(self.call('audit')['verifiedFileRounds'],2)
    def test_merged_free_game_does_not_prepare_an_extra_paid_round(self):
        self.begin();first=step(remaining=1)
        result=self.call('exchange',**self.own(),sequence=1,step=first,following={'sequence':1,'requestPayload':payload('FREE_GAME')})
        self.assertFalse(result['complete']);self.assertTrue(result['followingIntentDurable'])
        final=step('FREE_GAME',100025,50,0)
        result=self.call('exchange',**self.own(),sequence=1,step=final,normalized=settled(raw([first,final])))
        self.assertNotIn('followingIntentDurable',result);self.assertIsNone(self.store.pending())
        self.call('release',**self.own());self.assertEqual(self.call('audit')['statistics']['freeRounds'],1)
    def test_invalid_following_intent_preserves_already_received_round(self):
        self.begin()
        with self.assertRaisesRegex(Rejected,'FOLLOWING_ROUND_MISMATCH'):
            self.call('exchange',**self.own(),sequence=1,step=step(),normalized=settled(raw()),following={'sequence':3})
        self.assertEqual(self.call('status')['durable'],1);self.assertIsNone(self.store.pending())
        self.call('release',**self.own());self.assertEqual(self.call('audit')['verifiedFileRounds'],1)
    def test_lost_merged_ack_never_blindly_repeats_the_following_bet(self):
        self.begin();following={'sequence':2,'attempt':'00000000-0000-0000-0000-000000000002','startBalanceRaw':99975,'requestPayload':payload('BET')}
        self.call('exchange',**self.own(),sequence=1,step=step(),normalized=settled(raw()),following=following)
        self.clock[0]+=601
        with self.assertRaisesRegex(Rejected,'SOURCE_OUTCOME_UNKNOWN'):
            self.call('claim',owner='other',sessionHash='a'*64,commitSha='b'*40)
        self.assertEqual(self.call('status')['durable'],1)
    def test_progress_queries_use_bounded_pending_indexes(self):
        for query,index in [('SELECT * FROM receipts WHERE filed=0 ORDER BY sequence','trial_unfiled'),
                            ('SELECT * FROM receipts WHERE filed=1 AND committed=0 ORDER BY sequence LIMIT 100','trial_uncommitted')]:
            plan=' '.join(str(tuple(r)) for r in self.store.db.execute('EXPLAIN QUERY PLAN '+query))
            self.assertIn(index,plan)
    def test_maintenance_finishes_inflight_round_and_blocks_only_next_intent(self):
        self.begin();gate(self.store.root,True)
        self.call('frame',**self.own(),sequence=1,step=step(),normalized=settled(raw()))
        with self.assertRaisesRegex(__import__('sqlite3').IntegrityError,'TRIAL_MAINTENANCE_STOP'):self.begin(2)
        self.assertIsNone(self.store.pending());self.assertEqual(self.call('status')['durable'],1)
        self.call('fail',**self.own(),category='storage');gate(self.store.root,False)
        self.owner='upgraded';self.claim();self.assertEqual(self.lease['checkpoint'],1)
        self.begin(2)

    def journal_record(self,seq=1,**kw):
        self.begin(seq)
        return self.call('exchange_journal',**self.own(),sequence=seq,step=step(),normalized=settled(raw()),**kw)

    def test_durable_journal_recovers_entire_unexported_batch_after_restart(self):
        for seq in range(1,4):self.journal_record(seq)
        s=self.call('status')
        self.assertEqual((s['journaled'],s['durable'],s['checkpoint']),(3,0,0))
        self.assertFalse((self.store.root/'raw.jsonl').exists());self.assertFalse(self.mongo.rows)
        self.reclaim();self.assertEqual(self.lease['checkpoint'],3)
        self.call('release',**self.own());self.assertEqual(self.call('audit')['verifiedFileRounds'],3)

    def test_journal_exports_and_verifies_mongo_at_exact_batch_boundary(self):
        for seq in range(1,100):self.journal_record(seq)
        self.assertEqual(self.call('status')['durable'],0)
        self.journal_record(100)
        s=self.call('status');self.assertEqual((s['journaled'],s['durable'],s['checkpoint']),(100,100,100))
        self.call('release',**self.own());self.assertEqual(self.call('audit')['verifiedFileRounds'],100)

    def test_journal_response_survives_rollback_before_receipt_commit(self):
        class Crash(BaseException):pass
        with patch.object(self.store,'_stage',side_effect=Crash):
            with self.assertRaises(Crash):self.journal_record()
        self.assertEqual(len(self.store.pending()['raw']['steps']),1)
        self.assertIsNone(self.store.pending()['awaiting']);self.assertEqual(self.store.journaled(),0)
        self.reclaim();self.assertEqual(self.lease['checkpoint'],1)

    def test_bad_journal_following_preserves_response_for_recovery(self):
        with self.assertRaisesRegex(Rejected,'FOLLOWING_ROUND_MISMATCH'):
            self.journal_record(following={'sequence':3})
        self.assertEqual(len(self.store.pending()['raw']['steps']),1)
        self.assertEqual(self.store.journaled(),0)
        self.reclaim();self.assertEqual(self.lease['checkpoint'],1)

    def test_journal_lost_ack_does_not_repeat_armed_request(self):
        following={'sequence':2,'attempt':'00000000-0000-0000-0000-000000000002','startBalanceRaw':99975,'requestPayload':payload('BET')}
        result=self.journal_record(following=following)
        self.assertTrue(result['followingIntentDurable'])
        self.assertEqual((result['journaled'],result['durable']),(1,0))
        self.clock[0]+=601
        with self.assertRaisesRegex(Rejected,'SOURCE_OUTCOME_UNKNOWN'):
            self.call('claim',owner='other',sessionHash='a'*64,commitSha='b'*40)
        self.assertEqual(self.store.journaled(),1);self.assertEqual(self.store.pending()['sequence'],2)

    def test_journal_free_round_resume_preserves_paid_round_boundary(self):
        self.begin();first=step(remaining=1)
        self.call('exchange_journal',**self.own(),sequence=1,step=first)
        self.reclaim();self.assertEqual(len(self.lease['pendingRound']['raw']['steps']),1)
        self.call('intent',**self.own(),sequence=1,requestPayload=payload('FREE_GAME'))
        final=step('FREE_GAME',100025,50,0)
        self.call('exchange_journal',**self.own(),sequence=1,step=final,normalized=settled(raw([first,final])))
        self.call('release',**self.own());self.assertEqual(self.call('audit')['statistics']['freeRounds'],1)

    def test_partial_journal_batch_files_recover_without_duplicate_lines(self):
        for seq in range(1,4):self.journal_record(seq)
        original=self.store.writer._append_exact
        def broken(path,offset,line):
            if path.name=='rounds.jsonl':
                with path.open('ab') as f:f.write(line[:31]);f.flush()
                raise OSError('test crash')
            original(path,offset,line)
        with patch.object(self.store.writer,'_append_exact',side_effect=broken):
            with self.assertRaises(OSError):self.call('flush',**self.own())
        self.assertEqual(self.call('status')['durable'],0)
        self.reclaim();self.call('release',**self.own())
        self.assertEqual(self.call('audit')['verifiedFileRounds'],3)

    def test_batch_mongo_lost_ack_does_not_arm_next_request(self):
        for seq in range(1,100):self.journal_record(seq)
        self.mongo.lose_ack=True
        following={'sequence':101,'attempt':'00000000-0000-0000-0000-000000000101','startBalanceRaw':99975,'requestPayload':payload('BET')}
        with self.assertRaisesRegex(Rejected,'TRIAL_MONGO_FAILED'):self.journal_record(100,following=following)
        self.assertIsNone(self.store.pending())
        self.assertEqual(self.call('status')['checkpoint'],0)
        self.reclaim();self.assertEqual(self.lease['checkpoint'],100);self.assertEqual(self.mongo.inserted,100)
        self.call('release',**self.own());self.assertEqual(self.call('audit')['verifiedFileRounds'],100)

    def test_journal_maintenance_stops_cleanly_after_settlement(self):
        self.begin();gate(self.store.root,True)
        following={'sequence':2,'attempt':'00000000-0000-0000-0000-000000000002','startBalanceRaw':99975,'requestPayload':payload('BET')}
        result=self.call('exchange_journal',**self.own(),sequence=1,step=step(),normalized=settled(raw()),following=following)
        self.assertTrue(result['stopRequested']);self.assertNotIn('followingIntentDurable',result)
        self.assertIsNone(self.store.pending())
        self.call('release',**self.own());gate(self.store.root,False)
        self.assertEqual(self.call('audit')['verifiedFileRounds'],1)

if __name__=='__main__':unittest.main()
