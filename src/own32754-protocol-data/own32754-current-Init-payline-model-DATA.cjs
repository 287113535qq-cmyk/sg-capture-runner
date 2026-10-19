'use strict';
// Length-only projection of own native tXa -> VY[0]/Ml -> qXa; no geometry/UI host.
exports.resolveOwn32754InitPayline=function(native,need){
 const groups=native?.Axa;need(Array.isArray(groups)&&groups.length>0,'actual Init Paylines present before native fallback');
 const models=[];
 for(let groupIndex=0;groupIndex<groups.length;groupIndex++){
  const group=groups[groupIndex],mode=group.Sra==null?groupIndex:group.Sra;
  need(Number.isSafeInteger(mode)&&mode>=0&&mode<4294967295&&Array.isArray(group.Dca),'actual native mode and Dca input');
  const model=models[mode]=[];
  for(const line of group.Dca){
   need(Number.isSafeInteger(line.index)&&line.index>=0&&line.index<4294967295&&Array.isArray(line.positions)&&line.positions.length>0,'actual indexed native payline input');
   // Native tXa transforms positions, then assigns at exactly line.index.
   // Coordinate conversion/orientation cannot change this array's length.
   model[line.index]=true;
  }
 }
 const first=groups[0].Dca,selected=[];
 for(const line of first){
  need(line.e3a===undefined||typeof line.e3a==='boolean','native typed selectable flag');
  if(line.e3a)selected.push(line.index+1);
 }
 if(selected.length)return Object.freeze({first:selected[0],kind:'actual-native-selectable',nativeSelectable:true,mode0ModelLength:models[0]?.length??null});
 need(Array.isArray(models[0])&&models[0].length>0,'actual current Init mode0 Ml before native qXa fallback');
 return Object.freeze({first:models[0].length,kind:'actual-native-mode0-model-length-fallback',nativeSelectable:false,mode0ModelLength:models[0].length});
};
