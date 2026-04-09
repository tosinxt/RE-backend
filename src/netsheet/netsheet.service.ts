import {
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DocumentType, NetSheetComputed, NetSheetExtract } from './netsheet.types';

function safeJsonParse(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    return undefined;
  }
}

function stripCodeFences(s: string): string {
  const trimmed = s.trim();
  if (trimmed.startsWith('```')) {
    return trimmed.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim();
  }
  return trimmed;
}

function toNumberOrNull(value: unknown): number | null | undefined {
  if (value === null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[\$,]/g, '').trim();
    if (!cleaned) return undefined;
    const n = Number(cleaned);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function toIsoDateOrNull(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const s = value.trim();
  if (!s) return undefined;
  // Very light validation: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return undefined;
}

function clampConfidence(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function normalizeExtract(
  documentType: DocumentType,
  payload: unknown,
): NetSheetExtract {
  const obj = payload as Record<string, unknown> | undefined;
  const extracted = (obj?.extracted ?? obj) as Record<string, unknown> | undefined;

  const notes =
    Array.isArray(obj?.notes) ? obj?.notes.filter((n) => typeof n === 'string') : [];

  return {
    documentType,
    confidence: clampConfidence(obj?.confidence),
    extracted: {
      salePrice: toNumberOrNull(extracted?.salePrice),
      buyerCredits: toNumberOrNull(extracted?.buyerCredits),
      sellerCredits: toNumberOrNull(extracted?.sellerCredits),
      titleFees: toNumberOrNull(extracted?.titleFees),
      closingDate: toIsoDateOrNull(extracted?.closingDate),
      propertyAddress:
        extracted?.propertyAddress === null
          ? null
          : typeof extracted?.propertyAddress === 'string'
            ? extracted.propertyAddress.trim() || undefined
            : undefined,
    },
    notes,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** OpenRouter often puts the useful text in error.metadata.raw; error.message may be generic. */
function providerErrorDetail(body: string): { detail: string; code?: number } {
  try {
    const j = JSON.parse(body) as {
      error?: {
        message?: string;
        code?: number;
        metadata?: { raw?: string };
      };
    };
    const err = j?.error;
    if (!err) {
      return { detail: body.trim().slice(0, 1200) || `HTTP error` };
    }
    const raw =
      typeof err.metadata?.raw === 'string' && err.metadata.raw.trim()
        ? err.metadata.raw.trim()
        : undefined;
    const msg = typeof err.message === 'string' ? err.message.trim() : '';
    const generic = msg === 'Provider returned error' || msg === 'Bad Request';
    const detail = raw || (!generic ? msg : '') || body.trim().slice(0, 1200) || msg || `HTTP error`;
    return { detail, code: typeof err.code === 'number' ? err.code : undefined };
  } catch {
    return { detail: body.trim().slice(0, 1200) || `HTTP error` };
  }
}

function aiHttpException(status: number, body: string, context: string): HttpException {
  const { detail: providerMessage, code: providerCode } = providerErrorDetail(body);
  const detail =
    providerMessage?.trim() ||
    (body.trim().length ? body.trim().slice(0, 500) : `HTTP ${status}`);

  if (status === 402) {
    return new HttpException(
      {
        message:
          'AI provider reports insufficient credits or billing required (e.g. OpenRouter). Add credits or fix the API key.',
        providerMessage: detail,
        providerCode,
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
  if (status === 401) {
    return new HttpException(
      {
        message: 'AI provider rejected the API key.',
        providerMessage: detail,
        providerCode,
      },
      HttpStatus.UNAUTHORIZED,
    );
  }
  if (status === 429) {
    return new HttpException(
      {
        message:
          'AI provider rate limit (common on free models). Wait and retry, add a provider key in OpenRouter integrations, or switch OPENROUTER_MODEL to a paid model.',
        providerMessage: detail,
        providerCode,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
  if (status >= 500) {
    return new HttpException(
      {
        message: `${context} (upstream error ${status}).`,
        providerMessage: detail,
        providerCode,
      },
      HttpStatus.BAD_GATEWAY,
    );
  }

  return new HttpException(
    {
      message: `${context} (provider status ${status}).`,
      providerMessage: detail,
      providerCode,
    },
    HttpStatus.BAD_GATEWAY,
  );
}

function computeNetToSeller(extracted: NetSheetExtract['extracted']): NetSheetComputed {
  const sp = extracted.salePrice ?? null;
  if (sp === null || sp === undefined) return { netToSeller: null };

  const bc = extracted.buyerCredits ?? 0;
  const sc = extracted.sellerCredits ?? 0;
  const tf = extracted.titleFees ?? 0;

  if ([bc, sc, tf].some((n) => n === null || n === undefined)) {
    return { netToSeller: null };
  }

  return { netToSeller: sp - (bc as number) - (sc as number) - (tf as number) };
}

@Injectable()
export class NetSheetService {
  private readonly logger = new Logger(NetSheetService.name);

  constructor(private readonly config: ConfigService) {}

  private getAiProviderConfig() {
    const openRouterKey = this.config.get<string>('OPENROUTER_API_KEY')?.trim();
    const openAiKey = this.config.get<string>('OPENAI_API_KEY')?.trim();

    const openRouterSiteUrl = this.config.get<string>('OPENROUTER_SITE_URL')?.trim();
    const openRouterAppName = this.config.get<string>('OPENROUTER_APP_NAME')?.trim();

    // If both keys exist, OpenRouter wins (avoids sending sk-or-v* to api.openai.com).
    if (openRouterKey) {
      const baseUrl =
        this.config.get<string>('OPENROUTER_BASE_URL')?.trim() || 'https://openrouter.ai/api/v1';
      const model =
        this.config.get<string>('OPENROUTER_MODEL')?.trim() ||
        this.config.get<string>('OPENAI_MODEL')?.trim() ||
        'google/gemma-4-26b-a4b-it:free';
      return {
        apiKey: openRouterKey,
        baseUrl,
        model,
        openRouterSiteUrl,
        openRouterAppName,
      };
    }

    if (openAiKey) {
      const baseUrl =
        this.config.get<string>('OPENAI_BASE_URL')?.trim() || 'https://api.openai.com/v1';
      const model =
        this.config.get<string>('OPENAI_MODEL')?.trim() ||
        this.config.get<string>('OPENROUTER_MODEL')?.trim() ||
        'gpt-4o-mini';
      return {
        apiKey: openAiKey,
        baseUrl,
        model,
        openRouterSiteUrl,
        openRouterAppName,
      };
    }

    throw new InternalServerErrorException(
      'OPENROUTER_API_KEY (or OPENAI_API_KEY) is not configured on the server.',
    );
  }

  async extractFromText(params: {
    documentType: DocumentType;
    text: string;
    fileName?: string;
  }): Promise<{ extract: NetSheetExtract; computed: NetSheetComputed; raw: string }> {
    const { apiKey, baseUrl, model, openRouterSiteUrl, openRouterAppName } =
      this.getAiProviderConfig();

    const isOpenRouter = /^https?:\/\/openrouter\.ai\/api\/v1\/?$/.test(
      baseUrl.replace(/\/+$/, ''),
    );

    const text = params.text.length > 180_000 ? params.text.slice(0, 180_000) : params.text;

    const system = [
      'You are an expert title/settlement assistant.',
      'Extract key values needed to populate a seller net sheet.',
      'Return ONLY valid JSON. No markdown, no prose.',
      'If a value is not present, use null (not 0).',
      'Amounts must be numbers in USD (no $ or commas).',
      'closingDate must be ISO format YYYY-MM-DD if present, else null.',
    ].join('\n');

    const user = {
      task: 'Extract net sheet fields from parsed PDF text.',
      documentType: params.documentType,
      fileName: params.fileName ?? null,
      outputSchema: {
        confidence: 'number 0..1',
        extracted: {
          salePrice: 'number|null',
          buyerCredits: 'number|null',
          sellerCredits: 'number|null',
          titleFees: 'number|null',
          closingDate: 'string(YYYY-MM-DD)|null',
          propertyAddress: 'string|null',
        },
        notes: 'string[] (optional)',
      },
      text,
    };

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };

    // OpenRouter recommends these for attribution / routing.
    if (isOpenRouter) {
      if (openRouterSiteUrl) headers['HTTP-Referer'] = openRouterSiteUrl;
      if (openRouterAppName) headers['X-Title'] = openRouterAppName;
    }

    const chatUrl = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const chatBody = {
      model,
      temperature: 0,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: JSON.stringify(user) },
      ],
    };

    const maxAttempts = 3;
    let res: Response | null = null;
    let lastErrorBody = '';
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) {
        const waitMs = 2500 * attempt;
        this.logger.warn(
          { attempt: attempt + 1, waitMs, model },
          'Retrying chat completion after 429 rate limit',
        );
        await delay(waitMs);
      }
      res = await fetch(chatUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(chatBody),
      });
      if (res.ok) break;
      lastErrorBody = await res.text().catch(() => '');
      if (res.status !== 429 || attempt === maxAttempts - 1) {
        this.logger.error(
          { status: res.status, body: lastErrorBody.slice(0, 1000) },
          'OpenAI extraction request failed',
        );
        throw aiHttpException(res.status, lastErrorBody, 'AI extraction failed');
      }
    }

    if (!res?.ok) {
      throw new InternalServerErrorException('AI extraction request failed after retries.');
    }

    const json = (await res.json()) as any;
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new InternalServerErrorException('AI extraction returned empty content.');
    }

    const raw = content.trim();
    const parsed = safeJsonParse(stripCodeFences(raw));

    if (!parsed) {
      this.logger.warn({ raw: raw.slice(0, 500) }, 'AI returned non-JSON; attempting repair');

      const repairPayload = {
        model,
        temperature: 0,
        messages: [
          { role: 'system', content: 'Return ONLY valid JSON. No markdown.' },
          {
            role: 'user',
            content: JSON.stringify({
              task: 'Convert this into valid JSON matching the schema.',
              schema: user.outputSchema,
              input: raw,
            }),
          },
        ],
      };

      let repairRes: Response | null = null;
      let repairErrorBody = '';
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (attempt > 0) {
          await delay(2500 * attempt);
          this.logger.warn({ attempt: attempt + 1, model }, 'Retrying repair after 429');
        }
        repairRes = await fetch(chatUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(repairPayload),
        });
        if (repairRes.ok) break;
        repairErrorBody = await repairRes.text().catch(() => '');
        if (repairRes.status !== 429 || attempt === maxAttempts - 1) {
          this.logger.error(
            { status: repairRes.status, body: repairErrorBody.slice(0, 1000) },
            'OpenAI extraction repair request failed',
          );
          throw aiHttpException(repairRes.status, repairErrorBody, 'AI extraction repair failed');
        }
      }

      if (!repairRes?.ok) {
        throw new InternalServerErrorException('AI extraction repair failed after retries.');
      }

      const repairedJson = (await repairRes.json()) as any;
      const repairedContent = repairedJson?.choices?.[0]?.message?.content;
      const repairedParsed = safeJsonParse(stripCodeFences(String(repairedContent ?? '')));
      if (!repairedParsed) {
        throw new InternalServerErrorException('AI extraction produced invalid JSON.');
      }

      const extract = normalizeExtract(params.documentType, repairedParsed);
      const computed = computeNetToSeller(extract.extracted);
      return { extract, computed, raw: String(repairedContent ?? raw) };
    }

    const extract = normalizeExtract(params.documentType, parsed);
    const computed = computeNetToSeller(extract.extracted);
    return { extract, computed, raw };
  }
}

