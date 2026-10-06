import assert from 'node:assert/strict';

// Provenance stays process-local and cannot be supplied by a driver message,
// callback or journal. Only a failure caught around an actual driver method
// can be separated from an unknown native metadata outcome by the finalizer.
const businessDriverFailures=new WeakSet();
export const isBusinessDriverFailure=error=>!!error&&typeof error==='object'&&businessDriverFailures.has(error);

// Driver retryReads/retryWrites stay false. A failed driver operation also
// poisons this admitted client, so a later controller pass cannot repeat it.
export function protectMongoOnce(client){
 let stopped=false;
 const wrappers=new WeakMap();
 const stop=error=>{stopped=true;
  // A nested protected call may already carry an unknown native/guard error.
  // Never relabel that error as safe-to-isolate business client failure.
  if(error&&typeof error==='object'){
   if(error.outcomeUnknown!==true)businessDriverFailures.add(error);
   error.outcomeUnknown=true;
  }
  throw error;
 };
 const allowed=()=>assert(!stopped,'SG_AG_MONGO_UNKNOWN_NO_REPLAY');
 function wrap(object){
  if(wrappers.has(object))return wrappers.get(object);
  const proxy=new Proxy(object,{get(target,key){const value=Reflect.get(target,key,target);
   if(typeof value!=='function')return value;
   if(key==='close')return value.bind(target);
   return (...args)=>{allowed();let result;try{result=value.apply(target,args);}catch(error){return stop(error);}
    if(result?.then)return result.catch(stop);
    return result&&typeof result==='object'&&!Array.isArray(result)?wrap(result):result;
   };
  }});wrappers.set(object,proxy);return proxy;
 }
 return {client:wrap(client),assertUsable:allowed,stopped:()=>stopped};
}
