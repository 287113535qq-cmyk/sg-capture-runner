import {loadCountPermission} from './complete-count.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
// Cache only immutable activation journals, after full validation succeeds.
// Callers still supply a freshly read pool; loadCountPermission checks its ledger.
export function countPermissionReader({store}){
 let accepted=null;
 return async ({pool,plan,commit})=>{
  const binding=hash({plan,commit,specHash:pool.countAllocation?.specHash});
  const cached=accepted?.binding===binding?accepted.rows:new Map(),rows=new Map();
  const journalStore={get:async(collection,key)=>{
   if(collection!=='journal')throw Error('COUNT_CACHE_SCOPE');
   const row=cached.has(key)?structuredClone(cached.get(key)):await store.get(collection,key);
   if(row)rows.set(key,structuredClone(row));return row;
  }};
  try{const spec=await loadCountPermission({store:journalStore,plan,pool,commit});accepted={binding,rows};return spec;}
  catch(error){accepted=null;throw error;}
 };
}
