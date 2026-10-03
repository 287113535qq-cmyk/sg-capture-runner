"""Independent FID1 Hard Hat additive review; source admission remains separate."""
import re, xml.etree.ElementTree as ET
from round_fields import check, params, amount, VERSION, FieldError
from free_game_counters import advance_free_game_counters
from feature_state import parse_feature_history, check_feature_wallet
from native_nextgen_fields import NativeNextgenFields
from huff_feature_review import SOURCE, game_state

PLAN={'gameId':32714,'sourceKey':SOURCE,'betRaw':500,'requestParams':
      {'AP':'false','BPR':'25','GN':'huffnpuffmoneymansionhighlimit96','RB':'5'}}
KNOWN={'BRS','BGHHPOS','BMS','HHADD','VA','HHPOS','HHNPOS','CFFGT',
       'CFTFG','PREVFRAMES','CFCFGG','PCFID','FMS','FEAT','FRAMES','CFNFG','FRAMEWINS'}

def numbers(text,separator=','):
    check(isinstance(text,str) and re.fullmatch(r'[0-9]+(?:'+re.escape(separator)+r'[0-9]+)*',text), 'HARDHAT_BOARD')
    return [amount(x) for x in text.split(separator)]

def review(raw):
    check(raw.get('sourceKey')==SOURCE and raw.get('protocol')=='nextgen'
          and raw.get('fixtureOnly') is False and raw.get('roundFieldsVersion')==VERSION,'HARDHAT_PROFILE')
    steps=raw.get('steps');check(isinstance(steps,list) and 0<len(steps)<=100,'HARDHAT_STEPS')
    prior_total=prior_remaining=player=None;retriggers=0
    for i,s in enumerate(steps):
        msg='FREE_GAME' if i else 'BET';check(s.get('msgId')==msg,'HARDHAT_SEQUENCE')
        q=NativeNextgenFields(PLAN).request_params(s.get('requestPayload'),msg)
        check(player is None or player==q['PID'],'HARDHAT_SESSION');player=q['PID']
        p=params(s['responsePayload']);g=game_state(p.get('GSD',''))
        text=s.get('responseXml');check(isinstance(text,str) and len(text)<262144
            and not re.search(r'<!DOCTYPE|<!ENTITY',text,re.I),'HARDHAT_XML')
        root=ET.fromstring(text)
        check(root.tag.upper()=='GDMRESPONSE' and root.findtext('SUCCESS','').lower()=='true'
              and root.findtext('PAYLOAD')==s['responsePayload'],'HARDHAT_XML')
        check(amount(s.get('elapsedMs'))<=300000,'HARDHAT_TIMING')
        check(p.get('MSGID')==msg and p.get('FID') in ('1','1|')
              and p.get('IFG')==str(int(i>0)) and p.get('RID')==str(int(i>0)),'HARDHAT_FEATURE')
        check(not any(k in p for k in ('CFG','ABPM','GCT','SB','FRTR','FRTW','BUY_IN'))
              and not any(k.startswith(('FS_','NFR_','CFR_','CFP_','FR_')) for k in p)
              and p.get('FRBAL','0')=='0','HARDHAT_UNREVIEWED')
        check(set(g)<=KNOWN,'HARDHAT_UNKNOWN_FIELD')
        board=numbers(g.get('VA'));check(len(board)==15 and max(board)<=15,'HARDHAT_BOARD')
        check(not(board.count(13)>=3 and board.count(14)>=6),'HARDHAT_COMBINED_EXIT')
        if 'FRAMEWINS' in g:
            check(len(numbers(g['FRAMEWINS'],'|'))==len(numbers(g.get('FRAMES'),'|'))==15,'HARDHAT_FRAME_EXIT')
        total,remaining,progress=[amount(p.get(k)) for k in ('TFG','NFG','CFGG')]
        check(0<total<100 and total==remaining+progress and progress==i,'HARDHAT_COUNTER')
        if not i:
            check(total==6 and remaining==6 and not g.get('PCFID') and not g.get('FEAT'),'HARDHAT_TRIGGER')
        else:
            check(prior_remaining>0,'HARDHAT_AFTER_END')
            added=amount(g.get('CFFGT'))
            advance_free_game_counters({'total':prior_total,'remaining':prior_remaining,'played':i-1},
                                       {'total':total,'remaining':remaining,'played':progress},added=added,maximum=99)
            # PCFID preserves ordered prior slots; it is not an award counter.
            # Pure Hard Hat slots do not change the independently checked route.
            check(g.get('FEAT')=='HARDHAT','HARDHAT_PREVIOUS_SLOTS')
            try:
                parse_feature_history(g.get('PCFID',''), {1}, maximum=100)
            except FieldError:
                raise FieldError('HARDHAT_PREVIOUS_SLOTS') from None
            check([amount(g.get(k)) for k in ('CFTFG','CFNFG','CFCFGG')]==[total,remaining,progress],'HARDHAT_COUNTER')
            retriggers+=int(added>0)
        prior_total,prior_remaining=total,remaining
        check_feature_wallet(amount(raw['startBalanceRaw']), 500, amount(p['B']),
                             amount(p['AB']), amount(p['TW']), settled=remaining==0,
                             response_balance=amount(s['responseBalance']) if 'responseBalance' in s else None)
    return {'next':'FREE_GAME' if remaining else None,'candidateComplete':remaining==0,
            'retriggers':retriggers,'total':total,'sourceRequests':0,'captureAuthorized':False,
            'naturalTerminalObserved':False}

EXTENSION = SOURCE + '-hard-hat-retrigger-v2'
def has_retrigger(raw):
    if raw.get('sourceKey') != SOURCE:
        return False
    prior_total = None
    for s in raw.get('steps', []):
        p = params(s['responsePayload']);g = game_state(p.get('GSD', ''))
        if bool(re.fullmatch(r'1(?:\|1)+\|?',g.get('PCFID',''))) or g.get('FEAT') == 'HARDHAT' and g.get('CFFGT', '0') not in ('0', ''):
            return True
        total = int(p['TFG']) if re.fullmatch(r'[0-9]+',p.get('TFG','')) else None
        if g.get('FEAT') == 'HARDHAT' and prior_total is not None and total is not None and total > prior_total:
            return True
        prior_total = total
    return False
