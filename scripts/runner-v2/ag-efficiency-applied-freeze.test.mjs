import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';

const cases=[
 ['formal-sessions-rhino-four-20261001.json','05c1b00111fcfa6cc26e37a69a3233091cbb6d1ef140c97fd6738882dbb4c9cd'],
 ['count-runtime-rhino-canary-finalmetrics-20261002.json','19b2259275a3f3373edab8341774971dbe51ca05f259e86f15602fa135683e69'],
 ['count-network-rhino-canary-20261002.json','fd8cf18b8a0a00e921f3464c787f236bcdd0250ccafcc015d9c0bb172f896984'],
 ['count-runtime-rhino-canary-entryfix-20261002.json','416f59261b46136809c41674633231595bdf809dc2b487de64dcf028a96919d5'],
 ['count-boundary-rhino-canary-entryfix-20261001.json','57e51f771637a03d510e46f953f0ab9155ce9a7d64087eb9d7b5fdad3ca391bd'],
 ['formal-retire-pyramids-major-transition-entryfix-20261001.json','23a2419605be82e9bf0b6c359a501bc47b0c2b1015e7b9de8ceb5d88c03f7c62'],
 ['count-fence-rhino-jobless-20261001.json','ba874432291519e2c64c56f75f016f1114fe847ab42dfc928152a01336ac6ffa'],
 ['count-runtime-rhino-ag-dispatchfix-20261001.json','eba16a15964d2f39585ae1cfc1c744c28d57cace8a17fb8adf00bc21a8eab15a'],
 ['formal-repair-pyramids-major-entryfix-20261001.json','5c7278ed911ed73ca082e611e8556909704e979b9b6447d29591ec8f8cf6a411'],
];
for(const [name,expected] of cases)test('applied AG efficiency permission stays frozen: '+name,()=>{
 const profile=JSON.parse(fs.readFileSync('config/'+name,'utf8'));
 assert.equal(hash(profile),expected);
});
