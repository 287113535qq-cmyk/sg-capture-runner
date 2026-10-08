import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {inspectControl} from './crystal-free-route.mjs';
import {parseXml,one,children} from '../pearl-protocol.mjs';
const bytes=fs.readFileSync(new URL('./own-client-main.js',import.meta.url));
assert.equal(createHash('sha256').update(bytes).digest('hex'),'b03b2c92e84c816cccbff6ccc95b151b0fb92e65334be27471588c9277466800');
const text=bytes.toString('utf8');
function method(name){const at=text.indexOf(name+' = function');assert(at>0);const start=text.indexOf('function',at),end=text.indexOf('\n        };',start);assert(end>start);return text.slice(start,end+10);}
const context=vm.createContext({Utils:{PSLog:{log(){}}},_super:{prototype:{execute(){},parse(){}}},
 game:{GameEvent:Object.assign(function(name){this.name=name;},{NO_MORE_FREE_SPINS:'end',FREE_SPIN_VALID:'logic',NO_FREE_SPINS_AWARDED:'ordinary'}),Subgame:{FREE_SPINS_GAME:'free'}},setTimeout:f=>f()});
const run=(name,self,args=[])=>{context.self=self;context.args=args;return vm.runInContext('('+method(name)+').apply(self,args)',context,{timeout:500});};
function clientDecision(xml){
 const r=parseXml(xml),g=one(r,'GameResult'),asDom=n=>({nodeName:n.tag,attributes:{getNamedItem:k=>Object.hasOwn(n.a,k)?{value:n.a[k]}:null},childNodes:children(n).map(asDom)});
 const logic={};run('IFPMGameResultParser.prototype.parse',{},[{getElementsByTagName:()=>[asDom(g)]},logic]);
 let event=null;const self={_server:{getLogicResponse:()=>logic},_freeSpinsGameModel:{decrementFreeSpinCount(){},activate(){},setNumberOfFreeSpins(){},reset(){}},
  _stateModel:{changeSubgame(){}},_layerManager:{},doGlobalDispatch:e=>event=e.name};
 if(logic.fsSpinsTotal>0)run('RequestFreeSpinCmd.prototype.execute',self);
 else run('CheckingIfFreeSpinsGameHasBeenAwardedCmd.prototype.execute',self);
 return event==='logic'?'Logic':event==='end'||event==='ordinary'?'EndGame':null;
}
const vectors=JSON.parse(fs.readFileSync(new URL('./route-vectors-private.json',import.meta.url)));
for(const v of vectors.cases)test(v.id,()=>{
 if(!v.accept){assert.throws(()=>inspectControl(v.input));return;}
 const got=inspectControl(v.input);assert.equal(got.next,v.next);assert.equal(got.next,clientDecision(v.input.xml));
 assert.equal(got.captureAuthorized,false);assert.equal(got.businessComplete,false);assert.equal(got.moneyValidated,false);
});
test('actual client maps free continuation to the same own Logic request with fsOn, not header-only EndGame',()=>{
 assert(text.includes('this.init(this._metaData.getLogicUrl(), "20142", "1_0"'));
 assert(text.includes('this.mapCommand(game.MakePlayRequestCmd, game.GameStateEvent.EnterState(game.Subgame.FREE_SPINS_GAME, "freeSpinValid"))'));
 assert.equal(run('StakeEncoder.prototype.parse',{_stakeTotal:25}),'<Stake total="25" fsOn="1" />');
 let sent=null,started=0;
 context.game.StakeEncoder=function(n){this.value=run('StakeEncoder.prototype.parse',{_stakeTotal:n});};
 context.server={GLSCurrencyEncoder:function(n){this.value='currency:'+n;},GLSRequest:function(payload){this.payload=payload;}};
 run('MakePlayRequestCmd.prototype.sendRequest',{_stakeModel:{getTotalStake:()=>25},_server:{getInitResponse:()=>({platformData:{currencyMultiplier:1},isRecovering:false}),makeLogicRequest:r=>sent=r},
  _historyModel:{getIsHistoryReplay:()=>false},_partnerAdapter:{startedPlay:()=>started++}});
 assert.equal(sent.payload[0].value,'<Stake total="25" fsOn="1" />');assert.equal(sent.payload[1].value,'currency:1');assert.equal(started,1);
});
