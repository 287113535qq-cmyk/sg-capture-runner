import assert from 'node:assert/strict';

// Cleanup may retain an unfinished original, or reconcile an independently
// verified terminal. An abandonment profile cannot also promote a terminal.
export function reconcilesPreparedEvidence(profile){
 assert(['interrupted-abandoned-without-replay','received-terminal-reconciled-without-source']
  .includes(profile?.disposition),'PREPARED_EVIDENCE_DISPOSITION');
 const reconcile=profile.disposition==='received-terminal-reconciled-without-source';
 if(!reconcile)assert((profile.terminalRecords??[]).length===0
  &&(profile.terminalMappings??[]).length===0,'PREPARED_ABANDONMENT_TERMINALS');
 return reconcile;
}
