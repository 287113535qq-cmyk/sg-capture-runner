import { createInterface } from 'node:readline';
import { refuseCapture } from '../preparation';
import fs from 'fs-extra';
import path from 'path';
import yaml from 'js-yaml';
import { spawn } from 'node:child_process';
import { BATCH_CONCURRENT_GAMES, BATCH_PLANNER_CONCURRENCY, BATCH_ROUND_LIMIT, CAPTURE_ROOT, UNKNOWN_SPECIAL_ROUND_LIMIT } from '../config';
import { captureGame, type SGCaptureOptions, type SGCaptureProgress, type SGCaptureSummary, type SGSpecialKind } from '../sg';
import { closeSGBrowserFetchRuntime } from '../sg.http';
import type { SGEnhancedBetOption, SGGameConfig, SGBetOptions } from '../sg.http';
import { parseGDMResponse, parsePayloadParams } from '../sg.parse';

type ManifestEntry = {
  gameId?: number;
  id?: number;
  name?: string;
  path?: string;
  sourceId?: string;
  pathSlug?: string;
  pageSlug?: string;
  minBet?: string;
  maxBet?: string;
  startUrl?: string;
  launchUrl?: string;
  runtimeSlug?: string;
  operatorId?: string;
  sessionId?: string;
  demoSessionId?: string;
  currency?: string;
  lang?: string;
  mode?: string;
  serverAddress?: string;
};

type StaticManifestEntry = {
  id?: number;
  name?: string;
  pageSlug?: string;
  runtimeSlug?: string;
  operatorId?: string;
  sessionId?: string;
  demoSessionId?: string;
  currency?: string;
  lang?: string;
  mode?: string;
  nyxRoot?: string;
  serverAddress?: string;
  startUrl?: string;
  launchUrl?: string;
  debugFeatureSpinIds?: string[];
  debugFreeGameSpinIds?: string[];
};

type CaptureRuleEntry = {
  gameId?: number;
  knownSpecialKinds?: SGSpecialKind[] | string;
  specialKinds?: SGSpecialKind[] | string;
  freeChoiceOptionCount?: number;
  betPerLine?: number;
  lineBet?: number;
  betMode?: 'lines' | 'payways' | 'discrete';
  forceBetMode?: 'lines' | 'payways' | 'discrete';
  preferTemplateSourceOnly?: boolean;
  disableGenericBetSearch?: boolean;
  baseBet?: number;
  reelsSelected?: number;
  betPerLineCandidates?: number[];
  lineBetCandidates?: number[];
  baseBetCandidates?: number[];
  reelsSelectedCandidates?: number[];
  strictBetPerLineCandidates?: number[];
  strictLineBetCandidates?: number[];
  strictBaseBetCandidates?: number[];
  strictReelsSelectedCandidates?: number[];
  buy?: number;
  enhancedBetLevel?: number;
  enhancedBetLabel?: string;
  enhancedBetOptions?: SGEnhancedBetOption[];
  disableDerivedEnhancedBetOptions?: boolean;
  templateSourceGameIds?: number[];
  fixedBetTemplates?: SGBetOptions[];
  specialBetTemplates?: SGBetOptions[];
  retryableTemplateErrorPatterns?: string[];
  abpm?: number;
  anteBet?: number;
  autoPlay?: boolean;
  serverAddress?: string;
  startUrl?: string;
  launchUrl?: string;
  skip?: boolean;
  skipReason?: string;
};

type SGBatchGameConfig = SGGameConfig & {
  knownSpecialKinds?: SGSpecialKind[] | string;
  specialKinds?: SGSpecialKind[] | string;
};

type CaptureDefaults = Partial<
  Pick<
    SGBatchGameConfig,
    'operatorId' | 'sessionId' | 'currency' | 'lang' | 'mode' | 'serverAddress' | 'betPerLine' | 'lineBet' | 'clientType'
  >
>;

type LaunchConfig = Partial<
  Pick<SGBatchGameConfig, 'runtimeSlug' | 'operatorId' | 'sessionId' | 'currency' | 'lang' | 'mode' | 'serverAddress' | 'startUrl'>
> & {
  ogsGameId?: string;
};

type RoundStats = {
  roundCount: number;
  bonusLikeCount: number;
  freeGameCount: number;
  featureCount: number;
  freeFeatureCount: number;
  freeChoiceOptionHits?: Record<string, number>;
};

type PersistedSkipEntry = {
  planKey?: string;
  gameId: number;
  name?: string;
  reason: string;
  source: 'manual-rule' | 'runtime-failure';
  firstRecordedAt?: string;
  lastRecordedAt?: string;
  lastError?: string;
};

type GamePlanStatus = 'pending' | 'complete' | 'missing-config' | 'skipped';

type GamePlan = {
  planKey: string;
  gameId: number;
  name: string;
  displayName: string;
  pathSlug: string;
  captureKey: string;
  variantLabel: string;
  config?: SGBatchGameConfig;
  status: GamePlanStatus;
  missingConfig: string[];
  stats: RoundStats;
  knownSpecialKinds: SGSpecialKind[];
  freeChoiceOptionCount: number;
  skipReason?: string;
  skipSource?: PersistedSkipEntry['source'];
  totalCurrent: number;
  totalTarget: number;
  totalMissing: number;
  completionRate: number;
};

const REQUIRED_CONFIG_FIELDS = ['runtimeSlug', 'operatorId', 'sessionId', 'currency', 'lang', 'mode', 'serverAddress'];

function rootDir(): string {
  return path.resolve(__dirname, '..', '..', '..', '..');
}

function readArgValue(name: string): string {
  const prefix = `${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) {
    return inline.slice(prefix.length).trim();
  }

  const index = process.argv.indexOf(name);
  if (index >= 0 && index + 1 < process.argv.length) {
    return String(process.argv[index + 1] || '').trim();
  }

  return '';
}

function parseNumberArg(names: string[], fallback: number): number {
  for (const name of names) {
    const raw = readArgValue(name);
    if (!raw) {
      continue;
    }

    const value = Number(raw);
    if (Number.isFinite(value) && value >= 0) {
      return value;
    }
  }

  return fallback;
}

function parseConcurrencyArg(names: string[], fallback: number): number {
  for (const name of names) {
    const raw = readArgValue(name);
    if (!raw) {
      continue;
    }

    const normalized = raw.toLowerCase();
    if (normalized === 'all' || normalized === '*' || normalized === '0') {
      return Number.POSITIVE_INFINITY;
    }

    const value = Number(raw);
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }

  const envValue = String(process.env.SG_BATCH_CONCURRENT_GAMES || '').trim().toLowerCase();
  if (envValue === 'all' || envValue === '*' || envValue === '0') {
    return Number.POSITIVE_INFINITY;
  }

  return Number.isFinite(fallback) && fallback > 0 ? fallback : Number.POSITIVE_INFINITY;
}

function requireStandardRounds(): boolean {
  return (
    process.argv.includes('--require-standard-rounds') ||
    process.argv.includes('--require-round-target') ||
    process.env.SG_REQUIRE_STANDARD_ROUNDS === '1'
  );
}

function parseGameFilter(): Set<string> {
  const raw = readArgValue('--games') || readArgValue('--game-id');
  return new Set(
    raw
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function runtimeLaunchRefreshDisabled(): boolean {
  return process.argv.includes('--disable-runtime-launch-refresh');
}

async function parseGameFilterFile(filePath: string): Promise<Set<string>> {
  const resolved = path.resolve(filePath);
  if (!(await fs.pathExists(resolved))) {
    throw new Error(`game filter file not found: ${resolved}`);
  }

  const ext = path.extname(resolved).toLowerCase();
  if (ext === '.json') {
    const raw = await fs.readJSON(resolved);
    const values: string[] = [];

    const collectEntry = (entry: any) => {
      if (typeof entry === 'string' || typeof entry === 'number') {
        const token = String(entry || '').trim();
        if (token) values.push(token);
        return;
      }
      const id = String(entry?.id ?? entry?.gameId ?? '').trim();
      const name = String(entry?.name ?? '').trim();
      if (id) values.push(id);
      if (name) values.push(name);
    };

    if (Array.isArray(raw)) {
      raw.forEach(collectEntry);
    } else if (Array.isArray(raw?.pass)) {
      raw.pass.forEach(collectEntry);
    } else if (Array.isArray(raw?.games)) {
      raw.games.forEach(collectEntry);
    }

    return new Set(values.filter(Boolean));
  }

  const text = await fs.readFile(resolved, 'utf8');
  return new Set(
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.split(/[\t,\s]+/, 1)[0]?.trim() || '')
      .filter(Boolean),
  );
}

function extractBaseGameIdsFromFilter(gameFilter: Set<string>): Set<string> {
  const result = new Set<string>();
  for (const value of gameFilter) {
    const normalized = String(value || '').trim();
    const match = normalized.match(/^(\d+)(?::buy:\d+)?$/i);
    if (match?.[1]) {
      result.add(match[1]);
    }
  }
  return result;
}

function normalizeSpecialKinds(value: unknown): SGSpecialKind[] {
  const rawValues = Array.isArray(value) ? value : String(value || '').split(',');
  const result = new Set<SGSpecialKind>();

  for (const raw of rawValues) {
    const normalized = String(raw || '').trim().toLowerCase().replace(/[_\-\s]+/g, '');
    if (normalized === 'freegame' || normalized === 'freegames') {
      result.add('freeGame');
    } else if (normalized === 'feature' || normalized === 'features') {
      result.add('feature');
    } else if (normalized === 'freefeature' || normalized === 'freefeatures') {
      result.add('freeFeature');
    }
  }

  return Array.from(result.values());
}

function knownSpecialsFromStatic(entry?: StaticManifestEntry): SGSpecialKind[] {
  const result = new Set<SGSpecialKind>();
  if (entry?.debugFreeGameSpinIds?.length) {
    result.add('freeGame');
  }
  if (entry?.debugFeatureSpinIds?.length) {
    result.add('feature');
  }
  return Array.from(result.values());
}

function knownSpecialsCovered(stats: RoundStats, kinds: SGSpecialKind[], specialLimit: number): boolean {
  if (!kinds.length) {
    return false;
  }

  const target = Math.max(1, specialLimit);
  return kinds.every((kind) => {
    if (kind === 'freeGame') return stats.freeGameCount >= target;
    if (kind === 'feature') return stats.featureCount >= target;
    if (kind === 'freeFeature') return stats.freeFeatureCount >= target;
    return false;
  });
}

function specialCurrent(stats: RoundStats, kinds: SGSpecialKind[]): number {
  return kinds.reduce((sum, kind) => {
    if (kind === 'freeGame') return sum + stats.freeGameCount;
    if (kind === 'feature') return sum + stats.featureCount;
    if (kind === 'freeFeature') return sum + stats.freeFeatureCount;
    return sum;
  }, 0);
}

function normalizeGameId(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : 0;
}

function normalizeDbNamePart(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeBuyValue(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? Math.max(0, Math.round(num)) : 0;
}

function sanitizePlanSegment(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function buildPlanKey(gameId: number, buy: number): string {
  return buy > 0 ? `${gameId}:buy:${buy}` : String(gameId);
}

function buildCaptureKey(gameId: number, buy: number): string {
  return buy > 0 ? `${gameId}_buy_${buy}` : String(gameId);
}

function buildVariantLabel(baseName: string, buy: number, level: number, label: string): string {
  if (buy <= 0) {
    return '';
  }

  const normalizedLabel = String(label || '').trim();
  if (normalizedLabel) {
    return normalizedLabel;
  }

  if (level > 0) {
    return `${baseName} buy=${buy} level=${level}`;
  }

  return `${baseName} buy=${buy}`;
}

function deriveRuntimeSlug(entry: ManifestEntry): string {
  return String(entry.runtimeSlug || entry.pageSlug || entry.pathSlug || entry.name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function normalizeServerAddress(value: string): string {
  return String(value || '').trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
}

function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) {
      return text;
    }
  }
  return '';
}

function normalizeLaunchLang(value: string): string {
  const lang = String(value || '').trim().toLowerCase();
  if (!lang) {
    return '';
  }
  if (lang === 'en') {
    return 'en_us';
  }
  return lang.replace(/-/g, '_');
}

function tryParseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function parseLaunchConfig(rawUrl: unknown): LaunchConfig {
  const startUrl = String(rawUrl || '').trim();
  const url = tryParseUrl(startUrl);
  if (!url) {
    return {};
  }

  const params = url.searchParams;
  const gameUrl = tryParseUrl(params.get('gameUrl') || '');
  const nyxRoot = firstNonEmpty(params.get('nyxroot'), params.get('serverAddress'), params.get('serveraddress'));
  const result: LaunchConfig = {
    startUrl,
    runtimeSlug: firstNonEmpty(params.get('gameid'), params.get('gamename')),
    operatorId: firstNonEmpty(params.get('operatorid'), params.get('operatorId')),
    sessionId: firstNonEmpty(params.get('sessionid'), params.get('sessionId')),
    currency: firstNonEmpty(params.get('currency')),
    lang: normalizeLaunchLang(firstNonEmpty(params.get('lang'), gameUrl?.searchParams.get('lang'))),
    mode: firstNonEmpty(params.get('mode'), params.get('playmode'), gameUrl?.searchParams.get('mode')),
    serverAddress: nyxRoot ? normalizeServerAddress(nyxRoot) : '',
    ogsGameId: firstNonEmpty(params.get('ogsgameid'), params.get('nogsgameid')),
  };

  if (!result.serverAddress && gameUrl?.host) {
    result.serverAddress = normalizeServerAddress(gameUrl.host);
  }

  return Object.fromEntries(Object.entries(result).filter(([, value]) => String(value || '').trim() !== '')) as LaunchConfig;
}

function launchConfigFromEntry(entry: ManifestEntry, staticEntry?: StaticManifestEntry): LaunchConfig {
  return {
    ...parseLaunchConfig(entry.startUrl || entry.launchUrl),
    ...parseLaunchConfig(staticEntry?.startUrl || staticEntry?.launchUrl),
  };
}

function allowSharedSession(): boolean {
  return process.argv.includes('--allow-shared-session') || process.env.SG_BATCH_ALLOW_SHARED_SESSION === '1';
}

async function loadYamlGames(): Promise<SGBatchGameConfig[]> {
  if (process.argv.includes('--ignore-yaml-config') || process.env.SG_BATCH_IGNORE_YAML_CONFIG === '1') {
    return [];
  }

  const yamlPath = path.resolve(__dirname, '..', 'assets', 'sg.yml');
  if (!(await fs.pathExists(yamlPath))) {
    return [];
  }

  const doc = yaml.load(await fs.readFile(yamlPath, 'utf8')) as { games?: SGBatchGameConfig[] };
  return Array.isArray(doc?.games) ? doc.games : [];
}

function defaultCaptureRulesPath(): string {
  const explicit = readArgValue('--capture-rules') || process.env.SG_CAPTURE_RULES_PATH || '';
  if (explicit) {
    return path.resolve(explicit);
  }

  return path.resolve(__dirname, '..', 'assets', 'sg_capture_rules.json');
}

async function loadCaptureRules(): Promise<Map<number, CaptureRuleEntry>> {
  const rulesPath = defaultCaptureRulesPath();
  if (!(await fs.pathExists(rulesPath))) {
    return new Map<number, CaptureRuleEntry>();
  }

  const raw = await fs.readJSON(rulesPath);
  const entries = Array.isArray(raw) ? raw : Object.values(raw || {});
  const result = new Map<number, CaptureRuleEntry>();
  for (const value of entries) {
    const entry = value as CaptureRuleEntry;
    const gameId = normalizeGameId(entry.gameId);
    if (gameId > 0) {
      result.set(gameId, entry);
    }
  }
  return result;
}

function parsePipeIntegers(value: unknown, allowZero = false): number[] {
  const result: number[] = [];
  for (const token of String(value || '').split('|')) {
    const trimmed = token.trim();
    if (!trimmed) {
      continue;
    }

    const numeric = Math.round(Number(trimmed));
    if (!Number.isFinite(numeric)) {
      continue;
    }

    if (allowZero ? numeric < 0 : numeric <= 0) {
      continue;
    }

    result.push(numeric);
  }
  return result;
}

function payloadParamsFromLine(line: string): Record<string, string> {
  const trimmed = String(line || '').trim();
  if (!trimmed) {
    return {};
  }

  if (trimmed.startsWith('&MSGID=')) {
    return parsePayloadParams(trimmed);
  }

  try {
    const parsed = parseGDMResponse(trimmed);
    if (parsed.payload) {
      return parsePayloadParams(parsed.payload);
    }
  } catch {
    // fall through to JSON parsing
  }

  try {
    const parsed = JSON.parse(trimmed);
    const responsePayload = String(parsed?.responsePayload || parsed?.payload || '').trim();
    if (responsePayload) {
      return parsePayloadParams(responsePayload);
    }

    const responseXml = String(parsed?.responseXml || parsed?.xml || '').trim();
    if (responseXml) {
      const xmlPayload = parseGDMResponse(responseXml).payload;
      if (xmlPayload) {
        return parsePayloadParams(xmlPayload);
      }
    }
  } catch {
    // ignore malformed legacy lines
  }

  return {};
}

function loadInitPayloadParams(gameId: number): Record<string, string> {
  const gameDir = path.resolve(__dirname, '..', CAPTURE_ROOT, String(gameId));
  const candidateFiles = [
    path.join(gameDir, 'init.txt'),
    path.join(gameDir, 'traffic.jsonl'),
  ];

  for (const filePath of candidateFiles) {
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const raw = fs.readFileSync(filePath, 'utf8');
    const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).reverse();
    for (const line of lines) {
      const params = payloadParamsFromLine(line);
      if (String(params.MSGID || '').trim().toUpperCase() === 'INIT') {
        return params;
      }
    }
  }

  return {};
}

type SuccessfulBetTemplate = {
  captureKey: string;
  buy: number;
  betPerLine?: number;
  lineBet?: number;
  baseBet?: number;
  reelsSelected?: number;
  abpm?: number;
  anteBet?: number;
};

function parseBuyFromCaptureKey(captureKey: string, gameId: number): number {
  const normalized = String(captureKey || '').trim();
  if (!normalized) {
    return 0;
  }
  if (normalized === String(gameId)) {
    return 0;
  }
  const match = normalized.match(new RegExp(`^${gameId}_buy_(\\d+)$`));
  if (!match) {
    return 0;
  }
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

function captureRootDir(): string {
  return path.resolve(__dirname, '..', CAPTURE_ROOT);
}

function parseSuccessfulBetTemplate(requestPayload: string): Omit<SuccessfulBetTemplate, 'captureKey' | 'buy'> | null {
  const params = parsePayloadParams(String(requestPayload || ''));
  if (String(params.MSGID || '').trim().toUpperCase() !== 'BET') {
    return null;
  }

  const betPerLine = Math.round(Number(params.BPL || 0));
  const lineBet = Math.round(Number(params.LB || 0));
  const baseBet = Math.round(Number(params.BPR || 0));
  const reelsSelected = Math.round(Number(params.RB || 0));
  const abpm = Math.round(Number(params.ABPM || 0));
  const explicitAnteBet = Math.round(
    Number(params.ANTEBET || params.ABET || params.AB || params.ANTE || 0),
  );

  return {
    betPerLine: Number.isFinite(betPerLine) && betPerLine > 0 ? betPerLine : undefined,
    lineBet: Number.isFinite(lineBet) && lineBet > 0 ? lineBet : undefined,
    baseBet: Number.isFinite(baseBet) && baseBet > 0 ? baseBet : undefined,
    reelsSelected: Number.isFinite(reelsSelected) && reelsSelected > 0 ? reelsSelected : undefined,
    abpm: Number.isFinite(abpm) && abpm > 0 ? abpm : undefined,
    anteBet: Number.isFinite(explicitAnteBet) && explicitAnteBet > 0 ? explicitAnteBet : undefined,
  };
}

function normalizeRuntimeSlugValue(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function isMerlinSuperbetRuntimeSlug(value: unknown): boolean {
  return /merlinsmillionssuperbet/i.test(normalizeRuntimeSlugValue(value));
}

function loadSuccessfulBetTemplates(gameId: number): SuccessfulBetTemplate[] {
  const root = captureRootDir();
  if (!fs.existsSync(root)) {
    return [];
  }

  const prefix = `${gameId}_buy_`;
  const templates: SuccessfulBetTemplate[] = [];
  const seen = new Set<string>();
  const directories = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => name === String(gameId) || name.startsWith(prefix))
    .sort((left, right) => left.localeCompare(right));

  for (const captureKey of directories) {
    const trafficPath = path.join(root, captureKey, 'traffic.jsonl');
    if (!fs.existsSync(trafficPath)) {
      continue;
    }

    let raw = '';
    try {
      raw = fs.readFileSync(trafficPath, 'utf8');
    } catch {
      continue;
    }

    const buy = parseBuyFromCaptureKey(captureKey, gameId);
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      try {
        const parsed = JSON.parse(trimmed) as {
          msgId?: string;
          requestPayload?: string;
          responsePayload?: string;
        };
        if (String(parsed.msgId || '').trim().toUpperCase() !== 'BET') {
          continue;
        }
        const responseParams = parsePayloadParams(String(parsed.responsePayload || ''));
        if (String(responseParams.MSGID || '').trim().toUpperCase() !== 'BET') {
          continue;
        }
        const template = parseSuccessfulBetTemplate(String(parsed.requestPayload || ''));
        if (!template) {
          continue;
        }
        const key = `${captureKey}:${JSON.stringify(template)}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        templates.push({
          captureKey,
          buy,
          ...template,
        });
      } catch {
        // Ignore malformed traffic rows.
      }
    }
  }

  return templates;
}

function selectEnhancedBetTemplateSeed(gameId: number, buy: number, abpm: number): SuccessfulBetTemplate | undefined {
  const templates = loadSuccessfulBetTemplates(gameId);
  if (!templates.length) {
    return undefined;
  }

  const sameBuy = templates.find((template) => template.buy === buy);
  if (sameBuy) {
    return sameBuy;
  }

  const sameAbpm = templates.find((template) => Math.round(Number(template.abpm || 0)) === Math.round(Number(abpm || 0)));
  if (sameAbpm) {
    return sameAbpm;
  }

  return templates.find((template) => template.buy > 0) || templates[0];
}

function deriveEnhancedBetOptionsFromProtocol(config: Partial<SGBatchGameConfig>): SGEnhancedBetOption[] {
  const gameId = normalizeGameId(config.gameId);
  if (gameId <= 0) {
    return [];
  }

  const initParams = loadInitPayloadParams(gameId);
  const abpmModes = parsePipeIntegers(initParams.ABM);
  if (!abpmModes.length) {
    return [];
  }

  const abvLevels = parsePipeIntegers(initParams.ABV);
  const abrscLevels = parsePipeIntegers(initParams.ABRSC, true);
  const runtimeSlug = normalizeRuntimeSlugValue(config.runtimeSlug);

  return abpmModes.map((abpm, index) => {
    const level = abvLevels[index] || abpm;
    const abrsc = abrscLevels[index];
    const buy = 10 + index;
    const seed = selectEnhancedBetTemplateSeed(gameId, buy, abpm);
    const labelParts = [`enhanced ${index + 1}`, `abpm=${abpm}`];
    if (level > 0) {
      labelParts.push(`level=${level}`);
    }
    if (Number.isFinite(abrsc)) {
      labelParts.push(`rsc=${abrsc}`);
    }

    const derivedAnteBet =
      seed?.anteBet && seed.anteBet > 0
        ? seed.anteBet
        : isMerlinSuperbetRuntimeSlug(runtimeSlug)
          ? undefined
          : undefined;

    return {
      buy,
      level,
      label: labelParts.join(' '),
      abpm,
      rsc: Number.isFinite(abrsc) ? abrsc : undefined,
      includeRsc: Number.isFinite(abrsc),
      betPerLine: seed?.betPerLine,
      lineBet: seed?.lineBet,
      baseBet: seed?.baseBet,
      reelsSelected: seed?.reelsSelected,
      anteBet: derivedAnteBet,
    };
  });
}

function defaultSkippedGamesPath(): string {
  const explicit = readArgValue('--skipped-games') || process.env.SG_SKIPPED_GAMES_PATH || '';
  if (explicit) {
    return path.resolve(explicit);
  }

  return path.resolve(__dirname, '..', 'reports', 'sg-skipped-games.json');
}

function skipLedgerKey(gameId: number, planKey?: string): string {
  return String(planKey || gameId);
}

async function loadPersistedSkippedGames(): Promise<Map<string, PersistedSkipEntry>> {
  const skippedPath = defaultSkippedGamesPath();
  if (!(await fs.pathExists(skippedPath))) {
    return new Map<string, PersistedSkipEntry>();
  }

  const raw = await fs.readJSON(skippedPath);
  const entries = Array.isArray(raw) ? raw : Array.isArray(raw?.skipped) ? raw.skipped : [];
  const result = new Map<string, PersistedSkipEntry>();
  for (const value of entries) {
    const gameId = normalizeGameId((value as PersistedSkipEntry)?.gameId);
    if (gameId <= 0) {
      continue;
    }
    const planKey = String((value as PersistedSkipEntry)?.planKey || '').trim() || undefined;

    result.set(skipLedgerKey(gameId, planKey), {
      planKey,
      gameId,
      name: String((value as PersistedSkipEntry)?.name || '').trim(),
      reason: String((value as PersistedSkipEntry)?.reason || 'skipped').trim() || 'skipped',
      source: (value as PersistedSkipEntry)?.source === 'manual-rule' ? 'manual-rule' : 'runtime-failure',
      firstRecordedAt: String((value as PersistedSkipEntry)?.firstRecordedAt || '').trim() || undefined,
      lastRecordedAt: String((value as PersistedSkipEntry)?.lastRecordedAt || '').trim() || undefined,
      lastError: String((value as PersistedSkipEntry)?.lastError || '').trim() || undefined,
    });
  }
  return result;
}

async function writeSkippedGames(skippedById: Map<string, PersistedSkipEntry>) {
  const skippedPath = defaultSkippedGamesPath();
  await fs.ensureDir(path.dirname(skippedPath));
  const skipped = Array.from(skippedById.values()).sort((left, right) => {
    if (left.gameId !== right.gameId) {
      return left.gameId - right.gameId;
    }
    return String(left.planKey || '').localeCompare(String(right.planKey || ''));
  });
  await fs.writeJSON(
    skippedPath,
    {
      generatedAt: new Date().toISOString(),
      totalSkipped: skipped.length,
      skipped,
    },
    { spaces: 2 },
  );
}

function buildManualSkipEntry(
  gameId: number,
  entry: CaptureRuleEntry | undefined,
  fallbackName: string,
): PersistedSkipEntry | undefined {
  if (!entry?.skip) {
    return undefined;
  }

  return {
    gameId,
    name: fallbackName,
    reason: String(entry.skipReason || 'manual skip').trim() || 'manual skip',
    source: 'manual-rule',
    firstRecordedAt: new Date().toISOString(),
    lastRecordedAt: new Date().toISOString(),
  };
}

function mergeSkipEntries(
  persisted: PersistedSkipEntry | undefined,
  manual: PersistedSkipEntry | undefined,
): PersistedSkipEntry | undefined {
  if (manual) {
    return {
      ...persisted,
      ...manual,
      source: 'manual-rule',
      firstRecordedAt: persisted?.firstRecordedAt || manual.firstRecordedAt,
      lastRecordedAt: manual.lastRecordedAt || persisted?.lastRecordedAt,
      lastError: persisted?.lastError,
    };
  }

  return persisted;
}

function buildRuntimeFailureSkipEntry(plan: GamePlan, message: string, existing?: PersistedSkipEntry): PersistedSkipEntry {
  const timestamp = new Date().toISOString();
  return {
    planKey: plan.planKey,
    gameId: plan.gameId,
    name: plan.name,
    reason: existing?.reason || `runtime failure: ${message}`,
    source: existing?.source === 'manual-rule' ? 'manual-rule' : 'runtime-failure',
    firstRecordedAt: existing?.firstRecordedAt || timestamp,
    lastRecordedAt: timestamp,
    lastError: message,
  };
}

function buildFamilySkipReason(gameId: number, message: string): string {
  return `family terminal failure for game ${gameId}: ${message}`;
}

function resolveCaptureDefaults(configuredGames: SGBatchGameConfig[]): CaptureDefaults {
  const completeGame =
    configuredGames.find((game) => isCompleteConfig(game)) ||
    configuredGames.find((game) => String(game.operatorId || game.sessionId || game.serverAddress || '').trim() !== '');

  return {
    operatorId: process.env.SG_DEFAULT_OPERATOR_ID || completeGame?.operatorId || '1214',
    sessionId:
      process.env.SG_DEFAULT_SESSION_ID ||
      completeGame?.sessionId ||
      'Free:mc6p4kd336fn31j40kqafgeqd09',
    currency: process.env.SG_DEFAULT_CURRENCY || completeGame?.currency || 'USD',
    lang: process.env.SG_DEFAULT_LANG || completeGame?.lang || 'en_us',
    mode: process.env.SG_DEFAULT_MODE || completeGame?.mode || 'demo',
    serverAddress:
      process.env.SG_DEFAULT_SERVER_ADDRESS ||
      completeGame?.serverAddress ||
      'ogs-gdm-usnj.nyxop.net/nextgen',
    betPerLine: Number(process.env.SG_DEFAULT_BET_PER_LINE || completeGame?.betPerLine || 5),
    lineBet: Number(process.env.SG_DEFAULT_LINE_BET || completeGame?.lineBet || 50),
    clientType: process.env.SG_DEFAULT_CLIENT_TYPE || completeGame?.clientType,
  };
}

function defaultMetadataPath(): string {
  const explicit = readArgValue('--metadata') || process.env.SG_BATCH_METADATA || '';
  if (explicit) {
    return path.resolve(explicit);
  }

  return path.join(rootDir(), 'api.common', 'service', 'sg_manifest.json');
}

async function loadMetadataEntries(configuredGames: SGBatchGameConfig[]): Promise<ManifestEntry[]> {
  if (process.argv.includes('--configured-only')) {
    return configuredGames.map((game) => ({
      gameId: game.gameId,
      name: game.name,
      pathSlug: game.runtimeSlug,
    }));
  }

  const metadataPath = defaultMetadataPath();
  if (await fs.pathExists(metadataPath)) {
    const raw = await fs.readJSON(metadataPath);
    const entries = Array.isArray(raw) ? raw : Object.values(raw || {});
    return entries
      .map((entry: any) => ({
        gameId: normalizeGameId(entry.gameId ?? entry.id),
        name: String(entry.name || ''),
        path: String(entry.path || ''),
        sourceId: String(entry.sourceId || ''),
        pathSlug: String(entry.pathSlug || entry.pageSlug || ''),
        pageSlug: String(entry.pageSlug || entry.pathSlug || ''),
        minBet: entry.minBet,
        maxBet: entry.maxBet,
        startUrl: entry.startUrl || entry.launchUrl,
        launchUrl: entry.launchUrl || entry.startUrl,
        runtimeSlug: entry.runtimeSlug,
        operatorId: entry.operatorId,
        sessionId: entry.sessionId,
        demoSessionId: entry.demoSessionId,
        currency: entry.currency,
        lang: entry.lang,
        mode: entry.mode,
        serverAddress: entry.serverAddress,
      }))
      .filter((entry) => entry.gameId > 0);
  }

  return configuredGames.map((game) => ({
    gameId: game.gameId,
    name: game.name,
    pathSlug: game.runtimeSlug,
  }));
}

function defaultStaticManifestPaths(): string[] {
  const explicit = readArgValue('--static-manifest') || process.env.SG_STATIC_MANIFEST || '';
  if (explicit) {
    return explicit
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => path.resolve(item));
  }

  return [
    path.resolve(__dirname, '..', 'assets', 'sg_launches.json'),
    path.resolve(rootDir(), '..', 'api_new_docker', 'api_new', 'client', 'game', 'sg', 'static', 'sg_games.json'),
  ];
}

async function loadStaticManifest(): Promise<Map<number, StaticManifestEntry>> {
  const manifestPaths = defaultStaticManifestPaths();
  const result = new Map<number, StaticManifestEntry>();

  for (const manifestPath of manifestPaths) {
    if (!(await fs.pathExists(manifestPath))) {
      continue;
    }

    const raw = await fs.readJSON(manifestPath);
    for (const [key, value] of Object.entries(raw || {})) {
      const entry = value as StaticManifestEntry;
      const id = normalizeGameId(entry.id || key);
      if (id > 0) {
        result.set(id, {
          ...(result.get(id) || {}),
          ...entry,
          id,
        });
      }
    }
  }

  return result;
}

function isCompleteConfig(config: Partial<SGBatchGameConfig>): boolean {
  return REQUIRED_CONFIG_FIELDS.every((field) => String((config as any)[field] || '').trim() !== '');
}

function missingConfigFields(config: Partial<SGBatchGameConfig>): string[] {
  return REQUIRED_CONFIG_FIELDS.filter((field) => String((config as any)[field] || '').trim() === '');
}

function mergeKnownSpecialKinds(config: Partial<SGBatchGameConfig>, staticEntry?: StaticManifestEntry): SGSpecialKind[] {
  const configured = normalizeSpecialKinds(config.knownSpecialKinds || config.specialKinds);
  if (configured.length > 0) {
    return configured;
  }
  return knownSpecialsFromStatic(staticEntry);
}

function buildConfigFromMetadata(
  entry: ManifestEntry,
  staticEntry: StaticManifestEntry | undefined,
  defaults: CaptureDefaults,
  captureRule?: CaptureRuleEntry,
): Partial<SGBatchGameConfig> {
  const allowDerived = !process.argv.includes('--no-derive') && process.env.SG_BATCH_DERIVE_FROM_MANIFEST !== '0';
  if (!allowDerived && !staticEntry?.runtimeSlug) {
    return {};
  }

  const launch = launchConfigFromEntry(entry, staticEntry);
  const runtimeSlug = firstNonEmpty(staticEntry?.runtimeSlug, entry.runtimeSlug, launch.runtimeSlug, deriveRuntimeSlug(entry));
  const operatorId = firstNonEmpty(staticEntry?.operatorId, entry.operatorId, launch.operatorId, defaults.operatorId);
  const ownSessionId = firstNonEmpty(
    staticEntry?.demoSessionId,
    staticEntry?.sessionId,
    entry.demoSessionId,
    entry.sessionId,
    launch.sessionId,
  );
  const sessionId = ownSessionId || (allowSharedSession() ? firstNonEmpty(defaults.sessionId) : '');
  const serverAddress = firstNonEmpty(staticEntry?.serverAddress, entry.serverAddress, launch.serverAddress, defaults.serverAddress);
  const currency = firstNonEmpty(staticEntry?.currency, entry.currency, launch.currency, defaults.currency, 'USD');
  const lang = firstNonEmpty(staticEntry?.lang, entry.lang, launch.lang, defaults.lang, 'en_us');
  const mode = firstNonEmpty(staticEntry?.mode, entry.mode, launch.mode, defaults.mode, 'demo');
  const startUrl = firstNonEmpty(staticEntry?.startUrl, staticEntry?.launchUrl, entry.startUrl, entry.launchUrl, launch.startUrl);

  return {
    gameId: normalizeGameId(entry.gameId || staticEntry?.id),
    name: String(staticEntry?.name || entry.name || runtimeSlug),
    planKey: String(normalizeGameId(entry.gameId || staticEntry?.id)),
    captureKey: String(normalizeGameId(entry.gameId || staticEntry?.id)),
    variantLabel: '',
    runtimeSlug,
    operatorId,
    sessionId,
    currency,
    lang,
    mode,
    serverAddress,
    betPerLine: Number(defaults.betPerLine || 5),
    lineBet: Number(defaults.lineBet || 50),
    clientType: defaults.clientType,
    startUrl,
    freeChoiceOptionCount: Number(captureRule?.freeChoiceOptionCount || 0) || 0,
    dbName: `sg_${normalizeDbNamePart(runtimeSlug)}`,
    rtpPath: `sggames/sg_${normalizeDbNamePart(runtimeSlug)}/config/rtp.xlsx`,
  };
}

function createVariantConfigs(config: SGBatchGameConfig): SGBatchGameConfig[] {
  const baseBuy = normalizeBuyValue(config.buy);
  const options = Array.isArray(config.enhancedBetOptions) ? config.enhancedBetOptions : [];
  if (!options.length) {
    const singleBuy = baseBuy > 0 ? baseBuy : 0;
    return [
      {
        ...config,
        buy: singleBuy,
        planKey: buildPlanKey(config.gameId, singleBuy),
        captureKey: buildCaptureKey(config.gameId, singleBuy),
        variantLabel: buildVariantLabel(config.name, singleBuy, normalizeBuyValue(config.enhancedBetLevel), config.enhancedBetLabel || ''),
      },
    ];
  }

  const variants: SGBatchGameConfig[] = [];
  variants.push({
    ...config,
    buy: 0,
    planKey: buildPlanKey(config.gameId, 0),
    captureKey: buildCaptureKey(config.gameId, 0),
    variantLabel: '',
  });

  for (const option of options) {
    const buy = normalizeBuyValue(option.buy);
    if (buy <= 0) {
      continue;
    }

    variants.push({
      ...config,
      buy,
      enhancedBetLevel: normalizeBuyValue(option.level),
      enhancedBetLabel: String(option.label || '').trim(),
      fatalErrorPatterns: Array.isArray(option.fatalErrorPatterns) && option.fatalErrorPatterns.length
        ? option.fatalErrorPatterns
        : config.fatalErrorPatterns,
      betPerLine: option.betPerLine ?? config.betPerLine,
      lineBet: option.lineBet ?? config.lineBet,
      baseBet: option.baseBet ?? config.baseBet,
      reelsSelected: option.reelsSelected ?? config.reelsSelected,
      abpm: option.abpm ?? config.abpm,
      anteBet: option.anteBet ?? config.anteBet,
      rsc: option.rsc ?? config.rsc,
      includeRsc: option.includeRsc ?? config.includeRsc,
      planKey: buildPlanKey(config.gameId, buy),
      captureKey: buildCaptureKey(config.gameId, buy),
      variantLabel: buildVariantLabel(config.name, buy, normalizeBuyValue(option.level), String(option.label || '').trim()),
    });
  }

  return variants;
}

function resolveConfigs(
  entry: ManifestEntry,
  configuredById: Map<number, SGBatchGameConfig>,
  captureRulesById: Map<number, CaptureRuleEntry>,
  staticEntry?: StaticManifestEntry,
  defaults: CaptureDefaults = {},
): { configs: SGBatchGameConfig[]; missingConfig: string[]; knownSpecialKinds: SGSpecialKind[]; freeChoiceOptionCount: number } {
  const gameId = normalizeGameId(entry.gameId);
  const configured = configuredById.get(gameId);
  const captureRule = captureRulesById.get(gameId);
  const derived = buildConfigFromMetadata(entry, staticEntry, defaults, captureRule);
  const merged: Partial<SGBatchGameConfig> = {
    ...derived,
    ...captureRule,
    ...configured,
    gameId,
    name: configured?.name || entry.name || staticEntry?.name || derived.name || String(gameId),
  };
  if (
    merged.disableDerivedEnhancedBetOptions !== true &&
    (!Array.isArray(merged.enhancedBetOptions) || merged.enhancedBetOptions.length === 0) &&
    normalizeBuyValue(merged.buy) <= 0
  ) {
    const derivedEnhancedBetOptions = deriveEnhancedBetOptionsFromProtocol(merged);
    if (derivedEnhancedBetOptions.length > 0) {
      merged.enhancedBetOptions = derivedEnhancedBetOptions;
      console.log(
        `[sg] derived enhanced bet modes game=${gameId} runtime=${String(merged.runtimeSlug || '')} count=${derivedEnhancedBetOptions.length} buys=${derivedEnhancedBetOptions.map((option) => option.buy).join(',')} abpm=${derivedEnhancedBetOptions.map((option) => option.abpm || 0).join(',')}`,
      );
    }
  }
  const knownSpecialKinds = mergeKnownSpecialKinds(merged, staticEntry);
  const freeChoiceOptionCount = Number(merged.freeChoiceOptionCount || 0) || 0;
  const missingConfig = missingConfigFields(merged);

  if (isCompleteConfig(merged)) {
    return {
      configs: createVariantConfigs({
        roundCount: UNKNOWN_SPECIAL_ROUND_LIMIT,
        dbName: `sg_${normalizeDbNamePart(String(merged.runtimeSlug))}`,
        rtpPath: `sggames/sg_${normalizeDbNamePart(String(merged.runtimeSlug))}/config/rtp.xlsx`,
        ...merged,
        knownSpecialKinds,
      } as SGBatchGameConfig),
      missingConfig: [],
      knownSpecialKinds,
      freeChoiceOptionCount,
    };
  }

  return { configs: [], missingConfig, knownSpecialKinds, freeChoiceOptionCount };
}

export async function loadRoundStats(captureKey: string): Promise<RoundStats> {
  const stats: RoundStats = {
    roundCount: 0,
    bonusLikeCount: 0,
    freeGameCount: 0,
    featureCount: 0,
    freeFeatureCount: 0,
    freeChoiceOptionHits: {},
  };
  const roundsPath = path.resolve(__dirname, '..', CAPTURE_ROOT, captureKey, 'rounds.jsonl');
  if (!(await fs.pathExists(roundsPath))) {
    return stats;
  }

  const lines = createInterface({ input: fs.createReadStream(roundsPath), crlfDelay: Infinity });
  for await (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    try {
      const doc = JSON.parse(trimmed);
      if (!doc || typeof doc !== 'object' || Array.isArray(doc) || !doc.data || typeof doc.data !== 'object' || Array.isArray(doc.data)) {
        throw new Error('Invalid round structure');
      }
      stats.roundCount += 1;
      const primaryBonusKind = String(doc?.data?.primaryBonusKind || '').trim();
      const msgIds = Array.isArray(doc?.data?.msgIds) ? doc.data.msgIds.map((value: unknown) => String(value || '')) : [];
      const hasFreeGame = primaryBonusKind === 'freeGame' || primaryBonusKind === 'freeFeature' || msgIds.includes('FREE_GAME');
      const hasFeature =
        primaryBonusKind === 'feature' ||
        primaryBonusKind === 'freeFeature' ||
        msgIds.some((msgId: string) => ['FEATURE_START', 'FEATURE_PICK', 'FEATURE_END'].includes(msgId));
      if (hasFreeGame || hasFeature) stats.bonusLikeCount += 1;
      if (hasFreeGame) stats.freeGameCount += 1;
      if (hasFeature) stats.featureCount += 1;
      if (hasFreeGame && hasFeature) stats.freeFeatureCount += 1;
      const freeChoiceOptionIndex = Number(doc?.data?.freeChoiceOptionIndex || 0);
      if (Number.isFinite(freeChoiceOptionIndex) && freeChoiceOptionIndex > 0) {
        const key = String(freeChoiceOptionIndex);
        stats.freeChoiceOptionHits![key] = (stats.freeChoiceOptionHits![key] || 0) + 1;
      }
    } catch {
      throw new Error(`SG_INVALID_JSONL: ${captureKey}; raw content suppressed`);
    }
  }

  return stats;
}

export function buildPlanStatus(
  config: SGBatchGameConfig | undefined,
  stats: RoundStats,
  knownSpecialKinds: SGSpecialKind[],
  freeChoiceOptionCount: number,
  roundLimit: number,
  specialLimit: number,
): Pick<GamePlan, 'status' | 'totalCurrent' | 'totalTarget' | 'totalMissing' | 'completionRate'> {
  if (!config) {
    return { status: 'missing-config', totalCurrent: 0, totalTarget: 0, totalMissing: 0, completionRate: 0 };
  }

  if (knownSpecialKinds.length > 0) {
    const specialTarget = knownSpecialKinds.length * Math.max(1, specialLimit);
    const roundTarget = requireStandardRounds() ? roundLimit : 0;
    const optionTarget = Math.max(0, freeChoiceOptionCount);
    const totalTarget = roundTarget + specialTarget;
    const optionCurrent = Array.from({ length: optionTarget }, (_, i) => i + 1)
      .filter((option) => Number(stats.freeChoiceOptionHits?.[String(option)] || 0) > 0).length;
    const totalCurrent =
      Math.min(stats.roundCount, roundTarget) +
      knownSpecialKinds.reduce((sum, kind) => sum + Math.min(specialCurrent(stats, [kind]), Math.max(1, specialLimit)), 0) +
      optionCurrent;
    const adjustedTarget = totalTarget + optionTarget;
    const totalMissing = Math.max(adjustedTarget - totalCurrent, 0);
    return {
      status: totalMissing === 0 ? 'complete' : 'pending',
      totalCurrent,
      totalTarget: adjustedTarget,
      totalMissing,
      completionRate: adjustedTarget > 0 ? totalCurrent / adjustedTarget : 0,
    };
  }

  const totalCurrent = Math.min(stats.roundCount, roundLimit);
  const totalMissing = Math.max(roundLimit - totalCurrent, 0);
  return {
    status: totalMissing === 0 ? 'complete' : 'pending',
    totalCurrent,
    totalTarget: roundLimit,
    totalMissing,
    completionRate: roundLimit > 0 ? totalCurrent / roundLimit : 0,
  };
}

async function buildGamePlans(
  entry: ManifestEntry,
  configuredById: Map<number, SGBatchGameConfig>,
  captureRulesById: Map<number, CaptureRuleEntry>,
  skippedById: Map<string, PersistedSkipEntry>,
  staticManifest: Map<number, StaticManifestEntry>,
  defaults: CaptureDefaults,
  roundLimit: number,
  specialLimit: number,
  ignoreManualSkip: boolean,
): Promise<GamePlan[]> {
  const gameId = normalizeGameId(entry.gameId);
  const staticEntry = staticManifest.get(gameId);
  const captureRule = captureRulesById.get(gameId);
  const skipEntry = mergeSkipEntries(
    skippedById.get(skipLedgerKey(gameId)),
    ignoreManualSkip ? undefined : buildManualSkipEntry(gameId, captureRule, String(entry.name || staticEntry?.name || gameId)),
  );
  if (skipEntry) {
    return [
      {
        planKey: buildPlanKey(gameId, 0),
        gameId,
        name: String(entry.name || staticEntry?.name || gameId),
        displayName: String(entry.name || staticEntry?.name || gameId),
        pathSlug: String(entry.pathSlug || entry.pageSlug || staticEntry?.pageSlug || ''),
        captureKey: buildCaptureKey(gameId, 0),
        variantLabel: '',
        status: 'skipped',
        missingConfig: [],
        stats: {
          roundCount: 0,
          bonusLikeCount: 0,
          freeGameCount: 0,
          featureCount: 0,
          freeFeatureCount: 0,
        },
        knownSpecialKinds: [],
        freeChoiceOptionCount: 0,
        skipReason: skipEntry.reason,
        skipSource: skipEntry.source,
        totalCurrent: 0,
        totalTarget: 0,
        totalMissing: 0,
        completionRate: 0,
      },
    ];
  }

  const resolved = resolveConfigs(entry, configuredById, captureRulesById, staticEntry, defaults);
  if (!resolved.configs.length) {
    const progress = buildPlanStatus(undefined, {
      roundCount: 0,
      bonusLikeCount: 0,
      freeGameCount: 0,
      featureCount: 0,
      freeFeatureCount: 0,
    }, resolved.knownSpecialKinds, resolved.freeChoiceOptionCount, roundLimit, specialLimit);
    return [
      {
        planKey: buildPlanKey(gameId, 0),
        gameId,
        name: String(entry.name || staticEntry?.name || gameId),
        displayName: String(entry.name || staticEntry?.name || gameId),
        pathSlug: String(entry.pathSlug || entry.pageSlug || staticEntry?.pageSlug || ''),
        captureKey: buildCaptureKey(gameId, 0),
        variantLabel: '',
        config: undefined,
        missingConfig: resolved.missingConfig,
        stats: {
          roundCount: 0,
          bonusLikeCount: 0,
          freeGameCount: 0,
          featureCount: 0,
          freeFeatureCount: 0,
        },
        knownSpecialKinds: resolved.knownSpecialKinds,
        freeChoiceOptionCount: resolved.freeChoiceOptionCount,
        skipReason: undefined,
        skipSource: undefined,
        ...progress,
      },
    ];
  }

  const plans: GamePlan[] = [];
  for (const config of resolved.configs) {
    const stats = await loadRoundStats(String(config.captureKey || config.gameId));
    const progress = buildPlanStatus(config, stats, resolved.knownSpecialKinds, resolved.freeChoiceOptionCount, roundLimit, specialLimit);
    const displayName = config.variantLabel ? `${config.name} [${config.variantLabel}]` : config.name;
    const persistedVariantSkip = skippedById.get(skipLedgerKey(gameId, config.planKey));
    if (persistedVariantSkip) {
      plans.push({
        planKey: String(config.planKey || buildPlanKey(gameId, normalizeBuyValue(config.buy))),
        gameId,
        name: config.name,
        displayName,
        pathSlug: String(entry.pathSlug || entry.pageSlug || staticEntry?.pageSlug || ''),
        captureKey: String(config.captureKey || buildCaptureKey(gameId, normalizeBuyValue(config.buy))),
        variantLabel: String(config.variantLabel || ''),
        config,
        missingConfig: [],
        stats,
        knownSpecialKinds: resolved.knownSpecialKinds,
        freeChoiceOptionCount: resolved.freeChoiceOptionCount,
        skipReason: persistedVariantSkip.reason,
        skipSource: persistedVariantSkip.source,
        status: 'skipped',
        totalCurrent: 0,
        totalTarget: 0,
        totalMissing: 0,
        completionRate: 0,
      });
      continue;
    }

    plans.push({
      planKey: String(config.planKey || buildPlanKey(gameId, normalizeBuyValue(config.buy))),
      gameId,
      name: config.name,
      displayName,
      pathSlug: String(entry.pathSlug || entry.pageSlug || staticEntry?.pageSlug || ''),
      captureKey: String(config.captureKey || buildCaptureKey(gameId, normalizeBuyValue(config.buy))),
      variantLabel: String(config.variantLabel || ''),
      config,
      missingConfig: [],
      stats,
      knownSpecialKinds: resolved.knownSpecialKinds,
      freeChoiceOptionCount: resolved.freeChoiceOptionCount,
      skipReason: undefined,
      skipSource: undefined,
      ...progress,
    });
  }

  return plans;
}

function comparePlans(left: GamePlan, right: GamePlan): number {
  const statusRank: Record<GamePlanStatus, number> = { pending: 0, 'missing-config': 1, skipped: 2, complete: 3 };
  if (statusRank[left.status] !== statusRank[right.status]) {
    return statusRank[left.status] - statusRank[right.status];
  }
  if (left.completionRate !== right.completionRate) {
    return left.completionRate - right.completionRate;
  }
  if (left.gameId !== right.gameId) {
    return left.gameId - right.gameId;
  }
  return left.planKey.localeCompare(right.planKey);
}

function isSessionInvalidMessage(message: string): boolean {
  return /session id is invalid|invalid session/i.test(String(message || ''));
}

function isCommunicationsFailureMessage(message: string): boolean {
  return /ERROR_COMMUNICATIONS|socket hang up|ECONNRESET|ETIMEDOUT|TLS/i.test(String(message || ''));
}

function isFamilyTerminalFailureMessage(message: string): boolean {
  return /ERROR_PROTOCOL_SEQUENCE|ERROR_ANTEBET|ERROR_LOGICALSLOT|ERROR_MISSING_PARAMETER/i.test(String(message || ''));
}

let launchRefreshQueue: Promise<void> = Promise.resolve();

async function withLaunchRefreshLock<T>(task: () => Promise<T>): Promise<T> {
  const previous = launchRefreshQueue.catch(() => {});
  let release: () => void = () => {};
  launchRefreshQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await task();
  } finally {
    release();
  }
}

function launchCollectorScriptPath(): string {
  return path.resolve(__dirname, 'collect-launches.mjs');
}

function launchRefreshTimeoutMs(): number {
  const raw = Number(process.env.SG_LAUNCH_REFRESH_TIMEOUT_MS || 90000);
  return Number.isFinite(raw) && raw > 0 ? raw : 90000;
}

function killProcessTree(pid?: number): void {
  if (!pid) {
    return;
  }

  if (process.platform === 'win32') {
    const killer = spawn('taskkill', ['/pid', String(pid), '/t', '/f'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    killer.on('error', () => {});
    return;
  }

  try {
    process.kill(pid, 'SIGKILL');
  } catch {
    // The process may have already exited between timeout and cleanup.
  }
}

async function refreshLaunchForGame(gameId: number): Promise<void> {
  return withLaunchRefreshLock(async () => {
    const args = [
      launchCollectorScriptPath(),
      `--games=${gameId}`,
      '--force',
    ];

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        await new Promise<void>((resolve, reject) => {
          let settled = false;
          const refreshEnv = { ...process.env };
          if (!refreshEnv.SG_BROWSER_PROFILE) {
            refreshEnv.SG_BROWSER_PROFILE = path.resolve(
              __dirname,
              '..',
              'assets',
              'sg',
              `dk-profile-refresh-${process.pid}-${gameId}-${attempt}`,
            );
          }
          refreshEnv.SG_COLLECT_HEADLESS = refreshEnv.SG_COLLECT_HEADLESS || '1';
          const child = spawn(process.execPath, args, {
            cwd: path.resolve(__dirname, '..'),
            stdio: 'inherit',
            shell: false,
            env: refreshEnv,
          });

          const timeout = setTimeout(() => {
            if (settled) {
              return;
            }
            settled = true;
            killProcessTree(child.pid);
            reject(new Error(`collect-launches timed out after ${launchRefreshTimeoutMs()}ms`));
          }, launchRefreshTimeoutMs());

          child.on('error', (error) => {
            if (settled) {
              return;
            }
            settled = true;
            clearTimeout(timeout);
            reject(error);
          });
          child.on('exit', (code) => {
            if (settled) {
              return;
            }
            settled = true;
            clearTimeout(timeout);
            if (code === 0) {
              resolve();
              return;
            }
            reject(new Error(`collect-launches exited with code ${code ?? -1}`));
          });
        });
        return;
      } catch (error) {
        if (attempt >= 2) {
          throw error;
        }
        console.warn(`[scheduler] refresh launch for ${gameId} retry ${attempt}/2 after ${String(error)}`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    throw new Error(`collect-launches exited with code -1`);
  });
}

function mergeRefreshedStaticConfig(config: SGBatchGameConfig, staticEntry?: StaticManifestEntry): SGBatchGameConfig {
  if (!staticEntry) {
    return config;
  }

  return {
    ...config,
    runtimeSlug: firstNonEmpty(staticEntry.runtimeSlug, config.runtimeSlug),
    operatorId: firstNonEmpty(staticEntry.operatorId, config.operatorId),
    sessionId: firstNonEmpty(staticEntry.demoSessionId, staticEntry.sessionId, config.sessionId),
    currency: firstNonEmpty(staticEntry.currency, config.currency),
    lang: firstNonEmpty(staticEntry.lang, config.lang),
    mode: firstNonEmpty(staticEntry.mode, config.mode),
    serverAddress: firstNonEmpty(staticEntry.serverAddress, config.serverAddress),
    startUrl: firstNonEmpty(staticEntry.startUrl, staticEntry.launchUrl, config.startUrl),
  };
}

async function refreshPlanConfig(plan: GamePlan, currentConfig: SGBatchGameConfig): Promise<SGBatchGameConfig> {
  await refreshLaunchForGame(plan.gameId);
  const staticManifest = await loadStaticManifest();
  const staticEntry = staticManifest.get(plan.gameId);
  const refreshed = mergeRefreshedStaticConfig(currentConfig, staticEntry);

  if (!String(refreshed.sessionId || '').trim() || !String(refreshed.serverAddress || '').trim()) {
    throw new Error(`[sg] ${plan.gameId} refresh launch missing session/server after retry`);
  }

  return refreshed;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!items.length) {
    return [];
  }

  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const runnerCount = Math.min(Math.max(1, limit), items.length);
  const runners = Array.from({ length: runnerCount }, async () => {
    for (;;) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) {
        return;
      }
      results[index] = await worker(items[index], index);
    }
  });

  await Promise.all(runners);
  return results;
}

function filterPlans(plans: GamePlan[], gameFilter: Set<string>): GamePlan[] {
  if (gameFilter.size === 0) {
    return plans;
  }

  const strictPlanScope = !!readArgValue('--games-file');
  if (strictPlanScope) {
    const normalized = new Set(
      Array.from(gameFilter)
        .map((value) => String(value || '').trim())
        .filter(Boolean),
    );

    return plans.filter((plan) => {
      if (normalized.has(plan.planKey) || normalized.has(plan.captureKey)) {
        return true;
      }

      if (normalized.has(String(plan.gameId))) {
        return plan.planKey === String(plan.gameId) || plan.captureKey === String(plan.gameId);
      }

      if (normalized.has(plan.name) || normalized.has(plan.displayName) || normalized.has(plan.config?.runtimeSlug || '') || normalized.has(plan.pathSlug)) {
        return true;
      }

      return false;
    });
  }

  return plans.filter(
    (plan) =>
      gameFilter.has(String(plan.gameId)) ||
      gameFilter.has(plan.name) ||
      gameFilter.has(plan.displayName) ||
      gameFilter.has(plan.planKey) ||
      gameFilter.has(plan.captureKey) ||
      gameFilter.has(plan.config?.runtimeSlug || '') ||
      gameFilter.has(plan.pathSlug),
  );
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}h${minutes.toString().padStart(2, '0')}m${seconds.toString().padStart(2, '0')}s`;
  }
  return `${minutes}m${seconds.toString().padStart(2, '0')}s`;
}

function progressUnits(plan: GamePlan, progress: RoundStats, roundLimit: number, specialLimit: number): number {
  if (!plan.knownSpecialKinds.length) {
    return Math.min(progress.roundCount, roundLimit);
  }

  const roundUnits = requireStandardRounds() ? Math.min(progress.roundCount, roundLimit) : 0;
  const specialTarget = plan.knownSpecialKinds.length * Math.max(1, specialLimit);
  const optionHits = 'freeChoiceOptionHits' in (progress as any) ? Object.keys(((progress as any).freeChoiceOptionHits || {})).length : 0;
  return roundUnits + Math.min(specialCurrent(progress, plan.knownSpecialKinds), specialTarget) + Math.min(optionHits, plan.freeChoiceOptionCount);
}

function progressTarget(plan: GamePlan, roundLimit: number, specialLimit: number): number {
  if (!plan.knownSpecialKinds.length) {
    return roundLimit;
  }
  const roundTarget = requireStandardRounds() ? roundLimit : 0;
  return roundTarget + plan.knownSpecialKinds.length * Math.max(1, specialLimit) + Math.max(0, plan.freeChoiceOptionCount);
}

class BatchProgress {
  private readonly startedAt = Date.now();
  private readonly states = new Map<string, SGCaptureProgress>();
  private timer: NodeJS.Timeout | null = null;
  private done = 0;
  private failed = 0;

  constructor(
    private readonly plans: GamePlan[],
    private readonly roundLimit: number,
    private readonly specialLimit: number,
    private readonly intervalMs: number,
  ) {}

  start() {
    if (this.intervalMs <= 0 || this.timer) {
      return;
    }

    this.timer = setInterval(() => this.print('tick'), this.intervalMs);
    this.timer.unref?.();
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  update(progress: SGCaptureProgress) {
    this.states.set(progress.planKey || String(progress.gameId), progress);
    if (progress.phase === 'round' && (progress.roundCount % 100 === 0 || progress.freeGameCount > 0 || progress.featureCount > 0)) {
      this.print(`game-${progress.planKey || progress.gameId}`);
    }
  }

  markDone(planKey?: string) {
    this.done += 1;
    if (planKey) {
      this.states.delete(planKey);
    }
    this.print('done');
  }

  markFailed(planKey?: string) {
    this.failed += 1;
    if (planKey) {
      this.states.delete(planKey);
    }
    this.print('failed');
  }

  print(reason: string) {
    const planMap = new Map(this.plans.map((plan) => [plan.planKey, plan]));
    let current = 0;
    let target = 0;
    let active = 0;

    for (const plan of this.plans) {
      const state = this.states.get(plan.planKey);
      target += progressTarget(plan, this.roundLimit, this.specialLimit);
      if (state) {
        active += state.phase === 'complete' ? 0 : 1;
        current += progressUnits(plan, state, this.roundLimit, this.specialLimit);
      } else {
        current += plan.totalCurrent;
      }
    }

    const percent = target > 0 ? ((current / target) * 100).toFixed(2) : '100.00';
    const topActive = Array.from(this.states.values())
      .filter((state) => state.phase !== 'complete')
      .slice(-6)
      .map((state) => {
        const plan = planMap.get(state.planKey || String(state.gameId));
        const targetText = plan?.knownSpecialKinds.length
          ? `special=${progressUnits(plan, state, this.roundLimit, this.specialLimit)}/${progressTarget(plan, this.roundLimit, this.specialLimit)}`
          : `${state.roundCount}/${this.roundLimit}`;
        const bits = [`${plan?.displayName || state.runtimeSlug || state.gameId}:${targetText}`];
        if (state.freeGameCount > 0) bits.push(`FG=${state.freeGameCount}`);
        if (state.featureCount > 0) bits.push(`FB=${state.featureCount}`);
        if (state.freeChoiceOptionCount > 0) {
          bits.push(`CHOICE=${Object.keys(state.freeChoiceOptionHits || {}).length}/${state.freeChoiceOptionCount}`);
        }
        if (state.reconnects > 0) bits.push(`R=${state.reconnects}`);
        return bits.join(',');
      })
      .join(' | ');

    console.log(
      `[batch-progress] reason=${reason} games=${this.done}/${this.plans.length} failed=${this.failed} active=${active} units=${current}/${target} ${percent}% elapsed=${formatDuration(Date.now() - this.startedAt)}${topActive ? ` active=[${topActive}]` : ''}`,
    );
  }
}

async function writeReport(
  reportPath: string,
  plans: GamePlan[],
  results: Array<Record<string, any>>,
  roundLimit: number,
  specialLimit: number,
) {
  const resolved = path.resolve(reportPath);
  await fs.ensureDir(path.dirname(resolved));
  await fs.writeJSON(
    resolved,
    {
      generatedAt: new Date().toISOString(),
      roundLimit,
      specialLimit,
      totalGames: plans.length,
      pendingGames: plans.filter((plan) => plan.status === 'pending').length,
      completeGames: plans.filter((plan) => plan.status === 'complete').length,
      missingConfigGames: plans.filter((plan) => plan.status === 'missing-config').length,
      skippedGames: plans.filter((plan) => plan.status === 'skipped').length,
      plans,
      results,
    },
    { spaces: 2 },
  );
}

async function writeFinish(summary: SGCaptureSummary) {
  const gameDir = path.resolve(__dirname, '..', CAPTURE_ROOT, String(summary.captureKey || summary.gameId));
  await fs.ensureDir(gameDir);
  await fs.writeFile(
    path.join(gameDir, 'finish.txt'),
    [
      `finish: ${summary.finishedAt}`,
      `rounds=${summary.roundCount}`,
      `freeGame=${summary.freeGameCount}`,
      `feature=${summary.featureCount}`,
      `freeFeature=${summary.freeFeatureCount}`,
      `freeChoiceOptionCount=${summary.freeChoiceOptionCount}`,
      `freeChoiceOptionHits=${JSON.stringify(summary.freeChoiceOptionHits)}`,
      `planKey=${summary.planKey}`,
      `variantLabel=${summary.variantLabel || ''}`,
      `stoppedBy=${summary.stoppedBy}`,
    ].join('\n') + '\n',
    'utf8',
  );
}

async function hasFinishMarker(captureKey: string): Promise<boolean> {
  const finishPath = path.resolve(__dirname, '..', CAPTURE_ROOT, String(captureKey), 'finish.txt');
  return fs.pathExists(finishPath);
}

function synthesizeKnownSpecialSummary(plan: GamePlan): SGCaptureSummary {
  const now = new Date().toISOString();
  const freeChoiceOptionHits =
    plan.freeChoiceOptionCount > 0
      ? Object.fromEntries(Array.from({ length: plan.freeChoiceOptionCount }, (_, index) => [String(index + 1), 1]))
      : {};

  return {
    gameId: plan.gameId,
    planKey: plan.planKey,
    captureKey: plan.captureKey,
    variantLabel: plan.variantLabel || '',
    runtimeSlug: String(plan.config?.runtimeSlug || ''),
    targetRounds: 0,
    knownSpecialKinds: plan.knownSpecialKinds,
    freeChoiceOptionCount: plan.freeChoiceOptionCount,
    freeChoiceOptionHits,
    primaryBonusCounts: {
      freeGame: plan.stats.freeGameCount,
      feature: plan.stats.featureCount,
      freeFeature: plan.stats.freeFeatureCount,
    },
    stoppedBy: 'known-specials',
    startedAt: now,
    finishedAt: now,
    roundCount: plan.stats.roundCount,
    bonusLikeCount: plan.stats.bonusLikeCount,
    freeGameCount: plan.stats.freeGameCount,
    featureCount: plan.stats.featureCount,
    freeFeatureCount: plan.stats.freeFeatureCount,
  };
}

async function backfillKnownSpecialFinish(plan: GamePlan, specialLimit: number): Promise<boolean> {
  if (plan.status !== 'complete' || !plan.knownSpecialKinds.length) {
    return false;
  }

  if (await hasFinishMarker(plan.captureKey)) {
    return false;
  }

  if (!knownSpecialsCovered(plan.stats, plan.knownSpecialKinds, specialLimit)) {
    return false;
  }

  if (plan.freeChoiceOptionCount > 0 && plan.totalMissing > 0) {
    return false;
  }

  await writeFinish(synthesizeKnownSpecialSummary(plan));
  console.log(`[sg] backfilled finish marker for ${plan.planKey} stoppedBy=known-specials rounds=${plan.stats.roundCount}`);
  return true;
}

async function backfillKnownSpecialFinishes(plans: GamePlan[], specialLimit: number): Promise<number> {
  let count = 0;
  for (const plan of plans) {
    if (await backfillKnownSpecialFinish(plan, specialLimit)) {
      count += 1;
    }
  }
  return count;
}

function buildCaptureOptions(plan: GamePlan, roundLimit: number, specialLimit: number): SGCaptureOptions {
  const configuredMaxRounds = parseNumberArg(['--max-rounds', '--unknown-special-limit'], Number(process.env.SG_BATCH_MAX_ROUNDS || roundLimit));
  const standardRoundsRequired = requireStandardRounds();
  const maxRounds =
    plan.knownSpecialKinds.length > 0
      ? plan.stats.roundCount + Math.max(1, configuredMaxRounds)
      : configuredMaxRounds;
  const targetRounds = plan.knownSpecialKinds.length > 0 ? (standardRoundsRequired ? roundLimit : 0) : maxRounds;
  return {
    targetRounds,
    minBonusRounds: 0,
    minFreeGameRounds: 0,
    minFeatureRounds: 0,
    minFreeFeatureRounds: 0,
    knownSpecialKinds: plan.knownSpecialKinds,
    minKnownSpecialRounds: specialLimit,
    stopWhenKnownSpecialsCovered: plan.knownSpecialKinds.length > 0 && !standardRoundsRequired,
    maxRounds,
  };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run') || process.argv.includes('--dry');
  if (!dryRun) refuseCapture();
  if (allowSharedSession()) throw new Error('SG_SHARED_SESSION_FORBIDDEN');
  const roundLimit = parseNumberArg(['--round-limit', '--spin-limit', '--normal-limit', '--unknown-special-limit'], UNKNOWN_SPECIAL_ROUND_LIMIT);
  const specialLimit = parseNumberArg(['--special-limit'], Number(process.env.SG_BATCH_SPECIAL_LIMIT || 1));
  const requestedConcurrentGames = parseConcurrencyArg(['--concurrent-games'], BATCH_CONCURRENT_GAMES);
  if (!Number.isFinite(requestedConcurrentGames) || requestedConcurrentGames < 1) throw new Error('SG_EXPLICIT_BOUNDED_CONCURRENCY_REQUIRED');
  const plannerConcurrency = parseNumberArg(['--planner-concurrency'], BATCH_PLANNER_CONCURRENCY);
  const progressIntervalMs = parseNumberArg(
    ['--progress-interval-ms', '--progress-ms'],
    Number(process.env.SG_BATCH_PROGRESS_INTERVAL_MS || 5000),
  );
  const batchReportPath = path.resolve(
    readArgValue('--batch-report') || process.env.SG_BATCH_REPORT_PATH || path.join(__dirname, '..', 'reports', 'sg-batch-capture.json'),
  );
  const gameFilter = parseGameFilter();
  const gameFilterFile = readArgValue('--games-file');
  const limitGames = parseNumberArg(['--limit-games'], 0);
  const retryPersistedSkips = process.argv.includes('--retry-skipped');
  const retryManualSkips = process.argv.includes('--retry-manual-skips');
  if (gameFilterFile) {
    const fileFilter = await parseGameFilterFile(gameFilterFile);
    for (const value of fileFilter) {
      gameFilter.add(value);
    }
  }

  const configuredGames = await loadYamlGames();
  const captureRulesById = await loadCaptureRules();
  const skippedById = await loadPersistedSkippedGames();
  const captureDefaults = resolveCaptureDefaults(configuredGames);
  const configuredById = new Map(configuredGames.map((game) => [game.gameId, game]));
  const metadataEntries = await loadMetadataEntries(configuredGames);
  const staticManifest = await loadStaticManifest();

  let entries = metadataEntries;
  if (gameFilter.size > 0) {
    const baseGameIds = extractBaseGameIdsFromFilter(gameFilter);
    entries = entries.filter((entry) => {
      const id = String(entry.gameId || entry.id || '');
      return (
        gameFilter.has(id) ||
        baseGameIds.has(id) ||
        gameFilter.has(String(entry.name || '')) ||
        gameFilter.has(String(entry.pathSlug || entry.pageSlug || ''))
      );
    });
  }
  if (limitGames > 0) {
    entries = entries.slice(0, limitGames);
  }

  const effectiveSkippedById = new Map(skippedById);
  if (retryPersistedSkips) {
    for (const entry of entries) {
      const gameId = normalizeGameId(entry.gameId || entry.id);
      if (gameId > 0) {
        for (const key of Array.from(effectiveSkippedById.keys())) {
          if (key === skipLedgerKey(gameId) || key.startsWith(`${gameId}:`)) {
            effectiveSkippedById.delete(key);
          }
        }
      }
    }
  }

  if (!entries.length) {
    console.log('no SG games configured');
    return;
  }

  let plans = (
    await mapWithConcurrency(entries, plannerConcurrency, (entry) =>
      buildGamePlans(
        entry,
        configuredById,
        captureRulesById,
        effectiveSkippedById,
        staticManifest,
        captureDefaults,
        roundLimit,
        specialLimit,
        retryManualSkips,
      ),
    )
  ).flat();
  plans = filterPlans(plans, gameFilter).sort(comparePlans);
  for (const plan of plans) {
    if (plan.status === 'skipped' && !skippedById.has(skipLedgerKey(plan.gameId, plan.planKey))) {
      skippedById.set(skipLedgerKey(plan.gameId, plan.planKey), {
        planKey: plan.planKey,
        gameId: plan.gameId,
        name: plan.displayName,
        reason: plan.skipReason || 'skipped',
        source: plan.skipSource || 'manual-rule',
        firstRecordedAt: new Date().toISOString(),
        lastRecordedAt: new Date().toISOString(),
      });
    }
  }
  const pendingPlans = plans.filter((plan) => plan.status === 'pending' && plan.config);
  const backfilledKnownSpecials = dryRun ? 0 : await backfillKnownSpecialFinishes(plans, specialLimit);
  const variantPlanCounts = new Map<number, number>();
  for (const plan of pendingPlans) {
    variantPlanCounts.set(plan.gameId, (variantPlanCounts.get(plan.gameId) || 0) + 1);
  }
  const actualConcurrentGames = Math.min(
    Number.isFinite(requestedConcurrentGames) ? requestedConcurrentGames : pendingPlans.length,
    pendingPlans.length,
  );

  console.log(
    `capture mode: sg-batch games=${plans.length} pending=${plans.filter((plan) => plan.status === 'pending').length} complete=${plans.filter((plan) => plan.status === 'complete').length} missingConfig=${plans.filter((plan) => plan.status === 'missing-config').length} skipped=${plans.filter((plan) => plan.status === 'skipped').length} unknownSpecialMaxRounds=${roundLimit} specialLimit=${specialLimit} concurrentGames=${actualConcurrentGames || 0}${Number.isFinite(requestedConcurrentGames) ? '' : ' (all)'} retryPersistedSkips=${retryPersistedSkips ? '1' : '0'} retryManualSkips=${retryManualSkips ? '1' : '0'}`,
  );
  if (backfilledKnownSpecials > 0) {
    console.log(`[sg] backfilled ${backfilledKnownSpecials} known-special finish marker(s) before capture`);
  }
  // Credentials, operator identifiers and endpoint configuration never enter preflight logs.

  const pendingCount = plans.filter((plan) => plan.status === 'pending').length;
  const completeCount = plans.filter((plan) => plan.status === 'complete').length;
  const missingConfigPlans = plans.filter((plan) => plan.status === 'missing-config');
  const skippedPlans = plans.filter((plan) => plan.status === 'skipped');
  if (pendingCount === 0) {
    console.log(
      `[sg] no pending games to capture. complete=${completeCount}, missingConfig=${missingConfigPlans.length}, skipped=${skippedPlans.length}.`,
    );
    if (missingConfigPlans.length > 0) {
      console.log('[sg] missing-config games were skipped because required GDM fields are absent.');
      console.log(
        `[sg] first skipped games: ${missingConfigPlans
          .slice(0, 8)
          .map((plan) => `${plan.gameId}:${plan.name}`)
          .join(', ')}`,
      );
      console.log('[sg] missing fields are listed in the explicitly requested preflight report.');
    }
  }

  if (skippedPlans.length > 0) {
    console.log(
      `[sg] skipped games: ${skippedPlans
        .slice(0, 8)
        .map((plan) => `${plan.gameId}:${plan.name}`)
        .join(', ')}${skippedPlans.length > 8 ? ' ...' : ''}`,
    );
  }

  if (dryRun) {
    const sessions = new Map<string, Set<number>>();
    for (const plan of plans) {
      if (!plan.config?.sessionId) continue;
      const members = sessions.get(plan.config.sessionId) || new Set<number>();
      members.add(plan.gameId);
      sessions.set(plan.config.sessionId, members);
    }
    const report = {
      schemaVersion: 1, preparationOnly: true, officialRequests: 0,
      generatedAt: new Date().toISOString(), roundLimit, specialLimit,
      requireStandardRounds: requireStandardRounds(),
      requestedConcurrentGames, plannedConcurrentGames: actualConcurrentGames, activeGames: 0,
      distinctGames: new Set(plans.map(p => p.gameId)).size,
      totalPlans: plans.length, pending: pendingCount, complete: completeCount,
      missingConfig: missingConfigPlans.length, skipped: skippedPlans.length,
      crossGameSharedSessionGroups: [...sessions.values()].filter(s => s.size > 1).length,
      sessionFreshnessVerified: false,
      plans: await Promise.all(plans.map(async plan => ({
        gameId: plan.gameId, planKey: plan.planKey, captureKey: plan.captureKey,
        status: plan.status, missingConfig: plan.missingConfig,
        stats: plan.stats, knownSpecialKinds: plan.knownSpecialKinds,
        freeChoiceOptionCount: plan.freeChoiceOptionCount,
        finishMarkerPresent: await hasFinishMarker(plan.captureKey),
        skipCategory: plan.skipSource || null,
        totalCurrent: plan.totalCurrent, totalTarget: plan.totalTarget,
      }))),
    };
    const output = readArgValue('--preflight-report');
    if (output) {
      // Exclusive create prevents overwriting ANY existing report or formal file.
      await fs.writeFile(path.resolve(output), JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    }
    console.log('[sg] preparation only; no capture, import, ledger or marker writes');
    console.log(JSON.stringify({ distinctGames: report.distinctGames, totalPlans: report.totalPlans,
      pending: report.pending, complete: report.complete, missingConfig: report.missingConfig,
      skipped: report.skipped, crossGameSharedSessionGroups: report.crossGameSharedSessionGroups }));
    return;
  }

  const results: Array<Record<string, any>> = [];
  await writeSkippedGames(skippedById);
  await writeReport(batchReportPath, plans, results, roundLimit, specialLimit);

  const progress = new BatchProgress(pendingPlans, roundLimit, specialLimit, progressIntervalMs);
  const perGameLocks = new Map<number, Promise<void>>();
  progress.start();
  try {
    await mapWithConcurrency(pendingPlans, actualConcurrentGames || 1, async (plan, index) => {
      console.log(
        `[scheduler] slot=${index + 1} game=${plan.planKey} completion=${plan.completionRate.toFixed(4)} current=${plan.totalCurrent} target=${plan.totalTarget}`,
      );

      const previousGameLock = perGameLocks.get(plan.gameId) || Promise.resolve();
      let releaseGameLock: () => void = () => {};
      const currentGameLock = new Promise<void>((resolve) => {
        releaseGameLock = resolve;
      });
      perGameLocks.set(plan.gameId, currentGameLock);
      await previousGameLock;

      try {
        if (plan.status !== 'pending') {
          console.log(`[scheduler] skip ${plan.planKey} because plan status is now ${plan.status}`);
          return;
        }

        let activeConfig = { ...plan.config! };
        if ((variantPlanCounts.get(plan.gameId) || 0) > 1) {
          console.log(
            `[scheduler] game ${plan.planKey} is part of a multi-variant capture, refreshing dedicated launch/session before capture`,
          );
          activeConfig = await refreshPlanConfig(plan, activeConfig);
          plan.config = activeConfig;
        }
        let refreshedAfterRuntimeRefresh = false;
        let summary: SGCaptureSummary | null = null;

        while (!summary) {
          try {
            summary = await captureGame(activeConfig, {
              ...buildCaptureOptions(plan, roundLimit, specialLimit),
              onProgress: (item) => progress.update(item),
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (
              !runtimeLaunchRefreshDisabled() &&
              !refreshedAfterRuntimeRefresh &&
              (isSessionInvalidMessage(message) || isCommunicationsFailureMessage(message))
            ) {
              refreshedAfterRuntimeRefresh = true;
              console.warn(
                `[scheduler] game ${plan.planKey} capture failed with session/communications issue, refreshing launch/session and retrying once`,
              );
              activeConfig = await refreshPlanConfig(plan, activeConfig);
              plan.config = activeConfig;
              continue;
            }
            throw error;
          }
        }

        await writeFinish(summary);
        results.push({ planKey: plan.planKey, gameId: plan.gameId, status: 'ok', summary });
        progress.markDone(plan.planKey);
        console.log(`[scheduler] done ${plan.planKey} rounds=${summary.roundCount} stoppedBy=${summary.stoppedBy}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const skipEntry = buildRuntimeFailureSkipEntry(plan, message, skippedById.get(skipLedgerKey(plan.gameId, plan.planKey)));
        plan.status = 'skipped';
        plan.skipReason = skipEntry.reason;
        plan.skipSource = skipEntry.source;
        skippedById.set(skipLedgerKey(plan.gameId, plan.planKey), skipEntry);
        results.push({ planKey: plan.planKey, gameId: plan.gameId, status: 'skipped', message, skipReason: skipEntry.reason, skipSource: skipEntry.source });
        progress.markFailed(plan.planKey);
        console.error(`[scheduler] game ${plan.planKey} skipped after failure: ${message}`);

        if (isFamilyTerminalFailureMessage(message)) {
          for (const sibling of pendingPlans) {
            if (sibling.gameId !== plan.gameId || sibling.planKey === plan.planKey || sibling.status !== 'pending') {
              continue;
            }

            const siblingReason = buildFamilySkipReason(plan.gameId, message);
            const siblingEntry = buildRuntimeFailureSkipEntry(
              sibling,
              message,
              {
                planKey: sibling.planKey,
                gameId: sibling.gameId,
                name: sibling.name,
                reason: siblingReason,
                source: 'runtime-failure',
              },
            );
            sibling.status = 'skipped';
            sibling.skipReason = siblingEntry.reason;
            sibling.skipSource = siblingEntry.source;
            skippedById.set(skipLedgerKey(sibling.gameId, sibling.planKey), siblingEntry);
            results.push({
              planKey: sibling.planKey,
              gameId: sibling.gameId,
              status: 'skipped',
              message,
              skipReason: siblingEntry.reason,
              skipSource: siblingEntry.source,
            });
            progress.markFailed(sibling.planKey);
            console.error(
              `[scheduler] sibling ${sibling.planKey} skipped after family terminal failure on game ${plan.gameId}: ${message}`,
            );
          }
        }

        await writeSkippedGames(skippedById);
      } finally {
        releaseGameLock();
        if (perGameLocks.get(plan.gameId) === currentGameLock) {
          perGameLocks.delete(plan.gameId);
        }
      }
    });
  } finally {
    progress.print('final');
    progress.stop();
    await closeSGBrowserFetchRuntime();
  }

  await writeReport(batchReportPath, plans, results, roundLimit, specialLimit);
  console.log(`[sg] batch report: ${batchReportPath}`);
}

if (require.main === module) {
  main().catch((error) => {
    const code = String(error?.message || '').match(/^SG_[A-Z_]+/)?.[0] || 'SG_PREFLIGHT_FAILED';
    console.error(code + ': raw diagnostics suppressed');
    process.exit(1);
  });
}

export default main;
