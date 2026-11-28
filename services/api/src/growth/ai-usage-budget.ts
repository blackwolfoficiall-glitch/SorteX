import { HttpException, HttpStatus } from '@nestjs/common';

export const ADVISOR_MAX_BODY_BYTES = 2048;
export const ADVISOR_INPUT_FRAMING_UNITS = 128;
export const ADVISOR_MAX_OUTPUT_TOKENS = 512;

export const AI_USAGE_DAILY_LIMITS = Object.freeze({
  organizer: Object.freeze({
    requestCount: 8,
    inputUnits: 8192,
    outputUnits: 3072,
  }),
  global: Object.freeze({
    requestCount: 24,
    inputUnits: 24576,
    outputUnits: 9216,
  }),
});

export type AdvisorUsageEstimate = Readonly<{
  inputUnits: number;
  outputUnits: number;
}>;

export class AiQuotaRequestTooLargeException extends HttpException {
  constructor() {
    super(
      {
        code: 'AI_QUOTA_REQUEST_TOO_LARGE',
        message: 'A consulta ultrapassa o limite individual da IA SorteX.',
      },
      HttpStatus.PAYLOAD_TOO_LARGE,
    );
  }
}

export function assertAdvisorUsageEstimate(
  input: AdvisorUsageEstimate,
): asserts input is AdvisorUsageEstimate {
  if (
    !Number.isSafeInteger(input.inputUnits) ||
    input.inputUnits <= ADVISOR_INPUT_FRAMING_UNITS ||
    input.inputUnits > ADVISOR_MAX_BODY_BYTES + ADVISOR_INPUT_FRAMING_UNITS ||
    !Number.isSafeInteger(input.outputUnits) ||
    input.outputUnits < 1 ||
    input.outputUnits > ADVISOR_MAX_OUTPUT_TOKENS
  )
    throw new AiQuotaRequestTooLargeException();
}

/**
 * Use the UTF-8 length of exactly the serialized outbound provider body,
 * plus a fixed framing reserve. These are conservative application budget
 * units, not an assertion about a provider's tokenizer or its bill.
 */
export function estimateAdvisorUsage(
  serializedBody: string,
  maxOutputTokens: number,
): AdvisorUsageEstimate {
  if (typeof serializedBody !== 'string' || !serializedBody.trim())
    throw new AiQuotaRequestTooLargeException();
  const estimate = {
    inputUnits:
      Buffer.byteLength(serializedBody, 'utf8') + ADVISOR_INPUT_FRAMING_UNITS,
    outputUnits: maxOutputTokens,
  };
  assertAdvisorUsageEstimate(estimate);
  return estimate;
}
