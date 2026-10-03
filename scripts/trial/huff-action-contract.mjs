import {protocolHash as hash} from '../runner-v2/protocol-resume.mjs';
export const HUFF_SOURCE='huffnpuffmoneymansionhighlimit96-round-one-base-v1';
export const ACTION_VERSION='huff-action-v1';
export const ACTION_CONTRACT={schema:'sg-action-contract-v1',gameId:32714,sourceKey:HUFF_SOURCE,
  protocol:'nextgen',version:ACTION_VERSION,betRaw:500,
  clientHash:'67bcebfd2f16477c8c3b2686b6e10b70f41bde3579d929e89e04e321ffa4e93d',
  supportedActions:['BET','FREE_GAME'],featureIds:[0,1,2,3,4],
  classification:'independent-journal',terminal:'counters-and-client-exits-and-reconciled-wallet'};
export const ACTION_CONTRACT_HASH=hash(ACTION_CONTRACT);
