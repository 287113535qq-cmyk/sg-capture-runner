'use strict';
function createOwn32816OriginalSGUnitReader(source){
 if(!source||typeof source.has!=='function'||typeof source.readInit!=='function')throw Error('OWN32816_ORIGINAL_UNIT_SOURCE_REQUIRED');
 return function readOwnOriginalUnit({sourceInitFrame,sessionScope,game}){
  if(game?.gameId!=='32816'||game.dbName!=='sg_zeus3_prt'||game.sg?.runtimeGameId!==33176||!source.has(sourceInitFrame)||source.readInit(sessionScope)!==sourceInitFrame||sourceInitFrame.sessionScope!==sessionScope||sourceInitFrame.game!==game)throw Error('OWN32816_ORIGINAL_UNIT_INIT_BINDING');
  return Object.freeze({factor:100,sourceInitFrame,contract:'original-SGWmsSession-raw-cash-and-bet-div100'});
 };
}
module.exports={createOwn32816OriginalSGUnitReader};
