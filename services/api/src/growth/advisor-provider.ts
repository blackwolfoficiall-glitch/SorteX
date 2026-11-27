import { createHash, timingSafeEqual } from 'node:crypto';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';

import {
  ADVISOR_MAX_OUTPUT_TOKENS,
  estimateAdvisorUsage,
} from './ai-usage-budget';

export { ADVISOR_MAX_OUTPUT_TOKENS } from './ai-usage-budget';
export const GEMINI_FREE_MODEL = 'gemini-3.1-flash-lite';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_FREE_MODEL}:generateContent`;
const OPENAI_URL = 'https://api.openai.com/v1/responses';
const ATTESTATION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const INSTRUCTIONS =
  'Você é o SorteX Advisor. Responda em português brasileiro usando apenas as métricas agregadas observadas. Não invente dados, não prometa desempenho e não execute ações. Indique limitações e sugira só próximos passos para revisão humana.';
const ANSWER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: { answer: { type: 'string' } },
  required: ['answer'],
};

type Usage = { inputTokens: number; outputTokens: number };
type GeneratedAdvice = { answer: string; usage: Usage | null };
export type PreparedAdvisorRequest = {
  inputUnits: number;
  outputUnits: number;
  generate(): Promise<GeneratedAdvice>;
};
export type AdvisorProvider = {
  readonly mode: 'OPENAI' | 'GEMINI';
  // payload must be rebuilt by the server from its tenant-scoped aggregate
  // allowlist. This is not a serialization boundary for user/database records.
  prepare(payload: object, maxOutputTokens: number): PreparedAdvisorRequest;
};

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error('invalid provider response');
  return value as Record<string, unknown>;
}

function answerFrom(text: unknown) {
  if (typeof text !== 'string' || text.length > 4096)
    throw new Error('invalid provider response');
  const data = record(JSON.parse(text) as unknown);
  if (
    Object.keys(data).length !== 1 ||
    typeof data.answer !== 'string' ||
    !data.answer.trim() ||
    data.answer.length > 1200
  )
    throw new Error('invalid provider answer');
  return data.answer.trim();
}

function tokenCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    throw new Error('invalid provider usage');
  return value;
}

function decodeOpenAI(body: unknown): GeneratedAdvice {
  const response = record(body);
  if (response.status !== 'completed' || !Array.isArray(response.output))
    throw new Error('incomplete provider response');
  const messages = response.output
    .map(record)
    .filter((i) => i.type === 'message');
  const message = messages[0];
  if (
    messages.length !== 1 ||
    message.role !== 'assistant' ||
    message.status !== 'completed' ||
    !Array.isArray(message.content) ||
    message.content.length !== 1
  )
    throw new Error('invalid provider response');
  const content = record(message.content[0]);
  if (content.type !== 'output_text')
    throw new Error('invalid provider response');
  const used = response.usage == null ? null : record(response.usage);
  return {
    answer: answerFrom(content.text),
    usage: used && {
      inputTokens: tokenCount(used.input_tokens),
      outputTokens: tokenCount(used.output_tokens),
    },
  };
}

function decodeGemini(body: unknown): GeneratedAdvice {
  const response = record(body);
  const feedback =
    response.promptFeedback == null ? null : record(response.promptFeedback);
  if (
    (feedback?.blockReason &&
      feedback.blockReason !== 'BLOCK_REASON_UNSPECIFIED') ||
    !Array.isArray(response.candidates) ||
    response.candidates.length !== 1
  )
    throw new Error('incomplete provider response');
  const candidate = record(response.candidates[0]);
  const content = record(candidate.content);
  if (
    candidate.finishReason !== 'STOP' ||
    content.role !== 'model' ||
    !Array.isArray(content.parts)
  )
    throw new Error('incomplete provider response');
  const parts = content.parts.map(record);
  if (
    !parts.length ||
    parts.some(
      (part) =>
        (part.thought !== undefined && part.thought !== false) ||
        typeof part.text !== 'string' ||
        Object.keys(part).some(
          (key) => !['text', 'thought', 'thoughtSignature'].includes(key),
        ),
    )
  )
    throw new Error('invalid provider response');
  const text = parts.map((part) => part.text).join('');
  const used =
    response.usageMetadata == null ? null : record(response.usageMetadata);
  const inputTokens = used && tokenCount(used.promptTokenCount);
  const outputTokens =
    used &&
    tokenCount(used.candidatesTokenCount) +
      tokenCount(used.thoughtsTokenCount ?? 0);
  return {
    answer: answerFrom(text),
    usage:
      inputTokens === null || outputTokens === null
        ? null
        : { inputTokens, outputTokens },
  };
}

function requireOutputLimit(maxOutputTokens: number) {
  if (
    !Number.isInteger(maxOutputTokens) ||
    maxOutputTokens < 1 ||
    maxOutputTokens > ADVISOR_MAX_OUTPUT_TOKENS
  )
    throw new Error('Invalid advisor output budget');
}

function prepare(
  url: string,
  headers: Record<string, string>,
  body: string,
  outputUnits: number,
  decode: (value: unknown) => GeneratedAdvice,
  stillEligible: () => boolean,
): PreparedAdvisorRequest {
  const { inputUnits } = estimateAdvisorUsage(body, outputUnits);
  let consumed = false;
  return {
    inputUnits,
    outputUnits,
    async generate() {
      if (consumed) throw new Error('Advisor request already consumed');
      consumed = true;
      try {
        if (!stillEligible()) throw new Error('provider eligibility expired');
        const response = await fetch(url, {
          method: 'POST',
          redirect: 'error',
          signal: AbortSignal.timeout(12_000),
          headers: { ...headers, 'Content-Type': 'application/json' },
          body,
        });
        if (!response.ok) throw new Error('provider rejected request');
        const raw = (await response.json()) as unknown;
        const { answer, usage } = decode(raw);
        if (
          usage &&
          (usage.inputTokens > inputUnits || usage.outputTokens > outputUnits)
        )
          throw new Error('provider reported usage over request budget');
        return { answer, usage };
      } catch {
        // Never expose provider body, status text, URL, response ID or an error cause.
        throw new Error('Advisor provider unavailable');
      }
    },
  };
}

function openAIProvider(
  key: string,
  model: string,
  stillEligible: () => boolean,
): AdvisorProvider {
  return {
    mode: 'OPENAI',
    prepare(payload, maxOutputTokens) {
      requireOutputLimit(maxOutputTokens);
      return prepare(
        OPENAI_URL,
        { Authorization: `Bearer ${key}` },
        JSON.stringify({
          model,
          store: false,
          max_output_tokens: maxOutputTokens,
          tools: [],
          instructions: INSTRUCTIONS,
          input: JSON.stringify(payload),
          text: {
            format: {
              type: 'json_schema',
              name: 'advisor_answer',
              strict: true,
              schema: ANSWER_SCHEMA,
            },
          },
        }),
        maxOutputTokens,
        decodeOpenAI,
        stillEligible,
      );
    },
  };
}

function geminiProvider(
  key: string,
  stillEligible: () => boolean,
): AdvisorProvider {
  return {
    mode: 'GEMINI',
    prepare(payload, maxOutputTokens) {
      requireOutputLimit(maxOutputTokens);
      return prepare(
        GEMINI_URL,
        { 'x-goog-api-key': key },
        JSON.stringify({
          systemInstruction: { parts: [{ text: INSTRUCTIONS }] },
          contents: [
            { role: 'user', parts: [{ text: JSON.stringify(payload) }] },
          ],
          generationConfig: {
            candidateCount: 1,
            maxOutputTokens,
            responseMimeType: 'application/json',
            responseJsonSchema: ANSWER_SCHEMA,
            thinkingConfig: {
              thinkingLevel: 'MINIMAL',
              includeThoughts: false,
            },
          },
          // No tools, grounding, priority, cache, uploaded files, or streaming.
        }),
        maxOutputTokens,
        decodeGemini,
        stillEligible,
      );
    },
  };
}

function verifiedGeminiKey(env: NodeJS.ProcessEnv, now: number) {
  const key = env.GEMINI_API_KEY?.trim();
  const sha = env.SORTEX_GEMINI_FREE_KEY_SHA256;
  const verifiedAt = env.SORTEX_GEMINI_FREE_VERIFIED_AT;
  if (
    env.SORTEX_GEMINI_FREE_TIER !== 'verified-no-billing' ||
    env.GEMINI_MODEL !== GEMINI_FREE_MODEL ||
    !key ||
    !/^[A-Za-z0-9_.-]{16,256}$/.test(key) ||
    !sha ||
    !/^[0-9a-f]{64}$/.test(sha) ||
    !verifiedAt ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(verifiedAt)
  )
    return null;
  const timestamp = Date.parse(verifiedAt);
  if (
    !Number.isFinite(timestamp) ||
    new Date(timestamp).toISOString() !== verifiedAt ||
    now < timestamp ||
    now - timestamp >= ATTESTATION_MAX_AGE_MS
  )
    return null;
  // The operator verifies no Google Cloud billing attached to the dedicated
  // Free Tier project and attests this exact Auth key. Never infer billing from
  // model eligibility, key formatting, or a successful provider response.
  const digest = createHash('sha256').update(key, 'utf8').digest();
  return timingSafeEqual(digest, Buffer.from(sha, 'hex')) ? key : null;
}

function pilotAllows(env: NodeJS.ProcessEnv, user: AuthenticatedUser) {
  return (
    env.SORTEX_ADVISOR_PILOT_BUDGET === 'approved' &&
    // This is an operator attestation for the data source, not just the user.
    // The caller must still query only tenant-owned synthetic fixture rows.
    env.SORTEX_ADVISOR_SYNTHETIC_DATA === 'verified-fixtures-only' &&
    env.APP_ENV === 'staging' &&
    env.INTEGRATIONS_MODE === 'sandbox' &&
    env.FEATURE_REAL_PAYMENTS === 'false' &&
    !!env.SORTEX_ADVISOR_PILOT_ORGANIZER_ID &&
    user.id === env.SORTEX_ADVISOR_PILOT_ORGANIZER_ID &&
    user.role === 'ORGANIZER' &&
    user.isActive &&
    user.email?.toLowerCase().endsWith('@example.test')
  );
}

export function createAdvisorProvider(
  env: NodeJS.ProcessEnv,
  user: AuthenticatedUser,
): AdvisorProvider | null {
  if (!pilotAllows(env, user)) return null;
  if (env.SORTEX_ADVISOR_PROVIDER === 'gemini') {
    const key = verifiedGeminiKey(env, Date.now());
    return key
      ? geminiProvider(key, () =>
          Boolean(
            pilotAllows(env, user) &&
            env.SORTEX_ADVISOR_PROVIDER === 'gemini' &&
            verifiedGeminiKey(env, Date.now()) === key,
          ),
        )
      : null;
  }
  if (env.SORTEX_ADVISOR_PROVIDER === 'openai') {
    const key = env.OPENAI_API_KEY?.trim();
    const model = env.OPENAI_MODEL?.trim();
    return key && model && /^[a-zA-Z0-9][a-zA-Z0-9_.-]{1,79}$/.test(model)
      ? openAIProvider(key, model, () =>
          Boolean(
            pilotAllows(env, user) &&
            env.SORTEX_ADVISOR_PROVIDER === 'openai' &&
            env.OPENAI_API_KEY?.trim() === key &&
            env.OPENAI_MODEL?.trim() === model,
          ),
        )
      : null;
  }
  return null;
}
