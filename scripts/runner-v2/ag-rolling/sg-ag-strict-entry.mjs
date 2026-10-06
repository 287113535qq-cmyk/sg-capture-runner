import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createSgAgFullControlAdapter} from './sg-ag-full-control-adapter.mjs';
import {createProductionSgIo} from './sg-ag-production-io.mjs';
export function createAdmittedStrictControl(context){
 // The private protected launcher must perform its real own Linux 14+9,
 // exact privilege/SSH/entry/evidence and exclusive-GitHub inventory checks
 // before constructing this context. JSON flags are not a substitute.
 assert(typeof context?.admission?.assertActualEntry==='function','SG_AG_STRICT_PROTECTED_ENTRY_REQUIRED');
 const actual=context.admission.assertActualEntry(context);
 assert(!actual?.then&&actual?.actualValidatedEntry===true&&actual.entrySha256===context.approvedEntrySha256,'SG_AG_STRICT_ACTUAL_ENTRY_READBACK');
 const io=createProductionSgIo(context);
 return createSgAgFullControlAdapter({...context,queueId:context.profile.payload.queueId,io});
}
export const strictEntryStatus=Object.freeze({schema:'sg-ag-strict-entry-status-v1',relativeImports:true,actualMongoAndGatewayBindingsImplemented:true,fullOrdinaryBusinessFunctionImplemented:true,sourceAllowance:0,enabled:false,protectedLauncherBound:false,ownExactLinuxVerified:false,productionWalkthroughCompleted:false,newContinuationAllowed:false});
if(process.argv[1]&&fileURLToPath(import.meta.url)===fileURLToPath(new URL('file:'+process.argv[1].replaceAll('\\','/')))){
 console.log(JSON.stringify(strictEntryStatus));
 // This candidate is executable for preauth verification only. It does not
 // read private stdin, construct clients or contact GitHub/Mongo/SSH.
 process.exitCode=process.argv[2]==='--preauth'?0:2;
}
