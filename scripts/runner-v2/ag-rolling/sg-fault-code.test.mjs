import assert from 'node:assert/strict';
import test from 'node:test';
import {protocolFaultCode} from './sg-fault-code.mjs';
test('semantic protocol assertion survives the generic Node ERR_ASSERTION code',()=>{
 try{assert(false,'SG_REELSTRIP_REJECTED');}catch(error){assert.equal(error.code,'ERR_ASSERTION');assert.equal(protocolFaultCode(error),'SG_REELSTRIP_REJECTED');}
});
test('unknown source and journal acknowledgements retain their distinct stop codes',()=>{
 for(const code of ['SOURCE_NETWORK_OUTCOME_UNKNOWN','JOURNAL_ACK_UNKNOWN'])assert.equal(protocolFaultCode(Object.assign(Error(code),{code})),code);
});
test('fault diagnostics never expose raw messages, sessions or arbitrary error values',()=>{
 for(const error of [{message:'sessionID=private'}, {message:'raw\nXML private',code:'invalid/code'},
  {message:'X'.repeat(101)}, {message:null},undefined])assert.equal(protocolFaultCode(error),'SG_PROTOCOL_STOPPED');
 assert.equal(protocolFaultCode({message:'raw response rejected',code:'ERR_ASSERTION'}),'ERR_ASSERTION');
});
