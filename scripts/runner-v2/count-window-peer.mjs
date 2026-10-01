import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {checkCountPeerDescriptor} from './count-peer-boundary.mjs';

// A read-only audit may coexist with an explicitly pinned healthy peer.
// It never grants a source allowance or treats arbitrary activity as idle.
export function checkWindowPeerProfile(witness,profile,ended,now=Date.now()){
 assert(witness?.schema==='sg-count-window-peer-v1'&&profile.gameId===32799
  &&witness.profileHash===hash(profile)&&witness.activation===profile.activation
  &&witness.sourceRun===`${ended.id}:${ended.run_attempt}`&&witness.sourceCommit===ended.head_sha
  &&ended.repository?.full_name==='zyzuoyang/sg-capture-runner'&&ended.path==='.github/workflows/trial-300k.yml'
  &&ended.status==='completed'&&ended.conclusion==='success','WINDOW_PEER_SOURCE_SCOPE');
 assert(witness.sourceRequests===0&&witness.databaseWrites===0&&witness.createdAt<=now&&now<witness.expiresAt
  &&witness.expiresAt-witness.createdAt<=7200000,'WINDOW_PEER_PERMISSION_SCOPE');
 checkCountPeerDescriptor(witness.secondaryPeer,'primary');
 return witness.secondaryPeer;
}
