import assert from 'node:assert/strict';

// Driver retryReads/retryWrites stay false. A failed driver operation also
// poisons this admitted client, so a later controller pass cannot repeat it.
export function protectMongoOnce(client){
 let stopped=false;
 const wrappers=new WeakMap();
 const stop=error=>{stopped=true;error.outcomeUnknown=true;throw error;};
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
