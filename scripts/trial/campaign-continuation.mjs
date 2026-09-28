export function canContinueAfterChildFailure(status,gameId,limit) {
  return Number(limit || '0')===0 && status.protocolParkingEnabled===true
    && status.globalPaused===false && (
      status.activeGame===gameId && status.reason==='ACTIVE_GAME_REQUIRES_REVIEW'
      || status.parkedGames?.includes(gameId)===true);
}
