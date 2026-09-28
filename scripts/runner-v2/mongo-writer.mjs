// Candidate GitHub-only write/verification layer. No source transport and no
// workflow activation. Durable queues and distributed write permits are
// mandatory dependencies, not optional in-memory fallbacks.
import assert from 'node:assert/strict';
export const stable=value=>value===null || typeof value!=='object'?JSON.stringify(value):
  Array.isArray(value)?'['+value.map(stable).join(',')+']':
    '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';
const fail=code=>Object.assign(new Error(code),{code});

export class MongoWriter {
  constructor({gate,sink,queue,permits}) {
    assert(gate && typeof gate.status==='function');
    assert(sink && typeof sink.read==='function' && typeof sink.insert==='function');
    assert(queue && typeof queue.assertDurable==='function' && typeof queue.confirm==='function');
    assert(permits && typeof permits.acquire==='function');
    Object.assign(this,{gate,sink,queue,permits});
  }
  compare(expected,rows,{allowMissing=false}={}) {
    if (!Array.isArray(rows)) throw fail('MONGO_READBACK_INVALID');
    const wanted=new Map(expected.map(r=>[r._id,r])),found=new Set();
    for (const row of rows) {
      if (!wanted.has(row._id) || found.has(row._id) || stable(wanted.get(row._id))!==stable(row)) {
        this.gate.hold('MONGO_CONTENT_CONFLICT'); throw fail('MONGO_CONTENT_CONFLICT');
      }
      found.add(row._id);
    }
    const missing=expected.filter(r=>!found.has(r._id));
    if (!allowMissing && missing.length) throw fail('MONGO_ACK_UNKNOWN');
    return missing;
  }
  async deliver(records) {
    if (!Array.isArray(records) || records.length<1 || records.length>100
        || records.some(r=>!r || !/^[a-f0-9]{64}$/.test(r._id)
          || !/^[a-f0-9]{64}$/.test(r.contentHash) || r.fixtureOnly!==false || r.buy!==0)
        || new Set(records.map(r=>r._id)).size!==records.length) throw fail('WRITE_BATCH_INVALID');
    // Snapshot caller data before awaiting, so later mutation cannot change
    // the contents bound to the durable pending queue.
    records=JSON.parse(JSON.stringify(records));
    await this.queue.assertDurable(records);
    let confirmed=0;
    while (confirmed<records.length) {
      const state=this.gate.status();
      if (!state.allowed) return {confirmed,paused:true,reason:state.reason};
      const part=records.slice(confirmed,confirmed+state.maxBatchSize);
      // Always read first, including after a lost insert acknowledgement.
      // No retry of an SG request exists in this module.
      let missing=this.compare(part,await this.sink.read(part.map(r=>r._id)),{allowMissing:true});
      if (missing.length) {
        const permit=await this.permits.acquire();
        if (!permit) return {confirmed,paused:true,reason:'WRITE_CAPACITY_BUSY'};
        try {
          const current=this.gate.status();
          if (!current.allowed) return {confirmed,paused:true,reason:current.reason};
          // Re-read under the distributed write permit to handle a peer that
          // completed the same idempotent batch before this permit arrived.
          missing=this.compare(part,await this.sink.read(part.map(r=>r._id)),{allowMissing:true});
          if (missing.length) {
            if (Buffer.byteLength(JSON.stringify(missing))>8*1024*1024) throw fail('WRITE_BATCH_TOO_LARGE');
            await permit.assertOwned();
            const latest=this.gate.status();
            if (!latest.allowed) return {confirmed,paused:true,reason:latest.reason};
            try { await this.sink.insert(missing); }
            catch { throw fail('MONGO_ACK_UNKNOWN'); }
          }
        } finally { await permit.release(); }
      }
      this.compare(part,await this.sink.read(part.map(r=>r._id)));
      // A complete readback, not Mongo's inserted-count, commits the queue.
      await this.queue.confirm(part);
      confirmed+=part.length;
    }
    return {confirmed,paused:false};
  }
}
