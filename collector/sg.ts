import { refuseCapture } from './preparation';
import fs from 'fs-extra';
import path from 'path';
import yaml from 'js-yaml';
import {
  CAPTURE_ROOT,
  MIN_BONUS_ROUNDS,
  ROUND_LIMIT,
  ROUND_STEP_LIMIT,
  SESSION_RETRY_LIMIT,
  UNKNOWN_SPECIAL_ROUND_LIMIT,
} from './config';
import { extractMsgId, extractRoundBalance, parseGDMResponse, parsePayloadParams } from './sg.parse';
import {
  buildRoundDoc,
  classifyPrimaryBonusKind,
  isBonusRound,
  needsFreeGameContinuation,
  resolveFeatureEndCfg,
  resolveFreeChoiceFeatureEndCfg,
  resolveFreeChoiceTriggerPickRequest,
  SGFeaturePickRequest,
  SGPrimaryBonusKind,
  resolveFeaturePickRequest,
  resolveFeatureStartCfg,
  resolveProgressiveFeatureEndCfg,
  resolveProgressiveFeatureInitialPickRequest,
  resolveProgressiveFeaturePickRequest,
  SGMongoDoc,
  SGTrafficEntry,
} from './sg.round';
import {
  SGExtraParams,
  SGGameConfig,
  SGSessionClient,
  SGBetOptions,
  sgBetPayload,
  sgFeatureEndPayload,
  sgFeaturePickPayload,
  sgFeatureStartPayload,
  sgFreeGamePayload,
  sgInitPayload,
  sgReelstripPayload,
} from './sg.http';

interface YamlDoc {
  games: SGGameConfig[];
}

interface RoundStats {
  roundCount: number;
  bonusLikeCount: number;
  freeGameCount: number;
  featureCount: number;
  freeFeatureCount: number;
}

type FreeChoiceOptionHits = Record<number, number>;
type PrimaryBonusCounts = Record<Exclude<SGPrimaryBonusKind, 'none'>, number>;

interface SuccessfulBetTemplate {
  sourceGameId: number;
  captureKey: string;
  buy: number;
  options: SGBetOptions;
}

const successfulBetTemplateCache = new Map<number, SuccessfulBetTemplate[]>();

export type SGSpecialKind = 'freeGame' | 'feature' | 'freeFeature';

export interface SGCaptureOptions {
  targetRounds?: number;
  minBonusRounds?: number;
  minFreeGameRounds?: number;
  minFeatureRounds?: number;
  minFreeFeatureRounds?: number;
  knownSpecialKinds?: SGSpecialKind[];
  minKnownSpecialRounds?: number;
  stopWhenKnownSpecialsCovered?: boolean;
  maxRounds?: number;
  label?: string;
  onProgress?: (progress: SGCaptureProgress) => void;
}

export interface SGCaptureSummary extends RoundStats {
  gameId: number;
  planKey: string;
  captureKey: string;
  variantLabel: string;
  runtimeSlug: string;
  targetRounds: number;
  knownSpecialKinds: SGSpecialKind[];
  freeChoiceOptionCount: number;
  freeChoiceOptionHits: FreeChoiceOptionHits;
  primaryBonusCounts: PrimaryBonusCounts;
  stoppedBy: 'target' | 'known-specials' | 'max-rounds';
  startedAt: string;
  finishedAt: string;
}

export interface SGCaptureProgress extends RoundStats {
  gameId: number;
  planKey: string;
  captureKey: string;
  variantLabel: string;
  runtimeSlug: string;
  targetRounds: number;
  knownSpecialKinds: SGSpecialKind[];
  minKnownSpecialRounds: number;
  freeChoiceOptionCount: number;
  freeChoiceOptionHits: FreeChoiceOptionHits;
  primaryBonusCounts: PrimaryBonusCounts;
  phase: 'start' | 'round' | 'reconnect' | 'complete';
  reconnects: number;
  bet?: number;
  mul?: number;
}

function createEmptyPrimaryBonusCounts(): PrimaryBonusCounts {
  return {
    freeGame: 0,
    feature: 0,
    freeFeature: 0,
  };
}

function clonePrimaryBonusCounts(counts: PrimaryBonusCounts): PrimaryBonusCounts {
  return {
    freeGame: counts.freeGame,
    feature: counts.feature,
    freeFeature: counts.freeFeature,
  };
}

function cloneFreeChoiceOptionHits(hits: Map<number, number>): FreeChoiceOptionHits {
  const result: FreeChoiceOptionHits = {};
  for (const [optionIndex, count] of hits.entries()) {
    result[optionIndex] = count;
  }
  return result;
}

class FreeChoiceRotation {
  private currentOptionIndex = 1;
  private readonly hits = new Map<number, number>();

  constructor(
    private readonly cycleCount: number,
    private readonly coverageCount: number,
    initialHits?: Map<number, number>,
  ) {
    if (initialHits) {
      for (const [optionIndex, count] of initialHits.entries()) {
        this.hits.set(optionIndex, count);
      }

      if (this.coverageCount > 0) {
        for (let optionIndex = 1; optionIndex <= this.coverageCount; optionIndex += 1) {
          if ((this.hits.get(optionIndex) || 0) < 1) {
            this.currentOptionIndex = optionIndex;
            break;
          }
          if (optionIndex === this.coverageCount) {
            this.currentOptionIndex = 1;
          }
        }
      }
    }
  }

  configuredOptionCount(): number {
    return this.coverageCount;
  }

  active(): boolean {
    return this.cycleCount > 0;
  }

  nextChoice(): { optionIndex: number; optionValue: number } {
    const optionIndex = this.active() ? this.currentOptionIndex : 1;
    return {
      optionIndex,
      optionValue: Math.max(0, optionIndex - 1),
    };
  }

  markCaptured(optionIndex: number | null | undefined) {
    if (!this.active()) {
      return;
    }

    const normalized = Number(optionIndex || 0);
    if (!Number.isFinite(normalized) || normalized <= 0) {
      return;
    }

    this.hits.set(normalized, (this.hits.get(normalized) || 0) + 1);
    if (normalized === this.currentOptionIndex) {
      this.currentOptionIndex = this.currentOptionIndex >= this.cycleCount ? 1 : this.currentOptionIndex + 1;
    }
  }

  covered(): boolean {
    if (this.coverageCount <= 0) {
      return true;
    }

    for (let optionIndex = 1; optionIndex <= this.coverageCount; optionIndex += 1) {
      if ((this.hits.get(optionIndex) || 0) < 1) {
        return false;
      }
    }
    return true;
  }

  snapshot(): FreeChoiceOptionHits {
    return cloneFreeChoiceOptionHits(this.hits);
  }
}

function buildReconnectSessionId(baseSessionId: string, runtimeSlug: string, reconnects: number): string {
  const sessionId = String(baseSessionId || '').trim();
  if (!/^Free:/i.test(sessionId)) {
    return sessionId;
  }

  const prefix = sessionId.slice(0, sessionId.indexOf(':') + 1) || 'Free:';
  const seed =
    sessionId
      .slice(prefix.length)
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 12) || runtimeSlug.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) || 'sg';

  const stamp = `${Date.now().toString(36)}${reconnects.toString(36)}`;
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}${seed}${stamp}${random}`;
}

function shouldGenerateFreshFreeSession(): boolean {
  return process.env.SG_FRESH_FREE_SESSION === '1';
}

function resolveReconnectGame(game: SGGameConfig, reconnects: number): SGGameConfig {
  if (!shouldGenerateFreshFreeSession() || process.env.SG_REUSE_SESSION === '1') {
    return game;
  }

  if (reconnects <= 0) {
    return game;
  }

  const sessionId = buildReconnectSessionId(game.sessionId, game.runtimeSlug, reconnects);
  if (!sessionId || sessionId === game.sessionId) {
    return game;
  }

  return {
    ...game,
    sessionId,
  };
}

function isFatalSessionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '');
  return /session id is invalid|invalid session/i.test(message);
}

function matchesConfiguredFatalError(game: SGGameConfig, error: unknown): boolean {
  const patterns = Array.isArray(game.fatalErrorPatterns) ? game.fatalErrorPatterns : [];
  if (!patterns.length) {
    return false;
  }

  const message = error instanceof Error ? error.message : String(error || '');
  return patterns.some((pattern) => {
    try {
      return new RegExp(pattern, 'i').test(message);
    } catch {
      return false;
    }
  });
}

function isFatalProtocolTemplateError(game: SGGameConfig, error: unknown): boolean {
  if (matchesConfiguredFatalError(game, error)) {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error || '');
  return /ERROR_MISSING_PARAMETER|ERROR_LOGICALSLOT|sg bet template exhausted/i.test(message);
}

function isRetryableBetTemplateError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '');
  return /ERROR_LINES|ERROR_BET_DISCRETE|ERROR_BET_LIMITS|ERROR_PARAMETER_VALUE|ERROR_UNKNOWN_PARAMETER|ERROR_GDM_PARAMETERS|ERROR_ANTEBET/i.test(
    message,
  );
}

function matchesConfiguredRetryableTemplateError(game: SGGameConfig, error: unknown): boolean {
  const patterns = Array.isArray(game.retryableTemplateErrorPatterns) ? game.retryableTemplateErrorPatterns : [];
  if (!patterns.length) {
    return false;
  }

  const message = error instanceof Error ? error.message : String(error || '');
  return patterns.some((pattern) => {
    try {
      return new RegExp(pattern, 'i').test(message);
    } catch {
      return false;
    }
  });
}

function resolveCaptureFailureLimitForError(game: SGGameConfig, error: unknown, defaultLimit: number): number {
  if (matchesConfiguredFatalError(game, error)) {
    return 1;
  }
  const message = error instanceof Error ? error.message : String(error || '');
  if (/ERROR_LOGICALSLOT/i.test(message)) {
    return 1;
  }
  if (/ERROR_PROTOCOL_SEQUENCE/i.test(message)) {
    return Math.min(defaultLimit, 6);
  }
  if (isCommunicationsProtocolError(error)) {
    if (isJackpotJesterBuy12Plan(game)) {
      return Math.min(defaultLimit, 6);
    }
    return Math.min(defaultLimit, 2);
  }
  if (/ERROR_ANTEBET/i.test(message)) {
    if (isMerlinSuperbetRuntimeSlug(game.runtimeSlug) || Number(game.buy || 0) >= 10) {
      return 2;
    }
    return Math.min(defaultLimit, 3);
  }
  if (/ERROR_GDM_PARAMETERS/i.test(message) && Number(game.buy || 0) > 0) {
    return Math.min(defaultLimit, 2);
  }
  return defaultLimit;
}

function isCommunicationsProtocolError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '');
  return /ERROR_COMMUNICATIONS|socket hang up|ECONNRESET|ETIMEDOUT|TLS/i.test(message);
}

function resolveInitialBetCommunicationsRetries(game: SGGameConfig): number {
  if (isJackpotJesterBuy12Plan(game)) {
    return 2;
  }
  return 0;
}

function uniquePositiveIntegers(values: unknown[], maxValue = Number.POSITIVE_INFINITY): number[] {
  const result: number[] = [];
  const seen = new Set<number>();
  for (const value of values) {
    const numeric = Math.round(Number(value));
    if (!Number.isFinite(numeric) || numeric <= 0 || numeric > maxValue || seen.has(numeric)) {
      continue;
    }
    seen.add(numeric);
    result.push(numeric);
  }
  return result;
}

function parsePipeIntegers(value: unknown): number[] {
  return uniquePositiveIntegers(String(value || '').split('|'));
}

function inferLineCountFromLimitAndBets(initParams: Record<string, string>, bdValues: number[]): number[] {
  const limitValues = parsePipeIntegers(initParams.LIM);
  if (!limitValues.length || !bdValues.length) {
    return [];
  }

  const maxLimit = Math.max(...limitValues);
  const maxBet = Math.max(...bdValues);
  if (!Number.isFinite(maxLimit) || !Number.isFinite(maxBet) || maxLimit <= 0 || maxBet <= 0) {
    return [];
  }

  const inferred = maxLimit / maxBet;
  if (!Number.isInteger(inferred) || inferred <= 0) {
    return [];
  }
  return uniquePositiveIntegers([inferred], 500);
}

function parseCpLineBetCandidates(value: unknown): number[] {
  return uniquePositiveIntegers(
    String(value || '')
      .split('|')
      .map((row) => row.split(';')[2]),
    500,
  );
}

function parseSssPlsLineBetCandidates(value: unknown): number[] {
  const text = String(value || '').trim();
  if (!text) {
    return [];
  }

  const counts: number[] = [];
  for (const section of text.split('#')) {
    const [rawName, rawRows = ''] = section.split('~');
    if (String(rawName || '').trim().toUpperCase() !== 'PLS') {
      continue;
    }
    const rowCount = rawRows.split('|').map((row) => row.trim()).filter(Boolean).length;
    if (rowCount > 0) {
      counts.push(rowCount);
    }
  }
  return uniquePositiveIntegers(counts, 500);
}

function parseFirstPipeScalar(value: unknown): string | number | null {
  const raw = String(value || '').trim();
  if (!raw) {
    return null;
  }
  const token = raw.split('|', 1)[0]?.trim() || '';
  if (!token) {
    return null;
  }
  const numeric = Number(token);
  if (Number.isFinite(numeric)) {
    return Number.isInteger(numeric) ? Math.round(numeric) : numeric;
  }
  return token;
}

function cloneExtraParams(extraParams: SGExtraParams | undefined): SGExtraParams | undefined {
  if (!extraParams || typeof extraParams !== 'object') {
    return undefined;
  }
  return { ...extraParams };
}

function mergeExtraParams(
  current: SGExtraParams | undefined,
  template: SGExtraParams | undefined,
): SGExtraParams | undefined {
  const merged: SGExtraParams = {
    ...(current || {}),
    ...(template || {}),
  };
  return Object.keys(merged).length > 0 ? merged : undefined;
}

function isTruthyExtraParam(value: unknown): boolean {
  if (value === true) {
    return true;
  }
  if (typeof value === 'number') {
    return value > 0;
  }
  return /^(?:true|1|yes|y)$/i.test(String(value || '').trim());
}

function usesBuyInFeature(options: SGBetOptions): boolean {
  const extraParams = options.extraParams || {};
  for (const [key, value] of Object.entries(extraParams)) {
    if (String(key || '').trim().toLowerCase() === 'buyin' && isTruthyExtraParam(value)) {
      return true;
    }
  }
  return false;
}

const KNOWN_BET_PARAM_KEYS = new Set(
  ['GN', 'PID', 'MSGID', 'BPL', 'LB', 'BPR', 'RB', 'AP', 'ABPM', 'ANTEBET', 'ABET', 'ANTE', 'RSC', 'REC', 'GSD'].map(
    (key) => key.toUpperCase(),
  ),
);

function extractUnknownBetParams(params: Record<string, string>): SGExtraParams | undefined {
  const extraParams: SGExtraParams = {};
  for (const [rawKey, rawValue] of Object.entries(params)) {
    const key = String(rawKey || '').trim();
    if (!key || KNOWN_BET_PARAM_KEYS.has(key.toUpperCase())) {
      continue;
    }
    const value = String(rawValue || '').trim();
    if (!value) {
      continue;
    }
    extraParams[key] = value;
  }
  return Object.keys(extraParams).length > 0 ? extraParams : undefined;
}

function deriveInitExtraParams(initParams: Record<string, string>): SGExtraParams | undefined {
  void initParams;
  // INIT payload fields such as ABM / ABRSC describe current frontend state,
  // but they are not part of the outbound BET / FREE_GAME protocol template.
  // Echoing them back causes families like Lightning Gorilla to diverge from
  // the real client request shape and eventually fail protocol sequence.
  return undefined;
}

function lineBetFallbackValues(): number[] {
  return [25, 20, 10, 5, 3, 1, 2, 4, 12, 15, 30, 40, 50, 60, 75, 100];
}

function normalizeRuntimeSlugValue(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function isMerlinSuperbetRuntimeSlug(value: unknown): boolean {
  return /merlinsmillionssuperbet/i.test(normalizeRuntimeSlugValue(value));
}

function isQuickHitLinkRuntimeSlug(value: unknown): boolean {
  return /quickhitlinkfire/i.test(normalizeRuntimeSlugValue(value));
}

function hasPaywaysProtocol(initParams: Record<string, string>): boolean {
  const rawSss = String(initParams.SSS || '').trim().toUpperCase();
  return String(initParams.RBM || '').trim() !== '' || rawSss.includes('WAYSPAY~');
}

function parseProtocolLineCounts(initParams: Record<string, string>): number[] {
  const result: number[] = [];
  const seen = new Set<number>();

  const pushCount = (count: unknown) => {
    const numeric = Math.round(Number(count));
    if (!Number.isFinite(numeric) || numeric <= 0 || seen.has(numeric)) {
      return;
    }
    seen.add(numeric);
    result.push(numeric);
  };

  const parseShapeListCount = (value: unknown) => {
    const raw = String(value || '');
    if (!raw.includes('~')) {
      return;
    }
    const [, shapes = ''] = raw.split('~', 2);
    const parts = shapes
      .split('|')
      .map((part) => part.trim())
      .filter(Boolean);
    pushCount(parts.length);
  };

  parseShapeListCount(initParams.PLS);
  parseShapeListCount(initParams.CPLS);

  const rawSss = String(initParams.SSS || '');
  if (rawSss.includes('~')) {
    for (const segment of rawSss.split('#')) {
      const trimmed = segment.trim();
      if (/^(?:PLS|CPLS)~/i.test(trimmed)) {
        parseShapeListCount(trimmed);
      }
    }
  }

  return result;
}

function captureRootDir(): string {
  return path.join(__dirname, CAPTURE_ROOT);
}

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

function parseSuccessfulBetOptions(requestPayload: string): SGBetOptions | null {
  const params = parsePayloadParams(String(requestPayload || ''));
  if (String(params.MSGID || '').trim().toUpperCase() !== 'BET') {
    return null;
  }

  const hasBpr = Object.prototype.hasOwnProperty.call(params, 'BPR');
  const hasRb = Object.prototype.hasOwnProperty.call(params, 'RB');
  const hasBpl = Object.prototype.hasOwnProperty.call(params, 'BPL');
  const hasLb = Object.prototype.hasOwnProperty.call(params, 'LB');
  const hasAp = Object.prototype.hasOwnProperty.call(params, 'AP');
  const hasAbpm = Object.prototype.hasOwnProperty.call(params, 'ABPM');
  const hasGsd = Object.prototype.hasOwnProperty.call(params, 'GSD');
  const hasRsc = Object.prototype.hasOwnProperty.call(params, 'RSC');
  const hasRec = Object.prototype.hasOwnProperty.call(params, 'REC');
  const hasDiscreteFields = hasLb && !hasBpl && !hasBpr && !hasRb;
  const hasLineFields = hasBpl || (hasLb && !hasDiscreteFields);
  const hasBaseFields = hasBpr || hasRb;
  const betMode: SGBetOptions['betMode'] = hasDiscreteFields
    ? 'discrete'
    : hasLineFields
      ? 'lines'
      : hasBaseFields
        ? 'payways'
        : 'lines';

  const option: SGBetOptions = {
    betMode,
  };

  if (hasBpl) {
    const value = Math.round(Number(params.BPL));
    if (Number.isFinite(value) && value > 0) {
      option.betPerLine = value;
    }
  }
  if (hasLb) {
    const value = Math.round(Number(params.LB));
    if (Number.isFinite(value) && value > 0) {
      option.lineBet = value;
    }
    option.includeLineBet = true;
  } else if (betMode === 'lines') {
    option.includeLineBet = false;
  }
  if (hasBpr) {
    const value = Math.round(Number(params.BPR));
    if (Number.isFinite(value) && value > 0) {
      option.baseBet = value;
      option.includeBaseBet = true;
    }
  }
  if (hasRb) {
    const value = Math.round(Number(params.RB));
    if (Number.isFinite(value) && value > 0) {
      option.reelsSelected = value;
      option.includeReelsSelected = true;
    }
  }
  if (hasAp) {
    option.includeAutoPlay = true;
    option.autoPlay = String(params.AP || '').trim().toLowerCase() === 'true';
  } else {
    option.includeAutoPlay = false;
  }
  if (hasAbpm) {
    option.includeAbpm = true;
    const value = Math.round(Number(params.ABPM));
    if (Number.isFinite(value) && value >= 0) {
      option.abpm = value;
    }
  }
  if (hasGsd) {
    const value = String(params.GSD || '').trim();
    if (value) {
      option.gsd = value;
    }
  }
  if (hasRsc) {
    option.includeRsc = true;
    const value = Math.round(Number(params.RSC));
    if (Number.isFinite(value) && value >= 0) {
      option.rsc = value;
    }
  }
  if (hasRec) {
    option.includeRec = true;
    const value = Math.round(Number(params.REC));
    if (Number.isFinite(value) && value >= 0) {
      option.rec = value;
    }
  }
  const explicitAnteBet = Math.round(Number(params.ANTEBET || params.ABET || params.ANTE || 0));
  if (Number.isFinite(explicitAnteBet) && explicitAnteBet > 0) {
    option.anteBet = explicitAnteBet;
    option.includeAnteBet = true;
  }
  option.extraParams = extractUnknownBetParams(params);

  return option;
}

function cloneBetTemplateForCurrent(current: SGBetOptions, template: SGBetOptions): SGBetOptions {
  const merged: SGBetOptions = {
    ...current,
    ...template,
    extraParams: mergeExtraParams(current.extraParams, template.extraParams),
  };

  if (merged.betMode === 'lines') {
    if (merged.includeBaseBet !== true) {
      delete merged.baseBet;
    }
    if (merged.includeReelsSelected !== true) {
      delete merged.reelsSelected;
    }
  } else if (merged.betMode === 'discrete') {
    delete merged.betPerLine;
    delete merged.baseBet;
    delete merged.reelsSelected;
  } else if (merged.betMode === 'payways') {
    delete merged.betPerLine;
    delete merged.lineBet;
    if (template.includeLineBet !== true) {
      delete merged.includeLineBet;
    }
  }

  const currentAbpm = Math.round(Number(current.abpm || 0));
  const currentAnteBet = Math.round(Number(current.anteBet || 0));
  const templateAbpm = Math.round(Number(template.abpm || 0));
  const templateAnteBet = Math.round(Number(template.anteBet || 0));
  const templateIncludeAbpm = template.includeAbpm === true;
  const templateHasExplicitEnhanced =
    templateIncludeAbpm ||
    (Number.isFinite(templateAbpm) && templateAbpm > 0) ||
    (Number.isFinite(templateAnteBet) && templateAnteBet > 0);

  if (!templateHasExplicitEnhanced && Number.isFinite(currentAbpm) && currentAbpm > 0) {
    merged.abpm = currentAbpm;
  }
  if (!templateHasExplicitEnhanced && Number.isFinite(currentAnteBet) && currentAnteBet > 0) {
    merged.anteBet = currentAnteBet;
  }
  if (template.includeAnteBet === true) {
    merged.includeAnteBet = true;
  }
  if (template.includeRec === true) {
    merged.includeRec = true;
  }

  return merged;
}

function normalizeEnhancedValue(value: unknown): number {
  const numeric = Math.round(Number(value || 0));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function buildFixedBetTemplateCandidates(
  game: SGGameConfig,
  current: SGBetOptions,
  templateOverride?: SGBetOptions[],
): SGBetOptions[] {
  const templates = Array.isArray(templateOverride) ? templateOverride : Array.isArray(game.fixedBetTemplates) ? game.fixedBetTemplates : [];
  if (!templates.length) {
    return [];
  }

  const currentBuy = Math.round(Number(game.buy || 0));
  const currentEnhanced = normalizeEnhancedValue(current.abpm ?? current.anteBet);
  const currentRsc = Math.round(Number(current.rsc || 0));
  const forcedBetMode = game.forceBetMode || current.betMode;
  const hasBuySpecificTemplates =
    currentBuy > 0 && templates.some((template) => Math.round(Number(template.matchBuy ?? 0)) === currentBuy);
  const results: SGBetOptions[] = [];
  const seen = new Set<string>();

  const modeCompatible = (template: SGBetOptions): boolean => {
    const templateMatchBuy = Math.round(Number(template.matchBuy ?? 0));
    if (templateMatchBuy > 0 && templateMatchBuy !== currentBuy) {
      return false;
    }
    if (templateMatchBuy === 0 && currentBuy > 0 && template.matchBuy === 0) {
      return false;
    }
    if (hasBuySpecificTemplates && currentBuy > 0 && (template.matchBuy === undefined || template.matchBuy === null)) {
      return false;
    }
    if (!forcedBetMode) {
      return true;
    }
    return String(template.betMode || forcedBetMode).trim() === forcedBetMode;
  };

  const templateEnhancedValue = (template: SGBetOptions): number =>
    normalizeEnhancedValue(template.abpm ?? template.anteBet);
  const templateRscValue = (template: SGBetOptions): number => Math.round(Number(template.rsc || 0));

  const push = (template: SGBetOptions) => {
    if (!modeCompatible(template)) {
      return;
    }

    const candidate = cloneBetTemplateForCurrent(current, template);
    const key = JSON.stringify(candidate);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    results.push(candidate);
  };

  if (currentBuy > 0 || currentEnhanced > 0) {
    const exactEnhanced = templates.filter(
      (template) =>
        templateEnhancedValue(template) === currentEnhanced &&
        currentEnhanced > 0 &&
        (currentRsc <= 0 || templateRscValue(template) === currentRsc),
    );
    const exactRscEnhanced = templates.filter(
      (template) => templateEnhancedValue(template) > 0 && currentRsc > 0 && templateRscValue(template) === currentRsc,
    );
    const genericEnhanced = templates.filter((template) => templateEnhancedValue(template) > 0);
    const normalTemplates = templates.filter((template) => templateEnhancedValue(template) <= 0);

    for (const template of exactEnhanced) push(template);
    for (const template of exactRscEnhanced) push(template);
    for (const template of genericEnhanced) push(template);
    for (const template of normalTemplates) push(template);
    return results;
  }

  const normalTemplates = templates.filter((template) => templateEnhancedValue(template) <= 0);
  for (const template of normalTemplates) push(template);
  for (const template of templates) push(template);
  return results;
}

function loadSuccessfulBetTemplates(game: SGGameConfig): SuccessfulBetTemplate[] {
  const gameId = Number(game.gameId || 0);
  if (!Number.isFinite(gameId) || gameId <= 0) {
    return [];
  }

  const cached = successfulBetTemplateCache.get(gameId);
  if (cached) {
    return cached;
  }

  const root = captureRootDir();
  if (!fs.existsSync(root)) {
    successfulBetTemplateCache.set(gameId, []);
    return [];
  }

  const sourceGameIds = uniquePositiveIntegers([gameId, ...(Array.isArray(game.templateSourceGameIds) ? game.templateSourceGameIds : [])]);
  const templates: SuccessfulBetTemplate[] = [];
  const seen = new Set<string>();
  const directories = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) =>
      sourceGameIds.some((sourceGameId) => name === String(sourceGameId) || name.startsWith(`${sourceGameId}_buy_`)),
    )
    .sort((left, right) => left.localeCompare(right));

  for (const captureKey of directories) {
    const sourceGameId =
      sourceGameIds.find((value) => captureKey === String(value) || captureKey.startsWith(`${value}_buy_`)) || gameId;
    const buy = parseBuyFromCaptureKey(captureKey, sourceGameId);
    const pushTemplate = (requestPayload: string) => {
      const options = parseSuccessfulBetOptions(String(requestPayload || ''));
      if (!options) {
        return;
      }
      const key = `${captureKey}:${JSON.stringify(options)}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      templates.push({
        sourceGameId,
        captureKey,
        buy,
        options,
      });
    };

    const roundsPath = path.join(root, captureKey, 'rounds.jsonl');
    if (fs.existsSync(roundsPath)) {
      let rawRounds = '';
      try {
        rawRounds = fs.readFileSync(roundsPath, 'utf8');
      } catch {
        rawRounds = '';
      }

      for (const line of rawRounds.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }

        try {
          const parsed = JSON.parse(trimmed) as {
            data?: {
              steps?: Array<{
                msgId?: string;
                requestPayload?: string;
                responsePayload?: string;
              }>;
            };
          };
          const steps = Array.isArray(parsed?.data?.steps) ? parsed.data.steps : [];
          for (const step of steps) {
            if (String(step?.msgId || '').trim().toUpperCase() !== 'BET') {
              continue;
            }
            const responseParams = parsePayloadParams(String(step?.responsePayload || ''));
            if (String(responseParams.MSGID || '').trim().toUpperCase() !== 'BET') {
              continue;
            }
            pushTemplate(String(step?.requestPayload || ''));
          }
        } catch {
          // Ignore malformed round rows.
        }
      }
    }

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
        pushTemplate(String(parsed.requestPayload || ''));
      } catch {
        // Ignore malformed traffic rows.
      }
    }
  }

  successfulBetTemplateCache.set(gameId, templates);
  return templates;
}

function buildSeededBetCandidates(game: SGGameConfig, current: SGBetOptions): SGBetOptions[] {
  const templates = loadSuccessfulBetTemplates(game);
  if (!templates.length) {
    return [];
  }

  const currentCaptureKey = String(game.captureKey || game.gameId);
  const currentBuy = Math.round(Number(game.buy || 0));
  const currentAbpm = Math.round(Number(current.abpm ?? current.anteBet ?? 0));
  const currentRsc = Math.round(Number(current.rsc ?? 0));
  const forcedBetMode = game.forceBetMode || current.betMode;
  const results: SGBetOptions[] = [];
  const seen = new Set<string>();

  const modeCompatible = (template: SuccessfulBetTemplate): boolean => {
    if (!forcedBetMode) {
      return true;
    }
    const templateMode = template.options.betMode || 'lines';
    return templateMode === forcedBetMode;
  };

  const push = (template: SuccessfulBetTemplate) => {
    const candidate = cloneBetTemplateForCurrent(
      { ...current, runtimeSlug: (game as unknown as { runtimeSlug?: string }).runtimeSlug } as SGBetOptions,
      template.options,
    );
    const key = JSON.stringify(candidate);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    results.push(candidate);
  };

  const sortJackpotJesterBuy12Templates = (items: SuccessfulBetTemplate[]): SuccessfulBetTemplate[] => {
    if (!isJackpotJesterBuy12Plan(game)) {
      return items;
    }
    return [...items].sort((left, right) => {
      const leftScore = scoreJackpotJesterWarmState(String(left.options.gsd || ''));
      const rightScore = scoreJackpotJesterWarmState(String(right.options.gsd || ''));
      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }
      const leftHasGsd = String(left.options.gsd || '').trim() ? 1 : 0;
      const rightHasGsd = String(right.options.gsd || '').trim() ? 1 : 0;
      return rightHasGsd - leftHasGsd;
    });
  };

  const exact = templates.filter((template) => template.captureKey === currentCaptureKey && modeCompatible(template));
  const siblingEnhanced = templates.filter(
    (template) => template.captureKey !== currentCaptureKey && template.buy > 0 && modeCompatible(template),
  );
  const siblingNormal = templates.filter(
    (template) => template.captureKey !== currentCaptureKey && template.buy === 0 && modeCompatible(template),
  );
  const matchesRsc = (template: SuccessfulBetTemplate): boolean => {
    if (currentRsc <= 0) {
      return true;
    }
    return Math.round(Number(template.options.rsc || 0)) === currentRsc;
  };
  const matchesEnhancedValue = (template: SuccessfulBetTemplate): boolean => {
    const templateEnhanced = Math.round(Number(template.options.abpm ?? template.options.anteBet ?? 0));
    if (currentAbpm > 0) {
      return templateEnhanced === currentAbpm;
    }
    return templateEnhanced <= 0;
  };

  if (currentBuy > 0 || currentAbpm > 0) {
    for (const template of sortJackpotJesterBuy12Templates(exact.filter((item) => matchesEnhancedValue(item) && matchesRsc(item)))) push(template);
    for (const template of sortJackpotJesterBuy12Templates(siblingEnhanced.filter((item) => item.buy === currentBuy && matchesEnhancedValue(item) && matchesRsc(item)))) push(template);
    for (const template of sortJackpotJesterBuy12Templates(exact.filter(matchesEnhancedValue))) push(template);
    for (const template of sortJackpotJesterBuy12Templates(siblingEnhanced.filter((item) => item.buy === currentBuy && matchesEnhancedValue(item)))) push(template);
    } else {
    for (const template of exact.filter((item) => item.buy === 0)) push(template);
    for (const template of siblingNormal) push(template);
    for (const template of exact) push(template);
    for (const template of templates) push(template);
  }

  return results;
}

function hasSuccessfulTemplateForCurrentPlan(game: SGGameConfig, current: SGBetOptions): boolean {
  const templates = loadSuccessfulBetTemplates(game);
  if (!templates.length) {
    return false;
  }

  const currentCaptureKey = String(game.captureKey || game.gameId);
  const currentBuy = Math.round(Number(game.buy || 0));
  const currentAbpm = Math.round(Number(current.abpm ?? current.anteBet ?? 0));
  const currentRsc = Math.round(Number(current.rsc ?? 0));
  const forcedBetMode = game.forceBetMode || current.betMode;

  return templates.some((template) => {
    if (template.captureKey !== currentCaptureKey) {
      return false;
    }
    const templateMode = template.options.betMode || 'lines';
    if (forcedBetMode && templateMode !== forcedBetMode) {
      return false;
    }
    if (currentBuy > 0 && template.buy !== currentBuy) {
      return false;
    }
    const templateEnhanced = Math.round(Number(template.options.abpm ?? template.options.anteBet ?? 0));
    if (currentAbpm > 0 && templateEnhanced !== currentAbpm) {
      return false;
    }
    if (currentRsc > 0 && Math.round(Number(template.options.rsc || 0)) !== currentRsc) {
      return false;
    }
    return true;
  });
}

function deriveLineModeCandidates(game: SGGameConfig, initParams: Record<string, string>) {
  const bdValues = parsePipeIntegers(initParams.BD);
  const cpLineBetCandidates = parseCpLineBetCandidates(initParams.CP);
  const plsLineBetCandidates = parseSssPlsLineBetCandidates(initParams.SSS);
  const inferredLineBetCandidates = inferLineCountFromLimitAndBets(initParams, bdValues);
  const strictBetPerLineCandidates = uniquePositiveIntegers(Array.isArray(game.strictBetPerLineCandidates) ? game.strictBetPerLineCandidates : [], 20);
  const strictLineBetCandidates = uniquePositiveIntegers(Array.isArray(game.strictLineBetCandidates) ? game.strictLineBetCandidates : [], 500);
  const strictBaseBetCandidates = uniquePositiveIntegers(Array.isArray(game.strictBaseBetCandidates) ? game.strictBaseBetCandidates : [], 5000);
  const strictReelsSelectedCandidates = uniquePositiveIntegers(Array.isArray(game.strictReelsSelectedCandidates) ? game.strictReelsSelectedCandidates : [], 12);
  const betPerLineCandidates = uniquePositiveIntegers(
    strictBetPerLineCandidates.length
      ? strictBetPerLineCandidates
      : [
          ...(Array.isArray(game.betPerLineCandidates) ? game.betPerLineCandidates : []),
          game.betPerLine,
          initParams.BDD,
          ...bdValues.filter((value) => value <= 500),
          isQuickHitLinkRuntimeSlug(game.runtimeSlug) ? 1 : undefined,
          1,
          2,
          3,
          4,
          5,
        ],
    20,
  );
  const lineBetCandidates = uniquePositiveIntegers(
    strictLineBetCandidates.length
      ? strictLineBetCandidates
      : [
          ...(Array.isArray(game.lineBetCandidates) ? game.lineBetCandidates : []),
          game.lineBet,
          ...inferredLineBetCandidates,
          ...cpLineBetCandidates,
          ...plsLineBetCandidates,
          ...lineBetFallbackValues(),
          ...bdValues.filter((value) => value <= 100 && value % 5 === 0),
        ],
    500,
  );
  const baseBetCandidates = uniquePositiveIntegers(
    strictBaseBetCandidates.length
      ? strictBaseBetCandidates
      : [
          ...(Array.isArray(game.baseBetCandidates) ? game.baseBetCandidates : []),
          game.baseBet,
          initParams.BDD,
          ...bdValues.filter((value) => value <= 200),
        ],
    5000,
  );
  const reelsSelectedCandidates = uniquePositiveIntegers(
    strictReelsSelectedCandidates.length
      ? strictReelsSelectedCandidates
      : [
          ...(Array.isArray(game.reelsSelectedCandidates) ? game.reelsSelectedCandidates : []),
          game.reelsSelected,
          5,
          6,
        ],
    12,
  );

  game.betMode = 'lines';
  game.betPerLineCandidates = betPerLineCandidates;
  game.lineBetCandidates = lineBetCandidates;
  game.baseBetCandidates = baseBetCandidates;
  game.reelsSelectedCandidates = reelsSelectedCandidates;
  if (!Number.isFinite(Number(game.betPerLine)) && betPerLineCandidates.length > 0) {
    game.betPerLine = betPerLineCandidates[0];
  }
  if (!Number.isFinite(Number(game.lineBet)) && lineBetCandidates.length > 0) {
    game.lineBet = lineBetCandidates[0];
  }
  if (!Number.isFinite(Number(game.baseBet)) && baseBetCandidates.length > 0) {
    game.baseBet = baseBetCandidates[0];
  }
  if (!Number.isFinite(Number(game.reelsSelected)) && reelsSelectedCandidates.length > 0) {
    game.reelsSelected = reelsSelectedCandidates[0];
  }
}

function deriveDiscreteModeCandidates(game: SGGameConfig, initParams: Record<string, string>) {
  const bdValues = parsePipeIntegers(initParams.BD);
  const strictLineBetCandidates = uniquePositiveIntegers(
    Array.isArray(game.strictLineBetCandidates) ? game.strictLineBetCandidates : [],
    5000,
  );
  const lineBetCandidates = uniquePositiveIntegers(
    strictLineBetCandidates.length
      ? strictLineBetCandidates
      : [
          ...(Array.isArray(game.lineBetCandidates) ? game.lineBetCandidates : []),
          game.lineBet,
          initParams.BDD,
          ...bdValues,
        ],
    5000,
  );

  game.betMode = 'discrete';
  game.lineBetCandidates = lineBetCandidates;
  delete game.betPerLineCandidates;
  delete game.baseBetCandidates;
  delete game.reelsSelectedCandidates;
  delete game.betPerLine;
  delete game.baseBet;
  delete game.reelsSelected;
  if (!Number.isFinite(Number(game.lineBet)) && lineBetCandidates.length > 0) {
    game.lineBet = lineBetCandidates[0];
  }
}

function derivePaywaysCandidates(game: SGGameConfig, initParams: Record<string, string>) {
  const reelMultipliers = parsePipeIntegers(initParams.RBM);
  const reelMultiplierValues = uniquePositiveIntegers(reelMultipliers, 5000);
  const bdValues = parsePipeIntegers(initParams.BD);
  const strictBaseBetCandidates = uniquePositiveIntegers(Array.isArray(game.strictBaseBetCandidates) ? game.strictBaseBetCandidates : [], 5000);
  const strictReelsSelectedCandidates = uniquePositiveIntegers(Array.isArray(game.strictReelsSelectedCandidates) ? game.strictReelsSelectedCandidates : [], 5000);
  const protocolWays = uniquePositiveIntegers(
    [
      ...reelMultiplierValues,
      reelMultipliers.length,
      initParams.RC,
      initParams.BDD,
      5,
      6,
    ],
    5000,
  );
  const reelsSelectedCandidates = uniquePositiveIntegers(
    strictReelsSelectedCandidates.length
      ? strictReelsSelectedCandidates
      : [
          ...protocolWays,
          game.reelsSelected,
          ...(Array.isArray(game.reelsSelectedCandidates) ? game.reelsSelectedCandidates : []),
        ],
    5000,
  );
  const baseBetCandidates = uniquePositiveIntegers(
    strictBaseBetCandidates.length
      ? strictBaseBetCandidates
      : [
          ...(Array.isArray(game.baseBetCandidates) ? game.baseBetCandidates : []),
          game.baseBet,
          initParams.BDD,
          ...bdValues.filter((value) => value <= 200),
        ],
    5000,
  );

  game.betMode = 'payways';
  game.reelsSelectedCandidates = reelsSelectedCandidates;
  game.baseBetCandidates = baseBetCandidates;
  const shouldAdoptProtocolReels =
    !strictReelsSelectedCandidates.length && reelMultipliers.length > 1 && reelsSelectedCandidates.length > 0;
  if ((!Number.isFinite(Number(game.reelsSelected)) || shouldAdoptProtocolReels) && reelsSelectedCandidates.length > 0) {
    game.reelsSelected = reelsSelectedCandidates[0];
  }
  if (!Number.isFinite(Number(game.baseBet)) && baseBetCandidates.length > 0) {
    game.baseBet = baseBetCandidates[0];
  }
}

function buildBetAttemptCandidates(game: SGGameConfig, preferSpecialTemplates = false): SGBetOptions[] {
    const current: SGBetOptions = {
      autoPlay: game.autoPlay,
      includeAutoPlay: true,
      includeLineBet: true,
      betPerLine: game.betPerLine,
    lineBet: game.lineBet,
    betMode: game.forceBetMode ?? game.betMode,
      baseBet: game.baseBet,
      reelsSelected: game.reelsSelected,
      abpm: game.abpm,
      anteBet: game.anteBet,
      rsc: game.rsc,
      rec: game.rec,
      includeAbpm: Number.isFinite(Number(game.abpm)) && Number(game.abpm) >= 0,
      includeRsc: game.includeRsc,
      includeRec: game.includeRec,
      extraParams: cloneExtraParams(game.extraParams),
    };
  const results: SGBetOptions[] = [];
  const seen = new Set<string>();
  const pushCandidate = (candidate: SGBetOptions) => {
    const normalized: SGBetOptions = {
      autoPlay: candidate.autoPlay,
      includeAutoPlay: candidate.includeAutoPlay,
      includeLineBet: candidate.includeLineBet,
      betPerLine: candidate.betPerLine,
      lineBet: candidate.lineBet,
      betMode: candidate.betMode,
      baseBet: candidate.baseBet,
      reelsSelected: candidate.reelsSelected,
      abpm: candidate.abpm,
      anteBet: candidate.anteBet,
      rsc: candidate.rsc,
      rec: candidate.rec,
      includeAbpm: candidate.includeAbpm,
      includeAnteBet: candidate.includeAnteBet,
      includeRsc: candidate.includeRsc,
      includeRec: candidate.includeRec,
      gsd: candidate.gsd,
      extraParams: cloneExtraParams(candidate.extraParams),
    };
    const key = JSON.stringify(normalized);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    results.push(normalized);
  };

  const seededCandidates = buildSeededBetCandidates(game, current);
  const fixedCandidates = buildFixedBetTemplateCandidates(game, current);
  const specialCandidates = preferSpecialTemplates
    ? buildFixedBetTemplateCandidates(game, current, Array.isArray(game.specialBetTemplates) ? game.specialBetTemplates : [])
    : [];
  const prioritizeSeededCandidates =
    isJackpotJesterBuy12Plan(game) && hasSuccessfulTemplateForCurrentPlan(game, current);

  if (prioritizeSeededCandidates) {
    for (const candidate of specialCandidates) {
      pushCandidate(candidate);
    }
    for (const candidate of seededCandidates) {
      pushCandidate(candidate);
    }
  } else {
    for (const candidate of specialCandidates) {
      pushCandidate(candidate);
    }
    for (const candidate of fixedCandidates) {
      pushCandidate(candidate);
    }
    for (const candidate of seededCandidates) {
      pushCandidate(candidate);
    }
  }

  const currentMode = current.betMode || game.betMode || 'lines';
  if (currentMode === 'payways') {
    pushCandidate({ ...current, includeAutoPlay: false });
  }
  pushCandidate(current);

  if (
    (game.preferTemplateSourceOnly || game.disableGenericBetSearch) &&
    (specialCandidates.length > 0 || fixedCandidates.length > 0 || seededCandidates.length > 0)
  ) {
    return results.slice(0, (current.betMode || 'lines') === 'payways' ? 16 : 32);
  }

  if (current.betMode === 'discrete') {
    const lineBetCandidates = uniquePositiveIntegers(
      [
        ...(Array.isArray(game.lineBetCandidates) ? game.lineBetCandidates : []),
        current.lineBet,
      ],
      5000,
    );
    for (const lineBet of lineBetCandidates) {
      pushCandidate({
        ...current,
        betMode: 'discrete',
        lineBet,
        includeLineBet: true,
        betPerLine: undefined,
        baseBet: undefined,
        reelsSelected: undefined,
        includeBaseBet: false,
        includeReelsSelected: false,
      });
      pushCandidate({
        ...current,
        betMode: 'discrete',
        lineBet,
        includeLineBet: false,
        betPerLine: undefined,
        baseBet: undefined,
        reelsSelected: undefined,
        includeBaseBet: false,
        includeReelsSelected: false,
      });
    }
    return results.slice(0, 16);
  }

  if (isMerlinSuperbetRuntimeSlug(game.runtimeSlug) && (Number(current.abpm || 0) > 0 || Number(current.anteBet || 0) > 0)) {
    const enhancedCandidates = uniquePositiveIntegers(
      [
        current.abpm,
        current.anteBet,
        game.abpm,
        game.anteBet,
        game.enhancedBetLevel,
      ],
      10000,
    );
    for (const value of enhancedCandidates) {
      pushCandidate({ ...current, abpm: value, anteBet: current.anteBet || value });
      pushCandidate({ ...current, abpm: undefined, anteBet: value });
      if (Number(current.lineBet || 0) > 0 && value !== Number(current.lineBet || 0)) {
        pushCandidate({ ...current, lineBet: value, abpm: current.abpm, anteBet: current.anteBet || value });
      }
    }
  }

  if ((game.betMode || 'lines') === 'payways') {
    const baseBetCandidates = uniquePositiveIntegers(
      [
        ...(Array.isArray(game.baseBetCandidates) ? game.baseBetCandidates : []),
        current.baseBet,
      ],
      5000,
    ).slice(0, 8);
    const reelsSelectedCandidates = uniquePositiveIntegers(
      [
        ...(Array.isArray(game.reelsSelectedCandidates) ? game.reelsSelectedCandidates : []),
        current.reelsSelected,
      ],
      5000,
    ).slice(0, 4);

    for (const baseBet of baseBetCandidates) {
      pushCandidate({ ...current, baseBet });
      pushCandidate({ ...current, baseBet, includeAutoPlay: false });
    }
    for (const reelsSelected of reelsSelectedCandidates) {
      pushCandidate({ ...current, reelsSelected });
      pushCandidate({ ...current, reelsSelected, includeAutoPlay: false });
    }
    for (const baseBet of baseBetCandidates.slice(0, 4)) {
      for (const reelsSelected of reelsSelectedCandidates.slice(0, 3)) {
        pushCandidate({ ...current, baseBet, reelsSelected });
        pushCandidate({ ...current, baseBet, reelsSelected, includeAutoPlay: false });
      }
    }
    return results.slice(0, 32);
  }

  const betPerLineCandidates = uniquePositiveIntegers(
    [
      ...(Array.isArray(game.betPerLineCandidates) ? game.betPerLineCandidates : []),
      current.betPerLine,
    ],
    20,
  ).slice(0, 8);
  const lineBetCandidates = uniquePositiveIntegers(
    [
      ...(Array.isArray(game.lineBetCandidates) ? game.lineBetCandidates : []),
      current.lineBet,
    ],
    500,
  ).slice(0, 12);

  for (const lineBet of lineBetCandidates) {
    pushCandidate({ ...current, lineBet });
  }
  for (const betPerLine of betPerLineCandidates) {
    pushCandidate({ ...current, betPerLine });
  }
  for (const betPerLine of betPerLineCandidates.slice(0, 5)) {
    for (const lineBet of lineBetCandidates.slice(0, 8)) {
      pushCandidate({ ...current, betPerLine, lineBet });
    }
  }
  pushCandidate({ ...current, includeAutoPlay: false });
  pushCandidate({ ...current, includeLineBet: false });
  pushCandidate({ ...current, includeAutoPlay: false, includeLineBet: false });
  for (const lineBet of lineBetCandidates.slice(0, 6)) {
    pushCandidate({ ...current, includeAutoPlay: false, lineBet });
    pushCandidate({ ...current, includeLineBet: false, lineBet });
  }
  for (const betPerLine of betPerLineCandidates.slice(0, 4)) {
    pushCandidate({ ...current, includeAutoPlay: false, betPerLine });
    pushCandidate({ ...current, includeLineBet: false, betPerLine });
  }
  for (const betPerLine of betPerLineCandidates.slice(0, 4)) {
    for (const lineBet of lineBetCandidates.slice(0, 6)) {
      pushCandidate({ ...current, includeAutoPlay: false, betPerLine, lineBet });
      pushCandidate({ ...current, includeLineBet: false, betPerLine, lineBet });
    }
  }
  return results.slice(0, 32);
}

function describeBetTemplate(candidate: SGBetOptions): string {
  const parts = [
    `mode=${candidate.betMode || 'lines'}`,
    `bpl=${candidate.betPerLine || 0}`,
    `lb=${candidate.lineBet || 0}`,
    `bpr=${candidate.baseBet || 0}`,
    `rb=${candidate.reelsSelected || 0}`,
    `abpm=${candidate.includeAbpm === false ? 'omit' : Number(candidate.abpm || 0)}`,
    `ante=${candidate.includeAnteBet === false ? 'omit' : Number(candidate.anteBet || 0)}`,
    `rsc=${candidate.includeRsc === false ? 'omit' : Number(candidate.rsc || 0)}`,
    `rec=${candidate.includeRec === false ? 'omit' : Number(candidate.rec || 0)}`,
    `ap=${candidate.includeAutoPlay === false ? 'omit' : candidate.autoPlay ? 'true' : 'false'}`,
    `line=${candidate.includeLineBet === false ? 'omit' : candidate.lineBet || 0}`,
  ];
  const gsd = String(candidate.gsd || '').trim();
  if (gsd) {
    parts.push(`gsd=${gsd}`);
  }
  return parts.join(' ');
}

function prependUniqueBetCandidates(existing: SGBetOptions[], prefix: SGBetOptions[]): SGBetOptions[] {
  const seen = new Set<string>();
  const result: SGBetOptions[] = [];
  for (const candidate of [...prefix, ...existing]) {
    const key = JSON.stringify(candidate);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(candidate);
  }
  return result;
}

function isJackpotJesterBuy12Plan(game: SGGameConfig): boolean {
  return game.gameId === 32559 && Math.round(Number(game.buy || 0)) === 12;
}

type JackpotJesterBuy12WarmCacheEntry = {
  sessionId: string;
  betCandidates: SGBetOptions[];
};

const jackpotJesterBuy12WarmCache = new WeakMap<SGGameConfig, JackpotJesterBuy12WarmCacheEntry>();

function cloneBetCandidates(candidates: SGBetOptions[]): SGBetOptions[] {
  return candidates.map((candidate) => ({
    ...candidate,
    extraParams: cloneExtraParams(candidate.extraParams),
  }));
}

function parseGsdState(gsd: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const segment of String(gsd || '').split('#')) {
    const trimmed = segment.trim();
    if (!trimmed || !trimmed.includes('~')) {
      continue;
    }
    const [key, value = ''] = trimmed.split('~', 2);
    const normalizedKey = key.trim().toUpperCase();
    if (!normalizedKey) {
      continue;
    }
    result[normalizedKey] = value.trim();
  }
  return result;
}

function parseGsdIntField(gsdState: Record<string, string>, key: string): number {
  const numeric = Number(gsdState[String(key || '').trim().toUpperCase()] || 0);
  return Number.isFinite(numeric) ? Math.round(numeric) : 0;
}

function isJackpotJesterWarmStateReady(gsd: string): boolean {
  const state = parseGsdState(gsd);
  const sgs = parseGsdIntField(state, 'SGS');
  const sgm = parseGsdIntField(state, 'SGM');
  const sgmi = parseGsdIntField(state, 'SGMI');
  const jwa = parseGsdIntField(state, 'JWA');
  return sgs >= 1 && (jwa > 0 || sgm >= 100 || sgmi >= 100);
}

function scoreJackpotJesterWarmState(gsd: string): number {
  const state = parseGsdState(gsd);
  const sgs = parseGsdIntField(state, 'SGS');
  const sgm = parseGsdIntField(state, 'SGM');
  const sgmi = parseGsdIntField(state, 'SGMI');
  return sgs * 1_000_000_000 + sgmi * 1_000_000 + sgm * 1_000;
}

function buildJackpotJesterWarmupCandidates(game: SGGameConfig): SGBetOptions[] {
  const current: SGBetOptions = {
    autoPlay: game.autoPlay,
    includeAutoPlay: true,
    includeLineBet: true,
    betPerLine: game.betPerLine,
    lineBet: game.lineBet,
    betMode: game.forceBetMode ?? game.betMode ?? 'lines',
    abpm: 15,
    includeAbpm: true,
  };
  const warmupGame: SGGameConfig = {
    ...game,
    buy: 11,
    enhancedBetLevel: 15,
    enhancedBetLabel: 'warmup buy=11 abpm=15',
    abpm: 15,
    rsc: undefined,
    includeRsc: false,
  };
  const fixed = buildFixedBetTemplateCandidates(warmupGame, current);
  if (fixed.length > 0) {
    return fixed;
  }
  return [current];
}

async function warmupJackpotJesterBuy12Session(
  gameDir: string,
  game: SGGameConfig,
  client: SGSessionClient,
  startingBalance: number,
  forceRefresh = false,
): Promise<{ balance: number; betCandidates: SGBetOptions[] }> {
  if (!isJackpotJesterBuy12Plan(game)) {
    return { balance: startingBalance, betCandidates: [] };
  }

  if (!forceRefresh) {
    const cachedWarmup = jackpotJesterBuy12WarmCache.get(game);
    if (cachedWarmup && String(cachedWarmup.sessionId || '') === String(game.sessionId || '') && cachedWarmup.betCandidates.length > 0) {
      return { balance: startingBalance, betCandidates: cloneBetCandidates(cachedWarmup.betCandidates) };
    }
  }

  const currentPlan: SGBetOptions = {
    autoPlay: game.autoPlay,
    includeAutoPlay: true,
    includeLineBet: true,
    betPerLine: game.betPerLine,
    lineBet: game.lineBet,
    betMode: game.forceBetMode ?? game.betMode,
    baseBet: game.baseBet,
    reelsSelected: game.reelsSelected,
    abpm: game.abpm,
    anteBet: game.anteBet,
    rsc: game.rsc,
    rec: game.rec,
    includeAbpm: Number.isFinite(Number(game.abpm)) && Number(game.abpm) >= 0,
    includeRsc: game.includeRsc,
    includeRec: game.includeRec,
    extraParams: cloneExtraParams(game.extraParams),
  };

  const warmupCandidates = buildJackpotJesterWarmupCandidates(game);
  const maxWarmupSpins = Math.max(16, Math.min(96, Number(process.env.SG_BUY12_WARMUP_SPINS || 48)));
  for (const warmupCandidate of warmupCandidates.slice(0, 4)) {
    let latestGsd = '';
    let latestBalance = startingBalance;
    let latestBetPerLine = Number(warmupCandidate.betPerLine || game.betPerLine || 5);
    let latestLineBet = Number(warmupCandidate.lineBet || game.lineBet || 50);
    let ready = false;
    let bestGsd = '';
    let bestBalance = latestBalance;
    let bestBetPerLine = latestBetPerLine;
    let bestLineBet = latestLineBet;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (let spinIndex = 0; spinIndex < maxWarmupSpins; spinIndex += 1) {
      const payload = sgBetPayload(game, warmupCandidate);
      let responseXml = '';
      try {
        responseXml = await client.bet(warmupCandidate);
        await recordExchange(gameDir, game.serverAddress, 'processGameMessage', payload, responseXml);
        const parsed = assertSuccessfulResponse(responseXml);
        const responseParams = parsePayloadParams(parsed.payload || '');
        if (String(responseParams.MSGID || '').trim().toUpperCase() !== 'BET') {
          continue;
        }

        latestGsd = String(responseParams.GSD || '').trim() || latestGsd;
        latestBalance = extractRoundBalance(parsed) ?? latestBalance;
        latestBetPerLine = Number(responseParams.BPL || latestBetPerLine || 5);
        latestLineBet = Number(warmupCandidate.lineBet || latestLineBet || game.lineBet || 50);
        const score = scoreJackpotJesterWarmState(latestGsd);
        if (latestGsd && score >= bestScore) {
          bestScore = score;
          bestGsd = latestGsd;
          bestBalance = latestBalance;
          bestBetPerLine = latestBetPerLine;
          bestLineBet = latestLineBet;
        }
        ready = isJackpotJesterWarmStateReady(latestGsd);
        console.log(
          `[sg] ${game.gameId} buy12 warmup spin=${spinIndex + 1}/${maxWarmupSpins} ${describeBetTemplate(warmupCandidate)} gsd=${latestGsd || '-'} balance=${latestBalance} ready=${ready}`,
        );
      } catch (error) {
        await recordFailedExchange(
          gameDir,
          game.serverAddress,
          'processGameMessage',
          payload,
          responseXml || extractErrorResponseXml(error),
          error,
        );
        const message = error instanceof Error ? error.message : String(error);
        console.warn(
          `[sg] ${game.gameId} buy12 warmup retry after ${message} spin=${spinIndex + 1}/${maxWarmupSpins} ${describeBetTemplate(warmupCandidate)}`,
        );
        if (bestGsd && isCommunicationsProtocolError(error)) {
          break;
        }
      }
    }

    const resolvedGsd = bestGsd || latestGsd;
    const resolvedBalance = bestGsd ? bestBalance : latestBalance;
    const resolvedBetPerLine = bestGsd ? bestBetPerLine : latestBetPerLine;
    const resolvedLineBet = bestGsd ? bestLineBet : latestLineBet;

    if (!resolvedGsd) {
      continue;
    }

    const gsdCandidates = [
      {
        ...warmupCandidate,
        betPerLine: resolvedBetPerLine,
        lineBet: resolvedLineBet,
        abpm: 95,
        includeAbpm: true,
        anteBet: undefined,
        includeAnteBet: false,
        rsc: 1,
        includeRsc: true,
        gsd: resolvedGsd,
      },
      {
        ...warmupCandidate,
        betPerLine: resolvedBetPerLine,
        lineBet: resolvedLineBet,
        abpm: 95,
        includeAbpm: true,
        anteBet: undefined,
        includeAnteBet: false,
        includeRsc: false,
        rsc: undefined,
        gsd: resolvedGsd,
      },
    ];

    console.log(
      `[sg] ${game.gameId} buy12 warmup accepted ${describeBetTemplate(warmupCandidate)} gsd=${resolvedGsd || '-'} balance=${resolvedBalance} ready=${ready} bestScore=${bestScore}`,
    );
    jackpotJesterBuy12WarmCache.set(game, {
      sessionId: String(game.sessionId || ''),
      betCandidates: cloneBetCandidates(gsdCandidates),
    });
    return { balance: resolvedBalance, betCandidates: gsdCandidates };
  }

  return { balance: startingBalance, betCandidates: [] };
}

function sessionReadyRetries(): number {
  const value = Number(process.env.SG_SESSION_READY_RETRIES || 24);
  return Number.isFinite(value) && value >= 0 ? value : 24;
}

function sessionReadyDelayMs(): number {
  const value = Number(process.env.SG_SESSION_READY_DELAY_MS || 5000);
  return Number.isFinite(value) && value >= 0 ? value : 5000;
}

function invalidSessionRetries(): number {
  const value = Number(process.env.SG_INVALID_SESSION_RETRIES || 2);
  return Number.isFinite(value) && value >= 0 ? value : 2;
}

function invalidSessionDelayMs(): number {
  const value = Number(process.env.SG_INVALID_SESSION_DELAY_MS || 1000);
  return Number.isFinite(value) && value >= 0 ? value : 1000;
}

function captureFailureLimit(): number {
  const value = Number(process.env.SG_CAPTURE_FAILURE_LIMIT || 12);
  return Number.isFinite(value) && value > 0 ? value : 12;
}

function isResetMode(): boolean {
  return process.argv.includes('--reset') || process.env.SG_RESET === '1';
}

function normalizeFreeChoiceOptionCount(value: unknown): number {
  const count = Number(value);
  if (!Number.isFinite(count)) {
    return 0;
  }

  const rounded = Math.round(count);
  return rounded > 0 ? rounded : 0;
}

function resolveFreeChoiceOptionCount(game: SGGameConfig): number {
  if (game.freeChoiceOptionCount !== undefined && game.freeChoiceOptionCount !== null) {
    return normalizeFreeChoiceOptionCount(game.freeChoiceOptionCount);
  }
  if (String(process.env.SG_FREE_CHOICE_OPTION_COUNT || '').trim() !== '') {
    return normalizeFreeChoiceOptionCount(process.env.SG_FREE_CHOICE_OPTION_COUNT);
  }
  if (String(process.env.SG_PICKER_OPTION_COUNT || '').trim() !== '') {
    return normalizeFreeChoiceOptionCount(process.env.SG_PICKER_OPTION_COUNT);
  }
  return 0;
}

function resolveEnhancedBetMeta(game: SGGameConfig): {
  buy: number;
  enhancedBetLevel: number;
  enhancedBetLabel: string;
} {
  const configuredBuy = Math.max(0, Math.round(Number(game.buy || 0)));
  const configuredLevel = Math.max(0, Math.round(Number(game.enhancedBetLevel || 0)));
  const configuredLabel = String(game.enhancedBetLabel || '').trim();
  const options = Array.isArray(game.enhancedBetOptions) ? game.enhancedBetOptions : [];

  if (configuredBuy > 0) {
    const matched = options.find((option) => Math.round(Number(option?.buy || 0)) === configuredBuy);
    if (matched) {
      return {
        buy: configuredBuy,
        enhancedBetLevel: Math.max(0, Math.round(Number(matched.level || configuredLevel || 0))),
        enhancedBetLabel: String(matched.label || configuredLabel || '').trim(),
      };
    }
  }

  return {
    buy: configuredBuy,
    enhancedBetLevel: configuredLevel,
    enhancedBetLabel: configuredLabel,
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

function isBonusLikeDoc(doc: SGMongoDoc): boolean {
  return readPrimaryBonusKind(doc) !== 'none';
}

function isFreeGameDoc(doc: SGMongoDoc): boolean {
  const kind = readPrimaryBonusKind(doc);
  return kind === 'freeGame' || kind === 'freeFeature';
}

function isFeatureDoc(doc: SGMongoDoc): boolean {
  const kind = readPrimaryBonusKind(doc);
  return kind === 'feature' || kind === 'freeFeature';
}

function isFreeFeatureDoc(doc: SGMongoDoc): boolean {
  return readPrimaryBonusKind(doc) === 'freeFeature';
}

function readPrimaryBonusKind(doc: SGMongoDoc): SGPrimaryBonusKind {
  const value = String(doc?.data?.primaryBonusKind || '').trim();
  if (value === 'freeGame' || value === 'feature' || value === 'freeFeature') {
    return value;
  }
  return classifyPrimaryBonusKind(Array.isArray(doc?.data?.steps) ? (doc.data.steps as SGTrafficEntry[]) : []);
}

async function sleep(ms: number) {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function appendJsonLine(filePath: string, value: unknown) {
  await fs.ensureDir(path.dirname(filePath));
  await fs.appendFile(filePath, JSON.stringify(value) + '\n', 'utf8');
}

async function removeIfExists(filePath: string) {
  if (await fs.pathExists(filePath)) {
    await fs.remove(filePath);
  }
}

async function loadCaptureState(roundsPath: string): Promise<{
  stats: RoundStats;
  primaryBonusCounts: PrimaryBonusCounts;
  freeChoiceOptionHits: Map<number, number>;
}> {
  if (!(await fs.pathExists(roundsPath))) {
    return {
      stats: { roundCount: 0, bonusLikeCount: 0, freeGameCount: 0, featureCount: 0, freeFeatureCount: 0 },
      primaryBonusCounts: createEmptyPrimaryBonusCounts(),
      freeChoiceOptionHits: new Map<number, number>(),
    };
  }

  const raw = await fs.readFile(roundsPath, 'utf8');
  let roundCount = 0;
  let bonusLikeCount = 0;
  let freeGameCount = 0;
  let featureCount = 0;
  let freeFeatureCount = 0;
  const primaryBonusCounts = createEmptyPrimaryBonusCounts();
  const freeChoiceOptionHits = new Map<number, number>();
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    roundCount += 1;
    try {
      const doc = JSON.parse(trimmed) as SGMongoDoc;
      if (isBonusLikeDoc(doc)) {
        bonusLikeCount += 1;
      }
      if (isFreeGameDoc(doc)) {
        freeGameCount += 1;
      }
      if (isFeatureDoc(doc)) {
        featureCount += 1;
      }
      if (isFreeFeatureDoc(doc)) {
        freeFeatureCount += 1;
      }
      const primaryBonusKind = readPrimaryBonusKind(doc);
      if (primaryBonusKind !== 'none') {
        primaryBonusCounts[primaryBonusKind] += 1;
      }
      const freeChoiceOptionIndex = Number(doc?.data?.freeChoiceOptionIndex || 0);
      if (Number.isFinite(freeChoiceOptionIndex) && freeChoiceOptionIndex > 0) {
        freeChoiceOptionHits.set(freeChoiceOptionIndex, (freeChoiceOptionHits.get(freeChoiceOptionIndex) || 0) + 1);
      }
    } catch {
      // Ignore broken legacy lines when resuming.
    }
  }

  return {
    stats: { roundCount, bonusLikeCount, freeGameCount, featureCount, freeFeatureCount },
    primaryBonusCounts,
    freeChoiceOptionHits,
  };
}

function normalizeSpecialKinds(values: unknown[]): SGSpecialKind[] {
  const result = new Set<SGSpecialKind>();
  for (const value of values) {
    const normalized = String(value || '').trim().toLowerCase().replace(/[_\-\s]+/g, '');
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

function knownSpecialKindsFromEnv(): SGSpecialKind[] {
  return normalizeSpecialKinds(
    String(process.env.SG_KNOWN_SPECIAL_KINDS || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function knownSpecialsCovered(stats: RoundStats, kinds: SGSpecialKind[], minRounds: number): boolean {
  if (!kinds.length) {
    return false;
  }

  const target = Math.max(1, minRounds);
  return kinds.every((kind) => {
    if (kind === 'freeGame') {
      return stats.freeGameCount >= target;
    }
    if (kind === 'feature') {
      return stats.featureCount >= target;
    }
    if (kind === 'freeFeature') {
      return stats.freeFeatureCount >= target;
    }
    return false;
  });
}

function shouldContinueCapture(
  stats: RoundStats,
  options: Required<
    Pick<
      SGCaptureOptions,
      'targetRounds' | 'minBonusRounds' | 'minFreeGameRounds' | 'minFeatureRounds' | 'minFreeFeatureRounds' | 'knownSpecialKinds' | 'minKnownSpecialRounds' | 'stopWhenKnownSpecialsCovered' | 'maxRounds'
    >
  >,
  freeChoiceCovered: boolean,
): boolean {
  if (options.maxRounds > 0 && stats.roundCount >= options.maxRounds) {
    return false;
  }

  const targetReached =
    stats.roundCount >= options.targetRounds &&
    stats.bonusLikeCount >= options.minBonusRounds &&
    stats.freeGameCount >= options.minFreeGameRounds &&
    stats.featureCount >= options.minFeatureRounds &&
    stats.freeFeatureCount >= options.minFreeFeatureRounds;

  if (process.env.SG_STOP_WHEN_FREE_CHOICE_COVERED === '1') {
    return !(targetReached && freeChoiceCovered);
  }

  if (options.stopWhenKnownSpecialsCovered && options.knownSpecialKinds.length > 0) {
    return !(targetReached && knownSpecialsCovered(stats, options.knownSpecialKinds, options.minKnownSpecialRounds) && freeChoiceCovered);
  }

  return !targetReached;
}

function resolveCaptureOptions(game: SGGameConfig, options: SGCaptureOptions = {}) {
  const knownSpecialKinds = options.knownSpecialKinds?.length
    ? normalizeSpecialKinds(options.knownSpecialKinds)
    : normalizeSpecialKinds(
        [
          ...(Array.isArray(game.knownSpecialKinds) ? game.knownSpecialKinds : String(game.knownSpecialKinds || '').split(',')),
          ...(Array.isArray(game.specialKinds) ? game.specialKinds : String(game.specialKinds || '').split(',')),
          ...knownSpecialKindsFromEnv(),
        ].map((value) => String(value || '').trim()),
      );

  const readNumber = (explicit: number | undefined, envValue: string | undefined, fallback: number) => {
    if (explicit !== undefined && explicit !== null) {
      return Number(explicit);
    }
    if (envValue !== undefined && envValue !== null && String(envValue).trim() !== '') {
      return Number(envValue);
    }
    return Number(fallback);
  };

  return {
    targetRounds: readNumber(options.targetRounds, process.env.SG_ROUND_LIMIT, game.roundCount ?? ROUND_LIMIT),
    minBonusRounds: readNumber(options.minBonusRounds, process.env.SG_MIN_BONUS_ROUNDS, game.minBonusRounds ?? MIN_BONUS_ROUNDS),
    minFreeGameRounds: readNumber(options.minFreeGameRounds, process.env.SG_MIN_FREE_GAME_ROUNDS, game.minFreeGameRounds ?? 0),
    minFeatureRounds: readNumber(options.minFeatureRounds, process.env.SG_MIN_FEATURE_ROUNDS, 0),
    minFreeFeatureRounds: readNumber(
      options.minFreeFeatureRounds,
      process.env.SG_MIN_FREE_FEATURE_ROUNDS,
      game.minFreeFeatureRounds ?? 0,
    ),
    knownSpecialKinds,
    minKnownSpecialRounds: readNumber(options.minKnownSpecialRounds, process.env.SG_MIN_KNOWN_SPECIAL_ROUNDS, 1),
    stopWhenKnownSpecialsCovered:
      options.stopWhenKnownSpecialsCovered ?? process.env.SG_STOP_WHEN_SPECIALS_COVERED === '1',
    maxRounds: readNumber(options.maxRounds, process.env.SG_MAX_ROUNDS, game.roundCount ?? UNKNOWN_SPECIAL_ROUND_LIMIT),
  };
}

async function appendTraffic(gameDir: string, entry: SGTrafficEntry) {
  await appendJsonLine(path.join(gameDir, 'traffic.jsonl'), entry);

  if (entry.methodName === 'processGameMessage' && entry.msgId === 'BET') {
    await fs.appendFile(path.join(gameDir, 'spin.0.txt'), entry.responseXml.replace(/\s+/g, ' ').trim() + '\n', 'utf8');
    return;
  }

  if (entry.methodName === 'processGameMessage' && entry.msgId) {
    const fileName = `${entry.msgId.toLowerCase()}.txt`;
    await fs.appendFile(path.join(gameDir, fileName), entry.responseXml.replace(/\s+/g, ' ').trim() + '\n', 'utf8');
  }
}

function assertSuccessfulResponse(responseXml: string) {
  const parsed = parseGDMResponse(responseXml);
  if (!parsed.success || parsed.ogsRc !== '0') {
    const reason = parsed.errorMessage || parsed.errorCode || parsed.ogsRc || 'unknown SG response error';
    throw new Error(`sg gdm failed: ${reason}`);
  }

  const payloadParams = parsePayloadParams(parsed.payload || '');
  if (payloadParams.MSGID === 'ERROR') {
    throw new Error(`sg protocol failed: ${payloadParams.EID || payloadParams.ERRORCODE || 'unknown payload error'}`);
  }
  return parsed;
}

async function recordExchange(
  gameDir: string,
  serverAddress: string,
  methodName: string,
  requestPayload: string,
  responseXml: string,
): Promise<SGTrafficEntry> {
  let parsed: ReturnType<typeof assertSuccessfulResponse>;
  try {
    parsed = assertSuccessfulResponse(responseXml);
  } catch (error) {
    await recordFailedExchange(gameDir, serverAddress, methodName, requestPayload, responseXml, error);
    throw error;
  }

  const entry: SGTrafficEntry = {
    ts: nowIso(),
    url: `https://${serverAddress.replace(/\/+$/, '')}/`,
    methodName,
    msgId: extractMsgId(requestPayload),
    requestPayload,
    responsePayload: parsed.payload || '',
    responseBalance: extractRoundBalance(parsed),
    responseXml,
  };

  await appendTraffic(gameDir, entry);
  return entry;
}

function isProtocolSequenceError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '');
  return /ERROR_PROTOCOL_SEQUENCE/i.test(message);
}

async function recordFeatureEndIfAccepted(
  gameDir: string,
  game: SGGameConfig,
  client: SGSessionClient,
  cfg: number,
): Promise<SGTrafficEntry | null> {
  const payload = sgFeatureEndPayload(game, cfg);
  let responseXml = '';

  try {
    responseXml = await client.featureEnd(cfg);
    return await recordExchange(gameDir, game.serverAddress, 'processGameMessage', payload, responseXml);
  } catch (error) {
    if (!responseXml) {
      await recordFailedExchange(gameDir, game.serverAddress, 'processGameMessage', payload, extractErrorResponseXml(error), error);
    }
    if (isProtocolSequenceError(error)) {
      console.warn(`[sg] ${game.gameId} FEATURE_END cfg=${cfg} rejected with protocol sequence; keeping prior feature result`);
      return null;
    }
    throw error;
  }
}

function rememberFeatureMaxPickCounts(params: Record<string, string>, featureMaxPickCounts: Map<number, number>): void {
  for (const [key, rawValue] of Object.entries(params)) {
    const match = key.match(/^FTV_(\d+)$/);
    if (!match) {
      continue;
    }

    const cfg = Number(match[1]);
    const parts = String(rawValue || '').split(';');
    const maxPicks = Math.round(Number(parts[1] || 0));
    if (!Number.isFinite(cfg) || cfg < 0 || !Number.isFinite(maxPicks) || maxPicks <= 0) {
      continue;
    }

    const previous = Math.round(Number(featureMaxPickCounts.get(cfg) || 0));
    featureMaxPickCounts.set(cfg, Math.max(previous, maxPicks));
  }
}

function extractErrorResponseXml(error: unknown): string {
  const responseData = (error as { response?: { data?: unknown } } | null)?.response?.data;
  return typeof responseData === 'string' ? responseData : '';
}

async function recordFailedExchange(
  gameDir: string,
  serverAddress: string,
  methodName: string,
  requestPayload: string,
  responseXml: string,
  error: unknown,
): Promise<void> {
  const parsed = responseXml ? parseGDMResponse(responseXml) : null;
  const errorMessage = error instanceof Error ? error.message : String(error || '');
  const entry = {
    ts: nowIso(),
    url: `https://${serverAddress.replace(/\/+$/, '')}/`,
    methodName,
    msgId: extractMsgId(requestPayload),
    requestPayload,
    responsePayload: parsed?.payload || '',
    responseXml,
    errorMessage,
  };

  await fs.ensureDir(gameDir);
  await fs.appendFile(path.join(gameDir, 'failed-exchanges.jsonl'), `${JSON.stringify(entry)}\n`, 'utf8');
}

async function bootstrapSession(gameDir: string, game: SGGameConfig): Promise<{ client: SGSessionClient; balance: number }> {
  const client = new SGSessionClient(game);
  let balanceXml = '';
  let balanceParsed: ReturnType<typeof assertSuccessfulResponse> | null = null;
  let balanceFailure: unknown = null;
  try {
    balanceXml = await client.getBalance();
    balanceParsed = assertSuccessfulResponse(balanceXml);
  } catch (error) {
    balanceFailure = error;
    const message = error instanceof Error ? error.message : String(error || '');
    console.warn(`[sg] ${game.gameId} getBalance bootstrap failed, continuing with INIT/REELSTRIP fallback: ${message}`);
  }

  const initPayload = sgInitPayload(game);
  const initXml = await client.init();
  const initParsed = assertSuccessfulResponse(initXml);
  const initParams = parsePayloadParams(initParsed.payload || '');
  const forcedBetMode = game.forceBetMode;
  if (forcedBetMode === 'payways') {
    derivePaywaysCandidates(game, initParams);
    game.baseBet = Number(initParams.BDD || game.baseBet || game.betPerLine || 5);
    game.reelsSelected = game.reelsSelected || 6;
  } else if (forcedBetMode === 'discrete') {
    deriveDiscreteModeCandidates(game, initParams);
  } else if (forcedBetMode === 'lines') {
    deriveLineModeCandidates(game, initParams);
  } else if (hasPaywaysProtocol(initParams)) {
    derivePaywaysCandidates(game, initParams);
    game.baseBet = Number(initParams.BDD || game.baseBet || game.betPerLine || 5);
    game.reelsSelected = game.reelsSelected || 6;
  } else {
    deriveLineModeCandidates(game, initParams);
  }
  game.extraParams = mergeExtraParams(game.extraParams, deriveInitExtraParams(initParams));

  const reelstripPayload = sgReelstripPayload(game);
  const reelstripXml = await client.reelstrip();
  assertSuccessfulResponse(reelstripXml);

  await fs.ensureDir(gameDir);
  if (!(await fs.pathExists(path.join(gameDir, 'balance.xml')))) {
    await fs.writeFile(path.join(gameDir, 'balance.xml'), balanceXml, 'utf8');
  }
  if (!(await fs.pathExists(path.join(gameDir, 'init.xml')))) {
    await fs.writeFile(path.join(gameDir, 'init.xml'), initXml, 'utf8');
  }
  if (!(await fs.pathExists(path.join(gameDir, 'reelstrip.xml')))) {
    await fs.writeFile(path.join(gameDir, 'reelstrip.xml'), reelstripXml, 'utf8');
  }

  if (balanceParsed) {
    await recordExchange(gameDir, game.serverAddress, 'getBalance', '', balanceXml);
  }
  const initEntry = await recordExchange(gameDir, game.serverAddress, 'processGameMessage', initPayload, initXml);
  await recordExchange(gameDir, game.serverAddress, 'processGameMessage', reelstripPayload, reelstripXml);

  const balance = initEntry.responseBalance ?? extractRoundBalance(balanceParsed || initParsed);
  if (balance === undefined) {
    if (balanceFailure) {
      const message = balanceFailure instanceof Error ? balanceFailure.message : String(balanceFailure || '');
      console.warn(`[sg] ${game.gameId} could not derive bootstrap balance after getBalance failure: ${message}`);
    }
    throw new Error(`cannot resolve initial SG balance for ${game.runtimeSlug}`);
  }

  return { client, balance };
}

async function bootstrapSessionWhenReady(
  gameDir: string,
  game: SGGameConfig,
  onRetry: (attempt: number, maxAttempts: number, delayMs: number, error: unknown) => void,
): Promise<{ client: SGSessionClient; balance: number }> {
  const retries = Math.min(sessionReadyRetries(), invalidSessionRetries());
  const delayMs = Math.min(sessionReadyDelayMs(), invalidSessionDelayMs());
  const maxAttempts = retries + 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await bootstrapSession(gameDir, game);
    } catch (error) {
      if (!isFatalSessionError(error) || attempt >= maxAttempts) {
        throw error;
      }

      onRetry(attempt, maxAttempts, delayMs, error);
      await sleep(delayMs);
    }
  }

  throw new Error(`[sg] ${game.runtimeSlug} session readiness retry exhausted`);
}

async function playRound(
  gameDir: string,
  game: SGGameConfig,
  client: SGSessionClient,
  preBalance: number,
  freeChoiceRotation: FreeChoiceRotation,
  preferSpecialTemplates = false,
): Promise<{ doc: SGMongoDoc; finalBalance: number; bonusLike: boolean }> {
  const entries: SGTrafficEntry[] = [];
  const startedCfgs = new Set<number>();
  const featureMaxPickCounts = new Map<number, number>();
  let pendingFeaturePick: SGFeaturePickRequest | null = null;
  let lastStartedFeatureCfg: number | null = null;
  let selectedFreeChoiceOptionIndex = 0;
  let effectivePreBalance = preBalance;
  const defaultSpinOptions = {
    autoPlay: game.autoPlay,
    betPerLine: game.betPerLine,
    lineBet: game.lineBet,
    betMode: game.betMode,
    baseBet: game.baseBet,
    reelsSelected: game.reelsSelected,
    abpm: game.abpm,
    anteBet: game.anteBet,
  };
  let betCandidates = buildBetAttemptCandidates(game, preferSpecialTemplates);
  const warmup = await warmupJackpotJesterBuy12Session(gameDir, game, client, effectivePreBalance);
  effectivePreBalance = warmup.balance;
  if (warmup.betCandidates.length > 0) {
    if (isJackpotJesterBuy12Plan(game)) {
      betCandidates = warmup.betCandidates;
    } else {
      betCandidates = prependUniqueBetCandidates(betCandidates, warmup.betCandidates);
    }
  }
  let chosenSpinOptions = defaultSpinOptions;
  let firstBetEntry: SGTrafficEntry | null = null;
  let lastTemplateError = '';
  const initialBetCommunicationsRetries = resolveInitialBetCommunicationsRetries(game);
  let buy12WarmRefreshRetries = 0;
  const maxBuy12WarmRefreshRetries = isJackpotJesterBuy12Plan(game) ? 2 : 0;

  for (let index = 0; index < betCandidates.length; index += 1) {
    const candidate = betCandidates[index];
    const payload = sgBetPayload(game, candidate);
    let communicationsRetries = 0;
    let restartBetCandidates = false;
    while (true) {
      let responseXml = '';
      try {
        responseXml = await client.bet(candidate);
        const entry = await recordExchange(gameDir, game.serverAddress, 'processGameMessage', payload, responseXml);
        chosenSpinOptions = { ...chosenSpinOptions, ...candidate };
        firstBetEntry = entry;
        game.betPerLine = chosenSpinOptions.betPerLine;
        game.lineBet = chosenSpinOptions.lineBet;
        game.baseBet = chosenSpinOptions.baseBet;
        game.reelsSelected = chosenSpinOptions.reelsSelected;
        game.abpm = chosenSpinOptions.abpm;
        game.anteBet = chosenSpinOptions.anteBet;
        if (index > 0) {
          console.log(
            `[sg] ${game.gameId} fallback bet template accepted ${describeBetTemplate(chosenSpinOptions)} attempt=${index + 1}/${betCandidates.length}`,
          );
        }
        break;
      } catch (error) {
        await recordFailedExchange(
          gameDir,
          game.serverAddress,
          'processGameMessage',
          payload,
          responseXml || extractErrorResponseXml(error),
          error,
        );
        const message = error instanceof Error ? error.message : String(error);
        lastTemplateError = message;
        if (isCommunicationsProtocolError(error) && communicationsRetries < initialBetCommunicationsRetries) {
          communicationsRetries += 1;
          console.warn(
            `[sg] ${game.gameId} retrying same bet template after communications ${communicationsRetries}/${initialBetCommunicationsRetries} ${describeBetTemplate(candidate)}`,
          );
          await sleep(Math.min(1500, communicationsRetries * 250));
          continue;
        }
        if (
          isCommunicationsProtocolError(error) &&
          isJackpotJesterBuy12Plan(game) &&
          buy12WarmRefreshRetries < maxBuy12WarmRefreshRetries
        ) {
          buy12WarmRefreshRetries += 1;
          console.warn(
            `[sg] ${game.gameId} refreshing buy12 warmup after communications ${buy12WarmRefreshRetries}/${maxBuy12WarmRefreshRetries} ${describeBetTemplate(candidate)}`,
          );
          const rewarm = await warmupJackpotJesterBuy12Session(gameDir, game, client, effectivePreBalance, true);
          effectivePreBalance = rewarm.balance;
          if (rewarm.betCandidates.length > 0) {
            betCandidates = rewarm.betCandidates;
            index = -1;
            restartBetCandidates = true;
            break;
          }
        }
        if (!(isRetryableBetTemplateError(error) || matchesConfiguredRetryableTemplateError(game, error))) {
          throw error;
        }
        if (index >= betCandidates.length - 1) {
          break;
        }
        console.warn(
          `[sg] ${game.gameId} retrying bet template ${index + 1}/${betCandidates.length} after ${message} ${describeBetTemplate(candidate)}`,
        );
        break;
      }
    }
    if (restartBetCandidates) {
      continue;
    }
    if (firstBetEntry) {
      break;
    }
  }

  if (!firstBetEntry) {
    throw new Error(`sg bet template exhausted: ${lastTemplateError || `unable to start SG round for ${game.runtimeSlug}`}`);
  }

  entries.push(firstBetEntry);

  let params = parsePayloadParams(firstBetEntry.responsePayload || '');
  rememberFeatureMaxPickCounts(params, featureMaxPickCounts);
  if (freeChoiceRotation.active()) {
    const nextChoice = freeChoiceRotation.nextChoice();
    pendingFeaturePick = resolveFreeChoiceTriggerPickRequest(params, nextChoice.optionValue);
    if (pendingFeaturePick?.kind === 'freeChoice') {
      selectedFreeChoiceOptionIndex = pendingFeaturePick.optionIndex || nextChoice.optionIndex;
    }
  }

  for (let step = 0; step < ROUND_STEP_LIMIT; step++) {
    rememberFeatureMaxPickCounts(params, featureMaxPickCounts);
    if (!pendingFeaturePick && freeChoiceRotation.active()) {
      const nextChoice = freeChoiceRotation.nextChoice();
      pendingFeaturePick = resolveFreeChoiceTriggerPickRequest(params, nextChoice.optionValue);
      if (pendingFeaturePick?.kind === 'freeChoice') {
        selectedFreeChoiceOptionIndex = pendingFeaturePick.optionIndex || nextChoice.optionIndex;
      }
    }

    const featureCfg =
      pendingFeaturePick?.kind === 'freeChoice' && !startedCfgs.has(pendingFeaturePick.cfg)
        ? pendingFeaturePick.cfg
        : resolveFeatureStartCfg(params, startedCfgs);
    if (featureCfg !== null) {
      const initialProgressivePick = pendingFeaturePick
        ? null
        : resolveProgressiveFeatureInitialPickRequest(params, featureMaxPickCounts);
      startedCfgs.add(featureCfg);
      lastStartedFeatureCfg = featureCfg;
      const featurePayload = sgFeatureStartPayload(game, featureCfg);
      const featureXml = await client.featureStart(featureCfg);
      const featureEntry = await recordExchange(gameDir, game.serverAddress, 'processGameMessage', featurePayload, featureXml);
      entries.push(featureEntry);
      params = parsePayloadParams(featureEntry.responsePayload || '');
      if (initialProgressivePick?.cfg === featureCfg) {
        pendingFeaturePick = initialProgressivePick;
      }
      continue;
    }

    if (pendingFeaturePick !== null) {
      const featurePickPayload = sgFeaturePickPayload(game, pendingFeaturePick.cfg, pendingFeaturePick.fp);
      const featurePickXml = await client.featurePick(pendingFeaturePick.cfg, pendingFeaturePick.fp);
      const featurePickEntry = await recordExchange(
        gameDir,
        game.serverAddress,
        'processGameMessage',
        featurePickPayload,
        featurePickXml,
      );
      entries.push(featurePickEntry);
      params = parsePayloadParams(featurePickEntry.responsePayload || '');
      pendingFeaturePick = null;
      continue;
    }

    const featurePick = resolveFeaturePickRequest(params);
    if (featurePick !== null) {
      const featurePickPayload = sgFeaturePickPayload(game, featurePick.cfg, featurePick.fp);
      const featurePickXml = await client.featurePick(featurePick.cfg, featurePick.fp);
      const featurePickEntry = await recordExchange(
        gameDir,
        game.serverAddress,
        'processGameMessage',
        featurePickPayload,
        featurePickXml,
      );
      entries.push(featurePickEntry);
      params = parsePayloadParams(featurePickEntry.responsePayload || '');
      continue;
    }

    const progressiveFeaturePick = resolveProgressiveFeaturePickRequest(params, featureMaxPickCounts);
    if (progressiveFeaturePick !== null) {
      const featurePickPayload = sgFeaturePickPayload(game, progressiveFeaturePick.cfg, progressiveFeaturePick.fp);
      const featurePickXml = await client.featurePick(progressiveFeaturePick.cfg, progressiveFeaturePick.fp);
      const featurePickEntry = await recordExchange(
        gameDir,
        game.serverAddress,
        'processGameMessage',
        featurePickPayload,
        featurePickXml,
      );
      entries.push(featurePickEntry);
      params = parsePayloadParams(featurePickEntry.responsePayload || '');
      continue;
    }

    const progressiveFeatureEndCfg = resolveProgressiveFeatureEndCfg(params, featureMaxPickCounts);
    if (progressiveFeatureEndCfg !== null) {
      const featureEndEntry = await recordFeatureEndIfAccepted(gameDir, game, client, progressiveFeatureEndCfg);
      if (featureEndEntry !== null) {
        entries.push(featureEndEntry);
        params = parsePayloadParams(featureEndEntry.responsePayload || '');
        continue;
      }
      break;
    }

    const featureEndCfg = resolveFeatureEndCfg(params);
    if (featureEndCfg !== null) {
      const featureEndEntry = await recordFeatureEndIfAccepted(gameDir, game, client, featureEndCfg);
      if (featureEndEntry !== null) {
        entries.push(featureEndEntry);
        params = parsePayloadParams(featureEndEntry.responsePayload || '');
        continue;
      }
      break;
    }

    const freeChoiceFeatureEndCfg = resolveFreeChoiceFeatureEndCfg(params);
    if (freeChoiceFeatureEndCfg !== null) {
      const featureEndEntry = await recordFeatureEndIfAccepted(gameDir, game, client, freeChoiceFeatureEndCfg);
      if (featureEndEntry !== null) {
        entries.push(featureEndEntry);
        params = parsePayloadParams(featureEndEntry.responsePayload || '');
        continue;
      }
      break;
    }

    if (needsFreeGameContinuation(params)) {
      const freeGamePayload = sgFreeGamePayload(game, chosenSpinOptions);
      const freeGameXml = await client.freeGame(chosenSpinOptions);
      const freeGameEntry = await recordExchange(gameDir, game.serverAddress, 'processGameMessage', freeGamePayload, freeGameXml);
      entries.push(freeGameEntry);
      params = parsePayloadParams(freeGameEntry.responsePayload || '');
      continue;
    }

    if (lastStartedFeatureCfg !== null && entries[entries.length - 1]?.msgId === 'FEATURE_START') {
      const featureEndEntry = await recordFeatureEndIfAccepted(gameDir, game, client, lastStartedFeatureCfg);
      if (featureEndEntry !== null) {
        entries.push(featureEndEntry);
        params = parsePayloadParams(featureEndEntry.responsePayload || '');
        continue;
      }
    }

    break;
  }

  if (!entries.length) {
    throw new Error(`empty SG round for ${game.runtimeSlug}`);
  }

  const round = buildRoundDoc(game.gameId, game.runtimeSlug, entries, effectivePreBalance, {
    selectedFreeChoiceOptionIndex,
    freeChoiceOptionCount: freeChoiceRotation.configuredOptionCount(),
    forcedPrimaryBonusKind: usesBuyInFeature(chosenSpinOptions) ? 'feature' : null,
    ...resolveEnhancedBetMeta(game),
  });
  return {
    doc: round.doc,
    finalBalance: round.finalBalance,
    bonusLike: isBonusRound(entries) || round.doc.data.primaryBonusKind !== 'none',
  };
}

async function prepareCaptureFiles(gameDir: string) {
  if (!isResetMode()) {
    return;
  }

  await Promise.all([
    removeIfExists(path.join(gameDir, 'traffic.jsonl')),
    removeIfExists(path.join(gameDir, 'rounds.jsonl')),
    removeIfExists(path.join(gameDir, 'spin.0.txt')),
    removeIfExists(path.join(gameDir, 'free_game.txt')),
    removeIfExists(path.join(gameDir, 'feature_start.txt')),
    removeIfExists(path.join(gameDir, 'feature_pick.txt')),
    removeIfExists(path.join(gameDir, 'feature_end.txt')),
    removeIfExists(path.join(gameDir, 'init.txt')),
    removeIfExists(path.join(gameDir, 'reelstrip.txt')),
  ]);
}

export async function captureGame(game: SGGameConfig, options: SGCaptureOptions = {}): Promise<SGCaptureSummary> {
  refuseCapture();
  const startedAt = nowIso();
  const captureKey = String(game.captureKey || game.gameId);
  const planKey = String(game.planKey || captureKey);
  const variantLabel = String(game.variantLabel || '').trim();
  const gameDir = path.join(__dirname, CAPTURE_ROOT, captureKey);
  const roundsPath = path.join(gameDir, 'rounds.jsonl');
  const captureOptions = resolveCaptureOptions(game, options);
  const spinDelayMs = Number(process.env.SG_SPIN_DELAY_MS || game.spinDelayMs || 0);
  const freeChoiceOptionCount = resolveFreeChoiceOptionCount(game);
  const maxCaptureFailures = captureFailureLimit();

  successfulBetTemplateCache.delete(game.gameId);

  await fs.ensureDir(gameDir);
  await prepareCaptureFiles(gameDir);

  const restoredState = await loadCaptureState(roundsPath);
  const stats = restoredState.stats;
  const primaryBonusCounts = restoredState.primaryBonusCounts;
  const freeChoiceRotation = new FreeChoiceRotation(
    freeChoiceOptionCount > 0 ? Math.max(1, freeChoiceOptionCount) : 0,
    freeChoiceOptionCount,
    restoredState.freeChoiceOptionHits,
  );
  let reconnects = 0;
  let consecutiveFailures = 0;
  let activeFailureLimit = maxCaptureFailures;
  let lastFailureMessage = '';
  const isFreeChoiceCovered = () => freeChoiceRotation.covered();

  const emitProgress = (phase: SGCaptureProgress['phase'], doc?: SGMongoDoc) => {
    options.onProgress?.({
      gameId: game.gameId,
      planKey,
      captureKey,
      variantLabel,
      runtimeSlug: game.runtimeSlug,
      targetRounds: captureOptions.targetRounds,
      knownSpecialKinds: captureOptions.knownSpecialKinds,
      minKnownSpecialRounds: captureOptions.minKnownSpecialRounds,
      freeChoiceOptionCount,
      freeChoiceOptionHits: freeChoiceRotation.snapshot(),
      primaryBonusCounts: clonePrimaryBonusCounts(primaryBonusCounts),
      phase,
      reconnects,
      bet: doc?.bet,
      mul: doc?.mul,
      ...stats,
    });
  };

  console.log(
    `[sg] start ${game.gameId} ${game.runtimeSlug} targetRounds=${captureOptions.targetRounds} knownSpecials=${captureOptions.knownSpecialKinds.join(',') || '-'} minBonusRounds=${captureOptions.minBonusRounds} minFreeGameRounds=${captureOptions.minFreeGameRounds} minFeatureRounds=${captureOptions.minFeatureRounds} minFreeFeatureRounds=${captureOptions.minFreeFeatureRounds} freeChoiceOptionCount=${freeChoiceOptionCount || 0} existing=${stats.roundCount}/${stats.bonusLikeCount}/${stats.freeGameCount}/${stats.featureCount}/${stats.freeFeatureCount}`,
  );
  emitProgress('start');

  while (shouldContinueCapture(stats, captureOptions, isFreeChoiceCovered())) {
    if (reconnects >= SESSION_RETRY_LIMIT) {
      throw new Error(`[sg] ${game.runtimeSlug} reconnects exceeded ${SESSION_RETRY_LIMIT}`);
    }
    if (consecutiveFailures >= maxCaptureFailures) {
      const suffix = lastFailureMessage ? ` after ${lastFailureMessage}` : '';
      throw new Error(`[sg] ${game.runtimeSlug} consecutive failures exceeded ${maxCaptureFailures}${suffix}`);
    }

    try {
      const sessionGame = resolveReconnectGame(game, reconnects);
      if (sessionGame.sessionId !== game.sessionId) {
        console.log(`[sg] ${game.gameId} reconnect bootstrap with fresh session ${sessionGame.sessionId}`);
      }

      const { client, balance } = await bootstrapSessionWhenReady(
        gameDir,
        sessionGame,
        (attempt, maxAttempts, delayMs, error) => {
          console.warn(
            `[sg] ${game.gameId} session not ready, probe=${attempt}/${maxAttempts - 1}, wait=${delayMs}ms, reason=${String(error)}`,
          );
          emitProgress('reconnect');
        },
      );
      let currentBalance = balance;
      reconnects = 0;

      while (shouldContinueCapture(stats, captureOptions, isFreeChoiceCovered())) {
        try {
          const preferSpecialTemplates =
            Array.isArray(sessionGame.specialBetTemplates) &&
            sessionGame.specialBetTemplates.length > 0 &&
            stats.roundCount >= captureOptions.targetRounds &&
            captureOptions.knownSpecialKinds.length > 0 &&
            !knownSpecialsCovered(stats, captureOptions.knownSpecialKinds, captureOptions.minKnownSpecialRounds);
          const { doc, finalBalance, bonusLike } = await playRound(
            gameDir,
            sessionGame,
            client,
            currentBalance,
            freeChoiceRotation,
            preferSpecialTemplates,
          );
          await appendJsonLine(roundsPath, doc);

          stats.roundCount += 1;
          if (bonusLike) {
            stats.bonusLikeCount += 1;
          }
          if (isFreeGameDoc(doc)) {
            stats.freeGameCount += 1;
          }
          if (isFeatureDoc(doc)) {
            stats.featureCount += 1;
          }
          if (isFreeFeatureDoc(doc)) {
            stats.freeFeatureCount += 1;
          }
          const primaryBonusKind = readPrimaryBonusKind(doc);
          if (primaryBonusKind !== 'none') {
            primaryBonusCounts[primaryBonusKind] += 1;
          }
          const freeChoiceOptionIndex = Number(doc?.data?.freeChoiceOptionIndex || 0);
          if (freeChoiceOptionIndex > 0) {
            freeChoiceRotation.markCaptured(freeChoiceOptionIndex);
          }

          currentBalance = finalBalance;
          consecutiveFailures = 0;
          activeFailureLimit = maxCaptureFailures;
          lastFailureMessage = '';
          emitProgress('round', doc);

          if (stats.roundCount % 25 === 0 || bonusLike || isFreeGameDoc(doc) || isFeatureDoc(doc) || isFreeFeatureDoc(doc)) {
            console.log(
              `[sg] ${game.gameId} rounds=${stats.roundCount} bonusLike=${stats.bonusLikeCount} freeGame=${stats.freeGameCount} feature=${stats.featureCount} freeFeature=${stats.freeFeatureCount} freeChoiceCovered=${isFreeChoiceCovered()} optionHits=${JSON.stringify(freeChoiceRotation.snapshot())} bet=${doc.bet.toFixed(2)} mul=${doc.mul.toFixed(4)}`,
            );
          }

          if (sessionGame.restartSessionPerRound) {
            console.log(`[sg] ${game.gameId} restarting session after round ${stats.roundCount} by rule`);
            break;
          }

          await sleep(spinDelayMs);
        } catch (err) {
          lastFailureMessage = String(err);
          if (isFatalSessionError(err) || isFatalProtocolTemplateError(sessionGame, err)) {
            throw err;
          }
          reconnects += 1;
          consecutiveFailures += 1;
          activeFailureLimit = resolveCaptureFailureLimitForError(sessionGame, err, maxCaptureFailures);
          emitProgress('reconnect');
          console.warn(
            `[sg] ${game.gameId} round interrupted, reconnect=${reconnects}, failures=${consecutiveFailures}/${activeFailureLimit}, reason=${String(err)}`,
          );
          if (consecutiveFailures >= activeFailureLimit) {
            throw new Error(`[sg] ${game.runtimeSlug} consecutive failures exceeded ${activeFailureLimit} after ${lastFailureMessage}`);
          }
          break;
        }
      }
    } catch (err) {
      lastFailureMessage = String(err);
      if (isFatalSessionError(err) || isFatalProtocolTemplateError(game, err)) {
        throw err;
      }
      reconnects += 1;
      consecutiveFailures += 1;
      activeFailureLimit = resolveCaptureFailureLimitForError(game, err, maxCaptureFailures);
      emitProgress('reconnect');
      console.warn(
        `[sg] ${game.gameId} session bootstrap failed, reconnect=${reconnects}, failures=${consecutiveFailures}/${activeFailureLimit}, reason=${String(err)}`,
      );
      if (consecutiveFailures >= activeFailureLimit) {
        throw new Error(`[sg] ${game.runtimeSlug} consecutive failures exceeded ${activeFailureLimit} after ${lastFailureMessage}`);
      }
      await sleep(Math.min(5000, reconnects * 500));
    }
  }

  const stoppedBy =
    captureOptions.maxRounds > 0 && stats.roundCount >= captureOptions.maxRounds
      ? 'max-rounds'
      : captureOptions.stopWhenKnownSpecialsCovered &&
          knownSpecialsCovered(stats, captureOptions.knownSpecialKinds, captureOptions.minKnownSpecialRounds) &&
          isFreeChoiceCovered()
        ? 'known-specials'
        : 'target';

  console.log(
    `[sg] captured ${game.gameId} rounds=${stats.roundCount} bonusLike=${stats.bonusLikeCount} freeGame=${stats.freeGameCount} feature=${stats.featureCount} freeFeature=${stats.freeFeatureCount} freeChoiceOptionCount=${freeChoiceOptionCount || 0} optionHits=${JSON.stringify(freeChoiceRotation.snapshot())} stoppedBy=${stoppedBy}`,
  );
  emitProgress('complete');

  return {
    gameId: game.gameId,
    planKey,
    captureKey,
    variantLabel,
    runtimeSlug: game.runtimeSlug,
    targetRounds: captureOptions.targetRounds,
    knownSpecialKinds: captureOptions.knownSpecialKinds,
    freeChoiceOptionCount,
    freeChoiceOptionHits: freeChoiceRotation.snapshot(),
    primaryBonusCounts: clonePrimaryBonusCounts(primaryBonusCounts),
    stoppedBy,
    startedAt,
    finishedAt: nowIso(),
    ...stats,
  };
}

async function main() {
  const yamlPath = path.join(__dirname, 'assets', 'sg.yml');
  const doc = yaml.load(await fs.readFile(yamlPath, 'utf8')) as YamlDoc;
  const games = doc?.games || [];

  for (const game of games) {
    await captureGame(game);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
