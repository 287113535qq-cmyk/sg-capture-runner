import { refuseCapture } from './preparation';
import axios, { type AxiosResponse } from 'axios';
import { REQUEST_TIMEOUT_MS } from './config';

type BrowserFetchPage = {
  page: any;
  pageKey: string;
  ready: Promise<void>;
};

type BrowserFetchRuntime = {
  browser: any;
  pages: Map<string, BrowserFetchPage>;
};

let browserFetchRuntime: BrowserFetchRuntime | null = null;
let browserFetchRuntimePromise: Promise<BrowserFetchRuntime> | null = null;
let browserFetchCloseRegistered = false;

export interface SGGameConfig {
  gameId: number;
  sourceGameId?: number;
  name: string;
  planKey?: string;
  captureKey?: string;
  variantLabel?: string;
  runtimeSlug: string;
  operatorId: string;
  sessionId: string;
  currency: string;
  lang: string;
  mode: string;
  serverAddress: string;
  clientType?: string;
  startUrl?: string;
  betPerLine?: number;
  lineBet?: number;
  betMode?: 'lines' | 'payways' | 'discrete';
  forceBetMode?: 'lines' | 'payways' | 'discrete';
  preferTemplateSourceOnly?: boolean;
  disableGenericBetSearch?: boolean;
  baseBet?: number;
  reelsSelected?: number;
  includeBaseBet?: boolean;
  includeReelsSelected?: boolean;
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
  restartSessionPerRound?: boolean;
  templateSourceGameIds?: number[];
  fixedBetTemplates?: SGBetOptions[];
  specialBetTemplates?: SGBetOptions[];
  fatalErrorPatterns?: string[];
  retryableTemplateErrorPatterns?: string[];
  extraParams?: SGExtraParams;
  abpm?: number;
  anteBet?: number;
  rsc?: number;
  includeRsc?: boolean;
  rec?: number;
  includeRec?: boolean;
  autoPlay?: boolean;
  spinCount?: number;
  spinDelayMs?: number;
  roundCount?: number;
  minBonusRounds?: number;
  minFreeGameRounds?: number;
  minFreeFeatureRounds?: number;
  knownSpecialKinds?: string[] | string;
  specialKinds?: string[] | string;
  freeChoiceOptionCount?: number;
  dbName?: string;
  rtpPath?: string;
}

export interface SGEnhancedBetOption {
  buy: number;
  level: number;
  label?: string;
  fatalErrorPatterns?: string[];
  retryableTemplateErrorPatterns?: string[];
  abpm?: number;
  includeAbpm?: boolean;
  includeAnteBet?: boolean;
  betPerLine?: number;
  lineBet?: number;
  baseBet?: number;
  reelsSelected?: number;
  includeBaseBet?: boolean;
  includeReelsSelected?: boolean;
  anteBet?: number;
  rsc?: number;
  includeRsc?: boolean;
  rec?: number;
  includeRec?: boolean;
  gsd?: string;
  extraParams?: SGExtraParams;
}

export type SGExtraParams = Record<string, string | number | boolean>;

export interface SGBetOptions {
  matchBuy?: number;
  betPerLine?: number;
  lineBet?: number;
  betMode?: 'lines' | 'payways' | 'discrete';
  baseBet?: number;
  reelsSelected?: number;
  includeBaseBet?: boolean;
  includeReelsSelected?: boolean;
  abpm?: number;
  anteBet?: number;
  rsc?: number;
  rec?: number;
  includeAbpm?: boolean;
  includeAnteBet?: boolean;
  includeRsc?: boolean;
  includeRec?: boolean;
  autoPlay?: boolean;
  includeAutoPlay?: boolean;
  includeLineBet?: boolean;
  gsd?: string;
  extraParams?: SGExtraParams;
}

function normalizeLang(value: string | undefined): string {
  const lang = String(value || '').trim().toLowerCase();
  if (!lang) return 'en_us';
  if (lang === 'en') return 'en_us';
  return lang.replace(/-/g, '_');
}

function normalizeServerAddress(value: string): string {
  return value.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
}

function endpointUrl(serverAddress: string): string {
  return `https://${normalizeServerAddress(serverAddress)}/`;
}

function browserFetchEnabled(): boolean {
  const value = String(process.env.SG_BROWSER_FETCH || '').trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

async function getBrowserFetchRuntime(): Promise<BrowserFetchRuntime> {
  if (!browserFetchRuntime) {
    if (!browserFetchRuntimePromise) {
      browserFetchRuntimePromise = (async () => {
        const puppeteer = await import('puppeteer');
        const browser = await puppeteer.default.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
        });
        browserFetchRuntime = { browser, pages: new Map() };
        if (!browserFetchCloseRegistered) {
          browserFetchCloseRegistered = true;
          process.once('beforeExit', () => {
            void closeSGBrowserFetchRuntime().catch(() => undefined);
          });
        }
        return browserFetchRuntime;
      })().finally(() => {
        browserFetchRuntimePromise = null;
      });
    }
    return browserFetchRuntimePromise;
  }
  return browserFetchRuntime;
}

async function ensureBrowserFetchRuntime(game: SGGameConfig): Promise<{ page: any; pageKey: string }> {
  const startUrl = String(game.startUrl || '').trim();
  const pageKey = startUrl || endpointUrl(game.serverAddress);
  const runtime = await getBrowserFetchRuntime();
  let entry = runtime.pages.get(pageKey);

  if (!entry) {
    const page = await runtime.browser.newPage();
    entry = {
      page,
      pageKey,
      ready: startUrl
        ? page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: Math.max(REQUEST_TIMEOUT_MS, 60000) }).then(
            () => undefined,
            () => undefined,
          )
        : Promise.resolve(),
    };
    runtime.pages.set(pageKey, entry);
  }

  await entry.ready;
  return { page: entry.page, pageKey: entry.pageKey };
}

export async function closeSGBrowserFetchRuntime(): Promise<void> {
  const runtime = browserFetchRuntime;
  browserFetchRuntime = null;
  browserFetchRuntimePromise = null;
  if (!runtime) {
    return;
  }
  await Promise.all(Array.from(runtime.pages.values()).map((entry) => entry.page?.close?.().catch?.(() => undefined)));
  await runtime.browser?.close?.().catch?.(() => undefined);
}

async function postGDMWithBrowser(game: SGGameConfig, body: string): Promise<string> {
  const runtime = await ensureBrowserFetchRuntime(game);
  const result = await runtime.page.evaluate(
    async ({ url, requestBody, timeoutMs }: { url: string; requestBody: string; timeoutMs: number }) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'text/xml; charset=utf-8',
            Accept: '*/*',
          },
          credentials: 'omit',
          body: requestBody,
        });
        return { ok: response.ok, status: response.status, text: await response.text() };
      } finally {
        clearTimeout(timer);
      }
    },
    { url: endpointUrl(game.serverAddress), requestBody: body, timeoutMs: REQUEST_TIMEOUT_MS },
  );

  if (!result.ok) {
    throw new Error(`GDM HTTP ${result.status}: ${String(result.text || '').slice(0, 300)}`);
  }
  return String(result.text || '');
}

function buildToken(game: SGGameConfig): string {
  return `${game.sessionId}@${game.operatorId}`;
}

function buildPlayerId(game: SGGameConfig): string {
  return `gdmgcm${game.sessionId}`;
}

function serializeExtraParams(extraParams: SGExtraParams | undefined, excludedKeys: string[] = []): string[] {
  if (!extraParams || typeof extraParams !== 'object') {
    return [];
  }

  const excluded = new Set(excludedKeys.map((key) => String(key || '').trim().toUpperCase()).filter(Boolean));
  const parts: string[] = [];
  for (const [rawKey, rawValue] of Object.entries(extraParams)) {
    const key = String(rawKey || '').trim();
    if (!key) {
      continue;
    }
    if (excluded.has(key.toUpperCase())) {
      continue;
    }
    if (rawValue === undefined || rawValue === null) {
      continue;
    }
    const value =
      typeof rawValue === 'boolean'
        ? rawValue
          ? 'true'
          : 'false'
        : String(rawValue).trim();
    if (value === '') {
      continue;
    }
    parts.push(`${key}=${value}`);
  }
  return parts;
}

function extractCookiePair(value: string): string | null {
  const firstPart = String(value || '').split(';', 1)[0].trim();
  return firstPart.includes('=') ? firstPart : null;
}

export function sgInitPayload(game: SGGameConfig): string {
  const rec = game.rec ?? 0;
  const includeRec = game.includeRec ?? false;
  return [
    `GN=${game.runtimeSlug}`,
    `PID=${buildPlayerId(game)}`,
    includeRec && Number.isFinite(Number(rec)) ? `REC=${Math.round(Number(rec))}` : '',
    'MSGID=INIT',
  ].filter(Boolean).join('&');
}

export function sgReelstripPayload(game: SGGameConfig): string {
  const rec = game.rec ?? 0;
  const includeRec = game.includeRec ?? false;
  return [
    `GN=${game.runtimeSlug}`,
    `PID=${buildPlayerId(game)}`,
    includeRec && Number.isFinite(Number(rec)) ? `REC=${Math.round(Number(rec))}` : '',
    'MSGID=REELSTRIP',
  ].filter(Boolean).join('&');
}

export function sgBetPayload(game: SGGameConfig, options: SGBetOptions = {}): string {
  const betMode = options.betMode ?? game.betMode ?? 'lines';
  const abpm = options.abpm ?? game.abpm ?? 0;
  const includeAbpm = options.includeAbpm ?? (Number.isFinite(Number(abpm)) && Number(abpm) > 0);
  const anteBet = options.anteBet ?? game.anteBet ?? 0;
  const includeAnteBet = options.includeAnteBet ?? false;
  const rsc = options.rsc ?? game.rsc ?? 0;
  const includeRsc = options.includeRsc ?? game.includeRsc ?? false;
  const rec = options.rec ?? game.rec ?? 0;
  const includeRec = options.includeRec ?? game.includeRec ?? false;
  const gsd = String(options.gsd || '').trim();
  const autoPlay = options.autoPlay ?? game.autoPlay ?? false;
  const includeAutoPlay = options.includeAutoPlay ?? true;
  const extraParams = options.extraParams ?? game.extraParams;
  const extraParamParts = serializeExtraParams(extraParams, [
    'GN',
    'PID',
    'MSGID',
    'BPL',
    'LB',
    'BPR',
    'RB',
    'AP',
    'ABPM',
    'ANTEBET',
    'RSC',
    'REC',
    'GSD',
  ]);
  const baseBet = options.baseBet ?? game.baseBet ?? game.betPerLine ?? 5;
  const reelsSelected = options.reelsSelected ?? game.reelsSelected ?? 6;
  const includeBaseBet = options.includeBaseBet ?? game.includeBaseBet ?? betMode === 'payways';
  const includeReelsSelected = options.includeReelsSelected ?? game.includeReelsSelected ?? betMode === 'payways';
  if (betMode === 'payways') {
    return [
      `GN=${game.runtimeSlug}`,
      `PID=${buildPlayerId(game)}`,
      'MSGID=BET',
      includeAbpm ? `ABPM=${abpm}` : '',
      includeAnteBet && Number.isFinite(Number(anteBet)) && Number(anteBet) > 0 ? `ANTEBET=${anteBet}` : '',
      includeRsc && Number.isFinite(Number(rsc)) ? `RSC=${Math.round(Number(rsc))}` : '',
      includeRec && Number.isFinite(Number(rec)) ? `REC=${Math.round(Number(rec))}` : '',
      gsd ? `GSD=${gsd}` : '',
      includeAutoPlay ? `AP=${autoPlay ? 'true' : 'false'}` : '',
      ...extraParamParts,
      includeBaseBet ? `BPR=${baseBet}` : '',
      includeReelsSelected ? `RB=${reelsSelected}` : '',
    ].filter(Boolean).join('&');
  }

  const betPerLine = options.betPerLine ?? game.betPerLine ?? 5;
  const lineBet = options.lineBet ?? game.lineBet ?? 50;
  const includeLineBet = options.includeLineBet ?? true;

  if (betMode === 'discrete') {
    return [
      `GN=${game.runtimeSlug}`,
      `PID=${buildPlayerId(game)}`,
      'MSGID=BET',
      includeAbpm ? `ABPM=${abpm}` : '',
      includeAnteBet && Number.isFinite(Number(anteBet)) && Number(anteBet) > 0 ? `ANTEBET=${anteBet}` : '',
      includeRsc && Number.isFinite(Number(rsc)) ? `RSC=${Math.round(Number(rsc))}` : '',
      includeRec && Number.isFinite(Number(rec)) ? `REC=${Math.round(Number(rec))}` : '',
      gsd ? `GSD=${gsd}` : '',
      includeAutoPlay ? `AP=${autoPlay ? 'true' : 'false'}` : '',
      ...extraParamParts,
      includeLineBet ? `LB=${lineBet}` : '',
    ].filter(Boolean).join('&');
  }

  return [
    `GN=${game.runtimeSlug}`,
    `PID=${buildPlayerId(game)}`,
    'MSGID=BET',
    includeAbpm ? `ABPM=${abpm}` : '',
    includeAnteBet && Number.isFinite(Number(anteBet)) && Number(anteBet) > 0 ? `ANTEBET=${anteBet}` : '',
    includeRsc && Number.isFinite(Number(rsc)) ? `RSC=${Math.round(Number(rsc))}` : '',
    includeRec && Number.isFinite(Number(rec)) ? `REC=${Math.round(Number(rec))}` : '',
    gsd ? `GSD=${gsd}` : '',
    includeAutoPlay ? `AP=${autoPlay ? 'true' : 'false'}` : '',
    ...extraParamParts,
    `BPL=${betPerLine}`,
    includeLineBet ? `LB=${lineBet}` : '',
    includeBaseBet ? `BPR=${baseBet}` : '',
    includeReelsSelected ? `RB=${reelsSelected}` : '',
  ].filter(Boolean).join('&');
}

export function sgFreeGamePayload(game: SGGameConfig, options: SGBetOptions = {}): string {
  const betMode = options.betMode ?? game.betMode ?? 'lines';
  const abpm = options.abpm ?? game.abpm ?? 0;
  const includeAbpm = options.includeAbpm ?? (Number.isFinite(Number(abpm)) && Number(abpm) > 0);
  const anteBet = options.anteBet ?? game.anteBet ?? 0;
  const includeAnteBet = options.includeAnteBet ?? false;
  const rsc = options.rsc ?? game.rsc ?? 0;
  const includeRsc = options.includeRsc ?? game.includeRsc ?? false;
  const rec = options.rec ?? game.rec ?? 0;
  const includeRec = options.includeRec ?? game.includeRec ?? false;
  const gsd = String(options.gsd || '').trim();
  const autoPlay = options.autoPlay ?? game.autoPlay ?? false;
  const includeAutoPlay = options.includeAutoPlay ?? true;
  const extraParams = options.extraParams ?? game.extraParams;
  const extraParamParts = serializeExtraParams(extraParams, [
    'GN',
    'PID',
    'MSGID',
    'BPL',
    'LB',
    'BPR',
    'RB',
    'AP',
    'ABPM',
    'ANTEBET',
    'RSC',
    'REC',
    'GSD',
  ]);
  const baseBet = options.baseBet ?? game.baseBet ?? game.betPerLine ?? 5;
  const reelsSelected = options.reelsSelected ?? game.reelsSelected ?? 6;
  const includeBaseBet = options.includeBaseBet ?? game.includeBaseBet ?? betMode === 'payways';
  const includeReelsSelected = options.includeReelsSelected ?? game.includeReelsSelected ?? betMode === 'payways';
  if (betMode === 'payways') {
    return [
      `GN=${game.runtimeSlug}`,
      `PID=${buildPlayerId(game)}`,
      'MSGID=FREE_GAME',
      includeAbpm ? `ABPM=${abpm}` : '',
      includeAnteBet && Number.isFinite(Number(anteBet)) && Number(anteBet) > 0 ? `ANTEBET=${anteBet}` : '',
      includeRsc && Number.isFinite(Number(rsc)) ? `RSC=${Math.round(Number(rsc))}` : '',
      includeRec && Number.isFinite(Number(rec)) ? `REC=${Math.round(Number(rec))}` : '',
      gsd ? `GSD=${gsd}` : '',
      includeAutoPlay ? `AP=${autoPlay ? 'true' : 'false'}` : '',
      ...extraParamParts,
      includeBaseBet ? `BPR=${baseBet}` : '',
      includeReelsSelected ? `RB=${reelsSelected}` : '',
    ].filter(Boolean).join('&');
  }

  const betPerLine = options.betPerLine ?? game.betPerLine ?? 5;
  const lineBet = options.lineBet ?? game.lineBet ?? 50;
  const includeLineBet = options.includeLineBet ?? true;

  if (betMode === 'discrete') {
    return [
      `GN=${game.runtimeSlug}`,
      `PID=${buildPlayerId(game)}`,
      'MSGID=FREE_GAME',
      includeAbpm ? `ABPM=${abpm}` : '',
      includeAnteBet && Number.isFinite(Number(anteBet)) && Number(anteBet) > 0 ? `ANTEBET=${anteBet}` : '',
      includeRsc && Number.isFinite(Number(rsc)) ? `RSC=${Math.round(Number(rsc))}` : '',
      includeRec && Number.isFinite(Number(rec)) ? `REC=${Math.round(Number(rec))}` : '',
      gsd ? `GSD=${gsd}` : '',
      includeAutoPlay ? `AP=${autoPlay ? 'true' : 'false'}` : '',
      ...extraParamParts,
      includeLineBet ? `LB=${lineBet}` : '',
    ].filter(Boolean).join('&');
  }

  return [
    `GN=${game.runtimeSlug}`,
    `PID=${buildPlayerId(game)}`,
    'MSGID=FREE_GAME',
    includeAbpm ? `ABPM=${abpm}` : '',
    includeAnteBet && Number.isFinite(Number(anteBet)) && Number(anteBet) > 0 ? `ANTEBET=${anteBet}` : '',
    includeRsc && Number.isFinite(Number(rsc)) ? `RSC=${Math.round(Number(rsc))}` : '',
    includeRec && Number.isFinite(Number(rec)) ? `REC=${Math.round(Number(rec))}` : '',
    gsd ? `GSD=${gsd}` : '',
    includeAutoPlay ? `AP=${autoPlay ? 'true' : 'false'}` : '',
    ...extraParamParts,
    `BPL=${betPerLine}`,
    includeLineBet ? `LB=${lineBet}` : '',
    includeBaseBet ? `BPR=${baseBet}` : '',
    includeReelsSelected ? `RB=${reelsSelected}` : '',
  ].filter(Boolean).join('&');
}

export function sgFeatureStartPayload(game: SGGameConfig, cfg: number | string): string {
  return [
    `GN=${game.runtimeSlug}`,
    `PID=${buildPlayerId(game)}`,
    'MSGID=FEATURE_START',
    `CFG=${cfg}`,
  ].join('&');
}

export function sgFeaturePickPayload(game: SGGameConfig, cfg: number | string, fp: string): string {
  return [
    `GN=${game.runtimeSlug}`,
    `PID=${buildPlayerId(game)}`,
    'MSGID=FEATURE_PICK',
    `CFG=${cfg}`,
    `FP=${fp}`,
  ].join('&');
}

export function sgFeatureEndPayload(game: SGGameConfig, cfg: number | string): string {
  return [
    `GN=${game.runtimeSlug}`,
    `PID=${buildPlayerId(game)}`,
    'MSGID=FEATURE_END',
    `CFG=${cfg}`,
  ].join('&');
}

export class SGSessionClient {
  private readonly cookies = new Map<string, string>();

  constructor(private readonly game: SGGameConfig) {}

  private cookieHeader(): string {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  private rememberCookies(response: AxiosResponse<string>) {
    const setCookie = response.headers['set-cookie'];
    if (!Array.isArray(setCookie)) {
      return;
    }

    for (const item of setCookie) {
      const pair = extractCookiePair(item);
      if (!pair) continue;
      const eqIdx = pair.indexOf('=');
      this.cookies.set(pair.slice(0, eqIdx), pair.slice(eqIdx + 1));
    }
  }

  async postGDM(methodName: string, payload?: string): Promise<string> {
    refuseCapture();
    const body = [
      '<gdmRequest>',
      `<clienttype>${this.game.clientType || 'flash'}</clienttype>`,
      `<lang>${normalizeLang(this.game.lang)}</lang>`,
      `<currency>${this.game.currency || 'USD'}</currency>`,
      `<mode>${this.game.mode || 'demo'}</mode>`,
      `<token>${buildToken(this.game)}</token>`,
      `<methodName>${methodName}</methodName>`,
      methodName === 'getBalance' ? `<gameName>${this.game.runtimeSlug}</gameName>` : '',
      payload ? `<payload>${payload.replace(/&/g, '&amp;')}</payload>` : '',
      '</gdmRequest>',
    ].join('');

    if (browserFetchEnabled()) {
      return postGDMWithBrowser(this.game, body);
    }

    const response = await axios.post<string>(endpointUrl(this.game.serverAddress), body, {
      timeout: REQUEST_TIMEOUT_MS,
      proxy: false,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        ...(this.cookies.size > 0 ? { Cookie: this.cookieHeader() } : {}),
      },
      responseType: 'text',
    });

    this.rememberCookies(response);
    return String(response.data || '');
  }

  async getBalance(): Promise<string> {
    return this.postGDM('getBalance');
  }

  async processGameMessage(payload: string): Promise<string> {
    return this.postGDM('processGameMessage', payload);
  }

  async init(): Promise<string> {
    return this.processGameMessage(sgInitPayload(this.game));
  }

  async reelstrip(): Promise<string> {
    return this.processGameMessage(sgReelstripPayload(this.game));
  }

  async bet(options: SGBetOptions = {}): Promise<string> {
    return this.processGameMessage(sgBetPayload(this.game, options));
  }

  async freeGame(options: SGBetOptions = {}): Promise<string> {
    return this.processGameMessage(sgFreeGamePayload(this.game, options));
  }

  async featureStart(cfg: number | string): Promise<string> {
    return this.processGameMessage(sgFeatureStartPayload(this.game, cfg));
  }

  async featurePick(cfg: number | string, fp: string): Promise<string> {
    return this.processGameMessage(sgFeaturePickPayload(this.game, cfg, fp));
  }

  async featureEnd(cfg: number | string): Promise<string> {
    return this.processGameMessage(sgFeatureEndPayload(this.game, cfg));
  }
}
