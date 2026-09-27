import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  trimValues: true,
});

export interface ParsedGDMResponse {
  ogsRc: string;
  success: boolean;
  balance?: string;
  payload?: string;
  errorCode?: string;
  errorMessage?: string;
}

export function parseGDMResponse(xml: string): ParsedGDMResponse {
  const parsed: any = parser.parse(xml);
  const root = parsed?.GDMRESPONSE || parsed?.gdmresponse || {};
  return {
    ogsRc: String(root?.OGS_RC ?? ''),
    success: String(root?.SUCCESS ?? '').toLowerCase() === 'true',
    balance: root?.BALANCE ? String(root.BALANCE) : undefined,
    payload: root?.PAYLOAD ? String(root.PAYLOAD) : undefined,
    errorCode: root?.ERRORCODE ? String(root.ERRORCODE) : undefined,
    errorMessage: root?.ERRORMESSAGE ? String(root.ERRORMESSAGE) : undefined,
  };
}

export function parsePayloadParams(payload: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of payload.split('&')) {
    if (!part) continue;
    const idx = part.indexOf('=');
    if (idx < 0) {
      result[part] = '';
      continue;
    }
    result[part.slice(0, idx)] = part.slice(idx + 1);
  }
  return result;
}

export function extractMsgId(payload?: string): string {
  if (!payload) return '';
  return parsePayloadParams(payload).MSGID || '';
}

export function extractBalanceFromPayload(payload?: string): number | undefined {
  if (!payload) return undefined;
  const params = parsePayloadParams(payload);
  const balance = params.AB || params.B;
  if (!balance) return undefined;
  const parsed = Number(balance);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function extractTotalWinFromPayload(payload?: string): number {
  if (!payload) return 0;
  const params = parsePayloadParams(payload);
  const totalWin = Number(params.TW || 0);
  return Number.isFinite(totalWin) ? totalWin : 0;
}

export function extractRoundBalance(parsed: ParsedGDMResponse): number | undefined {
  const payloadBalance = extractBalanceFromPayload(parsed.payload);
  if (payloadBalance !== undefined) {
    return payloadBalance;
  }

  if (!parsed.balance) {
    return undefined;
  }

  const balance = Number(parsed.balance);
  return Number.isFinite(balance) ? balance : undefined;
}
