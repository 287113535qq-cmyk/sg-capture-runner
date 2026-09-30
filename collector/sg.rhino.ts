import {settledFields,ROUND_FIELDS_VERSION} from './sg.fields';
const {review}=require('./rhino-review.cjs');
export function rhinoFields(raw:any,mapping:{buy:number;bonus:number;typeMappingHash:string}) {
 const s=review(raw);
 if(s.next!==null||mapping.buy!==0||mapping.bonus!==s.bonus||!/^[a-f0-9]{64}$/.test(mapping.typeMappingHash))throw Error('SG_RHINO_MAPPING');
 const fields=settledFields(s.start,s.end,s.win,0,s.bonus);
 if(fields.money.betRaw!==40||raw.roundFieldsVersion!==ROUND_FIELDS_VERSION)throw Error('SG_RHINO_WAGER');
 return {...fields,protocol:'wms',sourceKey:'ragingrhino-wms-v1',primaryBonusKind:s.bonus?'freeGame':'none',typeMappingHash:mapping.typeMappingHash};
}
