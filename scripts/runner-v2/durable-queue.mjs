import assert from 'node:assert/strict';
import {stable} from './mongo-writer.mjs';

export const receiptKey=(trial,sequence)=>`receipt:${trial}:${String(sequence).padStart(6,'0')}`;

// The durable copy is an immutable Mongo journal document. This queue lives on
// GitHub and performs every comparison and checkpoint decision there.
export class DurableQueue {
  constructor({store,plan,batchKey,owner,epoch,readBatch,updateBatch}){
    Object.assign(this,{store,plan,batchKey,owner,epoch});
    this.readBatch=readBatch || (()=>store.get('state',batchKey));
    this.updateBatch=updateBatch || (change=>store.update('state',batchKey,change));
  }
  async append(record) {
    assert.equal(record.trialId,this.plan.trialId);
    return this.store.create('journal',receiptKey(record.trialId,record.sequence),record,{immutable:true});
  }
  async assertDurable(records) {
    const savedRows=await this.store.getMany('journal',records.map(r=>receiptKey(r.trialId,r.sequence)));
    for(const [i,record] of records.entries()) {
      const saved=savedRows[i];
      assert(saved && stable(saved.value)===stable(record),'DURABLE_QUEUE_CONTENT_MISMATCH');
    }
  }
  async confirm(records) {
    await this.updateBatch(batch=>{
      assert(batch.owner===this.owner && batch.epoch===this.epoch,'BATCH_LEASE_LOST');
      for(const r of records) {
        assert(r.trialId===this.plan.trialId && r.batchId===batch.id,'BATCH_RECORD_MISMATCH');
        if(r.sequence<=batch.checkpoint)continue;
        assert.equal(r.sequence,batch.checkpoint+1,'CHECKPOINT_GAP');
        batch.checkpoint=r.sequence;
      }
      return batch;
    });
  }
  async outstanding() {
    const saved=await this.readBatch();assert(saved,'BATCH_MISSING');
    const batch=saved.value,keys=[];
    for(let sequence=batch.checkpoint+1;sequence<=batch.journaled && keys.length<100;sequence++)
      keys.push(receiptKey(this.plan.trialId,sequence));
    if(!keys.length)return [];
    const records=await this.store.getMany('journal',keys);
    assert(records.every(Boolean),'DURABLE_QUEUE_GAP');
    return records.map(x=>x.value);
  }
}

export class WritePermits {
  constructor({store,group,owner,now=Date.now}){Object.assign(this,{store,group,owner,now});this.key='write-permits';}
  async acquire() {
    let id=null;
    const nonce=globalThis.crypto.randomUUID();
    const updated=await this.store.update('state',this.key,value=>{
      // Each account starts at one bulk writer. Limits are migration-owned,
      // bounded, and cannot be changed by a caller's request parameters.
      assert(Number.isInteger(value.limit) && value.limit>=1 && value.limit<=2,'BAD_WRITE_LIMIT');
      id=null;
      for(let i=0;i<value.limit;i++) {
        const item=value.slots[String(i)];
        if(!item || item.until<=this.now()) {
          id=String(i);value.slots[id]={owner:this.owner,nonce,until:this.now()+120_000};return value;
        }
      }
      return null;
    }).catch(error=>{
      if(error.code==='STATE_MISSING')throw new Error('WRITE_LIMITS_NOT_INITIALIZED');
      throw error;
    });
    if(id===null)return null;
    const current=updated.value.slots[id];assert(current.nonce===nonce);
    return {assertOwned:async()=>{
      const saved=await this.store.get('state',this.key),slot=saved?.value.slots[id];
      assert(slot?.nonce===nonce && slot.owner===this.owner && slot.until>this.now(),'WRITE_PERMIT_LOST');
    },release:async()=>{
      await this.store.update('state',this.key,value=>{
        if(value.slots[id]?.nonce!==nonce)return null;
        delete value.slots[id];return value;
      });
    }};
  }
}
