import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  AI_USAGE_DAILY_LIMITS,
  type AdvisorUsageEstimate,
  assertAdvisorUsageEstimate,
} from './ai-usage-budget';

export class AiQuotaLimitException extends HttpException {
  constructor() {
    super(
      {
        code: 'AI_QUOTA_LIMIT',
        message:
          'O limite diário da IA SorteX foi atingido. Tente novamente após 00h UTC.',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

export class AiQuotaUnavailableException extends HttpException {
  constructor() {
    super(
      {
        code: 'AI_QUOTA_UNAVAILABLE',
        message:
          'Não foi possível confirmar o limite da IA SorteX. Nenhuma consulta foi enviada.',
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

type Reservation = AdvisorUsageEstimate & Readonly<{ organizerId: string }>;
type QuotaBucket = 'GLOBAL' | 'ORGANIZER';

@Injectable()
export class AiUsageQuotaService {
  constructor(private readonly prisma: PrismaService) {}

  /** A returned reservation consumes one potential provider request. Never refund it. */
  async reserve(input: Reservation): Promise<void> {
    if (
      typeof input.organizerId !== 'string' ||
      !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(input.organizerId)
    )
      throw new AiQuotaUnavailableException();
    assertAdvisorUsageEstimate(input);

    try {
      // ON CONFLICT atomically compares and updates a locked row. Always
      // acquire the global bucket first, then the organizer's, in one tx:
      // no partial debit on a tenant denial, and no host-local quota bypass.
      await this.prisma.$transaction(
        async (tx) => {
          await this.debit(tx, 'GLOBAL', 'GLOBAL', input);
          await this.debit(tx, 'ORGANIZER', input.organizerId, input);
        },
        { isolationLevel: 'ReadCommitted', maxWait: 2000, timeout: 5000 },
      );
    } catch (error) {
      if (error instanceof AiQuotaLimitException) throw error;
      // A DB timeout, unknown commit outcome, or missing migration must
      // prevent the network send. Do not retry or leak database details.
      throw new AiQuotaUnavailableException();
    }
  }

  private async debit(
    tx: Prisma.TransactionClient,
    scope: QuotaBucket,
    scopeId: string,
    usage: AdvisorUsageEstimate,
  ) {
    const limits =
      scope === 'GLOBAL'
        ? AI_USAGE_DAILY_LIMITS.global
        : AI_USAGE_DAILY_LIMITS.organizer;
    const affected = await tx.$executeRaw`
      INSERT INTO "AiUsageDailyQuota" AS quota
        ("day", "scope", "scopeId", "requestCount", "inputUnits", "outputUnits")
      VALUES ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date,
        ${scope}, ${scopeId}, 1, ${usage.inputUnits}::int, ${usage.outputUnits}::int)
      ON CONFLICT ("day", "scope", "scopeId") DO UPDATE SET
        "requestCount" = quota."requestCount" + EXCLUDED."requestCount",
        "inputUnits" = quota."inputUnits" + EXCLUDED."inputUnits",
        "outputUnits" = quota."outputUnits" + EXCLUDED."outputUnits"
      WHERE quota."requestCount" <= ${limits.requestCount - 1}::int
        AND quota."inputUnits" <= ${limits.inputUnits - usage.inputUnits}::int
        AND quota."outputUnits" <= ${limits.outputUnits - usage.outputUnits}::int
    `;
    if (affected === 0) throw new AiQuotaLimitException();
    if (affected !== 1) throw new AiQuotaUnavailableException();
  }
}
