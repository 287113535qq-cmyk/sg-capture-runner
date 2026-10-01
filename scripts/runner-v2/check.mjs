// Real GitHub -> restricted Mongo-only gateway check. It writes only bounded
// diagnostic metadata in the newly authorized state/journal collections.
import assert from 'node:assert/strict';
import {connectGateway} from './transport.mjs';
import {ResourceGate} from './resource-gate.mjs';
import {RunnerState} from './state-store.mjs';
import {repositories} from '../trial/runner-group.mjs';
import {metadataIoCanary} from './metadata-io-canary.mjs';
import {metadataCompressionCanary} from './metadata-compression-canary.mjs';

const transport=connectGateway(),gate=new ResourceGate();
const store=new RunnerState({transport,gate,deadline:Date.now()+180_000});
try {
  const hello=await transport.request('hello');
  assert.equal(hello.group,repositories[process.env.GITHUB_REPOSITORY].name);
  assert.equal(hello.captureLogicOnServer,false);
  await store.writable();
  const key=`validation:${process.env.GITHUB_RUN_ID}:${process.env.GITHUB_RUN_ATTEMPT}`;
  const value={kind:'gateway-validation',sourceRequests:0,officialRounds:0};
  const journal=await store.create('journal',key,value,{immutable:true});
  assert.deepEqual(journal.value,value);
  const before=await store.create('state',key,{...value,stage:0});
  const updated=await store.cas('state',key,before,{...value,stage:1});assert(updated);
  assert.equal(await store.cas('state',key,before,{...value,stage:2}),null);
  assert.equal((await store.get('state',key)).value.stage,1);
  let deltaMetadataReadback=false,metadataCanary=null,compressionCanary=null;
  if(hello.stateDeltaEnabled===true){
    store.deltaCas=true;
    const deltaKey=key+':delta',initial={stage:0,history:[{retained:true}],worker:{active:true,lease:1},removed:true};
    const beforeDelta=await store.create('state',deltaKey,initial);
    const next={...initial,stage:1,worker:{active:null,lease:2}};delete next.removed;
    const afterDelta=await store.cas('state',deltaKey,beforeDelta,next);assert(afterDelta);
    assert.equal(await store.cas('state',deltaKey,beforeDelta,{...next,stage:99}),null);
    assert.deepEqual((await store.get('state',deltaKey)).value,next);
    deltaMetadataReadback=true;
    if(process.env.SG_METADATA_IO_CANARY==='fixed-lease-v1'){
      metadataCanary=await metadataIoCanary(store,deltaKey);
      const compressedTransport=connectGateway({compression:true});
      try{
        const compressedStore=new RunnerState({transport:compressedTransport,gate});
        compressionCanary=await metadataCompressionCanary(store,compressedStore,deltaKey,
          {checkResource:async()=>assert((await store.sample()).allowed,'COMPRESSION_CANARY_RESOURCE')});
      }finally{compressedTransport.close();}
    }
  }
  console.log(JSON.stringify({gateway:'mongo-only-v2',group:hello.group,resourceGate:gate.status(),
    metadataReadback:true,deltaMetadataReadback,metadataCanary,compressionCanary,staleVersionRejected:true,sourceRequests:0,officialRoundWrites:0}));
} finally {transport.close();}
