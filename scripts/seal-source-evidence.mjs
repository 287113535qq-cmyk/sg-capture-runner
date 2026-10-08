import fs from 'node:fs';
import crypto from 'node:crypto';
import {pipeline} from 'node:stream/promises';
import {pathToFileURL} from 'node:url';
export async function seal(input, output, hexKey) {
 if(!/^[a-f0-9]{64}$/.test(hexKey||''))throw new Error('missing evidence encryption key');
 const nonce=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',Buffer.from(hexKey,'hex'),nonce);
 const fd=fs.openSync(output,'wx',0o600);
 try{fs.writeSync(fd,Buffer.concat([Buffer.from('SGAG1'),nonce]));await pipeline(fs.createReadStream(input),cipher,fs.createWriteStream(output,{fd,start:17,autoClose:false}));const tag=cipher.getAuthTag();fs.writeSync(fd,tag,0,tag.length,fs.fstatSync(fd).size);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
 seal(process.argv[2],process.argv[3],process.env.SG_SOURCE_EVIDENCE_KEY).catch(()=>{console.error('evidence encryption failed; plaintext retained locally');process.exitCode=1;});
}
