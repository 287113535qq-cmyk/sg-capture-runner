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


function ownMatchedPaidBinding(game:AGGameConfig) {
 const c=game.sg.ownMatchedPaidContract;assert(c?.version==='fixed-own-paid-result-v1'&&c.unseenFeatureNotAdmitted===true,'AG integrity: SG matched paid scope');
 assert(c.gameId===game.gameId&&c.dbName===game.dbName&&c.runtimeGameId===game.sg.runtimeGameId&&c.slug===game.sg.runtimeSlug&&c.sourceGameId===game.sg.header.gameID&&c.betRaw===game.sg.betRaw,'AG integrity: SG matched own data binding');
 assert(c.fixedGitCommit==='885f862bcc04841406820a932ef14c38c7759f1d'&&/^[0-9a-f]{64}$/.test(c.ownEvidenceSHA256),'AG integrity: SG matched source proof');return c;
}
function validateOwnMatchedPaidResult(game:AGGameConfig,g:any,first:boolean):number {
 const c=ownMatchedPaidBinding(game);assert(first,'AG integrity: SG matched paid continuation not admitted');
 const check=(value:any,p:string):void=>{if(Array.isArray(value)){assert(value.length>0,'AG integrity: SG matched empty structure');for(const x of value)check(x,p);return;}if(value&&typeof value==='object'){const s=c.schemas[p];assert(s&&Object.keys(value).every(k=>s.keys.includes(k))&&s.required.every((k:string)=>k in value),'AG integrity: SG matched result schema');for(const[k,x]of Object.entries(value))check(x,p+'/'+k);}};
 check(g,'GameResult');assert(!g.FSInfo&&!g.BaseGameRecoveryInfo&&!g.Feature&&!g.PickerInfo&&!g.BonusWheel,'AG integrity: SG matched new feature needs its own evidence');
 assert(integer(g.stake,'matched paid wager')===c.betRaw,'AG integrity: SG matched wager');
 assert(g.BGInfo.isMaxWin==='0','AG integrity: SG matched unseen cap state');if(g.BGInfo.baseGameSpinsRemaining!==undefined)assert(integer(g.BGInfo.baseGameSpinsRemaining,'matched base remaining')===0,'AG integrity: SG matched base continuation requires own evidence');if(g.BGInfo.isBigBet!==undefined)assert(g.BGInfo.isBigBet==='0','AG integrity: SG matched extra wager state');validateOwnKronosReturnedLines(game,g);
 const win=integer(g.totalWin,'matched result cash');assert(integer(g.BGInfo.bgWinnings,'matched base cash')===win&&integer(g.BGInfo.totalWagerWin,'matched cumulative cash')===win,'AG integrity: SG matched cash components');
 const spins=list(g.ReelResults?.ReelSpin);assert(spins.length===1&&integer(g.ReelResults.numSpins,'matched reel count')===1&&spins.every(s=>s.freeSpin==='N'&&s.bonusAwarded==='N'),'AG integrity: SG matched feature marker');
 let sum=0;const visit=(value:any):void=>{if(Array.isArray(value)){value.forEach(visit);return;}if(value&&typeof value==='object')for(const[k,x]of Object.entries(value)){if(k==='winVal'||k==='winValue'){sum+=integer(x,'matched returned reel prize');assert(Number.isSafeInteger(sum),'AG integrity: SG matched safe prize sum');}else if(x&&typeof x==='object')visit(x);}};
 visit(g.ReelResults);assert(sum===win&&spins.every(s=>integer(s.spinWins,'matched spin cash')===win),'AG integrity: SG matched returned prize cash');
 return win;
}


function ownKronosBinding(game:AGGameConfig) {
 const c=game.sg.ownKronosFeatureContract;assert(c?.version==='own-kronos-free-respins-v3'&&['32783','32784'].includes(game.gameId)&&c.gameId===game.gameId&&c.dbName===game.dbName&&c.sourceGameId===game.sg.header.gameID&&c.freeRequestUsesOwnWagerContext===true&&c.unseenFeatureStructuresNotAdmitted===true&&/^[a-f0-9]{64}$/.test(c.clientSHA256),'AG integrity: SG Kronos own feature binding');return c;
}
function validateOwnKronosReturnedLines(game:AGGameConfig,g:any) {
 const requested=game.sg.stake.paylineCount;
 if(!g.Respins){assert(g.paylineCount===requested,'AG integrity: SG matched line count');return;}
 ownKronosBinding(game);assert(game.gameId==='32784'&&requested==='60','AG integrity: SG matched respins game binding');
 ownPaidKeys(g.Respins,'jackpots|Respin','Kronos respins');assert(g.Respins.jackpots==='','AG integrity: SG Kronos respins jackpot requires own cash evidence');
 const respins=list(g.Respins.Respin);assert(respins.length>0,'AG integrity: SG Kronos respins missing');let extraRows=0;
 for(const[r,i]of respins.map((r:any,i:number)=>[r,i] as const)){
  ownPaidKeys(r,r['#text']===undefined?'index':'index|#text','Kronos respin');assert(integer(r.index,'Kronos respin index')===i,'AG integrity: SG Kronos respin sequence');
  if(r['#text']!==undefined){assert(typeof r['#text']==='string'&&/^\d+,\d+(;\d+,\d+)*$/.test(r['#text']),'AG integrity: SG Kronos respin display pairs');for(const pair of r['#text'].split(';')){const[id,pos]=pair.split(',').map(Number);assert(Number.isSafeInteger(pos)&&pos>=0&&Number.isSafeInteger(id)&&id>=1&&id<=5,'AG integrity: SG Kronos respin display values');if(id===4)extraRows++;}}
 }
 const returned=integer(g.paylineCount,'Kronos returned lines');assert(Number.isSafeInteger(60+10*extraRows)&&returned===60+10*extraRows,'AG integrity: SG Kronos lines must follow actual returned extra rows');
 for(const s of list(g.ReelResults?.ReelSpin))for(const w of list(s.PaylineWin))assert(integer(w.index,'Kronos returned line')<returned,'AG integrity: SG Kronos payout line outside returned geometry');
}
function validateOwnKronosData(game:AGGameConfig,g:any,first:boolean,prior:any,base:any,previousWin:number) {
 ownKronosBinding(game);const c=ownMatchedPaidBinding(game);
 if(!g.FSInfo){assert(first&&!prior,'AG integrity: SG Kronos free state disappeared');return {win:validateOwnMatchedPaidResult(game,g,true),free:undefined,base:g};}
 const check=(value:any,p:string):void=>{if(Array.isArray(value)){assert(value.length>0,'AG integrity: SG Kronos empty structure');value.forEach(x=>check(x,p));return;}if(value&&typeof value==='object'){const s=c.schemas[p];assert(s&&Object.keys(value).every(k=>s.keys.includes(k))&&s.required.every((k:string)=>k in value),'AG integrity: SG Kronos feature schema');for(const[k,x]of Object.entries(value))check(x,p+'/'+k);}};
 check(g,'GameResult');assert(integer(g.stake,'Kronos wager')===c.betRaw&&g.BGInfo.isMaxWin==='0','AG integrity: SG Kronos wager or cap');
 if(g.BGInfo.baseGameSpinsRemaining!==undefined)assert(g.BGInfo.baseGameSpinsRemaining==='0','AG integrity: SG Kronos base continuation');if(g.BGInfo.isBigBet!==undefined)assert(g.BGInfo.isBigBet==='0','AG integrity: SG Kronos extra wager');
 validateOwnKronosReturnedLines(game,g);const f=g.FSInfo,played=integer(f.freeSpinNumber,'Kronos free played'),total=integer(f.freeSpinsTotal,'Kronos free total'),freeCash=integer(f.fsWinnings,'Kronos free cash'),bg=integer(g.BGInfo.bgWinnings,'Kronos paid cash'),win=integer(g.BGInfo.totalWagerWin,'Kronos cumulative cash');
 assert(f.isMaxWin==='0'&&total>0&&played<=total&&win===bg+freeCash,'AG integrity: SG Kronos free budget or cash');
 if(f.fsGuarantee!==undefined)integer(f.fsGuarantee,'Kronos returned guarantee threshold');
 const spins=list(g.ReelResults?.ReelSpin);assert(integer(g.ReelResults.numSpins,'Kronos reel count')===1&&spins.length===1,'AG integrity: SG Kronos reel sequence');
 let cash=0;const visit=(v:any):void=>{if(Array.isArray(v)){v.forEach(visit);return;}if(v&&typeof v==='object')for(const[k,x]of Object.entries(v)){if(k==='winVal'||k==='winValue'){cash+=integer(x,'Kronos actual reel prize');assert(Number.isSafeInteger(cash),'AG integrity: SG Kronos safe cash');}else if(x&&typeof x==='object')visit(x);}};visit(g.ReelResults);
 assert(integer(g.totalWin,'Kronos current cash')===cash&&integer(spins[0].spinWins,'Kronos returned spin cash')===cash,'AG integrity: SG Kronos current prize cash');
 if(first){assert(!prior&&!base&&previousWin===0&&played===0&&freeCash===0&&win===cash&&spins[0].freeSpin==='N'&&spins[0].bonusAwarded==='Y'&&!g.BaseGameRecoveryInfo,'AG integrity: SG Kronos actual free intro');if(f.freeSpinsAwarded!==undefined)assert(integer(f.freeSpinsAwarded,'Kronos intro grant')===total,'AG integrity: SG Kronos intro grant');base=structuredClone(g);}
 else{assert(prior&&base&&prior.freeSpinsRemaining>0&&played===prior.freeSpinsPlayed+1&&total>=prior.freeSpinsTotal&&bg===integer(base.BGInfo.bgWinnings,'Kronos original paid cash')&&win===previousWin+cash&&g.betID===base.betID&&spins[0].freeSpin==='Y'&&['N','Y'].includes(spins[0].bonusAwarded),'AG integrity: SG Kronos free transition');
  if(total>prior.freeSpinsTotal)assert(f.freeSpinsAwarded!==undefined&&integer(f.freeSpinsAwarded,'Kronos new grant')===total-prior.freeSpinsTotal&&spins[0].bonusAwarded==='Y','AG integrity: SG Kronos actual new free grant');
  if(g.BaseGameRecoveryInfo)assert(JSON.stringify(g.BaseGameRecoveryInfo.ReelResults)===JSON.stringify(base.ReelResults),'AG integrity: SG Kronos paid recovery changed');
 }
 return {win,base,free:{freeSpinsTotal:total,freeSpinsPlayed:played,freeSpinsRemaining:total-played,accumulativeWin:win/100}};
}


function ownBulkPaidScatter(game:AGGameConfig,g:any,spin:any,boardIndex:number):number {
 const q=game.sg.ownMatchedPaidContract.ordinaryCashContract,c=q.ownScatterCashContract;
 assert(c&&c.gameId===game.gameId&&/^[a-f0-9]{64}$/.test(c.ownSDKFileSHA256),'AG integrity: SG own scatter binding');
 const nemo=game.gameId==='32793'&&c.version==='own-Nemo-zero-scatter-marker-v1',triple=game.gameId==='32811'&&c.version==='own-Triple-separate-cash-scatter-v1';assert(nemo||triple,'AG integrity: SG scatter scope');
 assert(spin.freeSpin==='N'&&integer(spin.spinIndex,'scatter board index')===boardIndex&&boardIndex<(nemo?1:3),'AG integrity: SG scatter paid board');
 const lines=list(spin.PaylineWin),scatters=list(spin.ScatterWin);assert(lines.length===integer(spin.winCountPL,'scatter line count')&&scatters.length===integer(spin.winCountSC,'scatter count')&&scatters.length<=1,'AG integrity: SG scatter counts');
 const lineCash=lines.reduce((n:number,w:any)=>n+integer(w.winVal,'scatter line cash'),0);assert(Number.isSafeInteger(lineCash)&&lineCash===integer(spin.spinWins,'scatter separate line money'),'AG integrity: SG scatter line cash');
 let scatterCash=0;
 for(const w of scatters){ownPaidKeys(w,'winVal|awardIndex|#text','paid scatter');integer(w.awardIndex,'paid scatter award index');const positions=ownPositionNumbers(w['#text'],undefined,'paid scatter positions');assert(positions.length>0&&positions.every(p=>p<(nemo?20:15))&&new Set(positions).size===positions.length,'AG integrity: SG scatter own geometry');const cash=integer(w.winVal,'paid scatter cash');
  if(nemo){assert(cash===0&&spin.bonusAwarded==='N','AG integrity: SG Nemo marker must remain zero ordinary cash');}
  else{assert(g.WheelBonus?.wheelSpins==='0'&&g.WheelBonus?.wheelMultiplier==='0'&&!g.FSInfo,'AG integrity: SG Triple pending feature remains blocked');assert(positions.length>1||cash===0,'AG integrity: SG Triple singleton is a marker');scatterCash+=cash;}
 }
 assert(spin.bonusAwarded==='N'||(triple&&spin.bonusAwarded==='Y'&&scatterCash>0),'AG integrity: SG paid scatter award marker');
 assert(Number.isSafeInteger(scatterCash),'AG integrity: SG scatter overflow');return scatterCash;
}
function validateOwnBulkPaidData(game:AGGameConfig,g:any,first:boolean):number {
 const c=ownMatchedPaidBinding(game),q=c.ordinaryCashContract;
 assert(q?.version==='own-returned-ordinary-cash-v1'&&first&&!game.sg.ownKronosFeatureContract,'AG integrity: SG bulk ordinary scope');
 const check=(value:any,p:string):void=>{if(Array.isArray(value)){assert(value.length>0,'AG integrity: SG bulk empty structure');value.forEach(x=>check(x,p));return;}if(value&&typeof value==='object'){const s=c.schemas[p];assert(s&&Object.keys(value).every(k=>s.keys.includes(k))&&s.required.every((k:string)=>k in value),'AG integrity: SG bulk result schema');for(const[k,x]of Object.entries(value))check(x,p+'/'+k);}};
 check(g,'GameResult');assert(!g.FSInfo&&!g.BaseGameRecoveryInfo&&!g.PickerInfo&&!g.BonusWheel,'AG integrity: SG bulk feature requires own transition evidence');
 if(g.Feature!==undefined){assert(game.gameId==='32809'&&q.watermarkDisplayContract==='own-SDK-watermark-display-without-award-v1','AG integrity: SG unmatched feature');ownPaidKeys(g.Feature,'WatermarkPositions','bulk display watermark');assert(typeof g.Feature.WatermarkPositions==='string','AG integrity: SG watermark display text');const points=ownPositionNumbers(g.Feature.WatermarkPositions,undefined,'bulk watermark display');assert(points.length>0&&points.every(p=>p<25)&&new Set(points).size===points.length,'AG integrity: SG watermark display geometry');}
 assert(integer(g.stake,'bulk wager')===c.betRaw,'AG integrity: SG bulk changed wager');
 for(const[k,value]of Object.entries(q.wagerFields))assert(g[k]===value,'AG integrity: SG bulk changed returned wager context');
 if(q.returnedLineContract){const path=q.returnedLineContract.statePath,flag=path.split('/').reduce((x:any,k:string)=>x?.[k],g);assert(flag==='0'||flag==='1','AG integrity: SG ordinary two-panel display state');assert(integer(g.paylineCount,'bulk returned line geometry')===50+50*integer(flag,'bulk actual panel state'),'AG integrity: SG line geometry differs from actual panel state');}

 const get=(p:string)=>p.split('/').reduce((x:any,k:string)=>x?.[k],g);
 for(const[path,value]of Object.entries(q.fixedStateFields))assert(get(path)===value,'AG integrity: SG bulk new pending/cap/extra-wager state');
 const decoration=q.ownPaidDecorationContract;
 if(decoration){assert(decoration.gameId===game.gameId&&/^[a-f0-9]{64}$/.test(decoration.ownSDKFileSHA256),'AG integrity: SG paid SDK display binding');
  if(game.gameId==='32793'&&decoration.version==='own-Nemo-paid-SDK-position-display-v2'){
   if(g.PressurizedWilds!==undefined){ownPaidKeys(g.PressurizedWilds,'expanded','Nemo paid wild display');const positions=ownPositionNumbers(g.PressurizedWilds.expanded,undefined,'Nemo expanded positions');assert(positions.length>0&&positions.every(p=>p<20)&&new Set(positions).size===positions.length,'AG integrity: SG Nemo paid wild geometry');}
   if(g.WildenedReels!==undefined){ownPaidKeys(g.WildenedReels,'changed','Nemo paid reel display');const reels=ownPositionNumbers(g.WildenedReels.changed,undefined,'Nemo changed reels');assert(reels.length>0&&reels.every(p=>p<5)&&new Set(reels).size===reels.length,'AG integrity: SG Nemo own changed reel geometry');}
   if(g.PersistingWildsInfo!==undefined){ownPaidKeys(g.PersistingWildsInfo,'positions','Nemo paid persisted display');const positions=ownPositionNumbers(g.PersistingWildsInfo.positions,undefined,'Nemo persisted wild positions');assert(positions.length>0&&positions.every(p=>p<20)&&new Set(positions).size===positions.length,'AG integrity: SG Nemo persisted geometry');}
  }else if(game.gameId==='32788'&&decoration.version==='own-GoldenHeart-paid-type-display-v1'){
   // Own SDK initializes its display array before iterating the XML children.
   // A genuinely empty element has no display entries; no cash is defaulted.
   if(g.GoldenHeartInfo==='')assert(decoration.explicitSDKEmptyHeartChildren===true,'AG integrity: SG Golden Heart empty display binding');
   else if(g.GoldenHeartInfo!==undefined){ownPaidKeys(g.GoldenHeartInfo,'Heart','Golden Heart paid display');const hearts=list(g.GoldenHeartInfo.Heart),ids=new Set<number>();assert(hearts.length>0&&hearts.length<=20,'AG integrity: SG Golden Heart count');for(const heart of hearts){ownPaidKeys(heart,'index|jackpotLevel','Golden Heart display type');const index=integer(heart.index,'Golden Heart display position');assert(index<20&&!ids.has(index),'AG integrity: SG Golden Heart geometry');ids.add(index);integer(heart.jackpotLevel,'Golden Heart SDK-decoded display level');}}
  }else throw new Error('AG integrity: SG paid display scope');
 }
 const win=integer(g.totalWin,'bulk current returned cash');
 for(const p of q.currentCashPaths)assert(integer(get(p),'bulk paid cash component')===win,'AG integrity: SG bulk paid cash component');
 for(const p of q.zeroFreeCashPaths)assert(integer(get(p),'bulk free cash in ordinary state')===0,'AG integrity: SG bulk free cash needs actual feature mapping');
 let totalPrizes=0,totalSpinCash=0;const containers=list(g.ReelResults);assert(containers.length>0,'AG integrity: SG bulk actual reels');
 for(const r of containers){const paired=q.pairedReelContract==='own-SDK-top-and-bottom-parallel-spins-v1';let spins:any[];
  if(paired){assert(game.gameId==='32794','AG integrity: SG paired own binding');ownPaidKeys(r,'numSpins|Top_reel_Info|Bottom_reel_Info','bulk paired boards');assert(r.numSpins==='1','AG integrity: SG paired round count');spins=[];for(const key of ['Top_reel_Info','Bottom_reel_Info']){ownPaidKeys(r[key],'ReelSpin','bulk actual board');const own=list(r[key].ReelSpin);assert(own.length===1,'AG integrity: SG one actual spin per paired board');spins.push(...own);}}
  else{spins=list(r.ReelSpin);assert(spins.length>0&&integer(r.numSpins,'bulk actual spin count')===spins.length,'AG integrity: SG bulk spin count');}
  if(q.ownScatterCashContract)assert(spins.length===(game.gameId==='32793'?1:3),'AG integrity: SG paid scatter board count');
  for(const [boardIndex,s] of spins.entries()){const ownDisplayFree=q.ordinaryMarkerContract==='own-SDK-FSInfo-selects-feature-v1'&&game.gameId==='32812';if(q.ownScatterCashContract){totalSpinCash+=ownBulkPaidScatter(game,g,s,boardIndex);}else assert(s.freeSpin===(ownDisplayFree?'Y':'N')&&s.bonusAwarded==='N','AG integrity: SG bulk feature marker');totalSpinCash+=integer(s[q.spinCashField],'bulk actual spin cash');assert(Number.isSafeInteger(totalSpinCash),'AG integrity: SG bulk safe spin cash');}
 }
 const visit=(v:any):void=>{if(Array.isArray(v)){v.forEach(visit);return;}if(v&&typeof v==='object')for(const[k,x]of Object.entries(v)){if(k==='winVal'||k==='winValue'){totalPrizes+=integer(x,'bulk actual reel prize');assert(Number.isSafeInteger(totalPrizes),'AG integrity: SG bulk safe prize cash');}else if(x&&typeof x==='object')visit(x);}};
 visit(g.ReelResults);assert(totalPrizes===win&&totalSpinCash===win,'AG integrity: SG bulk current cash differs from actual prizes');return win;
}

// Own fixed WMS clients select future Logic from actual FS/base counters.
// Honour/wheel presentations use already returned data and send no wheel request.
function ownWMSRealFlowBinding(game:AGGameConfig) {
 const c=game.sg.ownRealNextEndContract;
 const fixed:Record<string,any>={
  '32791':{"db":"sg_mightyblackknight","runtime":33151,"source":"20177","kind":"mighty-black-knight","sdk":"aefd5e1ff253dc27e5b4e387d8cc267fec0d9be99b10e53741ede448dc760958"},
  '32805':{"db":"sg_soldier_of_rome","runtime":33165,"source":"20246","kind":"soldier-of-rome","sdk":"0e8c1cdc24933598c6245c37a78ef918ee8b5e9071a4101c5f6bef96187c3de7"},
  '32782':{"db":"sg_knights_keep","runtime":33004,"source":"20196","kind":"knights-keep","sdk":"435c6ae1488f267cf93b09b4d0f8caf5f721fde2bd8f703724d600e9cb6cb43a"},
  '32812':{"db":"sg_very_fruity","runtime":33172,"source":"20206","kind":"very-fruity","sdk":"73d7979bc75f7d7c15748ce85bb02866592d61051bbf2b42a569be91fda02ab2"},
  '32781':{db:'sg_kings_honour',runtime:33003,source:'20241',kind:'kings-honour',sdk:'8dd6490c6c2566bd51d67206f926adf3c040f654e0a197ac869946bc9820181d'},
  '32811':{db:'sg_triplecashwheel',runtime:33171,source:'20191',kind:'triple-cash-wheel',sdk:'0903de2a8aad707abf617996dee42def683070e2d23f9a369e47f98be620c0f8'},
 };
 const f=fixed[game.gameId];
 assert(c?.version==='own-fixed-client-real-next-end-v1'&&f&&c.gameId===game.gameId&&c.dbName===game.dbName&&game.dbName===f.db&&c.runtimeGameId===f.runtime&&game.sg.runtimeGameId===f.runtime&&c.sourceGameId===f.source&&String(game.sg.header.gameID)===f.source&&c.kind===f.kind&&c.ownSDKFileSHA256===f.sdk,'AG integrity: SG own real next/end binding');
 assert(c.cashPath==='BGInfo/totalWagerWin'&&c.rawRequestResponsePreserved&&c.localPresentationsDoNotRequestServer&&c.originalAGMoneyReplayMongoRequired&&c.noSyntheticTerminal&&c.unmappedFlowStops&&c.noOldUnknownPOSTReplay,'AG integrity: SG own real next/end contract');
 const paid=ownMatchedPaidBinding(game);
 assert(c.logicRequestDataXML===paid.paidRequestDataXML&&JSON.stringify(game.sg.freeStake)===JSON.stringify(game.sg.stake),'AG integrity: SG own continuation request data');
 return c;
}
function validateOwnWMSRealFlow(game:AGGameConfig,g:any,previousFree:any) {
 const c=ownWMSRealFlowBinding(game);
 assert(g&&typeof g==='object'&&!Array.isArray(g)&&g.BGInfo&&typeof g.BGInfo==='object','AG integrity: SG own flow result');
 assert(integer(g.stake,'own flow actual wager')===game.sg.betRaw,'AG integrity: SG own flow changed wager');
 // These interactive structures are not selected by either fixed own client.
 // Extra display data remains raw; it does not need another reel/schema equation.
 for(const tag of ['PickerInfo','Feature','BonusData','BonusWheel','BFInfo','IRFInfo','NextActionInfo'])if(!(c.kind==='soldier-of-rome'&&tag==='IRFInfo'))assert(g[tag]===undefined,'AG integrity: SG own actual next needs mapping');
 const bg=g.BGInfo,win=integer(bg.totalWagerWin,'own flow cumulative wager cash');
 assert(bg.isMaxWin==='0','AG integrity: SG own maximum-win flow not mapped');
 const nextPair=c.kind==='mighty-black-knight'||c.kind==='soldier-of-rome';
 if(nextPair)assert(bg.isBigBet==='0'&&(g.FSInfo?.isMaxWin===undefined||g.FSInfo.isMaxWin==='0'),'AG integrity: SG own extra-wager or maximum-win flow not mapped');
 let baseRemaining=0;
 if(c.kind==='kings-honour') {
  assert(bg.isBigBet==='0','AG integrity: SG own extra-wager flow not mapped');
  baseRemaining=integer(bg.baseGameSpinsRemaining,'own base remaining');
 } else if(bg.baseGameSpinsRemaining!==undefined)assert(integer(bg.baseGameSpinsRemaining,'own unbound base remaining')===0,'AG integrity: SG own base continuation needs mapping');
 let free:Record<string,any>|undefined;
 if(g.FSInfo!==undefined) {
  const f=g.FSInfo;
  assert(f&&typeof f==='object'&&!Array.isArray(f),'AG integrity: SG own FS control');
  const played=integer(c.kind==='soldier-of-rome'?f.spinsUsed:f.freeSpinNumber,'own FS actual played');
  const total=c.kind==='soldier-of-rome'?played+integer(f.spinsRemaining,'own FS actual remaining'):integer(f.freeSpinsTotal,'own FS actual total');
  assert(Number.isSafeInteger(total),'AG integrity: SG own safe FS total');
  assert(played<=total,'AG integrity: SG own invalid FS remaining');
  free={freeSpinsTotal:total,freeSpinsPlayed:played,freeSpinsRemaining:total-played,accumulativeWin:win/100};
  if(c.kind==='soldier-of-rome'&&!previousFree&&free.freeSpinsRemaining>0){
   const spin=list(g.ReelResults?.ReelSpin)[0];
   assert(spin&&spin.winCountSC!==undefined,'AG integrity: SG own Soldier missing initial feature selector');
   if(integer(spin.winCountSC,'own Soldier actual feature selector')!==1)free=undefined;
  }
 } else assert(!previousFree||previousFree.freeSpinsRemaining===0,'AG integrity: SG own active FS selector disappeared');
 const localFeature=c.kind==='kings-honour'?g.ReelOfHonour!==undefined:c.kind==='triple-cash-wheel'&&g.WheelBonus?.WheelOutcome!==undefined;
 return {win,free,baseRemaining,next:(free?.freeSpinsRemaining>0||(!free&&baseRemaining>0))?'FREE_SPIN':localFeature?'WHEEL_SPIN':'PLAY'};
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
    private ownKronosBase:any;
    private ownWMSBaseRemaining=0;
    private healthyComponentsBase:any;
    private journal: number | null = null;
    private journalPath: string | null = null;
    private ordinal = 0;
    private cookies = new Map<string,string>();
    private gameplayRequestHasBeenSent = false;
    constructor(private readonly game: AGGameConfig, private readonly transport?: WireTransport, initialBalance?: number) {
        if(game.sg?.protocol==='gdm')return new SGGdmSession(game,transport as unknown as GDMTransport,initialBalance) as unknown as SGWmsSession;
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
        if(action==='WHEEL_SPIN'&&this.game.sg.ownRealNextEndContract){ownWMSRealFlowBinding(this.game);return {event:'EndGame',parameters:{}};}
        if(action === 'PICK_FREE_SPINS') {fiveTreasuresBinding(this.game);return undefined;}
        if(action === 'FREE_SPIN') {
            if(this.game.sg.ownRealNextEndContract){ownWMSRealFlowBinding(this.game);assert(this.free?.freeSpinsRemaining>0||this.ownWMSBaseRemaining>0,'AG integrity: SG own missing continuation selector');return {event:'Logic',parameters:{...this.game.sg.stake}};}
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
        if(event==='Logic'&&this.game.sg.ownRealNextEndContract){const c=ownWMSRealFlowBinding(this.game);assert((this.action==='SPIN'||(this.action==='FREE_SPIN'&&(this.free?.freeSpinsRemaining>0||this.ownWMSBaseRemaining>0)))&&JSON.stringify(parameters)===JSON.stringify(this.game.sg.stake),'AG integrity: SG own real Logic request');return `<GameRequest type="Logic">${header}${c.logicRequestDataXML}</GameRequest>`;}
        if(event==='Logic'&&this.game.sg.ownMatchedPaidContract){const c=ownMatchedPaidBinding(this.game);if(this.action==='FREE_SPIN'){ownKronosBinding(this.game);assert(this.free?.freeSpinsRemaining>0&&JSON.stringify(parameters)===JSON.stringify(this.game.sg.stake),'AG integrity: SG Kronos own free request');}else assert(this.action==='SPIN'&&JSON.stringify(parameters)===JSON.stringify(this.game.sg.stake),'AG integrity: SG matched paid request');return `<GameRequest type="Logic">${header}${c.paidRequestDataXML}</GameRequest>`;}
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
        if(first) {assert(event==='Logic','AG integrity: SG round start');this.startBalance=this.balance;this.totalWin=0;this.free=undefined;this.steps=[];this.lastBase=undefined;this.jinseBase=undefined;this.healthyComponentsBase=undefined;this.ownKronosBase=undefined;this.ownWMSBaseRemaining=0;}
        else assert(event===(this.action==='PICK_FREE_SPINS'?'Logic':this.getExactFollowUpRequest(this.action)?.event),'AG integrity: SG request order');
        assert(Number.isSafeInteger(this.startBalance),'AG integrity: SG missing initial balance');
        const step=await this.exchange(event,parameters || {}),r=this.readEnvelope(step,event);
        this.steps.push({...step,responseBalance:this.balance});this.lastRequest={event,parameters:structuredClone(parameters)};
        if(event==='EndGame') {
            assert(!r.GameResult,'AG integrity: SG unexpected EndGame result');
            assert(this.balance===this.startBalance-this.game.sg.betRaw+this.totalWin,'AG integrity: SG final balance mismatch');
            this.action='SPIN';
        } else {
            const g=r.GameResult;assert(g&&(g.BGInfo||this.game.sg.ownMatchedPaidContract?.ordinaryCashContract),'AG integrity: SG game result');
            if(this.game.sg.ownRealNextEndContract){const mapped=validateOwnWMSRealFlow(this.game,g,this.free);this.totalWin=mapped.win;this.free=mapped.free;this.ownWMSBaseRemaining=mapped.baseRemaining;this.action=mapped.next;}
            else if(this.game.sg.ownKronosFeatureContract){const mapped=validateOwnKronosData(this.game,g,first,this.free,this.ownKronosBase,this.totalWin);this.totalWin=mapped.win;this.free=mapped.free;this.ownKronosBase=mapped.base;this.action=this.free?.freeSpinsRemaining>0?'FREE_SPIN':'PLAY';}
            else if(this.game.sg.ownMatchedPaidContract){this.totalWin=this.game.sg.ownMatchedPaidContract.ordinaryCashContract?validateOwnBulkPaidData(this.game,g,first):validateOwnMatchedPaidResult(this.game,g,first);this.free=undefined;this.action='PLAY';}
            else if(this.game.sg.healthyComponentsContract){const mapped=validateOwnHealthyComponents(this.game,g,first,this.free,this.healthyComponentsBase,this.totalWin);this.totalWin=mapped.win;this.free=mapped.free;this.healthyComponentsBase=mapped.base;this.action=this.free?.freeSpinsRemaining>0?'FREE_SPIN':'PLAY';}
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

// SG GDM connection/protocol DATA provider for the unchanged original AG.
// No legacy SG imports, transport retries, source-result guesses or SG storage.

type GDMWireStep={msgId:string;methodName:string;requestPayload:string;responsePayload:string;responseXml:string;responseBalance?:number;httpStatus?:number;elapsedMs?:number};
type GDMTransport=(event:string,payload:string)=>Promise<GDMWireStep>;
const gdmParser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,parseAttributeValue:false});
const gdmInteger=(v:unknown,label:string)=>{assert(typeof v==='string'&&/^(0|[1-9]\d*)$/.test(v),'AG integrity: GDM '+label);const n=Number(v);assert(Number.isSafeInteger(n),'AG integrity: GDM unsafe '+label);return n;};
const gdmEscape=(v:unknown)=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
export function ownGDMFields(value:string,separator='&',assignment='='):Record<string,string>{
 assert(typeof value==='string','AG integrity: GDM form input');const out:Record<string,string>=Object.create(null);
 for(const part of value.split(separator)){if(!part)continue;const at=part.indexOf(assignment);assert(at>0,'AG integrity: GDM form field');const k=part.slice(0,at);assert(!Object.prototype.hasOwnProperty.call(out,k),'AG integrity: GDM duplicate field');out[k]=part.slice(at+assignment.length);}
 return out;
}
function gdmBinding(game:AGGameConfig){
 const c=game.sg?.ownGDMContract;
 assert(game.provider==='sg'&&game.sg.protocol==='gdm'&&game.sg.endpoint==='https://ogs-gdm-usnj.nyxop.net/nextgen/','AG integrity: GDM source gdmBinding');
 assert(['own-SDK-ordinary-final-v1','own-SDK-ordinary-typed-final-v2','own-SDK-free-game-chain-v2','own-SDK-free-game-chain-v3','own-SDK-free-prefix-trial-v4','own-SDK-returned-cash-prefix-trial-v5','own-SDK-returned-cash-stage-trial-v6','own-SDK-returned-cash-stage-followup-trial-v7','own-SDK-returned-cash-stage-reentry-trial-v8','own-SDK-FID-stage-counter-trial-v9','own-SDK-FID-optional-trigger-award-trial-v10','own-SDK-FID-real-feature-end-marker-trial-v11','own-SDK-HoldNSpin-no-Native-diagnostic-v12','own-SDK-HoldNSpin-cash-components-no-Native-diagnostic-v13','own-SDK-HoldNSpin-own-physical-Native-v14'].includes(c?.version)&&c.gameId===game.gameId&&c.dbName===game.dbName&&c.runtimeGameId===game.sg.runtimeGameId
  &&c.runtimeSlug===game.sg.runtimeSlug&&game.backendId===c.runtimeSlug&&game.sg.requestParams?.GN===c.runtimeSlug&&c.betRaw===game.sg.betRaw&&c.fixedGitCommit==='885f862bcc04841406820a932ef14c38c7759f1d'
  &&typeof c.ownSDKFileSHA256==='string'&&/^[a-f0-9]{64}$/.test(c.ownSDKFileSHA256)
  &&Number.isSafeInteger(c.betRaw)&&c.betRaw>0&&c.balanceScale===1&&c.winScale===1,'AG integrity: GDM own rule gdmBinding');
 assert((['own-SDK-FID-stage-counter-trial-v9','own-SDK-FID-optional-trigger-award-trial-v10','own-SDK-FID-real-feature-end-marker-trial-v11','own-SDK-HoldNSpin-no-Native-diagnostic-v12','own-SDK-HoldNSpin-cash-components-no-Native-diagnostic-v13','own-SDK-HoldNSpin-own-physical-Native-v14'].includes(c.version)?c.ordinaryOnly===false&&c.ownFIDFeatureContract?.gameId===game.gameId:['own-SDK-ordinary-final-v1','own-SDK-ordinary-typed-final-v2'].includes(c.version)?c.ordinaryOnly===true:c.ordinaryOnly===false&&c.freeBudgetContract?.version==='own-SDK-NFG-without-promotional-FreeRounds-v1'&&c.freeBudgetContract.gameId===game.gameId)&&c.requiresNoPreviousFeature===true&&Array.isArray(c.pendingClauses)&&c.pendingClauses.length>0
  &&c.pendingClauses[0].kind==='SDK-base-false'&&c.pendingClauses.some((q:any)=>q.kind==='fresh-ordinary-SDK-NFG'&&q.wireKey==='NFG'&&q.explicitSDKDefault==='0')
  &&c.rootInactiveFlags.map((q:any)=>q.wireKey).sort().join('|')==='GA|GCT|IFG','AG integrity: GDM own final scope');
 if(['own-SDK-free-prefix-trial-v4','own-SDK-returned-cash-prefix-trial-v5','own-SDK-returned-cash-stage-trial-v6','own-SDK-returned-cash-stage-followup-trial-v7','own-SDK-returned-cash-stage-reentry-trial-v8'].includes(c.version)){
  const rule=c.freeBudgetContract,b=rule?.ownSDKFreeRequestBinding,fields=b?.fieldBindings,params=rule?.freeRequestParams;
  assert(b&&b.ownSDKFileSHA256===c.ownSDKFileSHA256&&b.requestFieldsFromValidatedSourceBetState===true&&b.ordinaryAPAndRECNotAssumedFreeFields===true&&b.requiresCompleteNaturalRoundBeforeAnyNative===true&&b.unmappedOtherFeaturesRemainFatal===true&&b.wholeFreeChainCoverageNotClaimed===true&&Number.isSafeInteger(b.actualPaidIntroCases)&&b.actualPaidIntroCases>0,'AG integrity: GDM own SDK prefix request scope');
  for(const k of ['SDKSelectorSHA256','NFGSetterSHA256','NFGDecoderSHA256','GCTDecoderSHA256','ownRequestConstructorSHA256'])assert(/^[a-f0-9]{64}$/.test(b[k]),'AG integrity: GDM own SDK request byte binding');
  assert(Array.isArray(fields)&&fields.length===2&&new Set(fields.map((q:any)=>q.wireKey)).size===2&&params?.GN===c.runtimeSlug,'AG integrity: GDM own SDK request fields');
  const keys=fields.map((q:any)=>q.wireKey).sort().join('|');assert(keys==='BPL|LB'||keys==='BPR|RB','AG integrity: GDM own SDK wager request class');
  assert(Object.keys(params).sort().join('|')===['GN',...fields.map((q:any)=>q.wireKey)].sort().join('|'),'AG integrity: GDM extra free request input');
  for(const f of fields)assert(f.type?.kind==='integer'&&/^[a-f0-9]{64}$/.test(f.sourceSHA256)&&params[f.wireKey]===game.sg.requestParams[f.wireKey]&&/^[1-9]\d*$/.test(params[f.wireKey]),'AG integrity: GDM source/SDK wager field binding');
 }
 if(['own-SDK-returned-cash-prefix-trial-v5','own-SDK-returned-cash-stage-trial-v6','own-SDK-returned-cash-stage-followup-trial-v7','own-SDK-returned-cash-stage-reentry-trial-v8'].includes(c.version)){
  const b=c.freeBudgetContract?.ownSDKReturnedCashBinding;
  assert(b?.version===(b.actualOwnCompletedNaturalCashChains!==undefined?'own-SDK-TW-total-CW-current-free-cash-natural-v2':'own-SDK-TW-total-CW-current-free-cash-v1')&&b.gameId===game.gameId&&b.ownSDKFileSHA256===c.ownSDKFileSHA256
   &&b.totalWireKey==='TW'&&b.currentWireKey==='CW'&&b.auxiliaryFeatureCashWireKey==='FGTW'&&b.cashTotalsComeFromTWNotFGTW===true
   &&b.actualCWRequiredNoSDKFallbackUsed===true&&b.allRawCashFieldsPreserved===true&&b.noMissingCashDefault===true&&b.noFakeTerminal===true
   &&b.requiresCompleteNaturalRoundBeforeNative===true&&b.otherPendingStagesStillFatal===true&&(b.actualOwnCompletedNaturalCashChains===undefined?Number.isSafeInteger(b.actualOwnCashFailures)&&b.actualOwnCashFailures>0:b.actualOwnCashFailures===0&&Number.isSafeInteger(b.actualOwnCompletedNaturalCashChains)&&b.actualOwnCompletedNaturalCashChains>0&&/^[a-f0-9]{64}$/.test(b.ownCompletedNaturalRecordSHA256)&&Number.isSafeInteger(b.ownNaturalFeatureCurrentCashRaw)&&b.ownNaturalFeatureCurrentCashRaw>0),'AG integrity: GDM own returned cash scope');
  for(const k of ['rootResponseClassSHA256','getterDefinitionSHA256','currentPayoutCopySHA256','auxiliaryInfoSetterSHA256'])assert(/^[a-f0-9]{64}$/.test(b[k]),'AG integrity: GDM own returned cash byte binding');
  assert(Array.isArray(b.fieldBindings)&&b.fieldBindings.length===3&&b.fieldBindings.map((f:any)=>f.wireKey).sort().join('|')==='CW|FGTW|TW'
   &&b.fieldBindings.every((f:any)=>/^[a-f0-9]{64}$/.test(f.sourceSHA256)&&typeof f.property==='string'&&f.property.length>0),'AG integrity: GDM own returned cash decoders');
 }else assert(c.freeBudgetContract?.ownSDKReturnedCashBinding===undefined,'AG integrity: GDM returned cash binding outside own version');
 if(c.ownOptionalRootMetadata!==undefined){
  assert(Array.isArray(c.ownOptionalRootMetadata)&&c.ownOptionalRootMetadata.length===1,'AG integrity: GDM optional metadata scope');
  const q=c.ownOptionalRootMetadata[0];
  assert(q.schema==='own-SDK-optional-PD-metadata-v1'&&q.wireKey==='PD'&&q.gameId===game.gameId&&q.ownSDKFileSHA256===c.ownSDKFileSHA256&&q.explicitSDKRequired===false&&q.missingSDKValue==='null'&&q.cashAndPendingDefaultsForbidden===true,'AG integrity: GDM optional metadata identity');
  assert(JSON.stringify(q.requiredCaptureKeys)===JSON.stringify(['B','AB','TW','MSGID','GA'])&&q.requiredCaptureKeys.every((k:string)=>c.requiredResponseKeys.includes(k))&&c.responseKeys.includes('PD')&&!c.requiredResponseKeys.includes('PD'),'AG integrity: GDM required cash/pending envelope');
  assert(typeof q.ownSDKProperty==='string'&&q.ownSDKProperty.length>0&&/^[a-f0-9]{64}$/.test(q.ownSDKMissingFieldFunctionSHA256)&&Array.isArray(q.ownSDKFieldDecoderSHA256s)&&q.ownSDKFieldDecoderSHA256s.length>0&&q.ownSDKFieldDecoderSHA256s.every((h:any)=>/^[a-f0-9]{64}$/.test(h)),'AG integrity: GDM optional metadata byte proof');
 }
 return c;
}
export function ownGDMOrdinaryFinal(game:AGGameConfig,p:Record<string,string>,terminalContext?:'own-FID-FEATURE_END'):boolean{
 const c=gdmBinding(game),gsd=p.GSD===undefined?{}:ownGDMFields(p.GSD,'#','~');
 for(const k of Object.keys(p))assert(c.responseKeys.includes(k),'AG integrity: GDM unknown response field');
 for(const k of c.requiredResponseKeys)assert(Object.prototype.hasOwnProperty.call(p,k),'AG integrity: GDM missing response field');
 ownGDMSDKTypedGSD(game,gsd);
 // These are explicit own SDK-decoded fields and defaults in this game's
 // sealed contract. Missing unspecified values are never replaced with zero.
 if(terminalContext&&['own-SDK-HoldNSpin-cash-components-no-Native-diagnostic-v13','own-SDK-HoldNSpin-own-physical-Native-v14'].includes(c.version)){
  const q=c.ownFIDFeatureContract.ownClientFeatureEndContext,b=c.ownRootPendingBinding;
  assert(terminalContext==='own-FID-FEATURE_END'&&q?.version==='own-client-cleared-FID-at-explicit-ending-v1'&&q.gameId===game.gameId&&q.ownSDKFileSHA256===c.ownSDKFileSHA256&&q.ownPendingMethodSHA256===b.SDKSourceSHA256&&q.ownFeatureModelClearSHA256===b.ownFeatureModelClearSHA256&&q.ownEndSelectorSHA256===c.ownFIDFeatureContract.SDKEndSelectorSHA256&&q.requiresPriorReturnedNFGZero&&q.noOrdinaryIFGRelaxation&&q.noSyntheticTerminal&&p.MSGID==='FEATURE_END'&&p.FID===undefined,'AG integrity: GDM own client physical ending binding');
 }else if(terminalContext){const q=c.ownFIDFeatureContract?.ownRealFeatureEndMarker,b=c.ownRootPendingBinding;assert(terminalContext==='own-FID-FEATURE_END'&&['own-SDK-FID-real-feature-end-marker-trial-v11','own-SDK-HoldNSpin-no-Native-diagnostic-v12','own-SDK-HoldNSpin-cash-components-no-Native-diagnostic-v13','own-SDK-HoldNSpin-own-physical-Native-v14'].includes(c.version)&&q?.version==='own-SDK-FID-absence-at-actual-FEATURE_END-v1'&&q.gameId===game.gameId&&q.ownSDKFileSHA256===c.ownSDKFileSHA256&&q.ownPendingMethodSHA256===b.SDKSourceSHA256&&q.ownFeatureModelClearSHA256===b.ownFeatureModelClearSHA256&&q.preserveReturnedIFGMarker&&q.onlyAfterActualFeatureEnd&&q.requiresPriorRemainingZero&&q.requiresNoFIDAndNoActiveGAOrGCT&&q.ordinaryStartGuardUnchanged&&q.noSyntheticTerminal&&p.MSGID==='FEATURE_END'&&p.FID===undefined,'AG integrity: GDM own actual feature-end marker binding');for(const k of ['actualEndResponseSHA256','actualOwnSourceArchiveSHA256'])assert(/^[a-f0-9]{64}$/.test(q[k]),'AG integrity: GDM own recorded ending source');}
 for(const q of c.rootInactiveFlags){const v=p[q.wireKey]===undefined?q.explicitSDKDefault:p[q.wireKey];if(terminalContext&&q.wireKey==='IFG'){assert(v==='0'||v==='1','AG integrity: GDM own ending IFG marker type');continue;}assert(v!==undefined&&v==='0','AG integrity: GDM active or unknown own feature');}
 for(const q of c.pendingClauses){
  if(q.kind==='SDK-base-false')continue;
  if(q.kind==='fresh-ordinary-SDK-NFG'){
   const v=p[q.wireKey]===undefined?q.explicitSDKDefault:p[q.wireKey];assert(v!==undefined,'AG integrity: GDM unknown own remaining budget');if(gdmInteger(v,'own remaining budget')>0)return false;
  }else if(q.kind==='own-GSD-array-length'){
   assert(q.SDKArrayDecoderProved===true,'AG integrity: GDM own array decoder');
   if(q.groupPrefix){if(Object.keys(gsd).some(k=>k.startsWith(q.groupPrefix)))return false;}
   else{const v=gsd[q.wireKey];assert(v!==undefined||q.explicitSDKEmptyArray===true,'AG integrity: GDM missing own pending array');if(v!==undefined&&v!=='')return false;}
  }else if(q.kind==='own-GSD-positive-counter'){
   const schema=c.ownGSDDataSchema,projection=schema?.ownEffectiveMetadataObject,field=schema?.fields?.[q.wireKey];
   assert(q.wireKey==='FGRS'&&q.SDKType==='integer'&&q.SDKMissingValue==='null'&&q.noCashDefault===true&&q.positiveMeansGenuineContinuation===true&&field?.type?.kind==='integer'
    &&field.ownSDKFieldSHA256===q.SDKDecoderSHA256&&field.ownSDKProperty===q.property&&schema.ownGSDClass===q.ownGSDClass
    &&projection?.ownMetadataDeserializerSHA256===q.ownMetadataDeserializerSHA256&&/^[a-f0-9]{64}$/.test(q.SDKSourceSHA256),'AG integrity: GDM own positive-counter binding');
   // Exact SDK deserializer sets absent optional FGRS to null; 0 < null is false.
   // No amount or feature result is manufactured and raw dictionary is preserved.
   const value=gsd[q.wireKey];if(value!==undefined&&gdmInteger(value,'own positive pending counter')>0)return false;
  }else if(q.kind==='own-root-fresh-ordinary-predicate'){
   const b=c.ownRootPendingBinding;
   assert(b&&JSON.stringify(q)===JSON.stringify(b)&&q.gameId===game.gameId&&q.ownSDKFileSHA256===c.ownSDKFileSHA256&&q.noCashDefaults===true
    &&/^[a-f0-9]{64}$/.test(q.ownMetadataDeserializerSHA256)&&/^[a-f0-9]{64}$/.test(q.SDKSourceSHA256)
    &&Array.isArray(q.fieldBindings)&&q.fieldBindings.map((f:any)=>f.wireKey).join('|')===q.wireKeys.join('|')&&q.fieldBindings.every((f:any)=>/^[a-f0-9]{64}$/.test(f.sourceSHA256)),'AG integrity: GDM own root pending binding');
   if(q.shape==='own-nullable-root-array-length'){
    assert(q.wireKeys.join('|')==='FID'&&q.SDKMissingValue==='null'&&q.fieldBindings.length===1&&/^[a-f0-9]{64}$/.test(q.ownArrayValidatorSHA256),'AG integrity: GDM own root array binding');
    // The sealed SDK makes an absent optional FID null, whose length is not read.
    // A present feature identifier is outside this ordinary trial scope.
    if(p.FID!==undefined&&p.FID!=='')return false;
   }else if(q.shape==='own-FID-feature-model-absence'){
    assert(q.wireKeys.join('|')==='FID'&&q.SDKMissingValue==='null'&&q.presentFIDIsOutsideOrdinaryTrial===true&&JSON.stringify(q.featureKinds)===JSON.stringify({'0':'ReSpin','1':'FreeSpins','2':'HoldNSpin'})&&['ownFeatureModelSetterSHA256','ownFeatureModelClearSHA256','ownFeatureEnumerationSHA256'].every(k=>/^[a-f0-9]{64}$/.test(q[k])),'AG integrity: GDM own feature-model binding');
    // Own parser clears the feature model to null when optional FID is absent.
    // No present identifier, including 0 or an empty string, is a terminal guess.
    if(p.FID!==undefined)return false;
   }else{
    assert(q.shape==='own-minus-one-pending-marker'&&q.wireKeys.join('|')==='NFG|CFGG'&&q.SDKMissingValue==='not-used-for-ordinary-marker-scope'&&q.ordinaryTrialRequiresCountersInactive===true,'AG integrity: GDM own pending marker binding');
    const n=p.NFG===undefined?null:gdmInteger(p.NFG,'own root pending marker'),played=p.CFGG===undefined?null:gdmInteger(p.CFGG,'own root played counter');
    // Actual leaf is (-1 === NFG && 0 === CFGG); no missing value is inferred.
    // This admission intentionally accepts only fresh ordinary counters.
    assert((n===null||n===0)&&(played===null||played===0),'AG integrity: GDM nonordinary own root counters');
   }
  }else throw new Error('AG integrity: GDM own pending decision not mapped');
 }
 return true;
}
export function ownGDMSDKTypedGSD(game:AGGameConfig,gsd:Record<string,string>){
 const c=gdmBinding(game),schema=c.ownGSDDataSchema;
 if(schema)assert(['own-SDK-free-game-chain-v3','own-SDK-ordinary-typed-final-v2','own-SDK-free-prefix-trial-v4','own-SDK-returned-cash-prefix-trial-v5','own-SDK-returned-cash-stage-trial-v6','own-SDK-returned-cash-stage-followup-trial-v7','own-SDK-returned-cash-stage-reentry-trial-v8','own-SDK-FID-stage-counter-trial-v9','own-SDK-FID-optional-trigger-award-trial-v10','own-SDK-FID-real-feature-end-marker-trial-v11','own-SDK-HoldNSpin-no-Native-diagnostic-v12','own-SDK-HoldNSpin-cash-components-no-Native-diagnostic-v13','own-SDK-HoldNSpin-own-physical-Native-v14'].includes(c.version)&&schema.version==='own-exact-SDK-GSD-types-v1'&&schema.gameId===game.gameId&&schema.ownSDKFileSHA256===c.ownSDKFileSHA256&&schema.unknownUncompiledFieldsStillFatal===true&&schema.noCashOrNextActionDerivedFromOptionalGSD===true,'AG integrity: GDM foreign typed SDK schema');
 const projection=schema?.ownEffectiveMetadataObject;
 if(projection){
  const hashes=[projection.ownObjectCodecSHA256,projection.ownMetadataDeserializerSHA256,...projection.ownClassSourceSHA256s,...projection.emptyParentSourceSHA256s,...projection.ownObjectFieldDecoderSHA256s];
  assert(projection.schema==='own-complete-SDK-metadata-object-v1'&&projection.gameId===game.gameId&&projection.ownSDKFileSHA256===c.ownSDKFileSHA256&&projection.ownGSDClass===schema.ownGSDClass&&hashes.length>=4&&hashes.every((h:any)=>typeof h==='string'&&/^[a-f0-9]{64}$/.test(h)),'AG integrity: GDM foreign own object codec');
  for(const k of ['dictionaryNotPassedToConstructor','metadataOnlyObjectProjection','knownUnsupportedFieldsRemainFatal','rootUnknownsRemainFatal','rawDictionaryPreserved','noCashOrNextActionFromUnconsumedDictionaryFields'])assert(projection[k]===true,'AG integrity: GDM incomplete own object proof');
  assert(Array.isArray(schema.knownUnsupportedFields)&&Array.isArray(projection.effectiveFieldKeys)&&new Set(projection.effectiveFieldKeys).size===projection.effectiveFieldKeys.length&&JSON.stringify([...Object.keys(schema.fields),...schema.knownUnsupportedFields].sort())===JSON.stringify(projection.effectiveFieldKeys),'AG integrity: GDM incomplete own object metadata');
 }
 const check=(value:string,type:any,depth=0):void=>{
  assert(typeof value==='string'&&value.length<=4096&&depth<8&&!/[\x00-\x1f\x7f]/.test(value),'AG integrity: GDM typed SDK field shape');
  if(type.kind==='tuple'){
   assert(typeof type.delimiter==='string'&&type.delimiter.length===1&&Array.isArray(type.items)&&type.items.length>0&&type.items.length<=16&&JSON.stringify(type.requiredSDKPositions)===JSON.stringify(type.items.map((_:any,i:number)=>i))&&/^[a-f0-9]{64}$/.test(type.ownSDKTupleClassSHA256)&&Array.isArray(type.ownSDKPositionDecoderSHA256s)&&type.ownSDKPositionDecoderSHA256s.length===type.items.length&&type.ownSDKPositionDecoderSHA256s.every((h:any)=>/^[a-f0-9]{64}$/.test(h)),'AG integrity: GDM unbound SDK tuple');
   if(value===''&&type.ownSDKEmptyTupleBecomesNull===true){assert(type.noMissingCashDefault===true&&/^[a-f0-9]{64}$/.test(type.ownSDKOptionalParentFieldDecoderSHA256),'AG integrity: GDM unproved optional empty SDK object');return;}
   const parts=value.split(type.delimiter);assert(parts.length===type.items.length&&parts.every(v=>v!==''),'AG integrity: GDM own SDK required tuple positions');for(let i=0;i<parts.length;i++)check(parts[i],type.items[i],depth+1);return;
  }
  if(type.kind==='array'){assert(typeof type.delimiter==='string'&&type.delimiter.length===1,'AG integrity: GDM own SDK delimiter');if(value==='')return;const items=value.split(type.delimiter);if(type.strategy!==undefined){assert(type.strategy==='SDK-postfix'&&/^[a-f0-9]{64}$/.test(type.ownSDKArrayStrategySHA256)&&value.endsWith(type.delimiter),'AG integrity: GDM own SDK postfix array');items.pop();}assert(items.length<=1024,'AG integrity: GDM typed SDK array length');for(const item of items)check(item,type.item,depth+1);return;}
  if(value===''&&depth>0&&['integer','number'].includes(type.kind)&&schema?.preserveNullableSDKArrayCells===true){assert(/^[a-f0-9]{64}$/.test(schema.nullableSDKNumberValidatorSHA256),'AG integrity: GDM nullable SDK cell proof');return;}
  if(type.kind==='string')return;
  if(type.kind==='boolean'){assert(value==='0'||value==='1','AG integrity: GDM typed SDK boolean');return;}
  assert(type.kind==='integer'||type.kind==='number','AG integrity: GDM uncompiled SDK type');
  assert(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(value)&&Number.isFinite(Number(value)),'AG integrity: GDM typed SDK number');
  if(type.kind==='integer')assert(!type.integerAliasValidatorUnproven&&Number.isSafeInteger(Number(value)),'AG integrity: GDM typed SDK integer');
 };
 for(const [key,value]of Object.entries(gsd)){
  const field=schema?.fields?.[key];
  if(field){assert(/^[a-f0-9]{64}$/.test(field.ownSDKFieldSHA256),'AG integrity: GDM unbound SDK field');check(value,field.type);}
  else if(projection){
   assert(!projection.effectiveFieldKeys.includes(key),'AG integrity: GDM known unsupported own object field');
   // This game's complete Object decoder constructs without the dictionary
   // and reads only its bound metadata. Preserve extra display metadata in
   // the raw response; never use it to derive cash or a follow-up request.
   assert(/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(key)&&typeof value==='string'&&value.length<=4096&&!/[\x00-\x1f\x7f]/.test(value),'AG integrity: GDM own object dictionary shape');
  }else assert(c.ordinaryGSDKeys.includes(key),'AG integrity: GDM unknown own typed GSD field');
 }
}
function ownGDMFreeEnvelope(game:AGGameConfig,p:Record<string,string>,event:string){
 const c=gdmBinding(game),rule=c.freeBudgetContract;assert(rule?.gameId===game.gameId,'AG integrity: GDM own free scope');
 for(const k of Object.keys(p))assert(c.responseKeys.includes(k),'AG integrity: GDM unknown free response field');
 for(const k of c.requiredResponseKeys)assert(p[k]!==undefined,'AG integrity: GDM missing free envelope field');
 for(const k of rule.promotionalKeysForbidden)assert(p[k]===undefined,'AG integrity: GDM promotional FreeRounds not mapped');
 assert(p.GA==='0'&&(p.GCT===undefined||p.GCT==='0'),'AG integrity: GDM other active/capped feature not mapped');
 if(['own-SDK-free-prefix-trial-v4','own-SDK-returned-cash-prefix-trial-v5','own-SDK-returned-cash-stage-trial-v6','own-SDK-returned-cash-stage-followup-trial-v7','own-SDK-returned-cash-stage-reentry-trial-v8'].includes(c.version))for(const f of rule.ownSDKFreeRequestBinding.fieldBindings)assert(p[f.wireKey]===undefined||p[f.wireKey]===rule.freeRequestParams[f.wireKey],'AG integrity: GDM source wager state changed before next request');
 const gsd=p.GSD===undefined?{}:ownGDMFields(p.GSD,'#','~');ownGDMSDKTypedGSD(game,gsd);
 assert(c.pendingClauses[0].kind==='SDK-base-false'&&c.pendingClauses[1].kind==='fresh-ordinary-SDK-NFG','AG integrity: GDM own free inherited predicate');
 if(c.pendingClauses.length===3){
  const q=c.pendingClauses[2],schema=c.ownGSDDataSchema,f=schema?.fields?.[q.wireKey];
  assert(rule.extraOwnGSDPendingCounterMustBeInactive===true&&q.kind==='own-GSD-positive-counter'&&q.wireKey==='FGRS'&&q.SDKType==='integer'&&q.SDKMissingValue==='null'&&q.noCashDefault===true&&q.positiveMeansGenuineContinuation===true
   &&f?.type?.kind==='integer'&&f.ownSDKFieldSHA256===q.SDKDecoderSHA256&&f.ownSDKProperty===q.property&&schema.ownGSDClass===q.ownGSDClass
   &&schema.ownEffectiveMetadataObject?.ownMetadataDeserializerSHA256===q.ownMetadataDeserializerSHA256&&/^[a-f0-9]{64}$/.test(q.SDKSourceSHA256),'AG integrity: GDM own extra free predicate binding');
  assert((['own-SDK-returned-cash-stage-trial-v6','own-SDK-returned-cash-stage-followup-trial-v7','own-SDK-returned-cash-stage-reentry-trial-v8'].includes(c.version)&&event==='FREE_GAME')||(['own-SDK-returned-cash-stage-followup-trial-v7','own-SDK-returned-cash-stage-reentry-trial-v8'].includes(c.version)&&event==='BET'&&p.FID==='0|1|')||gsd.FGRS===undefined||gdmInteger(gsd.FGRS,'own extra pending free counter')===0,'AG integrity: GDM extra free stage requires own mapping');
 }else assert(c.pendingClauses.length===2,'AG integrity: GDM extra pending SDK branch not mapped');
 if(event==='FREE_GAME')assert(p.IFG==='1','AG integrity: GDM genuine free marker');else assert(p.IFG===undefined||p.IFG==='0','AG integrity: GDM fresh paid marker');
}
export class SGGdmSession{
 private balance=Number.NaN;private closed=false;private freeState:{total:number;played:number;remaining:number;win:number;offset:number;stageFID?:string;outer?:{total:number;played:number;remaining:number;stageFID:string}}|undefined;private roundStart=0;private totalWin=0;private freeSteps:GDMWireStep[]=[];private lastRequest:{event:string;parameters:Record<string,any>}|undefined;
 private readonly freshFreeId='Free:'+crypto.randomBytes(16).toString('hex');
 private readonly pid='gdmgcm'+this.freshFreeId;private cookies=new Map<string,string>();private ordinal=0;
 private journal:number|null=null;private journalPath:string|null=null;private gameplaySent=false;
 constructor(private readonly game:AGGameConfig,private readonly transport?:GDMTransport,initialBalance?:number){gdmBinding(game);if(initialBalance!==undefined){assert(Number.isSafeInteger(initialBalance)&&initialBalance>=0);this.balance=initialBalance;}}
 private evidence(value:Record<string,unknown>){
  if(this.transport)return;
  if(this.journal===null){const dir=path.resolve(process.env.SG_EVIDENCE_DIR||'.sg-evidence');fs.mkdirSync(dir,{recursive:true});
   if(this.journalPath===null){this.journalPath=path.join(dir,`${this.game.gameId}-${process.pid}-${crypto.randomUUID()}.jsonl`);this.journal=fs.openSync(this.journalPath,'wx',0o600);}else this.journal=fs.openSync(this.journalPath,'a',0o600);}
  fs.writeSync(this.journal,JSON.stringify({...value,at:new Date().toISOString()})+'\n');fs.fsyncSync(this.journal);
  if(this.closed){fs.closeSync(this.journal);this.journal=null;}
 }
 private form(event:string,parameters:Record<string,any>){
  assert(!Object.prototype.hasOwnProperty.call(parameters,'PID')&&!Object.prototype.hasOwnProperty.call(parameters,'MSGID'),'AG integrity: GDM continuation identity belongs to own session');
  const entries={...parameters,PID:this.pid,MSGID:event};
  for(const[k,v]of Object.entries(entries))assert(/^[A-Za-z0-9_]+$/.test(k)&&typeof v==='string'&&!/[&=<\r\n]/.test(v),'AG integrity: GDM own request field');
  return Object.entries(entries).map(([k,v])=>k+'='+v).join('&');
 }
 private decode(step:GDMWireStep,event:string){
  assert(step.msgId===event&&step.methodName==='processGameMessage'&&(step.httpStatus===undefined||step.httpStatus===200),'AG integrity: GDM source exchange');
  const raw=step.responseXml;assert(typeof raw==='string'&&raw.length<262144&&!/<!DOCTYPE|<!ENTITY/i.test(raw),'AG integrity: GDM source XML');
  const r=gdmParser.parse(raw).GDMRESPONSE;assert(r&&Object.keys(r).sort().join('|')==='OGS_RC|PAYLOAD|SUCCESS'&&r.OGS_RC==='0'&&r.SUCCESS==='true'&&typeof r.PAYLOAD==='string','AG integrity: GDM successful envelope');
  assert(step.responsePayload===r.PAYLOAD,'AG integrity: GDM payload differs from original XML');const p=ownGDMFields(r.PAYLOAD);assert(p.MSGID===event,'AG integrity: GDM response event');return p;
 }
 private async exchange(event:string,parameters:Record<string,any>):Promise<GDMWireStep>{
  assert(!this.closed,'AG integrity: GDM session permanently closed');const payload=this.form(event,parameters),ordinal=++this.ordinal;
  const gameplay=event!=='INIT'&&event!=='REELSTRIP';if(gameplay)this.gameplaySent=true;
  const context={event,ordinal,requestKind:event==='FREE_GAME'?'round-follow-up' as const:gameplay?'round-start' as const:'initialization' as const,gameplayRequestHasBeenSent:this.gameplaySent};
  if(this.transport){let step:GDMWireStep;try{step=await this.transport(event,payload);}catch{this.close();throw new SGSourceFault(gameplay?'execution-unknown':'recoverable-initialization',context);}assert(!this.closed,'AG integrity: GDM late response after permanent closure');if(step.httpStatus!==undefined&&step.httpStatus!==200){this.close();throw new SGSourceFault(gameplay?'execution-unknown':'protocol', {...context,httpStatus:step.httpStatus});}return step;}
  const operator=process.env.SG_GDM_OPERATOR_ID;assert(operator&&/^[A-Za-z0-9_-]+$/.test(operator),'AG integrity: GDM own operator configuration missing');
  const body=`<gdmRequest><clienttype>flash</clienttype><lang>en_us</lang><currency>USD</currency><mode>demo</mode><token>${gdmEscape(this.freshFreeId+'@'+operator)}</token><methodName>processGameMessage</methodName><payload>${gdmEscape(payload)}</payload></gdmRequest>`;
  this.evidence({phase:'intent',ordinal,event,payload,methodName:'processGameMessage'});const start=Date.now();let response:Response,text:string;
  try{response=await fetch(this.game.sg.endpoint,{method:'POST',redirect:'error',signal:AbortSignal.timeout(30000),headers:{'Content-Type':'text/xml; charset=utf-8',...(this.cookies.size?{Cookie:[...this.cookies].map(([k,v])=>k+'='+v).join('; ')}:{})},body});text=await response.text();}
  catch{const fault=new SGSourceFault(this.gameplaySent?'execution-unknown':'recoverable-initialization',context);this.evidence({phase:'unknown',ordinal,event,...sourceFaultMetadata(fault)});this.close();throw fault;}
  const transient=[408,425,429,500,502,503,504].includes(response.status),fault=response.status===200?null:new SGSourceFault(this.gameplaySent?'execution-unknown':transient?'recoverable-initialization':'protocol',{...context,httpStatus:response.status,responseSHA256:crypto.createHash('sha256').update(text).digest('hex')});
  this.evidence({phase:'response',ordinal,event,httpStatus:response.status,text,...(fault?sourceFaultMetadata(fault):{})});if(fault){this.close();throw fault;}assert(!this.closed,'AG integrity: GDM late response after permanent closure');
  for(const cookie of response.headers.getSetCookie?.()||[]){const pair=cookie.split(';')[0],at=pair.indexOf('=');if(at>0)this.cookies.set(pair.slice(0,at),pair.slice(at+1));}
  const r=gdmParser.parse(text).GDMRESPONSE;return{msgId:event,methodName:'processGameMessage',requestPayload:payload,responsePayload:r?.PAYLOAD,responseXml:text,httpStatus:response.status,elapsedMs:Date.now()-start};
 }
 async connect(){
  assert(!this.closed,'AG integrity: GDM session closed');if(this.transport){assert(Number.isSafeInteger(this.balance));return;}
  assert(process.env.SG_AG_ALLOW_SOURCE==='1','AG integrity: GDM live source not enabled');
  try{const p=this.decode(await this.exchange('INIT',{GN:this.game.sg.runtimeSlug}),'INIT');assert(p.B!==undefined&&p.AB===p.B&&p.GA==='0'&&(p.IFG===undefined||p.IFG==='0')&&(p.NFG===undefined||p.NFG==='0')&&p.FID===undefined&&p.REC===undefined,'AG integrity: GDM initialization cash or recovery');if(this.game.sg.ownGDMContract.freeBudgetContract)for(const k of this.game.sg.ownGDMContract.freeBudgetContract.promotionalKeysForbidden)assert(p[k]===undefined,'AG integrity: GDM promotional initialization not mapped');this.balance=gdmInteger(p.B,'initial balance');this.decode(await this.exchange('REELSTRIP',{GN:this.game.sg.runtimeSlug}),'REELSTRIP');}catch(e){this.close();throw e;}
 }
 getHandshakeData(){return null;}getBalance(){return this.balance/100;}getFallbackBet(){return this.game.sg.betRaw/100;}
 getSpinParams(){return {...this.game.sg.requestParams};}getInitialRoundRequest(){return{event:'BET',parameters:this.getSpinParams()};}
 getExactFollowUpRequest(action:string){if(this.game.sg.ownGDMContract.ownFlowOnlyCapture){assert(action==='FREE_SPIN');return this.ownFlowNext();}if(this.game.sg.ownGDMContract.ownFIDFeatureContract){assert(action==='FREE_SPIN');return this.ownFIDNext();}if(action==='FREE_SPIN'&&this.ownPendingFree()&&this.game.sg.ownGDMContract.freeBudgetContract)return{event:'FREE_GAME',parameters:{...this.game.sg.ownGDMContract.freeBudgetContract.freeRequestParams}};return undefined;}
 getLastGameRequest(){return this.lastRequest;}getPickParams(){throw new Error('AG integrity: GDM own selection not mapped');}
 isRoundTerminalAction(action:string){return action==='SPIN';}
 private ownExtraStageCounter(p:Record<string,string>,prior:any){
  const c=this.game.sg.ownGDMContract,b=c.freeBudgetContract?.ownSDKExtraStageBinding,schema=c.ownGSDDataSchema;
  assert(b?.version===(c.version==='own-SDK-returned-cash-stage-reentry-trial-v8'?'own-SDK-primary-with-nested-free-counter-v3':c.version==='own-SDK-returned-cash-stage-followup-trial-v7'?'own-SDK-primary-with-nested-free-counter-v2':'own-SDK-primary-with-nested-free-counter-v1')&&b.gameId===this.game.gameId&&b.ownSDKFileSHA256===c.ownSDKFileSHA256
   &&b.optionalBackupCountersMustBePresentTogether===true&&b.entryConsumesExactlyOnePrimarySpin===true&&b.restoreMatchesOwnSavedPrimaryCounterSnapshot===true
   &&b.sourceRootBudgetRequiredForFollowup===true&&b.noCounterDefaults===true&&b.noSyntheticTerminal===true&&b.unseenExtraStageActionStillFatal===true,'AG integrity: GDM own nested counter scope');
  if(['own-SDK-returned-cash-stage-followup-trial-v7','own-SDK-returned-cash-stage-reentry-trial-v8'].includes(c.version))assert(b.zeroRootWithSavedPrimaryUsesOwnFreeSelector===true&&b.paidNestedIntroKeepsUnplayedPrimary===true&&b.nextResponseCounterShapeStillStrict===true&&b.noManufacturedFreeResponse===true&&b.actualClosedFollowupCases>0&&/^[a-f0-9]{64}$/.test(b.SDKLeafSelectorSHA256)&&/^[a-f0-9]{64}$/.test(b.SDKFIDSetterSHA256)&&b.SDKStageHelperSHA256.length===2&&b.SDKStageHelperSHA256.every((h:string)=>/^[a-f0-9]{64}$/.test(h)),'AG integrity: GDM own stage continuation binding');
  for(const k of ['SDKBackupSetterSHA256','SDKPendingMethodSHA256','FIDDecoderSHA256'])assert(/^[a-f0-9]{64}$/.test(b[k]),'AG integrity: GDM own nested counter byte binding');
  assert(b.ordinaryPrimaryStageFID==='1|'&&b.nestedStageFID==='0|1|'&&b.fieldBindings.length===3,'AG integrity: GDM own nested stage identity');
  for(const f of b.fieldBindings)assert(['FGRS','FGTS','CFGC'].includes(f.wireKey)&&f.type?.kind==='integer'
   &&schema.fields[f.wireKey]?.ownSDKFieldSHA256===f.sourceSHA256&&schema.fields[f.wireKey]?.ownSDKProperty===f.property,'AG integrity: GDM own nested counter decoder');
  const g=p.GSD?ownGDMFields(p.GSD,'#','~'):{},keys=['FGRS','FGTS','CFGC'],present=keys.filter(k=>g[k]!==undefined);
  assert(present.length===0||present.length===3,'AG integrity: GDM incomplete primary backup counters');
  const all=gdmInteger(p.TFG,'active free total'),played=gdmInteger(p.CFGG,'active free played'),remaining=gdmInteger(p.NFG,'active free remaining');
  assert(played+remaining===all,'AG integrity: GDM active free counter sum');
  const backup=present.length?{total:gdmInteger(g.FGTS,'saved primary total'),played:gdmInteger(g.CFGC,'saved primary played'),remaining:gdmInteger(g.FGRS,'saved primary remaining'),stageFID:b.ordinaryPrimaryStageFID}:undefined;
  if(backup)assert(backup.played+backup.remaining===backup.total,'AG integrity: GDM saved primary counter sum');
  if(!prior&&['own-SDK-returned-cash-stage-followup-trial-v7','own-SDK-returned-cash-stage-reentry-trial-v8'].includes(c.version)){
   assert(p.FID===b.nestedStageFID&&backup&&backup.played===0&&backup.total===backup.remaining&&played===0&&all===remaining&&gdmInteger(p.FGT,'paid nested award')===all&&remaining>0,'AG integrity: GDM own paid nested intro');
   return{total:all,played,remaining,stageFID:p.FID,outer:backup};
  }
  if(!prior.outer&&p.FID===b.nestedStageFID){
   assert(prior.stageFID===b.ordinaryPrimaryStageFID&&backup&&backup.total>=prior.total&&backup.played===prior.played+1
    &&backup.remaining===prior.remaining-1+backup.total-prior.total&&played===0&&all===remaining&&gdmInteger(p.FGT,'actual nested intro budget')===all&&remaining>0,'AG integrity: GDM genuine nested free intro');
   return{total:all,played,remaining,stageFID:p.FID,outer:backup};
  }
  if(c.version==='own-SDK-returned-cash-stage-reentry-trial-v8'&&prior.outer&&prior.remaining===0&&p.FID===b.nestedStageFID&&played===0){
   const o=prior.outer;
   assert(b.reentryOnlyAfterInnerRemainingZero===true&&b.reentryConsumesExactlyOneSavedPrimarySpin===true&&b.ownSDKSelectorAndBackupMatchSharedReentryMechanism===true
    &&Array.isArray(b.sharedNaturalReentryPacketProofs)&&b.sharedNaturalReentryPacketProofs.length===2&&b.sharedNaturalReentryPacketProofs.every((q:any)=>/^[a-f0-9]{64}$/.test(q.packetSHA256)),'AG integrity: GDM own shared reentry binding');
   assert(o.remaining>0&&backup&&backup.total>=o.total&&backup.played===o.played+1&&backup.remaining===o.remaining-1+backup.total-o.total
    &&all===remaining&&remaining>0&&gdmInteger(p.FGT,'actual repeated inner award')===all,'AG integrity: GDM own repeated nested intro');
   return{total:all,played,remaining,stageFID:p.FID,outer:backup};
  }
  if(prior.outer&&p.FID===prior.outer.stageFID){
   const o=prior.outer,afterBoundary=['own-SDK-returned-cash-stage-followup-trial-v7','own-SDK-returned-cash-stage-reentry-trial-v8'].includes(c.version)&&prior.remaining===0;assert((afterBoundary?all>=o.total&&played===o.played+1&&remaining===o.remaining-1+all-o.total:prior.remaining===1&&all===o.total&&played===o.played&&remaining===o.remaining)
    &&(!backup||(backup.total===o.total&&backup.played===o.played&&backup.remaining===o.remaining)),'AG integrity: GDM own saved primary restoration');
   return{total:all,played,remaining,stageFID:p.FID,outer:undefined};
  }
  assert(p.FID===prior.stageFID&&played===prior.played+1&&all>=prior.total&&remaining===prior.remaining-1+all-prior.total,'AG integrity: GDM own same-stage counter transition');
  if(prior.outer)assert(backup&&backup.total===prior.outer.total&&backup.played===prior.outer.played&&backup.remaining===prior.outer.remaining,'AG integrity: GDM primary counters advanced inside nested stage');
  else assert(!backup||backup.remaining===0,'AG integrity: GDM unbound saved primary counters');
  assert(remaining>0||!backup||backup.remaining===0||(['own-SDK-returned-cash-stage-followup-trial-v7','own-SDK-returned-cash-stage-reentry-trial-v8'].includes(c.version)&&prior.outer&&p.FID===b.nestedStageFID),'AG integrity: GDM extra-stage continuation without active root budget requires own SDK selector');
  return{total:all,played,remaining,stageFID:p.FID,outer:prior.outer};
 }
 private ownPendingFree(){return !!this.freeState&&(this.freeState.remaining>0||(['own-SDK-returned-cash-stage-followup-trial-v7','own-SDK-returned-cash-stage-reentry-trial-v8'].includes(this.game.sg.ownGDMContract.version)&&!!this.freeState.outer&&this.freeState.outer.remaining>0));}
 private async freeCall(event:string,parameters:Record<string,any>|null){
  const c=gdmBinding(this.game),rule=c.freeBudgetContract;assert(!this.closed&&parameters&&rule,'AG integrity: GDM free session closed');
  const first=event==='BET';assert(first?!this.freeState:this.ownPendingFree()&&event==='FREE_GAME','AG integrity: GDM own free action');
  assert.deepStrictEqual(parameters,first?this.game.sg.requestParams:rule.freeRequestParams,'AG integrity: GDM own free request parameters');
  const before=this.balance;assert(Number.isSafeInteger(before));if(first){this.roundStart=before;this.totalWin=0;this.freeSteps=[];}this.lastRequest={event,parameters:{...parameters}};
  const step=await this.exchange(event,parameters);try{
   const p=this.decode(step,event);ownGDMFreeEnvelope(this.game,p,event);
   const total=gdmInteger(p.TW,'cumulative returned cash'),end=gdmInteger(p.B,'returned free balance'),available=gdmInteger(p.AB,'available source balance');
   const remaining=p.NFG===undefined&&first?0:gdmInteger(p.NFG,'actual remaining free budget');
   // Own SDK decodes B and AB separately. Real complete source chains keep
   // AB at the charged round balance or release it to B; no cash is defaulted.
   assert(available===end||((!first||remaining>0)&&available===this.roundStart-c.betRaw),'AG integrity: GDM own B/AB cumulative return split');
   if(first){assert(end===before-c.betRaw+total,'AG integrity: GDM paid intro cash');
    if(remaining>0){const all=gdmInteger(p.TFG,'initial free total'),played=gdmInteger(p.CFGG,'initial played'),rawFeatureCash=gdmInteger(p.FGTW,'initial feature cash');assert(played===0&&all===remaining&&rawFeatureCash<=total&&gdmInteger(p.CW,'paid intro current cash')===total,'AG integrity: GDM genuine free intro');const win=rule.ownSDKReturnedCashBinding?0:rawFeatureCash;this.freeState={total:all,played,remaining,win,offset:total-win,...(['own-SDK-returned-cash-stage-trial-v6','own-SDK-returned-cash-stage-followup-trial-v7','own-SDK-returned-cash-stage-reentry-trial-v8'].includes(c.version)?{stageFID:p.FID,...(['own-SDK-returned-cash-stage-followup-trial-v7','own-SDK-returned-cash-stage-reentry-trial-v8'].includes(c.version)&&p.FID==='0|1|'?this.ownExtraStageCounter(p,undefined):{})}: {})};}
   }else{const prior=this.freeState!;const all=gdmInteger(p.TFG,'returned free total'),played=gdmInteger(p.CFGG,'returned played'),rawFeatureCash=gdmInteger(p.FGTW,'returned auxiliary feature cash'),win=rule.ownSDKReturnedCashBinding?total-prior.offset:rawFeatureCash,current=gdmInteger(p.CW,'current free cash');
    const counters=['own-SDK-returned-cash-stage-trial-v6','own-SDK-returned-cash-stage-followup-trial-v7','own-SDK-returned-cash-stage-reentry-trial-v8'].includes(c.version)?this.ownExtraStageCounter(p,prior):undefined;
    if(!counters)assert(played===prior.played+1&&all>=prior.total&&played+remaining===all&&remaining===prior.remaining-1+all-prior.total,'AG integrity: GDM free counter transition');
    assert(win>=prior.win&&current===win-prior.win&&total===prior.offset+win&&total===this.totalWin+current&&end===before+current,'AG integrity: GDM free cash transition');this.freeState={total:all,played,remaining,win,offset:prior.offset,...counters};
   }
   assert(end===this.roundStart-c.betRaw+total,'AG integrity: GDM whole free cash');if(step.responseBalance!==undefined)assert(step.responseBalance===available,'AG integrity: GDM captured available balance mismatch');this.balance=end;this.totalWin=total;this.freeSteps.push({...step,responseBalance:end});
   const info=this.freeState?{freeSpinsTotal:this.freeState.total,freeSpinsPlayed:this.freeState.played,freeSpinsRemaining:this.freeState.remaining,accumulativeWin:this.freeState.win/100}:undefined;
   const next=this.ownPendingFree()?'FREE_SPIN':'SPIN',steps=next==='SPIN'?this.freeSteps:this.freeSteps.slice(-1);if(next==='SPIN')this.freeState=undefined;
   return{NextActionInfo:{nextAction:next},PlayerBalanceInfo:{preWagerBalance:this.roundStart/100,balance:end/100,wager:c.betRaw/100,resultAmount:total/100},...(info?{FreeSpinsInfo:info}:{}),capturePlatform:'sg',gameId:this.game.sg.runtimeGameId,runtimeSlug:this.game.sg.runtimeSlug,startBalance:this.roundStart/100,endBalance:end/100,totalWin:total/100,stepCount:steps.length,msgIds:steps.map(x=>x.msgId),steps:structuredClone(steps),SGWireResponse:p,SGDecodedResponseXML:step.responseXml,SGOwnSDKDecision:{ownSDKFileSHA256:c.ownSDKFileSHA256,ownNFGPredicateAndNoPromotionalFreeRounds:true,otherFeatureNotAdmitted:true},money:{startBalanceRaw:this.roundStart,endBalanceRaw:end,betRaw:c.betRaw,totalWinRaw:total}};
  }catch(e){this.close();throw e;}
 }
 private ownFIDState:{mode:string;total:number;played:number;remaining:number;win:number;offset:number;outer?:{mode:string;total:number;played:number;remaining:number;win:number;offset:number;triggerCash:number}}|undefined;
 private ownFIDSteps:GDMWireStep[]=[];
 private ownHoldObserved=false;
 private ownNestedHoldObserved=false;
 private ownFIDPaidCash=0;private ownNestedHoldCash=0;private ownLastCurrentCash:number|undefined;private ownPaidFreeReSpinObserved=false;
 private ownFIDRule(){
  const c=gdmBinding(this.game),r=c.ownFIDFeatureContract;
  assert(['own-SDK-FID-stage-counter-trial-v9','own-SDK-FID-optional-trigger-award-trial-v10','own-SDK-FID-real-feature-end-marker-trial-v11','own-SDK-HoldNSpin-no-Native-diagnostic-v12','own-SDK-HoldNSpin-cash-components-no-Native-diagnostic-v13','own-SDK-HoldNSpin-own-physical-Native-v14'].includes(c.version)&&!c.ordinaryOnly&&r?.version==='own-SDK-explicit-FID-stage-v1'&&r.gameId===this.game.gameId&&r.ownSDKFileSHA256===c.ownSDKFileSHA256,'AG integrity: GDM own FID feature binding');
  const hold=['own-SDK-HoldNSpin-no-Native-diagnostic-v12','own-SDK-HoldNSpin-cash-components-no-Native-diagnostic-v13','own-SDK-HoldNSpin-own-physical-Native-v14'].includes(c.version);
  assert(JSON.stringify(r.supportedModes)===JSON.stringify(hold?['0','1','2']:['0','1'])&&r.requiresExplicitStageMoneyAndCounters&&(hold?r.unseenNestedFIDFatal&&(c.version==='own-SDK-HoldNSpin-own-physical-Native-v14'?r.ownNativeHold?.gameId===this.game.gameId:r.HoldDiagnosticsOnly&&r.HoldNeverNativeBeforePhysicalReview):r.unseenNestedFIDAndHoldStagesFatal)&&r.noCashDefaults&&r.noSyntheticTerminal&&r.requiresCompleteNaturalRoundBeforeNative,'AG integrity: GDM own FID bounded scope');
  if(hold){const h=r.ownHoldDiagnostic;assert(h?.version==='own-returned-Hold-NFG-request-only-no-Native-v1'&&h.gameId===this.game.gameId&&h.ownSDKFileSHA256===c.ownSDKFileSHA256&&h.noSyntheticFreeCounters&&h.noHoldNative&&h.onlyReturnedNFGSelectsContinuation&&h.requiresPhysicalFeatureEnd&&h.unseenNestedFatal,'AG integrity: GDM own Hold diagnostic binding');for(const k of ['ownMode2EndCallSHA256','ownMode2StageSetterSHA256','ownFreeSelectorSHA256','ownEndSelectorSHA256','ownInputSHA256'])assert(/^[a-f0-9]{64}$/.test(h[k]),'AG integrity: GDM own Hold source evidence');assert(h.ownMode2StageSetterSHA256===r.SDKStageSetterSHA256&&h.ownFreeSelectorSHA256===r.SDKFreeSelectorSHA256&&h.ownEndSelectorSHA256===r.SDKEndSelectorSHA256&&r.SDKEndModeCallSHA256s[2]===h.ownMode2EndCallSHA256,'AG integrity: GDM own Hold request ownership');} 
  if(c.version==='own-SDK-HoldNSpin-own-physical-Native-v14'){const n=r.ownNativeHold;assert(((this.game.gameId==='32504'&&n.version==='own-32504-physical-Hold-reset-and-cash-v1'&&n.ownActualHoldFreeReplies===11&&JSON.stringify(n.ownActualResetAwards)===JSON.stringify([1,3]))||(this.game.gameId==='32503'&&n.version==='own-32503-physical-Hold-reset-and-cash-v1'&&n.ownActualHoldFreeReplies===5&&JSON.stringify(n.ownActualResetAwards)===JSON.stringify([3])))&&n.gameId===this.game.gameId&&n.ownSDKFileSHA256===c.ownSDKFileSHA256&&n.onlyOwnSingleHoldMode&&n.exactReturnedBudgetSum&&n.currentCashIsStageWinDelta&&n.noCashOrCounterDefaults&&n.noNestedNative&&n.requiresActualFeatureEndAndFIDAbsent&&n.requiresRootCashConservation&&n.originalAGRoundMongoReplayRequired,'AG integrity: GDM own physical Hold Native binding');for(const k of ['ownPhysicalJournalSHA256','ownSourceArchiveSHA256','ownPhysicalEndResponseSHA256'])assert(/^[a-f0-9]{64}$/.test(n[k]),'AG integrity: GDM own actual Hold evidence');}
  if(r.ownNestedHoldDiagnostic){const q=r.ownNestedHoldDiagnostic;assert(['32503','32504'].includes(this.game.gameId)&&q.version==='own-second-FID-Hold-over-FreeSpins-no-Native-v1'&&q.gameId===this.game.gameId&&q.ownSDKFileSHA256===c.ownSDKFileSHA256&&q.actualFID==='2|1|'&&q.outerMode==='1'&&q.innerMode==='2'&&q.ownStageSetterSHA256===r.SDKStageSetterSHA256&&q.ownMode2EndCallSHA256===r.SDKEndModeCallSHA256s[2]&&q.outerFreeConsumesExactlyOne&&q.outerCashAndBudgetPreservedInsideHold&&q.onlyActualReturnedRemainingSelectsFreeRequest&&q.requiresPhysicalMode2End&&q.noNestedNative&&q.noSyntheticFreeCounters&&q.unknownOtherNestedStillFatal,'AG integrity: GDM own nested diagnostic binding');for(const k of ['ownSecondFIDEndContextSHA256','ownNaturalPrefixSHA256'])assert(/^[a-f0-9]{64}$/.test(q[k]),'AG integrity: GDM own nested source evidence');}
  if(r.ownNestedReSpinHoldDiagnostic){const q=r.ownNestedReSpinHoldDiagnostic;assert(((this.game.gameId==='32503'&&q.version==='own-32503-Hold-over-ReSpin-physical-prefix-v1')||(this.game.gameId==='32504'&&q.version==='own-32504-Hold-over-ReSpin-physical-prefix-v1'))&&q.gameId===this.game.gameId&&q.ownSDKFileSHA256===c.ownSDKFileSHA256&&q.actualFID==='2|0|'&&q.outerMode==='0'&&q.ownSecondFIDEndContextSHA256===r.ownNestedHoldDiagnostic.ownSecondFIDEndContextSHA256&&q.noNative&&q.outerConsumesExactlyOne&&q.requiresRealMode2EndThenReturnedMode0End&&/^[a-f0-9]{64}$/.test(this.game.gameId==='32503'?q.actualOwnJournalSHA256:q.actualOwnPacketSHA256),'AG integrity: GDM own nested ReSpin binding');}
  if(r.ownNativeNestedHold){const q=r.ownNativeNestedHold;assert(((this.game.gameId==='32504'&&q.version==='own-32504-physical-repeated-and-final-free-Hold-v1'&&q.actualOwnWholePacketsSHA256.length===2)||(this.game.gameId==='32503'&&q.version==='own-32503-physical-Hold-over-FreeSpins-v1'&&q.actualOwnWholePacketsSHA256.length===1))&&q.gameId===this.game.gameId&&q.ownSDKFileSHA256===c.ownSDKFileSHA256&&q.ownSecondFIDEndContextSHA256===r.ownNestedHoldDiagnostic.ownSecondFIDEndContextSHA256&&q.outerMode==='1'&&q.realHoldEndsReturnUnchangedOuterBudget&&q.separatePaidHoldAndFreeStageCash&&q.actualRootEndCWIsOriginalPaidCash&&q.noSyntheticCounters&&q.onlyActualFinalFeatureEndMakesNative&&q.requiresOriginalAGRoundMongoReplay&&q.actualOwnWholePacketsSHA256.every((x:string)=>/^[a-f0-9]{64}$/.test(x)),'AG integrity: GDM own physical nested Native binding');}
  if(r.ownNestedHoldEndDisplay){const q=r.ownNestedHoldEndDisplay;assert(this.game.gameId==='32504'&&q.gameId===this.game.gameId&&q.version==='own-32504-inner-Hold-end-retains-outer-trigger-cash-v1'&&q.ownSDKFileSHA256===c.ownSDKFileSHA256&&q.ownSecondFIDEndContextSHA256===r.ownNestedHoldDiagnostic.ownSecondFIDEndContextSHA256&&q.outerMode==='1'&&q.saveActualOuterTriggerCurrentCash&&q.requiresOuterStageWinDeltaAndRootCashAtIntro&&q.endCurrentEqualsSavedTriggerCash&&q.requiresUnchangedRootAndOuterCounters&&q.noSecondCashCredit&&/^[a-f0-9]{64}$/.test(q.actualOwnPacketSHA256),'AG integrity: GDM own Hold end display binding');}
  if(r.ownNestedHoldIntroBudget){const q=r.ownNestedHoldIntroBudget;assert(this.game.gameId==='32503'&&q.gameId===this.game.gameId&&q.version==='own-32503-returned-nested-Hold-intro-budget-v1'&&q.ownSDKFileSHA256===c.ownSDKFileSHA256&&JSON.stringify(q.actualIntroAwards)===JSON.stringify([1,3])&&q.requiresActualPositiveAwardEqualsRemainingAndTotal&&q.requiresPlayedZeroAndStageCashZero&&q.noSyntheticCounter&&q.actualOwnPacketSHA256s.length===2&&q.actualOwnPacketSHA256s.every((h:string)=>/^[a-f0-9]{64}$/.test(h)),'AG integrity: GDM own nested Hold intro budget binding');}
  if(r.ownNestedReSpinHoldReturn){const q=r.ownNestedReSpinHoldReturn;assert(this.game.gameId==='32504'&&q.gameId===this.game.gameId&&q.version==='own-32504-real-Hold-ending-return-to-spent-ReSpin-prefix-v1'&&q.ownSDKFileSHA256===c.ownSDKFileSHA256&&q.ownSecondFIDEndContextSHA256===r.ownNestedHoldDiagnostic.ownSecondFIDEndContextSHA256&&q.requiresUnchangedRootAndOuterCounters&&q.requiresActualInnerTerminalCountersAndSavedTriggerCash&&q.nextPhysicalRequestMode==='0'&&q.noNativeUntilOwnCompletePhysicalChain&&/^[a-f0-9]{64}$/.test(q.actualOwnPacketSHA256),'AG integrity: GDM own real nested ReSpin return binding');}
  if(r.ownPaidFreeOverReSpinDiagnostic){const q=r.ownPaidFreeOverReSpinDiagnostic;assert(this.game.gameId==='32503'&&q.gameId===this.game.gameId&&q.version==='own-32503-paid-FreeSpins-over-ReSpin-prefix-v1'&&q.ownSDKFileSHA256===c.ownSDKFileSHA256&&q.ownStageSetterSHA256===r.SDKStageSetterSHA256&&q.ownEndSelectorSHA256===r.SDKEndSelectorSHA256&&JSON.stringify(q.ownEndModeCallSHA256s)===JSON.stringify(r.SDKEndModeCallSHA256s.slice(0,2))&&q.actualFID==='1|0|'&&q.onlyActualPaidIntro&&q.firstFIDSelectsCurrentStage&&q.strictTwoStageCountersAndCash&&q.requiresActualStage1EndBeforeReturnedStage0&&q.noNativeUntilOwnWholePhysicalChain&&/^[a-f0-9]{64}$/.test(q.actualOwnPacketSHA256),'AG integrity: GDM own paid Free/ReSpin prefix binding');}
  for(const k of ['SDKCashGetterSHA256','SDKStageSetterSHA256','SDKRequestConstructorSHA256','SDKFreeSelectorSHA256','SDKEndSelectorSHA256','rootCWFieldSHA256','rootTWFieldSHA256','SDKAvailablePhaseGetterSHA256','ownABFieldSHA256'])assert(/^[a-f0-9]{64}$/.test(r[k]),'AG integrity: GDM own FID source binding');
  assert(r.pendingAvailableIsFundedBalance&&r.terminalAvailableIncludesTotalWin,'AG integrity: GDM own available cash phase');
  assert(r.SDKEndModeCallSHA256s?.length===(hold?3:2)&&r.SDKEndModeCallSHA256s.every((h:string)=>/^[a-f0-9]{64}$/.test(h)),'AG integrity: GDM own ending source');
  assert(Object.keys(r.freeRequestParams).sort().join('|')==='BPR|GN|RB'&&Object.keys(r.endRequestParams).sort().join('|')==='GN|RB','AG integrity: GDM own feature request shape');
  for(const k of ['GN','BPR','RB'])assert(r.freeRequestParams[k]===this.game.sg.requestParams[k],'AG integrity: GDM own feature wager context');
  assert(r.endRequestParams.GN===r.freeRequestParams.GN&&r.endRequestParams.RB===r.freeRequestParams.RB,'AG integrity: GDM own end wager context');
  for(const mode of r.supportedModes)for(const name of ['NFG','TFG','CFGG','FGT','FGTW']){
   const b=r.stageFieldBindings[mode][name],f=c.ownGSDDataSchema.fields[b.wireKey];assert(b.wireKey===name+'_'+mode&&f?.type.kind==='integer'&&f.ownSDKFieldSHA256===b.SHA256&&f.ownSDKProperty===b.property,'AG integrity: GDM own FID counter decoder');
  }
  if(['own-SDK-FID-optional-trigger-award-trial-v10','own-SDK-FID-real-feature-end-marker-trial-v11'].includes(c.version)||(hold&&r.ownOptionalTriggerAward)){
    const q=r.ownOptionalTriggerAward;assert(q?.version==='own-SDK-FGT-optional-when-budget-does-not-grow-v1'&&q.gameId===this.game.gameId&&q.ownSDKFileSHA256===c.ownSDKFileSHA256&&q.noAwardOrCashSynthesized&&q.introAndBudgetGrowthStillRequireActualAward&&q.requiredMoneyAndBudgetFieldsUnchanged,'AG integrity: GDM own optional FGT policy');
    for(const mode of ['0','1']){const b=q.fieldBindings[mode],f=c.ownGSDDataSchema.fields['FGT_'+mode];assert(b.wireKey==='FGT_'+mode&&b.fieldSHA256===f.ownSDKFieldSHA256&&b.property===f.ownSDKProperty&&b.explicitSDKDefault===0&&/^[a-f0-9]{64}$/.test(b.missingFieldDeserializerSHA256),'AG integrity: GDM own optional FGT metadata');}
   }
   return r;
 }
 private ownFIDNext(){
  const r=this.ownFIDRule(),s=this.ownFIDState;if(!s)return undefined;
  return s.remaining>0?{event:'FREE_GAME',parameters:{...r.freeRequestParams}}:{event:'FEATURE_END',parameters:{...r.endRequestParams,CFG:s.mode}};
 }
 private async ownFIDCall(event:string,parameters:Record<string,any>|null){
  const c=gdmBinding(this.game),r=this.ownFIDRule(),first=event==='BET',prior=this.ownFIDState;
  assert(!this.closed&&parameters,'AG integrity: GDM own FID session closed');
  if(first){assert(!prior,'AG integrity: GDM new wager inside own feature');assert.deepStrictEqual(parameters,this.game.sg.requestParams);this.roundStart=this.balance;this.totalWin=0;this.ownFIDSteps=[];this.ownHoldObserved=false;this.ownNestedHoldObserved=false;this.ownFIDPaidCash=0;this.ownNestedHoldCash=0;this.ownLastCurrentCash=undefined;this.ownPaidFreeReSpinObserved=false;}
  else{const next=this.ownFIDNext();assert(next&&event===next.event,'AG integrity: GDM own FID wrong continuation');assert.deepStrictEqual(parameters,next.parameters,'AG integrity: GDM own FID continuation parameters');}
  const step=await this.exchange(event,parameters);this.lastRequest={event,parameters:{...parameters}};
  try{
   const p=this.decode(step,event);for(const key of Object.keys(p))assert(c.responseKeys.includes(key),'AG integrity: GDM own FID unknown response field');
   for(const key of c.requiredResponseKeys)assert(p[key]!==undefined,'AG integrity: GDM own FID missing cash envelope');
   assert(p.GA==='0'&&(p.GCT===undefined||p.GCT==='0')&&(p.IFG===undefined||p.IFG==='0'||p.IFG==='1'),'AG integrity: GDM own FID other active root');
   for(const key of ['REC','FRR','FRTW','FRTR','FRABM','FRBPL'])assert(p[key]===undefined,'AG integrity: GDM promotional or recovered feature not mapped');
   for(const key of ['BPR','RB'])assert(p[key]===undefined||p[key]===this.game.sg.requestParams[key],'AG integrity: GDM changed own wager state');
   const g=p.GSD===undefined?{}:ownGDMFields(p.GSD,'#','~');ownGDMSDKTypedGSD(this.game,g);
   const total=gdmInteger(p.TW,'own FID total cash'),end=gdmInteger(p.B,'own FID balance'),available=gdmInteger(p.AB,'own FID available balance');assert(end===this.roundStart-c.betRaw+total,'AG integrity: GDM own FID cash conservation');
   if(step.responseBalance!==undefined)assert(step.responseBalance===end,'AG integrity: GDM own FID captured balance');
   let mode:string|undefined,nested=false,paidFreeReSpin=false;if(p.FID!==undefined){paidFreeReSpin=p.FID==='1|0|'&&!!r.ownPaidFreeOverReSpinDiagnostic;nested=(p.FID==='2|1|'&&!!r.ownNestedHoldDiagnostic)||(p.FID==='2|0|'&&!!r.ownNestedReSpinHoldDiagnostic);const m=/^([012])\|$/.exec(p.FID);assert(paidFreeReSpin||nested||(m&&r.supportedModes.includes(m[1])),'AG integrity: GDM own FID nested or unadmitted mode');mode=paidFreeReSpin?'1':nested?'2':m![1];if(mode==='2')this.ownHoldObserved=true;if(nested)this.ownNestedHoldObserved=true;}
   assert(available===(mode===undefined?end:this.roundStart-c.betRaw),'AG integrity: GDM own available balance phase');
   const counter=(id:string)=>{const values:Record<string,number>={};for(const key of ['NFG','TFG','CFGG','FGT','FGTW']){if(key==='FGT'&&g[key+'_'+id]===undefined&&(id==='2'||r.ownOptionalTriggerAward))continue;values[key]=gdmInteger(g[key+'_'+id],'own explicit '+key+'_'+id);}if(id!=='2')assert(values.CFGG+values.NFG===values.TFG,'AG integrity: GDM own stage budget sum');return values;};
   let nextState:typeof this.ownFIDState;
   if(first){
    assert(!nested&&(p.IFG===undefined||p.IFG==='0'),'AG integrity: GDM own paid intro marker');
    if(paidFreeReSpin){const f=counter('1'),o=counter('0');assert(f.CFGG===0&&f.NFG===f.TFG&&f.FGT===f.TFG&&f.FGTW===0&&f.NFG===6&&o.CFGG===0&&o.NFG===o.TFG&&o.FGT===o.TFG&&o.FGTW===0&&o.NFG===1&&gdmInteger(p.CW,'own paid compound current cash')===total,'AG integrity: GDM own paid Free/ReSpin two-stage intro');this.ownFIDPaidCash=total;this.ownPaidFreeReSpinObserved=true;nextState={mode:'1',total:f.TFG,played:0,remaining:f.NFG,win:0,offset:total,outer:{mode:'0',total:o.TFG,played:0,remaining:o.NFG,win:0,offset:total,triggerCash:total}};}else if(mode===undefined){this.ownFIDPaidCash=total;assert(ownGDMOrdinaryFinal(this.game,p),'AG integrity: GDM unmapped ordinary pending');if(p.CW!==undefined)assert(gdmInteger(p.CW,'own ordinary current cash')===total);}
    else{const b=counter(mode);assert(b.CFGG===0&&b.NFG>0&&b.FGT===b.TFG&&b.FGTW<=total&&gdmInteger(p.CW,'own paid current cash')===total,'AG integrity: GDM own FID genuine intro');if(mode==='2'&&r.ownNativeHold)assert(b.NFG===b.TFG&&b.FGT===3&&b.FGTW===0,'AG integrity: GDM own physical Hold intro');this.ownFIDPaidCash=total-b.FGTW;nextState={mode,total:b.TFG,played:0,remaining:b.NFG,win:b.FGTW,offset:total-b.FGTW};}
   }else if(event==='FREE_GAME'){
    assert(prior&&prior.remaining>0&&(mode===prior.mode||(nested&&prior.mode===p.FID.split('|')[1]&&!prior.outer)),'AG integrity: GDM own FID unobserved stage switch');const b=counter(mode!);
    if(nested&&prior.mode!=='2'){
     const o=counter(prior.mode),current=gdmInteger(p.CW,'own nested intro current cash');
     assert(o.CFGG===prior.played+1&&o.TFG>=prior.total&&o.NFG===prior.remaining-1+o.TFG-prior.total,'AG integrity: GDM own outer free consumption');
     if(o.TFG>prior.total)assert(o.FGT===o.TFG-prior.total,'AG integrity: GDM own outer retrigger award');
     assert(o.FGTW>=prior.win&&current===o.FGTW-prior.win&&total===prior.offset+o.FGTW&&total===this.totalWin+current,'AG integrity: GDM own nested intro cash');
     assert(b.CFGG===0&&b.FGTW===0&&(r.ownNestedHoldIntroBudget?(r.ownNestedHoldIntroBudget.actualIntroAwards.includes(b.FGT)&&b.FGT>0&&b.NFG===b.FGT&&b.TFG===b.FGT):(b.NFG===3&&b.TFG===3&&b.FGT===3)),'AG integrity: GDM own nested Hold genuine intro');
     nextState={mode:'2',total:b.TFG,played:0,remaining:b.NFG,win:0,offset:total,outer:{mode:prior.mode,total:o.TFG,played:o.CFGG,remaining:o.NFG,win:o.FGTW,offset:prior.offset,triggerCash:current}};
    }else if(mode==='2'){
     if(prior.outer){assert(nested,'AG integrity: GDM own nested Hold identity changed');const o=counter(prior.outer.mode);assert(p.FID==='2|'+prior.outer.mode+'|'&&o.CFGG===prior.outer.played&&o.TFG===prior.outer.total&&o.NFG===prior.outer.remaining&&o.FGTW===prior.outer.win,'AG integrity: GDM outer free changed inside Hold');}

     if(r.ownNativeHold){
      assert(b.CFGG===prior.played+1&&b.TFG===b.CFGG+b.NFG,'AG integrity: GDM own Hold explicit budget transition');
      if(b.FGT!==undefined)assert(r.ownNativeHold.ownActualResetAwards.includes(b.FGT)&&b.NFG===b.FGT,'AG integrity: GDM own Hold returned reset award');
      else assert(b.NFG===prior.remaining-1,'AG integrity: GDM own Hold remaining transition');
      const current=gdmInteger(p.CW,'own physical Hold current cash');assert(b.FGTW>=prior.win&&current===b.FGTW-prior.win&&total===prior.offset+b.FGTW&&total===this.totalWin+current,'AG integrity: GDM own Hold stage and root cash');
     }
     // Diagnostic siblings retain raw counters and still cannot make Native.
     // No manufactured AG free progress, no Hold Native and no money default.
     assert(total>=this.totalWin,'AG integrity: GDM own Hold total cash regressed');
     if(p.CW!==undefined)assert(gdmInteger(p.CW,'own Hold returned current cash')<=total,'AG integrity: GDM own Hold current cash exceeds total');
     nextState={...prior,total:b.TFG,played:b.CFGG,remaining:b.NFG,win:b.FGTW};
    }else{
    assert(b.CFGG===prior.played+1&&b.TFG>=prior.total&&b.NFG===prior.remaining-1+b.TFG-prior.total,'AG integrity: GDM own FID counter transition');
    if(b.TFG>prior.total)assert(b.FGT===b.TFG-prior.total,'AG integrity: GDM own FID retrigger award');
    if(this.ownPaidFreeReSpinObserved&&prior.outer){const o=counter('0');assert(paidFreeReSpin&&prior.mode==='1'&&o.CFGG===prior.outer.played&&o.TFG===prior.outer.total&&o.NFG===prior.outer.remaining&&o.FGTW===prior.outer.win,'AG integrity: GDM paid compound outer ReSpin changed during free');}const current=gdmInteger(p.CW,'own FID current cash');assert(b.FGTW>=prior.win&&current===b.FGTW-prior.win&&total===prior.offset+b.FGTW&&total===this.totalWin+current,'AG integrity: GDM own FID current/total cash');nextState={...prior,total:b.TFG,played:b.CFGG,remaining:b.NFG,win:b.FGTW};}
   }else{
    if(this.ownPaidFreeReSpinObserved){assert(event==='FEATURE_END'&&prior&&prior.remaining===0&&total===this.totalWin,'AG integrity: GDM own paid compound actual ending');if(prior.outer){assert(prior.mode==='1'&&mode==='0'&&!paidFreeReSpin&&!nested,'AG integrity: GDM own paid compound must physically return mode0');const f=counter('1'),o=counter('0');assert(f.CFGG===prior.played&&f.TFG===prior.total&&f.NFG===0&&f.FGTW===prior.win&&o.CFGG===prior.outer.played&&o.TFG===prior.outer.total&&o.NFG===prior.outer.remaining&&o.FGTW===prior.outer.win&&gdmInteger(p.CW,'own compound free ending paid display')===this.ownFIDPaidCash,'AG integrity: GDM own paid compound ending counters/cash');nextState={mode:'0',total:o.TFG,played:o.CFGG,remaining:o.NFG,win:o.FGTW,offset:this.ownFIDPaidCash+prior.win};}else{assert(prior.mode==='0'&&mode===undefined,'AG integrity: GDM own paid compound final still active');const o=counter('0');assert(o.CFGG===prior.played&&o.TFG===prior.total&&o.NFG===0&&o.FGTW===prior.win&&gdmInteger(p.CW,'own compound ReSpin ending display')===this.ownLastCurrentCash,'AG integrity: GDM own paid compound final counters/cash');throw new Error('AG integrity: OWN_PAID_FREE_RESPIN_PHYSICAL_REVIEW_REQUIRED_NO_NATIVE');}}else if(this.ownNestedHoldObserved){
     assert(event==='FEATURE_END'&&prior&&prior.remaining===0&&total===this.totalWin,'AG integrity: GDM own nested physical end request');
     if(p.CW!==undefined)assert(gdmInteger(p.CW,'own nested diagnostic ending display')<=total,'AG integrity: GDM own nested ending display exceeds root cash');
     if(prior.outer){assert(prior.mode==='2'&&mode===prior.outer.mode&&!nested,'AG integrity: GDM own nested end must return the saved outer stage');const o=counter(mode!);assert(o.CFGG===prior.outer.played&&o.TFG===prior.outer.total&&o.NFG===prior.outer.remaining&&o.FGTW<=total,'AG integrity: GDM own nested ending outer budget changed');if(r.ownNativeNestedHold){const inner=counter('2');assert(inner.CFGG===prior.played&&inner.TFG===prior.total&&inner.NFG===0&&inner.FGTW===prior.win&&gdmInteger(p.CW,'own real Hold ending display')===(r.ownNestedHoldEndDisplay?prior.outer.triggerCash:0),'AG integrity: GDM own nested Hold terminal counters/cash');assert((prior.outer.mode==='1'||(prior.outer.mode==='0'&&r.ownNestedReSpinHoldReturn))&&o.FGTW===prior.outer.win,'AG integrity: GDM own nested outer cash changed at Hold end');this.ownNestedHoldCash+=prior.win;assert(total===this.ownFIDPaidCash+this.ownNestedHoldCash+o.FGTW,'AG integrity: GDM own paid/Hold/free cash components');}nextState={mode:mode!,total:o.TFG,played:o.CFGG,remaining:o.NFG,win:o.FGTW,offset:r.ownNativeNestedHold?this.ownFIDPaidCash+this.ownNestedHoldCash:total-o.FGTW};}
     else{assert(mode===undefined,'AG integrity: GDM own nested final ending still active');for(const id of ['0','1','2'])if(g['NFG_'+id]!==undefined)assert(gdmInteger(g['NFG_'+id],'own nested terminal remaining')===0);assert(ownGDMOrdinaryFinal(this.game,p,'own-FID-FEATURE_END'),'AG integrity: GDM own nested final predicate');if(!r.ownNativeNestedHold)throw new Error('AG integrity: OWN_NESTED_HOLD_PHYSICAL_END_REVIEW_REQUIRED_NO_NATIVE');if(prior.mode==='0')throw new Error('AG integrity: OWN_NESTED_RESPIN_FINAL_PHYSICAL_REVIEW_REQUIRED_NO_NATIVE');assert(prior.mode==='1'&&prior.played===prior.total&&total===this.ownFIDPaidCash+this.ownNestedHoldCash+prior.win&&gdmInteger(p.CW,'own nested final paid display')===this.ownFIDPaidCash,'AG integrity: GDM own nested final cash components');const terminal=counter('1');assert(terminal.CFGG===prior.played&&terminal.TFG===prior.total&&terminal.NFG===0&&terminal.FGTW===prior.win,'AG integrity: GDM own nested final free counters');}
    }else{
    if(this.ownHoldObserved){assert(event==='FEATURE_END'&&prior&&prior.remaining===0,'AG integrity: GDM own Hold physical end request');if(!r.ownNativeHold)throw new Error('AG integrity: OWN_HOLD_PHYSICAL_END_REVIEW_REQUIRED_NO_NATIVE');assert(prior.mode==='2'&&mode===undefined&&g['NFG_2']==='0','AG integrity: GDM own single Hold real terminal');}
    assert(event==='FEATURE_END'&&prior&&prior.remaining===0&&total===this.totalWin,'AG integrity: GDM own FID ending cash');if(p.CW!==undefined){let expected=['own-SDK-HoldNSpin-cash-components-no-Native-diagnostic-v13','own-SDK-HoldNSpin-own-physical-Native-v14'].includes(c.version)&&r.ownEndBaseCashComponent?.variant==='own-returned-paid-offset-end-CW'?prior.offset:0;if(prior.mode==='1'&&r.ownFreeStageEndCash){const q=r.ownFreeStageEndCash;assert(this.game.gameId==='32504'&&q.gameId===this.game.gameId&&q.ownSDKFileSHA256===c.ownSDKFileSHA256&&q.version==='own-32504-real-FreeSpins-end-retains-paid-offset-v1'&&q.requiresActualEndAfterCompleteStage1&&q.requiresPlayedEqualsTotalAndRemainingZero&&q.currentEqualsUnchangedPaidOffset&&q.stageAndRootCashUnchanged&&q.noSecondCredit&&/^[a-f0-9]{64}$/.test(q.actualOwnPacketSHA256)&&prior.played===prior.total&&prior.remaining===0,'AG integrity: GDM own free-stage end cash binding');const b=counter('1');assert(b.CFGG===prior.played&&b.TFG===prior.total&&b.NFG===0&&b.FGTW===prior.win,'AG integrity: GDM own free-stage terminal counters changed');expected=prior.offset;}if(prior.mode==='0'&&r.ownReturnedReSpinEndCash){const q=r.ownReturnedReSpinEndCash;assert(((this.game.gameId==='32504'&&q.version==='own-32504-returned-ReSpin-stage-win-at-physical-end-v2'&&q.actualOwnPacketSHA256s.length===3)||(this.game.gameId==='32503'&&((q.version==='own-32503-returned-ReSpin-stage-win-at-physical-end-v1'&&q.actualOwnPacketSHA256s.length===2)||(q.version==='own-32503-ReSpin-end-retains-last-physical-current-cash-v2'&&q.actualOwnPacketSHA256s.length===3&&q.currentEqualsLastActualFreeResponseCash))))&&q.gameId===this.game.gameId&&q.ownSDKFileSHA256===c.ownSDKFileSHA256&&q.requiresActualFeatureEndAndPriorMode0&&q.requiresPlayedEqualsActualTotalAndRemainingZero&&q.requiresActualFreeCounterAndRootCashTransitions&&q.noSecondCashCredit&&q.requiresUnchangedTotalAndFinalBalance&&(q.currentEqualsReturnedStageWin||q.currentEqualsLastActualFreeResponseCash)&&q.actualOwnPacketSHA256s.every((h:string)=>/^[a-f0-9]{64}$/.test(h))&&Number.isSafeInteger(prior.total)&&prior.total>0&&prior.played===prior.total&&prior.remaining===0,'AG integrity: GDM own returned ReSpin end component');const actualEnd=counter('0');assert(actualEnd.CFGG===prior.played&&actualEnd.TFG===prior.total&&actualEnd.NFG===0&&actualEnd.FGTW===prior.win,'AG integrity: GDM own ReSpin terminal counters changed');expected=q.currentEqualsLastActualFreeResponseCash?this.ownLastCurrentCash!:prior.win;assert(Number.isSafeInteger(expected)&&expected>=0,'AG integrity: GDM own real preceding current cash missing');}if(['own-SDK-HoldNSpin-cash-components-no-Native-diagnostic-v13','own-SDK-HoldNSpin-own-physical-Native-v14'].includes(c.version)){const q=r.ownEndBaseCashComponent;assert(q?.version==='own-returned-end-CW-is-retained-paid-component-v1'&&q.gameId===this.game.gameId&&q.ownSDKFileSHA256===c.ownSDKFileSHA256&&q.rootCWFieldSHA256===r.rootCWFieldSHA256&&q.rootTWFieldSHA256===r.rootTWFieldSHA256&&q.noSecondCredit&&q.requiresUnchangedTotalAndFinalBalance&&['own-returned-paid-offset-end-CW','retained-zero-end-CW'].includes(q.variant),'AG integrity: GDM own end cash component binding');}assert(gdmInteger(p.CW,'own ending current cash')===expected,'AG integrity: GDM own end cash component differs');}
    if(mode!==undefined){assert(mode!==prior.mode,'AG integrity: GDM own ending did not advance');const b=counter(mode);assert(b.CFGG===0&&b.NFG>0&&b.FGT===b.TFG&&b.FGTW<=total,'AG integrity: GDM own next stage intro');nextState={mode,total:b.TFG,played:0,remaining:b.NFG,win:b.FGTW,offset:total-b.FGTW};}
    else{for(const id of ['0','1','2'])if(g['NFG_'+id]!==undefined)assert(gdmInteger(g['NFG_'+id],'own terminal counter')===0);assert(ownGDMOrdinaryFinal(this.game,p,(r.ownRealFeatureEndMarker||r.ownClientFeatureEndContext)?'own-FID-FEATURE_END':undefined),'AG integrity: GDM own terminal predicate');}
    }
   }
   if(p.CW!==undefined)this.ownLastCurrentCash=gdmInteger(p.CW,'own actual current cash');this.balance=end;this.totalWin=total;this.ownFIDState=nextState;this.ownFIDSteps.push({...step,responseBalance:end});
   const active=nextState||prior,next=nextState?'FREE_SPIN':'SPIN',steps=nextState?this.ownFIDSteps.slice(-1):this.ownFIDSteps;
   return{NextActionInfo:{nextAction:next},PlayerBalanceInfo:{preWagerBalance:this.roundStart/100,balance:end/100,wager:c.betRaw/100,resultAmount:total/100},...(active&&!this.ownHoldObserved&&!this.ownPaidFreeReSpinObserved?{FreeSpinsInfo:{freeSpinsTotal:active.total,freeSpinsPlayed:active.played,freeSpinsRemaining:active.remaining,accumulativeWin:active.win/100}}:{}),capturePlatform:'sg',gameId:this.game.sg.runtimeGameId,runtimeSlug:this.game.sg.runtimeSlug,startBalance:this.roundStart/100,endBalance:end/100,totalWin:total/100,stepCount:steps.length,msgIds:steps.map(s=>s.msgId),steps:structuredClone(steps),SGWireResponse:p,SGDecodedResponseXML:step.responseXml,SGOwnSDKDecision:{ownSDKFileSHA256:c.ownSDKFileSHA256,ownExplicitFIDStage:true,noSyntheticTerminal:true},money:{startBalanceRaw:this.roundStart,endBalanceRaw:end,betRaw:c.betRaw,totalWinRaw:total}};
  }catch(e){this.close();throw e;}
 }

  private ownFlowState:{mode:string;remaining:number}|undefined;
  private ownFlowSteps:GDMWireStep[]=[];
  private ownFlowRule(){
   const c=gdmBinding(this.game),q=c.ownFlowOnlyCapture,r=c.ownFIDFeatureContract;
   assert(['own-SDK-first-FID-flow-only-capture-v2','own-SDK-first-FID-flow-only-capture-v3'].includes(q?.version)&&q.gameId===this.game.gameId&&r.gameId===this.game.gameId&&q.ownSDKFileSHA256===c.ownSDKFileSHA256&&q.ownStageSetterSHA256===r.SDKStageSetterSHA256&&q.ownFreeSelectorSHA256===r.SDKFreeSelectorSHA256&&q.ownEndSelectorSHA256===r.SDKEndSelectorSHA256&&JSON.stringify(q.ownEndModeCallSHA256s)===JSON.stringify(r.SDKEndModeCallSHA256s)&&JSON.stringify(q.supportedModes)===JSON.stringify(['0','1','2']),'AG integrity: GDM own flow-only source binding');
   assert(q.usesActualFirstFIDAndRemainingOnly&&q.totalWinSource==='TW'&&q.balanceSource==='B'&&q.betSource==='own-fixed-request'&&q.rawWirePreserved&&q.noSyntheticFreeCounters&&q.noDisplayAmountOrBudgetArithmeticGate&&q.originalAGAmountReplayMongoChecksRequired&&q.noOldUnknownPOSTReplay&&q.nonFlowFieldsPreservedWithoutInterpretation&&q.onlyUsedRequiredFieldsValidated&&q.unknownFlowStillStops,'AG integrity: GDM own flow-only envelope');
   if(q.version==='own-SDK-first-FID-flow-only-capture-v3')assert(q.ownMode2EndCallSHA256===r.ownHoldDiagnostic.ownMode2EndCallSHA256,'AG integrity: GDM own mode2 ending source binding');
   return {c,q,r};
  }
  private ownFlowNext(){const {r}=this.ownFlowRule(),s=this.ownFlowState;if(!s)return undefined;return s.remaining>0?{event:'FREE_GAME',parameters:{...r.freeRequestParams}}:{event:'FEATURE_END',parameters:{...r.endRequestParams,CFG:s.mode}};}
  private async ownFlowCall(event:string,parameters:Record<string,any>|null){
   const {c,q}=this.ownFlowRule(),first=event==='BET',prior=this.ownFlowState;
   assert(!this.closed&&parameters,'AG integrity: GDM own flow session closed');
   if(first){assert(!prior,'AG integrity: GDM new wager inside unfinished flow');assert.deepStrictEqual(parameters,this.game.sg.requestParams);this.roundStart=this.balance;this.totalWin=0;this.ownFlowSteps=[];}
   else{const next=this.ownFlowNext();assert(next&&event===next.event,'AG integrity: GDM wrong real flow continuation');assert.deepStrictEqual(parameters,next.parameters);}
   const step=await this.exchange(event,parameters);this.lastRequest={event,parameters:{...parameters}};
   try{
    const p=this.decode(step,event);assert(p.TW!==undefined&&p.B!==undefined,'AG integrity: GDM missing required AG monetary envelope');
    assert(p.GA==='0'&&(p.GCT===undefined||p.GCT==='0'),'AG integrity: GDM unmapped flow flag');for(const k of ['REC','FRR','FRTW','FRTR','FRABM','FRBPL'])assert(p[k]===undefined,'AG integrity: GDM recovered/promotional flow unmapped');for(const k of ['BPR','RB'])assert(p[k]===undefined||p[k]===this.game.sg.requestParams[k],'AG integrity: GDM own wager changed');
    // Other display/metadata fields are retained in raw wire; they cannot block next/end.
    const g=p.FID===undefined?{}:(p.GSD===undefined?{}:ownGDMFields(p.GSD,'#','~'));
    const total=gdmInteger(p.TW,'own actual total cash'),end=gdmInteger(p.B,'own actual balance');
    assert(end===this.roundStart-c.betRaw+total,'AG integrity: GDM own actual cash conservation');if(step.responseBalance!==undefined)assert(step.responseBalance===end,'AG integrity: GDM original captured balance differs');
    let nextState:typeof this.ownFlowState;
    if(p.FID!==undefined){const modes=p.FID.split('|');assert(modes.pop()===''&&modes.length>0&&modes.length<=3&&new Set(modes).size===modes.length&&modes.every((m:string)=>q.supportedModes.includes(m)),'AG integrity: GDM unknown flow mode');const mode=modes[0],remaining=gdmInteger(g['NFG_'+mode],'own actual remaining for first FID');nextState={mode,remaining};}
    else{assert(!prior||event==='FEATURE_END','AG integrity: GDM flow disappeared before actual ending');const pending=c.ownRootPendingBinding;assert(pending?.shape==='own-FID-feature-model-absence'&&pending.gameId===this.game.gameId&&pending.ownSDKFileSHA256===c.ownSDKFileSHA256&&JSON.stringify(pending.wireKeys)===JSON.stringify(['FID']),'AG integrity: GDM own terminal selector binding');if(p.NFG!==undefined)assert(gdmInteger(p.NFG,'own root remaining before terminal')===0,'AG integrity: GDM root still requests continuation');}
    this.balance=end;this.totalWin=total;this.ownFlowState=nextState;this.ownFlowSteps.push({...step,responseBalance:end});const steps=nextState?this.ownFlowSteps.slice(-1):this.ownFlowSteps;
    return {NextActionInfo:{nextAction:nextState?'FREE_SPIN':'SPIN'},PlayerBalanceInfo:{preWagerBalance:this.roundStart/100,balance:end/100,wager:c.betRaw/100,resultAmount:total/100},capturePlatform:'sg',gameId:this.game.sg.runtimeGameId,runtimeSlug:this.game.sg.runtimeSlug,startBalance:this.roundStart/100,endBalance:end/100,totalWin:total/100,stepCount:steps.length,msgIds:steps.map(s=>s.msgId),steps:structuredClone(steps),SGWireResponse:p,SGDecodedResponseXML:step.responseXml,SGOwnSDKDecision:{ownSDKFileSHA256:c.ownSDKFileSHA256,ownFirstFIDFlowOnly:true,noSyntheticTerminal:true},money:{startBalanceRaw:this.roundStart,endBalanceRaw:end,betRaw:c.betRaw,totalWinRaw:total}};
   }catch(e){this.close();throw e;}
  }
 async callGameData(event:string,parameters:Record<string,any>|null){
  if(this.game.sg.ownGDMContract.ownFlowOnlyCapture)return this.ownFlowCall(event,parameters);
   if(this.game.sg.ownGDMContract.ownFIDFeatureContract)return this.ownFIDCall(event,parameters);
  if(this.game.sg.ownGDMContract.freeBudgetContract)return this.freeCall(event,parameters);
  assert(!this.closed&&event==='BET'&&parameters,'AG integrity: GDM own ordinary request');assert.deepStrictEqual(parameters,this.game.sg.requestParams,'AG integrity: GDM own request parameters changed');
  const start=this.balance;assert(Number.isSafeInteger(start));this.lastRequest={event,parameters:{...parameters}};
  const step=await this.exchange(event,parameters);try{
   const p=this.decode(step,event),c=gdmBinding(this.game);
   assert(ownGDMOrdinaryFinal(this.game,p),'AG integrity: GDM own SDK requires genuine continuation');
   const win=gdmInteger(p.TW,'own returned win'),end=gdmInteger(p.B,'own returned balance');assert(p.AB===p.B&&end===start-c.betRaw+win,'AG integrity: GDM own final cash conservation');
   if(step.responseBalance!==undefined)assert(step.responseBalance===end,'AG integrity: GDM captured cash differs');this.balance=end;
   return{NextActionInfo:{nextAction:'SPIN'},PlayerBalanceInfo:{preWagerBalance:start/100,balance:end/100,wager:c.betRaw/100,resultAmount:win/100},capturePlatform:'sg',gameId:this.game.sg.runtimeGameId,runtimeSlug:this.game.sg.runtimeSlug,
    startBalance:start/100,endBalance:end/100,totalWin:win/100,stepCount:1,msgIds:['BET'],steps:[{...step,responseBalance:end}],SGWireResponse:p,SGDecodedResponseXML:step.responseXml,
    SGOwnSDKDecision:{ownSDKFileSHA256:c.ownSDKFileSHA256,verifiedOwnOrdinaryFinal:true,unseenFeatureNotAdmitted:true},money:{startBalanceRaw:start,endBalanceRaw:end,betRaw:c.betRaw,totalWinRaw:win}};
  }catch(e){this.close();throw e;}
 }
 close(){this.closed=true;this.cookies.clear();if(this.journal!==null){fs.closeSync(this.journal);this.journal=null;}}
}
