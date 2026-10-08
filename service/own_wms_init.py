"""Independent validation of each game's real, static Init capability tables."""
import hashlib
import json
import pathlib
from round_fields import check, amount
from pearl_fields import one

def digest(v):
    return hashlib.sha256(json.dumps(v,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()

CONTRACT=json.loads((pathlib.Path(__file__).resolve().parents[1]/'config/ag-rolling-own-wms-init-v1.json').read_bytes())
check(digest(CONTRACT)=='ebb98db5f38d18c15ba216906d499acedda988bbc0e1f4854819877b41f77ffa','WMS_INIT_CONTRACT_CHANGED')

def normalize(node,path=''):
    path+='/'+node.tag
    attributes=dict(node.attrib)
    check(not (node.tail or '').strip(),'WMS_INIT_MIXED_TEXT')
    if len(node):check(not (node.text or '').strip(),'WMS_INIT_MIXED_TEXT')
    if path=='/GameResponse/Header':attributes['sessionID']='$SESSION'
    if path=='/GameResponse/Balances/Balance':attributes['value']='$BALANCE'
    return [node.tag,attributes,(node.text or '').strip(),[normalize(c,path) for c in node]]

def own_wms_init(root,game_id,bet_raw):
    if not any(n.tag in ('AwardsInfo','ReelInfo','GameVariantInfo') for n in root):return False
    rule=CONTRACT['games'].get(str(game_id))
    check(rule is not None and rule['gameId']==game_id and rule['betRaw']==bet_raw,'WMS_INIT_OWN_SCOPE')
    check(root.tag=='GameResponse' and root.attrib=={'type':'Init'},'WMS_INIT_MESSAGE')
    header=one(root,'Header')
    check(header.get('gameID')==rule['wmsGameId'] and header.get('versionID')=='1_0' and header.get('isRecovering')=='N','WMS_INIT_IDENTITY')
    session=header.get('sessionID')
    check(isinstance(session,str) and 0<len(session)<=1024,'WMS_SESSION_REQUIRED')
    balances=one(root,'Balances');cash=one(balances,'Balance')
    check(len(balances)==1 and cash.get('name')=='CASH_BALANCE','WMS_BALANCE_MISMATCH');amount(cash.get('value'))
    check(digest(normalize(root))==rule['staticTreeSha256'],'WMS_INIT_STATIC_CHANGED')
    stakes=[n for n in root if n.tag=='Stakes' and n.get('type')=='0']
    check(len(stakes)==1,'WMS_INIT_ORDINARY_STAKES')
    values=[amount(x) for x in (stakes[0].text or '').split('|')]
    check(len(values)==amount(stakes[0].get('count')) and len(values)==len(set(values)) and
          amount(stakes[0].get('defaultIndex'))<len(values) and bet_raw in values,'WMS_INIT_ORDINARY_STAKES')
    return True
