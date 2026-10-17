'use strict';
function createOwn32806OriginalSGUnitReader(source){
 if(!source||typeof source.has!=='function'||typeof source.readInit!=='function')throw Error('OWN32806_ORIGINAL_UNIT_SOURCE_REQUIRED');
 return function readOwnOriginalUnit({sourceInitFrame,sessionScope,game}){
  if(game?.gameId!=='32806'||game.dbName!=='sg_spartacus_prt'||game.sg?.runtimeGameId!==33166||!source.has(sourceInitFrame)||source.readInit(sessionScope)!==sourceInitFrame||sourceInitFrame.sessionScope!==sessionScope||sourceInitFrame.game!==game)throw Error('OWN32806_ORIGINAL_UNIT_INIT_BINDING');
  return Object.freeze({factor:100,sourceInitFrame,contract:'original-SGWmsSession-raw-cash-and-bet-div100'});
 };
}
module.exports={createOwn32806OriginalSGUnitReader};
