"""Complete traffic/money evidence, independent of optional gameplay analysis.

Only a separately admitted action-profile can create these records. Existing
records use their original adapter and hashes; no legacy classification is
invented for a new unclassified complete round.
"""
from native_nextgen_fields import NativeNextgenFields
from pyramids_flow_review import review_pyramids_flow
from pyramids_fields import PyramidsFields
from pyramids_action_fields import PyramidsActionFields as HistoricalActionFields
from pyramids_action_fields import ACTION_VERSION as HISTORICAL_VERSION, CONTRACT_HASH as HISTORICAL_HASH
from pyramids_hold_review import SOURCE
from round_fields import check, params, amount
from store import digest

ACTION_VERSION = 'pyramids-action-v2'
EVIDENCE_VERSION = 'sg-round-evidence-v2'
CONTRACT = {
    'schema': 'sg-action-contract-v1', 'gameId': 32721,
    'sourceKey': SOURCE, 'protocol': 'nextgen', 'betRaw': 20,
    'version': ACTION_VERSION,
    'clientHash': 'fd11152a04daf94fa730bcdd4a4309085fb5a7d1aac93c7a1a8c055369942cfc',
    'supportedActions': ['BET', 'FREE_GAME'],
    'classification': 'independent-journal',
    'entryMode': 'direct-layered-bet-v1',
}
CONTRACT_HASH = digest(CONTRACT)


class PyramidsDirectActionFields(NativeNextgenFields):
    def scope(self, raw):
        check(self.plan.get('featureProfile') == ACTION_VERSION
              and self.plan.get('gameId') == 32721
              and self.plan.get('sourceKey') == SOURCE
              and self.plan.get('betRaw') == 20
              and self.plan.get('actionContractHash') == CONTRACT_HASH,
              'ACTION_PROFILE_REQUIRED')
        check(raw.get('requestFlowVersion') == ACTION_VERSION
              and raw.get('actionContractHash') == CONTRACT_HASH,
              'ACTION_RAW_CONTRACT_REQUIRED')

    def next_request(self, raw):
        self.scope(raw)
        if not raw.get('steps'):
            check(raw.get('steps') == [] and amount(raw.get('startBalanceRaw')) >= 20,
                  'ACTION_START_REQUIRED')
            return {'MSGID': 'BET'}
        return review_pyramids_flow(self.plan, raw, direct_layered_entry=True)['next']

    def settled(self, raw):
        if raw.get('requestFlowVersion') == HISTORICAL_VERSION:
            historical_plan = {**self.plan, 'featureProfile': HISTORICAL_VERSION, 'actionContractHash': HISTORICAL_HASH}
            return HistoricalActionFields(historical_plan).settled(raw)
        if 'requestFlowVersion' not in raw:
            # Old full records retain their exact legacy classification.
            return PyramidsFields(self.plan).settled(raw)
        self.scope(raw)
        result = review_pyramids_flow(self.plan, raw, direct_layered_entry=True)
        check(result['terminalCandidate'] and result['next'] is None,
              'ACTION_INCOMPLETE_ROUND')
        last = params(raw['steps'][-1]['responsePayload'])
        start, end, win = amount(raw['startBalanceRaw']), amount(last['B']), amount(last['TW'])
        check(amount(last['AB']) == end and start - end + win == 20,
              'ACTION_UNRECONCILED_SETTLEMENT')
        return {
            'roundFieldsVersion': EVIDENCE_VERSION, 'protocol': 'nextgen',
            'sourceKey': SOURCE, 'bet': 20 / 100, 'mul': win / 20,
            'buy': 0, 'bonus': None, 'primaryBonusKind': None,
            'classificationStatus': 'pending', 'typeMappingHash': CONTRACT_HASH,
            'requestFlowVersion': ACTION_VERSION,
            'money': {'startBalanceRaw': start, 'endBalanceRaw': end,
                      'totalWinRaw': win, 'betRaw': 20},
        }
