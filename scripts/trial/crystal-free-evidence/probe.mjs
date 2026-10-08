// Bounded fresh demo evidence only. No native/business DB imports or writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash,createHmac,randomBytes,publicEncrypt,createCipheriv,constants} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {HEADER,bootstrap,response} from '../../runner-v2/ag-rolling/sg-crystalforest-ordinary-v2.mjs';
import {crystalforestPayload} from '../../runner-v2/ag-rolling/sg-crystalforest-ordinary-source-v2.mjs';
import {PEARL_ENDPOINT,escapeXml} from '../pearl-session.mjs';
import {parseXml,one,children} from '../pearl-protocol.mjs';
import {inspectControl} from './crystal-free-route.mjs';
export const INTENT='sg-crystal-natural-free-evidence-20261008-v12-9ad16301';
const safe=(v,c)=>assert(v,c);
export function playPayload(session){
 const header='<Header '+Object.entries({...HEADER,sessionID:session}).map(([k,v])=>`${k}="${escapeXml(v)}"`).join(' ')+'/>';
 return `<GameRequest type="Logic"><AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData>${header}<Stake total="25" fsOn="1" /></GameRequest>`;
}
const shape={GameResponse:['type','Header AccountData Balances GameResult'],Header:['sessionID ccyCode deciSep thousandSep lang gameID versionID fullVersionID isRecovering',''],
 AccountData:['','AccountData CurrencyMultiplier'],CurrencyMultiplier:['',''],Balances:['','Balance'],Balance:['name value',''],GameResult:['stake stakePerLine paylineCount totalWin betID','ReelResults BGInfo FSInfo'],
 ReelResults:['numSpins','ReelSpin'],ReelSpin:['spinIndex reelsetIndex cascadeCount winCountPL winCountSC spinWins freeSpin bonusAwarded','ReelStops Cascade'],
 ReelStops:['',''],Cascade:['index winCountPL winCountSC cascadeWins cascadeMask','PaylineWin'],PaylineWin:['index winVal awardIndex awardTableIndex',''],
 BGInfo:['totalWagerWin bgWinnings baseGameSpinsRemaining isBigBet isMaxWin',''],FSInfo:['fsWinnings freeSpinsTotal freeSpinNumber isMaxWin freeSpinsAwarded','']};
export function controlShape(n){const s=shape[n.tag];safe(s&&Object.keys(n.a).every(k=>s[0].split(' ').includes(k))&&children(n).every(c=>s[1].split(' ').includes(c.tag)),'UNREVIEWED_EVIDENCE_SHAPE');children(n).forEach(controlShape);}
export function encryptedJournal(file,key){
 const fd=fs.openSync(file,'wx'),secret=randomBytes(32);let sequence=0,previous='0'.repeat(64),closed=false;
 const head={schema:'sg-private-evidence-rsa-aesgcm-v1',intent:INTENT,wrappedKey:publicEncrypt({key,oaepHash:'sha256',padding:constants.RSA_PKCS1_OAEP_PADDING},secret).toString('base64')};
 fs.writeSync(fd,JSON.stringify(head)+'\n');fs.fsyncSync(fd);
 return {write(event){safe(!closed,'JOURNAL_CLOSED');const number=++sequence,iv=randomBytes(12),aad=Buffer.from(`${INTENT}:${number}:${previous}`),cipher=createCipheriv('aes-256-gcm',secret,iv);cipher.setAAD(aad);
  const payload=Buffer.from(JSON.stringify(event)),encrypted=Buffer.concat([cipher.update(payload),cipher.final()]);
  const row={sequence:number,previous,iv:iv.toString('base64'),ciphertext:encrypted.toString('base64'),tag:cipher.getAuthTag().toString('base64')};
  previous=createHash('sha256').update(JSON.stringify(row)).digest('hex');fs.writeSync(fd,JSON.stringify({...row,hash:previous})+'\n');fs.fsyncSync(fd);
 },close(){if(!closed){fs.closeSync(fd);secret.fill(0);closed=true;}},get sequence(){return sequence;},get hash(){return previous;}};
}
export async function collect({base,journal,fetchSource,now=Date.now,maxStarts=50,maxRequests=180,budgetMs=180000}){
 safe(base.mode==='demo'&&/^Free:/i.test(base.sessionId)&&typeof base.operatorId==='string'&&base.operatorId.length>0,'DEMO_ONLY');
 safe(typeof fetchSource==='function'&&Number.isInteger(maxStarts)&&maxStarts>=1&&maxStarts<=50&&Number.isInteger(maxRequests)&&maxRequests>=1&&maxRequests<=180&&Number.isInteger(budgetMs)&&budgetMs>0&&budgetMs<=180000,'FIXED_BOUNDS');
 const started=now(),cookies=new Map();let session='Free:'+createHmac('sha256',base.sessionId+'@'+base.operatorId).update(INTENT).digest('hex').slice(0,32),requestNo=0,activeRound=false,uncertain=false,rounds=0,features=0,balance;
 const summary={schema:'sg-crystal-natural-evidence-v1',intent:INTENT,sourceRequests:0,productionRecords:0,databaseWrites:0,captureCredit:0,naturalFeatureTerminals:0};
 async function exchange(msg,payload){
  safe(now()-started<budgetMs&&requestNo<maxRequests,'EVIDENCE_BOUND_REACHED');
  const n=++requestNo,requestAt=now(),requestStarted=performance.now();journal.write({kind:'intent',requestNo:n,msg,payload,atMs:requestAt,activeRound});summary.sourceRequests=n;uncertain=true;
  const h=await fetchSource(PEARL_ENDPOINT,{method:'POST',redirect:'manual',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'text/xml; charset=utf-8',...(cookies.size?{Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; ')}:{})},body:payload});
  const xml=await h.text(),elapsedMs=Math.round(performance.now()-requestStarted);journal.write({kind:'response',requestNo:n,msg,httpStatus:h.status,xml,elapsedMs,atMs:now()});uncertain=false;
  safe(h.ok,'SOURCE_HTTP_REJECTED');safe(xml.length<262144,'RESPONSE_BOUND');
  for(const c of h.headers.getSetCookie?.()??[]){const p=c.split(';')[0],at=p.indexOf('=');if(at>0)cookies.set(p.slice(0,at),p.slice(at+1));}
  const r=response(xml,msg);session=r.session;
  return {ts:new Date(requestAt).toISOString(),msgId:msg,methodName:'GLS:'+msg,requestPayload:payload,responsePayload:xml,responseXml:xml,responseBalance:r.balance,elapsedMs,httpStatus:h.status};
 }
 try{
  const first=session,s=await exchange('Init',crystalforestPayload({MSGID:'Init'},session));
  balance=bootstrap(s,first).balanceRaw;
  while(rounds<maxStarts&&features<2){
   let prior=null,feature=false;const initialBalance=balance;activeRound=true;
   journal.write({kind:'round-start',round:rounds+1,initialBalance,atMs:now()});
   while(true){
    const s=await exchange('Logic',playPayload(session));controlShape(parseXml(s.responseXml));
    const control=inspectControl({gameId:32759,xml:s.responseXml,previous:prior});feature ||= control.feature;prior=control;balance=s.responseBalance;
    journal.write({kind:'control-observation',requestNo,control,atMs:now()});
    if(control.next==='Logic')continue;
    safe(control.next==='EndGame','UNREVIEWED_ACTION');
    const end=await exchange('EndGame',crystalforestPayload({MSGID:'EndGame'},session));const root=parseXml(end.responseXml);controlShape(root);
    safe(JSON.stringify(children(root).map(n=>n.tag))===JSON.stringify(['Header','AccountData','Balances'])&&!one(root,'AccountData').children.length&&end.responseBalance===balance,'ENDGAME_EVIDENCE_CHANGED');
    activeRound=false;rounds++;features+=Number(feature);
    journal.write({kind:'round-end',round:rounds,feature,initialBalance,finalBalance:balance,atMs:now(),independentlyMoneyValidated:false});break;
   }
  }
  summary.status=features?'natural-feature-evidence-collected':'bounded-no-feature';
 }catch(e){summary.status='evidence-stopped';summary.error=typeof e?.message==='string'&&/^[A-Z0-9_]{1,100}$/.test(e.message)?e.message:typeof e?.code==='string'&&/^[A-Z0-9_]{1,100}$/.test(e.code)?e.code:'EVIDENCE_CHECK_FAILED';}
 finally{Object.assign(summary,{completedObservationRounds:rounds,naturalFeatureTerminals:features,activeRound,unknownTransportOutcome:uncertain,elapsedMs:now()-started});journal.write({kind:'closed',summary,atMs:now()});cookies.clear();}
 return summary;
}
export async function assertSingleGithubAttempt(env,fetchGithub=fetch){
 safe(env.GITHUB_ACTIONS==='true'&&env.RUNNER_OS==='Linux'&&env.SG_REVIEWED_RUNNER_ENVIRONMENT==='github-hosted'&&env.GITHUB_REPOSITORY==='287113535qq-cmyk/sg-capture-runner'&&env.GITHUB_RUN_ATTEMPT==='1','REVIEWED_GITHUB_ONLY');
 safe(env.GITHUB_WORKFLOW_REF===`${env.GITHUB_REPOSITORY}/.github/workflows/trial-session-check.yml@refs/heads/sg-crystal-free-evidence-20261008`,'OWN_DIAGNOSTIC_WORKFLOW');
 const url=`https://api.github.com/repos/${env.GITHUB_REPOSITORY}/actions/workflows/trial-session-check.yml/runs?head_sha=${env.GITHUB_SHA}&per_page=100`;
 const r=await fetchGithub(url,{headers:{Authorization:`Bearer ${env.GITHUB_TOKEN}`,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(15000)});safe(r.ok,'GITHUB_READ_REQUIRED');
 const v=await r.json();safe(v.total_count===1&&v.workflow_runs.length===1&&String(v.workflow_runs[0].id)===env.GITHUB_RUN_ID&&v.workflow_runs[0].head_sha===env.GITHUB_SHA,'ONE_DIAGNOSTIC_RUN_ONLY');
}
async function main(){
 console.log(JSON.stringify({stage:'before-request-identity',defaultRunnerEnvironmentPresent:typeof process.env.RUNNER_ENVIRONMENT==='string',reviewedRunnerEnvironment:process.env.SG_REVIEWED_RUNNER_ENVIRONMENT,ownWorkflow:process.env.GITHUB_WORKFLOW_REF==='287113535qq-cmyk/sg-capture-runner/.github/workflows/trial-session-check.yml@refs/heads/sg-crystal-free-evidence-20261008',attempt:process.env.GITHUB_RUN_ATTEMPT}));
 await assertSingleGithubAttempt(process.env);
 fs.mkdirSync('.local/crystal-free-evidence',{recursive:true});const out='.local/crystal-free-evidence',pub=fs.readFileSync(new URL('./evidence-public.pem',import.meta.url));
 safe(createHash('sha256').update(pub).digest('hex')==='47d7727f2e1134a14b6b94ae45793a45034c02df859eba9e1d6e4ebdb87fdfe1','EVIDENCE_KEY_PIN');
 const journal=encryptedJournal(out+'/evidence.jsonl.enc',pub);let summary;
 try{summary=await collect({base:JSON.parse(process.env.SG_TRIAL_DEMO_CONFIG??'{}'),journal,fetchSource:fetch});}
 finally{journal.close();}
 summary.journalCipherSha256=createHash('sha256').update(fs.readFileSync(out+'/evidence.jsonl.enc')).digest('hex');
 summary.journalChainHash=journal.hash;summary.journalRecords=journal.sequence;
 fs.writeFileSync(out+'/summary.json',JSON.stringify(summary,null,2),{flag:'wx'});console.log(JSON.stringify(summary));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.log(JSON.stringify({status:'pre-request-gate-or-evidence-failed',intent:INTENT,error:typeof e?.message==='string'&&/^[A-Z0-9_]{1,100}$/.test(e.message)?e.message:'SAFE_DIAGNOSTIC_UNAVAILABLE'}));process.exitCode=2;});
