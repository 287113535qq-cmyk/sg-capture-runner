import assert from 'node:assert/strict';
import {stable} from './mongo-writer.mjs';

const fail=code=>Object.assign(new Error(code),{code});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

export class RunnerState {
  constructor({transport,gate,now=Date.now,sleep=delay,deadline=Infinity}) {
    Object.assign(this,{transport,gate,now,sleep,deadline});this.lastSample=-Infinity;
  }
  async sample() {
    if(this.now()-this.lastSample>=10_000) {
      try {this.gate.observe(await this.transport.request('resources'));this.lastSample=this.now();}
      catch(error){this.gate.observe(null);throw error;}
    }
    return this.gate.status();
  }
  async writable() {
    while(true) {
      if(this.now()>=this.deadline)throw fail('RESOURCE_WAIT_DEADLINE');
      const status=await this.sample();
      if(status.allowed)return;
      // Operator/database/disk holds require explicit recovery, never waiting
      // for CPU percentages to hide the original error.
      if(!String(status.reason).startsWith('RESOURCE_'))throw fail(status.reason || 'WRITES_PAUSED');
      await this.sleep(10_000);
    }
  }
  async get(collection,key) {return this.transport.request('read',{collection,key});}
  async create(collection,key,value,{immutable=false}={}) {
    await this.writable();
    const result=await this.transport.request('create',{collection,key,value});
    if(result.created)return {version:0,value};
    const old=await this.get(collection,key);
    assert(old,'CREATE_READBACK_MISSING');
    if(immutable && stable(old.value)!==stable(value))throw fail('JOURNAL_CONTENT_CONFLICT');
    return old;
  }
  async cas(collection,key,before,value) {
    await this.writable();
    const result=await this.transport.request('cas',{collection,key,version:before.version,value});
    return result.replaced?{version:result.version,value}:null;
  }
  async update(collection,key,change,{tries=40}={}) {
    for(let i=0;i<tries;i++) {
      const before=await this.get(collection,key);if(!before)throw fail('STATE_MISSING');
      const value=await change(structuredClone(before.value));
      if(value===null)return before;
      const after=await this.cas(collection,key,before,value);if(after)return after;
      await this.sleep(Math.min(250,10+i*10));
    }
    throw fail('STATE_CONTENTION');
  }
}

// Allocation, ownership, and lease arithmetic happen here on GitHub. MongoDB
// only executes get/create/CAS against documents scoped by the trusted key.
export class RunnerPool {
  constructor({store,plan,group,now=Date.now}) {
    Object.assign(this,{store,plan,group,now});this.key='pool:'+plan.trialId;
    assert(['primary','secondary'].includes(group));
  }
  checkWorker(worker) {
    const offset=this.group==='primary'?0:20;
    if(!Number.isInteger(worker) || worker<offset || worker>=offset+20)throw fail('WORKER_GROUP_MISMATCH');
  }
  async register(worker,identity) {
    this.checkWorker(worker);
    assert(/^[a-f0-9]{64}$/.test(identity.sessionHash));
    assert(typeof identity.owner==='string' && identity.owner.length>0 && identity.owner.length<=180);
    let epoch;
    await this.store.update('state',this.key,value=>{
      if(!value.enabled || value.failure)throw fail('POOL_PAUSED');
      const old=value.workers[String(worker)];
      if(old && old.sessionHash!==identity.sessionHash)throw fail('SESSION_CHANGED');
      if(Object.entries(value.workers).some(([id,w])=>id!==String(worker)&&w.sessionHash===identity.sessionHash))throw fail('SHARED_SESSION');
      if(old && old.owner===identity.owner && old.leaseUntil>this.now()){epoch=old.epoch;return null;}
      if(old && old.leaseUntil>this.now())throw fail('WORKER_BUSY');
      // A new process must review any previous batch before claiming source
      // ownership. Expiry alone never authorizes reuse of an unknown intent.
      if(old?.activeBatch)throw fail('BATCH_RESUME_REVIEW_REQUIRED');
      epoch=(old?.epoch || 0)+1;
      value.workers[String(worker)]={sessionHash:identity.sessionHash,owner:identity.owner,epoch,
        leaseUntil:this.now()+600_000,activeBatch:null};return value;
    });
    return {worker,owner:identity.owner,epoch};
  }
  owned(value,lease) {
    const worker=value.workers[String(lease.worker)];
    if(!worker || worker.owner!==lease.owner || worker.epoch!==lease.epoch || worker.leaseUntil<=this.now())throw fail('LEASE_LOST');
    return worker;
  }
  async take(lease) {
    this.checkWorker(lease.worker);let batch=null;
    await this.store.update('state',this.key,value=>{
      const worker=this.owned(value,lease);
      if(!value.enabled || value.failure)throw fail('POOL_PAUSED');
      if(worker.activeBatch){batch=worker.activeBatch;return null;}
      if(value.nextSequence>this.plan.target){batch=null;return null;}
      const remaining=this.plan.target-value.nextSequence+1;
      const size=Math.min(100,Math.ceil(remaining/20),remaining);
      batch={id:value.nextBatchId,worker:lease.worker,start:value.nextSequence,end:value.nextSequence+size-1};
      value.nextBatchId++;value.nextSequence=batch.end+1;worker.activeBatch=batch;
      worker.leaseUntil=this.now()+600_000;return value;
    });
    return batch;
  }
  async heartbeat(lease) {
    await this.store.update('state',this.key,value=>{
      const worker=this.owned(value,lease);
      if(worker.leaseUntil-this.now()>570_000)return null;
      worker.leaseUntil=this.now()+600_000;return value;
    });
  }
  async complete(lease,batch,proof) {
    // proof must be calculated from the persisted queue and full Mongo readback
    // by the caller on GitHub; never from a workflow log or highest sequence.
    assert(proof.pending===null && proof.confirmed===batch.end-batch.start+1 && proof.fullReadback===true);
    await this.store.update('state',this.key,value=>{
      const worker=this.owned(value,lease);
      if(worker.activeBatch?.id!==batch.id)throw fail('BATCH_OWNER_MISMATCH');
      value.confirmed+=proof.confirmed;worker.activeBatch=null;return value;
    });
  }
}
