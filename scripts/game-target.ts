import fs from 'fs';
import yaml from 'js-yaml';
import { safeDatabaseName } from '../src/ag.platform';

export interface ManifestGame {
    gameId: string;
    name: string;
    dbName: string;
    serviceDir: string;
    [key: string]: unknown;
}

interface ManifestDocument {
    games?: ManifestGame[];
}

export function loadGameTargets(manifestPath: string): ManifestGame[] {
    const parsed = yaml.load(fs.readFileSync(manifestPath, 'utf8')) as ManifestDocument;
    const games = Array.isArray(parsed?.games) ? parsed.games : [];
    if (games.length === 0) throw new Error('empty AG game manifest');

    const gameIds = new Set<string>();
    const databaseNames = new Set<string>();
    for (const game of games) {
        if (!game?.gameId || !game?.dbName) throw new Error('incomplete AG game manifest entry');
        if (!safeDatabaseName(game.dbName)) throw new Error('unsafe AG database name');
        if (gameIds.has(game.gameId)) throw new Error('duplicate game id');
        if (databaseNames.has(game.dbName)) throw new Error('duplicate AG database name');
        gameIds.add(game.gameId);
        databaseNames.add(game.dbName);
    }
    return games;
}

export function resolveGameTarget(
    games: ManifestGame[],
    gameId: string,
    dbName: string,
): ManifestGame {
    const game = games.find((item) => item.gameId === gameId);
    if (!game) throw new Error('unknown game id');
    if (!safeDatabaseName(game.dbName) || !safeDatabaseName(dbName)) {
        throw new Error('unsafe AG database name');
    }
    if (game.dbName !== dbName) throw new Error('database mismatch');
    return game;
}
