import copy
import unittest
import xml.etree.ElementTree as E

from round_fields import FieldError
from veryfruity_cash_review import review_ordinary

HEADER = {'affiliate':'0','ccyCode':'','channel':'I','freePlay':'Y','gameCodeRGI':'FIXTURE',
          'gameID':'FIXTURE','glsID':'65535','lang':'en_US','promotions':'N','userID':'null',
          'userType':'C','versionID':'FIXTURE'}


def sample(win=0):
    steps = []
    for index, message in enumerate(('Logic', 'EndGame')):
        request = E.Element('GameRequest', type=message)
        E.SubElement(request, 'Header', HEADER | {'sessionID':'fixture-'+str(index)})
        account = E.SubElement(request, 'AccountData')
        E.SubElement(account, 'CurrencyMultiplier').text = '1'
        if index == 0:
            E.SubElement(request, 'Stake', perLine='1', total='20')
            E.SubElement(request, 'PaylineCount', count='20')
        response = E.Element('GameResponse', type=message)
        E.SubElement(response, 'Header', sessionID='fixture-'+str(index+1), ccyCode='', lang='en_US',
                     gameID='FIXTURE', versionID='FIXTURE', isRecovering='N')
        balances = E.SubElement(response, 'Balances')
        E.SubElement(balances, 'Balance', name='CASH_BALANCE', value=str(980+win))
        if index == 0:
            g = E.SubElement(response, 'GameResult', stake='20', stakePerLine='1', paylineCount='20', totalWin=str(win), betID='fixture')
            E.SubElement(g, 'BGInfo', totalWagerWin=str(win), bgWinnings=str(win), isMaxWin='0', mysterySymbol='0')
            reels = E.SubElement(g, 'ReelResults', numSpins='1')
            spin = E.SubElement(reels, 'ReelSpin', freeSpin='N', reelsetIndex='0', spinIndex='0', spinWins=str(win), winCountPL='1' if win else '0', winCountSC='0')
            E.SubElement(spin, 'ReelStops').text = '1|2|3|4|5'
            if win:
                E.SubElement(spin, 'PaylineWin', index='0', winVal=str(win), awardIndex='0', awardTableIndex='0').text = '0|1|2'
        xml = E.tostring(response, encoding='unicode')
        steps.append({'msgId':message, 'requestPayload':E.tostring(request, encoding='unicode'),
                      'responsePayload':xml, 'responseXml':xml, 'elapsedMs':1})
    return {'startBalanceRaw':1000, 'steps':steps}


def verify(raw):
    return review_ordinary(raw, expected_header=HEADER, stake_per_line='1', payline_count='20')


def edit_response(raw, index, edit):
    root = E.fromstring(raw['steps'][index]['responseXml'])
    edit(root)
    xml = E.tostring(root, encoding='unicode')
    raw['steps'][index]['responseXml'] = raw['steps'][index]['responsePayload'] = xml


class VeryFruityCashTests(unittest.TestCase):
    def test_synthetic_cash_requires_original_endgame_and_never_grants_capture(self):
        for win in (0, 20, 125):
            raw = sample(win)
            before = copy.deepcopy(raw)
            prefix = verify({'startBalanceRaw':1000, 'steps':raw['steps'][:1]})
            self.assertEqual(prefix['nextRequestHypothesis'], 'EndGame')
            self.assertFalse(prefix['endGameAcknowledged'])
            result = verify(raw)
            self.assertTrue(result['endGameAcknowledged'])
            self.assertFalse(result['captureAuthorization'])
            self.assertEqual(result['endBalanceRaw'], 980+win)
            self.assertEqual(raw, before)

    def test_wallet_win_identity_and_unknown_feature_rejected(self):
        edits = [lambda r: r.find('Balances/Balance').set('value', '999'),
                 lambda r: r.find('GameResult').set('totalWin', '21'),
                 lambda r: r.find('GameResult/BGInfo').set('isMaxWin', '1'),
                 lambda r: r.find('GameResult/BGInfo').set('mysterySymbol', '3'),
                 lambda r: E.SubElement(r.find('GameResult'), 'FSInfo'),
                 lambda r: E.SubElement(r.find('GameResult'), 'BonusWin'),
                 lambda r: r.find('Header').set('gameID', 'wrong'),
                 lambda r: r.find('GameResult/ReelResults/ReelSpin/PaylineWin').set('winVal', '20tail'),
                 lambda r: setattr(r.find('GameResult/ReelResults/ReelSpin/PaylineWin'), 'text', '0|0|2'),
                 lambda r: setattr(r.find('GameResult/ReelResults/ReelSpin/PaylineWin'), 'text', '0|15'),
                 lambda r: r.append(copy.deepcopy(r.find('Balances'))),
                 lambda r: r.find('GameResult').attrib.pop('totalWin')]
        for edit in edits:
            raw = sample(20)
            edit_response(raw, 0, edit)
            with self.assertRaises(FieldError):
                verify(raw)

    def test_xml_session_stake_and_missing_endgame_proof_rejected(self):
        raw = sample(20)
        raw['steps'][1]['requestPayload'] = raw['steps'][1]['requestPayload'].replace('fixture-1', 'fixture-old')
        with self.assertRaisesRegex(FieldError, 'VERYFRUITY_SESSION'):
            verify(raw)
        raw = sample(20)
        raw['steps'][0]['requestPayload'] = raw['steps'][0]['requestPayload'].replace('total="20"', 'total="40"')
        with self.assertRaisesRegex(FieldError, 'VERYFRUITY_REQUEST_STAKE'):
            verify(raw)
        raw = sample(20)
        raw['steps'][1]['responseXml'] = '<!DOCTYPE x><GameResponse/>'
        with self.assertRaises(FieldError):
            verify(raw)
        raw = sample(20)
        edit_response(raw, 1, lambda r: E.SubElement(r, 'GameResult'))
        with self.assertRaises(FieldError):
            verify(raw)


if __name__ == '__main__':
    unittest.main()
