'use strict';
// Own32816 only: immutable static audio inputs; no SG session, transport, response or DB access.
const assert=require('node:assert/strict'),crypto=require('node:crypto');
exports.createOwn32816QualifiedPCMCache=function({certificates,loadDecoder}) {
 assert(certificates instanceof Map&&typeof loadDecoder==='function','Own32816 explicit qualified codec inputs');
 const memo=new Map();let tail=Promise.resolve(),decodes=0,hits=0;
 const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
 function decodeCompleteOwnVorbis(bytes,options) {
  assert(bytes instanceof Uint8Array&&/^[a-f0-9]{64}$/.test(options?.expectedSHA256),'Own32816 actual encoded bytes and certified input hash');
  const raw=Buffer.from(bytes.buffer,bytes.byteOffset,bytes.byteLength),key=options.expectedSHA256,cert=certificates.get(key);
  assert(cert&&sha(raw)===key,'Own32816 qualified static audio input changed');
  if(memo.has(key)){hits++;return memo.get(key);}
  const task=tail.then(async()=>{
   // This is the original codec's real format check, including actual cached non-OGG403 bodies.
   assert.equal(raw.toString('ascii',0,4),'OggS','Invalid Ogg capture pattern');
   assert(cert.realPCMInput===true,'Own32816 no certified PCM input for this static response');
   const codec=await loadDecoder();assert(typeof codec.OggVorbisDecoder==='function','Own32816 actual qualified Vorbis codec export');
   const decoder=new codec.OggVorbisDecoder();let decoded;
   try{await decoder.ready;decoded=await decoder.decodeFile(raw);decodes++;}
   finally{decoder.free();}
   assert(Array.isArray(decoded.errors)&&decoded.errors.length===0,'Own32816 actual codec errors');
   assert(decoded.samplesDecoded===cert.samplesDecoded&&decoded.sampleRate===cert.sampleRate&&
    decoded.channelData.length===cert.channels,'Own32816 actual PCM dimensions changed');
   for(const channel of decoded.channelData)assert(channel instanceof Float32Array&&channel.length===cert.samplesDecoded,'Own32816 real PCM channel required');
   return Object.freeze({channelData:decoded.channelData,samplesDecoded:decoded.samplesDecoded,
    sampleRate:decoded.sampleRate,channels:decoded.channelData.length,duration:decoded.samplesDecoded/decoded.sampleRate,
    inputSHA256:key,realPCMDecoded:true,retainedCertificationReused:true,
    pcmSHA256ByChannel:cert.pcmSHA256ByChannel.slice(),PCMCertificationSummaryReusedNotRecomputed:true});
  });
  // Rejected actual static inputs remain cached; no automatic second decoder attempt.
  task.catch(()=>{});memo.set(key,task);tail=task.then(()=>{},()=>{});return task;
 }
 return Object.freeze({decodeCompleteOwnVorbis,status:()=>({gameId:'32816',memoEntries:memo.size,runtimePCMDecodes:decodes,cacheHits:hits,
  structuralOrPCMCertificationsRepeated:0,networkClientIncluded:false,DBAccess:0})});
};
