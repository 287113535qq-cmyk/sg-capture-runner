// Context only: never log task payloads, records, raw exceptions or credentials.
const contexts=new WeakMap();
export async function diagnoseResumeTask({game,kind,index},operation){
 try{return await operation();}
 catch(error){
  try{
   if(/^32[0-9]{3}$/.test(game?.gameId)&&['canary','worker'].includes(kind)
    &&Number.isInteger(index)&&index>=1&&index<=(kind==='canary'?2:20)){
    contexts.set(error,Object.freeze({schema:'sg-resume-task-diagnostic-v1',gameId:game.gameId,kind,index,
     mutationOutcome:'requires-native-reconciliation'}));
   }
  }catch{/* Preserve original rejection. Context never authorizes replay. */}
  throw error;
 }
}
export const resumeTaskDiagnostic=error=>contexts.get(error);
