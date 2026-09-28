import copy
import json
from pathlib import Path
import sys
import unittest
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'scripts/runner-v2'))
from record_fields import execute
from prepare_migration import assigned_games
from native_nextgen_fields import NativeNextgenFields


class GithubMigrationTests(unittest.TestCase):
    def test_frozen_record_roundtrip_preserves_hashes_and_rejects_tampering(self):
        plan=json.loads((ROOT/'config/round-one-plans.json').read_text())['32723']
        request='&'.join(f'{k}={v}' for k,v in {**plan['requestParams'],'PID':'gdmgcmfixture','MSGID':'BET'}.items())
        payload=f'MSGID=BET&B={100000-plan["betRaw"]}&AB={100000-plan["betRaw"]}&TW=0&NFG=0&IFG=0&FID=0|'
        xml=ET.Element('GDMRESPONSE');ET.SubElement(xml,'SUCCESS').text='true';ET.SubElement(xml,'PAYLOAD').text=payload
        raw={'fixtureOnly':False,'protocol':'nextgen','sourceKey':plan['sourceKey'],
             'roundFieldsVersion':'sg-round-fields-v1','startBalanceRaw':100000,
             'steps':[{'msgId':'BET','requestPayload':request,'responsePayload':payload,
                       'responseXml':ET.tostring(xml,encoding='unicode'),'elapsedMs':1}]}
        fields=NativeNextgenFields(plan).settled(raw)
        record=execute({'op':'record','plan':plan,'raw':raw,'normalized':fields,
                        'sequence':1,'attempt':'00000000-0000-0000-0000-000000000001',
                        'sessionHash':'a'*64,'worker':0,'batchId':1})
        self.assertEqual(execute({'op':'verify','plan':plan,'raw':raw,'record':record}),{'verified':True})
        def json_number(value):
            if isinstance(value,float) and value.is_integer():return int(value)
            if isinstance(value,dict):return {k:json_number(v) for k,v in value.items()}
            if isinstance(value,list):return [json_number(v) for v in value]
            return value
        self.assertEqual(execute({'op':'verify','plan':plan,'raw':raw,'record':json_number(record)}),{'verified':True})
        bad=copy.deepcopy(record);bad['shardId']=1
        with self.assertRaises(AssertionError):execute({'op':'verify','plan':plan,'raw':raw,'record':bad})

    def test_assignment_preserves_parked_ownership_and_all_178_single_targets(self):
        games=[{'game_id':i,'status':'complete' if i<6 else 'ready'} for i in range(178)]
        games[7]['status']='parked-protocol'
        before={7:'primary',17:'secondary'}
        owners=assigned_games(games,before)
        self.assertEqual(len(owners),178);self.assertEqual(owners[7],'primary');self.assertEqual(owners[17],'secondary')
        self.assertEqual(before,{7:'primary',17:'secondary'})
        self.assertEqual(owners,assigned_games(list(reversed(games)),before))
        with self.assertRaises(AssertionError):assigned_games(games[:-1],before)


if __name__=='__main__':unittest.main()
