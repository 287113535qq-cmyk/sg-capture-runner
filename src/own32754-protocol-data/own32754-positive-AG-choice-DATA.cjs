'use strict';
// The native two Excalibur actions are unchanged: false gamble / true collect.
// Positive logical indexes are the original AG choice-selector ABI.
exports.createOwn32754AGChoiceMenu=function(nativeParams,issue){
 const options=[false,true].map((OB,i)=>{const np=Object.freeze({Yj:nativeParams.Yj,he:nativeParams.he,OB}),q=issue(np);return Object.freeze({pickIndex:i+1,requestPickIndex:i+1,requestParams:q.parameters,descriptor:q})});
 return Object.freeze({kind:'choice',event:'Logic',options:Object.freeze(options)});
};
