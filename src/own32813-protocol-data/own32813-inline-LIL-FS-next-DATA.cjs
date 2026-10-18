'use strict';
const data=require('./own32813-inline-LIL-FS-source-DATA.json');
const baseQP=Function('return ('+data.sourceQP.baseQP.source+')')(),e={prototype:{QP:baseQP}},ownQP=Function('e','return ('+data.sourceQP.ownQP.source+')')(e);
exports.createOwn32813InlineLocalNext=function({localRounds,need}){return Object.freeze({afterInlineLil({model,parsed,replayMode,nativeMax}){
 need(model&&parsed.KA&&parsed.Ch&&Array.isArray(parsed.Ch.nn),'ACTUAL_COMBINED_FREE_LIL');need(replayMode===false&&typeof nativeMax==='boolean','ACTUAL_NORMAL_NATIVE_STATE');
 const w=model.w;need(w.Xa&&Number.isSafeInteger(w.Xa.Gd)&&w.Xa.Gd>=0&&Array.isArray(w.kb)&&w.kb.length>0,'ACTUAL_NATIVE_FREE_STATE');
 // Source Rka saves the current real FS state and pre-local reels before Uka expands inline local data.
 w.rc.Xa={...w.Xa};w.rc.kb=w.kb.slice();localRounds.call(model,parsed);
 const localCount=parsed.Ch.nn.length,expandedCount=w.kb.length;
 w.Xa.Ui=true;w.Xa.Gd=parsed.Ch.QB-1;w.Xa.wn=0;
 const duringLocal=ownQP.call({w,bma:{$g:replayMode}});need(duringLocal===false,'PENDING_LOCAL_CANNOT_END');
 // Request-only projection of actual WA restoration, not execution or synthesis of a UI callback.
 w.kb.length=0;if(w.rc.Xa){w.Xa=w.rc.Xa;w.rc.Xa=null;}w.kb=w.rc.kb;w.rc.kb=[];
 // Native gP can defer max while LIL displays; its actual local exit reinstates the original native max.
 w.state.Fd=nativeMax;
 const ended=ownQP.call({w,bma:{$g:replayMode}});
 return Object.freeze({event:ended?'EndGame':'Logic',action:ended?'PLAY':'FREE_SPIN',sourceLocalSpins:localCount,sourceProtocolSpinCount:expandedCount,sourceRestoredBaseSpinCount:w.kb.length,restoredFreeRemaining:w.Xa.Gd,sourcePendingLocalCloseAllowed:duringLocal,sourceQPAfterRestore:ended,actualEndACK:false,roundComplete:false,requestNotSent:true,noDisplayCallbackExecuted:true});
 }});};
