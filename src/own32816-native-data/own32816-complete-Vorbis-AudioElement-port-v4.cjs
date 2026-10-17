'use strict';

/* Own 32816 media host DATA. A supplies the actually qualified complete Vorbis decoder. */
exports.createOwn32816DecodedAudioPort=function(d) {
  for(const k of ['createOwnedAudioNode','schedule','readOwnBytes','assertOwnResourceURL',
                  'getOwnQualifiedInput','decodeCompleteOwnVorbis','isDisposed','virtualNow','wallNow']) {
    if(typeof d[k]!=='function')throw Error('OWN32816_AUDIO_HOST_DEPENDENCY_REQUIRED '+k);
  }
  const jobs=new Map(), tags=new Set(), completions=[], failures=[];
  const port={jobs,completions,failures};
  function enqueue(fn,record) {
    if(d.isDisposed())return;
    const virtualDueAt=record.startedVirtualAt+Math.max(0,d.wallNow()-record.startedWallAt);
    d.schedule(function(){if(!d.isDisposed())fn();},{virtualDueAt});
  }
  function fire(el,type,extra) {
    const event=Object.assign({type,target:el,currentTarget:el},extra||{});
    if(typeof el['on'+type]==='function')el['on'+type](event);
    el.dispatchEvent(event);
  }
  function validateFrame(frame,cert) {
    if(!frame || frame.realPCMDecoded!==true || frame.inputSHA256!==cert.inputSHA256 ||
       !Number.isSafeInteger(frame.samplesDecoded) || frame.samplesDecoded<=0 ||
       !Number.isSafeInteger(frame.sampleRate) || frame.sampleRate<=0 ||
       !Array.isArray(frame.channelData) || frame.channelData.length===0 ||
       frame.channels!==frame.channelData.length ||
       frame.duration!==frame.samplesDecoded/frame.sampleRate ||
       !Number.isFinite(frame.duration) || frame.duration<=0 ||
       !frame.channelData.every(ch=>ArrayBuffer.isView(ch) &&
         Object.prototype.toString.call(ch)==='[object Float32Array]' &&
         ch.length===frame.samplesDecoded)) {
      throw Error('OWN32816_COMPLETE_REAL_PCM_FRAME_REQUIRED');
    }
    return frame;
  }
  function AudioElement() {
    const el=d.createOwnedAudioNode();
    Object.setPrototypeOf(el,AudioElement.prototype);
    if(typeof el.addEventListener!=='function'||typeof el.dispatchEvent!=='function')
      throw Error('OWN32816_OWNED_EVENTFUL_AUDIO_NODE_REQUIRED');
    let src='', generation=0, state='empty', frame=null, currentJob=null;
    el.preload='';el.autoplay=false;el.loop=false;el.paused=true;el.ended=false;
    el.muted=false;el.volume=1;el.currentTime=0;el.readyState=0;el.networkState=0;
    el.duration=NaN;el.error=null;
    for(const name of ['onload','onreadystatechange','onerror','onstalled'])el[name]=null;
    Object.defineProperty(el,'src',{
      configurable:true,get:()=>src,
      set:value=>{
        const next=String(value);
        if(next===src)return;
        if(next)d.assertOwnResourceURL(next);
        src=next;generation++;state=next?'selected':'empty';frame=null;currentJob=null;
        el.readyState=0;el.networkState=next?1:0;el.duration=NaN;el.currentTime=0;
        el.paused=true;el.ended=false;el.error=null;
      }
    });
    el.canPlayType=function(mime) {
      const text=String(mime).toLowerCase().replace(/\s/g,'');
      if(text==='audio/ogg')return 'maybe';
      if(text==='audio/ogg;codecs="vorbis"' || text==="audio/ogg;codecs='vorbis'" ||
         text==='audio/ogg;codecs=vorbis')return 'probably';
      return '';
    };
    el.load=function() {
      if(!src || d.isDisposed())return;
      if(currentJob && currentJob.url===src)return;
      if(state==='ready')return;
      const selectedURL=src, selectedGeneration=generation, token={};
      const record={url:selectedURL,state:'decoding',promise:null,
        startedVirtualAt:d.virtualNow(),startedWallAt:d.wallNow()};
      currentJob=record;state='loading';el.networkState=2;
      const promise=Promise.resolve().then(async function() {
        d.assertOwnResourceURL(selectedURL);
        const cert=d.getOwnQualifiedInput(selectedURL);
        if(!cert || String(cert.gameId)!=='32816' ||
           cert.version!=='5.0.4.1-1787670669' || cert.exactOwnURL!==selectedURL ||
           !/^[a-f0-9]{64}$/.test(cert.inputSHA256)) {
          throw Error('OWN32816_EXACT_QUALIFIED_AUDIO_INPUT_REQUIRED');
        }
        const bytes=d.readOwnBytes(selectedURL);
        const decoded=await d.decodeCompleteOwnVorbis(bytes,{expectedSHA256:cert.inputSHA256});
        validateFrame(decoded,cert);
        const privateFrame=Object.assign({},decoded,{
          channelData:decoded.channelData.map(ch=>Float32Array.from(ch)),
          pcmSHA256ByChannel:decoded.pcmSHA256ByChannel.slice()
        });
        return {decoded:privateFrame,inputBytes:bytes.byteLength};
      }).then(function(result) {
        record.state='decoded';
        completions.push({
          url:selectedURL,inputBytes:result.inputBytes,inputSHA256:result.decoded.inputSHA256,
          samplesDecoded:result.decoded.samplesDecoded,sampleRate:result.decoded.sampleRate,
          channels:result.decoded.channels,duration:result.decoded.duration,
          pcmSHA256ByChannel:result.decoded.pcmSHA256ByChannel,
          realPCMDecoded:true
        });
        if(generation!==selectedGeneration||src!==selectedURL||d.isDisposed())return;
        enqueue(function() {
          if(generation!==selectedGeneration||src!==selectedURL)return;
          frame=result.decoded;state='ready';el.duration=frame.duration;
          el.readyState=4;el.networkState=1;el.error=null;
          fire(el,'progress',{loaded:result.inputBytes,total:result.inputBytes,lengthComputable:true});
          /* HTML media uses canplaythrough here; do not force onload or legacy readystatechange. */
          fire(el,'canplaythrough');
        },record);
      }).catch(function(error) {
        record.state='failed';record.error=error;failures.push({url:selectedURL,error});
        if(generation!==selectedGeneration||src!==selectedURL||d.isDisposed())return;
        enqueue(function() {
          if(generation!==selectedGeneration||src!==selectedURL)return;
          state='error';el.readyState=0;el.networkState=3;
          el.error={code:3,message:String(error),originalError:error};
          fire(el,'error',{error});
        },record);
      }).finally(function(){jobs.delete(token);});
      record.promise=promise;jobs.set(token,record);
      /* Native HTMLMediaElement.load() has a void return, not a decoder promise. */
    };
    el.pause=function(){el.paused=true;};
    el.play=function(){
      throw Error('OWN32816_ACTUAL_AUDIO_PLAYBACK_NOT_BOUND');
    };
    Object.defineProperty(el,'buffered',{
      get:()=>({length:frame?1:0,start(i){if(!frame||i!==0)throw RangeError('Audio range');return 0;},
        end(i){if(!frame||i!==0)throw RangeError('Audio range');return frame.duration;}})
    });
    tags.add(el);return el;
  }
  port.AudioElement=AudioElement;
  port.whenCurrentJobsSettled=async function() {
    await Promise.all(Array.from(jobs.values(),x=>x.promise));
  };
  port.status=function() {
    return {pendingActualDecodes:jobs.size,decodedInputs:completions.length,
      failures:failures.length,ownedTags:tags.size,physicalPOSTs:0,playbackBound:false};
  };
  return port;
};
