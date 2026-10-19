'use strict';
exports.validateOwn32754ConnectionInputs=function(game,need){
 const cfg=game?.sg,p=cfg?.own32754ProtocolDATA,h=cfg?.header;
 need(String(game?.gameId)==='32754'&&game.dbName==='sg_arthurandtheroundtable'&&cfg?.protocol==='wms'&&cfg.runtimeGameId===32976,'own original game/config');
 need(h&&h.gameID==='20467'&&h.gameCodeRGI==='arthurandtheroundtable'&&h.versionID==='1_0','own native header');
 for(const key of ['affiliate','ccyCode','channel','freePlay','gameCodeRGI','gameID','glsID','lang','userID','userType','versionID'])need(typeof h[key]==='string','actual own Header '+key);
 need(['Y','N'].includes(h.freePlay)&&cfg.betRaw===200&&typeof cfg.endpoint==='string'&&cfg.endpoint.length>0,'actual own paid-unit/endpoint; no defaults');
 need(p&&Object.keys(p).sort().join(',')==='contract,launchParameters,normalRoutePolicy'&&p.contract==='own32754-original-SG-protocol-private-v1'&&p.normalRoutePolicy==='original-private-no-history-no-recovery','closed own protocol profile');
 const l=p.launchParameters;need(l&&Object.keys(l).sort().join(',')==='HistoryServerURL,betID,useDummy','actual declared launch facts only');
 for(const key of ['HistoryServerURL','betID'])need(l[key]===null||typeof l[key]==='string','actual launch string/null '+key);
 need(l.useDummy===false,'native real-source factory');
 const absent=v=>v===null||v==='null';need(absent(l.HistoryServerURL)||absent(l.betID),'no history-replay pair');
 need(!cfg.unknownFreeSessionRecovery&&!cfg.ownMatchedPaidContract,'no replay/reset contracts');
 // Fingerprint source-affecting own inputs; no platform defaults or prior actor.
 return Object.freeze({fingerprint:()=>JSON.stringify({gameId:game.gameId,dbName:game.dbName,sg:{protocol:game.sg.protocol,runtimeGameId:game.sg.runtimeGameId,header:game.sg.header,stake:game.sg.stake,betRaw:game.sg.betRaw,endpoint:game.sg.endpoint,profile:game.sg.own32754ProtocolDATA,unknownFreeSessionRecovery:game.sg.unknownFreeSessionRecovery,ownMatchedPaidContract:game.sg.ownMatchedPaidContract}})});
};
