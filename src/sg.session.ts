// SG wire adapter for the complete AG program. No legacy SG processor imports.
// AG still owns the round loop, feature counters, scheduler, quota and Mongo I/O.
import assert from 'assert';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { XMLParser } from 'fast-xml-parser';
import { AGGameConfig } from './ag.types';
import { AGDiscardedRoundError } from './ag.round';
// SG transport evidence mapped into the unchanged original AG error policy.
// This file never retries a request or changes AG scheduling/round handling.
export type SGFaultCategory = 'recoverable-initialization' | 'protocol' | 'execution-unknown';
export type SGRequestKind = 'initialization' | 'round-start' | 'round-follow-up';
export interface SGRequestEvidence {
    event: string;
    requestKind: SGRequestKind;
    gameplayRequestHasBeenSent: boolean;
    httpStatus?: number;
    ordinal: number;
    responseSHA256?: string;
}

export class SGSourceFault extends Error {
    readonly executionUncertain: boolean;
    readonly retryAction: 'original-ag-new-session' | 'stop-preserve-evidence';
    constructor(readonly category: SGFaultCategory, readonly evidence: Readonly<SGRequestEvidence>) {
        // Original AG treats the exact AG integrity prefix as deterministic.
        // Only an untouched Init session is allowed into its finite retry path.
        const prefix = category === 'recoverable-initialization' ? 'SG initialization temporarily unavailable' : 'AG integrity: SG ' + category;
        super(prefix + ' ' + JSON.stringify({ event: evidence.event, requestKind: evidence.requestKind,
            httpStatus: evidence.httpStatus, ordinal: evidence.ordinal }));
        this.name = 'SGSourceFault';
        this.executionUncertain = category === 'execution-unknown';
        this.retryAction = category === 'recoverable-initialization' ? 'original-ag-new-session' : 'stop-preserve-evidence';
        this.evidence = Object.freeze({ ...evidence });
    }
}

export class SGClosedFreeSessionDiscard extends AGDiscardedRoundError {
    readonly executionUncertain=true;
    readonly oldRequestMayHaveExecuted=true;
    readonly oldRequestReplays=0;
    readonly retryAction='original-ag-discard-then-new-free-session';
    constructor(readonly originalFault:SGSourceFault) {
        super(originalFault.evidence.event);
        this.name='SGClosedFreeSessionDiscard';
        // Do not claim an error-only response or that the old wager failed.
        this.message='SG uncertain Free round sealed; discard and create a new Free session for future samples';
    }
}

const transientInitStatuses = new Set([408, 425, 429, 500, 502, 503, 504]);
function untouchedInit(evidence: SGRequestEvidence): boolean {
    return evidence.event === 'Init' && evidence.requestKind === 'initialization'
        && evidence.ordinal === 1 && evidence.gameplayRequestHasBeenSent === false;
}

export function httpSourceFault(evidence: SGRequestEvidence): SGSourceFault {
    if (!Number.isInteger(evidence.httpStatus) || evidence.httpStatus! < 100 || evidence.httpStatus! > 599
        || (evidence.httpStatus! >= 200 && evidence.httpStatus! < 300)) {
        throw new Error('AG integrity: SG invalid HTTP fault evidence');
    }
    if (untouchedInit(evidence)) {
        return new SGSourceFault(transientInitStatuses.has(evidence.httpStatus!) ? 'recoverable-initialization' : 'protocol', evidence);
    }
    // HTTP status/body alone cannot prove a wager, feature or EndGame was not
    // applied. Keep the request outcome uncertain; never re-send this POST.
    return new SGSourceFault('execution-unknown', evidence);
}

export function transportSourceFault(evidence: SGRequestEvidence): SGSourceFault {
    return new SGSourceFault(untouchedInit(evidence) ? 'recoverable-initialization' : 'execution-unknown', evidence);
}

export function sourceFaultMetadata(fault: SGSourceFault) {
    return { faultCategory: fault.category, requestKind: fault.evidence.requestKind,
        executionUncertain: fault.executionUncertain, retryAction: fault.retryAction,
        ...(fault.evidence.responseSHA256 ? { responseSHA256: fault.evidence.responseSHA256 } : {}) };
}


type WireStep = {msgId: string; requestPayload: string; responsePayload: string; responseBalance?: number; elapsedMs?: number; httpStatus?: number};
type WireTransport = (event: string, payload: string) => Promise<WireStep>;
const xml = new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseAttributeValue:false,parseTagValue:false});
const list = (v: any): any[] => v === undefined ? [] : Array.isArray(v) ? v : [v];
const integer = (v: unknown, name: string): number => {
    assert(typeof v === 'string' && /^\d+$/.test(v), `AG integrity: SG missing ${name}`);
    const n = Number(v); assert(Number.isSafeInteger(n), `AG integrity: SG unsafe ${name}`); return n;
};
const escape = (v: unknown) => String(v).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

function fiveTreasuresBinding(game: AGGameConfig): void {
    assert(game.gameId==='32749' && game.dbName==='sg_fivetreasures'
        && game.sg?.header?.gameCodeRGI==='fivetreasures' && game.sg?.header?.gameID==='20442'
        && game.sg?.runtimeGameId===32971 && game.sg?.betRaw===176
        && game.sg?.fiveTreasuresContract==='five-treasures-own-choice-cash-v4',
        'AG integrity: SG Five Treasures binding');
}

export function validateFiveTreasuresCash(game: AGGameConfig, result: any, priorWager?: number, action?: string): void {
    fiveTreasuresBinding(game);
    const j=result.JackpotInfo;
    assert(j && typeof j==='object' && !Array.isArray(j)
        && Object.keys(j).sort().join('|')==='jackpotIndex|jackpotWinnings',
        'AG integrity: SG Five Treasures jackpot schema');
    const index=integer(j.jackpotIndex,'Five Treasures jackpot index');
    assert(index<4,'AG integrity: SG Five Treasures jackpot index');
    const win=integer(j.jackpotWinnings,'Five Treasures jackpot winnings');
    const total=integer(result.totalWin,'Five Treasures current response win');
    const spins=list(result.ReelResults?.ReelSpin);
    const trigger=!!result.FSInfo&&action==='SPIN'&&integer(result.FSInfo.freeSpinNumber,'Five Treasures trigger counter')===0;
    if(trigger)assert(integer(result.FSInfo.fsWinnings,'Five Treasures trigger winnings')===0&&integer(result.FSInfo.extraSpinsAwarded,'Five Treasures trigger extras')===0&&!result.FSInfo.freeSpinMode,'AG integrity: SG Five Treasures jackpot trigger state');
    const free=!!result.FSInfo&&!trigger;
    const current=spins.filter(s=>s.freeSpin===(free?'Y':'N'));
    assert(current.length===1,'AG integrity: SG Five Treasures current jackpot reel');
    const wins=current.flatMap(s=>list(s.AnywayWin).concat(list(s.ScatterWin),list(s.PaylineWin)));
    const reelWin=wins.reduce((n:number,w:any)=>n+integer(w.winVal,'Five Treasures reel win'),0);
    assert(Number.isSafeInteger(reelWin)&&win>0&&total===reelWin+win,
        'AG integrity: SG Five Treasures cash components');
    const base=integer(result.BGInfo.bgWinnings,'Five Treasures base win');
    const wager=integer(result.BGInfo.totalWagerWin,'Five Treasures wager win');
    if(free){
        assert((action==='FREE_SPIN'||(action==='PICK_FREE_SPINS'&&integer(result.FSInfo.freeSpinNumber,'Five Treasures first selected spin')===1))&&priorWager!==undefined&&Number.isSafeInteger(priorWager),
            'AG integrity: SG Five Treasures unbound compound jackpot');
        assert(base+integer(result.FSInfo.fsWinnings,'Five Treasures free win')===wager
            &&wager-priorWager===total,'AG integrity: SG Five Treasures free jackpot components');
    }else assert(base===wager&&wager===total,'AG integrity: SG Five Treasures wager components');

}


// Own Action Bank Plus client overrides the common FS total with totalSpin.
// Keep every original wire field; this is a game-bound counter/data decoder.
export function actionBankFreeCounters(game: AGGameConfig, f: any): {total:number;played:number} {
    assert(game.gameId === '32753' && game.dbName === 'sg_actionbankplus'
        && game.sg?.header?.gameCodeRGI === 'actionbankplus' && game.sg?.header?.gameID === '20369'
        && game.sg?.runtimeGameId === 32975 && game.sg?.runtimeSlug === 'actionbankplus'
        && game.sg?.freeCounterContract === 'actionbank-totalspin-v1', 'AG integrity: SG Action Bank counter binding');
    const known = new Set(['fsWinnings','vaultSpins','extraSpins','totalSpin','freeSpinNumber','isMaxWin','vaultCount']);
    assert(f && typeof f === 'object' && !Array.isArray(f) && Object.keys(f).every(k=>known.has(k)),
        'AG integrity: SG Action Bank free schema');
    const total=integer(f.totalSpin,'Action Bank free total'),played=integer(f.freeSpinNumber,'Action Bank free played');
    assert(total>0 && played<=total,'AG integrity: SG Action Bank free counter');
    integer(f.vaultSpins,'Action Bank vault spins');integer(f.extraSpins,'Action Bank extra spins');
    if(f.vaultCount !== undefined)integer(f.vaultCount,'Action Bank vault count');
    assert(f.isMaxWin === '0' || f.isMaxWin === '1','AG integrity: SG Action Bank max flag');
    assert(f.isMaxWin !== '1' || played===total,'AG integrity: SG Action Bank unfinished capped feature not mapped');
    return {total,played};
}


// Connection metadata only. Never downgrade uncertainty or retry any request.
export function sgRequestTimeoutMs(game: AGGameConfig): number {
    const value=game.sg?.requestTimeoutMs === undefined ? 30000 : game.sg.requestTimeoutMs;
    assert(Number.isSafeInteger(value) && value>=1000 && value<=120000,'AG integrity: SG request timeout binding');
    return value;
}
export function sgTransportDiagnostic(error: unknown, start: number, deadline: number, now=Date.now(), responseStatus?: number) {
    const e=error && typeof error==='object' ? error as any : undefined;
    const safeName=(v:unknown)=>typeof v==='string' && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(v) ? v : undefined;
    const safeCode=(v:unknown)=>typeof v==='string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(v) ? v : undefined;
    const elapsed=Number.isSafeInteger(start)&&Number.isSafeInteger(now)&&now>=start ? now-start : undefined;
    return {errorName:safeName(e?.name),causeName:safeName(e?.cause?.name),causeCode:safeCode(e?.cause?.code),
        elapsedMs:elapsed,configuredTimeoutMs:deadline,
        responseHeadersReceived:responseStatus!==undefined,
        ...(responseStatus!==undefined ? {responseStatusBeforeBodyFailed:responseStatus} : {}),
        completeResponseCaptured:false,serverApplicationOutcomeProven:false};
}


// Own client uses FSInfo/HydeSpinsInfo to enter a feature, not the generic reel
// marker alone. Only this exact no-feature scalar result can continue to EndGame.
export function validateJekyllScatterMarker(game:AGGameConfig,g:any):void {
 assert(game.gameId==='32763'&&game.dbName==='sg_drjekyllgoeswild'&&game.sg?.runtimeGameId===32985&&game.sg?.header?.gameID==='20126'&&game.sg?.header?.gameCodeRGI==='drjekyllgoeswild'&&game.sg?.betRaw===100&&game.sg?.jekyllScatterMarkerContract==='jekyll-own-no-feature-scatter-marker-v1','AG integrity: SG Jekyll marker binding');
 const keys=(v:any,names:string)=>assert(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===names.split('|').sort().join('|'),'AG integrity: SG Jekyll marker schema');
 keys(g,'stake|stakePerLine|paylineCount|totalWin|betID|ReelResults|BGInfo');keys(g.BGInfo,'totalWagerWin|bgWinnings|baseGameSpinsRemaining|isBigBet|isMaxWin');
 assert(g.stake==='100'&&g.stakePerLine==='10'&&g.paylineCount==='10'&&g.BGInfo.baseGameSpinsRemaining==='0'&&g.BGInfo.isBigBet==='0'&&g.BGInfo.isMaxWin==='0','AG integrity: SG Jekyll no-feature predicate');
 keys(g.ReelResults,'numSpins|ReelSpin');const spins=list(g.ReelResults.ReelSpin);assert(g.ReelResults.numSpins==='1'&&spins.length===1,'AG integrity: SG Jekyll marker reel');const spin=spins[0];assert(spin.spinIndex==='0'&&[0,1,2,3,4].includes(integer(spin.reelsetIndex,'Jekyll own Init base reelset'))&&spin.freeSpin==='N'&&spin.bonusAwarded==='Y'&&spin.winCountSC==='1','AG integrity: SG Jekyll marker flags');keys(spin.ScatterWin,'#text|winVal|awardIndex');assert(spin.ScatterWin.winVal==='0'&&spin.ScatterWin.awardIndex==='0','AG integrity: SG Jekyll zero scatter marker');
 const wins=list(spin.PaylineWin);assert(wins.length===integer(spin.winCountPL,'Jekyll line count'),'AG integrity: SG Jekyll marker line count');let sum=0;const seen=new Set<number>();for(const w of wins){const n=integer(w.index,'Jekyll line index');assert(n<10&&!seen.has(n),'AG integrity: SG Jekyll line index');seen.add(n);sum+=integer(w.winVal,'Jekyll line winnings');}
 assert(Number.isSafeInteger(sum)&&sum===integer(spin.spinWins,'Jekyll spin win')&&sum===integer(g.totalWin,'Jekyll total')&&sum===integer(g.BGInfo.bgWinnings,'Jekyll base')&&sum===integer(g.BGInfo.totalWagerWin,'Jekyll cumulative'),'AG integrity: SG Jekyll marker money');
}

export class SGWmsSession {
    private balance = Number.NaN;
    private startBalance = Number.NaN;
    private totalWin = 0;
    private free: Record<string, any> | undefined;
    private action = 'SPIN';
    private steps: WireStep[] = [];
    private readonly freshFreeId = 'Free:' + crypto.randomBytes(16).toString('hex');
    private session = this.freshFreeId;
    private closed = false;
    private lastRequest: {event:string;parameters:Record<string,any>|null} | undefined;
    private lastBase: unknown;
    private journal: number | null = null;
    private journalPath: string | null = null;
    private ordinal = 0;
    private cookies = new Map<string,string>();
    private gameplayRequestHasBeenSent = false;
    constructor(private readonly game: AGGameConfig, private readonly transport?: WireTransport, initialBalance?: number) {
        assert(game.provider === 'sg' && game.sg?.protocol === 'wms', 'AG integrity: SG protocol adapter unavailable');
        assert(game.sg.endpoint === 'https://gls.atc.casinarena.com/gls.rgsx', 'AG integrity: SG endpoint');
        assert(String(game.sg.header?.gameCodeRGI).length > 0 && /^\d+$/.test(String(game.sg.header?.gameID)), 'AG integrity: SG game binding');
        assert(Number.isSafeInteger(game.sg.betRaw) && game.sg.betRaw > 0, 'AG integrity: SG wager binding');
        if(initialBalance !== undefined) { assert(Number.isSafeInteger(initialBalance)); this.balance=initialBalance; }
    }
    private evidence(value: Record<string,unknown>) {
        if(this.transport) return; // offline transport keeps its own supplied evidence
        if(this.journal === null) {
            const dir=path.resolve(process.env.SG_EVIDENCE_DIR || '.sg-evidence');fs.mkdirSync(dir,{recursive:true});
            if(this.journalPath===null) {
                this.journalPath=path.join(dir,`${this.game.gameId}-${process.pid}-${crypto.randomUUID()}.jsonl`);
                this.journal=fs.openSync(this.journalPath,'wx',0o600);
            } else {
                // A response already in flight can finish after AG closes this session.
                // Keep it beside its original intent; closing never authorizes another request.
                this.journal=fs.openSync(this.journalPath,'a',0o600);
            }
        }
        fs.writeSync(this.journal, JSON.stringify({...value,at:new Date().toISOString()})+'\n');fs.fsyncSync(this.journal);
        if(this.closed) {fs.closeSync(this.journal);this.journal=null;}
    }
    async connect(): Promise<void> {
        if(this.transport) { assert(Number.isSafeInteger(this.balance));return; }
        assert(process.env.SG_AG_ALLOW_SOURCE === '1', 'AG integrity: SG live source not enabled');
        try {const response=await this.exchange('Init',{});this.readEnvelope(response,'Init');}
        catch(error) {this.close();throw error;}
    }
    getHandshakeData() { return null; } // no AG-format handshake is fabricated
    getBalance() { return this.balance/100; }
    getFallbackBet() { return this.game.sg.betRaw/100; }
    getSpinParams() { return {...this.game.sg.stake}; }
    getPickParams(index: number|string): Record<string,any> {
        if(!this.game.sg.fiveTreasuresContract)throw new Error('AG integrity: SG pick protocol not mapped');
        fiveTreasuresBinding(this.game);
        assert(this.action==='PICK_FREE_SPINS' && this.free?.freeSpinsPlayed===0,
            'AG integrity: SG Five Treasures choice phase');
        const pick=typeof index==='number'?index:Number(index);
        assert(Number.isInteger(pick)&&pick>=0&&pick<5,'AG integrity: SG Five Treasures choice index');
        return {...this.game.sg.freeStake,pickIndex:pick};
    }
    getPickProtocol(action:string) {
        if(action!=='PICK_FREE_SPINS'||!this.game.sg.fiveTreasuresContract)return undefined;
        fiveTreasuresBinding(this.game);
        assert(this.action===action&&this.free?.freeSpinsPlayed===0,
            'AG integrity: SG Five Treasures choice phase');
        // Unchanged original AG selects and records the option; SG serializes
        // the exact own frontend FreeSpinChoice type 0..4.
        return {event:'Logic',kind:'choice' as const,options:[0,1,2,3,4].map(pickIndex=>({pickIndex,
            requestParams:this.getPickParams(pickIndex)}))};
    }
    getInitialRoundRequest() { return {event:'Logic',parameters:this.getSpinParams()}; }
    getLastGameRequest() { return this.lastRequest; }
    isRoundTerminalAction(action: string) { return action === 'SPIN'; }
    getExactFollowUpRequest(action: string) {
        if(action === 'PLAY') return {event:'EndGame',parameters:{}};
        if(action === 'PICK_FREE_SPINS') {fiveTreasuresBinding(this.game);return undefined;}
        if(action === 'FREE_SPIN') {
            assert(this.game.sg.freeStake,'AG integrity: SG own free request not mapped');
            if(this.game.sg.fiveTreasuresContract) {
                fiveTreasuresBinding(this.game);
                assert(Number.isInteger(this.free?.choiceType),'AG integrity: SG Five Treasures missing selected mode');
                return {event:'Logic',parameters:{...this.game.sg.freeStake,pickIndex:this.free?.choiceType}};
            }
            return {event:'Logic',parameters:{...this.game.sg.freeStake}};
        }
        throw new Error('AG integrity: SG observed action not mapped');
    }
    private payload(event:string,parameters:Record<string,any>) {
        const h={...this.game.sg.header,sessionID:this.session};
        const header='<Header '+Object.entries(h).map(([k,v])=>`${k}="${escape(v)}"`).join(' ')+'/>';
        let choice='';
        if(parameters.pickIndex!==undefined) {
            fiveTreasuresBinding(this.game);
            assert(event==='Logic'&&((this.action==='PICK_FREE_SPINS'&&this.free?.freeSpinsPlayed===0)
                ||(this.action==='FREE_SPIN'&&parameters.pickIndex===this.free?.choiceType)),
                'AG integrity: SG Five Treasures choice request');
            assert(Number.isInteger(parameters.pickIndex)&&parameters.pickIndex>=0&&parameters.pickIndex<5,
                'AG integrity: SG Five Treasures choice index');
            choice=`<FreeSpinChoice type="${parameters.pickIndex}"/>`;
        }
        assert(this.action!=='PICK_FREE_SPINS'||event!=='Logic'||choice!=='',
            'AG integrity: SG Five Treasures missing choice');
        const stakeFields=Object.entries(parameters).filter(([k])=>k!=='pickIndex');
        const stake=stakeFields.length?'<Stake '+stakeFields.map(([k,v])=>`${k}="${escape(v)}"`).join(' ')+'/>':'';
        // Own Dragon client serializes AccountData for a stake-less free Logic too.
        // This is an explicit per-game wire binding, never a guessed feature stake.
        const freeAccount = event==='Logic' && !stake && this.game.sg.freeLogicCurrencyMultiplier !== undefined;
        if(freeAccount) assert(this.game.sg.freeLogicCurrencyMultiplier==='1','AG integrity: SG own free currency binding');
        return `<GameRequest type="${event}">${stake?'<AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData>':''}${header}${freeAccount?'<AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData>':''}${stake}${choice}</GameRequest>`;
    }
    private async exchange(event:string,parameters:Record<string,any>):Promise<WireStep> {
        assert(!this.closed,'AG integrity: SG session closed');const payload=this.payload(event,parameters);
        const ordinal=++this.ordinal;
        const requestKind = event==='Init' ? 'initialization' : this.action==='SPIN' ? 'round-start' : 'round-follow-up';
        if(event!=='Init')this.gameplayRequestHasBeenSent=true;
        const context: SGRequestEvidence = {event,ordinal,requestKind,gameplayRequestHasBeenSent:this.gameplayRequestHasBeenSent};
        if(this.transport) {
            const step=await this.transport(event,payload);
            if(step.httpStatus!==undefined && !(step.httpStatus>=200 && step.httpStatus<300)) {
                const fault=httpSourceFault({...context,httpStatus:step.httpStatus,responseSHA256:crypto.createHash('sha256').update(step.responsePayload).digest('hex')});
                this.close();throw this.closedFaultForFutureSession(fault);
            }
            return step;
        }
        this.evidence({phase:'intent',ordinal,event,payload});
        const start=Date.now(),deadline=sgRequestTimeoutMs(this.game);let response:Response | undefined,text:string;
        try {
            response=await fetch(this.game.sg.endpoint,{method:'POST',redirect:'error',signal:AbortSignal.timeout(deadline),
                headers:{'Content-Type':'text/xml; charset=utf-8',...(this.cookies.size?{Cookie:[...this.cookies].map(([k,v])=>k+'='+v).join('; ')}:{})},body:payload});
            text=await response.text();
        } catch(error) {
            const fault=transportSourceFault(context);
            this.evidence({phase:'unknown',ordinal,event,...sourceFaultMetadata(fault),transportDiagnostic:sgTransportDiagnostic(error,start,deadline,Date.now(),response?.status)});this.close();
            throw this.closedFaultForFutureSession(fault);
        }
        assert(response,'AG integrity: SG missing transport response');
        const fault=response.ok ? null : httpSourceFault({...context,httpStatus:response.status,responseSHA256:crypto.createHash('sha256').update(text).digest('hex')});
        this.evidence({phase:'response',ordinal,event,httpStatus:response.status,text,...(fault ? sourceFaultMetadata(fault) : {})});
        if(fault){this.close();throw this.closedFaultForFutureSession(fault);}
        for(const cookie of response.headers.getSetCookie?.() || []) {const pair=cookie.split(';')[0],at=pair.indexOf('=');if(at>0)this.cookies.set(pair.slice(0,at),pair.slice(at+1));}
        return {msgId:event,requestPayload:payload,responsePayload:text,elapsedMs:Date.now()-start};
    }
    private closedFaultForFutureSession(fault:SGSourceFault):Error {
        if(fault.category!=='execution-unknown' || !this.game.sg.unknownFreeSessionRecovery)return fault;
        assert(this.game.sg.unknownFreeSessionRecovery==='original-ag-discard-free-v1',
            'AG integrity: SG unknown Free session recovery contract');
        assert(this.game.sg.header.freePlay==='Y'&&this.closed&&this.cookies.size===0
            &&/^Free:[0-9a-f]{32}$/.test(this.freshFreeId),
            'AG integrity: SG old uncertain session not sealed');
        if(!['Logic','EndGame'].includes(fault.evidence.event))return fault;
        const status=fault.evidence.httpStatus;
        if(status!==undefined && ![408,425,429,500,502,503,504,520,521,522,523,524].includes(status))return fault;
        // The old outcome stays unknown and cannot be retried. Only a later,
        // independent Free session is eligible under original AG finite reset.
        this.evidence({phase:'sealed-session-recovery',ordinal:fault.evidence.ordinal,
            event:fault.evidence.event,oldOutcomeStillUnknown:true,oldRequestReplays:0,
            retryAction:'original-ag-discard-then-new-free-session'});
        return new SGClosedFreeSessionDiscard(fault);
    }
    private readEnvelope(step:WireStep,event:string) {
        const r=xml.parse(step.responsePayload)?.GameResponse;
        assert(r && r.type===event && r.Header && !r.Error && !r.Errors,'AG integrity: SG response envelope');
        assert(String(r.Header.gameID)===String(this.game.sg.header.gameID),'AG integrity: SG response game');
        assert(typeof r.Header.sessionID==='string'&&r.Header.sessionID.length>0,'AG integrity: SG response session');
        const balances=list(r.Balances?.Balance).filter(b=>b.name==='CASH_BALANCE');assert(balances.length===1,'AG integrity: SG cash balance');
        this.balance=integer(balances[0].value,'cash balance');this.session=r.Header.sessionID;
        return r;
    }
    async callGameData(event:string,parameters:Record<string,any>|null) {
        const first=this.action==='SPIN';
        if(first) {assert(event==='Logic','AG integrity: SG round start');this.startBalance=this.balance;this.totalWin=0;this.free=undefined;this.steps=[];this.lastBase=undefined;}
        else assert(event===(this.action==='PICK_FREE_SPINS'?'Logic':this.getExactFollowUpRequest(this.action)?.event),'AG integrity: SG request order');
        assert(Number.isSafeInteger(this.startBalance),'AG integrity: SG missing initial balance');
        const step=await this.exchange(event,parameters || {}),r=this.readEnvelope(step,event);
        this.steps.push({...step,responseBalance:this.balance});this.lastRequest={event,parameters:structuredClone(parameters)};
        if(event==='EndGame') {
            assert(!r.GameResult,'AG integrity: SG unexpected EndGame result');
            assert(this.balance===this.startBalance-this.game.sg.betRaw+this.totalWin,'AG integrity: SG final balance mismatch');
            this.action='SPIN';
        } else {
            const g=r.GameResult;assert(g&&g.BGInfo,'AG integrity: SG game result');
            const known=new Set(['stake','stakePerLine','paylineCount','totalWin','betID','ReelResults','BGInfo','FSInfo','BaseGameRecoveryInfo',...(this.game.sg.passiveResultFields || []),...(this.game.sg.fiveTreasuresContract ? ['JackpotInfo'] : [])]);
            assert(Object.keys(g).every(k=>known.has(k)),'AG integrity: SG observed feature needs mapping');
            if(g.JackpotInfo!==undefined)validateFiveTreasuresCash(this.game,g,this.totalWin,this.action);
            assert(integer(g.stake,'stake')===this.game.sg.betRaw,'AG integrity: SG changed stake');
            const bg=g.BGInfo;
            if(this.game.sg.omitsBaseRemaining)assert(bg.baseGameSpinsRemaining===undefined,'AG integrity: SG changed base schema');
            else assert(integer(bg.baseGameSpinsRemaining,'remaining base spins')===0,'AG integrity: SG remaining base action not mapped');
            if(g.BonusData)assert(g.BonusData.BonusBet==='0'&&Object.keys(g.BonusData).length===1,'AG integrity: SG purchased bonus not mapped');
            this.totalWin=integer(bg.totalWagerWin,'cumulative wager win');
            assert(g.ReelResults && list(g.ReelResults.ReelSpin).length>0,'AG integrity: SG reel result');
            if(first)this.lastBase=structuredClone(g.ReelResults);
            if(g.BaseGameRecoveryInfo) {
                assert(this.lastBase && JSON.stringify(g.BaseGameRecoveryInfo.ReelResults)===JSON.stringify(this.lastBase),'AG integrity: SG base recovery changed');
            }
            if(g.FSInfo) {
                const f=g.FSInfo,own=this.game.sg.freeCounterContract ? actionBankFreeCounters(this.game,f) : undefined,
                    total=own ? own.total : integer(f.freeSpinsTotal,'free total'),played=own ? own.played : integer(f.freeSpinNumber,'free played');
                assert(played<=total,'AG integrity: SG free counter');
                const freeWin=integer(f.fsWinnings,'free winnings'),baseWin=integer(bg.bgWinnings,'base winnings');
                assert(baseWin+freeWin===this.totalWin,'AG integrity: SG component winnings');
                let choiceType: number|undefined;
                if(this.game.sg.fiveTreasuresContract) {
                    fiveTreasuresBinding(this.game);
                    choiceType=f.freeSpinMode===undefined ? parameters?.pickIndex ?? this.free?.choiceType : integer(f.freeSpinMode,'Five Treasures free mode');
                    if(choiceType!==undefined)assert(choiceType>=0&&choiceType<5,'AG integrity: SG Five Treasures free mode');
                    if(parameters?.pickIndex!==undefined)assert(choiceType===parameters.pickIndex,'AG integrity: SG Five Treasures changed selected mode');
                }
                if(this.free)assert((played>this.free.freeSpinsPlayed
                    ||(this.game.sg.fiveTreasuresContract&&this.action==='PICK_FREE_SPINS'
                        &&parameters?.pickIndex!==undefined&&played===0&&this.free.freeSpinsPlayed===0&&total===this.free.freeSpinsTotal))
                    &&total>=this.free.freeSpinsTotal,'AG integrity: SG nonadvancing free state');
                this.free={freeSpinsTotal:total,freeSpinsPlayed:played,freeSpinsRemaining:total-played,accumulativeWin:this.totalWin/100,
                    ...(choiceType!==undefined?{choiceType}:{})};
                if(this.game.sg.fiveTreasuresContract && played===0 && choiceType===undefined) {
                    fiveTreasuresBinding(this.game);
                    assert(total>0,'AG integrity: SG Five Treasures missing choice spins');
                    this.action='PICK_FREE_SPINS';
                } else this.action=played<total?'FREE_SPIN':'PLAY';
            } else {
                assert(!this.free,'AG integrity: SG free state disappeared');
                if(this.game.sg.jekyllScatterMarkerContract&&list(g.ReelResults.ReelSpin).some(s=>s.bonusAwarded==='Y'))validateJekyllScatterMarker(this.game,g);
                else assert(list(g.ReelResults.ReelSpin).every(s=>s.freeSpin==='N'&&s.bonusAwarded==='N'),'AG integrity: SG unclassified feature');
                this.action='PLAY';
            }
        }
        // AG retains every response in its own action sequence. Do not embed the
        // entire growing SG prefix in each intermediate response (quadratic BSON).
        // The terminal response still provides every exact SG request/response for playback.
        const playbackSteps = this.action==='SPIN' ? this.steps : this.steps.slice(-1);
        return {NextActionInfo:{nextAction:this.action},PlayerBalanceInfo:{preWagerBalance:this.startBalance/100,balance:this.balance/100,wager:this.game.sg.betRaw/100,resultAmount:this.totalWin/100},
            ...(this.free?{FreeSpinsInfo:structuredClone(this.free)}:{}),SGWireResponse:step.responsePayload,
            // Data-only SG playback mapping. AG keeps all of its round/validation/storage fields.
            capturePlatform:'sg',gameId:this.game.sg.runtimeGameId,runtimeSlug:this.game.sg.runtimeSlug,
            startBalance:this.startBalance/100,endBalance:this.balance/100,totalWin:this.totalWin/100,
            stepCount:playbackSteps.length,msgIds:playbackSteps.map(step=>step.msgId),steps:structuredClone(playbackSteps),
            money:{startBalanceRaw:this.startBalance,endBalanceRaw:this.balance,betRaw:this.game.sg.betRaw,totalWinRaw:this.totalWin}};
    }
    close() { if(this.closed)return;this.closed=true;this.cookies.clear();if(this.journal!==null){fs.fsyncSync(this.journal);fs.closeSync(this.journal);this.journal=null;} }
}
