const normalizationLabels: Record<string, string> = {
  MODULO_TOTAL_NUMBERS: "Resto da divisão pelo total de títulos",
  LAST_N_DIGITS: "Últimos dígitos",
  PAD_LEFT_ZERO: "Zeros à esquerda",
  REJECT_OUT_OF_RANGE: "Rejeitar números fora da faixa de títulos",
  CUSTOM_PIPELINE: "Sequência personalizada",
};

const digitLabels: Record<string, string> = {
  TEN_THOUSAND: "dezena de milhar",
  THOUSAND: "milhar",
  HUNDRED: "centena",
  TEN: "dezena",
  UNIT: "unidade",
};

const prizeStatusLabels: Record<string, string> = {
  IDENTIFIED: "Ganhador identificado",
  PENDING_CONTACT: "Contato pendente",
  CONTACTED: "Ganhador contatado",
  CLAIMED: "Prêmio solicitado",
  PAYMENT_PENDING: "Pagamento pendente",
  DELIVERED: "Entrega registrada",
  CONFIRMED_BY_WINNER: "Recebimento confirmado pelo ganhador",
  NOT_CLAIMED: "Prêmio não solicitado",
  CANCELLED: "Prêmio cancelado",
  DISPUTED: "Prêmio em contestação",
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function integer(value: unknown, min: number, max: number) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max
    ? value
    : undefined;
}

function label(labels: Record<string, string>, value: unknown) {
  const key = text(value);
  return Object.hasOwn(labels, key) ? labels[key] : undefined;
}

function digits(value: unknown) {
  if (typeof value !== "string") return undefined;
  return /^\d{1,12}$/.test(value) ? value : undefined;
}

export function parsePublicProof(payload: unknown, code: string) {
  const proof = record(payload);
  const winningNumber = digits(proof.winningNumber);
  if (proof.verificationCode !== code || !winningNumber) return null;

  const campaign = record(proof.campaign);
  const organizer = record(proof.organizer);
  const draw = record(proof.draw);
  const hash = text(draw.auditHash);
  const timestamp = text(draw.date);
  const drawDate = new Date(timestamp);
  if (
    !/^[a-f0-9]{64}$/i.test(hash) ||
    Number.isNaN(drawDate.getTime()) ||
    drawDate.toISOString() !== timestamp
  ) return null;

  const rule = record(draw.rule);
  const result = record(draw.result);
  const snapshot = record(result.lottery);
  const liveLottery = record(draw.lottery);
  // Prefer the sealed result over the current lottery record.
  const lottery = text(snapshot.extractionNumber) ? snapshot : liveLottery;
  const extraction = text(lottery.extractionNumber);
  const officialUrl = /^[1-9][0-9]{0,8}$/.test(extraction)
    ? `https://servicebus2.caixa.gov.br/portaldeloterias/api/federal/${extraction}`
    : null;
  const source = officialUrl === lottery.sourceUrl ? officialUrl : null;
  const publishedPrizes = lottery.sourcePrizes;
  const originalPrizes = Array.isArray(publishedPrizes) && publishedPrizes.length === 5 &&
    publishedPrizes.every((prize: unknown) => typeof prize === "string" && /^\d{6}$/.test(prize))
    ? publishedPrizes as string[] : [];

  const confirmedAt = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo",
  }).format(drawDate);

  const computed = Array.isArray(result.steps) ? result.steps.slice(0, 12).map(record) : [];
  const legacy = !Array.isArray(rule.steps) && Array.isArray(rule.digits)
    ? rule.digits.slice(0, 12).map((value: unknown) => {
      const item = record(value);
      const order = integer(item.order, 0, 12);
      const position = integer(item.position, 0, 4);
      return {
        order: order === undefined ? undefined : order + 1,
        sourcePrize: item.prize,
        digitPosition: position === undefined ? undefined : Object.keys(digitLabels)[position],
      };
    })
    : null;
  const steps = (Array.isArray(rule.steps) ? rule.steps.slice(0, 12) : legacy ?? [])
    .map((value: unknown) => {
      const step = record(value);
      const order = integer(step.order, 0, 99);
      const prize = integer(step.sourcePrize, 1, 5);
      const position = label(digitLabels, step.digitPosition);
      if (order === undefined || prize === undefined || !position) return null;
      const digit = digits(computed.find((item) => item.order === order)?.selectedDigit);
      return {
        order, prize, position,
        reverse: step.direction === "REVERSE",
        complement: step.transformation === "COMPLEMENT_9",
        digit: digit?.length === 1 ? digit : undefined,
      };
    })
    .filter((step) => step !== null)
    .sort((a, b) => a.order - b.order);

  const slug = text(campaign.slug);
  return {
    code, winningNumber, prizeName: text(proof.prizeName),
    publicName: text(proof.publicDisplayName), publicCity: text(proof.publicCity),
    prizeStatus: label(prizeStatusLabels, proof.status),
    deliveryConfirmed: proof.deliveryConfirmed === true,
    title: text(campaign.title),
    campaignPath: /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug) ? `/campanha/${slug}` : null,
    organizerName: text(organizer.name),
    confirmedAt, hash,
    ruleVersion: integer(rule.version, 1, 99) ?? (legacy ? 1 : undefined),
    outputLength: integer(rule.outputLength, 1, 12) ?? (legacy?.length || undefined),
    normalization: label(normalizationLabels, record(rule.normalization).mode) ?? (legacy ? normalizationLabels.MODULO_TOTAL_NUMBERS : undefined),
    rawResult: digits(result.rawResult), normalizedResult: digits(result.normalizedResult),
    steps, extraction: /^[1-9][0-9]{0,8}$/.test(extraction) ? extraction : null,
    originalPrizes, source,
  };
}

export type PublicProof = NonNullable<ReturnType<typeof parsePublicProof>>;
