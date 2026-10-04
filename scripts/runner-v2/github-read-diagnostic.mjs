// Only errors produced by the guarded readers can publish these diagnostics.
// Response bodies, credentials, arbitrary URLs and error text never enter them.
const diagnostics=new WeakMap();
const repositories=['zyzuoyang/sg-capture-runner','287113535qq-cmyk/sg-capture-runner'];
const statuses=['in_progress','queued','pending','waiting','requested'];
function endpoint(path){
 for(const repository of repositories){
  const prefix=`repos/${repository}/actions/runs`;
  if(!path.startsWith(prefix))continue;
  const suffix=path.slice(prefix.length);
  const list=/^\?status=([a-z_]+)&per_page=100$/.exec(suffix);
  if(list&&statuses.includes(list[1]))return {repository,kind:'active-run-list',status:list[1]};
  const run=/^\/([0-9]{1,20})$/.exec(suffix);
  if(run)return {repository,kind:'run',runId:run[1]};
  const jobs=/^\/([0-9]{1,20})\/jobs\?filter=all&per_page=100$/.exec(suffix);
  if(jobs)return {repository,kind:'run-jobs',runId:jobs[1]};
 }
 return {kind:'unclassified-repository-read'};
}
function header(response,name,pattern){
 try{const value=response.headers?.get(name);return typeof value==='string'&&pattern.test(value)?value:undefined;}
 catch{return undefined;}
}
export function withGithubHttpDiagnostic(error,path,response){
 try{
 const evidence={schema:'github-read-http-diagnostic-v1',method:'GET',endpoint:Object.freeze(endpoint(path))};
 if(Number.isInteger(response.status)&&response.status>=100&&response.status<=599)evidence.httpStatus=response.status;
 const headers={};
 for(const name of ['x-ratelimit-limit','x-ratelimit-remaining','x-ratelimit-used','x-ratelimit-reset','retry-after']){
  const value=header(response,name,/^[0-9]{1,16}$/);if(value!==undefined)headers[name]=value;
 }
 const resource=header(response,'x-ratelimit-resource',/^(core|search|graphql|integration_manifest|code_search)$/);
 if(resource!==undefined)headers['x-ratelimit-resource']=resource;
 const requestId=header(response,'x-github-request-id',/^[A-Fa-f0-9]{1,16}(?::[A-Fa-f0-9]{1,16}){1,7}$/);
 if(requestId!==undefined)headers['x-github-request-id']=requestId;
 evidence.headers=Object.freeze(headers);diagnostics.set(error,Object.freeze(evidence));
 }catch{/* Diagnostics must not replace the original rejection. */}
 return error;
}
export function withGithubListDiagnostic(error,path,result){
 try{
 const evidence={schema:'github-run-list-diagnostic-v1',method:'GET',endpoint:Object.freeze(endpoint(path)),
  totalCountIsInteger:Number.isInteger(result.total_count),runsIsArray:Array.isArray(result.workflow_runs)};
 if(Number.isSafeInteger(result.total_count)&&result.total_count>=0)evidence.reportedTotal=result.total_count;
 if(Array.isArray(result.workflow_runs))evidence.returnedRows=result.workflow_runs.length;
 diagnostics.set(error,Object.freeze(evidence));
 }catch{/* Malformed results retain the original failure. */}
 return error;
}
export function githubReadDiagnostic(error){return diagnostics.get(error);}
