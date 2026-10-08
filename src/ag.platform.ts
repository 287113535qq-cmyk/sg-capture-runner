// Provider/configuration parameters only. Scheduling, round handling and Mongo merge stay in AG.
import path from 'path';
export function capturePlatform(env:NodeJS.ProcessEnv=process.env):'ag'|'sg' {
 const value=env.AG_CAPTURE_PLATFORM||'ag';
 if(value!=='ag'&&value!=='sg')throw new Error('unsupported capture platform');return value;
}
export function gameManifestPath(env:NodeJS.ProcessEnv=process.env,root=process.cwd()) {
 return path.resolve(root,env.AG_GAMES_MANIFEST||(capturePlatform(env)==='sg'?'sg-games.yml':'ag-games.yml'));
}
export function safeDatabaseName(value:string,platform=capturePlatform()) {
 return (platform==='sg'?/^sg_[a-z0-9][a-z0-9_-]*$/:/^ag_[A-Za-z0-9]+$/).test(value);
}
export function safeGameId(value:string,platform=capturePlatform()) {
 return (platform==='sg'?/^\d{5}$/:/^play-[a-z0-9-]+$/).test(value);
}
export function controllerRepository(env:NodeJS.ProcessEnv=process.env) {
 const repository=env.AG_GITHUB_REPOSITORY||(capturePlatform(env)==='ag'?'try-catch/ag-capture':'');
 if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository))throw new Error('explicit capture repository required');
 return repository;
}
