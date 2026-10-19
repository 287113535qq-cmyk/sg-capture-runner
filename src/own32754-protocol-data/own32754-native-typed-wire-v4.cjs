'use strict';
const vm=require('node:vm');
exports.createOwn32754NativeWire=function({DOM,data,need}){
 class Element{static [Symbol.hasInstance](n){return !!n&&n.nodeType===1}}class Document{static [Symbol.hasInstance](n){return !!n&&n.nodeType===9}}
 const ctx=vm.createContext({E:{},SG:{hd:{te:{}}},R:{},x:Object.assign,Element,Document,document:{implementation:DOM.implementation}});
 const run=s=>new vm.Script(s).runInContext(ctx,{timeout:100});const p=data.parts,c=data.classes;
 const fn=s=>run('('+s+')');ctx.y=fn(p.decorator.source);ctx.z=fn(p.inherits.source)();ctx.B=fn(p.fields.source);
 for(const key of ['primitives','events'])run('('+p[key].source+')(E)');ctx.E.aa={ksa:fn(p.hierarchy.source)};
 for(const key of ['metadata','registry','xml'])run('('+p[key].source+')(E)');ctx.E.Ja={warn:s=>{throw Error('Arthur native XML ambiguity: '+s)}};ctx.f=ctx.l=ctx.E.jj.bi;
 const C={};const construct=(key,arg)=>{const f=fn(c[key].source);return C[key]=arg===undefined?f():f(arg)};
 for(const key of ['header','currency','account','balance','init','end','baseLogic','baseResult','baseResponse','baseEndResponse','baseInitResponse','baseVariant','decisionTag','bg','free','award','payline','paylines','gameInfo','awardsInfo','jackpotInfo','reelSet','reelSpin','paylineWin','scatterWin','betConfig'])construct(key);
 construct('accountWms',C.account);ctx.f.ZC=C.accountWms;construct('variant',C.baseVariant);ctx.e=C.variant;construct('wmsInitResponse',C.baseInitResponse);
 construct('wmsLogic',C.baseLogic);construct('decisionRequest',C.wmsLogic);construct('wmsResult',C.baseResult);ctx.e=C.wmsResult;construct('wmsResponse',C.baseResponse);
 Object.assign(ctx.SG.hd,{te:{ZC:C.account},Kfa:C.award,tD:C.wmsInitResponse,Wz:C.wmsResult,Qga:C.free,oU:C.wmsResponse});
 for(const key of ['ownInitDeclarations','ownResultDeclarations'])run('('+p[key].source+')(R)');
 function bind(source,bindings){ctx.__binding=bindings;const keys=Object.keys(bindings);const f=run('(function('+keys.join(',')+'){return ('+source+');})');return f(...keys.map(k=>bindings[k]));}
 const mY=bind(data.leaves.header.source,{a:{C2:C.header}}),init=bind(data.leaves.init.source,{b:{$k:C.init}}),end=bind(data.leaves.EndGame.source,{b:{$k:C.end}});
 const baseLogic=bind(data.leaves.baseLogic.source,{a:{ZC:C.account}}),logic=bind(data.leaves.logic.source,{e:{prototype:{hw:baseLogic}}});
 const decision=bind(data.leaves.decision.source,{b:{$k:C.decisionRequest,nEa:C.decisionTag},SG:ctx.SG});
 const xml=ctx.E.jj.bi,serializer=new DOM.XMLSerializer();
 function request({event,game,sid,nativeParams,headerState}){need(['Init','Logic','EndGame'].includes(event),'own native request event');const h=game.sg.header,Pu={Vr:headerState.Vr,BK:headerState.BK,language:h.lang,kn:sid,Jz:h.userID},jo={HP:h.affiliate,channel:h.channel,NUa:h.gameCodeRGI,WB:Number(h.gameID),nZ:Number(h.glsID),dfa:h.userType,hfa:h.versionID};
  const self={jo,Pu,mY:()=>mY.call({jo,Pu}),Ypa:()=>new C.wmsLogic()};let object;
  if(event==='Init')object=init.call(self,{});else if(event==='EndGame')object=end.call(self);else object=(typeof nativeParams.OB==='boolean'?decision:logic).call(self,nativeParams);
  need(object.wj.kn===sid&&object.type===event&&!object.Aw&&!object.Xy,'own current native request/Header without replay/force');
  return {object,xml:serializer.serializeToString(xml.s0(object)),requestHeaders:[['Content-Type','application/x-www-form-urlencoded']]};
 }
 function parse(event,text,requestObject){need(typeof text==='string'&&text.length>0,'own complete response XML');const document=new DOM.DOMParser().parseFromString(text,'text/xml');need(document.documentElement?.tagName==='GameResponse'&&!document.getElementsByTagName('Error').length&&!document.getElementsByTagName('Errors').length&&!document.getElementsByTagName('parsererror').length,'own success native response root');
  const Class=event==='Init'?ctx.R.zf.QM.tD:event==='Logic'?ctx.R.zf.QM.oU:C.baseEndResponse,response=new Class(requestObject);xml.a$(response,document);need(response.Lf===false&&response.wj&&response.wj.WB===20467&&response.wj.hfa==='1_0'&&typeof response.wj.kn==='string'&&response.wj.kn&&response.wj.gYa!==true,'own native Header/SID/no recovery');return {response,document};
 }
 return Object.freeze({request,parse});
};
