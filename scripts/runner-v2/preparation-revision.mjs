import fs from 'node:fs';
import path from 'node:path';
import {protocolHash as hash} from './protocol-resume.mjs';
import {preparationHandlers, preparationSourceHash} from './preparation-handlers.mjs';

// Same implementation identity on Windows preparation and Linux verification.
// Raw game replies are deliberately outside this source-only normalization.
export function preparationRevision(root, gameId, reference) {
  const handler = preparationHandlers[gameId];
  const cardFile = path.join(root, 'docs/game-rules', gameId + '.json');
  const ruleFiles = fs.existsSync(cardFile) ? JSON.parse(fs.readFileSync(cardFile, 'utf8')).roundRule?.files ?? [] : [];
  const files = [...Object.keys(reference?.references ?? {}), ...(handler?.node ?? []), ...ruleFiles,
    ...(handler?.python ?? []).map(n => 'service/tests/' + n)];
  const fileHashes = Object.fromEntries([...new Set(files)].sort().map(file => {
    const p = path.join(root, file);
    return [file, fs.existsSync(p) ? preparationSourceHash(fs.readFileSync(p, 'utf8')) : 'missing'];
  }));
  return {handler, fileHashes, revisionHash: hash({gameId, fileHashes, handler: handler ?? null})};
}
