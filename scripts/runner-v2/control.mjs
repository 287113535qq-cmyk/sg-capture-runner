import assert from 'node:assert/strict';
const fail=code=>Object.assign(new Error(code),{code,category:'storage'});

// The database gateway returns only documents and OS counters. This module,
// running on GitHub, decides whether a new source request may be sent.
export class SourceControl {
  constructor({store,transport,gate,plan}){Object.assign(this,{store,transport,gate,plan});}
  async allowed({newRound=false}={}) {
    await this.store.writable();
    const holds=await this.transport.request('global_holds');
    assert(holds.length===2 && holds.every(Boolean),'GLOBAL_HOLDS_NOT_INITIALIZED');
    if(holds.some(x=>x.value.active))throw fail('GLOBAL_SOURCE_STOPPED');
    const saved=await this.store.get('state','campaign');
    if(!saved?.value.enabled)throw fail('CAMPAIGN_PAUSED');
    if(this.plan && saved.value.activeGame!==this.plan.gameId)throw fail('GAME_NO_LONGER_ACTIVE');
    if(this.plan){
      const pool=(await this.store.get('state','pool:'+this.plan.trialId))?.value;
      if(!pool?.enabled || pool.failure)throw fail('POOL_PAUSED');
    }
    const disk=this.gate.status().metrics?.diskFreeBytes;
    assert(Number.isSafeInteger(disk),'DISK_SAMPLE_REQUIRED');
    if(disk<(newRound?30:25)*1024**3){
      await this.halt('DISK_RESERVE_REQUIRES_REVIEW');throw fail('DISK_RESERVE_REQUIRES_REVIEW');
    }
  }
  async halt(reason,details={}) {
    await this.store.update('state','global-hold',value=>({...value,active:true,reason,details,at:Date.now()}));
  }
}
