import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export interface DrawAuditFacts {
  campaignId: string;
  lotteryDrawId: string | null;
  ruleSnapshot: unknown;
  resultSnapshot: unknown;
  winningNumber: string;
  normalizedWinningNumber: string;
  executedAt: Date;
}

@Injectable()
export class AuditHashService {
  readonly algorithmVersion = 'sortex-draw-v2';

  create(payload: unknown) {
    // Canonicalize the exact JSON representation: Date becomes ISO and Prisma
    // JSON/JSONB round-trips cannot change the proof through key order.
    const json = JSON.parse(
      JSON.stringify({ algorithmVersion: this.algorithmVersion, payload }),
    ) as Json;
    return createHash('sha256').update(this.canonical(json)).digest('hex');
  }

  drawHash(facts: DrawAuditFacts) {
    const {
      campaignId,
      lotteryDrawId,
      ruleSnapshot,
      resultSnapshot,
      winningNumber,
      normalizedWinningNumber,
      executedAt,
    } = facts;
    return this.create({
      campaignId,
      lotteryDrawId,
      ruleSnapshot,
      resultSnapshot,
      winningNumber,
      normalizedWinningNumber,
      executedAt: executedAt.toISOString(),
    });
  }

  private canonical(value: Json): string {
    if (value === null || typeof value !== 'object')
      return JSON.stringify(value);
    if (Array.isArray(value))
      return `[${value.map((item) => this.canonical(item)).join(',')}]`;
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${this.canonical(value[key])}`)
      .join(',')}}`;
  }
}
