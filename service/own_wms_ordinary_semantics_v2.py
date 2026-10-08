"""Independent exact payout and geometry checks using pinned own Init data."""
import json,pathlib,re
from round_fields import check,amount
from store import digest
CONTRACT_HASH='9a9adb2e7ab6de59cd31318695391bbe8a11d132bc55c3aae8533bf508b40f82'
CONTRACT=json.loads((pathlib.Path(__file__).resolve().parents[1]/'config/ag-rolling-own-wms-ordinary-semantics-v2.json').read_bytes())
check(digest(CONTRACT)==CONTRACT_HASH,'OWN_WMS_SEMANTIC_CONTRACT')

def review_own_payline(game_id,node):
    g=CONTRACT['games'].get(str(game_id))
    check(g is not None and node.tag=='PaylineWin','OWN_WMS_GAME_SCOPE')
    check(set(node.attrib)=={'index','awardIndex','awardTableIndex','winVal'} and not len(node),'OWN_WMS_PAYLINE_SHAPE')
    line,index,table,win=(amount(node.get(k)) for k in ('index','awardIndex','awardTableIndex','winVal'))
    award=g['awards'].get(str(index));layout=g['paylines'].get(str(line))
    check(table==g['awardTableIndex'] and line<g['paylineCount'] and award is not None and layout is not None,'OWN_WMS_PAYLINE_IDENTITY')
    text=node.text or '';check(re.fullmatch(r'(0|[1-9][0-9]*)(\|(0|[1-9][0-9]*))*',text) is not None,'OWN_WMS_POSITION_FORMAT')
    positions=[int(x) for x in text.split('|')]
    check(len(positions)==award['count'] and len(set(positions))==len(positions) and all(0<=x<g['rows']*g['columns'] for x in positions),'OWN_WMS_POSITION_COUNT')
    expected=sorted(sorted(layout,key=lambda x:x%g['columns'])[:award['count']])
    check(positions==expected,'OWN_WMS_POSITION_GEOMETRY')
    quotient,remainder=divmod(award['payoutMicros']*g['payoutScale'],1000000)
    check(remainder==0 and quotient==win,'OWN_WMS_AWARD_AMOUNT')
    return True

def review_cascade_mask(value,positions):
    actual=amount(value)
    check(isinstance(positions,list) and all(type(x) is int and 0<=x<15 for x in positions),'OWN_WMS_MASK_POSITIONS')
    expected=0
    for position in positions:expected|=1<<position
    check(actual<32768 and actual==expected,'OWN_WMS_CASCADE_MASK')
    return True
