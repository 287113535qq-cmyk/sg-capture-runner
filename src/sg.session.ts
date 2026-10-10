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


const ownJinseList = (v:any):any[] => v===undefined?[]:Array.isArray(v)?v:[v];
function ownJinseKeys(v:any,keys:string,label:string){assert(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===keys.split('|').sort().join('|'),`AG integrity: SG Jinse ${label} schema`);}
export function validateJinseDragonData(game:AGGameConfig,g:any,first:boolean,prior:any,base:any,previousWin:number){
 assert(game.gameId==='32779'&&game.dbName==='sg_jinsedaodragon'&&game.sg.runtimeGameId===33001&&game.sg.header.gameID==='20401'&&game.sg.header.gameCodeRGI==='jinsedaodragon'&&game.sg.jinseDragonContract==='jinse-dragon-own-jackpot-cash-v2'&&game.sg.betRaw===100,'AG integrity: SG Jinse own binding');
 ownJinseKeys(g,'stake|stakePerLine|paylineCount|totalWin|betID|ReelResults|BGInfo|Orbs'+(g.WheelInfo!==undefined?'|WheelInfo':'')+(g.FSInfo!==undefined?'|FSInfo':'')+(g.BaseGameRecoveryInfo!==undefined?'|BaseGameRecoveryInfo':''),'result');assert(g.stake==='100'&&g.stakePerLine==='100'&&g.paylineCount==='1'&&typeof g.betID==='string','AG integrity: SG Jinse wager');
 if(first)assert(!prior&&!base&&previousWin===0&&!g.FSInfo&&!g.BaseGameRecoveryInfo,'AG integrity: SG Jinse initial order');else assert(prior&&base&&prior.freeSpinsRemaining>0&&!g.WheelInfo&&g.FSInfo&&g.betID===base.betID,'AG integrity: SG Jinse own free order');
 const wheel=g.WheelInfo!==undefined;
 ownJinseKeys(g.ReelResults,'numSpins|ReelSpin','reels');assert(g.ReelResults.numSpins==='1'&&!Array.isArray(g.ReelResults.ReelSpin),'AG integrity: SG Jinse reel count');const r=g.ReelResults.ReelSpin;
 ownJinseKeys(r,'spinIndex|reelsetIndex|anywayWins|scatterWinCount|totalSpinWin|freeSpin|bonusAwarded|ReelStops'+(r.AnywayWin!==undefined?'|AnywayWin':'')+(r.ScatterWin!==undefined?'|ScatterWin':''),'spin');assert(r.spinIndex==='0'&&r.freeSpin===(first?'N':'Y')&&r.bonusAwarded===(wheel?'Y':'N'),'AG integrity: SG Jinse feature marker');integer(r.reelsetIndex,'Jinse reel set');assert(typeof r.ReelStops==='string'&&/^\d+(\|\d+){4}$/.test(r.ReelStops),'AG integrity: SG Jinse reel stops');
 const ways=ownJinseList(r.AnywayWin),scatters=ownJinseList(r.ScatterWin);assert(ways.length===integer(r.anywayWins,'Jinse way count')&&scatters.length===integer(r.scatterWinCount,'Jinse scatter count'),'AG integrity: SG Jinse declared pays');let spinCash=0;const ids=new Set<number>();
 const positions=(v:any)=>{assert(typeof v==='string'&&/^\d+(\|\d+)*$/.test(v),'AG integrity: SG Jinse pay positions');for(const value of v.split('|'))integer(value,'Jinse pay position');};
 for(const w of ways){ownJinseKeys(w,'winIndex|winVal|ways|awardIndex|#text','way');const id=integer(w.winIndex,'Jinse way index');assert(id<ways.length&&!ids.has(id)&&integer(w.ways,'Jinse ways')>0,'AG integrity: SG Jinse way index');ids.add(id);integer(w.awardIndex,'Jinse way award');positions(w['#text']);spinCash+=integer(w.winVal,'Jinse way cash');}
 for(const w of scatters){ownJinseKeys(w,'winVal|awardIndex|#text','scatter');integer(w.awardIndex,'Jinse scatter award');positions(w['#text']);spinCash+=integer(w.winVal,'Jinse scatter cash');}
 assert(Number.isSafeInteger(spinCash)&&spinCash===integer(r.totalSpinWin,'Jinse spin cash'),'AG integrity: SG Jinse reel components');
 ownJinseKeys(g.Orbs,'numJackpotWins'+(g.Orbs.Orb!==undefined?'|Orb':''),'orbs');const declaredJackpots=integer(g.Orbs.numJackpotWins,'Jinse returned jackpot count');let jackpotCount=0,orbCash=0;const orbIds=new Set<number>();
 for(const o of ownJinseList(g.Orbs.Orb)){ownJinseKeys(o,'awardIndex|amount|position|winning|isJackpot','orb');const id=integer(o.position,'Jinse orb position');assert(!orbIds.has(id)&&['y','n'].includes(o.winning)&&['y','n'].includes(o.isJackpot),'AG integrity: SG Jinse orb identity or award');orbIds.add(id);integer(o.awardIndex,'Jinse orb award');const amount=integer(o.amount,'Jinse orb amount');if(o.winning==='y'){orbCash+=amount;if(o.isJackpot==='y')jackpotCount++;}}
 assert(jackpotCount===declaredJackpots,'AG integrity: SG Jinse returned winning jackpot count');
 let wheelCash=0;
 if(wheel&&g.WheelInfo.featureType==='Jackpot'){ownJinseKeys(g.WheelInfo,'wheelStop|featureType|JackpotInfo','returned jackpot wheel');integer(g.WheelInfo.wheelStop,'Jinse returned wheel position');ownJinseKeys(g.WheelInfo.JackpotInfo,'type|win|isMaxWin','wheel jackpot award');const j=g.WheelInfo.JackpotInfo;assert(integer(j.type,'Jinse jackpot type')<4&&j.isMaxWin==='0','AG integrity: SG Jinse jackpot type or cap');wheelCash=integer(j.win,'Jinse actual wheel jackpot cash');}
 const current=integer(g.totalWin,'Jinse current');assert(Number.isSafeInteger(orbCash)&&current===spinCash+orbCash+wheelCash,'AG integrity: SG Jinse current components');
 const bg=g.BGInfo;ownJinseKeys(bg,'totalWagerWin|bgWinnings|baseGameSpinsRemaining|isMaxWin'+(bg.expReelTriggerType!==undefined?'|expReelTriggerType':'')+(bg.reelHeights!==undefined?'|reelHeights':''),'base cash');assert(bg.baseGameSpinsRemaining==='0'&&bg.isMaxWin==='0','AG integrity: SG Jinse base remaining or cap');
 const display=(v:any)=>{assert(['-1','0','1','2'].includes(v.expReelTriggerType)&&integer(v.reelHeights,'Jinse displayed height')>=3,'AG integrity: SG Jinse returned expansion display');};
 if(first)display(bg);else if(bg.expReelTriggerType!==undefined||bg.reelHeights!==undefined)display(bg);
 const win=integer(bg.totalWagerWin,'Jinse returned cumulative'),baseWin=integer(bg.bgWinnings,'Jinse base winnings');let free;
 if(first){assert(win===current&&baseWin===current,'AG integrity: SG Jinse paid current or cumulative');
  if(wheel&&g.WheelInfo.featureType!=='Jackpot'){ownJinseKeys(g.WheelInfo,'wheelStop|featureType|FSInfo','wheel');integer(g.WheelInfo.wheelStop,'Jinse wheel position');assert(g.WheelInfo.featureType==='FreeSpins','AG integrity: SG Jinse new wheel feature');const f=g.WheelInfo.FSInfo;ownJinseKeys(f,'fsWinnings|freeSpinsTotal|freeSpinNumber|isMaxWin','wheel free');const total=integer(f.freeSpinsTotal,'Jinse actual awarded total');assert(total>0&&f.freeSpinNumber==='0'&&f.fsWinnings==='0'&&f.isMaxWin==='0','AG integrity: SG Jinse wheel budget');free={freeSpinsTotal:total,freeSpinsPlayed:0,freeSpinsRemaining:total,accumulativeWin:win/100};}
 }else{const f=g.FSInfo;ownJinseKeys(f,'fsWinnings|freeSpinsTotal|freeSpinNumber|isMaxWin|expReelTriggerType|reelHeights','free');display(f);const total=integer(f.freeSpinsTotal,'Jinse free total'),played=integer(f.freeSpinNumber,'Jinse free played'),freeCash=integer(f.fsWinnings,'Jinse cumulative free cash');assert(played===prior.freeSpinsPlayed+1&&total>=prior.freeSpinsTotal&&played<=total&&f.isMaxWin==='0'&&baseWin===integer(base.BGInfo.bgWinnings,'Jinse original base')&&win===baseWin+freeCash&&win===previousWin+current,'AG integrity: SG Jinse free counters or components');free={freeSpinsTotal:total,freeSpinsPlayed:played,freeSpinsRemaining:total-played,accumulativeWin:win/100};
  if(g.BaseGameRecoveryInfo!==undefined){const recovery=g.BaseGameRecoveryInfo;ownJinseKeys(recovery,'ReelResults|BGInfo|Orbs','recovery');assert.deepStrictEqual(recovery.ReelResults,base.ReelResults,'AG integrity: SG Jinse recovery reels changed');assert.deepStrictEqual(recovery.Orbs,base.Orbs,'AG integrity: SG Jinse recovery orbs changed');const expected={...base.BGInfo,totalWagerWin:bg.totalWagerWin};assert.deepStrictEqual(recovery.BGInfo,expected,'AG integrity: SG Jinse recovery base changed');}
 }
 return {win,free,base:first?structuredClone(g):base};
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

export function validateBlazingXData(game:AGGameConfig,g:any,first:boolean,prior:any,priorWin:number):void {
 assert(game.gameId==='32755'&&game.dbName==='sg_blazingxasia'&&game.sg?.runtimeGameId===32977&&game.sg?.header?.gameID==='20363'&&game.sg?.blazingXContract==='blazing-x-own-current-components-v1'&&game.sg?.betRaw===240,'AG integrity: SG Blazing own binding');
 const keys=(v:any,n:string)=>assert(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===n.split('|').sort().join('|'),'AG integrity: SG Blazing schema');
 keys(g,'stake|stakePerLine|paylineCount|totalWin|betID|ReelResults|BGInfo'+(g.XInfo?'|XInfo':'')+(g.FSInfo?'|FSInfo':'')+(g.BaseGameRecoveryInfo?'|BaseGameRecoveryInfo':''));
 assert(g.stake==='240'&&g.stakePerLine==='20'&&g.paylineCount==='40','AG integrity: SG Blazing wager');keys(g.BGInfo,'totalWagerWin|bgWinnings|isMaxWin');assert(g.BGInfo.isMaxWin==='0','AG integrity: SG Blazing cap');
 if(g.XInfo){keys(g.XInfo,'currentX|previousX|currSpinToReset|prevSpinToReset');assert(integer(g.XInfo.currentX,'Blazing multiplier')>0&&integer(g.XInfo.previousX,'Blazing prior multiplier')>0,'AG integrity: SG Blazing multiplier metadata');integer(g.XInfo.currSpinToReset,'Blazing reset');integer(g.XInfo.prevSpinToReset,'Blazing prior reset');}
 keys(g.ReelResults,'numSpins|ReelSpin');const spins=list(g.ReelResults.ReelSpin);assert(g.ReelResults.numSpins==='1'&&spins.length===1,'AG integrity: SG Blazing reel count');const s=spins[0];assert(s.spinIndex==='0'&&s.reelsetIndex===(first?'0':'1')&&s.freeSpin===(first?'N':'Y'),'AG integrity: SG Blazing reel state');
 const lines=list(s.PaylineWin),scatters=list(s.ScatterWin);assert(lines.length===integer(s.winCountPL,'Blazing line count')&&scatters.length===integer(s.winCountSC,'Blazing scatter count'),'AG integrity: SG Blazing win count');const indices=new Set<number>();let lineWin=0;for(const w of lines){const index=integer(w.index,'Blazing line');assert(index<40&&!indices.has(index),'AG integrity: SG Blazing line index');indices.add(index);integer(w.awardIndex,'Blazing award');integer(w.awardTableIndex,'Blazing award table');lineWin+=integer(w.winVal,'Blazing line win');}
 const scatterWin=scatters.reduce((n:number,w:any)=>n+integer(w.winVal,'Blazing scatter win'),0),spin=integer(s.spinWins,'Blazing spin'),current=integer(g.totalWin,'Blazing current'),wager=integer(g.BGInfo.totalWagerWin,'Blazing cumulative'),base=integer(g.BGInfo.bgWinnings,'Blazing base');assert(Number.isSafeInteger(lineWin+scatterWin)&&spin===lineWin+scatterWin,'AG integrity: SG Blazing reel money');
 if(!g.FSInfo){assert(first&&!prior&&g.XInfo&&s.bonusAwarded==='N'&&current===spin&&base===current&&wager===current,'AG integrity: SG Blazing ordinary settlement');return;}
 const f=g.FSInfo;keys(f,'scatterPayout|fsWinnings|freeSpinsTotal|freeSpinNumber|isMaxWin'+(first?'':'|currFSX|prevFSX'));const played=integer(f.freeSpinNumber,'Blazing free played'),total=integer(f.freeSpinsTotal,'Blazing total'),freeWin=integer(f.fsWinnings,'Blazing free win'),trigger=integer(f.scatterPayout,'Blazing trigger');assert(f.isMaxWin==='0'&&total>0&&played<=total&&base+freeWin===wager,'AG integrity: SG Blazing free components');
 if(first)assert(!prior&&played===0&&freeWin===0&&s.bonusAwarded==='Y'&&current===spin+trigger&&base===current&&wager===current,'AG integrity: SG Blazing paid trigger');
 else {assert(prior&&played===prior.freeSpinsPlayed+1&&total===prior.freeSpinsTotal&&s.bonusAwarded==='N'&&current===spin&&wager===priorWin+current,'AG integrity: SG Blazing free progression');assert(integer(f.currFSX,'Blazing free multiplier')>0&&integer(f.prevFSX,'Blazing previous free multiplier')>0,'AG integrity: SG Blazing free multiplier metadata');}
}

export function validateBlazingRecovery(game:AGGameConfig,g:any,paidReels:any,paidX:number):void {
 assert(game.gameId==='32755'&&game.sg?.blazingXContract==='blazing-x-own-current-components-v1'&&paidReels&&Number.isSafeInteger(paidX)&&paidX>0,'AG integrity: SG Blazing recovery binding');
 const recovery=g.BaseGameRecoveryInfo;assert(Object.keys(recovery).join('|')==='ReelResults','AG integrity: SG Blazing recovery schema');
 const expected=structuredClone(paidReels),current=integer(g.XInfo.currentX,'Blazing current display multiplier');
 if(current!==paidX){
  assert(current===1&&integer(g.XInfo.previousX,'Blazing prior display multiplier')===paidX&&g.XInfo.currSpinToReset==='0'&&g.FSInfo.freeSpinNumber===g.FSInfo.freeSpinsTotal,'AG integrity: SG Blazing recovery multiplier reset');
  const scale=(value:string)=>{const n=integer(value,'Blazing paid display win');assert(n%paidX===0,'AG integrity: SG Blazing nonintegral recovery display');return String(n/paidX);};
  for(const spin of list(expected.ReelSpin)){spin.spinWins=scale(spin.spinWins);for(const win of [...list(spin.PaylineWin),...list(spin.ScatterWin)])win.winVal=scale(win.winVal);}
 }
 assert(JSON.stringify(recovery.ReelResults)===JSON.stringify(expected),'AG integrity: SG Blazing recovery projection changed');
}

export function validateHerculesData(game:AGGameConfig,g:any,prior?:any):void {
 assert(game.gameId==='32773'&&game.dbName==='sg_herculeshighandmighty'&&game.sg?.runtimeGameId===32995&&game.sg?.header?.gameID==='20102'&&game.sg?.herculesContract==='hercules-own-natural-retrigger-v3'&&game.sg?.betRaw===100,'AG integrity: SG Hercules own binding');
 const f=g.FSInfo,playingFree=f!==undefined&&integer(f.freeSpinNumber,'Hercules played')>0;
 const w=g.WildPositions,required=['bottomWildReel','expandPointsBottom','expandPointsTop','topWildReel'],allowed=[...required,'heldWildReels','existingHeldWildReels'];assert(w&&required.every(k=>Object.prototype.hasOwnProperty.call(w,k))&&Object.keys(w).every(k=>allowed.includes(k))&&(playingFree||allowed.every(k=>Object.prototype.hasOwnProperty.call(w,k))),'AG integrity: SG Hercules wild schema');
 const values=(v:any,max:number,unique=true)=>{assert(typeof v==='string'&&(v===''||/^\d+(?:\|\d+)*$/.test(v)),'AG integrity: SG Hercules wild positions');const a=v===''?[]:v.split('|').map((n:string)=>integer(n,'Hercules wild position'));assert(a.every((n:number)=>n<max)&&(!unique||new Set(a).size===a.length),'AG integrity: SG Hercules wild bounds');return a;};
 // Client expansion starts at a position in each ten-symbol reel; positions
 // in different reels may coincide, while the reel identifiers remain unique.
 for(const side of ['Bottom','Top']){const reels=values(w[side==='Bottom'?'bottomWildReel':'topWildReel'],5),points=values(w['expandPoints'+side],10,false);assert(reels.length===points.length,'AG integrity: SG Hercules paired expansion');}
 // Own SDK makes these display-only held-reel lists optional in free responses.
 if(w.heldWildReels!==undefined)values(w.heldWildReels,5);if(w.existingHeldWildReels!==undefined)values(w.existingHeldWildReels,5);
 assert(g.BGInfo.isBigBet==='0'&&g.BGInfo.isMaxWin==='0'&&(playingFree?g.BGInfo.wildBonus===undefined||['0','1'].includes(g.BGInfo.wildBonus):['0','1'].includes(g.BGInfo.wildBonus)),'AG integrity: SG Hercules wager flags');
 if(f) {
  const keys=playingFree?'freeSpinNumber|freeSpinsTotal|fsWinnings|fromTopRows|isMaxWin|newFreespinsAwarded|wildBonus':'freeSpinNumber|freeSpinsTotal|fsWinnings|fromTopRows';assert(Object.keys(f).sort().join('|')===keys.split('|').sort().join('|'),'AG integrity: SG Hercules free schema');
  const total=integer(f.freeSpinsTotal,'Hercules free total'),played=integer(f.freeSpinNumber,'Hercules played');integer(f.fsWinnings,'Hercules free win');assert(total>0&&played<=total&&['0','1'].includes(f.fromTopRows),'AG integrity: SG Hercules free budget');
  if(playingFree){const added=integer(f.newFreespinsAwarded,'Hercules free award');assert(prior&&played===prior.freeSpinsPlayed+1&&total===prior.freeSpinsTotal+added&&f.isMaxWin==='0'&&['0','1'].includes(f.wildBonus),'AG integrity: SG Hercules free counter');}
  else assert(!prior&&played===0&&f.fsWinnings==='0','AG integrity: SG Hercules free introduction');
 }
 let sum=0;for(const s of list(g.ReelResults?.ReelSpin)){
  const lines=list(s.PaylineWin),scatter=list(s.ScatterWin),retrigger=playingFree&&integer(f.newFreespinsAwarded,'Hercules awarded')>0;
  // The actual client consumes FSInfo's newly awarded spins. In both observed
  // natural retriggers winCountSC marks this award, with no monetary ScatterWin
  // node. It does not add cash or invent a response; all spin/cumulative money
  // still comes from the explicit returned line and root amounts.
  const scatterCount=integer(s.winCountSC,'Hercules scatter count');
  assert(lines.length===integer(s.winCountPL,'Hercules line count')&&(retrigger?s.bonusAwarded==='Y'&&scatterCount===1&&s.ScatterWin===undefined:scatter.length===scatterCount),'AG integrity: SG Hercules win counts');
  let win=0;for(const x of [...lines,...scatter])win+=integer(x.winVal,'Hercules component');assert(Number.isSafeInteger(win)&&win===integer(s.spinWins,'Hercules spin win'),'AG integrity: SG Hercules reel money');sum+=win;
 }
 assert(Number.isSafeInteger(sum)&&sum===integer(g.totalWin,'Hercules current win'),'AG integrity: SG Hercules current money');
}

function ownPaidKeys(value:any,names:string,label:string) {
 assert(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===names.split('|').sort().join('|'),`AG integrity: SG ${label} schema`);
}
function ownPositionNumbers(value:any,count:number|undefined,label:string):number[] {
 assert(typeof value==='string'&&/^\d+(\|\d+)*$/.test(value),`AG integrity: SG ${label} positions`);
 const numbers=value.split('|').map((n:string)=>integer(n,label));
 if(count!==undefined)assert(numbers.length===count,`AG integrity: SG ${label} position count`);
 return numbers;
}
function ownHealthyComponentsBinding(game:AGGameConfig):'megaways'|'deepsea'|'jinji'|'rhino' {
 assert(game.gameId==='32800'&&game.dbName==='sg_ragingrhinomegaways'&&game.sg.runtimeGameId===33160&&game.sg.header.gameID==='20353'&&game.sg.header.gameCodeRGI==='ragingrhinomegaways'&&game.sg.betRaw===200&&game.sg.healthyComponentsContract==='raging-rhino-own-returned-components-v3','AG integrity: SG own Rhino connection');return 'rhino';
}
function ownHealthyTopReel(top:any) {
 ownPaidKeys(top,'reelSetIndex|reelStop|positions','healthy top reel');integer(top.reelSetIndex,'top set');integer(top.reelStop,'top stop');
 assert(JSON.stringify(ownPositionNumbers(top.positions,4,'top positions'))===JSON.stringify([37,38,39,40]),'AG integrity: SG top positions');
}
function ownHealthyReelCash(reels:any,kind:string,isFree:boolean,hasIntro:boolean):number {
 ownPaidKeys(reels,'numSpins|ReelSpin','healthy reels');const spins=list(reels.ReelSpin);
 assert(spins.length===integer(reels.numSpins,'healthy cascade count')&&spins.length>0,'AG integrity: SG healthy cascade count');
 let cash=0;
 for(const [i,s] of spins.entries()) {
  const deep=kind==='deepsea',wins=list(deep?s.PaylineWin:s.AnywayWin),scatters=list(s.ScatterWin);
  const names=deep?'spinIndex|reelsetIndex|winCountPL|winCountSC|spinWins|freeSpin|bonusAwarded|ReelStops':'spinIndex|reelsetIndex|anywayWins|scatterWinCount|totalSpinWin|freeSpin|bonusAwarded|ReelStops';
  ownPaidKeys(s,names+(wins.length?(deep?'|PaylineWin':'|AnywayWin'):'')+(scatters.length?'|ScatterWin':''),'healthy reel spin');
  assert(integer(s.spinIndex,'healthy spin index')===i&&s.freeSpin===(isFree?'Y':'N')&&['Y','N'].includes(s.bonusAwarded),'AG integrity: SG healthy spin state');
  assert(hasIntro||s.bonusAwarded==='N','AG integrity: SG healthy unmapped bonus');integer(s.reelsetIndex,'healthy reel set');ownPositionNumbers(s.ReelStops,deep?5:6,'healthy reel stops');
  assert(integer(deep?s.winCountPL:s.anywayWins,'healthy ways count')===wins.length&&integer(deep?s.winCountSC:s.scatterWinCount,'healthy scatter count')===scatters.length,'AG integrity: SG healthy award count');
  let lines=0,scatter=0;
  for(const [j,w] of wins.entries()) {
   ownPaidKeys(w,deep?'index|winVal|awardIndex|awardTableIndex|#text':'winIndex|winVal|ways|awardIndex|#text','healthy cash award');
   if(deep){assert(integer(w.index,'payline index')<50,'AG integrity: SG payline index');integer(w.awardTableIndex,'award table');}
   else assert(integer(w.winIndex,'ways index')===j&&integer(w.ways,'ways')>0,'AG integrity: SG ways index');
   integer(w.awardIndex,'healthy award index');assert(ownPositionNumbers(w['#text'],undefined,'healthy winning positions').every(n=>n<(deep?15:kind==='rhino'?6*7:41)),'AG integrity: SG healthy position range');lines+=integer(w.winVal,'healthy line cash');
  }
  for(const w of scatters) {
   ownPaidKeys(w,'winVal|awardIndex'+(w['#text']!==undefined?'|#text':''),'healthy scatter');integer(w.awardIndex,'scatter award');
   if(w['#text']!==undefined)assert(ownPositionNumbers(w['#text'],undefined,'scatter positions').every(n=>n<(deep?15:kind==='rhino'?6*7:41)),'AG integrity: SG scatter range');scatter+=integer(w.winVal,'scatter cash');
  }
  assert(lines===integer(deep?s.spinWins:s.totalSpinWin,'healthy returned line cash'),'AG integrity: SG healthy line cash disagreement');cash+=lines+scatter;assert(Number.isSafeInteger(cash),'AG integrity: SG unsafe healthy cash');
 }
 return cash;
}
export function validateOwnHealthyComponents(game:AGGameConfig,g:any,first:boolean,previousFree:any,base:any,previousWin:number) {
 const kind=ownHealthyComponentsBinding(game),deep=kind==='deepsea',hasFree=g?.FSInfo!==undefined;
 
 const names='stake|totalWin|betID|ReelResults|BGInfo'+(deep?'|stakePerLine|paylineCount':'|TopReelInfo')+(g?.BonusSymValues!==undefined?'|BonusSymValues':'')+(hasFree?'|FSInfo':'')+(g?.PickerInfo!==undefined?'|PickerInfo':'')+(!first?'|BaseGameRecoveryInfo'+(deep?'|MultiplierInfo':'|CascadeInfo'):'');
 ownPaidKeys(g,names,'healthy component result');assert(integer(g.stake,'healthy stake')===game.sg.betRaw&&typeof g.betID==='string','AG integrity: SG healthy wager');
 if(deep)assert(g.stakePerLine==='4'&&g.paylineCount==='50','AG integrity: SG Deep Sea wager');else ownHealthyTopReel(g.TopReelInfo);
 if(g.BonusSymValues!==undefined){assert(deep&&typeof g.BonusSymValues==='string'&&/^(?:-1|\d+)(?:\|(?:-1|\d+))*$/.test(g.BonusSymValues),'AG integrity: SG Deep Sea bonus display');const vals=g.BonusSymValues.split('|');assert(vals.length===15&&vals.every((v:string)=>v==='-1'||Number.isSafeInteger(Number(v))),'AG integrity: SG Deep Sea display geometry');}
 ownPaidKeys(g.BGInfo,'totalWagerWin|bgWinnings|isMaxWin'+(deep?'':kind==='rhino'?'|reelHeights':'|reelHeights'),'healthy base info');assert(g.BGInfo.isMaxWin==='0','AG integrity: SG healthy capped result');
 
 if(!deep)assert(ownPositionNumbers(g.BGInfo.reelHeights,6,'base reel heights').every(n=>n>=2&&n<=7),'AG integrity: SG base heights');
 // The returned award is a state transition, not another cash payout.
 // Own closed prefixes include zero/nonzero winnings and 6/8/12 new spins.
 // Preserve unplayed spins, consume exactly one old spin, add only the award.
 const ownFreeRetrigger=!first&&hasFree&&(kind==='rhino')&&integer(g.FSInfo.extraSpinsAwarded,'own returned extra free spins')>0;
 if(!first&&(kind==='rhino')) {
  const spins=list(g.ReelResults.ReelSpin),marked=spins.map((r:any,i:number)=>({r,i})).filter((q:any)=>q.r.bonusAwarded==='Y');
  assert(marked.length===(ownFreeRetrigger?1:0),'AG integrity: SG free award flag disagreement');
  if(ownFreeRetrigger) {
   const award=integer(g.FSInfo.extraSpinsAwarded,'own actual free award');
   assert(previousFree&&integer(g.FSInfo.freeSpinNumber,'own award played')===previousFree.freeSpinsPlayed+1&&integer(g.FSInfo.freeSpinsTotal,'own awarded total')===previousFree.freeSpinsTotal+award,'AG integrity: SG free award counter transition');
   assert(marked[0].i===spins.length-1&&integer(marked[0].r.scatterWinCount,'own award scatter count')>0,'AG integrity: SG free award cascade order');
  }
 }
 const current=ownHealthyReelCash(g.ReelResults,kind,!first,(first&&hasFree)||ownFreeRetrigger)+(first?0:integer(g.FSInfo.guaranteeWinnings,'Rhino returned guarantee cash')),win=integer(g.BGInfo.totalWagerWin,'healthy cumulative'),bg=integer(g.BGInfo.bgWinnings,'healthy paid cash');
 assert(integer(g.totalWin,'healthy current cash')===current&&win===(first?current:previousWin+current),'AG integrity: SG healthy current cumulative cash');
 if(first){assert(bg===current&&previousFree===undefined,'AG integrity: SG healthy paid entry');base=structuredClone(g);}
 else {
  assert(previousFree&&base&&hasFree&&bg===integer(base.BGInfo.bgWinnings,'original paid cash'),'AG integrity: SG healthy free entry retained');
  ownPaidKeys(g.BaseGameRecoveryInfo,deep?'ReelResults':'ReelResults|TopReelInfo','healthy paid recovery');assert(JSON.stringify(g.BaseGameRecoveryInfo.ReelResults)===JSON.stringify(base.ReelResults),'AG integrity: SG healthy original reels changed');
  if(!deep){assert(JSON.stringify(g.BaseGameRecoveryInfo.TopReelInfo)===JSON.stringify(base.TopReelInfo)&&g.BGInfo.reelHeights===base.BGInfo.reelHeights,'AG integrity: SG healthy paid top/height recovery');}
  if(deep){ownPaidKeys(g.MultiplierInfo,'currentMultiplier|multList','Deep Sea multiplier');const mult=integer(g.MultiplierInfo.currentMultiplier,'Deep Sea multiplier');assert(mult>0&&ownPositionNumbers(g.MultiplierInfo.multList,undefined,'Deep Sea multiplier list').includes(mult),'AG integrity: SG Deep Sea multiplier display');}
 }
 if(!hasFree){assert(first&&g.PickerInfo===undefined&&bg===win,'AG integrity: SG healthy free state disappeared');return {win,free:undefined,base};}
 
 const f=g.FSInfo;ownPaidKeys(f,first?'fsWinnings|freeSpinsTotal|freeSpinNumber|isMaxWin':'fsWinnings|freeSpinsTotal|freeSpinNumber|extraSpinsAwarded|isMaxWin|reelHeights|guaranteeWinnings','healthy free info');
 const total=integer(f.freeSpinsTotal,'healthy free total'),played=integer(f.freeSpinNumber,'healthy free played'),freeWin=integer(f.fsWinnings,'healthy free cash');assert(total>0&&played<=total&&bg+freeWin===win,'AG integrity: SG healthy free components');
 if(f.isMaxWin!==undefined)assert(f.isMaxWin==='0','AG integrity: SG healthy free cap');
 if(first){assert(played===0&&freeWin===0,'AG integrity: SG healthy free intro');assert(g.PickerInfo===undefined,'AG integrity: SG Rhino unknown picker');}
 else {
  assert(integer(f.guaranteeWinnings,'Rhino returned guarantee')===0||played===total,'AG integrity: SG Rhino guarantee before natural free end');const award=integer(f.extraSpinsAwarded,'healthy awarded extra spins');assert(played===previousFree.freeSpinsPlayed+1&&total===previousFree.freeSpinsTotal+award,'AG integrity: SG healthy free counter transition');
  if(!deep){assert(g.PickerInfo===undefined&&ownPositionNumbers(f.reelHeights,6,'free heights').every(n=>n>=2&&n<=7),'AG integrity: SG healthy free heights');ownPaidKeys(g.CascadeInfo,'prevCascadeMultiplier|curCascadeMultiplier','88 cascade multiplier');const prior=integer(g.CascadeInfo.prevCascadeMultiplier,'88 prior multiplier'),next=integer(g.CascadeInfo.curCascadeMultiplier,'88 current multiplier');assert(prior===(previousFree.ownCascadeMultiplier??1)&&next===prior+list(g.ReelResults.ReelSpin).length-1,'AG integrity: SG 88 cascade transition');}
 }
 return {win,base,free:{freeSpinsTotal:total,freeSpinsPlayed:played,freeSpinsRemaining:total-played,accumulativeWin:win/100,...{ownCascadeMultiplier:first?1:integer(g.CascadeInfo.curCascadeMultiplier,'Rhino current multiplier')}}};
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
    private lastBase: unknown;private lastBlazingX?:number;private jinseBase:unknown;
    private healthyComponentsBase:any;
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
        if(event==='Logic'&&this.game.sg.healthyComponentsContract){ownHealthyComponentsBinding(this.game);if(this.action==='FREE_SPIN'){assert(Object.keys(parameters).length===0,'AG integrity: SG Rhino free request');return `<GameRequest type="Logic">${header}</GameRequest>`;}assert(this.action==='SPIN'&&JSON.stringify(parameters)===JSON.stringify(this.game.sg.stake),'AG integrity: SG Rhino paid request');return `<GameRequest type="Logic">${header}<AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData><Stake total="200"/></GameRequest>`;}
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
        let lines='';if(event==='Logic'&&this.action==='SPIN'&&this.game.sg.blazingXContract){assert(this.game.gameId==='32755'&&this.game.sg.logicPaylineCount==='40'&&JSON.stringify(parameters)===JSON.stringify(this.game.sg.stake),'AG integrity: SG Blazing own paid request');lines='<PaylineCount count="40"/>';}
        return `<GameRequest type="${event}">${stake?'<AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData>':''}${header}${freeAccount?'<AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData>':''}${stake}${lines}${choice}</GameRequest>`;
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
        if(first) {assert(event==='Logic','AG integrity: SG round start');this.startBalance=this.balance;this.totalWin=0;this.free=undefined;this.steps=[];this.lastBase=undefined;this.jinseBase=undefined;this.healthyComponentsBase=undefined;}
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
            if(this.game.sg.healthyComponentsContract){const mapped=validateOwnHealthyComponents(this.game,g,first,this.free,this.healthyComponentsBase,this.totalWin);this.totalWin=mapped.win;this.free=mapped.free;this.healthyComponentsBase=mapped.base;this.action=this.free?.freeSpinsRemaining>0?'FREE_SPIN':'PLAY';}
            else if(this.game.sg.jinseDragonContract){const mapped=validateJinseDragonData(this.game,g,first,this.free,this.jinseBase,this.totalWin);this.totalWin=mapped.win;this.free=mapped.free;this.jinseBase=mapped.base;this.action=this.free?.freeSpinsRemaining>0?'FREE_SPIN':'PLAY';}
            else{
            const known=new Set(['stake','stakePerLine','paylineCount','totalWin','betID','ReelResults','BGInfo','FSInfo','BaseGameRecoveryInfo',...(this.game.sg.passiveResultFields || []),...(this.game.sg.fiveTreasuresContract ? ['JackpotInfo'] : []),...(this.game.sg.blazingXContract?['XInfo']:[]),...(this.game.sg.herculesContract?['WildPositions']:[])]);
            assert(Object.keys(g).every(k=>known.has(k)),'AG integrity: SG observed feature needs mapping');
            if(g.JackpotInfo!==undefined)validateFiveTreasuresCash(this.game,g,this.totalWin,this.action);
            if(this.game.sg.blazingXContract)validateBlazingXData(this.game,g,first,this.free,this.totalWin);
            if(this.game.sg.herculesContract)validateHerculesData(this.game,g,this.free);
            assert(integer(g.stake,'stake')===this.game.sg.betRaw,'AG integrity: SG changed stake');
            const bg=g.BGInfo;
            if(this.game.sg.omitsBaseRemaining)assert(bg.baseGameSpinsRemaining===undefined,'AG integrity: SG changed base schema');
            else assert(integer(bg.baseGameSpinsRemaining,'remaining base spins')===0,'AG integrity: SG remaining base action not mapped');
            if(g.BonusData)assert(g.BonusData.BonusBet==='0'&&Object.keys(g.BonusData).length===1,'AG integrity: SG purchased bonus not mapped');
            this.totalWin=integer(bg.totalWagerWin,'cumulative wager win');
            assert(g.ReelResults && list(g.ReelResults.ReelSpin).length>0,'AG integrity: SG reel result');
            if(first){this.lastBase=structuredClone(g.ReelResults);if(this.game.sg.blazingXContract)this.lastBlazingX=integer(g.XInfo.currentX,'Blazing paid multiplier');}
            if(g.BaseGameRecoveryInfo) {
                if(this.game.sg.blazingXContract)validateBlazingRecovery(this.game,g,this.lastBase,this.lastBlazingX!);else assert(this.lastBase && JSON.stringify(g.BaseGameRecoveryInfo.ReelResults)===JSON.stringify(this.lastBase),'AG integrity: SG base recovery changed');
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
