import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {stable} from '../mongo-writer.mjs';
import {children, one, need, uint} from '../../trial/pearl-protocol.mjs';

const hash=v=>createHash('sha256').update(stable(v)).digest('hex');
const contract=JSON.parse(readFileSync(new URL('../../../config/ag-rolling-own-wms-init-v1.json',import.meta.url)));
need(hash(contract)==='ebb98db5f38d18c15ba216906d499acedda988bbc0e1f4854819877b41f77ffa','WMS_INIT_CONTRACT_CHANGED');

// Init advertises tables; it does not settle a round or authorize any bonus mode.
// Only session and independently checked cash are dynamic. Every table, tag,
// attribute and text value is pinned to this game's actual closed Init response.
function normalized(n,path=''){
 path+='/'+n.tag;
 const a={...n.a},cs=children(n),texts=n.children.filter(c=>c.tag==='#text');
 if(cs.length)need(texts.every(c=>!c.text.trim()),'WMS_INIT_MIXED_TEXT');
 if(path==='/GameResponse/Header')a.sessionID='$SESSION';
 if(path==='/GameResponse/Balances/Balance')a.value='$BALANCE';
 return [n.tag,a,texts.map(c=>c.text).join('').trim(),cs.map(c=>normalized(c,path))];
}

export function ownWmsInit(root,gameId,betRaw){
 if(!children(root).some(n=>['AwardsInfo','ReelInfo','GameVariantInfo'].includes(n.tag)))return false;
 const rule=contract.games[String(gameId)];
 need(rule&&rule.gameId===gameId&&rule.betRaw===betRaw,'WMS_INIT_OWN_SCOPE');
 need(root.tag==='GameResponse'&&stable(root.a)===stable({type:'Init'}),'WMS_INIT_MESSAGE');
 const h=one(root,'Header');
 need(h.a.gameID===rule.wmsGameId&&h.a.versionID==='1_0'&&h.a.isRecovering==='N','WMS_INIT_IDENTITY');
 need(typeof h.a.sessionID==='string'&&h.a.sessionID.length>0&&h.a.sessionID.length<=1024,'WMS_SESSION_REQUIRED');
 const balances=one(root,'Balances'),cash=one(balances,'Balance');
 need(children(balances).length===1&&cash.a.name==='CASH_BALANCE','WMS_BALANCE_MISMATCH');uint(cash.a.value);
 need(hash(normalized(root))===rule.staticTreeSha256,'WMS_INIT_STATIC_CHANGED');
 const stakes=children(root).filter(n=>n.tag==='Stakes'&&n.a.type==='0');
 need(stakes.length===1,'WMS_INIT_ORDINARY_STAKES');
 const values=stakes[0].children.map(n=>n.text??'').join('').split('|').map(uint);
 need(values.length===uint(stakes[0].a.count)&&new Set(values).size===values.length&&
      uint(stakes[0].a.defaultIndex)<values.length&&values.includes(betRaw),'WMS_INIT_ORDINARY_STAKES');
 return true;
}
