import {stable} from './mongo-writer.mjs';

// Derive solely from this CAS attempt's freshly read document. Arrays are
// replaced whole. Unsafe paths or large changes retain the original full CAS.
export function stateDelta(before,after){
 const set={},unset=[],safe=k=>/^[A-Za-z0-9_-]{1,128}$/.test(k)&&!['__proto__','prototype','constructor'].includes(k);
 let refused=false;
 const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
 function walk(a,b,path){
  if(a===b)return;
  if(path.length>16){refused=true;return;}
  if(object(a)&&object(b)){
   for(const key of new Set([...Object.keys(a),...Object.keys(b)])){
    if(!safe(key)){refused=true;continue;}
    const next=[...path,key];
    if(!Object.hasOwn(b,key))unset.push(next.join('.'));
    else if(!Object.hasOwn(a,key))set[next.join('.')]=b[key];
    else walk(a[key],b[key],next);
   }
  }else if(stable(a)===stable(b))return;
  else if(path.length)set[path.join('.')]=b;
  else refused=true;
 }
 walk(before,after,[]);
 const delta={set,unset};
 if(refused||Object.keys(set).length+unset.length===0||Object.keys(set).length+unset.length>64
   ||Buffer.byteLength(JSON.stringify(delta))>64*1024)return null;
 return delta;
}
