import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {need,uint,children} from '../../trial/pearl-protocol.mjs';
import {stable} from '../mongo-writer.mjs';
const contract=JSON.parse(readFileSync(new URL('../../../config/ag-rolling-own-wms-ordinary-semantics-v2.json',import.meta.url)));
export const CONTRACT_HASH='9a9adb2e7ab6de59cd31318695391bbe8a11d132bc55c3aae8533bf508b40f82';
need(createHash('sha256').update(stable(contract)).digest('hex')===CONTRACT_HASH,'OWN_WMS_SEMANTIC_CONTRACT');

// Payout and geometry come from this game's pinned natural Init response.
// Winning positions are the first N reels of its own line, in wire order.
export function reviewOwnPayline(gameId,node){
 const g=contract.games[String(gameId)];need(g&&node.tag==='PaylineWin','OWN_WMS_GAME_SCOPE');
 need(Object.keys(node.a).sort().join(',')==='awardIndex,awardTableIndex,index,winVal'&&!children(node).length,'OWN_WMS_PAYLINE_SHAPE');
 const line=uint(node.a.index),index=uint(node.a.awardIndex),table=uint(node.a.awardTableIndex),win=uint(node.a.winVal);
 const award=g.awards[String(index)],layout=g.paylines[String(line)];
 need(table===g.awardTableIndex&&line<g.paylineCount&&award&&layout,'OWN_WMS_PAYLINE_IDENTITY');
 const text=node.children.map(n=>n.text??'').join('');need(/^(0|[1-9][0-9]*)(\|(0|[1-9][0-9]*))*$/.test(text),'OWN_WMS_POSITION_FORMAT');
 const positions=text.split('|').map(uint);
 need(positions.length===award.count&&new Set(positions).size===positions.length&&positions.every(x=>x<g.rows*g.columns),'OWN_WMS_POSITION_COUNT');
 const expected=[...layout].sort((a,b)=>a%g.columns-b%g.columns).slice(0,award.count).sort((a,b)=>a-b);
 need(stable(positions)===stable(expected),'OWN_WMS_POSITION_GEOMETRY');
 const numerator=BigInt(award.payoutMicros)*BigInt(g.payoutScale);
 need(numerator%1000000n===0n&&numerator/1000000n===BigInt(win),'OWN_WMS_AWARD_AMOUNT');
 return true;
}

export function reviewCascadeMask(value,positions){
 const actual=uint(value);need(Array.isArray(positions)&&positions.every(x=>Number.isSafeInteger(x)&&x>=0&&x<15),'OWN_WMS_MASK_POSITIONS');
 const expected=[...new Set(positions)].reduce((mask,p)=>mask+(1<<p),0);
 need(actual<32768&&actual===expected,'OWN_WMS_CASCADE_MASK');
 return true;
}
