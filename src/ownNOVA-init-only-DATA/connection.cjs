"use strict";
const assert=require('node:assert/strict'),path=require('node:path'),profiles=require('./profiles.json'),{createOwnNativeAPI}=require('./runtime/api.cjs');
function profile(game){if(game?.sg?.ownNOVAInitOnlyDATA!=='own-original-GDM-native-Init-Reelstrip-only-v1')return undefined;const p=profiles[game.gameId];assert(p&&game.provider==='sg'&&game.dbName===p.dbName&&game.backendId===p.runtimeSlug&&game.sg.protocol==='gdm'&&game.sg.runtimeGameId===p.runtimeGameId&&game.sg.runtimeSlug===p.runtimeSlug&&game.sg.endpoint==='https://ogs-gdm-usnj.nyxop.net/nextgen/','Own NOVA Init-only exact source identity');assert.deepEqual(game.sg.ownGDMContract,p);assert.equal(game.sg.ownClassicNativeInitDATA,undefined);return p;}
function create(game){const p=profile(game);assert(p);return createOwnNativeAPI(p.gameId,path.join(__dirname,'runtime/assets',p.gameId));}
module.exports={profile,create};
