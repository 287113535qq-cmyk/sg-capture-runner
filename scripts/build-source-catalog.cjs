'use strict';
const fs = require('node:fs');
function buildSourceCatalog(runtime, launches) {
  if (!Array.isArray(runtime) || !runtime.length) throw new Error('Runtime catalog must be a nonempty array');
  const sources = Array.isArray(launches) ? launches : Object.values(launches);
  const runtimeIds = new Set(), captureIds = new Set();
  return runtime.map(game => {
    const runtimeGameId = Number(game.gameId ?? game.id);
    if (!Number.isSafeInteger(runtimeGameId) || runtimeGameId <= 0 || runtimeIds.has(runtimeGameId)) throw new Error('Invalid or duplicate runtime ID');
    runtimeIds.add(runtimeGameId);
    if (typeof game.sourceId !== 'string' || !game.sourceId.trim()) throw new Error('Missing official source identity');
    const matches = sources.filter(source => source.sourceId === game.sourceId);
    if (matches.length !== 1) throw new Error(`Ambiguous or missing source mapping for runtime ${runtimeGameId}`);
    const source = matches[0], captureGameId = Number(source.id ?? source.gameId);
    if (!Number.isSafeInteger(captureGameId) || captureGameId <= 0 || captureIds.has(captureGameId)) throw new Error('Invalid or duplicate capture ID');
    captureIds.add(captureGameId);
    // Deliberate allowlist: sessions, launch URLs and operator data are never copied.
    return { gameId: captureGameId, runtimeGameId, sourceId: game.sourceId,
      name: String(game.name || ''), pathSlug: String(source.pageSlug || source.pathSlug || '') };
  });
}
if (require.main === module) {
  try {
    const [runtimePath, launchesPath, output] = process.argv.slice(2);
    if (!runtimePath || !launchesPath || !output) throw new Error('Usage: node scripts/build-source-catalog.cjs <runtime manifest> <local launches> <new output>');
    const catalog = buildSourceCatalog(JSON.parse(fs.readFileSync(runtimePath, 'utf8')), JSON.parse(fs.readFileSync(launchesPath, 'utf8')));
    fs.writeFileSync(output, JSON.stringify(catalog, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    console.log(JSON.stringify({ matchedGames: catalog.length, sensitiveFieldsExported: false }));
  } catch { console.error('SG_CATALOG_REJECTED: input or mapping invalid; private diagnostics suppressed'); process.exitCode = 1; }
}
module.exports = { buildSourceCatalog };
