import assert from 'node:assert/strict';

// The controller subscribes to the parent's source-close message. That
// subscription references Node's IPC channel even after all other cleanup.
// Disconnect only after the existing native, business and parser cleanup;
// this is not process.exit and cannot hide another live handle or child.
export function disconnectClosedController({mode,actor=process}){
 if(mode!=='controller')return {disconnected:false};
 if(actor.connected!==true)return {disconnected:false};
 assert(typeof actor.disconnect==='function','SG_AG_CONTROLLER_IPC_DISCONNECT_REQUIRED');
 actor.disconnect();return {disconnected:true};
}
